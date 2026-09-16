import type { RequestHandler } from 'express';

export const getTest: RequestHandler = (_request, response) => {
  response.json({
    status: 'ok',
    message: 'The frontend is successfully connected to the Express API.',
    timestamp: new Date().toISOString(),
  });
};

export function createDatabaseHealth(checkDatabase: () => Promise<void>): RequestHandler {
  return async (_request, response) => {
    try {
      await checkDatabase();
      response.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch {
      response.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message:
            'Cannot connect to PostgreSQL. Check DATABASE_URL in server/.env and ensure PostgreSQL is running.',
        },
      });
    }
  };
}
