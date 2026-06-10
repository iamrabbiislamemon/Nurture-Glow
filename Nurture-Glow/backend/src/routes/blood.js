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

export function createBloodRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  router.get('/blood/donors', async (req, res, next) => {
    try {
      const [primary, legacy] = await Promise.all([
        listEntities({ type: 'blood_donor' }),
        listEntities({ type: 'donor' })
      ]);

      const normalizeDonor = (donor, source) => {
        const name = String(donor?.name || '').trim();
        const phone = String(donor?.phone || '').trim();
        if (!name || !phone) return null;

        return {
          id: donor.id,
          userId: donor.userId || null,
          name,
          bloodGroup: String(donor?.bloodGroup || donor?.bloodType || '').trim(),
          location: String(donor?.location || donor?.area || '').trim(),
          phone,
          verified: donor?.verified ?? false,
          status: donor?.status || 'Active',
          createdAt: donor?.createdAt || null,
          _source: source,
          _phoneKey: normalizePhone(phone)
        };
      };

      const deduped = new Map();
      const addDonor = (donor) => {
        if (!donor) return;
        const key = donor._phoneKey || donor.id;
        const existing = deduped.get(key);
        if (!existing || (existing._source !== 'blood_donor' && donor._source === 'blood_donor')) {
          deduped.set(key, donor);
        }
      };

      primary.map((donor) => normalizeDonor(donor, 'blood_donor')).forEach(addDonor);
      legacy.map((donor) => normalizeDonor(donor, 'donor')).forEach(addDonor);

      const items = Array.from(deduped.values())
        .map(({ _source, _phoneKey, ...rest }) => rest)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/blood/donors', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const { name, bloodGroup, location, phone } = req.body || {};
      
      if (!name || !bloodGroup || !location || !phone) {
        return res.status(400).json({ error: 'Name, blood group, location, and phone are required' });
      }

      const normalizedBloodGroup = String(bloodGroup).trim().toUpperCase();
      if (!allowedBloodGroups.has(normalizedBloodGroup)) {
        return res.status(400).json({ error: 'Invalid blood group' });
      }

      if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      const normalizedPhone = normalizePhone(phone);

      // Check if user already registered as donor (by userId)
      const existingDonors = await listEntities({ type: 'blood_donor', userId });
      if (existingDonors && existingDonors.length > 0) {
        return res.status(409).json({ 
          error: 'You are already registered as a blood donor',
          existingDonor: existingDonors[0]
        });
      }

      // CRITICAL: Check if phone number already registered (prevents same person with multiple accounts)
      const [allDonors, legacyDonors] = await Promise.all([
        listEntities({ type: 'blood_donor' }),
        listEntities({ type: 'donor' })
      ]);
      const phoneExists = [...allDonors, ...legacyDonors].some((donor) => {
        const donorPhone = normalizePhone(donor?.phone || donor?.phoneNormalized);
        return donorPhone && donorPhone === normalizedPhone;
      });

      if (phoneExists) {
        return res.status(409).json({ 
          error: 'This phone number is already registered as a blood donor',
          reason: 'duplicate_phone'
        });
      }

      // Create new donor
      const item = await createEntity({
        type: 'blood_donor',
        userId,
        data: { 
          userId,
          name: String(name).trim(),
          bloodGroup: normalizedBloodGroup, 
          location: String(location).trim(), 
          phone: String(phone).trim(),
          phoneNormalized: normalizedPhone,
          verified: false,
          status: 'Active', 
          createdAt: new Date().toISOString() 
        }
      });
      
      // Create notification for user
      await createNotification(userId, {
        type: 'SYSTEM',
        entityId: item.id,
        title: 'Blood Donor Registration Successful',
        message: `You are now registered as a ${normalizedBloodGroup} blood donor. Thank you for saving lives!`,
        link: '/donors'
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  // Delete all blood donors (for development/testing - reset database)
  router.delete('/blood/donors/reset', requireAuth, requireRole('system_admin'), async (req, res, next) => {
    try {
      // Get all blood donor entities
      const donors = await listEntities({ type: 'blood_donor' });
      
      // Delete each donor
      const deletePromises = donors.map(donor => 
        query('DELETE FROM app_entities WHERE id = ?', [donor.id])
      );
      
      await Promise.all(deletePromises);
      
      res.json({ 
        success: true, 
        message: `Successfully deleted ${donors.length} blood donors`,
        count: donors.length 
      });
    } catch (err) {
      next(err);
    }
  });

  // ==================== BLOOD REQUEST MANAGEMENT ====================
  router.get('/blood/requests', requireAuth, async (req, res, next) => {
    try {
      const scope = String(req.query.scope || 'donor').toLowerCase();
      const items = await listEntities({ type: 'blood_request', userId: req.user.sub });
      const filtered = items.filter((item) => {
        const isDonorMessage = Boolean(item?.donorId || item?.requesterPhone);
        if (scope === 'all') return true;
        if (scope === 'general') return !isDonorMessage;
        return isDonorMessage;
      }).map((item) => ({
        ...item,
        bloodGroup: item.bloodGroup || item.bloodType || '',
        area: item.area || item.location || ''
      }));
      res.json({ items: filtered });
    } catch (err) {
      next(err);
    }
  });

  router.post('/blood/requests', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const hasDonorPayload = Boolean(data.donorId || data.requesterPhone);
      const hasGeneralPayload = Boolean(data.bloodType || data.units || data.urgency);

      if (!hasDonorPayload && !hasGeneralPayload) {
        return res.status(400).json({ error: 'Invalid blood request payload' });
      }

      if (hasDonorPayload) {
        const { donorId, donorName, bloodGroup, area, location, requesterPhone, message } = data;
        if (!donorId || !requesterPhone) {
          return res.status(400).json({ error: 'donorId and requesterPhone are required' });
        }
        if (!isValidPhone(requesterPhone)) {
          return res.status(400).json({ error: 'Invalid requester phone number format' });
        }
        const normalizedGroup = bloodGroup ? String(bloodGroup).trim().toUpperCase() : '';
        const safeGroup = normalizedGroup && allowedBloodGroups.has(normalizedGroup) ? normalizedGroup : '';

        const item = await createEntity({
          type: 'blood_request',
          userId: req.user.sub,
          data: {
            donorId,
            donorName: donorName || '',
            bloodGroup: safeGroup,
            area: area || location || '',
            requesterPhone: String(requesterPhone).trim(),
            message: message || '',
            status: 'sent',
            createdAt: new Date().toISOString()
          }
        });

        return res.status(201).json({ item });
      }

      const { bloodType, units, urgency, hospital, location } = data;
      if (!bloodType || !units || !urgency) {
        return res.status(400).json({ error: 'bloodType, units, and urgency are required' });
      }
      const normalizedBloodType = String(bloodType).trim().toUpperCase();
      if (!allowedBloodGroups.has(normalizedBloodType)) {
        return res.status(400).json({ error: 'Invalid blood type' });
      }

      const parsedUnits = Number(units);
      if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) {
        return res.status(400).json({ error: 'units must be a positive number' });
      }

      const item = await createEntity({
        type: 'blood_request',
        userId: req.user.sub,
        data: {
          bloodType: normalizedBloodType,
          units: parsedUnits,
          urgency,
          hospital: hospital || '',
          location: location || '',
          status: 'Active',
          createdAt: new Date().toISOString()
        }
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/blood/requests/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'blood_request',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  // ==================== CATALOG ENDPOINTS ====================

  return router;
}
