import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { normalizeRoleValue } from '../roles.js';
import {
  parseJson,
  toNonNegativeNumber,
  normalizeEnumValue
} from '../utils/index.js';

export const resolveUserRole = async (req) => {
  if (req.userRole) return req.userRole;
  const tokenRole = normalizeRoleValue(req.user?.role);
  if (tokenRole) return tokenRole;
  if (!req.user?.sub) return 'mother';
  const rows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
  return normalizeRoleValue(rows[0]?.role) || 'mother';
};

export const getCatalogItem = async (type, id) => {
  if (!id) return null;
  const rows = await query(
    `SELECT data FROM app_catalog WHERE id = ? AND type = ? LIMIT 1`,
    [id, type]
  );
  if (!rows.length) return null;
  return parseJson(rows[0].data, {});
};

export const DEFAULT_DOCTOR_SLOTS = ['09:00 AM', '10:30 AM', '04:00 PM'];
export const allowedAppointmentTypes = new Set(['Online', 'Offline', 'Both']);

export const ensureDoctorCatalogEntry = async (userId) => {
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

export const timeStringToMinutes = (value) => {
  if (!value) return null;
  const parts = String(value).trim().split(':');
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const slotStringToMinutes = (value) => {
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

export const minutesToSlotString = (minutes) => {
  if (!Number.isFinite(minutes)) return null;
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridiem}`;
};

export const buildSlotsFromAvailability = (rows) => {
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

export const loadDoctorAvailabilitySlots = async (doctorIds = []) => {
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

export const resolveDoctorType = (value) => {
  const status = String(value || '').toLowerCase();
  if (status.includes('online')) return 'Online';
  if (status.includes('offline') || status.includes('clinic')) return 'Offline';
  return 'Both';
};

export const mapDoctorRowToCatalog = (row, slotsOverride) => {
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

export const listRealDoctors = async () => {
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
export const getDoctorByUserId = async (userId) => {
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

export const getRealDoctorById = async (doctorId) => {
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

export const listDoctorUserOptions = async () => {
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

export const normalizeDayOfWeek = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (Number.isInteger(num) && num >= 0 && num <= 6) {
    return num;
  }
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const normalizedStr = String(val).trim().toLowerCase();
  const index = dayNames.indexOf(normalizedStr);
  if (index !== -1) {
    return index;
  }
  return null;
};
