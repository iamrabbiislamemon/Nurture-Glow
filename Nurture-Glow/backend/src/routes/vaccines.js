import express from 'express';
import { query } from '../db.js';
import {
  listEntities,
  createEntity,
  updateEntity,
  getEntity,
  listCatalog
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  createNotification
} from '../utils/index.js';
import {
  sendSuccess,
  parsePagination,
  paginationMeta
} from '../utils/response.js';
import {
  normalizeVaccineVerificationStatus,
  normalizeDoseNumber,
  canAccessVaccine,
  maybeSendVaccineReminders
} from '../helpers/vaccineHelpers.js';
import {
  resolveUserRole,
  listDoctorUserOptions
} from '../helpers/doctorHelpers.js';
import { normalizeRoleValue } from '../roles.js';

const allowedVaccineStatuses = new Set(['Taken', 'Pending', 'Missed']);

export function createVaccinesRouter({
  requireAuth,
  requireRole,
  vaccineProofUpload,
  buildPublicFileUrl,
  removeUploadFileByUrl
}) {
  const router = express.Router();
  const uploadVaccineProof =
    vaccineProofUpload && typeof vaccineProofUpload.single === 'function'
      ? vaccineProofUpload.single('file')
      : (req, res, next) => next();

  const loadPatientProfiles = async (patientIds = []) => {
    const profileMap = new Map();
    const uniqueIds = Array.from(new Set(patientIds.filter(Boolean)));
    if (!uniqueIds.length) return profileMap;

    const placeholders = uniqueIds.map(() => '?').join(',');

    try {
      const entityRows = await query(
        `SELECT user_id, data FROM app_entities WHERE type = 'user_profile' AND user_id IN (${placeholders})`,
        uniqueIds
      );
      entityRows.forEach((row) => {
        const profileData = JSON.parse(row.data || '{}');
        profileMap.set(row.user_id, { ...profileData });
      });
    } catch (err) {
      // Ignore profile lookup failures; fallback handled downstream.
    }

    try {
      const userProfileRows = await query(
        `SELECT user_id, full_name, date_of_birth FROM user_profiles WHERE user_id IN (${placeholders})`,
        uniqueIds
      );
      userProfileRows.forEach((row) => {
        const existing = profileMap.get(row.user_id) || {};
        profileMap.set(row.user_id, {
          ...existing,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth
        });
      });
    } catch (err) {
      // Ignore if table not available.
    }

    return profileMap;
  };

  router.get('/vaccines/doctors', requireAuth, async (req, res, next) => {
    try {
      const items = await listDoctorUserOptions();
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.get('/vaccines', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'vaccine', userId: req.user.sub });
      await Promise.all(allItems.map((item) => maybeSendVaccineReminders(item)));
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 50 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.post('/vaccines', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const name = toTrimmedString(data.name, 120);
      const dueDate = toTrimmedString(data.dueDate, 100);
      const administeredDate = toTrimmedString(data.administeredDate, 100);
      if (!name || !dueDate) {
        return res.status(400).json({ error: 'name and dueDate are required' });
      }
      if (!isValidDateValue(dueDate)) {
        return res.status(400).json({ error: 'Invalid dueDate' });
      }
      if (administeredDate && !isValidDateValue(administeredDate)) {
        return res.status(400).json({ error: 'Invalid administeredDate' });
      }

      const status = normalizeEnumValue(data.status, allowedVaccineStatuses) || 'Pending';
      const doctorUserId = toTrimmedString(data.doctorUserId, 100) || null;
      if (!doctorUserId) {
        return res.status(400).json({ error: 'doctorUserId is required' });
      }
      const doctorRows = await query(
        `SELECT id FROM users WHERE id = ? AND role = 'doctor' LIMIT 1`,
        [doctorUserId]
      );
      if (!doctorRows.length) {
        return res.status(400).json({ error: 'Invalid doctorUserId' });
      }

      const item = await createEntity({
        type: 'vaccine',
        userId: req.user.sub,
        data: {
          name,
          dueDate,
          administeredDate: administeredDate || null,
          status,
          doseNumber: normalizeDoseNumber(data.doseNumber),
          location: toOptionalString(data.location, 200) || null,
          notes: toOptionalString(data.notes, 2000) || null,
          doctorUserId,
          proofFileName: toOptionalString(data.proofFileName, 255) || null,
          proofUrl: toOptionalString(data.proofUrl, 5000) || null,
          verificationStatus: normalizeVaccineVerificationStatus('pending'),
          verificationReason: null,
          verifiedByDoctorId: null,
          verifiedAt: null,
          createdByRole: 'patient',
          createdById: req.user.sub,
          lastEditedByRole: 'patient',
          lastEditedById: req.user.sub,
          userId: req.user.sub
        }
      });

      if (doctorUserId) {
        await createNotification(doctorUserId, {
          type: 'VACCINE_REVIEW_REQUEST',
          entityId: item.id,
          title: 'New vaccine entry pending approval',
          message: `${item.name || 'A vaccine'} was submitted for review.`,
          link: '/dashboard?tab=vaccines'
        });
      }

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/vaccines/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'vaccine',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }

      const updates = {};
      if (req.body?.status !== undefined) {
        const normalized = normalizeEnumValue(req.body.status, allowedVaccineStatuses);
        if (!normalized) {
          return res.status(400).json({ error: 'Invalid vaccine status' });
        }
        const role = await resolveUserRole(req);
        if (role !== 'doctor') {
          return res.status(403).json({ error: 'Only doctors can update vaccine status' });
        }
        updates.status = normalized;
      }
      if (req.body?.name !== undefined) {
        updates.name = toTrimmedString(req.body.name, 120);
      }
      if (req.body?.dueDate !== undefined) {
        const dueDate = toTrimmedString(req.body.dueDate, 100);
        if (!dueDate || !isValidDateValue(dueDate)) {
          return res.status(400).json({ error: 'Invalid dueDate' });
        }
        updates.dueDate = dueDate;
      }
      if (req.body?.administeredDate !== undefined) {
        const administeredDate = toTrimmedString(req.body.administeredDate, 100);
        if (administeredDate && !isValidDateValue(administeredDate)) {
          return res.status(400).json({ error: 'Invalid administeredDate' });
        }
        updates.administeredDate = administeredDate || null;
      }
      if (req.body?.doseNumber !== undefined) {
        updates.doseNumber = normalizeDoseNumber(req.body.doseNumber);
      }
      if (req.body?.location !== undefined) {
        updates.location = toOptionalString(req.body.location, 200) || null;
      }
      if (req.body?.notes !== undefined) {
        updates.notes = toOptionalString(req.body.notes, 2000) || null;
      }
      if (req.body?.doctorUserId !== undefined) {
        const incomingDoctorId = toTrimmedString(req.body.doctorUserId, 100);
        if (!incomingDoctorId) {
          return res.status(400).json({ error: 'doctorUserId is required' });
        }
        const doctorRows = await query(
          `SELECT id FROM users WHERE id = ? AND role = 'doctor' LIMIT 1`,
          [incomingDoctorId]
        );
        if (!doctorRows.length) {
          return res.status(400).json({ error: 'Invalid doctorUserId' });
        }
        updates.doctorUserId = incomingDoctorId;
      }

      const verifiedStatus = normalizeVaccineVerificationStatus(existing.verificationStatus || 'pending');
      const wasVerified = verifiedStatus === 'approved' || verifiedStatus === 'auto';
      const statusChanged = updates.status && updates.status !== existing.status;
      const sensitiveFields = ['name', 'dueDate', 'administeredDate', 'doseNumber', 'location', 'notes', 'proofUrl'];
      const hasSensitiveChange = sensitiveFields.some((field) => updates[field] !== undefined);
      const doctorChanged = updates.doctorUserId !== undefined && updates.doctorUserId !== existing.doctorUserId;

      const shouldResetVerification =
        wasVerified || verifiedStatus === 'rejected' || statusChanged || hasSensitiveChange;

      if (shouldResetVerification) {
        updates.verificationStatus = 'pending';
        updates.verificationReason = null;
        updates.verifiedByDoctorId = null;
        updates.verifiedAt = null;
        updates.resubmittedAt = new Date().toISOString();
      }

      updates.lastEditedByRole = 'patient';
      updates.lastEditedById = req.user.sub;

      const item = await updateEntity({
        id: req.params.id,
        type: 'vaccine',
        userId: req.user.sub,
        data: updates
      });
      if (!item) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }

      const doctorToNotify =
        updates.doctorUserId !== undefined ? updates.doctorUserId : existing.doctorUserId;
      if (doctorToNotify && (shouldResetVerification || doctorChanged)) {
        await createNotification(doctorToNotify, {
          type: 'VACCINE_REVIEW_REQUEST',
          entityId: item.id,
          title: 'Vaccine entry updated',
          message: `${item.name || 'A vaccine'} was updated and needs review.`,
          link: '/dashboard?tab=vaccines'
        });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post('/vaccines/:id/proof', requireAuth, uploadVaccineProof, async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'vaccine',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }

      let fileName = toTrimmedString(req.body?.fileName, 255);
      let fileUrl = toTrimmedString(req.body?.fileUrl, 5000);
      if (req.file) {
        fileName = toTrimmedString(req.file.originalname, 255) || req.file.filename;
        fileUrl = buildPublicFileUrl(req, `vaccine-proofs/${req.file.filename}`);
      }
      if (!fileUrl) {
        return res.status(400).json({ error: 'file is required' });
      }

      const updates = {
        proofFileName: fileName || null,
        proofUrl: fileUrl,
        verificationStatus: 'pending',
        verificationReason: null,
        verifiedByDoctorId: null,
        verifiedAt: null,
        resubmittedAt: new Date().toISOString(),
        lastEditedByRole: 'patient',
        lastEditedById: req.user.sub
      };

      const item = await updateEntity({
        id: req.params.id,
        type: 'vaccine',
        userId: req.user.sub,
        data: updates
      });

      if (!item) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }

      if (req.file && existing.proofUrl && existing.proofUrl !== fileUrl) {
        try {
          await removeUploadFileByUrl(existing.proofUrl);
        } catch (err) {
          console.warn('Failed to remove old vaccine proof:', err?.message || err);
        }
      }

      if (existing.doctorUserId) {
        await createNotification(existing.doctorUserId, {
          type: 'VACCINE_REVIEW_REQUEST',
          entityId: item.id,
          title: 'Vaccine proof updated',
          message: `${item.name || 'A vaccine'} has new proof to review.`,
          link: '/dashboard?tab=vaccines'
        });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/vaccines/:id/messages', requireAuth, async (req, res, next) => {
    try {
      const vaccine = await getEntity({ id: req.params.id, type: 'vaccine' });
      if (!vaccine) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }
      const allowed = await canAccessVaccine(req, vaccine);
      if (!allowed) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const items = await listEntities({
        type: 'vaccine_message',
        subtype: req.params.id,
        order: 'ASC'
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/vaccines/:id/messages', requireAuth, async (req, res, next) => {
    try {
      const vaccine = await getEntity({ id: req.params.id, type: 'vaccine' });
      if (!vaccine) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }
      const allowed = await canAccessVaccine(req, vaccine);
      if (!allowed) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const message = toTrimmedString(req.body?.message, 2000);
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const role = await resolveUserRole(req);
      const senderRole = role === 'doctor' ? 'doctor' : 'patient';

      const item = await createEntity({
        type: 'vaccine_message',
        userId: req.user.sub,
        subtype: req.params.id,
        data: {
          vaccineId: req.params.id,
          senderId: req.user.sub,
          senderRole,
          message
        }
      });

      const notifyUserId = senderRole === 'doctor' ? vaccine.userId : vaccine.doctorUserId;
      if (notifyUserId) {
        await createNotification(notifyUserId, {
          type: 'VACCINE_MESSAGE',
          entityId: item.id,
          title: 'New vaccine message',
          message: message.length > 120 ? `${message.slice(0, 120)}...` : message,
          link: '/vaccines'
        });
      }

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/doctor/vaccines', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const statusFilter = toTrimmedString(req.query.status, 30).toLowerCase();
      const allItems = await listEntities({ type: 'vaccine' });
      let items = (allItems || []).filter((item) => item.doctorUserId === req.user.sub);

      if (statusFilter) {
        if (statusFilter === 'pending') {
          items = items.filter((item) => normalizeVaccineVerificationStatus(item.verificationStatus) === 'pending');
        } else if (statusFilter === 'approved') {
          items = items.filter((item) => {
            const status = normalizeVaccineVerificationStatus(item.verificationStatus);
            return status === 'approved' || status === 'auto';
          });
        } else if (statusFilter === 'rejected') {
          items = items.filter((item) => normalizeVaccineVerificationStatus(item.verificationStatus) === 'rejected');
        } else if (statusFilter === 'overdue') {
          items = items.filter((item) => {
            const due = new Date(item.dueDate || '');
            if (!Number.isFinite(due.getTime())) return false;
            const status = String(item.status || '').toLowerCase();
            return status !== 'taken' && due.getTime() < Date.now();
          });
        }
      }

      const patientIds = Array.from(new Set(items.map((item) => item.userId).filter(Boolean)));
      const patientProfiles = await loadPatientProfiles(patientIds);

      const enriched = items.map((item) => {
        const profile = patientProfiles.get(item.userId) || {};
        return {
          ...item,
          patientName: profile.full_name || profile.name || 'Patient',
          patientAge: profile.age || null
        };
      });

      res.json({ items: enriched });
    } catch (err) {
      next(err);
    }
  });

  router.post('/doctor/vaccines', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const data = req.body || {};
      const patientId = toTrimmedString(data.patientId, 100);
      if (!patientId || !isValidId(patientId)) {
        return res.status(400).json({ error: 'patientId is required' });
      }
      const patientRows = await query(`SELECT id, role FROM users WHERE id = ? LIMIT 1`, [patientId]);
      if (!patientRows.length) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      const patientRole = normalizeRoleValue(patientRows[0].role);
      if (patientRole !== 'mother') {
        return res.status(400).json({ error: 'patientId must belong to a patient user' });
      }
      const name = toTrimmedString(data.name, 120);
      const dueDate = toTrimmedString(data.dueDate, 100);
      const administeredDate = toTrimmedString(data.administeredDate, 100);
      if (!name || !dueDate) {
        return res.status(400).json({ error: 'name and dueDate are required' });
      }
      if (!isValidDateValue(dueDate)) {
        return res.status(400).json({ error: 'Invalid dueDate' });
      }
      if (administeredDate && !isValidDateValue(administeredDate)) {
        return res.status(400).json({ error: 'Invalid administeredDate' });
      }

      const status = normalizeEnumValue(data.status, allowedVaccineStatuses) || 'Taken';

      const item = await createEntity({
        type: 'vaccine',
        userId: patientId,
        data: {
          name,
          dueDate,
          administeredDate: administeredDate || null,
          status,
          doseNumber: normalizeDoseNumber(data.doseNumber),
          location: toOptionalString(data.location, 200) || null,
          notes: toOptionalString(data.notes, 2000) || null,
          doctorUserId: req.user.sub,
          proofFileName: toOptionalString(data.proofFileName, 255) || null,
          proofUrl: toOptionalString(data.proofUrl, 5000) || null,
          verificationStatus: 'auto',
          verificationReason: null,
          verifiedByDoctorId: req.user.sub,
          verifiedAt: new Date().toISOString(),
          createdByRole: 'doctor',
          createdById: req.user.sub,
          lastEditedByRole: 'doctor',
          lastEditedById: req.user.sub,
          userId: patientId
        }
      });

      await createNotification(patientId, {
        type: 'VACCINE_VERIFIED',
        entityId: item.id,
        title: 'New verified vaccine added',
        message: `${item.name || 'A vaccine'} was added by your doctor.`,
        link: '/vaccines'
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/doctor/vaccines/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const vaccine = await getEntity({ id: req.params.id, type: 'vaccine' });
      if (!vaccine) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }
      if (!vaccine.doctorUserId || vaccine.doctorUserId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const action = toTrimmedString(req.body?.action, 20).toLowerCase();
      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'action must be approve or reject' });
      }

      const updates = {
        verificationStatus: action === 'approve' ? 'approved' : 'rejected',
        verificationReason: action === 'reject' ? toOptionalString(req.body?.reason, 500) || 'Rejected by doctor' : null,
        verifiedByDoctorId: req.user.sub,
        verifiedAt: new Date().toISOString(),
        lastEditedByRole: 'doctor',
        lastEditedById: req.user.sub
      };

      if (action === 'approve' && String(vaccine.status || '').toLowerCase() !== 'taken') {
        updates.status = 'Taken';
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'vaccine',
        data: updates
      });

      if (!item) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }

      await createNotification(vaccine.userId, {
        type: action === 'approve' ? 'VACCINE_APPROVED' : 'VACCINE_REJECTED',
        entityId: item.id,
        title: action === 'approve' ? 'Vaccine approved' : 'Vaccine rejected',
        message:
          action === 'approve'
            ? `${item.name || 'A vaccine'} was approved by your doctor.`
            : `${item.name || 'A vaccine'} was rejected. ${updates.verificationReason || ''}`,
        link: '/vaccines'
      });

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  // SQL: Fetch vaccine catalog from vaccine_catalog table
  router.get('/catalog/vaccines-list', async (req, res, next) => {
    try {
      const rows = await query(
        'SELECT id, vaccine_name, description, recommended_week_start, recommended_week_end, is_required FROM vaccine_catalog WHERE is_active = TRUE ORDER BY recommended_week_start ASC'
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  });

  // SQL: Fetch vaccine suggestions grouped by week range from vaccine_suggestions table
  router.get('/vaccine-suggestions', async (req, res, next) => {
    try {
      const rows = await query(
        'SELECT id, week_start, week_end, vaccine_names, description FROM vaccine_suggestions WHERE is_active = TRUE ORDER BY week_start ASC'
      );
      const suggestions = rows.map(r => ({
        ...r,
        vaccine_names: JSON.parse(r.vaccine_names || '[]')
      }));
      res.json({ items: suggestions });
    } catch (err) {
      next(err);
    }
  });

  // Catalog: Vaccine schedule (live data from app_catalog seeded as vaccine_schedule)
  router.get('/vaccine-schedule', async (req, res, next) => {
    try {
      const items = await listCatalog('vaccine_schedule');
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function normalizeEnumValue(value, allowedSet) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (allowedSet.has(raw)) return raw;
  const match = Array.from(allowedSet).find(
    (allowed) => allowed.toLowerCase() === raw.toLowerCase()
  );
  return match || null;
}
