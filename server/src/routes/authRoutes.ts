import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { createAuthController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

export function createAuthRouter(database: Pool, production: boolean) {
  const router = Router();
  const controller = createAuthController(database, production);
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many sign-in attempts. Please try again in 15 minutes.',
      },
    },
  });
  router.post('/register', limit, controller.registerAccount);
  router.post('/login', limit, controller.signIn);
  router.post('/logout', controller.signOut);
  router.get('/me', requireAuth(database), controller.me);
  return router;
}
