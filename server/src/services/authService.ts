import { createHash, randomBytes } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { z } from 'zod';
import type { AuthUser } from '../types/auth.js';
import type { registerSchema } from '../validation/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../utils/password.js';

export const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const publicColumns = `u.id, u.company_id AS "companyId", c.name AS "companyName", u.name, u.email, u.role`;

async function createSession(client: PoolClient, user: AuthUser, previousToken?: string) {
  const token = randomBytes(32).toString('hex');
  await client.query('DELETE FROM sessions WHERE expires_at <= now()');
  if (previousToken)
    await client.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(previousToken)]);
  await client.query(
    'INSERT INTO sessions(token_hash, company_id, user_id, expires_at) VALUES ($1, $2, $3, $4)',
    [tokenHash(token), user.companyId, user.id, new Date(Date.now() + sessionLifetimeMs)],
  );
  return token;
}

export async function register(
  database: Pool,
  input: z.infer<typeof registerSchema>,
  previousToken?: string,
) {
  const passwordHash = await hashPassword(input.password);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const company = await client.query('INSERT INTO companies(name) VALUES ($1) RETURNING id', [
      input.companyName,
    ]);
    const result = await client.query(
      `INSERT INTO users(company_id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, 'OWNER') RETURNING id, company_id AS "companyId", name, email, role`,
      [company.rows[0].id, input.name, input.email, passwordHash],
    );
    const user: AuthUser = { ...result.rows[0], companyName: input.companyName };
    const token = await createSession(client, user, previousToken);
    await client.query('COMMIT');
    return { user, token };
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505')
      throw new ApiError(
        409,
        'EMAIL_IN_USE',
        'An account with that email already exists. Sign in instead.',
      );
    throw error;
  } finally {
    client.release();
  }
}

export async function login(
  database: Pool,
  email: string,
  password: string,
  previousToken?: string,
) {
  const result = await database.query(
    `SELECT ${publicColumns}, u.password_hash FROM users u
    JOIN companies c ON c.id = u.company_id WHERE u.email = $1`,
    [email],
  );
  const account = result.rows[0];
  const matches = await verifyPassword(password, account?.password_hash ?? dummyPasswordHash);
  if (!account || !matches)
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const { password_hash: _hash, ...user } = account;
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const token = await createSession(client, user, previousToken);
    await client.query('COMMIT');
    return { user: user as AuthUser, token };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getSessionUser(database: Pool, token: string): Promise<AuthUser | undefined> {
  const result = await database.query(
    `SELECT ${publicColumns} FROM sessions s
    JOIN users u ON u.id = s.user_id AND u.company_id = s.company_id
    JOIN companies c ON c.id = u.company_id
    WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)],
  );
  return result.rows[0];
}
