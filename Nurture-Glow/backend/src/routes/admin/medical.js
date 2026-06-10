import express from 'express';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db.js';
import { createEntity } from '../../appStore.js';
import { normalizeRoleValue, getRoleFilterOptions, getRoleFilterOptionsFromInput, CANONICAL_ROLES } from '../../roles.js';
import { sendAccountSuspendedEmail, sendPasswordResetEmail } from '../../emailService.js';
import {
  parseJson,
  toTrimmedString,
  normalizeEnumValue,
  parseBooleanParam,
  createNotification
} from '../../utils/index.js';
import {
  sendSuccess,
  sendCreated,
  sendError,
  parsePagination,
  paginationMeta
} from '../../utils/response.js';

export function createMedicalAdminRouter({ requireAuth, requireRole }) {
  const router = express.Router();


  const allowedDoctorVerificationStatuses = new Set([
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'ADDITIONAL_INFO_REQUIRED'
  ]);
  const allowedHighRiskStatuses = new Set([
    'ACTIVE',
    'RESOLVED',
    'EMERGENCY',
    'HOSPITALIZED'
  ]);
  const allowedHighRiskLevels = new Set(['MODERATE', 'HIGH', 'CRITICAL']);
  const allowedConsultationReviewStatuses = new Set([
    'PENDING',
    'IN_REVIEW',
    'APPROVED',
    'FLAGGED',
    'ESCALATED'
  ]);

  router.get('/medical/dashboard', requireAuth, requireRole('medical_admin', 'medical-admin', 'system_admin', 'system-admin'), async (req, res, next) => {
    try {
      let dashboardData = {};
      try {
        const result = await query('SELECT * FROM v_medical_admin_dashboard');
        dashboardData = result[0] || {};
      } catch (err) {
        console.error('Error fetching medical dashboard view:', err.message);
      }

      // Get doctor verifications (with fallback)
      let recentVerifications = [];
      try {
        recentVerifications = await query(`
          SELECT d.id, u.email as doctor_name, d.specialty as specialization, 
                 d.created_at as submitted_date, 'PENDING' as status
          FROM doctors d
          JOIN users u ON d.user_id = u.id
          WHERE d.verification_status = 'pending'
          ORDER BY d.created_at DESC
          LIMIT 5
        `);
      } catch (err) {
        recentVerifications = [];
      }

      // Get high-risk cases (with fallback)
      let highRiskCases = [];
      try {
        highRiskCases = await query(`
          SELECT m.id as mother_id, u.phone as mother_name,
                 'Gestational Diabetes' as condition,
                 FLOOR(DATEDIFF(CURDATE(), p.last_period_date) / 7) as gestation_week
          FROM mothers m
          JOIN users u ON m.user_id = u.id
          JOIN pregnancies p ON p.mother_id = m.id
          WHERE p.status = 'active' AND p.risk_level = 'high'
          ORDER BY p.created_at DESC
          LIMIT 4
        `);
      } catch (err) {
        highRiskCases = [];
      }

      // Get recent consultations
      let recentConsultations = [];
      try {
        recentConsultations = await query(`
          SELECT c.id, c.consultation_date, c.status, c.consultation_type
          FROM consultations c
          WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          ORDER BY c.created_at DESC
          LIMIT 10
        `);
      } catch (err) {
        recentConsultations = [];
      }

      res.json({
        stats: dashboardData,
        recentVerifications,
        highRiskCases,
        recentConsultations
      });
    } catch (err) {
      next(err);
    }
  });

  // Get pending doctor verifications
  router.get('/medical/doctor-verifications', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const status = String(req.query.status || 'PENDING').toUpperCase();

      let verifications = [];
      try {
        if (status === 'PENDING') {
          const { options: doctorRoleOptions, placeholders: doctorRolePlaceholders } = getRolePlaceholders('doctor');
          const missingDoctors = await query(
            `SELECT u.id, COALESCE(p.full_name, u.email, u.phone, 'Doctor') as doctor_name
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
             LEFT JOIN doctor_verification_requests dv ON dv.user_id = u.id
             WHERE u.role IN (${doctorRolePlaceholders}) AND dv.id IS NULL`,
            doctorRoleOptions
          );

          for (const doctor of missingDoctors) {
            await query(
              `INSERT INTO doctor_verification_requests
               (id, user_id, doctor_name, specialty, status, review_notes, submitted_at)
               VALUES (?, ?, ?, ?, 'PENDING', 'Auto-created from doctor role assignment', NOW())`,
              [uuidv4(), doctor.id, doctor.doctor_name, 'General Medicine']
            );
          }
        }

        verifications = await query(`
          SELECT dv.*, u.email as doctor_email
          FROM doctor_verification_requests dv
          JOIN users u ON dv.user_id = u.id
          WHERE dv.status = ?
          ORDER BY dv.submitted_at DESC
        `, [status]);
      } catch (err) {
        if (err?.code === 'ER_NO_SUCH_TABLE' || err?.errno === 1146) {
          return res.json({ verifications: [], warning: 'doctor_verification_requests table missing' });
        }
        throw err;
      }

      res.json({ verifications });
    } catch (err) {
      next(err);
    }
  });

  // Review doctor verification
  router.patch('/medical/doctor-verifications/:verificationId', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { verificationId } = req.params;
      const { status, reviewNotes, rejectionReason } = req.body;
      const normalizedStatus = normalizeEnumValue(status, allowedDoctorVerificationStatuses);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid verification status' });
      }

      await query(
        `UPDATE doctor_verification_requests 
         SET status = ?, reviewed_by = ?, review_notes = ?, rejection_reason = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [
          normalizedStatus,
          req.user.sub,
          toTrimmedString(reviewNotes, 2000) || null,
          toTrimmedString(rejectionReason, 1000) || null,
          verificationId
        ]
      );

      // If approved, update user role
      if (normalizedStatus === 'APPROVED') {
        const [verification] = await query(
          'SELECT user_id FROM doctor_verification_requests WHERE id = ?',
          [verificationId]
        );

        if (verification) {
          await query(
            'UPDATE users SET role = ? WHERE id = ?',
            ['doctor', verification.user_id]
          );
        }
      }

      // Log admin action
      await query(
        `INSERT INTO admin_actions (id, admin_user_id, admin_role, action_type, action_category, entity_type, entity_id, description, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user.sub,
          'medical_admin',
          'DOCTOR_VERIFICATION',
          'MEDICAL',
          'doctor_verification',
          verificationId,
          `Doctor verification ${normalizedStatus}`,
          normalizedStatus === 'APPROVED' ? 'INFO' : 'WARNING'
        ]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get high-risk pregnancy cases
  router.get('/medical/high-risk-cases', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const status = req.query.status || 'ACTIVE';

      const cases = await query(`
        SELECT hrc.*, u.email as patient_email, u.phone as patient_phone
        FROM high_risk_cases hrc
        JOIN users u ON hrc.patient_user_id = u.id
        WHERE hrc.status = ?
        ORDER BY hrc.risk_level DESC, hrc.flagged_at DESC
      `, [status]);

      res.json({ cases });
    } catch (err) {
      next(err);
    }
  });

  // Flag high-risk case
  router.post('/medical/high-risk-cases', requireAuth, requireRole(['medical_admin', 'doctor', 'system_admin']), async (req, res, next) => {
    try {
      const { patientUserId, riskLevel, riskFactors, symptoms, currentWeek, monitoringFrequency, notes } = req.body;

      const safePatientId = toTrimmedString(patientUserId, 100);
      const normalizedRiskLevel = normalizeEnumValue(riskLevel, allowedHighRiskLevels);

      if (!safePatientId) {
        return res.status(400).json({ error: 'patientUserId is required' });
      }
      if (!normalizedRiskLevel) {
        return res.status(400).json({ error: 'Invalid risk level' });
      }

      const safeRiskFactors =
        riskFactors && typeof riskFactors === 'object' ? riskFactors : {};
      const weekValue = Number(currentWeek);
      const safeWeek = Number.isFinite(weekValue) ? weekValue : null;

      const caseId = uuidv4();
      await query(
        `INSERT INTO high_risk_cases (id, patient_user_id, risk_level, risk_factors, symptoms, current_week, monitoring_frequency, flagged_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          safePatientId,
          normalizedRiskLevel,
          JSON.stringify(safeRiskFactors),
          toTrimmedString(symptoms, 2000) || null,
          safeWeek,
          toTrimmedString(monitoringFrequency, 100) || null,
          req.user.sub,
          toTrimmedString(notes, 2000) || null
        ]
      );

      // Notify medical admins
      const { options: medicalRoleOptions, placeholders: medicalRolePlaceholders } = getRolePlaceholders('medical_admin');
      await query(
        `INSERT INTO admin_notifications (id, sender_user_id, recipient_user_id, notification_type, priority, title, message, action_required, related_entity_type, related_entity_id)
         SELECT ?, ?, id, 'HIGH_RISK_CASE', 'HIGH', ?, ?, TRUE, 'high_risk_case', ?
         FROM users WHERE role IN (${medicalRolePlaceholders})`,
        [
          uuidv4(),
          req.user.sub,
          'New High-Risk Pregnancy Case',
          `Patient flagged as ${riskLevel} risk`,
          caseId,
          ...medicalRoleOptions
        ]
      );

      res.json({ success: true, caseId });
    } catch (err) {
      next(err);
    }
  });

  // Update high-risk case
  router.patch('/medical/high-risk-cases/:caseId', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { caseId } = req.params;
      const { status, assignedDoctorId, nextCheckup, notes } = req.body;

      const updates = [];
      const params = [];

      if (status !== undefined) {
        const normalizedStatus = normalizeEnumValue(status, allowedHighRiskStatuses);
        if (!normalizedStatus) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        updates.push('status = ?');
        params.push(normalizedStatus);
      }
      if (assignedDoctorId !== undefined) {
        const safeDoctorId = toTrimmedString(assignedDoctorId, 100);
        if (!safeDoctorId) {
          return res.status(400).json({ error: 'Invalid assignedDoctorId' });
        }
        updates.push('assigned_doctor_id = ?');
        params.push(safeDoctorId);
      }
      if (nextCheckup !== undefined) {
        const date = new Date(nextCheckup);
        if (!Number.isFinite(date.getTime())) {
          return res.status(400).json({ error: 'Invalid nextCheckup date' });
        }
        updates.push('next_checkup = ?');
        params.push(nextCheckup);
      }
      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(toTrimmedString(notes, 2000) || null);
      }

      updates.push('updated_at = NOW()');
      params.push(caseId);

      await query(
        `UPDATE high_risk_cases SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get consultation reviews
  router.get('/medical/consultation-reviews', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const reviewStatus = req.query.status || 'PENDING';

      const reviews = await query(`
        SELECT cr.*, 
               d.email as doctor_email, 
               p.email as patient_email
        FROM consultation_reviews cr
        JOIN users d ON cr.doctor_id = d.id
        JOIN users p ON cr.patient_id = p.id
        WHERE cr.review_status = ?
        ORDER BY cr.created_at DESC
        LIMIT 50
      `, [reviewStatus]);

      res.json({ reviews });
    } catch (err) {
      next(err);
    }
  });

  // Review consultation
  router.patch('/medical/consultation-reviews/:reviewId', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { reviewId } = req.params;
      const { reviewStatus, qualityScore, completenessScore, professionalismScore, reviewNotes, flaggedIssues } = req.body;

      const normalizedStatus = normalizeEnumValue(reviewStatus, allowedConsultationReviewStatuses);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid review status' });
      }

      const parseScore = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      await query(
        `UPDATE consultation_reviews 
         SET review_status = ?, quality_score = ?, completeness_score = ?, professionalism_score = ?, 
             review_notes = ?, flagged_issues = ?, reviewed_by = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [
          normalizedStatus,
          parseScore(qualityScore),
          parseScore(completenessScore),
          parseScore(professionalismScore),
          toTrimmedString(reviewNotes, 2000) || null,
          JSON.stringify(flaggedIssues || {}),
          req.user.sub,
          reviewId
        ]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get emergency access logs
  router.get('/medical/emergency-access-logs', requireAuth, requireRole(['medical_admin', 'system_admin']), async (req, res, next) => {
    try {
      const logs = await query(`
        SELECT eal.*, 
               accessor.email as accessor_email,
               patient.email as patient_email
        FROM emergency_access_logs eal
        JOIN users accessor ON eal.accessor_user_id = accessor.id
        JOIN users patient ON eal.patient_user_id = patient.id
        WHERE eal.accessed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY eal.accessed_at DESC
        LIMIT 100
      `);

      res.json({ logs });
    } catch (err) {
      next(err);
    }
  });

  // Log emergency access
  router.post('/medical/emergency-access-logs', requireAuth, async (req, res, next) => {
    try {
      const { patientUserId, accessType, reason, emergencyLevel, dataAccessed } = req.body;

      const logId = uuidv4();
      const accessorRole = normalizeRoleValue(req.userRole || req.user?.role) || req.user?.role || null;
      await query(
        `INSERT INTO emergency_access_logs (id, accessor_user_id, accessor_role, patient_user_id, access_type, reason, emergency_level, data_accessed, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [logId, req.user.sub, accessorRole, patientUserId, accessType, reason, emergencyLevel, JSON.stringify(dataAccessed), req.ip]
      );

      // Notify medical admins for critical cases
      if (emergencyLevel === 'CRITICAL') {
        const { options: medicalRoleOptions, placeholders: medicalRolePlaceholders } = getRolePlaceholders('medical_admin');
        await query(
          `INSERT INTO admin_notifications (id, sender_user_id, recipient_user_id, notification_type, priority, title, message, action_required, related_entity_type, related_entity_id)
           SELECT ?, ?, id, 'EMERGENCY_ACCESS', 'URGENT', ?, ?, TRUE, 'emergency_access_log', ?
           FROM users WHERE role IN (${medicalRolePlaceholders})`,
          [
            uuidv4(),
            req.user.sub,
            'Critical Emergency Access',
            `Emergency access to patient data: ${reason}`,
            logId,
            ...medicalRoleOptions
          ]
        );
      }

      res.json({ success: true, logId });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // SHARED ADMIN ROUTES
  // ============================================================================


  return router;
}
