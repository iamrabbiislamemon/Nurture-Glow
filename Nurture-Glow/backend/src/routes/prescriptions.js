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
import { normalizeRoleValue, getRoleFilterOptions } from '../roles.js';
import { resolveUserRole } from '../helpers/doctorHelpers.js';

export function createPrescriptionsRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  // Create prescription (linked to consultation)
  router.post('/prescriptions', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { consultationId, patientId, medications, instructions, followUpDate, diagnosis } = req.body;
      
      if (!patientId || !medications || medications.length === 0) {
        return res.status(400).json({ error: 'patientId and medications are required' });
      }
      
      const prescriptionData = {
        doctorId: req.user.sub,
        patientId,
        consultationId: consultationId || null,
        medications, // Array of { name, dosage, frequency, duration }
        instructions: instructions || '',
        diagnosis: diagnosis || '',
        followUpDate: followUpDate || null,
        prescribedAt: new Date().toISOString(),
        status: 'active'
      };
      
      const prescription = await createEntity({
        type: 'prescription',
        userId: patientId,
        data: prescriptionData
      });
      
      // Update consultation with prescriptionId if provided
      if (consultationId) {
        const appointmentRows = await query(
          `SELECT id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
          [consultationId]
        );
        if (appointmentRows.length > 0) {
          const appt = parseJson(appointmentRows[0].data, {});
          appt.prescriptionId = prescription.id;
          appt.hasPrescription = true;
          await query(
            `UPDATE app_entities SET data = ? WHERE id = ?`,
            [JSON.stringify(appt), consultationId]
          );
        }
      }
      
      await createNotification(patientId, {
        type: 'PRESCRIPTION_CREATED',
        entityId: prescription.id,
        title: 'New Prescription Created',
        message: 'Your doctor has issued a new prescription.',
        link: '/health'
      });
      
      res.status(201).json({ success: true, prescription });
    } catch (err) {
      next(err);
    }
  });

  // Get patient prescriptions
  router.get('/prescriptions', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'prescription', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // Get doctor issued prescriptions
  router.get('/doctor/prescriptions', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const all = await listEntities({ type: 'prescription' });
      const filtered = all.filter(item => {
        const data = parseJson(item.data, {});
        return data.doctorId === req.user.sub;
      });
      res.json({ items: filtered });
    } catch (err) {
      next(err);
    }
  });

  // Submit doctor verification request
  router.post('/doctor/submit-verification', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { fullName, specialty, bmdcNumber, licenseNumber, documents, experience } = req.body || {};
      const safeName = toTrimmedString(fullName, 120);
      const safeBMDC = toTrimmedString(bmdcNumber, 50);
      if (!safeName || !safeBMDC) {
        return res.status(400).json({ error: 'fullName and bmdcNumber are required' });
      }

      const id = uuidv4();
      const payload = {
        id,
        userId: req.user.sub,
        fullName: safeName,
        specialty: toOptionalString(specialty, 120) || 'General',
        bmdcNumber: safeBMDC,
        licenseNumber: toOptionalString(licenseNumber, 100) || null,
        documents: documents || [],
        experience: Number(experience) || 0,
        status: 'pending',
        submittedAt: new Date().toISOString()
      };

      await createEntity({
        id,
        type: 'doctor_verification',
        userId: req.user.sub,
        data: payload
      });

      // Update user profile status
      const profileRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );
      if (profileRows.length > 0) {
        const profile = parseJson(profileRows[0].data, {});
        profile.verified = 'Pending';
        profile.verificationStatus = 'Pending';
        await query(
          `UPDATE app_entities SET data = ? WHERE id = ?`,
          [JSON.stringify(profile), profileRows[0].id]
        );
      }

      // Sync verified status in doctors table
      await query(
        'UPDATE doctors SET verified = FALSE, updated_at = NOW() WHERE user_id = ?',
        [req.user.sub]
      );

      // Notify medical admins
      const medicalRoleOptions = getRoleFilterOptions('medical_admin');
      const medicalRolePlaceholders = medicalRoleOptions.map(() => '?').join(', ');
      const adminUsers = await query(
        `SELECT id FROM users WHERE role IN (${medicalRolePlaceholders})`,
        medicalRoleOptions
      );
      for (const admin of adminUsers) {
        await createNotification(admin.id, {
          type: 'NEW_DOCTOR_VERIFICATION',
          entityId: id,
          title: 'New Doctor Verification Request',
          message: `${safeName} has submitted a verification request.`,
          link: '/admin/verifications/doctors'
        });
      }

      res.status(201).json({ success: true, verification: payload });
    } catch (err) {
      next(err);
    }
  });

  // Submit pharmacist verification request
  router.post('/pharmacist/submit-verification', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const { pharmacyName, licenseNumber, address, phone, ownerName, documents } = req.body || {};
      const safePharmacyName = toTrimmedString(pharmacyName, 120);
      const safeLicense = toTrimmedString(licenseNumber, 50);

      if (!safePharmacyName || !safeLicense) {
        return res.status(400).json({ error: 'pharmacyName and licenseNumber are required' });
      }

      const id = uuidv4();
      const verification = await createEntity({
        id,
        type: 'pharmacist_verification',
        userId: req.user.sub,
        data: {
          id,
          userId: req.user.sub,
          pharmacyName: safePharmacyName,
          licenseNumber: safeLicense,
          address: address || '',
          phone: phone || '',
          ownerName: ownerName || '',
          documents: documents || [],
          status: 'pending',
          submittedAt: new Date().toISOString()
        }
      });

      // Notify all ops admins
      const opsRoleOptions = getRoleFilterOptions('ops_admin');
      const opsRolePlaceholders = opsRoleOptions.map(() => '?').join(', ');
      const adminUsers = await query(
        `SELECT id FROM users WHERE role IN (${opsRolePlaceholders})`,
        opsRoleOptions
      );
      for (const admin of adminUsers) {
        await createNotification(admin.id, {
          type: 'NEW_PHARMACIST_VERIFICATION',
          entityId: verification.id,
          title: 'New Pharmacy Verification Request',
          message: `${safePharmacyName} has submitted a verification request.`,
          link: '/admin/verifications/pharmacies'
        });
      }

      res.status(201).json({ success: true, verification });
    } catch (err) {
      next(err);
    }
  });

  // Get active announcements for current user's role
  router.get('/announcements', requireAuth, async (req, res, next) => {
    try {
      const userRole = await resolveUserRole(req);
      
      const announcementsRows = await query(
        `SELECT id, data, created_at FROM app_entities 
         WHERE type = 'system_announcement' AND JSON_EXTRACT(data, '$.active') = true 
         ORDER BY created_at DESC LIMIT 20`
      );

      const announcements = announcementsRows.map(row => {
        try {
          const data = JSON.parse(row.data);
          return {
            id: row.id,
            ...data,
            timestamp: row.created_at
          };
        } catch (e) {
          return null;
        }
      }).filter(a => {
        if (!a) return false;
        if (a.targetRole === 'all' || !a.targetRole) return true;
        const normalizedTarget = normalizeRoleValue(a.targetRole) || a.targetRole;
        return normalizedTarget === userRole;
      });

      res.json({ items: announcements });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function uuidv4() {
  return crypto.randomBytes(16).toString('hex');
}
