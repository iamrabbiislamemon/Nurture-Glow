import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import {
  listCatalog,
  listEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  upsertBySubtype,
  getBySubtype,
  getUserMeta,
  setUserMeta,
  deleteEntitiesByTypes,
  seedAppData
} from './appStore.js';
import {
  query,
  createOrUpdateOAuthToken,
  getOAuthToken,
  saveMeetingData,
  getMeetingData,
  updateMeetingStatus
} from './db.js';
import { normalizeRoleValue, getRoleFilterOptions } from './roles.js';
import { v4 as uuidv4 } from 'uuid';
import {
  getGoogleOAuthUrl,
  exchangeAuthCodeForTokens,
  refreshAccessToken,
  createCalendarEvent,
  deleteCalendarEvent
} from './integrations/googleCalendar.js';
import { handleAiChat } from './services/aiService.js';
import {
  parseJson,
  toTrimmedString,
  toOptionalString,
  isPlainObject,
  normalizeEnumValue,
  toNonNegativeNumber,
  toPositiveNumber,
  isValidId,
  isValidDateValue,
  isPastDateValue,
  createNotification
} from './utils/index.js';
import {
  sendSuccess,
  sendCreated,
  sendError,
  parsePagination,
  paginationMeta
} from './utils/response.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const GOOGLE_PROVIDER = 'google';
if (process.env.NODE_ENV !== 'production') {
  console.log('[appRoutes] loaded from', new URL(import.meta.url).pathname);
}

