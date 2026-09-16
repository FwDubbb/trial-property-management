import type { RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError.js';

export function protectMutations(allowedOrigins: string[]): RequestHandler {
  return (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    // Cross-origin sites cannot send this header without a CORS preflight, which we do not allow.
    // Explicit origin validation also protects against an untrusted site on another localhost port.
    const origin = request.get('origin');
    if (
      request.get('X-Requested-With') !== 'PropertyPlatform' ||
      (origin && !allowedOrigins.includes(origin)) ||
      request.get('sec-fetch-site') === 'cross-site'
    ) {
      throw new ApiError(
        403,
        'CSRF_REJECTED',
        'Request origin could not be verified. Reload the application and try again.',
      );
    }
    if (!request.is('application/json'))
      throw new ApiError(415, 'JSON_REQUIRED', 'Use application/json for API requests.');
    next();
  };
}
