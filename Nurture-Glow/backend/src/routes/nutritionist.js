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

export function createNutritionistRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  router.get('/nutritionist/dashboard', requireAuth, requireRole('nutritionist'), async (req, res, next) => {
    try {
      const userId = req.user.sub;

      const [plans, patients, notifications, userRows] = await Promise.all([
        listEntities({ type: 'nutrition_plan', userId }),
        listEntities({ type: 'nutrition_patient', userId }),
        listEntities({ type: 'notification', userId }),
        query(`SELECT email FROM users WHERE id = ? LIMIT 1`, [userId])
      ]);

      const safePlans = (plans || []).map(p => ({
        id: p.id,
        status: normalizeEnumValue(p.status || 'draft', allowedNutritionPlanStatuses) || 'draft',
        patientName: toTrimmedString(p.patientName, 200),
        createdAt: p.createdAt || null,
        updatedAt: p.updatedAt || null
      }));

      const totalPlans = safePlans.length;
      const activePlans = safePlans.filter(p => p.status === 'active').length;
      const draftPlans = safePlans.filter(p => p.status === 'draft').length;
      const completedPlans = safePlans.filter(p => p.status === 'completed').length;
      const totalPatients = (patients || []).length;
      const activePatients = (patients || []).filter(p => p.status === 'active').length;
      const unreadNotifications = (notifications || []).filter(n => !n.isRead).length;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const newPatientsThisMonth = (patients || []).filter(p => p.createdAt && p.createdAt >= monthStart).length;

      const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

      res.json({
        profile: {
          id: userId,
          name: req.user?.name || req.user?.email || 'Nutritionist',
          email: userRows.length > 0 ? userRows[0].email : (req.user?.email || null),
          phone: req.user?.phone || null,
          avatar: req.user?.avatar || null
        },
        stats: {
          totalPatients,
          newPatientsThisMonth,
          activePlans,
          draftPlans,
          completedPlans,
          totalPlans,
          consultationsThisMonth: 0,
          avgCompletionRate: completionRate,
          patientSatisfaction: null
        },
        recentConsultations: [],
        upcomingFollowUps: []
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /nutritionist/patients – list patients
  router.get('/nutritionist/patients', requireAuth, requireRole('nutritionist'), async (req, res, next) => {
    try {
      const statusFilter = toTrimmedString(req.query.status, 50).toLowerCase();
      const items = await listEntities({ type: 'nutrition_patient', userId: req.user.sub });

      const patients = (items || [])
        .map(p => ({
          id: p.id,
          name: toTrimmedString(p.name, 200),
          email: toOptionalString(p.email, 200) || null,
          age: toNonNegativeNumber(p.age) ?? null,
          bmi: toNonNegativeNumber(p.bmi) ?? null,
          dietaryRestrictions: toOptionalString(p.dietaryRestrictions, 2000) || null,
          goals: toOptionalString(p.goals, 2000) || null,
          lastConsultation: p.lastConsultation || null,
          status: normalizeEnumValue(p.status || 'active', new Set(['active', 'completed', 'inactive'])) || 'active',
          createdAt: p.createdAt || null
        }))
        .filter(p => (statusFilter && statusFilter !== 'all' ? p.status === statusFilter : true));

      res.json({ items: patients });
    } catch (err) {
      next(err);
    }
  });

  // GET /nutritionist/plans – list nutrition plans
  router.get('/nutritionist/plans', requireAuth, requireRole('nutritionist'), async (req, res, next) => {
    try {
      const statusFilter = toTrimmedString(req.query.status, 50).toLowerCase();
      const items = await listEntities({ type: 'nutrition_plan', userId: req.user.sub });

      const plans = (items || [])
        .map(p => ({
          id: p.id,
          patientId: p.patientId || null,
          patientName: toTrimmedString(p.patientName, 200),
          title: toTrimmedString(p.title, 200),
          description: toOptionalString(p.description, 5000) || '',
          goals: toOptionalString(p.goals, 2000) || '',
          dietaryRestrictions: toOptionalString(p.dietaryRestrictions, 2000) || '',
          recommendations: toOptionalString(p.recommendations, 5000) || '',
          status: normalizeEnumValue(p.status || 'draft', allowedNutritionPlanStatuses) || 'draft',
          createdAt: p.createdAt || null,
          updatedAt: p.updatedAt || null
        }))
        .filter(p => (statusFilter && statusFilter !== 'all' ? p.status === statusFilter : true))
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
          return bTime - aTime;
        });

      res.json({ items: plans });
    } catch (err) {
      next(err);
    }
  });

  // POST /nutritionist/plans – create a nutrition plan
  router.post('/nutritionist/plans', requireAuth, requireRole('nutritionist'), async (req, res, next) => {
    try {
      const { patientId, title, description, goals, dietaryRestrictions, status, recommendations } = req.body || {};

      const safeTitle = toTrimmedString(title, 200);
      if (!safeTitle) {
        return res.status(400).json({ error: 'title is required' });
      }

      const safeStatus = normalizeEnumValue(status || 'draft', allowedNutritionPlanStatuses) || 'draft';

      // Resolve patient name if patientId is given
      let patientName = '';
      if (patientId) {
        const patient = await getEntity({ id: patientId, type: 'nutrition_patient', userId: req.user.sub });
        patientName = patient?.name || '';
      }

      const item = await createEntity({
        type: 'nutrition_plan',
        userId: req.user.sub,
        data: {
          patientId: patientId || null,
          patientName,
          title: safeTitle,
          description: toOptionalString(description, 5000) || '',
          goals: toOptionalString(goals, 2000) || '',
          dietaryRestrictions: toOptionalString(dietaryRestrictions, 2000) || '',
          recommendations: toOptionalString(recommendations, 5000) || '',
          status: safeStatus
        }
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /nutritionist/plans/:id – update a nutrition plan
  router.patch('/nutritionist/plans/:id', requireAuth, requireRole('nutritionist'), async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'nutrition_plan', userId: req.user.sub });
      if (!existing) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      const updates = {};
      if (req.body?.title !== undefined) {
        const safeTitle = toTrimmedString(req.body.title, 200);
        if (!safeTitle) return res.status(400).json({ error: 'Invalid title' });
        updates.title = safeTitle;
      }
      if (req.body?.description !== undefined) {
        updates.description = toOptionalString(req.body.description, 5000) || '';
      }
      if (req.body?.goals !== undefined) {
        updates.goals = toOptionalString(req.body.goals, 2000) || '';
      }
      if (req.body?.dietaryRestrictions !== undefined) {
        updates.dietaryRestrictions = toOptionalString(req.body.dietaryRestrictions, 2000) || '';
      }
      if (req.body?.recommendations !== undefined) {
        updates.recommendations = toOptionalString(req.body.recommendations, 5000) || '';
      }
      if (req.body?.status !== undefined) {
        const safeStatus = normalizeEnumValue(req.body.status, allowedNutritionPlanStatuses);
        if (!safeStatus) return res.status(400).json({ error: 'Invalid status' });
        updates.status = safeStatus;
      }
      if (req.body?.patientId !== undefined) {
        updates.patientId = req.body.patientId || null;
        if (updates.patientId) {
          const patient = await getEntity({ id: updates.patientId, type: 'nutrition_patient', userId: req.user.sub });
          updates.patientName = patient?.name || '';
        }
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'nutrition_plan',
        userId: req.user.sub,
        data: updates
      });

      if (!item) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /nutritionist/plans/:id – delete a nutrition plan
  router.delete('/nutritionist/plans/:id', requireAuth, requireRole('nutritionist'), async (req, res, next) => {
    try {
      const ok = await deleteEntity({ id: req.params.id, type: 'nutrition_plan', userId: req.user.sub });
      if (!ok) {
        return res.status(404).json({ error: 'Plan not found' });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // HEALTH-ID VERIFICATION STATUS & HOSPITAL VERIFICATION
  // =====================================================

  // GET /health-id/verification-status – check current user's health-ID verification status

  return router;
}
