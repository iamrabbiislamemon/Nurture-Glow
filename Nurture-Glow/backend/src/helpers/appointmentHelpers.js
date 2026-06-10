import { query, getMeetingData } from '../db.js';
import { resolveUserRole } from './doctorHelpers.js';

export const normalizeAppointmentStatus = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const status = String(value).trim().toLowerCase();
  if (status === 'completed' || status === 'complete') return 'completed';
  if (status === 'in-progress' || status === 'in progress') return 'in-progress';
  if (status === 'cancelled' || status === 'canceled' || status === 'cancel') return 'cancelled';
  if (status === 'pending' || status === 'request' || status === 'requested') return 'pending';
  if (status === 'upcoming' || status === 'scheduled' || status === 'approved') return 'scheduled';
  return null;
};

export const normalizeConsultationStatus = (value) => normalizeAppointmentStatus(value);

export const normalizeConsultationType = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const type = String(value).toLowerCase();
  if (type.includes('phone')) return 'phone';
  if (type.includes('video') || type.includes('online')) return 'video';
  if (type.includes('in-person') || type.includes('offline') || type.includes('clinic')) return 'in-person';
  return null;
};

export const parseTimeTo24h = (value) => {
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

export const buildScheduledAt = (dateValue, timeValue) => {
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

export const getScheduledAt = (appointment) => {
  if (!appointment) return null;
  if (appointment.scheduledAt) {
    const parsed = new Date(appointment.scheduledAt);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return buildScheduledAt(appointment.date, appointment.time);
};

export const isAdminRole = (role) =>
  role === 'medical_admin' || role === 'ops_admin' || role === 'system_admin';

export const isOnlineAppointment = (appointment) => {
  if (!appointment) return false;
  const rawType =
    appointment.type || appointment.appointmentType || appointment.appointment_type;
  if (!rawType) return false;
  return String(rawType).toLowerCase().includes('online');
};

export const getAppointmentInfo = async (appointmentId) => {
  const result = await getMeetingData(appointmentId);
  if (!result) return null;
  return {
    appointment: result.appointment,
    meetingData: result.meetingData || null
  };
};

export const canAccessAppointment = async (req, appointment, allowAdmin = false) => {
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
