import express from 'express';
import { sendEmergencyNotifications } from '../services/emergencyNotificationService.js';

/**
 * Creates the Emergency Router
 * @param {object} deps - Router dependencies
 * @param {Function} deps.requireAuth - Authentication middleware
 * @returns {express.Router} Express Router instance
 */
export function createEmergencyRouter(deps = {}) {
  const requireAuth = deps.requireAuth || ((req, res, next) => next());
  const router = express.Router();

  router.post('/emergency/trigger', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const { message, location } = req.body || {};
      
      const result = await sendEmergencyNotifications(userId, { message, location });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
