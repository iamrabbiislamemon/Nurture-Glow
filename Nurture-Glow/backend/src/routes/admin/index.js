import express from 'express';
import { createSystemAdminRouter } from './system.js';
import { createOperationsAdminRouter } from './operations.js';
import { createMedicalAdminRouter } from './medical.js';
import { createNotificationsAdminRouter } from './notifications.js';
import { createAnalyticsAdminRouter } from './analytics.js';
import { createTablesAdminRouter } from './tables.js';

export function createAdminRouter(deps) {
  const router = express.Router();

  // Mount admin sub-routers
  router.use('/system', createSystemAdminRouter(deps));
  router.use('/operations', createOperationsAdminRouter(deps));
  router.use('/medical', createMedicalAdminRouter(deps));
  router.use('/', createNotificationsAdminRouter(deps));
  router.use('/', createAnalyticsAdminRouter(deps));
  router.use('/tables', createTablesAdminRouter(deps));

  return router;
}
export { createTablesAdminRouter };
