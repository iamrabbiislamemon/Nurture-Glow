import express from 'express';
import { query } from '../db.js';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getBySubtype,
  upsertBySubtype,
  listCatalog
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  createNotification,
  parseJson,
  isPlainObject,
  normalizeEnumValue
} from '../utils/index.js';
import { normalizeRoleValue } from '../roles.js';

export function createCatalogRouter({ requireAuth }) {
  const router = express.Router();


  const getDoctorReviewSummary = async () => {
    const rows = await query(`SELECT data FROM app_entities WHERE type = 'doctor_review'`);
    const summary = new Map();
    rows.forEach((row) => {
      const data = parseJson(row.data, {});
      const doctorId = data.doctorId;
      const rating = Number(data.rating);
      if (!doctorId || Number.isNaN(rating)) return;
      const existing = summary.get(doctorId) || { total: 0, count: 0 };
      existing.total += rating;
      existing.count += 1;
      summary.set(doctorId, existing);
    });
    return summary;
  };

  const attachDoctorReviewStats = (items, summary) =>
    items.map((item) => {
      const stats = summary.get(item.id);
      const count = stats?.count || 0;
      const average = count ? Number((stats.total / count).toFixed(1)) : null;
      return {
        ...item,
        rating: Number.isFinite(average) ? average : item.rating ?? null,
        reviewCount: count
      };
    });

  // From doctorHelpers
  const listRealDoctors = async () => {
    const rows = await query(
      `SELECT d.id, d.user_id, d.full_name, d.fee_amount, d.rating, d.availability_status, s.name AS specialty_name
       FROM doctors d
       LEFT JOIN doctor_specialties s ON d.specialty_id = s.id
       ORDER BY d.full_name ASC`
    );
    const doctorIds = rows.map((row) => row.id);
    const userIds = rows.map((row) => row.user_id).filter(Boolean);
    
    // Inline loading of slots/settings
    const slotMap = new Map();
    if (doctorIds.length) {
      const ph = doctorIds.map(() => '?').join(',');
      const slotRows = await query(
        `SELECT doctor_id, start_time, end_time, slot_duration_minutes, max_consultations FROM doctor_availability_slots WHERE doctor_id IN (${ph})`,
        doctorIds
      );
      const grouped = new Map();
      slotRows.forEach((row) => {
        if (!grouped.has(row.doctor_id)) grouped.set(row.doctor_id, []);
        grouped.get(row.doctor_id).push(row);
      });
      grouped.forEach((dRows, doctorId) => {
        const slots = [];
        dRows.forEach((r) => {
          slots.push(r.start_time || '09:00 AM');
        });
        slotMap.set(doctorId, slots);
      });
    }

    const settingsMap = new Map();
    if (userIds.length) {
      const ph = userIds.map(() => '?').join(',');
      const settingsRows = await query(
        `SELECT user_id, data FROM app_entities WHERE type = 'doctor_settings' AND user_id IN (${ph})`,
        userIds
      );
      for (const sr of settingsRows) {
        settingsMap.set(sr.user_id, parseJson(sr.data, {}));
      }
    }

    return rows.map((row) => {
      const settings = settingsMap.get(row.user_id) || {};
      const status = String(row.availability_status || '').toLowerCase();
      const type = status.includes('online') ? 'Online' : status.includes('offline') ? 'Offline' : 'Both';
      const catalog = {
        id: row.id,
        name: row.full_name || 'Doctor',
        specialty: row.specialty_name || 'General',
        hospital: settings.hospital || '',
        location: '',
        image: '',
        fee: Number(row.fee_amount) || 0,
        availableSlots: slotMap.get(row.id) || ['09:00 AM', '10:30 AM', '04:00 PM'],
        type,
        rating: row.rating ? Number(row.rating) : null
      };
      if (settings.bio) catalog.bio = settings.bio;
      return catalog;
    });
  };

  router.get('/catalog/specialties', async (req, res, next) => {
    try {
      const rows = await query('SELECT id, name, description FROM doctor_specialties ORDER BY name ASC');
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  });

  router.get('/catalog/:type', async (req, res, next) => {
    try {
      const map = {
        doctors: 'doctor',
        hospitals: 'hospital',
        medicines: 'medicine'
      };
      const type = map[req.params.type];
      if (!type) {
        return res.status(404).json({ error: 'Unknown catalog type' });
      }
      if (type === 'doctor') {
        const items = await listRealDoctors();
        const summary = await getDoctorReviewSummary();
        return res.json({ items: attachDoctorReviewStats(items, summary) });
      }
      const items = await listCatalog(type);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });


  router.get('/catalog/doctors', async (req, res, next) => {
    try {
      const items = await listRealDoctors();
      const summary = await getDoctorReviewSummary();
      res.json({ items: attachDoctorReviewStats(items, summary) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/catalog/hospitals', async (req, res, next) => {
    try {
      const items = await listCatalog('hospital');
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.get('/catalog/medicines', async (req, res, next) => {
    try {
      const items = await listCatalog('medicine');
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // ==================== ORDER ENDPOINTS ====================
  
  // Create new order from cart

  // SQL: Fetch subscription plans from subscription_plans table
  router.get('/subscription-plans', async (req, res, next) => {
    try {
      const rows = await query(
        'SELECT id, plan_name, price, currency, billing_cycle, features, is_popular, badge_text FROM subscription_plans WHERE is_active = TRUE ORDER BY price ASC'
      );
      // Parse features JSON string into array
      const plans = rows.map(r => ({
        ...r,
        features: JSON.parse(r.features || '[]')
      }));
      res.json({ items: plans });
    } catch (err) {
      next(err);
    }
  });

  // SQL: Fetch FAQs from faqs table
  router.get('/faqs', async (req, res, next) => {
    try {
      const { category } = req.query;
      let sql = 'SELECT id, question, answer, category FROM faqs WHERE is_active = TRUE';
      const params = [];
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      sql += ' ORDER BY sort_order ASC';
      const rows = await query(sql, params);
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  });

  // SQL: Fetch nutrition goals from nutrition_goals table

  return router;
}
