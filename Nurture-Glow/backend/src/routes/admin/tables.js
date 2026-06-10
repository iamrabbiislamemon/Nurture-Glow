import express from 'express';
import { query } from '../../db.js';
import { seedDatabase } from '../../seed.js';
import { v4 as uuidv4 } from 'uuid';
import { checkSuspensionStatus } from '../../index.js'; // wait, we can pass checkSuspensionStatus in or import it.

const DB_NAME = process.env.DB_NAME || 'neonest';

const TABLES = [
  'users',
  'user_profiles',
  'roles',
  'user_roles',
  'user_oauth_tokens',
  'emergency_contacts',
  'mothers',
  'pregnancies',
  'children',
  'health_records',
  'health_record_files',
  'allergies',
  'pregnancy_checkins',
  'child_growth_logs',
  'vaccine_schedules',
  'vaccine_schedule_items',
  'vaccination_events',
  'reminders',
  'reminder_deliveries',
  'mental_questions',
  'mental_assessments',
  'mental_answers',
  'referrals',
  'doctor_specialties',
  'doctors',
  'doctor_availability_slots',
  'consultations',
  'video_sessions',
  'consultation_messages',
  'hospitals',
  'icu_status_updates',
  'ambulances',
  'emergency_requests',
  'emergency_status_events',
  'gov_resources',
  'certificates',
  'vendors',
  'product_categories',
  'products',
  'orders',
  'order_items',
  'payments',
  'files',
  'file_links',
  'chat_history',
  'notifications',
  'audit_logs',
  'addresses',
  'ngos',
  'doctor_reviews',
  'product_reviews'
];

const tableCache = new Map();

async function getTableMeta(table) {
  if (tableCache.has(table)) {
    return tableCache.get(table);
  }

  const columns = await query(
    `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [DB_NAME, table]
  );

  const pkColumns = await query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [DB_NAME, table]
  );

  const meta = {
    columns: columns.map(col => ({
      name: col.COLUMN_NAME,
      nullable: col.IS_NULLABLE === 'YES',
      hasDefault: col.COLUMN_DEFAULT !== null,
      autoIncrement: String(col.EXTRA || '').includes('auto_increment')
    })),
    pk: pkColumns.map(col => col.COLUMN_NAME)
  };

  tableCache.set(table, meta);
  return meta;
}

export function createTablesAdminRouter({ requireAuth, requireRole, checkSuspensionStatus }) {
  const router = express.Router();
  const suspensionMiddleware = checkSuspensionStatus || ((req, res, next) => next());

  router.get('/tables', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      const metas = await Promise.all(TABLES.map(async (table) => {
        const meta = await getTableMeta(table);
        return { table, columns: meta.columns, pk: meta.pk };
      }));
      res.json({ tables: metas });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:table', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      const table = req.params.table;
      if (!TABLES.includes(table)) {
        return res.status(404).json({ error: 'Unknown table' });
      }

      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

      const rows = await query(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [limit, offset]);
      res.json({ rows });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:table/row', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      const table = req.params.table;
      if (!TABLES.includes(table)) {
        return res.status(404).json({ error: 'Unknown table' });
      }

      const meta = await getTableMeta(table);
      if (!meta.pk.length) {
        return res.status(400).json({ error: 'Table has no primary key' });
      }

      const whereClauses = [];
      const params = [];
      for (const pk of meta.pk) {
        const value = req.query[pk];
        if (!value) {
          return res.status(400).json({ error: `Missing primary key ${pk}` });
        }
        whereClauses.push(`\`${pk}\` = ?`);
        params.push(value);
      }

      const rows = await query(`SELECT * FROM \`${table}\` WHERE ${whereClauses.join(' AND ')} LIMIT 1`, params);
      if (!rows.length) {
        return res.status(404).json({ error: 'Row not found' });
      }
      res.json({ row: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:table', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      const table = req.params.table;
      if (!TABLES.includes(table)) {
        return res.status(404).json({ error: 'Unknown table' });
      }

      const meta = await getTableMeta(table);
      const body = req.body || {};

      const columns = meta.columns.map(col => col.name);
      const autoCols = new Set(meta.columns.filter(col => col.autoIncrement).map(col => col.name));

      if (columns.includes('id') && !body.id && !autoCols.has('id')) {
        body.id = uuidv4();
      }

      const keys = Object.keys(body).filter(key => columns.includes(key) && !autoCols.has(key));
      if (!keys.length) {
        return res.status(400).json({ error: 'No valid columns supplied' });
      }

      const placeholders = keys.map(() => '?').join(', ');
      const colsSql = keys.map(key => `\`${key}\``).join(', ');
      const values = keys.map(key => body[key]);

      await query(`INSERT INTO \`${table}\` (${colsSql}) VALUES (${placeholders})`, values);

      res.status(201).json({ id: body.id || null });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:table/row', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      const table = req.params.table;
      if (!TABLES.includes(table)) {
        return res.status(404).json({ error: 'Unknown table' });
      }

      const meta = await getTableMeta(table);
      if (!meta.pk.length) {
        return res.status(400).json({ error: 'Table has no primary key' });
      }

      const whereClauses = [];
      const params = [];
      for (const pk of meta.pk) {
        const value = req.query[pk];
        if (!value) {
          return res.status(400).json({ error: `Missing primary key ${pk}` });
        }
        whereClauses.push(`\`${pk}\` = ?`);
        params.push(value);
      }

      const columns = meta.columns.map(col => col.name);
      const autoCols = new Set(meta.columns.filter(col => col.autoIncrement).map(col => col.name));

      const updates = Object.keys(req.body || {})
        .filter(key => columns.includes(key) && !autoCols.has(key) && !meta.pk.includes(key));

      if (!updates.length) {
        return res.status(400).json({ error: 'No valid columns supplied' });
      }

      const setSql = updates.map(key => `\`${key}\` = ?`).join(', ');
      const values = updates.map(key => req.body[key]);

      await query(
        `UPDATE \`${table}\` SET ${setSql} WHERE ${whereClauses.join(' AND ')}`,
        [...values, ...params]
      );

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:table/row', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      const table = req.params.table;
      if (!TABLES.includes(table)) {
        return res.status(404).json({ error: 'Unknown table' });
      }

      const meta = await getTableMeta(table);
      if (!meta.pk.length) {
        return res.status(400).json({ error: 'Table has no primary key' });
      }

      const whereClauses = [];
      const params = [];
      for (const pk of meta.pk) {
        const value = req.query[pk];
        if (!value) {
          return res.status(400).json({ error: `Missing primary key ${pk}` });
        }
        whereClauses.push(`\`${pk}\` = ?`);
        params.push(value);
      }

      await query(`DELETE FROM \`${table}\` WHERE ${whereClauses.join(' AND ')}`, params);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/seed', requireAuth, requireRole('system_admin'), suspensionMiddleware, async (req, res, next) => {
    try {
      await seedDatabase();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
