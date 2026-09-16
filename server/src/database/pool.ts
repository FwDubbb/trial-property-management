import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  query_timeout: 3000,
  statement_timeout: 3000,
});

pool.on('error', () => {
  console.error('An idle PostgreSQL connection failed. Check database availability.');
});
