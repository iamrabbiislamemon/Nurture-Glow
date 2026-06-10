import { v4 as uuidv4 } from 'uuid';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  parseJson
} from '../utils/index.js';
/**
 * Profile routes: update name, avatar, etc.
 * Extracted from the monolithic index.js.
 */
import express from 'express';
import { query } from '../db.js';
import { getUserMeta, setUserMeta } from '../appStore.js';

/**
 * @param {{ requireAuth: Function, avatarUpload: object, buildPublicFileUrl: Function, removeUploadFileByUrl: Function, getUserProfile: Function }} deps
 */
export function createProfileRouter({ requireAuth, avatarUpload, buildPublicFileUrl, removeUploadFileByUrl, getUserProfile, verificationDocUpload }) {
  const router = express.Router();

  router.put('/profile', requireAuth, async (req, res, next) => {
    try {
      const { name, preferred_language } = req.body || {};
      if (!name && !preferred_language) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      await query(
        'UPDATE user_profiles SET full_name = COALESCE(?, full_name), preferred_language = COALESCE(?, preferred_language) WHERE user_id = ?',
        [name || null, preferred_language || null, req.user.sub]
      );

      const user = await getUserProfile(req.user.sub);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.put('/profile/avatar', requireAuth, avatarUpload.single('avatar'), async (req, res, next) => {
    try {
      const existingMeta = await getUserMeta(req.user.sub, ['avatar']);

      let avatarUrl = '';
      if (req.file) {
        avatarUrl = buildPublicFileUrl(req, `avatars/${req.file.filename}`);
      } else if (req.body?.avatar && typeof req.body.avatar === 'string') {
        avatarUrl = req.body.avatar.trim();
      }

      if (!avatarUrl) {
        return res.status(400).json({ error: 'avatar is required' });
      }

      await setUserMeta(req.user.sub, { avatar: avatarUrl });

      const previousAvatar = existingMeta.avatar;
      if (req.file && previousAvatar && previousAvatar !== avatarUrl) {
        try {
          await removeUploadFileByUrl(previousAvatar);
        } catch (cleanupErr) {
          console.warn('Failed to clean old avatar file:', cleanupErr.message || cleanupErr);
        }
      }

      const user = await getUserProfile(req.user.sub);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });



  router.get('/user/:userId/profile', requireAuth, async (req, res, next) => {
    try {
      const userId = req.params.userId;

      // Fetch emergency contact from the emergency_contacts table
      const rows = await query(
        'SELECT contact_name, phone, relationship FROM emergency_contacts WHERE user_id = ? LIMIT 1',
        [userId]
      );

      const emergencyContact = rows.length
        ? { name: rows[0].contact_name, phone: rows[0].phone, relation: rows[0].relationship }
        : null;

      res.json({ emergencyContact });
    } catch (err) {
      next(err);
    }
  });

  router.put('/user/:userId/profile', requireAuth, async (req, res, next) => {
    try {
      const userId = req.params.userId;
      const { emergencyContact } = req.body || {};

      if (emergencyContact) {
        const { name, phone, relation } = emergencyContact;

        // Check if an emergency contact already exists for this user
        const existing = await query(
          'SELECT id FROM emergency_contacts WHERE user_id = ? LIMIT 1',
          [userId]
        );

        if (existing.length) {
          // Update existing
          await query(
            'UPDATE emergency_contacts SET contact_name = ?, phone = ?, relationship = ? WHERE user_id = ?',
            [name || null, phone || null, relation || null, userId]
          );
        } else {
          // Insert new
          const id = uuidv4();
          await query(
            'INSERT INTO emergency_contacts (id, user_id, contact_name, phone, relationship) VALUES (?, ?, ?, ?, ?)',
            [id, userId, name || null, phone || null, relation || null]
          );
        }
      }

      // Return the saved emergency contact
      const rows = await query(
        'SELECT contact_name, phone, relationship FROM emergency_contacts WHERE user_id = ? LIMIT 1',
        [userId]
      );
      const savedContact = rows.length
        ? { name: rows[0].contact_name, phone: rows[0].phone, relation: rows[0].relationship }
        : null;

      res.json({ emergencyContact: savedContact });
    } catch (err) {
      next(err);
    }
  });

  router.get('/user/meta', requireAuth, async (req, res, next) => {
    try {
      const keys = String(req.query.keys || 'hydration,pregnancyWeek,avatar')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      const meta = await getUserMeta(req.user.sub, keys);
      res.json({ meta });
    } catch (err) {
      next(err);
    }
  });

  router.put('/user/meta', requireAuth, async (req, res, next) => {
    try {
      const allowed = ['hydration', 'pregnancyWeek', 'avatar', 'preferred_hospital', 'childDob'];
      const updates = {};
      allowed.forEach((key) => {
        if (req.body?.[key] !== undefined) {
          updates[key] = req.body[key];
        }
      });
      if (!Object.keys(updates).length) {
        return res.status(400).json({ error: 'No valid meta fields provided' });
      }
      await setUserMeta(req.user.sub, updates);
      const meta = await getUserMeta(req.user.sub, Object.keys(updates));
      res.json({ meta });
    } catch (err) {
      next(err);
    }
  });



  const uploadVerificationDoc =
    verificationDocUpload && typeof verificationDocUpload.single === 'function'
      ? verificationDocUpload.single('file')
      : (req, res, next) => next();


  router.get('/profile/docs', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'verification_doc', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.put('/profile/docs', requireAuth, uploadVerificationDoc, async (req, res, next) => {
    try {
      const type = toTrimmedString(req.body?.type, 50).toUpperCase();
      if (!type || !allowedVerificationDocTypes.has(type)) {
        return res.status(400).json({ error: 'Invalid verification document type' });
      }

      let fileName = toTrimmedString(req.body?.fileName, 255);
      let fileUrl = toTrimmedString(req.body?.fileUrl, 5000);

      if (req.file) {
        fileName = toTrimmedString(req.file.originalname, 255) || req.file.filename;
        fileUrl = buildPublicFileUrl(req, `verification-docs/${req.file.filename}`);
      }

      if (!type || !fileUrl) {
        return res.status(400).json({ error: 'type and file are required' });
      }

      const existing = await getBySubtype({
        type: 'verification_doc',
        userId: req.user.sub,
        subtype: type
      });

      const item = await upsertBySubtype({
        type: 'verification_doc',
        userId: req.user.sub,
        subtype: type,
        data: {
          userId: req.user.sub,
          type,
          status: 'PENDING',
          fileName,
          fileUrl,
          uploadedAt: new Date().toISOString()
        }
      });

      if (req.file && existing?.fileUrl && existing.fileUrl !== fileUrl) {
        try {
          await removeUploadFileByUrl(existing.fileUrl);
        } catch (cleanupErr) {
          console.warn('Failed to clean old verification document:', cleanupErr.message || cleanupErr);
        }
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile/medical', requireAuth, async (req, res, next) => {
    try {
      let item = await getBySubtype({
        type: 'medical_report',
        userId: req.user.sub,
        subtype: 'default'
      });
      if (!item) {
        item = await getBySubtype({
          type: 'medical_report',
          userId: req.user.sub,
          subtype: 'main'
        });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.put('/profile/medical', requireAuth, async (req, res, next) => {
    try {
      const { bloodGroup = '', allergies = '', diabetesStatus = false, knownConditions = '' } = req.body || {};
      const normalizedBloodGroup = toTrimmedString(bloodGroup, 5).toUpperCase();
      if (normalizedBloodGroup && !allowedBloodGroups.has(normalizedBloodGroup)) {
        return res.status(400).json({ error: 'Invalid blood group' });
      }
      const payload = {
        bloodGroup: normalizedBloodGroup,
        allergies: toTrimmedString(allergies, 1000),
        diabetesStatus: Boolean(diabetesStatus),
        knownConditions: toTrimmedString(knownConditions, 1000)
      };
      const item = await upsertBySubtype({
        type: 'medical_report',
        userId: req.user.sub,
        subtype: 'default',
        data: payload
      });
      const legacy = await getBySubtype({
        type: 'medical_report',
        userId: req.user.sub,
        subtype: 'main'
      });
      if (legacy && legacy.id && legacy.id !== item.id) {
        await updateEntity({
          id: legacy.id,
          type: 'medical_report',
          userId: req.user.sub,
          subtype: 'main',
          data: payload
        });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile/visits', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'doctor_visit', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/profile/visits', requireAuth, async (req, res, next) => {
    try {
      const { doctorName, clinic, date, reason, notes } = req.body || {};
      const safeDoctorName = toTrimmedString(doctorName, 120);
      const safeClinic = toTrimmedString(clinic, 120);
      const safeDate = toTrimmedString(date, 50);
      const safeReason = toTrimmedString(reason, 500);
      if (!safeDoctorName || !safeClinic || !safeDate || !safeReason) {
        return res.status(400).json({ error: 'doctorName, clinic, date, and reason are required' });
      }
      if (!isValidDateValue(safeDate)) {
        return res.status(400).json({ error: 'Invalid visit date' });
      }
      const item = await createEntity({
        type: 'doctor_visit',
        userId: req.user.sub,
        data: {
          doctorName: safeDoctorName,
          clinic: safeClinic,
          date: safeDate,
          reason: safeReason,
          notes: toOptionalString(notes, 1000) || undefined,
          userId: req.user.sub
        }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/profile/visits/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'doctor_visit',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.post('/profile/reset', requireAuth, async (req, res, next) => {
    try {
      const removed = await deleteEntitiesByTypes(req.user.sub, [
        'health_history',
        'appointment',
        'vaccine',
        'nutrition_log',
        'journal_entry',
        'doctor_visit',
        'verification_doc',
        'medical_report'
      ]);
      await setUserMeta(req.user.sub, { hydration: 4, pregnancyWeek: 24 });
      res.json({ ok: true, removed });
    } catch (err) {
      next(err);
    }
  });


    return router;
}
