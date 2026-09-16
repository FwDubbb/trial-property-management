import { Router } from 'express';
import type { Pool } from 'pg';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createPropertyController } from '../controllers/propertyController.js';
import { createUnitController } from '../controllers/unitController.js';

export function createPortfolioRouter(database: Pool) {
  const router = Router();
  router.use(requireAuth(database), requireRole('OWNER', 'MANAGER'));
  const properties = createPropertyController(database);
  router.get('/properties', properties.list);
  router.get('/properties/summary', properties.summary);
  router.get('/properties/options', properties.options);
  router.get('/properties/:id', properties.get);
  router.post('/properties', properties.create);
  router.put('/properties/:id', properties.update);
  router.patch('/properties/:id/status', properties.status);
  const units = createUnitController(database);
  router.get('/units', units.list);
  router.get('/units/:id', units.get);
  router.post('/units', units.create);
  router.put('/units/:id', units.update);
  return router;
}
