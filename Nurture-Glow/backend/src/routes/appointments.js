import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  query,
  createOrUpdateOAuthToken,
  getOAuthToken,
  saveMeetingData,
  updateMeetingStatus
} from '../db.js';
import {
  getGoogleOAuthUrl,
  exchangeAuthCodeForTokens
} from '../integrations/googleCalendar.js';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getBySubtype
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  isPastDateValue,
  createNotification,
  parseJson
} from '../utils/index.js';
import {
  sendSuccess,
  parsePagination,
  paginationMeta
} from '../utils/response.js';
import {
  canAccessAppointment,
  isOnlineAppointment,
  getAppointmentInfo,
  buildScheduledAt,
  normalizeAppointmentStatus,
  getScheduledAt
} from '../helpers/appointmentHelpers.js';
import {
  getRealDoctorById,
  resolveUserRole,
  allowedAppointmentTypes
} from '../helpers/doctorHelpers.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GOOGLE_PROVIDER = 'google';

const createMeetingSchema = z.object({
  appointment_id: z.string().min(2).optional()
});

const normalizeReviewRating = (value) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return null;
  if (rating < 1 || rating > 5) return null;
  return Math.round(rating);
};

const isReviewableAppointment = (appointment) => {
  if (!appointment) return false;
  const status = String(appointment.status || '').toLowerCase();
  if (status.includes('cancel')) return false;
  if (status.includes('pending') || status.includes('request')) return false;
  if (status.includes('complete')) return true;
  const scheduledAt = getScheduledAt(appointment);
  if (!scheduledAt) return false;
  const date = new Date(scheduledAt);
  if (!Number.isFinite(date.getTime())) return false;
  return date.getTime() < Date.now();
};

const getDoctorReviewSummary = async () => {
  const rows = await query(`SELECT data FROM app_entities WHERE type = 'doctor_review'`);
  const summary = new Map();
  rows.forEach((row) => {
    const data = parseJson(row.data, {});
    const doctorId = data.doctorId;
    const rating = normalizeReviewRating(data.rating);
    if (!doctorId || rating === null) return;
    const existing = summary.get(doctorId) || { total: 0, count: 0 };
    existing.total += rating;
    existing.count += 1;
    summary.set(doctorId, existing);
  });
  return summary;
};

