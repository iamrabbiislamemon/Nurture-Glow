import express from 'express';
import { query } from '../db.js';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  upsertBySubtype,
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  parseJson
} from '../utils/index.js';

export function createHealthRouter(deps = {}) {
  const requireAuth = deps.requireAuth || ((req, res, next) => next());
  const router = express.Router();

  router.get('/health', async (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  
  router.get('/health/history', requireAuth, async (req, res, next) => {
    try {
      const metric = String(req.query.metric || '').trim();
      if (!metric) {
        return res.status(400).json({ error: 'metric is required' });
      }
      const items = await listEntities({
        type: 'health_history',
        userId: req.user.sub,
        subtype: metric
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/health/history', requireAuth, async (req, res, next) => {
    try {
      const { metric, date, value } = req.body || {};
      if (!metric || !date || !value) {
        return res.status(400).json({ error: 'metric, date, and value are required' });
      }
      const item = await createEntity({
        type: 'health_history',
        userId: req.user.sub,
        subtype: metric,
        data: { date, value }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });


  router.get('/nutrition', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'nutrition_log', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/nutrition', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const name = toTrimmedString(data.name, 120);
      const calories = toPositiveNumber(data.calories);
      const mealType = normalizeEnumValue(data.type, allowedMealTypes);
      if (data.type !== undefined && !mealType) {
        return res.status(400).json({ error: 'Invalid meal type' });
      }
      if (!name || calories === null) {
        return res.status(400).json({ error: 'name and calories are required' });
      }
      const payload = {
        ...data,
        userId: req.user.sub,
        name,
        calories,
        type: mealType || undefined,
        time: toTrimmedString(data.time, 40) || new Date().toLocaleTimeString()
      };
      const item = await createEntity({
        type: 'nutrition_log',
        userId: req.user.sub,
        data: payload
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });


  router.get('/nutrition/goals', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      // Try user-specific goals first, fall back to defaults
      let rows = await query(
        'SELECT id, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, water_glasses, trimester FROM nutrition_goals WHERE user_id = ? AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      if (rows.length === 0) {
        rows = await query(
          'SELECT id, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g, water_glasses, trimester FROM nutrition_goals WHERE user_id IS NULL AND is_active = TRUE ORDER BY trimester ASC'
        );
      }
      res.json({ goals: rows });
    } catch (err) {
      next(err);
    }
  });

  // SQL: Fetch pregnancy week info from pregnancy_week_info table
  router.get('/pregnancy/week-info', requireAuth, async (req, res, next) => {
    try {
      const { week } = req.query;
      let sql = 'SELECT id, week_number, trimester, stage_name, baby_size, nutrients, symptoms, tips FROM pregnancy_week_info WHERE is_active = TRUE';
      const params = [];
      if (week) {
        sql += ' AND week_number = ?';
        params.push(parseInt(week));
      }
      sql += ' ORDER BY week_number ASC';
      const rows = await query(sql, params);
      // Parse JSON fields — mysql2 may return JSON cols already parsed
      const safeParse = (v) => (typeof v === 'string' ? JSON.parse(v) : v) || [];
      const data = rows.map(r => ({
        ...r,
        nutrients: safeParse(r.nutrients),
        symptoms: safeParse(r.symptoms),
        tips: safeParse(r.tips)
      }));
      res.json({ items: data });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // DOCTOR DASHBOARD ROUTES
  // =====================================================

  // Get doctor dashboard overview

  router.get('/dashboard/summary', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const today = new Date().toISOString().split('T')[0];

      // Parallel fetch all data
      const [
        metaRows,
        appointmentRows,
        vaccineRows,
        healthHistoryRows
      ] = await Promise.all([
        // User meta (hydration, pregnancyWeek)
        query(
          `SELECT meta_key, meta_value FROM app_user_meta WHERE user_id = ? AND meta_key IN ('hydration', 'pregnancyWeek')`,
          [userId]
        ),
        // Appointments for this user
        query(
          `SELECT id, data, created_at FROM app_entities WHERE type = 'appointment' AND user_id = ? ORDER BY created_at DESC`,
          [userId]
        ),
        // Vaccines for this user
        query(
          `SELECT id, data, created_at FROM app_entities WHERE type = 'vaccine' AND user_id = ? ORDER BY created_at DESC`,
          [userId]
        ),
        // Health history entries for this user (last 30 days, key metrics)
        query(
          `SELECT id, subtype, data, created_at FROM app_entities 
           WHERE type = 'health_history' AND user_id = ? 
           AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           ORDER BY created_at DESC`,
          [userId]
        )
      ]);

      // Parse user meta
      const meta = {};
      metaRows.forEach(row => {
        meta[row.meta_key] = row.meta_value;
      });
      const pregnancyWeek = Number(meta.pregnancyWeek) || 0;
      const waterToday = Number(meta.hydration) || 0;

      // Parse appointments and count upcoming
      const nowMs = Date.now();
      let upcomingAppointments = 0;
      appointmentRows.forEach(row => {
        const data = parseJson(row.data, {});
        const status = String(data.status || '').toLowerCase();
        // Check if scheduled or upcoming and not cancelled/completed
        if (status === 'cancelled' || status === 'completed' || status === 'pending' || status === 'requested' || status === 'request') return;
        
        // Check scheduledAt or date
        const scheduledAt = data.scheduledAt || data.date;
        if (!scheduledAt) return;
        
        const scheduledDate = new Date(scheduledAt);
        if (Number.isFinite(scheduledDate.getTime()) && scheduledDate.getTime() > nowMs) {
          upcomingAppointments++;
        }
      });

      // Parse vaccines and calculate progress
      let totalVaccines = 0;
      let completedVaccines = 0;
      vaccineRows.forEach(row => {
        const data = parseJson(row.data, {});
        totalVaccines++;
        const status = String(data.status || '').toLowerCase();
        const verification = String(data.verificationStatus || '').toLowerCase();
        const isVerified = verification === 'approved' || verification === 'auto';
        if ((status === 'taken' || status === 'completed') && isVerified) {
          completedVaccines++;
        }
      });
      const vaccineProgress = totalVaccines > 0 
        ? Math.round((completedVaccines / totalVaccines) * 100) 
        : 0;

      // Parse health history and get latest values for key metrics
      const healthMetrics = {};
      const metricTypes = ['Heart Rate', 'Weight', 'Sleep', 'Blood Pressure', 'Mood', 'Steps'];
      
      healthHistoryRows.forEach(row => {
        const metricType = row.subtype;
        if (!metricTypes.includes(metricType)) return;
        if (healthMetrics[metricType]) return; // Already have latest
        
        const data = parseJson(row.data, {});
        healthMetrics[metricType] = {
          value: data.value || null,
          date: data.date || row.created_at,
          unit: getMetricUnit(metricType)
        };
      });

      // Build health summary array with only available metrics
      const healthSummaryMetrics = Object.entries(healthMetrics).map(([type, data]) => ({
        type,
        value: data.value,
        date: data.date,
        unit: data.unit
      }));

      res.json({
        pregnancyWeek,
        waterToday,
        vaccineProgress,
        vaccineCounts: {
          total: totalVaccines,
          completed: completedVaccines
        },
        upcomingAppointments,
        healthSummaryMetrics
      });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // NUTRITIONIST DASHBOARD ROUTES
  // =====================================================

  // GET /nutritionist/dashboard – overview data

  router.get('/health-id/verification-status', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;

      // Check for existing verification entity
      const verifications = await listEntities({ type: 'health_id_verification', userId });
      const latest = (verifications || [])
        .sort((a, b) => new Date(b.requestedAt || b.createdAt || 0).getTime() - new Date(a.requestedAt || a.createdAt || 0).getTime())
        [0];

      // Get user health_id from users table
      const userRows = await query(`SELECT health_id FROM users WHERE id = ? LIMIT 1`, [userId]);
      const healthId = userRows.length > 0 ? userRows[0].health_id : null;

      res.json({
        success: true,
        data: {
          health_id: healthId || '',
          status: latest ? (latest.status || 'none') : 'none'
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /health-id/verification-request – submit a verification request
  router.post('/health-id/verification-request', requireAuth, async (req, res, next) => {
    try {
      const { request_note } = req.body || {};

      // Require Marriage Certificate (mandatory). NID is optional.
      const userDocs = await listEntities({ type: 'verification_doc', userId: req.user.sub });
      const uploadedDocs = (userDocs || []).filter(d => d.fileUrl && d.type);
      const hasMarriageCert = uploadedDocs.some(d => d.type === 'MARRIAGE_CERT');
      if (!hasMarriageCert) {
        return res.status(400).json({ error: 'You must upload your Marriage Certificate before requesting verification. NID is optional.' });
      }

      // Check for existing pending request
      const existingRequests = await listEntities({ type: 'health_id_verification', userId: req.user.sub });
      const pendingExists = (existingRequests || []).some(r => r.status === 'pending');
      if (pendingExists) {
        return res.status(400).json({ error: 'You already have a pending verification request.' });
      }

      // Collect document references for admin review
      const docSummary = uploadedDocs.map(d => ({
        type: d.type || d.subtype,
        fileName: d.fileName || '',
        fileUrl: d.fileUrl || '',
        status: d.status || 'PENDING',
        uploadedAt: d.uploadedAt || d.createdAt || ''
      }));

      // Get user info for the notification
      const userRows = await query(
        `SELECT u.email, u.health_id, p.full_name FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ? LIMIT 1`,
        [req.user.sub]
      );
      const userName = userRows.length > 0 ? (userRows[0].full_name || userRows[0].email || 'A user') : 'A user';
      const healthId = userRows.length > 0 ? (userRows[0].health_id || '') : '';

      const verification = await createEntity({
        type: 'health_id_verification',
        userId: req.user.sub,
        data: {
          userId: req.user.sub,
          requestNote: request_note || '',
          requestedAt: new Date().toISOString(),
          status: 'pending',
          documents: docSummary,
          userName,
          healthId
        }
      });

      // Update user profile status
      const profileRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );

      if (profileRows.length > 0) {
        const profile = parseJson(profileRows[0].data, {});
        profile.healthIdStatus = 'pending';
        await query(`UPDATE app_entities SET data = ? WHERE id = ?`, [JSON.stringify(profile), profileRows[0].id]);
      }

      // Notify system admins about the new verification request
      const adminUsers = await query(
        `SELECT id FROM users WHERE role = 'system_admin'`,
        []
      );
      for (const admin of adminUsers) {
        await createNotification(admin.id, {
          type: 'HEALTH_ID_VERIFICATION_REQUEST',
          entityId: verification.id,
          title: 'New Health ID Verification Request',
          message: `${userName} (${healthId}) has submitted a Health ID verification request with ${uploadedDocs.length} document(s).`,
          link: '/admin/system/health-verifications'
        });
      }

      res.status(201).json({
        success: true,
        data: {
          request_id: verification.id,
          status: 'pending'
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /hospital/verification-requests – list pending health ID verification requests
  router.get('/hospital/verification-requests', requireAuth, async (req, res, next) => {
    try {
      const statusFilter = req.query.status || 'pending';
      const requests = await listEntities({ type: 'health_id_verification' });

      const filtered = (requests || [])
        .filter(r => statusFilter === 'all' ? true : r.status === statusFilter)
        .sort((a, b) => new Date(b.requestedAt || b.createdAt || 0).getTime() - new Date(a.requestedAt || a.createdAt || 0).getTime());

      // Enrich each request with user info and documents
      const enriched = await Promise.all(filtered.map(async (r) => {
        const userId = r.userId || null;
        let userName = 'Unknown';
        let userEmail = '';
        let healthId = '';
        let documents = r.documents || [];

        if (userId) {
          const userRows = await query(
            `SELECT u.email, u.health_id, p.full_name FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ? LIMIT 1`,
            [userId]
          );
          if (userRows.length > 0) {
            userName = userRows[0].full_name || 'User';
            userEmail = userRows[0].email || '';
            healthId = userRows[0].health_id || '';
          }

          // If no documents stored in entity, fetch them live
          if (!documents.length) {
            const userDocs = await listEntities({ type: 'verification_doc', userId });
            documents = (userDocs || []).filter(d => d.fileUrl).map(d => ({
              type: d.type || d.subtype,
              fileName: d.fileName || '',
              fileUrl: d.fileUrl || '',
              status: d.status || 'PENDING',
              uploadedAt: d.uploadedAt || d.createdAt || ''
            }));
          }
        }

        return {
          id: r.id,
          userId,
          hospitalId: r.hospitalId || null,
          requestNote: r.requestNote || '',
          requestedAt: r.requestedAt || r.createdAt || null,
          status: r.status || 'pending',
          userName: r.userName || userName,
          userEmail,
          healthId: r.healthId || healthId,
          documents
        };
      }));

      res.json({ success: true, items: enriched });
    } catch (err) {
      next(err);
    }
  });

  // POST /hospital/verification-requests/:id/decision – approve or reject a verification request
  router.post('/hospital/verification-requests/:id/decision', requireAuth, async (req, res, next) => {
    try {
      const { decision, rejection_reason } = req.body || {};

      if (!['accepted', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be "accepted" or "rejected"' });
      }

      const existing = await getEntity({ id: req.params.id, type: 'health_id_verification' });
      if (!existing) {
        return res.status(404).json({ error: 'Verification request not found' });
      }

      const newStatus = decision; // 'accepted' or 'rejected' – matches frontend HealthIdVerificationStatus type

      const updated = await updateEntity({
        id: req.params.id,
        type: 'health_id_verification',
        data: {
          status: newStatus,
          decidedBy: req.user.sub,
          decidedAt: new Date().toISOString(),
          rejectionReason: rejection_reason || null
        }
      });

      // Update user profile healthIdStatus
      if (existing.userId) {
        const profileRows = await query(
          `SELECT id, data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
          [existing.userId]
        );
        if (profileRows.length > 0) {
          const profile = parseJson(profileRows[0].data, {});
          profile.healthIdStatus = newStatus;
          await query(`UPDATE app_entities SET data = ? WHERE id = ?`, [JSON.stringify(profile), profileRows[0].id]);
        }

        // Notify the user about the decision
        const adminRows = await query(
          `SELECT p.full_name FROM user_profiles p WHERE p.user_id = ? LIMIT 1`,
          [req.user.sub]
        );
        const adminName = adminRows.length > 0 ? adminRows[0].full_name : 'Admin';

        await createNotification(existing.userId, {
          type: decision === 'accepted' ? 'HEALTH_ID_VERIFIED' : 'HEALTH_ID_REJECTED',
          entityId: req.params.id,
          title: decision === 'accepted' ? 'Health ID Verified!' : 'Health ID Verification Rejected',
          message: decision === 'accepted'
            ? 'Your Health ID has been verified. You now have full access to all features.'
            : `Your Health ID verification was rejected. ${rejection_reason ? 'Reason: ' + rejection_reason : 'Please re-upload your documents and try again.'}`,
          link: '/profile'
        });
      }

      res.json({
        success: true,
        data: { status: newStatus }
      });
    } catch (err) {
      next(err);
    }
  });

  // Helper function for metric units
  function getMetricUnit(metricType) {
    const units = {
      'Heart Rate': 'bpm',
      'Weight': 'kg',
      'Sleep': 'hrs',
      'Blood Pressure': 'mmHg',
      'Mood': '',
      'Steps': 'steps'
    };
    return units[metricType] || '';
  }

  return router;
}
