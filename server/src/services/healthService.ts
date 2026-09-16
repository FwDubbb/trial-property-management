import { pool } from '../database/pool.js';

export async function checkDatabase(): Promise<void> {
  await pool.query('SELECT 1 AS connected');
}
