import { Router } from 'express';
import { createDatabaseHealth, getTest } from '../controllers/healthController.js';

export function createHealthRouter(checkDatabase: () => Promise<void>) {
  const router = Router();
  router.get('/test', getTest);
  router.get('/health/database', createDatabaseHealth(checkDatabase));
  return router;
}
