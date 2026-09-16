import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { env } from '../../src/config/env.js';
import { migrate } from '../../src/database/migrations.js';

export async function createTestDatabase() {
  const schema = `test_${randomBytes(12).toString('hex')}`;
  const admin = new pg.Pool({ connectionString: env.databaseUrl });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  // Every integration test file owns a randomly named schema; application data is untouched.
  const database = new pg.Pool({
    connectionString: env.databaseUrl,
    options: `-c search_path=${schema}`,
  });
  const cleanup = async () => {
    await database.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  };
  try {
    await migrate(database);
  } catch (error) {
    await cleanup();
    throw error;
  }
  return { database, cleanup };
}
