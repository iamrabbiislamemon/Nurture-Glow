import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db.js';
import {
  createEntity,
  updateEntity,
  upsertBySubtype,
  getUserMeta
} from '../appStore.js';
import {
  parseJson,
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  createNotification,
  isPlainObject
} from '../utils/index.js';
import { normalizeRoleValue } from '../roles.js';
import {
  ensureDoctorCatalogEntry,
  resolveUserRole,
  normalizeDayOfWeek
} from '../helpers/doctorHelpers.js';
import {
  normalizeAppointmentStatus,
  normalizeConsultationStatus,
  normalizeConsultationType,
  getScheduledAt
} from '../helpers/appointmentHelpers.js';

export function createDoctorsRouter({ requireAuth, requireRole, requireConsentForPatient }) {
  const router = express.Router();

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

  // Get doctor dashboard overview
  router.get('/doctor/dashboard', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const userId = req.user.sub;

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
        specialtyId: doctorRow.specialty_id || null,
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

  // Update appointment
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
        // Verify consent exists
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

  // Create prescription
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

      // Link appointment with this prescription
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

  // Get doctor profile
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

  // Update doctor profile
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

      // Save settings
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

  // Get doctor schedule
  router.get('/doctor/schedule', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;
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

  // Update doctor schedule
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

      const scheduleItem = await upsertBySubtype({ 
        type: 'doctor_schedule', 
        userId: doctorId, 
        subtype: 'weekly', 
        data: { 
          schedule,
          updatedAt: new Date().toISOString()
        }
      });

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

  // Get doctor earnings
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

      const consultation = await updateEntity({ 
        type: 'appointment', 
        id,
        data: { status: normalizedStatus, updatedAt: new Date().toISOString() } 
      });

      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

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

  return router;
}
