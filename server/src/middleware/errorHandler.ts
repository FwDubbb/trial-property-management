import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found.' } });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    response
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message || 'Check the form fields.',
          fields: error.flatten().fieldErrors,
        },
      });
    return;
  }
  const invalidJson =
    error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed';
  const tooLarge =
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large';
  const status = invalidJson ? 400 : tooLarge ? 413 : 500;
  response.status(status).json({
    error: {
      code: invalidJson ? 'INVALID_JSON' : tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
      message: invalidJson
        ? 'Request body must be valid JSON.'
        : tooLarge
          ? 'Request body is too large.'
          : 'An unexpected server error occurred.',
    },
  });
};
