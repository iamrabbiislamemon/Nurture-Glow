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

export function createNotificationsAdminRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  router.get('/notifications', requireAuth, async (req, res, next) => {
    try {
      const notifications = await query(`
        SELECT an.*, sender.email as sender_email
        FROM admin_notifications an
        LEFT JOIN users sender ON an.sender_user_id = sender.id
        WHERE an.recipient_user_id = ?
        ORDER BY an.created_at DESC
        LIMIT 50
      `, [req.user.sub]);

      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  });

  // Mark notification as read
  router.patch('/notifications/:notificationId/read', requireAuth, async (req, res, next) => {
    try {
      const { notificationId } = req.params;

      await query(
        'UPDATE admin_notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND recipient_user_id = ?',
        [notificationId, req.user.sub]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get admin actions log
  router.get('/actions', requireAuth, requireRole(['system_admin', 'ops_admin', 'medical_admin']), async (req, res, next) => {
    try {
      const adminRole = req.query.role || '';
      const category = req.query.category || '';
      const limit = parseInt(req.query.limit) || 50;

      let whereClause = '1=1';
      const params = [];

      const adminRoleValue = String(adminRole || '').trim();
      if (adminRoleValue && adminRoleValue.toLowerCase() !== 'all') {
        const options = getRoleFilterOptionsFromInput(adminRoleValue);
        if (!options.length) {
          return res.status(400).json({ error: 'Invalid role filter' });
        }
        const placeholders = options.map(() => '?').join(', ');
        whereClause += ` AND aa.admin_role IN (${placeholders})`;
        params.push(...options);
      }

      if (category) {
        whereClause += ' AND aa.action_category = ?';
        params.push(category);
      }

      params.push(limit);

      const actions = await query(`
        SELECT aa.*, u.email as admin_email
        FROM admin_actions aa
        JOIN users u ON aa.admin_user_id = u.id
        WHERE ${whereClause}
        ORDER BY aa.created_at DESC
        LIMIT ?
      `, params);

      res.json({ actions });
    } catch (err) {
      next(err);
    }
  });

  // Create admin-to-admin interaction
  router.post('/interactions', requireAuth, requireRole(['system_admin', 'ops_admin', 'medical_admin']), async (req, res, next) => {
    try {
      const { targetUserId, interactionType, subject, description, entityType, entityId } = req.body;

      // Get target user role
      const [targetUser] = await query('SELECT role FROM users WHERE id = ?', [targetUserId]);

      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      const interactionId = uuidv4();
      const initiatorRole = normalizeRoleValue(req.userRole || req.user?.role) || null;
      const targetRole = normalizeRoleValue(targetUser.role) || targetUser.role;

      await query(
        `INSERT INTO admin_interactions (id, initiator_user_id, initiator_role, target_user_id, target_role, interaction_type, subject, description, entity_type, entity_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [interactionId, req.user.sub, initiatorRole, targetUserId, targetRole, interactionType, subject, description, entityType, entityId]
      );

      // Create notification for target admin
      await query(
        `INSERT INTO admin_notifications (id, sender_user_id, recipient_user_id, notification_type, priority, title, message, action_required, action_type, related_entity_type, related_entity_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?)`,
        [uuidv4(), req.user.sub, targetUserId, interactionType, 'HIGH', subject, description, interactionType, entityType, interactionId]
      );

      res.json({ success: true, interactionId });
    } catch (err) {
      next(err);
    }
  });

  // Get admin interactions
  router.get('/interactions', requireAuth, requireRole(['system_admin', 'ops_admin', 'medical_admin']), async (req, res, next) => {
    try {
      const interactions = await query(`
        SELECT ai.*, 
               initiator.email as initiator_email,
               target.email as target_email
        FROM admin_interactions ai
        JOIN users initiator ON ai.initiator_user_id = initiator.id
        JOIN users target ON ai.target_user_id = target.id
        WHERE ai.initiator_user_id = ? OR ai.target_user_id = ?
        ORDER BY ai.created_at DESC
        LIMIT 50
      `, [req.user.sub, req.user.sub]);

      res.json({ interactions });
    } catch (err) {
      next(err);
    }
  });

  // Respond to admin interaction
  router.patch('/interactions/:interactionId/respond', requireAuth, requireRole(['system_admin', 'ops_admin', 'medical_admin']), async (req, res, next) => {
    try {
      const { interactionId } = req.params;
      const { status, response } = req.body;

      await query(
        'UPDATE admin_interactions SET status = ?, response = ?, responded_at = NOW(), updated_at = NOW() WHERE id = ?',
        [status, response, interactionId]
      );

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });


  return router;
}
