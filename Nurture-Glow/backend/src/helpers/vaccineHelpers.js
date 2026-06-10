import { resolveUserRole } from './doctorHelpers.js';
import { updateEntity } from '../appStore.js';
import {
  toTrimmedString,
  createNotification
} from '../utils/index.js';

export const allowedVaccineVerificationStatuses = new Set(['pending', 'approved', 'rejected', 'auto']);

export const normalizeVaccineVerificationStatus = (value, fallback = 'pending') => {
  if (value === null || value === undefined || value === '') return fallback;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'pending' || raw === 'pending_approval' || raw === 'awaiting_review') return 'pending';
  if (raw === 'approved' || raw === 'verified') return 'approved';
  if (raw === 'rejected' || raw === 'declined') return 'rejected';
  if (raw === 'auto' || raw === 'auto_verified' || raw === 'doctor') return 'auto';
  return allowedVaccineVerificationStatuses.has(raw) ? raw : fallback;
};

export const normalizeDoseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) return Math.round(num);
  const trimmed = toTrimmedString(value, 20);
  return trimmed || null;
};

export const canAccessVaccine = async (req, vaccine) => {
  if (!vaccine || !req.user?.sub) return false;
  if (vaccine.userId && req.user.sub === vaccine.userId) return true;
  const role = await resolveUserRole(req);
  if (role !== 'doctor') return false;
  return vaccine.doctorUserId && vaccine.doctorUserId === req.user.sub;
};

export const maybeSendVaccineReminders = async (vaccine) => {
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