export function createAppointmentsRouter({ requireAuth }) {
  const router = express.Router();

  // Google OAuth: return auth URL for doctors
  router.get('/integrations/google/auth', requireAuth, async (req, res, next) => {
    try {
      const role = await resolveUserRole(req);
      if (role !== 'doctor') {
        return res.status(403).json({ success: false, error: 'Doctor access required' });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ success: false, error: 'JWT secret not configured' });
      }

      const state = jwt.sign({ sub: req.user.sub, purpose: 'google_oauth' }, jwtSecret, {
        expiresIn: '10m'
      });
      const authUrl = getGoogleOAuthUrl(state);
      res.json({ auth_url: authUrl });
    } catch (err) {
      next(err);
    }
  });

  router.get('/integrations/google/status', requireAuth, async (req, res, next) => {
    try {
      const token = await getOAuthToken(req.user.sub, GOOGLE_PROVIDER);
      res.json({ connected: Boolean(token?.access_token) });
    } catch (err) {
      next(err);
    }
  });

  // Google OAuth callback
  router.get('/integrations/google/callback', async (req, res, next) => {
    try {
      const code = toTrimmedString(req.query?.code, 4000);
      const state = toTrimmedString(req.query?.state, 4000);
      if (!code || !state) {
        return res.status(400).json({ success: false, error: 'Missing code or state' });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({ success: false, error: 'JWT secret not configured' });
      }

      let payload;
      try {
        payload = jwt.verify(state, jwtSecret);
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Invalid OAuth state' });
      }

      if (!payload || payload.purpose !== 'google_oauth' || !payload.sub) {
        return res.status(400).json({ success: false, error: 'Invalid OAuth payload' });
      }

      const tokens = await exchangeAuthCodeForTokens(code);
      if (!tokens.accessToken) {
        return res.status(400).json({ success: false, error: 'Failed to obtain access token' });
      }

      await createOrUpdateOAuthToken(
        payload.sub,
        GOOGLE_PROVIDER,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresAt
      );

      res.redirect(`${FRONTEND_URL}/profile?google_connected=true`);
    } catch (err) {
      next(err);
    }
  });

  // Video meeting endpoints
  router.post('/appointments/:id/meeting/create', requireAuth, async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      if (!isValidId(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment id' });
      }

      const parsed = createMeetingSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid request body' });
      }
      if (parsed.data.appointment_id && parsed.data.appointment_id !== appointmentId) {
        return res.status(400).json({ success: false, error: 'Appointment id mismatch' });
      }

      const info = await getAppointmentInfo(appointmentId);
      if (!info) {
        return res.status(404).json({ success: false, error: 'Appointment not found' });
      }

      const appointment = info.appointment || {};
      if (!isOnlineAppointment(appointment)) {
        return res.status(400).json({ success: false, error: 'Appointment is not online' });
      }

      const canAccess = await canAccessAppointment(req, appointment, false);
      if (!canAccess) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }

      const existingMeeting = info.meetingData || null;
      if (existingMeeting && existingMeeting.status !== 'cancelled') {
        return res.json({
          success: true,
          data: { meetingData: existingMeeting, appointment },
          message: 'Video session already exists'
        });
      }

      const roomName = `ng-${appointmentId}`;
      const joinUrl = `${FRONTEND_URL}/appointments/${appointmentId}/video`;
      const meetingData = {
        provider: 'webrtc',
        roomName,
        joinUrl,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      };

      const updatedAppointment = await saveMeetingData(appointmentId, meetingData);
      if (!updatedAppointment) {
        return res.status(500).json({ success: false, error: 'Failed to save meeting' });
      }

      res.json({
        success: true,
        data: { meetingData, appointment: updatedAppointment },
        message: 'Video session created'
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/appointments/:id/meeting', requireAuth, async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      if (!isValidId(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment id' });
      }

      const info = await getAppointmentInfo(appointmentId);
      if (!info) {
        return res.status(404).json({ success: false, error: 'Appointment not found' });
      }

      const appointment = info.appointment || {};
      const canAccess = await canAccessAppointment(req, appointment, false);
      if (!canAccess) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }

      if (!info.meetingData) {
        return res.status(404).json({ success: false, error: 'Meeting not created yet' });
      }

      res.json({
        success: true,
        data: { meetingData: info.meetingData, appointment }
      });
    } catch (err) {
      next(err);
    }
  });

  // Get telemedicine session history for an appointment
  router.get('/appointments/:id/sessions', requireAuth, async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      const sessions = await query(
        `SELECT id, appointment_id, doctor_id, patient_id, started_at, ended_at, duration_seconds, call_type, status, notes, created_at
         FROM telemedicine_sessions WHERE appointment_id = ? ORDER BY created_at DESC`,
        [appointmentId]
      );
      res.json({ success: true, data: sessions });
    } catch (err) {
      next(err);
    }
  });

  router.post('/appointments/:id/meeting/cancel', requireAuth, async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      if (!isValidId(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment id' });
      }

      const info = await getAppointmentInfo(appointmentId);
      if (!info) {
        return res.status(404).json({ success: false, error: 'Appointment not found' });
      }

      const appointment = info.appointment || {};
      const canAccess = await canAccessAppointment(req, appointment, true);
      if (!canAccess) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }

      const meetingData = info.meetingData;
      if (!meetingData) {
        return res.status(404).json({ success: false, error: 'Meeting not created yet' });
      }

      await updateMeetingStatus(appointmentId, 'cancelled', { cancelledAt: new Date().toISOString() });
      res.json({ success: true, message: 'Meeting cancelled' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/appointments/:id/meeting/end', requireAuth, async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      if (!isValidId(appointmentId)) {
        return res.status(400).json({ success: false, error: 'Invalid appointment id' });
      }

      const info = await getAppointmentInfo(appointmentId);
      if (!info) {
        return res.status(404).json({ success: false, error: 'Appointment not found' });
      }

      const appointment = info.appointment || {};
      const canAccess = await canAccessAppointment(req, appointment, false);
      if (!canAccess) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }

      if (!info.meetingData) {
        return res.status(404).json({ success: false, error: 'Meeting not created yet' });
      }

      await updateMeetingStatus(appointmentId, 'ended', { endedAt: new Date().toISOString() });
      res.json({ success: true, message: 'Meeting ended' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/appointments', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'appointment', userId: req.user.sub });
      const normalized = allItems.map((item) => ({
        ...item,
        status: normalizeAppointmentStatus(item.status) || item.status,
        scheduledAt: item.scheduledAt || getScheduledAt(item)
      }));
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 50 });
      const items = normalized.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(normalized.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.post('/appointments', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const doctorId = toTrimmedString(data.doctorId, 100);
      const date = toTrimmedString(data.date, 100);
      const time = toTrimmedString(data.time, 50);

      if (!doctorId || !date || !time) {
        return res.status(400).json({ error: 'doctorId, date, and time are required' });
      }
      if (!isValidId(doctorId)) {
        return res.status(400).json({ error: 'Invalid doctorId format' });
      }

      const doctor = await getRealDoctorById(doctorId);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor not found' });
      }

      const scheduledAt = buildScheduledAt(date, time);
      if (!scheduledAt || !isValidDateValue(scheduledAt)) {
        return res.status(400).json({ error: 'Invalid appointment date or time' });
      }
      if (isPastDateValue(scheduledAt)) {
        return res.status(400).json({ error: 'Appointment date must be in the future' });
      }

      const availableSlots = Array.isArray(doctor.availableSlots)
        ? doctor.availableSlots.map((slot) => toTrimmedString(slot, 50))
        : [];
      if (availableSlots.length) {
        const matchesSlot = availableSlots.some(
          (slot) => slot.toLowerCase() === time.toLowerCase()
        );
        if (!matchesSlot) {
          return res.status(400).json({ error: 'Selected time is not available for this doctor' });
        }
      }

      const appointmentType =
        normalizeEnumValue(data.type, allowedAppointmentTypes) ||
        normalizeEnumValue(doctor.type, allowedAppointmentTypes);
      if (!appointmentType) {
        return res.status(400).json({ error: 'Invalid appointment type' });
      }
      const isOnline = appointmentType === 'Online';
      const normalizedStatus = normalizeAppointmentStatus(data.status);
      const effectiveStatus = isOnline ? 'pending' : normalizedStatus || 'scheduled';

      const payload = {
        ...data,
        userId: req.user.sub,
        patientId: req.user.sub,
        doctorId,
        doctorName: toTrimmedString(data.doctorName, 120) || doctor.name || null,
        specialty: toTrimmedString(data.specialty, 120) || doctor.specialty || null,
        date,
        time,
        status: effectiveStatus,
        scheduledAt,
        type: appointmentType,
        notes: toOptionalString(data.notes, 2000) || undefined,
        meetingUrl: toOptionalString(data.meetingUrl, 500)
      };
      const item = await createEntity({
        type: 'appointment',
        userId: req.user.sub,
        data: payload
      });

      // Notify patient
      await createNotification(req.user.sub, {
        type: 'APPOINTMENT',
        entityId: item.id,
        title: isOnline ? 'Appointment Request Sent' : 'Appointment Scheduled',
        message: isOnline
          ? `Request submitted for ${item.date}. Awaiting doctor approval.`
          : `Confirmed for ${item.date}.`,
        link: '/appointments'
      });

      // Notify doctor about new appointment (look up the doctor's user_id for notifications)
      const docUserRows = await query('SELECT user_id FROM doctors WHERE id = ? LIMIT 1', [doctorId]);
      const doctorUserId = docUserRows.length ? docUserRows[0].user_id : doctorId;
      await createNotification(doctorUserId, {
        type: 'NEW_APPOINTMENT',
        entityId: item.id,
        title: isOnline ? 'New Appointment Request' : 'New Appointment Scheduled',
        message: isOnline
          ? `New appointment request for ${item.date} at ${item.time}.`
          : `New appointment scheduled for ${item.date} at ${item.time}.`,
        link: '/doctor/consultations'
      });

      res.status(201).json({ success: true, data: item, item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/appointments/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'appointment',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const updates = req.body || {};
      if (updates.status !== undefined) {
        const normalized = normalizeAppointmentStatus(updates.status);
        if (!normalized) {
          return res.status(400).json({ error: 'Invalid appointment status' });
        }
        updates.status = normalized;
      }

      if (updates.type !== undefined) {
        const normalizedType = normalizeEnumValue(updates.type, allowedAppointmentTypes);
        if (!normalizedType) {
          return res.status(400).json({ error: 'Invalid appointment type' });
        }
        updates.type = normalizedType;
      }

      if (updates.date !== undefined) {
        updates.date = toTrimmedString(updates.date, 100);
      }
      if (updates.time !== undefined) {
        updates.time = toTrimmedString(updates.time, 50);
      }
      if (updates.notes !== undefined) {
        updates.notes = toOptionalString(updates.notes, 2000) || undefined;
      }

      if ((updates.date || updates.time) && !updates.scheduledAt) {
        const nextDate = updates.date || existing.date;
        const nextTime = updates.time || existing.time;
        const scheduledAt = buildScheduledAt(nextDate, nextTime);
        if (!scheduledAt || !isValidDateValue(scheduledAt)) {
          return res.status(400).json({ error: 'Invalid appointment date or time' });
        }
        const nextStatus =
          updates.status || normalizeAppointmentStatus(existing.status) || existing.status;
        if ((nextStatus === 'scheduled' || nextStatus === 'pending') && isPastDateValue(scheduledAt)) {
          return res.status(400).json({ error: 'Appointment date must be in the future' });
        }
        updates.scheduledAt = scheduledAt;
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'appointment',
        userId: req.user.sub,
        data: updates
      });

      if (updates.status === 'cancelled') {
        await createNotification(req.user.sub, {
          type: 'APPOINTMENT_CANCELED',
          entityId: item.id,
          title: 'Appointment Canceled',
          message: `Your appointment for ${item.date} has been canceled.`,
          link: '/appointments'
        });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/appointments/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'appointment',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.get('/doctor-reviews', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'doctor_review', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/doctor-reviews', requireAuth, async (req, res, next) => {
    try {
      const { doctorId, doctorName, rating, reviewText, appointmentId } = req.body || {};
      const safeDoctorId = toTrimmedString(doctorId, 100);
      const safeAppointmentId = toOptionalString(appointmentId, 100);

      if (!safeDoctorId || rating === undefined || rating === null) {
        return res.status(400).json({ error: 'doctorId and rating are required' });
      }
      if (!isValidId(safeDoctorId)) {
        return res.status(400).json({ error: 'Invalid doctorId format' });
      }

      const doctor = await getRealDoctorById(safeDoctorId);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor not found' });
      }

      const normalizedRating = normalizeReviewRating(rating);
      if (normalizedRating === null) {
        return res.status(400).json({ error: 'rating must be between 1 and 5' });
      }

      let appointment = null;
      if (safeAppointmentId) {
        if (!isValidId(safeAppointmentId)) {
          return res.status(400).json({ error: 'Invalid appointmentId format' });
        }
        const appointmentRows = await query(
          `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
          [safeAppointmentId]
        );
        if (!appointmentRows.length) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        appointment = parseJson(appointmentRows[0].data, {});
        const appointmentUserId = appointmentRows[0].user_id || appointment.userId || appointment.patientId;
        if (appointmentUserId && appointmentUserId !== req.user.sub) {
          return res.status(403).json({ error: 'Not authorized to review this appointment' });
        }
        if (appointment.doctorId && appointment.doctorId !== safeDoctorId) {
          return res.status(400).json({ error: 'Doctor mismatch for appointment' });
        }
        if (!isReviewableAppointment(appointment)) {
          return res.status(400).json({ error: 'Reviews are allowed after appointment completion' });
        }
      }

      const subtype = safeAppointmentId ? `appointment:${safeAppointmentId}` : `doctor:${safeDoctorId}`;
      const existing = await getBySubtype({ type: 'doctor_review', userId: req.user.sub, subtype });
      if (existing) {
        return res.status(409).json({ error: 'Review already submitted' });
      }

      const payload = {
        userId: req.user.sub,
        doctorId: safeDoctorId,
        doctorName:
          toTrimmedString(doctorName, 120) ||
          doctor?.name ||
          appointment?.doctorName ||
          null,
        appointmentId: safeAppointmentId || null,
        rating: normalizedRating,
        reviewText: toOptionalString(reviewText, 2000) || null
      };

      const item = await createEntity({
        type: 'doctor_review',
        userId: req.user.sub,
        subtype,
        data: payload
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
