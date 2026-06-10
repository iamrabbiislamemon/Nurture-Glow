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

export function createAnalyticsAdminRouter({ requireAuth, requireRole }) {
  const router = express.Router();

  const toCsvValue = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getRolePlaceholders = (roleInput) => {
    const options = getRoleFilterOptions(roleInput);
    const placeholders = options.map(() => '?').join(', ');
    return { options, placeholders };
  };

  router.get('/stats/overview', requireAuth, requireRole(['system_admin', 'ops_admin', 'medical_admin']), async (req, res, next) => {
    try {
      const { options: doctorRoleOptions, placeholders: doctorRolePlaceholders } = getRolePlaceholders('doctor');
      const { options: patientRoleOptions, placeholders: patientRolePlaceholders } = getRolePlaceholders('mother');
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
          (SELECT COUNT(*) FROM users WHERE role IN (${doctorRolePlaceholders})) as total_doctors,
          (SELECT COUNT(*) FROM users WHERE role IN (${patientRolePlaceholders})) as total_patients,
          (SELECT COUNT(*) FROM hospitals) as total_hospitals,
          (SELECT COUNT(*) FROM user_cards WHERE status = 'ACTIVE') as active_cards,
          (SELECT COUNT(*) FROM high_risk_cases WHERE status = 'ACTIVE') as active_high_risk_cases
      `, [...doctorRoleOptions, ...patientRoleOptions]);

      res.json({ stats: stats[0] || {} });
    } catch (err) {
      next(err);
    }
  });

  router.get('/analytics', requireAuth, requireRole(['medical_admin', 'ops_admin', 'system_admin']), async (req, res, next) => {
    try {
      const { dateFrom, dateTo } = req.query;

      const userGrowthResult = await query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM users 
         ${dateFrom ? 'WHERE created_at >= ?' : ''}
         ${dateTo ? (dateFrom ? 'AND' : 'WHERE') + ' created_at <= ?' : ''}
         GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
        [dateFrom, dateTo].filter(Boolean)
      );

      const appointmentTrendsResult = await query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM app_entities WHERE type = 'appointment'
         ${dateFrom ? 'AND created_at >= ?' : ''}
         ${dateTo ? (dateFrom ? 'AND' : 'WHERE') + ' created_at <= ?' : ''}
         GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
        [dateFrom, dateTo].filter(Boolean)
      );

      const orderTrendsResult = await query(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM app_entities WHERE type = 'order'
         ${dateFrom ? 'AND created_at >= ?' : ''}
         ${dateTo ? (dateFrom ? 'AND' : 'WHERE') + ' created_at <= ?' : ''}
         GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30`,
        [dateFrom, dateTo].filter(Boolean)
      );

      const roleDistributionResult = await query(
        `SELECT role, COUNT(*) as count FROM users GROUP BY role`
      );

      res.json({
        userGrowth: userGrowthResult,
        appointmentTrends: appointmentTrendsResult,
        orderTrends: orderTrendsResult,
        roleDistribution: roleDistributionResult
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/export/:dataType', requireAuth, requireRole(['system_admin']), async (req, res, next) => {
    try {
      const { dataType } = req.params;
      const { format = 'json' } = req.query;

      let data = [];
      let filename = 'export';

      switch (dataType) {
        case 'users': {
          const usersRows = await query(`SELECT id, email, phone, role, created_at FROM users`);
          data = usersRows;
          filename = 'users-export';
          break;
        }
        case 'appointments': {
          const appointmentsRows = await query(
            `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment'`
          );
          data = appointmentsRows.map(row => ({
            id: row.id,
            userId: row.user_id,
            ...parseJson(row.data, {}),
            createdAt: row.created_at
          }));
          filename = 'appointments-export';
          break;
        }
        case 'orders': {
          const ordersRows = await query(
            `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'order'`
          );
          data = ordersRows.map(row => ({
            id: row.id,
            userId: row.user_id,
            ...parseJson(row.data, {}),
            createdAt: row.created_at
          }));
          filename = 'orders-export';
          break;
        }
        default:
          return res.status(400).json({ error: 'Invalid data type' });
      }

      if (format === 'csv') {
        const headers = Object.keys(data[0] || {});
        const csvRows = [headers.join(',')];

        data.forEach(item => {
          const values = headers.map(header => {
            const value = item[header];
            return typeof value === 'object' ? JSON.stringify(value).replace(/\"/g, '\"\"') : value;
          });
          csvRows.push(values.join(','));
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
        res.send(csvRows.join('\n'));
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.json`);
        res.json(data);
      }
    } catch (err) {
      next(err);
    }
  });

  router.post('/bulk-delete', requireAuth, requireRole(['system_admin']), async (req, res, next) => {
    try {
      const { entityType, entityIds } = req.body;

      if (!entityType || !Array.isArray(entityIds) || entityIds.length === 0) {
        return res.status(400).json({ error: 'entityType and entityIds array are required' });
      }

      const allowedTypes = ['notification', 'journal_entry', 'audit_log', 'community_post'];
      if (!allowedTypes.includes(entityType)) {
        return res.status(403).json({ error: 'Bulk deletion not allowed for this entity type' });
      }

      const placeholders = entityIds.map(() => '?').join(',');
      const result = await query(
        `DELETE FROM app_entities WHERE type = ? AND id IN (${placeholders})`,
        [entityType, ...entityIds]
      );

      await createEntity({
        type: 'audit_log',
        userId: req.user.sub,
        data: {
          action: 'BULK_DELETE',
          entityType,
          count: entityIds.length,
          timestamp: new Date().toISOString()
        }
      });

      res.json({ 
        success: true, 
        deleted: result.affectedRows || 0,
        message: `Deleted ${result.affectedRows || 0} ${entityType} records`
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