export function createAppRouter({
  requireAuth,
  requireRole,
  requireConsentForPatient,
  verificationDocUpload,
  vaccineProofUpload,
  buildPublicFileUrl,
  removeUploadFileByUrl
}) {
  const router = express.Router();
  const uploadVerificationDoc =
    verificationDocUpload && typeof verificationDocUpload.single === 'function'
      ? verificationDocUpload.single('file')
      : (req, res, next) => next();
  const uploadVaccineProof =
    vaccineProofUpload && typeof vaccineProofUpload.single === 'function'
      ? vaccineProofUpload.single('file')
      : (req, res, next) => next();

  const resolveUserRole = async (req) => {
    if (req.userRole) return req.userRole;
    const tokenRole = normalizeRoleValue(req.user?.role);
    if (tokenRole) return tokenRole;
    if (!req.user?.sub) return 'mother';
    const rows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    return normalizeRoleValue(rows[0]?.role) || 'mother';
  };

  const allowedAppointmentTypes = new Set(['Online', 'Offline', 'Both']);
  const allowedVaccineStatuses = new Set(['Taken', 'Pending', 'Missed']);
  const allowedVaccineVerificationStatuses = new Set(['pending', 'approved', 'rejected', 'auto']);
  const allowedMealTypes = new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
  const allowedVerificationDocTypes = new Set([
    'NID',
    'BIRTH_CERT',
    'MARRIAGE_CERT',
    'MEDICAL_REPORT'
  ]);
  const allowedMerchandiserProductStatuses = new Set(['draft', 'active', 'inactive']);
  const allowedNutritionPlanStatuses = new Set(['draft', 'active', 'completed']);

  const normalizeVaccineVerificationStatus = (value, fallback = 'pending') => {
    if (value === null || value === undefined || value === '') return fallback;
    const raw = String(value).trim().toLowerCase();
    if (raw === 'pending' || raw === 'pending_approval' || raw === 'awaiting_review') return 'pending';
    if (raw === 'approved' || raw === 'verified') return 'approved';
    if (raw === 'rejected' || raw === 'declined') return 'rejected';
    if (raw === 'auto' || raw === 'auto_verified' || raw === 'doctor') return 'auto';
    return allowedVaccineVerificationStatuses.has(raw) ? raw : fallback;
  };

  const normalizeDoseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return Math.round(num);
    const trimmed = toTrimmedString(value, 20);
    return trimmed || null;
  };

  const getCatalogItem = async (type, id) => {
    if (!id) return null;
    const rows = await query(
      `SELECT data FROM app_catalog WHERE id = ? AND type = ? LIMIT 1`,
      [id, type]
    );
    if (!rows.length) return null;
    return parseJson(rows[0].data, {});
  };

  const DEFAULT_DOCTOR_SLOTS = ['09:00 AM', '10:30 AM', '04:00 PM'];

  /**
   * Ensure a `doctors` table entry exists for a user with role='doctor'.
   * Auto-creates the catalog row if missing, pulling name/email/phone from users + user_profiles.
   */
  const ensureDoctorCatalogEntry = async (userId) => {
    if (!userId) return null;
    const existing = await query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
    if (existing.length) return existing[0].id;

    // Pull user info to populate the new doctor row
    const [userRows, profileRows] = await Promise.all([
      query('SELECT email, phone, role FROM users WHERE id = ? LIMIT 1', [userId]),
      query('SELECT full_name FROM user_profiles WHERE user_id = ? LIMIT 1', [userId])
    ]);

    const user = userRows[0];
    if (!user || !['doctor', 'DOCTOR'].includes(user.role)) return null;

    const fullName = profileRows[0]?.full_name || user.email || 'Doctor';
    const doctorId = uuidv4();

    await query(
      `INSERT INTO doctors (id, user_id, full_name, email, phone, fee_amount, verified, availability_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [doctorId, userId, fullName, user.email || null, user.phone || null, 0, false, 'available']
    );

    return doctorId;
  };

  const timeStringToMinutes = (value) => {
    if (!value) return null;
    const parts = String(value).trim().split(':');
    if (parts.length < 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const slotStringToMinutes = (value) => {
    if (!value) return null;
    const raw = String(value).trim().toLowerCase();
    const match12 = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
    if (match12) {
      let hours = Number(match12[1]);
      const minutes = Number(match12[2]);
      const meridiem = match12[3];
      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    const match24 = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const hours = Number(match24[1]);
      const minutes = Number(match24[2]);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      return hours * 60 + minutes;
    }
    return null;
  };

  const minutesToSlotString = (minutes) => {
    if (!Number.isFinite(minutes)) return null;
    const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours24 = Math.floor(normalized / 60);
    const mins = normalized % 60;
    const meridiem = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = ((hours24 + 11) % 12) + 1;
    return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridiem}`;
  };

  const buildSlotsFromAvailability = (rows) => {
    if (!rows || !rows.length) return [];
    const slots = [];
    rows.forEach((row) => {
      const startMinutes = timeStringToMinutes(row.start_time || row.startTime);
      const endMinutes = timeStringToMinutes(row.end_time || row.endTime);
      const durationRaw = row.slot_duration_minutes ?? row.slotDurationMinutes ?? 30;
      const duration = Number(durationRaw);
      const maxSlots = Number(row.max_consultations) || 999;
      if (startMinutes === null || endMinutes === null) return;
      if (!Number.isFinite(duration) || duration <= 0) return;
      if (endMinutes <= startMinutes) return;
      let count = 0;
      for (let t = startMinutes; t + duration <= endMinutes && count < maxSlots; t += duration) {
        const slot = minutesToSlotString(t);
        if (slot) { slots.push(slot); count++; }
      }
    });
    const unique = Array.from(new Set(slots));
    unique.sort((a, b) => {
      const aMinutes = slotStringToMinutes(a) ?? 0;
      const bMinutes = slotStringToMinutes(b) ?? 0;
      return aMinutes - bMinutes;
    });
    return unique;
  };

  const loadDoctorAvailabilitySlots = async (doctorIds = []) => {
    const slotMap = new Map();
    const ids = Array.from(new Set(doctorIds.filter(Boolean)));
    if (!ids.length) return slotMap;

    const placeholders = ids.map(() => '?').join(',');
    const rows = await query(
      `SELECT doctor_id, start_time, end_time, slot_duration_minutes, max_consultations FROM doctor_availability_slots WHERE doctor_id IN (${placeholders})`,
      ids
    );

    const grouped = new Map();
    rows.forEach((row) => {
      if (!grouped.has(row.doctor_id)) grouped.set(row.doctor_id, []);
      grouped.get(row.doctor_id).push(row);
    });

    grouped.forEach((doctorRows, doctorId) => {
      const slots = buildSlotsFromAvailability(doctorRows);
      if (slots.length) {
        slotMap.set(doctorId, slots);
      }
    });

    return slotMap;
  };

  const resolveDoctorType = (value) => {
    const status = String(value || '').toLowerCase();
    if (status.includes('online')) return 'Online';
    if (status.includes('offline') || status.includes('clinic')) return 'Offline';
    return 'Both';
  };

  const mapDoctorRowToCatalog = (row, slotsOverride) => {
    const feeValue = toNonNegativeNumber(row.fee_amount);
    const ratingValue = row.rating === null || row.rating === undefined ? null : Number(row.rating);
    return {
      id: row.id,
      name: row.full_name || 'Doctor',
      specialty: row.specialty_name || row.specialty || 'General',
      hospital: row.hospital_name || '',
      location: row.location || '',
      image: row.image_url || '',
      fee: Number.isFinite(feeValue) ? feeValue : 0,
      availableSlots: slotsOverride && slotsOverride.length ? slotsOverride : DEFAULT_DOCTOR_SLOTS,
      type: resolveDoctorType(row.availability_status),
      rating: Number.isFinite(ratingValue) ? ratingValue : null
    };
  };

  const listRealDoctors = async () => {
    const rows = await query(
      `SELECT d.id, d.user_id, d.full_name, d.fee_amount, d.rating, d.availability_status, s.name AS specialty_name
       FROM doctors d
       LEFT JOIN doctor_specialties s ON d.specialty_id = s.id
       ORDER BY d.full_name ASC`
    );
    const doctorIds = rows.map((row) => row.id);
    const userIds = rows.map((row) => row.user_id).filter(Boolean);
    const slotsMap = await loadDoctorAvailabilitySlots(doctorIds);

    // Load doctor settings for hospital/consultationType info
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
      const catalog = mapDoctorRowToCatalog(row, slotsMap.get(row.id));
      if (settings.hospital) catalog.hospital = settings.hospital;
      if (settings.consultationType) catalog.type = settings.consultationType;
      if (settings.bio) catalog.bio = settings.bio;
      return catalog;
    });
  };

  /** Resolve a doctor catalog row by the doctor's LOGIN user_id */
  const getDoctorByUserId = async (userId) => {
    if (!userId) return null;
    const rows = await query(
      `SELECT d.id, d.user_id, d.full_name, d.fee_amount, d.rating, d.availability_status, s.name AS specialty_name
       FROM doctors d
       LEFT JOIN doctor_specialties s ON d.specialty_id = s.id
       WHERE d.user_id = ?
       LIMIT 1`,
      [userId]
    );
    if (!rows.length) return null;
    const slotsMap = await loadDoctorAvailabilitySlots([rows[0].id]);
    return { ...mapDoctorRowToCatalog(rows[0], slotsMap.get(rows[0].id)), user_id: rows[0].user_id };
  };

  const getRealDoctorById = async (doctorId) => {
    if (!doctorId) return null;
    const rows = await query(
      `SELECT d.id, d.user_id, d.full_name, d.fee_amount, d.rating, d.availability_status, s.name AS specialty_name
       FROM doctors d
       LEFT JOIN doctor_specialties s ON d.specialty_id = s.id
       WHERE d.id = ?
       LIMIT 1`,
      [doctorId]
    );
    if (rows.length) {
      const slotsMap = await loadDoctorAvailabilitySlots([doctorId]);
      return mapDoctorRowToCatalog(rows[0], slotsMap.get(doctorId));
    }

    const legacyDoctor = await getCatalogItem('doctor', doctorId);
    if (!legacyDoctor) return null;
    const legacySlots = Array.isArray(legacyDoctor.availableSlots)
      ? legacyDoctor.availableSlots.map((slot) => String(slot))
      : DEFAULT_DOCTOR_SLOTS;
    const legacyType = normalizeEnumValue(legacyDoctor.type, allowedAppointmentTypes) || 'Both';
    return {
      ...legacyDoctor,
      availableSlots: legacySlots.length ? legacySlots : DEFAULT_DOCTOR_SLOTS,
      type: legacyType
    };
  };

  const dayIndexMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  const normalizeDayOfWeek = (value) => {
    if (typeof value === 'number' && value >= 0 && value <= 6) return value;
    if (typeof value === 'string') {
      const key = value.trim().toLowerCase();
      if (dayIndexMap[key] !== undefined) return dayIndexMap[key];
      const parsed = Number(key);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 6) return parsed;
    }
    return null;
  };

  const normalizeAppointmentStatus = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const status = String(value).trim().toLowerCase();
    if (status === 'completed' || status === 'complete') return 'completed';
    if (status === 'in-progress' || status === 'in progress') return 'in-progress';
    if (status === 'cancelled' || status === 'canceled' || status === 'cancel') return 'cancelled';
    if (status === 'pending' || status === 'request' || status === 'requested') return 'pending';
    if (status === 'upcoming' || status === 'scheduled' || status === 'approved') return 'scheduled';
    return null;
  };

  const normalizeConsultationStatus = (value) => normalizeAppointmentStatus(value);

  const normalizeConsultationType = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const type = String(value).toLowerCase();
    if (type.includes('phone')) return 'phone';
    if (type.includes('video') || type.includes('online')) return 'video';
    if (type.includes('in-person') || type.includes('offline') || type.includes('clinic')) return 'in-person';
    return null;
  };

  const parseTimeTo24h = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const match24 = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match24) {
      const hours = Number(match24[1]);
      const minutes = Number(match24[2]);
      const seconds = match24[3] ? Number(match24[3]) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
    const match12 = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (match12) {
      let hours = Number(match12[1]);
      const minutes = Number(match12[2]);
      const seconds = match12[3] ? Number(match12[3]) : 0;
      const meridiem = match12[4].toLowerCase();
      if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
        if (meridiem === 'pm' && hours !== 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const buildScheduledAt = (dateValue, timeValue) => {
    if (!dateValue) return null;
    const dateString = String(dateValue).trim();
    if (dateString.includes('T')) {
      const parsed = new Date(dateString);
      return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    }
    const time24 = parseTimeTo24h(timeValue);
    if (time24) {
      const parsed = new Date(`${dateString}T${time24}`);
      return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    }
    const parsed = new Date(dateString);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  };

  const getScheduledAt = (appointment) => {
    if (!appointment) return null;
    if (appointment.scheduledAt) {
      const parsed = new Date(appointment.scheduledAt);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    return buildScheduledAt(appointment.date, appointment.time);
  };

  const normalizeReviewRating = (value) => {
    const rating = Number(value);
    if (!Number.isFinite(rating)) return null;
    if (rating < 1 || rating > 5) return null;
    return Math.round(rating);
  };

  const isAdminRole = (role) =>
    role === 'medical_admin' || role === 'ops_admin' || role === 'system_admin';

  const isOnlineAppointment = (appointment) => {
    if (!appointment) return false;
    const rawType =
      appointment.type || appointment.appointmentType || appointment.appointment_type;
    if (!rawType) return false;
    return String(rawType).toLowerCase().includes('online');
  };

  const getAppointmentInfo = async (appointmentId) => {
    const result = await getMeetingData(appointmentId);
    if (!result) return null;
    return {
      appointment: result.appointment,
      meetingData: result.meetingData || null
    };
  };

  const canAccessAppointment = async (req, appointment, allowAdmin = false) => {
    const role = await resolveUserRole(req);
    if (allowAdmin && isAdminRole(role)) return true;
    const patientId = appointment.patientId || appointment.userId;
    if (req.user?.sub === patientId) return true;
    // Check if the logged-in user is the doctor for this appointment
    const doctorCatalogId = appointment.doctorId;
    if (doctorCatalogId) {
      const docRows = await query('SELECT user_id FROM doctors WHERE id = ? LIMIT 1', [doctorCatalogId]);
      if (docRows.length && docRows[0].user_id === req.user?.sub) return true;
    }
    return false;
  };

  const canAccessVaccine = async (req, vaccine) => {
    if (!vaccine || !req.user?.sub) return false;
    if (vaccine.userId && req.user.sub === vaccine.userId) return true;
    const role = await resolveUserRole(req);
    if (role !== 'doctor') return false;
    return vaccine.doctorUserId && vaccine.doctorUserId === req.user.sub;
  };

  const listDoctorUserOptions = async () => {
    const rows = await query(
      `SELECT 
          u.id AS userId,
          d.id AS doctorId,
          COALESCE(p.full_name, d.full_name, u.email, u.phone, 'Doctor') AS fullName,
          s.name AS specialty
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN doctors d ON d.user_id = u.id
       LEFT JOIN doctor_specialties s ON d.specialty_id = s.id
       WHERE u.role = 'doctor'
       ORDER BY fullName ASC`
    );
    return rows.map((row) => ({
      userId: row.userId,
      doctorId: row.doctorId || null,
      name: row.fullName || 'Doctor',
      specialty: row.specialty || null
    }));
  };

  const maybeSendVaccineReminders = async (vaccine) => {
    if (!vaccine || !vaccine.dueDate || !vaccine.userId) return;
    const status = String(vaccine.status || '').toLowerCase();
    if (status === 'taken') return;

    const dueDate = new Date(vaccine.dueDate);
    if (!Number.isFinite(dueDate.getTime())) return;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(dueDate);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    const reminders = { ...(vaccine.reminders || {}) };
    let updated = false;

    if (diffDays === 0 && !reminders.due) {
      await createNotification(vaccine.userId, {
        type: 'VACCINE_DUE_TODAY',
        entityId: vaccine.id,
        title: 'Vaccine due today',
        message: `${vaccine.name || 'A vaccine'} is due today.`,
        link: '/vaccines'
      });
      reminders.due = now.toISOString();
      updated = true;
    } else if (diffDays < 0 && !reminders.overdue) {
      await createNotification(vaccine.userId, {
        type: 'VACCINE_OVERDUE',
        entityId: vaccine.id,
        title: 'Vaccine overdue',
        message: `${vaccine.name || 'A vaccine'} is overdue. Please update your record.`,
        link: '/vaccines'
      });
      reminders.overdue = now.toISOString();
      updated = true;
    } else if (diffDays > 0 && diffDays <= 7 && !reminders.preDue) {
      await createNotification(vaccine.userId, {
        type: 'VACCINE_DUE_SOON',
        entityId: vaccine.id,
        title: 'Vaccine due soon',
        message: `${vaccine.name || 'A vaccine'} is due in ${diffDays} day${diffDays === 1 ? '' : 's'}.`,
        link: '/vaccines'
      });
      reminders.preDue = now.toISOString();
      updated = true;
    }

    if (updated) {
      await updateEntity({
        id: vaccine.id,
        type: 'vaccine',
        userId: vaccine.userId,
        data: { reminders }
      });
    }
  };

  const createMeetingSchema = z.object({
    appointment_id: z.string().min(2).optional()
  });

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

  const normalizePhone = (value) => String(value || '').replace(/[\s\-()]/g, '');
  const isValidPhone = (value) => /^[\d\s+()-]+$/.test(String(value || ''));
  const allowedBloodGroups = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

  const calculateAge = (dob) => {
    if (!dob) return null;
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

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
        const profileData = parseJson(row.data, {});
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

  const buildConsultationFromAppointment = (appointment, patientProfiles, defaultFee) => {
    const patientId = appointment.patientId || appointment.userId || null;
    const patientProfile = patientProfiles.get(patientId) || {};

    const patientName =
      appointment.patientName ??
      patientProfile.full_name ??
      patientProfile.name ??
      patientProfile.username ??
      null;
    const resolveNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const patientAge =
      resolveNumber(appointment.patientAge) ?? calculateAge(patientProfile.date_of_birth) ?? null;
    const gestationalWeek =
      resolveNumber(appointment.gestationalWeek) ?? resolveNumber(patientProfile.gestationalWeek) ?? null;

    const scheduledAt =
      getScheduledAt(appointment) ||
      appointment.createdAt ||
      null;

    const feeValue =
      appointment.fee === null || appointment.fee === undefined || appointment.fee === ''
        ? null
        : Number(appointment.fee);
    const defaultFeeValue =
      defaultFee === null || defaultFee === undefined || defaultFee === '' ? null : Number(defaultFee);
    const fee =
      Number.isFinite(feeValue) ? feeValue : Number.isFinite(defaultFeeValue) ? defaultFeeValue : null;

    const durationValue =
      appointment.duration === null || appointment.duration === undefined || appointment.duration === ''
        ? null
        : Number(appointment.duration);
    const duration = Number.isFinite(durationValue) ? durationValue : null;

    return {
      id: appointment.id || appointment.consultationId || uuidv4(),
      patientId,
      patientName,
      patientAge,
      gestationalWeek,
      scheduledAt,
      status: normalizeConsultationStatus(appointment.status) || 'scheduled',
      type: normalizeConsultationType(appointment.type),
      duration,
      notes: appointment.notes ?? null,
      prescriptionId: appointment.prescriptionId || null,
      fee,
      consentGranted: appointment.consentGranted ?? null
    };
  };

  const normalizeScheduleItems = (items = []) =>
    items
      .map((item, index) => {
        const dayValue = normalizeDayOfWeek(item.dayOfWeek ?? item.day ?? index);
        if (dayValue === null) return null;
        return {
          id: item.id || `day-${dayValue}`,
          doctorId: item.doctorId || '',
          dayOfWeek: dayValue,
          startTime: item.startTime || item.start || '09:00',
          endTime: item.endTime || item.end || '17:00',
          isAvailable: item.isAvailable ?? item.available ?? false,
          maxConsultations: item.maxConsultations || item.max || 10
        };
      })
      .filter(Boolean);

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

  // ─── User Profile with Emergency Contact ─────────────────────────
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
      const allowed = ['hydration', 'pregnancyWeek', 'avatar'];
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
      const isOnlineAppointment = appointmentType === 'Online';
      const normalizedStatus = normalizeAppointmentStatus(data.status);
      const effectiveStatus = isOnlineAppointment ? 'pending' : normalizedStatus || 'scheduled';

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
        title: isOnlineAppointment ? 'Appointment Request Sent' : 'Appointment Scheduled',
        message: isOnlineAppointment
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
        title: isOnlineAppointment ? 'New Appointment Request' : 'New Appointment Scheduled',
        message: isOnlineAppointment
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

  router.get('/community/posts', async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'community_post' });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 20 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts', requireAuth, async (req, res, next) => {
    try {
      const { content, image, authorName } = req.body || {};
      const safeContent = toTrimmedString(content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: 'content is required' });
      }
      const profileMap = await loadPatientProfiles([req.user.sub]);
      const profile = profileMap.get(req.user.sub) || {};
      const resolvedAuthorName =
        toTrimmedString(authorName, 80) ||
        profile.full_name ||
        profile.name ||
        profile.username ||
        'Anonymous';
      const item = await createEntity({
        type: 'community_post',
        userId: req.user.sub,
        data: {
          userId: req.user.sub,
          authorName: resolvedAuthorName,
          content: safeContent,
          image: toOptionalString(image, 500) || undefined,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString()
        }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/community/posts/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (existing.userId && existing.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to delete this post' });
      }
      const ok = await deleteEntity({ id: req.params.id, type: 'community_post' });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts/:id/like', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const likes = Array.isArray(existing.likes) ? existing.likes : [];
      const hasLiked = likes.includes(req.user.sub);
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { likes: hasLiked ? likes.filter((id) => id !== req.user.sub) : [...likes, req.user.sub] }
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts/:id/comments', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const { content, authorName } = req.body || {};
      const safeContent = toTrimmedString(content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: 'content is required' });
      }
      const profileMap = await loadPatientProfiles([req.user.sub]);
      const profile = profileMap.get(req.user.sub) || {};
      const resolvedAuthorName =
        toTrimmedString(authorName, 80) ||
        profile.full_name ||
        profile.name ||
        profile.username ||
        'Anonymous';
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const newComment = {
        id: uuidv4(),
        userId: req.user.sub,
        authorName: resolvedAuthorName,
        content: safeContent,
        createdAt: new Date().toISOString(),
        replies: []
      };
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { comments: [...comments, newComment] }
      });
      res.status(201).json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/community/posts/:id/comments/:commentId', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const comment = comments.find((c) => c.id === req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      if (comment.userId && comment.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { comments: comments.filter((c) => c.id !== req.params.commentId) }
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.get('/journal', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'journal_entry', userId: req.user.sub });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 20 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.post('/journal', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      if (process.env.NODE_ENV !== 'production' && Array.isArray(data.attachments)) {
        const firstUrlLen = String(data.attachments[0]?.url || '').length;
        console.log('[journal] incoming attachments', data.attachments.length, 'first url len', firstUrlLen);
      }
      const content = toTrimmedString(data.content, 4000);
      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }
      const dateValue = toTrimmedString(data.date, 50) || new Date().toISOString();
      if (!isValidDateValue(dateValue)) {
        return res.status(400).json({ error: 'Invalid journal date' });
      }
      const maxAttachmentUrlLen = 3200000;
      let attachments = undefined;
      if (data.attachments !== undefined) {
        if (!Array.isArray(data.attachments)) {
          return res.status(400).json({ error: 'attachments must be an array' });
        }
        attachments = data.attachments
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            name: toTrimmedString(item.name, 200),
            url: toTrimmedString(item.url, maxAttachmentUrlLen),
            type: toTrimmedString(item.type, 120)
          }))
          .filter((item) => item.name && item.url);
      }
      const payload = {
        ...data,
        title: toTrimmedString(data.title, 120) || undefined,
        mood: toTrimmedString(data.mood, 40) || undefined,
        content,
        userId: req.user.sub,
        date: dateValue,
        attachments
      };
      const item = await createEntity({
        type: 'journal_entry',
        userId: req.user.sub,
        data: payload
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/journal/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }

      const data = req.body || {};
      const updates = {};

      if (data.title !== undefined) {
        updates.title = toOptionalString(data.title, 120);
      }

      if (data.content !== undefined) {
        const content = toTrimmedString(data.content, 4000);
        if (!content) {
          return res.status(400).json({ error: 'content is required' });
        }
        updates.content = content;
      }

      if (data.mood !== undefined) {
        updates.mood = toOptionalString(data.mood, 40);
      }

      if (data.attachments !== undefined) {
        if (!Array.isArray(data.attachments)) {
          return res.status(400).json({ error: 'attachments must be an array' });
        }
        const maxAttachmentUrlLen = 3200000;
        const sanitizedAttachments = data.attachments
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            name: toTrimmedString(item.name, 200),
            url: toTrimmedString(item.url, maxAttachmentUrlLen),
            type: toTrimmedString(item.type, 120)
          }))
          .filter((item) => item.name && item.url);
        updates.attachments = sanitizedAttachments;
      }

      if (!Object.keys(updates).length) {
        return res.json({ item: existing });
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub,
        data: updates
      });
      if (!item) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/journal/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.get('/notifications', requireAuth, async (req, res, next) => {
    try {
      const allItems = await listEntities({ type: 'notification', userId: req.user.sub });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 50 });
      const items = allItems.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allItems.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });

  router.patch('/notifications/:id', requireAuth, async (req, res, next) => {
    try {
      const item = await updateEntity({
        id: req.params.id,
        type: 'notification',
        userId: req.user.sub,
        data: { isRead: true }
      });
      if (!item) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post('/notifications/mark-all', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'notification', userId: req.user.sub });
      for (const item of items) {
        if (!item.isRead) {
          await updateEntity({
            id: item.id,
            type: 'notification',
            userId: req.user.sub,
            data: { isRead: true }
          });
        }
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

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

  router.post('/seed', async (req, res, next) => {
    try {
      await seedAppData();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ==================== BLOOD DONOR MANAGEMENT ====================
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
  router.post('/orders', requireAuth, async (req, res, next) => {
    try {
      const { items, deliveryAddress, deliveryFee, notes } = req.body;
      const rawItems = Array.isArray(items) ? items : [];
      const normalizedItems = rawItems
        .map((item) => {
          if (!isPlainObject(item)) return null;
          const id = toTrimmedString(item.id, 100);
          const name = toTrimmedString(item.name, 200);
          const price = toNonNegativeNumber(item.price);
          const quantity = toPositiveNumber(item.quantity);
          if (!id || !name || price === null || quantity === null) {
            return null;
          }
          return {
            id,
            name,
            price,
            quantity,
            image: toOptionalString(item.image, 500) || undefined,
            category: toOptionalString(item.category, 100) || undefined
          };
        })
        .filter(Boolean);

      if (!normalizedItems.length) {
        return res.status(400).json({ error: 'Order must contain at least one valid item' });
      }

      const addressPayload = isPlainObject(deliveryAddress)
        ? deliveryAddress
        : toTrimmedString(deliveryAddress, 500);

      if (!addressPayload || (isPlainObject(addressPayload) && !Object.keys(addressPayload).length)) {
        return res.status(400).json({ error: 'Delivery address is required' });
      }

      const computedSubtotal = normalizedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const safeDeliveryFee = toNonNegativeNumber(deliveryFee) ?? 0;
      const computedTotal = computedSubtotal + safeDeliveryFee;

      const orderData = {
        userId: req.user.sub,
        items: normalizedItems,
        deliveryAddress: addressPayload,
        deliveryFee: safeDeliveryFee,
        subtotal: computedSubtotal,
        total: computedTotal,
        notes: toOptionalString(notes, 1000) || '',
        status: 'pending',
        orderDate: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      };
      
      const order = await createEntity({
        type: 'order',
        userId: req.user.sub,
        data: orderData
      });
      
      // Notify user about order confirmation
      await createNotification(req.user.sub, {
        type: 'ORDER_PLACED',
        entityId: order.id,
        title: 'Order Confirmed',
        message: `Your order #${order.id.slice(0, 8)} has been placed successfully.`,
        link: '/orders'
      });
      
      // Notify pharmacy owners about new order
      // (In a real system, you'd identify which pharmacy should fulfill this)
      // For now, we'll create a notification that pharmacy role users can see
      
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  });
  
  // Get user's orders
  router.get('/orders', requireAuth, async (req, res, next) => {
    try {
      const allOrders = await listEntities({ type: 'order', userId: req.user.sub });
      const { page, pageSize, offset } = parsePagination(req, { defaultPageSize: 20 });
      const items = allOrders.slice(offset, offset + pageSize);
      sendSuccess(res, items, 200, paginationMeta(allOrders.length, page, pageSize));
    } catch (err) {
      next(err);
    }
  });
  
  // Get specific order details
  router.get('/orders/:id', requireAuth, async (req, res, next) => {
    try {
      const order = await getEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });
  
  // Cancel order (only if pending)
  router.patch('/orders/:id/cancel', requireAuth, async (req, res, next) => {
    try {
      const order = await getEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending orders can be cancelled' });
      }
      
      const updatedOrder = await updateEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub,
        data: { status: 'cancelled' }
      });
      
      await createNotification(req.user.sub, {
        type: 'ORDER_CANCELLED',
        entityId: updatedOrder.id,
        title: 'Order Cancelled',
        message: `Order #${updatedOrder.id.slice(0, 8)} has been cancelled.`,
        link: '/orders'
      });
      
      res.json({ order: updatedOrder });
    } catch (err) {
      next(err);
    }
  });

  // AI Assistant Endpoint - Orchestrated Multi-Model Routing
  router.post('/ai/chat', requireAuth, async (req, res, next) => {
    try {
      const { message, locale = 'en', includeContext = false } = req.body || {};
      const result = await handleAiChat({
        message,
        locale,
        userId: req.user.sub,
        includeContext
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Voice Transcription Endpoint - OpenAI Whisper
  router.post('/ai/transcribe', requireAuth, async (req, res, next) => {
    try {
      const { audio, mimeType = 'audio/webm' } = req.body || {};
      if (!audio) {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Transcription service not configured' });
      }

      // Convert base64 audio to Buffer
      const audioBuffer = Buffer.from(audio, 'base64');
      if (audioBuffer.length < 100) {
        return res.status(400).json({ error: 'Audio data too small. Please record for longer.' });
      }

      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `recording.${ext}`;

      // Use Node.js File API (available in Node 20+) for proper multipart upload
      const file = new File([audioBuffer], fileName, { type: mimeType });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let whisperResponse;
      try {
        whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!whisperResponse.ok) {
        const errText = await whisperResponse.text().catch(() => '');
        console.error(`Whisper API error (${whisperResponse.status}):`, errText);
        // Map common OpenAI errors to user-friendly messages
        if (whisperResponse.status === 401) {
          return res.status(502).json({ error: 'AI service authentication failed. Please contact support.' });
        }
        if (whisperResponse.status === 429) {
          const isQuota = errText.includes('insufficient_quota');
          return res.status(502).json({
            error: isQuota
              ? 'OpenAI quota exhausted. Voice transcription is temporarily unavailable. Please type your question instead.'
              : 'AI service rate limited. Please wait a moment and try again.',
            code: isQuota ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED'
          });
        }
        return res.status(502).json({ error: 'Transcription failed. Please try again.' });
      }

      const data = await whisperResponse.json();
      const text = String(data?.text || '').trim();

      if (!text) {
        return res.json({ text: '', message: 'No speech detected. Please speak clearly and try again.' });
      }

      res.json({ text });
    } catch (error) {
      console.error('Transcription error:', error);
      next(error);
    }
  });

  // Health Insights Endpoint - SQL Query from health_insights table
  router.post('/ai/insights', requireAuth, async (req, res, next) => {
    try {
      const { pregnancyWeek, vaccinesDue, hydrationLevel, locale = 'en' } = req.body;

      // SQL: Fetch wellness tips from health_insights table filtered by locale
      const insightRows = await query(
        'SELECT tip_text FROM health_insights WHERE locale = ? AND is_active = TRUE ORDER BY RAND() LIMIT 3',
        [locale === 'bn' ? 'bn' : 'en']
      );
      const tips = insightRows.map(row => row.tip_text);
      if (tips.length === 0) {
        tips.push('Stay hydrated.', 'Keep tracking your health.', 'Consult your doctor regularly.');
      }

      res.json({ insights: tips });
    } catch (error) {
      console.error('Health Insights Error:', error);
      res.status(500).json({ 
        insights: [
          'Stay hydrated.',
          'Keep tracking your health.',
          'Consult your doctor regularly.'
        ] 
      });
    }
  });

  // Myth Checker Endpoint - SQL Query from pregnancy_myths table
  router.post('/ai/check-myth', requireAuth, async (req, res, next) => {
    try {
      const { statement, locale = 'en' } = req.body;

      if (!statement) {
        return res.status(400).json({ error: 'Statement is required' });
      }

      // SQL: Fetch all myths from pregnancy_myths table filtered by locale
      const mythRows = await query(
        'SELECT myth_keyword, claim, verdict, explanation, safe_advice, when_to_call_doctor, sources_label FROM pregnancy_myths WHERE locale = ? AND is_active = TRUE',
        [locale === 'bn' ? 'bn' : 'en']
      );

      const statementLower = statement.toLowerCase();

      // Search for matching myth using keyword from database
      for (let m of mythRows) {
        if (statementLower.includes(m.myth_keyword.toLowerCase())) {
          return res.json({
            status: m.verdict || 'Myth',
            explanation: m.explanation,
            claim: m.claim,
            safeAdvice: m.safe_advice,
            whenToCallDoctor: m.when_to_call_doctor,
            sourcesLabel: m.sources_label
          });
        }
      }

      // Default response for unknown statements
      res.json({
        status: 'Unknown',
        explanation: locale === 'bn'
          ? 'à¦à¦‡ à¦¬à¦¿à¦·à¦¯à¦¼à§‡ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦¨à¦‡à¥¤ à¦†à¦ªà¦¨à¦¾à¦° à¦¡à¦¾à¦•à§à¦¤à¦¾à¦°à§‡à¦° à¦¸à¦¾à¦¥à§‡ à¦ªà¦°à¦¾à¦®à¦°à§à¦¶ à¦•à¦°à§à¦¨à¥¤'
          : 'I\'m not certain about this. Please consult your healthcare provider.'
      });
    } catch (error) {
      console.error('Myth Check Error:', error);
      res.status(500).json({ 
        status: 'Unknown',
        explanation: 'Unable to verify. Please consult your doctor.' 
      });
    }
  });

  // =====================================================
  // DBMS SQL ENDPOINTS - Replacing Frontend Hardcoded Data
  // =====================================================

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
      // Parse vaccine_names JSON string into array
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
  router.get('/doctor/dashboard', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      if (!userId) {
        console.error('Doctor dashboard: missing authenticated user (req.user undefined)');
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Auto-create doctor catalog entry if it doesn't exist yet
      const doctorCatalogId = await ensureDoctorCatalogEntry(userId) || userId;

      const [profileRows, userRows, userProfileRows, doctorRows] = await Promise.all([
        query(`SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`, [userId]),
        query(`SELECT phone, email FROM users WHERE id = ? LIMIT 1`, [userId]),
        query(`SELECT full_name, date_of_birth FROM user_profiles WHERE user_id = ? LIMIT 1`, [userId]),
        query(
          `SELECT full_name, specialty_id, phone, email, fee_amount, verified, rating FROM doctors WHERE user_id = ? LIMIT 1`,
          [userId]
        )
      ]);

      const profileData = profileRows.length > 0 ? parseJson(profileRows[0].data, {}) : {};
      const userRow = userRows.length > 0 ? userRows[0] : {};
      const userProfile = userProfileRows.length > 0 ? userProfileRows[0] : {};
      const doctorRow = doctorRows.length > 0 ? doctorRows[0] : {};

      let specialtyName = null;
      if (doctorRow.specialty_id) {
        const specialtyRows = await query(
          `SELECT name FROM doctor_specialties WHERE id = ? LIMIT 1`,
          [doctorRow.specialty_id]
        );
        specialtyName = specialtyRows.length > 0 ? specialtyRows[0].name : null;
      }

      const toNumber = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const verifiedValue = doctorRow.verified ?? profileData.verified;
      const verified =
        typeof verifiedValue === 'boolean'
          ? verifiedValue
          : typeof verifiedValue === 'number'
          ? Boolean(verifiedValue)
          : profileData.verificationStatus
          ? profileData.verificationStatus === 'Verified'
          : null;

      const profile = {
        id: userId,
        catalogId: doctorCatalogId,
        name:
          doctorRow.full_name ||
          userProfile.full_name ||
          profileData.name ||
          profileData.username ||
          req.user?.name ||
          userRow.email ||
          req.user?.email ||
          null,
        bmdcNumber: profileData.bmdcNumber || profileData.bmdc || profileData.registrationNumber || null,
        specialization: specialtyName || profileData.specialty || profileData.specialization || null,
        verified,
        profileImage: profileData.avatar || profileData.profileImage || null,
        contactNumber: doctorRow.phone || profileData.phone || userRow.phone || null,
        email: doctorRow.email || profileData.email || userRow.email || req.user?.email || null,
        experience: toNumber(profileData.experience),
        consultationFee: toNumber(
          doctorRow.fee_amount ?? profileData.consultationFee ?? profileData.fee ?? profileData.consultation_fee
        ),
        rating: toNumber(doctorRow.rating ?? profileData.rating),
        totalConsultations: 0
      };

      const appointmentRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment' ORDER BY created_at DESC`
      );

      const appointments = appointmentRows
        .map((row) => ({
          ...parseJson(row.data, {}),
          id: row.id,
          createdAt: row.created_at,
          userId: row.user_id || parseJson(row.data, {}).userId
        }))
        .filter((appt) => appt && appt.doctorId === doctorCatalogId);

      const patientIds = appointments
        .map((appt) => appt.patientId || appt.userId)
        .filter(Boolean);
      const patientProfiles = await loadPatientProfiles(patientIds);

      const consultationFee = profile.consultationFee;

      const consultations = appointments.map((appt) =>
        buildConsultationFromAppointment(appt, patientProfiles, consultationFee)
      );

      profile.totalConsultations = consultations.length;

      const todayKey = new Date().toISOString().split('T')[0];
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const todayConsultations = consultations.filter(
        (c) => typeof c.scheduledAt === 'string' && c.scheduledAt.startsWith(todayKey)
      );
      const upcomingConsultations = consultations.filter((c) => {
        if (!c.scheduledAt) return false;
        const scheduled = new Date(c.scheduledAt);
        return Number.isFinite(scheduled.getTime()) && scheduled > endOfToday;
      });

      // Missed: past appointments that were never completed or cancelled
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const missedConsultations = consultations.filter((c) => {
        if (!c.scheduledAt) return false;
        const scheduled = new Date(c.scheduledAt);
        if (!Number.isFinite(scheduled.getTime())) return false;
        // Must be before today and status is still pending/scheduled/in-progress
        const isPast = scheduled < startOfToday;
        const wasNotResolved = ['pending', 'scheduled', 'in-progress'].includes((c.status || '').toLowerCase());
        return isPast && wasNotResolved;
      });

      const toTimestamp = (value) => {
        if (!value) return null;
        const date = new Date(value);
        const time = date.getTime();
        return Number.isFinite(time) ? time : null;
      };

      const normalizeRiskLevel = (value) => {
        if (!value) return null;
        const level = String(value).toLowerCase();
        if (level === 'low' || level === 'moderate' || level === 'high') return level;
        return null;
      };

      const recentPatients = [];
      const seenPatients = new Set();
      consultations
        .slice()
        .sort((a, b) => {
          const aTime = toTimestamp(a.scheduledAt) ?? 0;
          const bTime = toTimestamp(b.scheduledAt) ?? 0;
          return bTime - aTime;
        })
        .forEach((consultation) => {
          if (!consultation.patientId || seenPatients.has(consultation.patientId)) return;
          const profileInfo = patientProfiles.get(consultation.patientId) || {};
          let consentStatus = null;
          if (consultation.consentGranted === true) consentStatus = 'active';
          if (consultation.consentGranted === false) consentStatus = 'pending';
          recentPatients.push({
            id: consultation.patientId,
            name: consultation.patientName ?? profileInfo.full_name ?? null,
            age: consultation.patientAge ?? null,
            gestationalWeek: consultation.gestationalWeek ?? null,
            profileImage: profileInfo.avatar || profileInfo.profileImage || null,
            riskLevel: normalizeRiskLevel(profileInfo.riskLevel),
            consentStatus,
            consentExpiresAt: profileInfo.consentExpiresAt || null
          });
          seenPatients.add(consultation.patientId);
        });

      const completedConsultations = consultations.filter((c) => c.status === 'completed');
      const pendingConsultations = consultations.filter((c) => c.status && c.status !== 'completed');

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);

      const monthMatches = (dateString, month, year) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (!Number.isFinite(date.getTime())) return false;
        return date.getMonth() === month && date.getFullYear() === year;
      };

      const sumFees = (items) =>
        items.reduce((sum, item) => sum + (Number.isFinite(item.fee) ? item.fee : 0), 0);

      const thisMonthConsultations = completedConsultations.filter((c) =>
        monthMatches(c.scheduledAt, currentMonth, currentYear)
      );
      const lastMonthConsultations = completedConsultations.filter((c) =>
        monthMatches(c.scheduledAt, lastMonthDate.getMonth(), lastMonthDate.getFullYear())
      );

      const earningsHistory = completedConsultations
        .filter((c) => Number.isFinite(c.fee))
        .slice()
        .sort((a, b) => {
          const aTime = toTimestamp(a.scheduledAt) ?? 0;
          const bTime = toTimestamp(b.scheduledAt) ?? 0;
          return bTime - aTime;
        })
        .slice(0, 10)
        .map((c) => ({
          date: c.scheduledAt,
          amount: c.fee,
          consultationId: c.id
        }));

      const earnings = {
        totalEarnings: sumFees(completedConsultations),
        thisMonth: sumFees(thisMonthConsultations),
        lastMonth: sumFees(lastMonthConsultations),
        pendingPayments: sumFees(pendingConsultations),
        consultationCount: completedConsultations.length,
        earningsHistory
      };

      const scheduleRows = await query(
        `SELECT data FROM app_entities WHERE type = 'doctor_schedule' AND user_id = ? LIMIT 1`,
        [userId]
      );

      let schedule = [];
      if (scheduleRows.length > 0) {
        const scheduleData = parseJson(scheduleRows[0].data, {});
        schedule = normalizeScheduleItems(scheduleData.schedule || scheduleData.items || scheduleData);
      }

      const notificationRows = await query(
        `SELECT id, data, created_at FROM app_entities WHERE type = 'notification' AND user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [userId]
      );
      const notifications = notificationRows.map((row) => {
        const data = parseJson(row.data, {});
        return {
          id: row.id,
          type: data.type ? String(data.type).toLowerCase() : null,
          title: data.title ?? null,
          message: data.message ?? null,
          timestamp: data.createdAt || row.created_at || null,
          read: data.isRead ?? data.read ?? false,
          actionUrl: data.link || null
        };
      });

      res.json({
        profile,
        todayConsultations,
        upcomingConsultations,
        missedConsultations,
        recentPatients,
        earnings,
        schedule,
        notifications
      });
    } catch (err) {
      console.error('Doctor dashboard error:', err);
      next(err);
    }
  });

  // Get consultations list
  router.get('/doctor/consultations', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const userId = req.user.sub;
      const docCatRows = await query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
      const doctorCatalogId = docCatRows.length ? docCatRows[0].id : userId;

      const doctorFeeRows = await query(
        `SELECT fee_amount FROM doctors WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      const doctorFeeValue =
        doctorFeeRows.length > 0 && doctorFeeRows[0].fee_amount !== null && doctorFeeRows[0].fee_amount !== ''
          ? Number(doctorFeeRows[0].fee_amount)
          : null;
      const consultationFee = Number.isFinite(doctorFeeValue) ? doctorFeeValue : null;

      const appointmentRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment' ORDER BY created_at DESC`
      );

      const appointments = appointmentRows
        .map((row) => ({
          ...parseJson(row.data, {}),
          id: row.id,
          createdAt: row.created_at,
          userId: row.user_id || parseJson(row.data, {}).userId
        }))
        .filter((appt) => appt && appt.doctorId === doctorCatalogId);

      const patientIds = appointments
        .map((appt) => appt.patientId || appt.userId)
        .filter(Boolean);
      const patientProfiles = await loadPatientProfiles(patientIds);

      let consultations = appointments.map((appt) =>
        buildConsultationFromAppointment(appt, patientProfiles, consultationFee)
      );

      if (status && status !== 'all') {
        consultations = consultations.filter((c) => c.status === normalizeConsultationStatus(status));
      }

      const startIdx = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const endIdx = startIdx + parseInt(limit, 10);
      const paginatedItems = consultations.slice(startIdx, endIdx);

      res.json({
        items: paginatedItems,
        page: parseInt(page, 10),
        pageSize: parseInt(limit, 10),
        total: consultations.length,
        totalPages: Math.ceil(consultations.length / parseInt(limit, 10))
      });
    } catch (err) {
      next(err);
    }
  });

  // Get patient details
  // ðŸ” PATIENT DETAILS - REQUIRES CONSENT (DATABASE-BACKED)
  router.get('/doctor/patients/:id', requireAuth, requireRole('doctor'), requireConsentForPatient('id'), async (req, res, next) => {
    try {
      const patientId = req.params.id;
      
      // Query real patient profile from database
      const userRows = await query(
        `SELECT id, phone, email, health_id FROM users WHERE id = ? LIMIT 1`,
        [patientId]
      );
      
      if (!userRows.length) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      const user = userRows[0];
      
      // Get patient profile
      const profileRows = await query(
        `SELECT full_name, date_of_birth FROM user_profiles WHERE user_id = ? LIMIT 1`,
        [patientId]
      );
      
      const profile = profileRows.length > 0 ? profileRows[0] : {};
      
      // Get medical history
      const medicalRows = await query(
        `SELECT data FROM app_entities WHERE type = 'medical_report' AND user_id = ? LIMIT 1`,
        [patientId]
      );
      
      let medicalData = {};
      if (medicalRows.length > 0) {
        try {
          medicalData = JSON.parse(medicalRows[0].data || '{}');
        } catch (e) {
          medicalData = {};
        }
      }
      
      // Get pregnancy information
      const pregnancyRows = await query(
        `SELECT data FROM app_entities WHERE type = 'pregnancy' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [patientId]
      );
      
      let pregnancyData = {};
      if (pregnancyRows.length > 0) {
        try {
          pregnancyData = JSON.parse(pregnancyRows[0].data || '{}');
        } catch (e) {
          pregnancyData = {};
        }
      }
      
      // Get consultation history
      const consultationRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'appointment' AND user_id = ? ORDER BY created_at DESC`,
        [patientId]
      );
      
      let lastConsultation = null;
      const consultations = consultationRows.map(row => {
        try {
          return JSON.parse(row.data || '{}');
        } catch (e) {
          return {};
        }
      }).filter(c => c && c.status === 'completed');
      
      if (consultations.length > 0) {
        lastConsultation = consultations[0].createdAt || consultations[0].date;
      }
      
      // Calculate age from DOB
      let age = null;
      if (profile.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        age = new Date().getFullYear() - dob.getFullYear();
      }
      
      // Get avatar (or use placeholder)
      const meta = await getUserMeta(patientId, ['avatar']);
      
      const patient = {
        id: patientId,
        name: profile.full_name || null,
        age: age ?? null,
        phone: user.phone || null,
        email: user.email || null,
        avatar: meta.avatar || null,
        healthId: user.health_id || null,
        currentPregnancy: {
          gestationalWeek: pregnancyData.gestationalWeek ?? null,
          expectedDueDate: pregnancyData.expectedDueDate ?? null,
          complications: pregnancyData.complications ?? []
        },
        medicalHistory: [
          ...(medicalData.allergies ? [{ condition: `Allergies: ${medicalData.allergies}` }] : []),
          ...(medicalData.knownConditions ? [{ condition: medicalData.knownConditions }] : [])
        ],
        consultationHistory: consultations.length,
        lastConsultation: lastConsultation
      };

      res.json({ patient });
    } catch (err) {
      console.error('Error fetching patient details:', err);
      next(err);
    }
  });

  // ðŸ” UPDATE APPOINTMENT - VERIFY DOCTOR-PATIENT RELATIONSHIP
  router.patch('/doctor/appointments/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      const { status, notes } = req.body;
      const normalizedStatus = normalizeAppointmentStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid appointment status' });
      }
      
      // Fetch the appointment
      const rows = await query(
        `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
        [appointmentId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      
      const appointment = JSON.parse(rows[0].data);
      const patientId = appointment.userId || appointment.patientId;
      
      // Verify this doctor owns this appointment (doctorId may be catalog ID, not user ID)
      const docCatRows2 = await query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.sub]);
      const doctorCatalogId2 = docCatRows2.length ? docCatRows2[0].id : req.user.sub;
      if (appointment.doctorId !== doctorCatalogId2 && appointment.doctorId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to update this appointment' });
      }

      const requiresConsent = normalizedStatus === 'in-progress' || normalizedStatus === 'completed';
      if (requiresConsent) {
        // Verify consent exists (time-sensitive for active consultations)
        const consentRows = await query(
          `SELECT id, data FROM app_entities 
           WHERE type = 'medical_consent' 
           AND user_id = ?
           LIMIT 100`,
          [patientId]
        );

        const now = new Date();
        const activeConsent = consentRows.some(row => {
          try {
            const consent = JSON.parse(row.data || '{}');
            if (consent.doctorId !== req.user.sub) return false;
            if (consent.status !== 'active') return false;
            if (consent.expiresAt && now > new Date(consent.expiresAt)) return false;
            return true;
          } catch (err) {
            return false;
          }
        });

        if (!activeConsent) {
          return res.status(403).json({
            error: 'Access denied: Patient consent required',
            reason: 'no_active_consent'
          });
        }
      }
      // Update appointment
      appointment.status = normalizedStatus;
      if (notes) appointment.doctorNotes = notes;
      appointment.updatedAt = new Date().toISOString();
      
      await query(
        `UPDATE app_entities SET data = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(appointment), new Date(), appointmentId]
      );
      
      // Notify patient about status change
      const doctorDisplayName = appointment.doctorName || 'Your doctor';
      const statusMessages = {
        scheduled: `${doctorDisplayName} has approved your appointment request.`,
        'in-progress': `Your consultation with ${doctorDisplayName} is now in progress.`,
        completed: `Your consultation with ${doctorDisplayName} has been completed.`,
        cancelled: `${doctorDisplayName} has declined your appointment request.`
      };
      
      if (patientId && statusMessages[normalizedStatus]) {
        try {
          await createNotification(patientId, {
            type: normalizedStatus === 'cancelled' ? 'APPOINTMENT_REJECTED' : 'APPOINTMENT_STATUS',
            entityId: appointmentId,
            title: normalizedStatus === 'cancelled' ? 'Appointment Declined' : 'Appointment Update',
            message: statusMessages[normalizedStatus],
            link: '/appointments'
          });
        } catch (notifErr) {
          console.error('Failed to send patient notification:', notifErr.message);
        }
      }
      
      res.json({ item: appointment });
    } catch (err) {
      next(err);
    }
  });

  // ðŸ” CREATE PRESCRIPTION - REQUIRES PATIENT CONSENT
  router.post('/doctor/prescriptions', requireAuth, requireRole('doctor'), requireConsentForPatient('patientId'), async (req, res, next) => {
    try {
      const { consultationId, patientId, medications, instructions, followUpDate, locale, diagnosis } = req.body;
      const safePatientId = toTrimmedString(patientId, 100);
      const safeConsultationId = toTrimmedString(consultationId, 100) || null;

      const safeMedications = Array.isArray(medications)
        ? medications
            .filter((item) => isPlainObject(item) && toTrimmedString(item.name, 200))
            .map((item) => ({
              name: toTrimmedString(item.name, 200),
              dosage: toOptionalString(item.dosage, 200),
              frequency: toOptionalString(item.frequency, 200),
              duration: toOptionalString(item.duration, 200),
              instructions: toOptionalString(item.instructions, 1000)
            }))
        : [];

      if (!safePatientId || safeMedications.length === 0) {
        return res.status(400).json({ error: 'patientId and at least one medication are required' });
      }
      if (followUpDate && !isValidDateValue(followUpDate)) {
        return res.status(400).json({ error: 'Invalid followUpDate' });
      }

      const prescription = await createEntity({
        type: 'prescription',
        userId: safePatientId,
        data: {
          doctorId: req.user.sub,
          patientId: safePatientId,
          consultationId: safeConsultationId,
          medications: safeMedications,
          instructions: toTrimmedString(instructions, 5000),
          diagnosis: toOptionalString(diagnosis, 5000),
          followUpDate: followUpDate || null,
          locale: toOptionalString(locale, 20) || 'en',
          status: 'active'
        }
      });

      // Link appointment with this prescription when a consultation ID is provided.
      if (safeConsultationId) {
        const consultationRows = await query(
          `SELECT id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
          [safeConsultationId]
        );

        if (consultationRows.length > 0) {
          const consultation = parseJson(consultationRows[0].data, {});
          consultation.prescriptionId = prescription.id;
          consultation.hasPrescription = true;
          consultation.updatedAt = new Date().toISOString();

          await query(
            `UPDATE app_entities SET data = ?, updated_at = NOW() WHERE id = ?`,
            [JSON.stringify(consultation), safeConsultationId]
          );
        }
      }

      await createNotification(safePatientId, {
        type: 'PRESCRIPTION_CREATED',
        entityId: prescription.id,
        title: 'New Prescription',
        message: 'Your doctor has created a new prescription for you.',
        link: '/health'
      });

      res.status(201).json(prescription);
    } catch (err) {
      next(err);
    }
  });

  // ── Get doctor profile/settings ──
  router.get('/doctor/profile', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const docId = await ensureDoctorCatalogEntry(userId);
      if (!docId) return res.status(404).json({ error: 'Doctor profile not found' });

      const [docRows, specialtyRows] = await Promise.all([
        query(
          `SELECT d.id, d.full_name, d.specialty_id, d.phone, d.email, d.fee_amount, d.verified,
                  d.rating, d.availability_status
           FROM doctors d WHERE d.user_id = ? LIMIT 1`, [userId]
        ),
        query('SELECT id, name FROM doctor_specialties ORDER BY name')
      ]);
      const doc = docRows[0] || {};

      // Load additional settings from app_entities
      const settingsRows = await query(
        `SELECT data FROM app_entities WHERE type = 'doctor_settings' AND user_id = ? LIMIT 1`, [userId]
      );
      const settings = settingsRows.length ? parseJson(settingsRows[0].data, {}) : {};

      let specialtyName = null;
      if (doc.specialty_id) {
        const sRow = specialtyRows.find(s => s.id === doc.specialty_id);
        specialtyName = sRow ? sRow.name : null;
      }

      res.json({
        id: doc.id,
        fullName: doc.full_name || '',
        specialtyId: doc.specialty_id || null,
        specialtyName,
        phone: doc.phone || '',
        email: doc.email || '',
        feeAmount: doc.fee_amount ? Number(doc.fee_amount) : 0,
        verified: !!doc.verified,
        rating: doc.rating ? Number(doc.rating) : null,
        availabilityStatus: doc.availability_status || 'available',
        consultationType: settings.consultationType || 'Both',
        hospital: settings.hospital || '',
        bio: settings.bio || '',
        experience: settings.experience || '',
        bmdcNumber: settings.bmdcNumber || '',
        availableSpecialties: specialtyRows
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Update doctor profile/settings ──
  router.put('/doctor/profile', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const docId = await ensureDoctorCatalogEntry(userId);
      if (!docId) return res.status(404).json({ error: 'Doctor profile not found' });

      const {
        fullName, specialtyId, phone, email, feeAmount,
        consultationType, hospital, bio, experience, bmdcNumber,
        availabilityStatus
      } = req.body;

      // Update core doctors table fields
      const updates = [];
      const params = [];
      if (fullName !== undefined) { updates.push('full_name = ?'); params.push(String(fullName).trim()); }
      if (specialtyId !== undefined) { updates.push('specialty_id = ?'); params.push(specialtyId || null); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(String(phone).trim() || null); }
      if (email !== undefined) { updates.push('email = ?'); params.push(String(email).trim() || null); }
      if (feeAmount !== undefined) {
        const feeNum = Number(feeAmount);
        if (Number.isFinite(feeNum) && feeNum >= 0) { updates.push('fee_amount = ?'); params.push(feeNum); }
      }
      if (availabilityStatus !== undefined) {
        const allowed = ['available', 'offline', 'online', 'both', 'unavailable'];
        const norm = String(availabilityStatus).toLowerCase().trim();
        if (allowed.includes(norm)) { updates.push('availability_status = ?'); params.push(norm); }
      }

      if (updates.length) {
        updates.push('updated_at = NOW()');
        params.push(userId);
        await query(`UPDATE doctors SET ${updates.join(', ')} WHERE user_id = ?`, params);
      }

      // Save extended settings in app_entities
      const existingSettings = await query(
        `SELECT data FROM app_entities WHERE type = 'doctor_settings' AND user_id = ? LIMIT 1`, [userId]
      );
      const currentSettings = existingSettings.length ? parseJson(existingSettings[0].data, {}) : {};
      const newSettings = {
        ...currentSettings,
        ...(consultationType !== undefined && { consultationType: String(consultationType) }),
        ...(hospital !== undefined && { hospital: String(hospital) }),
        ...(bio !== undefined && { bio: String(bio) }),
        ...(experience !== undefined && { experience: String(experience) }),
        ...(bmdcNumber !== undefined && { bmdcNumber: String(bmdcNumber) }),
        updatedAt: new Date().toISOString()
      };
      await upsertBySubtype({
        type: 'doctor_settings',
        userId,
        subtype: 'profile',
        data: newSettings
      });

      // Also update availability_status based on consultationType for patient-facing listing
      if (consultationType !== undefined) {
        const statusMap = { Online: 'online', Offline: 'offline', Both: 'both' };
        const mapped = statusMap[consultationType] || 'both';
        await query('UPDATE doctors SET availability_status = ?, updated_at = NOW() WHERE user_id = ?', [mapped, userId]);
      }

      res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
      next(err);
    }
  });

  // Update doctor consultation fee
  router.put('/doctor/fee', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const { fee } = req.body;
      const feeNum = Number(fee);
      if (!Number.isFinite(feeNum) || feeNum < 0) {
        return res.status(400).json({ error: 'Invalid fee amount' });
      }
      // Auto-create doctor catalog entry if missing
      const docId = await ensureDoctorCatalogEntry(userId);
      if (!docId) {
        return res.status(404).json({ error: 'Doctor profile not found' });
      }
      await query('UPDATE doctors SET fee_amount = ?, updated_at = NOW() WHERE user_id = ?', [feeNum, userId]);
      res.json({ success: true, fee: feeNum });
    } catch (err) {
      next(err);
    }
  });

  // Get doctor schedule (DATABASE-BACKED)
  router.get('/doctor/schedule', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;
      
      // Query from database
      const scheduleRows = await query(
        `SELECT data FROM app_entities WHERE type = 'doctor_schedule' AND user_id = ? LIMIT 1`,
        [doctorId]
      );
      
      let schedule = [];
      if (scheduleRows.length > 0) {
        const scheduleData = parseJson(scheduleRows[0].data, {});
        schedule = normalizeScheduleItems(scheduleData.schedule || scheduleData.items || scheduleData);
      }

      res.json(schedule);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      next(err);
    }
  });

  // Update doctor schedule (SAVE TO DATABASE)
  router.put('/doctor/schedule', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;
      const schedulePayload = Array.isArray(req.body) ? req.body : req.body?.schedule;

      if (!schedulePayload || !Array.isArray(schedulePayload)) {
        return res.status(400).json({ error: 'Invalid schedule data' });
      }

      const schedule = normalizeScheduleItems(schedulePayload);

      if (!schedule.length) {
        return res.status(400).json({ error: 'Schedule cannot be empty' });
      }

      for (const slot of schedule) {
        if (slot.isAvailable && (!slot.startTime || !slot.endTime)) {
          return res.status(400).json({ error: `Missing times for day ${slot.dayOfWeek}` });
        }
      }

      // Save to database (EAV for doctor dashboard)
      const scheduleItem = await upsertBySubtype({ 
        type: 'doctor_schedule', 
        userId: doctorId, 
        subtype: 'weekly', 
        data: { 
          schedule,
          updatedAt: new Date().toISOString()
        }
      });

      // ── Sync to doctor_availability_slots (patient-facing) ──
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const docCatSync = await query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [doctorId]);
      const catalogId = docCatSync.length ? docCatSync[0].id : await ensureDoctorCatalogEntry(doctorId);
      if (catalogId) {
        await query('DELETE FROM doctor_availability_slots WHERE doctor_id = ?', [catalogId]);
        for (const slot of schedule) {
          if (!slot.isAvailable) continue;
          const dayName = dayNames[slot.dayOfWeek] || 'Monday';
          const startTime24 = slot.startTime || '09:00';
          const endTime24 = slot.endTime || '17:00';
          const maxC = slot.maxConsultations || 10;
          // Use standard 30-minute slots for clean appointment times
          const slotDuration = 30;
          await query(
            `INSERT INTO doctor_availability_slots (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_consultations) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), catalogId, dayName, startTime24, endTime24, slotDuration, maxC]
          );
        }
      }

      res.json({ 
        success: true,
        message: 'Schedule saved to database',
        schedule,
        id: scheduleItem.id
      });
    } catch (err) {
      console.error('Error updating schedule:', err);
      next(err);
    }
  });

  // Get doctor earnings (CALCULATED FROM REAL DATA)
  router.get('/doctor/earnings', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const docCatRows2 = await query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
      const doctorCatalogId = docCatRows2.length ? docCatRows2[0].id : userId;

      const doctorRows = await query(
        `SELECT fee_amount FROM doctors WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      const doctorFeeValue =
        doctorRows.length > 0 && doctorRows[0].fee_amount !== null && doctorRows[0].fee_amount !== ''
          ? Number(doctorRows[0].fee_amount)
          : null;
      const defaultFee = Number.isFinite(doctorFeeValue) ? doctorFeeValue : null;

      const appointmentRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment' ORDER BY created_at DESC`
      );

      const appointments = appointmentRows
        .map((row) => ({
          ...parseJson(row.data, {}),
          id: row.id,
          createdAt: row.created_at,
          userId: row.user_id || parseJson(row.data, {}).userId
        }))
        .filter((appt) => appt && appt.doctorId === doctorCatalogId);

      const consultations = appointments.map((appt) =>
        buildConsultationFromAppointment(appt, new Map(), defaultFee)
      );

      const completedConsultations = consultations.filter((c) => c.status === 'completed');
      const pendingConsultations = consultations.filter((c) => c.status && c.status !== 'completed');

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

      const inRange = (dateString, start, end) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const time = date.getTime();
        if (!Number.isFinite(time)) return false;
        return date >= start && date < end;
      };

      const sumFees = (items) =>
        items.reduce((sum, item) => sum + (Number.isFinite(item.fee) ? item.fee : 0), 0);

      const thisMonthConsultations = completedConsultations.filter((c) =>
        inRange(c.scheduledAt, currentMonthStart, currentMonthEnd)
      );
      const lastMonthConsultations = completedConsultations.filter((c) =>
        inRange(c.scheduledAt, lastMonthStart, lastMonthEnd)
      );

      const earningsHistory = completedConsultations
        .filter((c) => Number.isFinite(c.fee))
        .slice()
        .sort((a, b) => {
          const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
          const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5)
        .map((c) => ({
          date: c.scheduledAt,
          amount: c.fee,
          consultationId: c.id
        }));

      const earnings = {
        totalEarnings: sumFees(completedConsultations),
        thisMonth: sumFees(thisMonthConsultations),
        lastMonth: sumFees(lastMonthConsultations),
        pendingPayments: sumFees(pendingConsultations),
        consultationCount: completedConsultations.length,
        earningsHistory
      };

      res.json(earnings);
    } catch (err) {
      console.error('Error fetching earnings:', err);
      next(err);
    }
  });

  // Update consultation status
  router.put('/doctor/consultations/:id/status', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const normalizedStatus = normalizeAppointmentStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Update consultation in database
      // Note: appointment's user_id is the PATIENT, not the doctor.
      // Verify this doctor owns the appointment via the data.doctorId field.
      const appointmentRows = await query(
        `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
        [id]
      );
      if (!appointmentRows.length) {
        return res.status(404).json({ error: 'Consultation not found' });
      }
      const apptData = parseJson(appointmentRows[0].data, {});
      const docCatRows = await query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.sub]);
      const doctorCatalogId = docCatRows.length ? docCatRows[0].id : req.user.sub;
      if (apptData.doctorId !== doctorCatalogId && apptData.doctorId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to update this appointment' });
      }

      // Update without userId filter since appointment belongs to the patient
      const consultation = await updateEntity({ 
        type: 'appointment', 
        id,
        data: { status: normalizedStatus, updatedAt: new Date().toISOString() } 
      });

      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      // Notify the patient about the status change
      const patientUserId = appointmentRows[0].user_id;
      const doctorName = apptData.doctorName || 'Your doctor';
      const statusMessages = {
        scheduled: `${doctorName} has approved your appointment request.`,
        'in-progress': `Your consultation with ${doctorName} is now in progress.`,
        completed: `Your consultation with ${doctorName} has been completed.`,
        cancelled: `${doctorName} has declined your appointment request.`
      };
      if (patientUserId && statusMessages[normalizedStatus]) {
        try {
          await createNotification(patientUserId, {
            type: normalizedStatus === 'cancelled' ? 'APPOINTMENT_REJECTED' : 'APPOINTMENT_STATUS',
            entityId: id,
            title: normalizedStatus === 'cancelled' ? 'Appointment Declined' : 'Appointment Update',
            message: statusMessages[normalizedStatus],
            link: '/appointments'
          });
        } catch (notifErr) {
          console.error('Failed to send patient notification:', notifErr.message);
        }
      }

      res.json({ 
        success: true,
        message: 'Consultation status updated',
        consultationId: id,
        newStatus: normalizedStatus,
        consultation
      });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // PHARMACY DASHBOARD ROUTES
  // =====================================================

  // Get pharmacy dashboard overview
  router.get('/pharmacy/dashboard', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const pharmacyId = req.user.sub;
      
      // Fetch pharmacy profile
      const profileRows = await query(
        `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [pharmacyId]
      );
      
      let profile = {
        id: pharmacyId,
        name: 'Pharmacy Owner',
        email: req.user.email || 'pharmacy@nurtureglow.com',
        phone: '+880-1234-567890',
        avatar: `https://picsum.photos/seed/${pharmacyId}/100/100`,
        verificationStatus: 'Verified'
      };
      
      if (profileRows.length > 0) {
        const profileData = JSON.parse(profileRows[0].data);
        profile = {
          ...profile,
          name: profileData.name || profileData.username || profile.name,
          phone: profileData.phone || profile.phone,
          shopName: profileData.shopName || 'Nurture Glow Pharmacy',
          license: profileData.license || 'Pending',
          address: profileData.address || 'Dhaka, Bangladesh'
        };
      }
      
      // Fetch all orders
      const allOrdersRows = await query(
        `SELECT data FROM app_entities WHERE type = 'order'`
      );
      
      const allOrders = allOrdersRows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return null;
        }
      }).filter(order => order !== null);
      
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = allOrders.filter(order => order.orderDate?.startsWith(today)).length;
      const pendingOrders = allOrders.filter(order => order.status === 'pending' || order.status === 'scheduled').length;
      const processingOrders = allOrders.filter(order => order.status === 'processing' || order.status === 'in-progress').length;
      const totalRevenue = allOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.total || 0), 0);
      
      const dashboardData = {
        profile,
        stats: {
          todayOrders,
          pendingOrders,
          processingOrders,
          totalRevenue,
          totalOrders: allOrders.length
        }
      };
      
      res.json(dashboardData);
    } catch (err) {
      next(err);
    }
  });

  // Get all orders for pharmacy
  router.get('/pharmacy/orders', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      // Fetch all orders
      const allOrdersRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'order' ORDER BY created_at DESC`
      );
      
      let orders = allOrdersRows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return null;
        }
      }).filter(order => order !== null);
      
      // Filter by status if provided
      if (status && status !== 'all') {
        orders = orders.filter(o => o.status === status);
      }
      
      // Fetch customer names for each order
      for (let order of orders) {
        try {
          const userRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [order.userId]
          );
          if (userRows.length > 0) {
            const profile = JSON.parse(userRows[0].data);
            order.customerName = profile.name || profile.username || 'Customer';
            order.customerPhone = profile.phone || 'N/A';
          } else {
            order.customerName = 'Customer';
            order.customerPhone = 'N/A';
          }
        } catch (e) {
          order.customerName = 'Customer';
          order.customerPhone = 'N/A';
        }
      }
      
      const startIdx = (parseInt(page) - 1) * parseInt(limit);
      const endIdx = startIdx + parseInt(limit);
      const paginatedItems = orders.slice(startIdx, endIdx);
      
      res.json({
        items: paginatedItems,
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: orders.length,
        totalPages: Math.ceil(orders.length / parseInt(limit))
      });
    } catch (err) {
      next(err);
    }
  });

  // Update order status
  router.patch('/pharmacy/orders/:id', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const { status, notes } = req.body;
      
      if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      // Fetch the order
      const rows = await query(
        `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'order' LIMIT 1`,
        [orderId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = JSON.parse(rows[0].data);
      
      // Update order
      order.status = status;
      if (notes) order.pharmacyNotes = notes;
      order.updatedAt = new Date().toISOString();
      
      if (status === 'shipped') {
        order.shippedAt = new Date().toISOString();
      } else if (status === 'delivered') {
        order.deliveredAt = new Date().toISOString();
      }
      
      await query(
        `UPDATE app_entities SET data = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(order), new Date(), orderId]
      );
      
      // Notify customer about status change
      const statusMessages = {
        processing: 'Your order is being prepared.',
        shipped: 'Your order has been shipped and is on the way!',
        delivered: 'Your order has been delivered. Thank you!',
        cancelled: 'Your order has been cancelled.'
      };
      
      if (statusMessages[status]) {
        await createNotification(order.userId, {
          type: 'ORDER_STATUS',
          entityId: orderId,
          title: 'Order Update',
          message: statusMessages[status],
          link: '/orders'
        });
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  // Get order details for pharmacy
  router.get('/pharmacy/orders/:id', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      
      const rows = await query(
        `SELECT data FROM app_entities WHERE id = ? AND type = 'order' LIMIT 1`,
        [orderId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = JSON.parse(rows[0].data);
      
      // Fetch customer details
      try {
        const userRows = await query(
          `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
          [order.userId]
        );
        if (userRows.length > 0) {
          const profile = JSON.parse(userRows[0].data);
          order.customerName = profile.name || profile.username || 'Customer';
          order.customerPhone = profile.phone || 'N/A';
          order.customerEmail = profile.email || 'N/A';
        }
      } catch (e) {
        order.customerName = 'Customer';
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // MERCHANDISER DASHBOARD ROUTES
  // =====================================================

  router.get('/merchandiser/dashboard', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const [products, notifications] = await Promise.all([
        listEntities({ type: 'merchant_product', userId: req.user.sub }),
        listEntities({ type: 'notification', userId: req.user.sub })
      ]);

      const safeProducts = (products || []).map((item) => ({
        id: item.id,
        name: toTrimmedString(item.name, 200),
        category: toTrimmedString(item.category, 100) || 'General',
        price: toNonNegativeNumber(item.price) ?? 0,
        stockQuantity: Math.max(0, Math.round(toNonNegativeNumber(item.stockQuantity) ?? 0)),
        lowStockThreshold: Math.max(0, Math.round(toNonNegativeNumber(item.lowStockThreshold) ?? 10)),
        status: normalizeEnumValue(item.status || 'draft', allowedMerchandiserProductStatuses) || 'draft',
        image: toOptionalString(item.image, 1000) || null,
        description: toOptionalString(item.description, 5000) || '',
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null
      }));

      const totalProducts = safeProducts.length;
      const activeProducts = safeProducts.filter((item) => item.status === 'active').length;
      const lowStockProducts = safeProducts.filter(
        (item) => item.stockQuantity > 0 && item.stockQuantity <= item.lowStockThreshold
      ).length;
      const outOfStockProducts = safeProducts.filter((item) => item.stockQuantity === 0).length;
      const inventoryValue = safeProducts.reduce(
        (sum, item) => sum + item.price * item.stockQuantity,
        0
      );

      const unreadNotifications = (notifications || []).filter((item) => !item.isRead).length;

      res.json({
        profile: {
          id: req.user.sub,
          name: req.user?.name || req.user?.email || 'Merchandiser',
          email: req.user?.email || null,
          phone: req.user?.phone || null,
          avatar: req.user?.avatar || null
        },
        stats: {
          totalProducts,
          activeProducts,
          lowStockProducts,
          outOfStockProducts,
          inventoryValue,
          unreadNotifications
        },
        recentProducts: safeProducts
          .slice()
          .sort((a, b) => {
            const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
            const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
            return bTime - aTime;
          })
          .slice(0, 5)
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/merchandiser/products', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const statusFilter = toTrimmedString(req.query.status, 50).toLowerCase();
      const items = await listEntities({ type: 'merchant_product', userId: req.user.sub });

      const products = (items || [])
        .map((item) => ({
          id: item.id,
          name: toTrimmedString(item.name, 200),
          category: toTrimmedString(item.category, 100) || 'General',
          price: toNonNegativeNumber(item.price) ?? 0,
          stockQuantity: Math.max(0, Math.round(toNonNegativeNumber(item.stockQuantity) ?? 0)),
          lowStockThreshold: Math.max(0, Math.round(toNonNegativeNumber(item.lowStockThreshold) ?? 10)),
          status: normalizeEnumValue(item.status || 'draft', allowedMerchandiserProductStatuses) || 'draft',
          image: toOptionalString(item.image, 1000) || null,
          description: toOptionalString(item.description, 5000) || '',
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null
        }))
        .filter((item) => (statusFilter && statusFilter !== 'all' ? item.status === statusFilter : true))
        .sort((a, b) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
          return bTime - aTime;
        });

      res.json({ items: products });
    } catch (err) {
      next(err);
    }
  });

  router.post('/merchandiser/products', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const {
        name,
        category,
        price,
        stockQuantity,
        lowStockThreshold,
        status,
        image,
        description
      } = req.body || {};

      const safeName = toTrimmedString(name, 200);
      const safeCategory = toTrimmedString(category, 100) || 'General';
      const safePrice = toNonNegativeNumber(price);
      const safeStockQuantity = toNonNegativeNumber(stockQuantity);
      const safeLowStockThreshold = toNonNegativeNumber(lowStockThreshold);
      const safeStatus =
        normalizeEnumValue(status || 'draft', allowedMerchandiserProductStatuses) || 'draft';

      if (!safeName) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (safePrice === null) {
        return res.status(400).json({ error: 'Valid price is required' });
      }

      const item = await createEntity({
        type: 'merchant_product',
        userId: req.user.sub,
        data: {
          name: safeName,
          category: safeCategory,
          price: safePrice,
          stockQuantity: Math.max(0, Math.round(safeStockQuantity ?? 0)),
          lowStockThreshold: Math.max(0, Math.round(safeLowStockThreshold ?? 10)),
          status: safeStatus,
          image: toOptionalString(image, 1000) || null,
          description: toOptionalString(description, 5000) || ''
        }
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/merchandiser/products/:id', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'merchant_product',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const updates = {};
      if (req.body?.name !== undefined) {
        const safeName = toTrimmedString(req.body.name, 200);
        if (!safeName) return res.status(400).json({ error: 'Invalid name' });
        updates.name = safeName;
      }
      if (req.body?.category !== undefined) {
        updates.category = toTrimmedString(req.body.category, 100) || 'General';
      }
      if (req.body?.price !== undefined) {
        const safePrice = toNonNegativeNumber(req.body.price);
        if (safePrice === null) return res.status(400).json({ error: 'Invalid price' });
        updates.price = safePrice;
      }
      if (req.body?.stockQuantity !== undefined) {
        const safeStock = toNonNegativeNumber(req.body.stockQuantity);
        if (safeStock === null) return res.status(400).json({ error: 'Invalid stockQuantity' });
        updates.stockQuantity = Math.max(0, Math.round(safeStock));
      }
      if (req.body?.lowStockThreshold !== undefined) {
        const safeThreshold = toNonNegativeNumber(req.body.lowStockThreshold);
        if (safeThreshold === null) {
          return res.status(400).json({ error: 'Invalid lowStockThreshold' });
        }
        updates.lowStockThreshold = Math.max(0, Math.round(safeThreshold));
      }
      if (req.body?.status !== undefined) {
        const safeStatus = normalizeEnumValue(req.body.status, allowedMerchandiserProductStatuses);
        if (!safeStatus) return res.status(400).json({ error: 'Invalid status' });
        updates.status = safeStatus;
      }
      if (req.body?.image !== undefined) {
        updates.image = toOptionalString(req.body.image, 1000) || null;
      }
      if (req.body?.description !== undefined) {
        updates.description = toOptionalString(req.body.description, 5000) || '';
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'merchant_product',
        userId: req.user.sub,
        data: updates
      });

      if (!item) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/merchandiser/products/:id', requireAuth, requireRole('merchandiser'), async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'merchant_product',
        userId: req.user.sub
      });

      if (!ok) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // MEDICAL RECORD SHARING & CONSENT SYSTEM
  // =====================================================

  // Patient grants access to their medical records to a doctor
  router.post('/medical/consent/grant', requireAuth, async (req, res, next) => {
    try {
      const { doctorId, expiresInDays = 30 } = req.body;
      
      if (!doctorId) {
        return res.status(400).json({ error: 'doctorId is required' });
      }
      
      const consentData = {
        patientId: req.user.sub,
        doctorId,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        accessLevel: 'full' // full, limited
      };
      
      const consent = await createEntity({
        type: 'medical_consent',
        userId: req.user.sub,
        data: consentData
      });
      
      // Notify doctor
      await createNotification(doctorId, {
        type: 'MEDICAL_ACCESS_GRANTED',
        entityId: consent.id,
        title: 'Medical Records Access Granted',
        message: 'A patient has granted you access to their medical records.',
        link: '/doctor/patients'
      });
      
      res.status(201).json({ consent });
    } catch (err) {
      next(err);
    }
  });

  // Patient revokes access
  router.delete('/medical/consent/:id', requireAuth, async (req, res, next) => {
    try {
      const consentId = req.params.id;
      
      const rows = await query(
        `SELECT id, data FROM app_entities WHERE id = ? AND type = 'medical_consent' AND user_id = ? LIMIT 1`,
        [consentId, req.user.sub]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Consent not found' });
      }
      
      const consent = JSON.parse(rows[0].data);
      consent.status = 'revoked';
      consent.revokedAt = new Date().toISOString();
      
      await query(
        `UPDATE app_entities SET data = ? WHERE id = ?`,
        [JSON.stringify(consent), consentId]
      );
      
      // Notify doctor
      await createNotification(consent.doctorId, {
        type: 'MEDICAL_ACCESS_REVOKED',
        entityId: consentId,
        title: 'Medical Records Access Revoked',
        message: 'A patient has revoked your access to their medical records.',
        link: '/doctor/patients'
      });
      
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Patient views who has access to their records
  router.get('/medical/consent', requireAuth, async (req, res, next) => {
    try {
      const consents = await listEntities({
        type: 'medical_consent',
        userId: req.user.sub
      });
      
      // Fetch doctor names
      for (let consent of consents) {
        try {
          const doctorRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [consent.doctorId]
          );
          if (doctorRows.length > 0) {
            const doctorProfile = JSON.parse(doctorRows[0].data);
            consent.doctorName = doctorProfile.name || 'Doctor';
            consent.doctorSpecialty = doctorProfile.specialty || 'General';
          }
        } catch (e) {
          consent.doctorName = 'Doctor';
        }
      }
      
      res.json({ items: consents });
    } catch (err) {
      next(err);
    }
  });

  // Doctor requests access to patient's medical records
  router.post('/medical/consent/request', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { patientId, reason } = req.body;
      
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
      }
      
      const requestData = {
        doctorId: req.user.sub,
        patientId,
        reason: reason || 'Medical consultation',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      const request = await createEntity({
        type: 'medical_access_request',
        userId: req.user.sub,
        data: requestData
      });
      
      // Notify patient
      await createNotification(patientId, {
        type: 'MEDICAL_ACCESS_REQUEST',
        entityId: request.id,
        title: 'Medical Records Access Request',
        message: 'A doctor has requested access to your medical records.',
        link: '/profile'
      });
      
      res.status(201).json({ request });
    } catch (err) {
      next(err);
    }
  });

  // Doctor views patients with granted access
  router.get('/doctor/accessible-patients', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const allConsentsRows = await query(
        `SELECT data FROM app_entities WHERE type = 'medical_consent'`
      );
      
      const doctorConsents = allConsentsRows
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

  // =====================================================
  // HEALTH ID VERIFICATION SYSTEM
  // =====================================================

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

  // =====================================================
  // ENHANCED PRESCRIPTION SYSTEM
  // =====================================================

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
        userId: patientId, // Store under patient's account
        data: prescriptionData
      });
      
      // Update consultation with prescription ID if provided
      if (consultationId) {
        const consultationRows = await query(
          `SELECT id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
          [consultationId]
        );
        
        if (consultationRows.length > 0) {
          const consultation = JSON.parse(consultationRows[0].data);
          consultation.prescriptionId = prescription.id;
          consultation.hasPrescription = true;
          
          await query(
            `UPDATE app_entities SET data = ? WHERE id = ?`,
            [JSON.stringify(consultation), consultationId]
          );
        }
      }
      
      // Notify patient
      await createNotification(patientId, {
        type: 'PRESCRIPTION_CREATED',
        entityId: prescription.id,
        title: 'New Prescription',
        message: 'Your doctor has created a new prescription for you.',
        link: '/health'
      });
      
      res.status(201).json({ prescription });
    } catch (err) {
      next(err);
    }
  });

  // Get patient's prescriptions
  router.get('/prescriptions', requireAuth, async (req, res, next) => {
    try {
      const prescriptions = await listEntities({
        type: 'prescription',
        userId: req.user.sub
      });
      
      // Fetch doctor names
      for (let prescription of prescriptions) {
        try {
          const doctorRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [prescription.doctorId]
          );
          if (doctorRows.length > 0) {
            const doctorProfile = JSON.parse(doctorRows[0].data);
            prescription.doctorName = doctorProfile.name || 'Doctor';
            prescription.doctorSpecialty = doctorProfile.specialty || '';
          }
        } catch (e) {
          prescription.doctorName = 'Doctor';
        }
      }
      
      res.json({ items: prescriptions });
    } catch (err) {
      next(err);
    }
  });

  // Doctor gets all their issued prescriptions
  router.get('/doctor/prescriptions', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const allPrescriptionsRows = await query(
        `SELECT data FROM app_entities WHERE type = 'prescription'`
      );
      
      const doctorPrescriptions = allPrescriptionsRows
        .map(row => {
          try {
            return JSON.parse(row.data);
          } catch (e) {
            return null;
          }
        })
        .filter(prescription => prescription && prescription.doctorId === req.user.sub);
      
      // Fetch patient names
      for (let prescription of doctorPrescriptions) {
        try {
          const patientRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [prescription.patientId]
          );
          if (patientRows.length > 0) {
            const profile = JSON.parse(patientRows[0].data);
            prescription.patientName = profile.name || 'Patient';
          }
        } catch (e) {
          prescription.patientName = 'Patient';
        }
      }
      
      res.json({ items: doctorPrescriptions });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // DOCTOR & PHARMACIST VERIFICATION SUBMISSION
  // =====================================================

  // Doctor submits verification request
  router.post('/doctor/submit-verification', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { name, specialty, bmdc, hospital, experience, education, documents } = req.body;

      if (!name || !specialty || !bmdc) {
        return res.status(400).json({ error: 'name, specialty, and bmdc are required' });
      }

      // Check if already verified or pending
      const existingRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'doctor_verification' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );

      if (existingRows.length > 0) {
        const existing = JSON.parse(existingRows[0].data);
        if (existing.status === 'approved') {
          return res.status(400).json({ error: 'Already verified' });
        }
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'Verification request already pending' });
        }
      }

      const verification = await createEntity({
        type: 'doctor_verification',
        userId: req.user.sub,
        data: {
          name,
          specialty,
          bmdc,
          hospital: hospital || '',
          experience: experience || 0,
          education: education || '',
          documents: documents || [],
          status: 'pending',
          submittedAt: new Date().toISOString()
        }
      });

      // Notify all medical admins
      const medicalRoleOptions = getRoleFilterOptions('medical_admin');
      const medicalRolePlaceholders = medicalRoleOptions.map(() => '?').join(', ');
      const adminUsers = await query(
        `SELECT id FROM users WHERE role IN (${medicalRolePlaceholders})`,
        medicalRoleOptions
      );
      for (const admin of adminUsers) {
        await createNotification(admin.id, {
          type: 'NEW_DOCTOR_VERIFICATION',
          entityId: verification.id,
          title: 'New Doctor Verification Request',
          message: `Dr. ${name} has submitted a verification request.`,
          link: '/admin/medical/verifications'
        });
      }

      res.status(201).json({ success: true, verification });
    } catch (err) {
      next(err);
    }
  });

  // Pharmacist submits verification request
  router.post('/pharmacist/submit-verification', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const { pharmacyName, licenseNumber, address, phone, ownerName, documents } = req.body;

      if (!pharmacyName || !licenseNumber) {
        return res.status(400).json({ error: 'pharmacyName and licenseNumber are required' });
      }

      // Check if already verified or pending
      const existingRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'pharmacist_verification' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );

      if (existingRows.length > 0) {
        const existing = JSON.parse(existingRows[0].data);
        if (existing.status === 'approved') {
          return res.status(400).json({ error: 'Already verified' });
        }
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'Verification request already pending' });
        }
      }

      const verification = await createEntity({
        type: 'pharmacist_verification',
        userId: req.user.sub,
        data: {
          pharmacyName,
          licenseNumber,
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
          message: `${pharmacyName} has submitted a verification request.`,
          link: '/admin/verifications/pharmacies'
        });
      }

      res.status(201).json({ success: true, verification });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // PUBLIC ANNOUNCEMENTS (All Users)
  // =====================================================

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

  // =====================================================
  // PATIENT DASHBOARD SUMMARY (Mother Dashboard)
  // =====================================================

  // Get aggregated dashboard summary - single API call for all dashboard data
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

