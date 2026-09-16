import { pool } from './pool.js';
import { checkDatabase } from '../services/healthService.js';

try {
  await checkDatabase();
  console.log('PostgreSQL connection successful (SELECT 1).');
} catch {
  console.error(
    'Cannot connect to PostgreSQL. Check DATABASE_URL in server/.env and ensure PostgreSQL is running.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
