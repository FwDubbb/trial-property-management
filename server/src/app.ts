import express from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import { createAuthRouter } from './routes/authRoutes.js';
import { protectMutations } from './middleware/csrf.js';
import { createPortfolioRouter } from './routes/portfolioRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createHealthRouter } from './routes/healthRoutes.js';

export function createApp(
  checkDatabase: () => Promise<void>,
  database?: Pool,
  options = {
    production: false,
    allowedOrigins: [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
    ],
  },
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', createHealthRouter(checkDatabase));
  if (database) {
    app.use('/api', protectMutations(options.allowedOrigins));
    app.use('/api/auth', createAuthRouter(database, options.production));
    app.use('/api', createPortfolioRouter(database));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
