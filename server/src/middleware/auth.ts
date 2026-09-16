import type { Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { getSessionUser } from '../services/authService.js';
import type { Role } from '../types/auth.js';
import { ApiError } from '../utils/ApiError.js';

export const cookieName = 'property_session';
export function readSessionToken(request: Request) {
  return request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

export function requireAuth(database: Pool): RequestHandler {
  return async (request, _response, next) => {
    const token = readSessionToken(request);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    const user = await getSessionUser(database, token);
    if (!user)
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
    request.user = user;
    next();
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user || !roles.includes(request.user.role))
      throw new ApiError(403, 'FORBIDDEN', 'Your role does not have permission for this action.');
    next();
  };
}
