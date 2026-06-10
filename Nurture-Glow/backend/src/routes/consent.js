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

export function createConsentRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  router.post('/medical/consent/grant', requireAuth, async (req, res, next) => {
    try {
      const { doctorId, accessLevel, durationDays } = req.body || {};
      const safeDoctorId = toTrimmedString(doctorId, 100);
      if (!safeDoctorId || !isValidId(safeDoctorId)) {
        return res.status(400).json({ error: 'Valid doctorId is required' });
      }

      const doctorRows = await query(
        `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
        [safeDoctorId]
      );
      if (!doctorRows.length) {
        return res.status(404).json({ error: 'Doctor user not found' });
      }
      const doctorRole = normalizeRoleValue(doctorRows[0].role);
      if (doctorRole !== 'doctor') {
        return res.status(400).json({ error: 'Recipient must have doctor role' });
      }

      const parsedDays = durationDays ? Number(durationDays) : 30;
      const days = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.round(parsedDays) : 30;
      const level = normalizeEnumValue(accessLevel, new Set(['read', 'write', 'full'])) || 'read';

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const existing = await getBySubtype({
        type: 'medical_consent',
        userId: req.user.sub,
        subtype: safeDoctorId
      });

      if (existing) {
        const payload = {
          ...parseJson(existing.data, {}),
          status: 'active',
          accessLevel: level,
          expiresAt: expiresAt.toISOString(),
          grantedAt: new Date().toISOString()
        };
        const item = await updateEntity({
          id: existing.id,
          type: 'medical_consent',
          userId: req.user.sub,
          data: payload
        });
        return res.json({ item });
      }

      const payload = {
        patientId: req.user.sub,
        doctorId: safeDoctorId,
        accessLevel: level,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        grantedAt: new Date().toISOString()
      };

      const item = await createEntity({
        type: 'medical_consent',
        userId: req.user.sub,
        subtype: safeDoctorId,
        data: payload
      });

      // Clear any pending requests
      const pendingRequests = await listEntities({
        type: 'consent_request',
        userId: safeDoctorId,
        subtype: req.user.sub
      });
      for (const pr of pendingRequests) {
        const prData = parseJson(pr.data, {});
        if (prData.status === 'pending') {
          await updateEntity({
            id: pr.id,
            type: 'consent_request',
            userId: safeDoctorId,
            data: { ...prData, status: 'approved', respondedAt: new Date().toISOString() }
          });
        }
      }

      await createNotification(safeDoctorId, {
        type: 'CONSENT_GRANTED',
        entityId: item.id,
        title: 'Medical access granted',
        message: 'A patient has granted you access to their medical records.',
        link: '/doctor/patients'
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/medical/consent/:id', requireAuth, async (req, res, next) => {
    try {
      const consent = await getEntity({
        id: req.params.id,
        type: 'medical_consent',
        userId: req.user.sub
      });
      if (!consent) {
        return res.status(404).json({ error: 'Consent not found' });
      }

      const payload = {
        ...consent,
        status: 'revoked',
        revokedAt: new Date().toISOString()
      };
      await updateEntity({
        id: req.params.id,
        type: 'medical_consent',
        userId: req.user.sub,
        data: payload
      });

      if (consent.doctorId) {
        await createNotification(consent.doctorId, {
          type: 'CONSENT_REVOKED',
          entityId: req.params.id,
          title: 'Medical access revoked',
          message: 'A patient has revoked your access to their medical records.',
          link: '/doctor/patients'
        });
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/medical/consent', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'medical_consent', userId: req.user.sub });
      const active = allItems.filter(item => {
        const expiresAt = item.expiresAt;
        if (!expiresAt) return item.status === 'active';
        return item.status === 'active' && new Date(expiresAt) > new Date();
      });
      res.json({ items: active });
    } catch (err) {
      next(err);
    }
  });

  router.post('/medical/consent/request', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { patientId, message } = req.body || {};
      const safePatientId = toTrimmedString(patientId, 100);
      if (!safePatientId || !isValidId(safePatientId)) {
        return res.status(400).json({ error: 'Valid patientId is required' });
      }

      const patientRows = await query(
        `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
        [safePatientId]
      );
      if (!patientRows.length) {
        return res.status(404).json({ error: 'Patient user not found' });
      }
      const patientRole = normalizeRoleValue(patientRows[0].role);
      if (patientRole !== 'mother') {
        return res.status(400).json({ error: 'Recipient must have patient role' });
      }

      const existing = await getBySubtype({
        type: 'consent_request',
        userId: req.user.sub,
        subtype: safePatientId
      });

      if (existing) {
        const currentData = parseJson(existing.data, {});
        if (currentData.status === 'pending') {
          return res.status(409).json({ error: 'A request is already pending approval' });
        }
      }

      const payload = {
        doctorId: req.user.sub,
        patientId: safePatientId,
        message: toOptionalString(message, 500) || 'Your doctor is requesting access to your medical records.',
        status: 'pending',
        requestedAt: new Date().toISOString()
      };

      const item = await createEntity({
        type: 'consent_request',
        userId: req.user.sub,
        subtype: safePatientId,
        data: payload
      });

      await createNotification(safePatientId, {
        type: 'CONSENT_REQUEST',
        entityId: item.id,
        title: 'Medical access request',
        message: payload.message,
        link: '/profile?tab=consent'
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/doctor/accessible-patients', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const allConsents = await listEntities({ type: 'medical_consent' });
      const doctorConsents = (allConsents || [])
        .map(row => {
          try {
            return JSON.parse(row.data);
          } catch (e) {
            return null;
          }
        })
        .filter(consent => 
          consent && 
          consent.doctorId === req.user.sub && 
          consent.status === 'active' &&
          new Date(consent.expiresAt) > new Date()
        );
      
      // Fetch patient details
      for (let consent of doctorConsents) {
        try {
          const patientRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [consent.patientId]
          );
          if (patientRows.length > 0) {
            const profile = JSON.parse(patientRows[0].data);
            consent.patientName = profile.name || 'Patient';
          }
          
          // Fetch medical records
          const medicalRows = await query(
            `SELECT data FROM app_entities WHERE type = 'medical_report' AND user_id = ? LIMIT 1`,
            [consent.patientId]
          );
          if (medicalRows.length > 0) {
            consent.medicalReport = JSON.parse(medicalRows[0].data);
          }
          
          // Fetch visit history
          const visitsRows = await query(
            `SELECT data FROM app_entities WHERE type = 'visit_record' AND user_id = ?`,
            [consent.patientId]
          );
          consent.visitHistory = visitsRows.map(row => JSON.parse(row.data));
          
        } catch (e) {
          consent.patientName = 'Patient';
        }
      }
      
      res.json({ items: doctorConsents });
    } catch (err) {
      next(err);
    }
  });

  // Submit health ID verification request (User)
  router.post('/health-id/verify', requireAuth, async (req, res, next) => {
    try {
      const { documents, notes } = req.body;
      
      const verificationData = {
        userId: req.user.sub,
        documents: documents || {},
        notes: notes || '',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      const verification = await createEntity({
        type: 'health_id_verification',
        userId: req.user.sub,
        data: verificationData
      });
      
      // Update user profile status
      const profileRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );
      
      if (profileRows.length > 0) {
        const profile = JSON.parse(profileRows[0].data);
        profile.healthIdStatus = 'pending';
        
        await query(
          `UPDATE app_entities SET data = ? WHERE id = ?`,
          [JSON.stringify(profile), profileRows[0].id]
        );
      }
      
      res.status(201).json({ verification });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// Stub function to get consent entity
async function getEntity({ id, type, userId }) {
  const all = await listEntities({ type, userId });
  return all.find(item => item.id === id);
}
