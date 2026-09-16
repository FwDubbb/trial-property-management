import type { CookieOptions, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { cookieName, readSessionToken } from '../middleware/auth.js';
import { login, register, sessionLifetimeMs, tokenHash } from '../services/authService.js';
import { loginSchema, registerSchema } from '../validation/auth.js';

export function createAuthController(database: Pool, production: boolean) {
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: production,
    path: '/api',
  };
  const registerAccount: RequestHandler = async (request, response) => {
    const input = registerSchema.parse(request.body);
    const { user, token } = await register(database, input, readSessionToken(request));
    response.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionLifetimeMs });
    response.status(201).json({ user });
  };
  const signIn: RequestHandler = async (request, response) => {
    const input = loginSchema.parse(request.body);
    const { user, token } = await login(
      database,
      input.email,
      input.password,
      readSessionToken(request),
    );
    response.cookie(cookieName, token, { ...cookieOptions, maxAge: sessionLifetimeMs });
    response.json({ user });
  };
  const signOut: RequestHandler = async (request, response) => {
    const token = readSessionToken(request);
    if (token)
      await database.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
    response.clearCookie(cookieName, cookieOptions);
    response.status(204).end();
  };
  const me: RequestHandler = (request, response) => {
    response.json({ user: request.user });
  };
  return { registerAccount, signIn, signOut, me };
}
