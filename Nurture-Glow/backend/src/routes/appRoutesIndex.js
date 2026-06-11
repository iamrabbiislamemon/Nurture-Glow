import express from 'express';
import { createAppointmentsRouter } from './appointments.js';
import { createVaccinesRouter } from './vaccines.js';
import { createDoctorsRouter } from './doctors.js';
import { createPharmacyRouter } from './pharmacy.js';
import { createMerchandiserRouter } from './merchandiser.js';
import { createNutritionistRouter } from './nutritionist.js';
import { createCommunityRouter } from './community.js';
import { createJournalRouter } from './journal.js';
import { createNotificationsRouter } from './notifications.js';
import { createBloodRouter } from './blood.js';
import { createCatalogRouter } from './catalog.js';
import { createOrdersRouter } from './orders.js';
import { createAiRouter } from './ai.js';
import { createConsentRouter } from './consent.js';
import { createPrescriptionsRouter } from './prescriptions.js';
import { createEmergencyRouter } from './emergency.js';
import { createAmbulanceRouter } from './ambulance.js';
import mcpRouter from './mcp.js';

export function createAppRouter(deps) {
  const router = express.Router();

  // Mount all extracted sub-routers
  router.use('/', createAppointmentsRouter(deps));
  router.use('/', createVaccinesRouter(deps));
  router.use('/', createDoctorsRouter(deps));
  router.use('/', createPharmacyRouter(deps));
  router.use('/', createMerchandiserRouter(deps));
  router.use('/', createNutritionistRouter(deps));
  router.use('/', createCommunityRouter(deps));
  router.use('/', createJournalRouter(deps));
  router.use('/', createNotificationsRouter(deps));
  router.use('/', createBloodRouter(deps));
  router.use('/', createCatalogRouter(deps));
  router.use('/', createOrdersRouter(deps));
  router.use('/', createAiRouter(deps));
  router.use('/', createConsentRouter(deps));
  router.use('/', createPrescriptionsRouter(deps));
  router.use('/', createEmergencyRouter(deps));
  router.use('/', createAmbulanceRouter(deps));
  router.use('/mcp', mcpRouter);

  return router;
}
