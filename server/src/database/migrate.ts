import { pool } from './pool.js';
import { migrate } from './migrations.js';

try {
  await migrate(pool);
  console.log('Database migrations are up to date.');
} catch (error) {
  console.error('Migration failed. Check database availability and migration compatibility.');
  if (error instanceof Error && error.message.startsWith('Applied migration'))
    console.error(error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
