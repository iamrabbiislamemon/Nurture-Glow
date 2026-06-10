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

export function createOperationsAdminRouter({ requireAuth, requireRole }) {
  const router = express.Router();


  const getRolePlaceholders = (roleInput) => {
    const options = getRoleFilterOptions(roleInput);
    const placeholders = options.map(() => '?').join(', ');
    return { options, placeholders };
  };

  const createUserNotification = async ({ userId, actorId, type, title, message, payload }) => {
    const notifId = crypto.randomBytes(16).toString('hex');
    try {
      await query(
        `INSERT INTO notifications (id, user_id, notification_type, title, message, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
        [notifId, userId, type, title, message]
      );
    } catch (err) {
      console.warn('Failed to insert into notifications table:', err.message);
    }
    try {
      const now = new Date();
      const entityPayload = {
        id: notifId,
        type,
        title,
        message,
        payload: payload || null,
        isRead: false,
        createdAt: now.toISOString()
      };
      await query(
        `INSERT INTO app_entities (id, user_id, type, subtype, data, created_at, updated_at)
         VALUES (?, ?, 'notification', NULL, ?, ?, ?)`,
        [notifId, userId, JSON.stringify(entityPayload), now, now]
      );
    } catch (err) {
      console.warn('Failed to insert notification entity:', err.message);
    }
    return notifId;
  };

  router.get('/operations/dashboard', requireAuth, requireRole('ops_admin', 'operations_admin', 'operations-admin', 'system_admin', 'system-admin'), async (req, res, next) => {
    try {
      let dashboardData = {};
      try {
        const result = await query('SELECT * FROM v_operations_admin_dashboard');
        dashboardData = result[0] || {};
      } catch (err) {
        console.error('Error fetching operations dashboard view:', err.message);
      }

      // Get card batches (latest)
      let cardBatches = [];
      try {
        cardBatches = await query(`
          SELECT * FROM card_batches
          ORDER BY created_at DESC
          LIMIT 10
        `);
      } catch (err) {
        cardBatches = [];
      }

      // Get hospitals with real data
      let hospitals = [];
      try {
        hospitals = await query(`
          SELECT h.name as hospital_name, 
                 COUNT(DISTINCT c.mother_id) as total_mothers,
                 COUNT(c.id) as total_services,
                 'active' as status
          FROM hospitals h
          LEFT JOIN consultations c ON c.hospital_id = h.id
          GROUP BY h.id, h.name
          ORDER BY total_services DESC
          LIMIT 10
        `);
      } catch (err) {
        hospitals = [];
      }

      let activeHospitals = 0;
      let totalPrograms = 0;
      let openTickets = 0;
      try {
        const [activeHospitalsRow] = await query(
          `SELECT COUNT(*) as count FROM hospital_onboarding WHERE status = 'APPROVED'`
        );
        activeHospitals = activeHospitalsRow?.count || 0;
      } catch (err) {
        activeHospitals = 0;
      }
      try {
        const [totalProgramsRow] = await query(
          `SELECT COUNT(*) as count FROM csr_programs`
        );
        totalPrograms = totalProgramsRow?.count || 0;
      } catch (err) {
        totalPrograms = 0;
      }
      try {
        const [openTicketsRow] = await query(
          `SELECT COUNT(*) as count FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')`
        );
        openTickets = openTicketsRow?.count || 0;
      } catch (err) {
        openTickets = 0;
      }

      let doctorRatings = [];
      let recentDoctorReviews = [];
      try {
        const reviewRows = await query(
          `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'doctor_review' ORDER BY created_at DESC`
        );
        const reviews = reviewRows
          .map((row) => {
            const data = parseJson(row.data, {});
            const ratingValue = Number(data.rating);
            if (!data.doctorId || !Number.isFinite(ratingValue)) return null;
            return {
              id: row.id,
              doctorId: data.doctorId,
              doctorName: data.doctorName || null,
              rating: ratingValue,
              reviewText: data.reviewText || null,
              appointmentId: data.appointmentId || null,
              userId: row.user_id || data.userId || null,
              createdAt: data.createdAt || row.created_at || null
            };
          })
          .filter(Boolean);

        const reviewerIds = Array.from(new Set(reviews.map((review) => review.userId).filter(Boolean)));
        const reviewerMap = await getUsersByIds(reviewerIds);
        reviews.forEach((review) => {
          const reviewer = reviewerMap.get(review.userId) || {};
          review.reviewerName = reviewer.full_name || reviewer.email || reviewer.phone || 'User';
        });

        recentDoctorReviews = reviews.slice(0, 6);

        const ratingMap = new Map();
        reviews.forEach((review) => {
          const existing = ratingMap.get(review.doctorId) || {
            total: 0,
            count: 0,
            doctorName: review.doctorName || null
          };
          existing.total += review.rating;
          existing.count += 1;
          if (!existing.doctorName && review.doctorName) {
            existing.doctorName = review.doctorName;
          }
          ratingMap.set(review.doctorId, existing);
        });

        doctorRatings = Array.from(ratingMap.entries())
          .map(([doctorId, stats]) => ({
            doctorId,
            doctorName: stats.doctorName || 'Doctor',
            averageRating: Number((stats.total / stats.count).toFixed(1)),
            reviewCount: stats.count
          }))
          .sort((a, b) => b.averageRating - a.averageRating)
          .slice(0, 6);
      } catch (err) {
        doctorRatings = [];
        recentDoctorReviews = [];
      }

      res.json({
        stats: {
          active_cards: dashboardData.active_cards || 0,
          pending_hospitals: dashboardData.pending_hospitals || 0,
          active_programs: dashboardData.active_csr_programs || 0,
          urgent_tickets: dashboardData.urgent_tickets || 0,
          new_hospitals_month: dashboardData.new_hospitals_month || 0,
          active_hospitals: activeHospitals,
          total_programs: totalPrograms,
          open_tickets: openTickets
        },
        cardBatches,
        hospitals,
        doctorRatings,
        recentDoctorReviews
      });
    } catch (err) {
      next(err);
    }
  });

  // Create card batch
  router.post('/operations/card-batches', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { batchNumber, cardType, quantity, expiryDate } = req.body;

      const batchId = uuidv4();
      await query(
        `INSERT INTO card_batches (id, batch_number, card_type, quantity, status, expiry_date, created_by)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
        [batchId, batchNumber, cardType, quantity, expiryDate, req.user.sub]
      );

      // Log admin action
      await query(
        `INSERT INTO admin_actions (id, admin_user_id, admin_role, action_type, action_category, entity_type, entity_id, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user.sub,
          'ops_admin',
          'CARD_BATCH_CREATE',
          'OPERATIONS',
          'card_batch',
          batchId,
          `Created card batch ${batchNumber} with ${quantity} cards`
        ]
      );

      res.json({ success: true, batchId });
    } catch (err) {
      next(err);
    }
  });

  // Activate card batch
  router.patch('/operations/card-batches/:batchId/activate', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { batchId } = req.params;

      await query(
        `UPDATE card_batches SET status = 'ACTIVE', activation_date = NOW() WHERE id = ?`,
        [batchId]
      );

      // Log admin action
      await query(
        `INSERT INTO admin_actions (id, admin_user_id, admin_role, action_type, action_category, entity_type, entity_id, description, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user.sub,
          'ops_admin',
          'CARD_BATCH_ACTIVATE',
          'OPERATIONS',
          'card_batch',
          batchId,
          'Activated card batch',
          'INFO'
        ]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get card batches
  router.get('/operations/card-batches', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const batches = await query(`
        SELECT * FROM card_batches
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json({ batches });
    } catch (err) {
      next(err);
    }
  });

  // Create hospital onboarding request
  router.post('/operations/hospitals', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const {
        hospitalName, hospitalType, contactPerson, contactEmail, contactPhone,
        address, city, district, bedCapacity, licenseNumber
      } = req.body;

      const hospitalId = uuidv4();
      await query(
        `INSERT INTO hospital_onboarding (id, hospital_name, hospital_type, contact_person, contact_email, contact_phone, address, city, district, bed_capacity, license_number, submitted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hospitalId, hospitalName, hospitalType, contactPerson, contactEmail, contactPhone, address, city, district, bedCapacity, licenseNumber, req.user.sub]
      );

      // Notify medical admin
      const { options: medicalRoleOptions, placeholders: medicalRolePlaceholders } = getRolePlaceholders('medical_admin');
      await query(
        `INSERT INTO admin_notifications (id, sender_user_id, recipient_user_id, notification_type, priority, title, message, action_required, action_type, related_entity_type, related_entity_id)
         SELECT ?, ?, id, 'HOSPITAL_ONBOARDING', 'MEDIUM', ?, ?, TRUE, 'REVIEW', 'hospital_onboarding', ?
         FROM users WHERE role IN (${medicalRolePlaceholders}) LIMIT 1`,
        [
          uuidv4(),
          req.user.sub,
          'New Hospital Onboarding Request',
          `Hospital "${hospitalName}" submitted for approval`,
          hospitalId,
          ...medicalRoleOptions
        ]
      );

      res.json({ success: true, hospitalId });
    } catch (err) {
      next(err);
    }
  });

  // Get pending hospital onboarding
  router.get('/operations/hospitals/pending', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const hospitals = await query(`
        SELECT * FROM hospital_onboarding
        WHERE status = 'PENDING'
        ORDER BY created_at DESC
      `);

      res.json({ hospitals });
    } catch (err) {
      next(err);
    }
  });

  // Get hospitals (all or filtered by status)
  router.get('/operations/hospitals', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { status } = req.query;
      const params = [];
      let whereClause = '1=1';

      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      const hospitals = await query(
        `SELECT * FROM hospital_onboarding WHERE ${whereClause} ORDER BY created_at DESC`,
        params
      );

      res.json({ hospitals });
    } catch (err) {
      next(err);
    }
  });

  // Update hospital onboarding request
  router.patch('/operations/hospitals/:hospitalId', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { hospitalId } = req.params;
      const updates = [];
      const params = [];

      const fields = [
        'hospital_name', 'hospital_type', 'contact_person', 'contact_email', 'contact_phone',
        'address', 'city', 'district', 'bed_capacity', 'license_number', 'status'
      ];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      params.push(hospitalId);
      await query(
        `UPDATE hospital_onboarding SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Delete hospital onboarding request
  router.delete('/operations/hospitals/:hospitalId', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { hospitalId } = req.params;
      await query('DELETE FROM hospital_onboarding WHERE id = ?', [hospitalId]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Approve hospital
  router.patch('/operations/hospitals/:hospitalId/approve', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { hospitalId } = req.params;
      const { reviewNotes } = req.body;

      await query(
        `UPDATE hospital_onboarding SET status = 'APPROVED', reviewed_by = ?, review_notes = ?, updated_at = NOW() WHERE id = ?`,
        [req.user.sub, reviewNotes, hospitalId]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Create CSR program
  router.post('/operations/csr-programs', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const {
        programName, sponsorName, sponsorContact, programType, budget,
        targetBeneficiaries, startDate, endDate, description
      } = req.body;

      const programId = uuidv4();
      await query(
        `INSERT INTO csr_programs (id, program_name, sponsor_name, sponsor_contact, program_type, budget, target_beneficiaries, start_date, end_date, description, managed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [programId, programName, sponsorName, sponsorContact, programType, budget, targetBeneficiaries, startDate, endDate, description, req.user.sub]
      );

      res.json({ success: true, programId });
    } catch (err) {
      next(err);
    }
  });

  // Update CSR program
  router.patch('/operations/csr-programs/:programId', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { programId } = req.params;
      const updates = [];
      const params = [];

      const fields = [
        'program_name', 'sponsor_name', 'sponsor_contact', 'program_type', 'budget',
        'target_beneficiaries', 'start_date', 'end_date', 'description', 'status'
      ];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      params.push(programId);
      await query(
        `UPDATE csr_programs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`,
        params
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Delete CSR program
  router.delete('/operations/csr-programs/:programId', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { programId } = req.params;
      await query('DELETE FROM csr_programs WHERE id = ?', [programId]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get CSR programs
  router.get('/operations/csr-programs', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const programs = await query(`
        SELECT * FROM csr_programs
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json({ programs });
    } catch (err) {
      next(err);
    }
  });

  // Create support ticket
  router.post('/operations/support-tickets', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { userId, userName, userPhone, category, priority, subject, description } = req.body;

      const ticketId = uuidv4();
      const ticketNumber = `TKT-${Date.now()}`;

      await query(
        `INSERT INTO support_tickets (id, ticket_number, user_id, user_name, user_phone, category, priority, subject, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ticketId, ticketNumber, userId, userName, userPhone, category, priority, subject, description]
      );

      res.json({ success: true, ticketId, ticketNumber });
    } catch (err) {
      next(err);
    }
  });

  // Get support tickets
  router.get('/operations/support-tickets', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const status = req.query.status || '';
      const priority = req.query.priority || '';

      let whereClause = '1=1';
      const params = [];

      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      const tickets = await query(
        `SELECT * FROM support_tickets
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT 100`,
        params
      );

      res.json({ tickets });
    } catch (err) {
      next(err);
    }
  });

  // Update support ticket status
  router.patch('/operations/support-tickets/:ticketId', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { ticketId } = req.params;
      const { status, resolutionNotes } = req.body;

      const updates = ['status = ?', 'updated_at = NOW()'];
      const params = [status];

      if (status === 'RESOLVED' || status === 'CLOSED') {
        updates.push('resolved_by = ?', 'resolved_at = NOW()');
        params.push(req.user.sub);

        if (resolutionNotes) {
          updates.push('resolution_notes = ?');
          params.push(resolutionNotes);
        }
      }

      params.push(ticketId);

      await query(
        `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get community posts for moderation
  router.get('/operations/community/posts', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { status = 'pending', page = 1, limit = 20 } = req.query;

      const postsRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities 
         WHERE type = 'community_post' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10)]
      );

      const posts = await Promise.all(postsRows.map(async (row) => {
        try {
          const postData = JSON.parse(row.data);

          const profileRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [row.user_id]
          );

          let userName = 'Anonymous';
          if (profileRows.length > 0) {
            const profile = JSON.parse(profileRows[0].data);
            userName = profile.name || 'Anonymous';
          }

          return {
            id: row.id,
            userId: row.user_id,
            userName,
            content: postData.content,
            tags: postData.tags || [],
            moderation: postData.moderation || 'pending',
            flagCount: postData.flagCount || 0,
            createdAt: row.created_at
          };
        } catch (e) {
          return null;
        }
      }));

      const filteredPosts = status !== 'all'
        ? posts.filter(p => p && p.moderation === status)
        : posts.filter(p => p !== null);

      res.json({ items: filteredPosts });
    } catch (err) {
      next(err);
    }
  });

  // Approve community post
  router.post('/operations/community/posts/:postId/approve', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { postId } = req.params;

      await query(
        `UPDATE app_entities SET data = JSON_SET(data, '$.moderation', 'approved', '$.moderatedBy', ?, '$.moderatedAt', ?) 
         WHERE id = ? AND type = 'community_post'`,
        [req.user.sub, new Date().toISOString(), postId]
      );

      res.json({ success: true, message: 'Post approved' });
    } catch (err) {
      next(err);
    }
  });

  // Reject/Remove community post
  router.post('/operations/community/posts/:postId/reject', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { reason } = req.body;

      await query(
        `UPDATE app_entities SET data = JSON_SET(data, '$.moderation', 'rejected', '$.moderatedBy', ?, '$.moderatedAt', ?, '$.rejectionReason', ?) 
         WHERE id = ? AND type = 'community_post'`,
        [req.user.sub, new Date().toISOString(), reason || 'Policy violation', postId]
      );

      res.json({ success: true, message: 'Post rejected' });
    } catch (err) {
      next(err);
    }
  });

  // Get all blood requests (ops management)
  router.get('/operations/blood-requests', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const requestsRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities 
         WHERE type = 'blood_request' ORDER BY created_at DESC`
      );

      const requests = await Promise.all(requestsRows.map(async (row) => {
        try {
          const requestData = JSON.parse(row.data);

          const profileRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [row.user_id]
          );

          let userName = 'User';
          let userPhone = 'N/A';
          if (profileRows.length > 0) {
            const profile = JSON.parse(profileRows[0].data);
            userName = profile.name || 'User';
            userPhone = profile.phone || 'N/A';
          }

          return {
            id: row.id,
            userId: row.user_id,
            userName,
            userPhone,
            bloodType: requestData.bloodType || requestData.bloodGroup || 'N/A',
            units: requestData.units ?? (requestData.donorId ? 1 : null),
            urgency: requestData.urgency || (requestData.donorId ? 'High' : 'N/A'),
            hospital: requestData.hospital || (requestData.donorId ? 'Direct Donor Request' : ''),
            requestType: requestData.donorId ? 'donor_message' : 'general_request',
            status: requestData.status || 'Active',
            createdAt: row.created_at
          };
        } catch (e) {
          return null;
        }
      }));

      res.json({ items: requests.filter(r => r !== null) });
    } catch (err) {
      next(err);
    }
  });

  // System-wide announcements (Operations)
  router.post('/operations/announcements', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { title, message, targetRole, priority } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'title and message are required' });
      }

      const normalizedTargetRole = targetRole ? normalizeRoleValue(targetRole) : null;
      if (targetRole && targetRole !== 'all' && (!normalizedTargetRole || !CANONICAL_ROLES.has(normalizedTargetRole))) {
        return res.status(400).json({ error: 'Invalid target role' });
      }

      const effectiveTargetRole = targetRole
        ? (targetRole === 'all' ? 'all' : normalizedTargetRole)
        : 'all';

      const announcement = await createEntity({
        type: 'system_announcement',
        userId: req.user.sub,
        data: {
          title,
          message,
          targetRole: effectiveTargetRole || 'all',
          priority: priority || 'normal',
          createdBy: req.user.sub,
          createdAt: new Date().toISOString(),
          active: true
        }
      });

      const targetRoles = effectiveTargetRole === 'all'
        ? ['mother', 'doctor', 'pharmacist', 'nutritionist']
        : [effectiveTargetRole];

      for (const role of targetRoles) {
        const { options: roleOptions, placeholders: rolePlaceholders } = getRolePlaceholders(role);
        const usersResult = await query(
          `SELECT id FROM users WHERE role IN (${rolePlaceholders}) LIMIT 1000`,
          roleOptions
        );

        for (const user of usersResult) {
          await createNotification(user.id, {
            type: 'SYSTEM_ANNOUNCEMENT',
            entityId: announcement.id,
            title,
            message,
            link: '/announcements'
          });
        }
      }

      res.status(201).json({ success: true, announcement });
    } catch (err) {
      next(err);
    }
  });

  router.get('/operations/announcements', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const announcementsRows = await query(
        `SELECT id, data, created_at FROM app_entities 
         WHERE type = 'system_announcement' ORDER BY created_at DESC`
      );

      const announcements = announcementsRows.map(row => {
        try {
          return {
            id: row.id,
            ...JSON.parse(row.data),
            timestamp: row.created_at
          };
        } catch (e) {
          return null;
        }
      }).filter(a => a !== null);

      res.json({ items: announcements });
    } catch (err) {
      next(err);
    }
  });

  // Get pharmacist verification requests (Ops Admin)
  router.get('/operations/pharmacists/pending', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const pendingRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities 
         WHERE type = 'pharmacist_verification' ORDER BY created_at DESC`
      );

      const verifications = await Promise.all(pendingRows.map(async (row) => {
        try {
          const data = JSON.parse(row.data);

          const userRows = await query(
            `SELECT email, phone FROM users WHERE id = ? LIMIT 1`,
            [row.user_id]
          );

          return {
            id: row.id,
            pharmacistId: row.user_id,
            pharmacyName: data.pharmacyName,
            ownerName: data.ownerName || 'N/A',
            email: userRows[0]?.email || 'N/A',
            phone: data.phone || userRows[0]?.phone || 'N/A',
            licenseNumber: data.licenseNumber,
            address: data.address || 'N/A',
            documents: data.documents || [],
            status: data.status || 'pending',
            submittedAt: row.created_at
          };
        } catch (e) {
          return null;
        }
      }));

      res.json({ items: verifications.filter(v => v !== null) });
    } catch (err) {
      next(err);
    }
  });

  // Approve pharmacist verification
  router.post('/operations/pharmacists/:pharmacistId/approve', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { pharmacistId } = req.params;
      const { notes } = req.body;

      const verificationRows = await query(
        `SELECT id, data FROM app_entities 
         WHERE type = 'pharmacist_verification' AND user_id = ? LIMIT 1`,
        [pharmacistId]
      );

      if (verificationRows.length === 0) {
        return res.status(404).json({ error: 'Verification request not found' });
      }

      await query(
        `UPDATE app_entities SET data = JSON_SET(data, '$.status', 'approved', '$.approvedBy', ?, '$.approvedAt', ?, '$.notes', ?) 
         WHERE id = ?`,
        [req.user.sub, new Date().toISOString(), notes || '', verificationRows[0].id]
      );

      await query(
        `UPDATE app_entities SET data = JSON_SET(data, '$.verificationStatus', 'Verified', '$.verifiedAt', ?) 
         WHERE type = 'user_profile' AND user_id = ?`,
        [new Date().toISOString(), pharmacistId]
      );

      await createEntity({
        type: 'audit_log',
        userId: req.user.sub,
        data: {
          action: 'PHARMACIST_VERIFIED',
          targetUserId: pharmacistId,
          notes,
          timestamp: new Date().toISOString()
        }
      });

      await createNotification(pharmacistId, {
        type: 'VERIFICATION_APPROVED',
        entityId: verificationRows[0].id,
        title: 'Pharmacy Verification Approved',
        message: 'Your pharmacy verification has been approved. You can now receive orders.',
        link: '/pharmacy/dashboard'
      });

      res.json({ success: true, message: 'Pharmacist verified successfully' });
    } catch (err) {
      next(err);
    }
  });

  // Reject pharmacist verification
  router.post('/operations/pharmacists/:pharmacistId/reject', requireAuth, requireRole(['ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { pharmacistId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }

      const verificationRows = await query(
        `SELECT id FROM app_entities 
         WHERE type = 'pharmacist_verification' AND user_id = ? LIMIT 1`,
        [pharmacistId]
      );

      if (verificationRows.length === 0) {
        return res.status(404).json({ error: 'Verification request not found' });
      }

      await query(
        `UPDATE app_entities SET data = JSON_SET(data, '$.status', 'rejected', '$.rejectedBy', ?, '$.rejectedAt', ?, '$.reason', ?) 
         WHERE id = ?`,
        [req.user.sub, new Date().toISOString(), reason, verificationRows[0].id]
      );

      await createEntity({
        type: 'audit_log',
        userId: req.user.sub,
        data: {
          action: 'PHARMACIST_VERIFICATION_REJECTED',
          targetUserId: pharmacistId,
          reason,
          timestamp: new Date().toISOString()
        }
      });

      await createNotification(pharmacistId, {
        type: 'VERIFICATION_REJECTED',
        entityId: verificationRows[0].id,
        title: 'Pharmacy Verification Rejected',
        message: `Your verification was rejected. Reason: ${reason}`,
        link: '/pharmacy/verification'
      });

      res.json({ success: true, message: 'Pharmacist verification rejected' });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // MEDICAL ADMIN ROUTES
  // ============================================================================


  return router;
}
