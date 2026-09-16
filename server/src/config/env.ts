import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Resolve from this file so configuration works in both src/ and compiled dist/.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export function parseEnv(values: NodeJS.ProcessEnv) {
  const rawPort = values.PORT ?? '4000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const nodeEnv = values.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }
  const databaseUrl = values.DATABASE_URL;
  if (!databaseUrl)
    throw new Error('DATABASE_URL is required. Copy server/.env.example to server/.env.');
  try {
    const url = new URL(databaseUrl);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    ) {
      throw new Error('Invalid database URL.');
    }
  } catch {
    // Do not include the supplied URL: it may contain a password.
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name.');
  }
  const allowedOrigins = (
    values.APP_ORIGINS ||
    'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173'
  )
    .split(',')
    .map((value) => value.trim());
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error();
    } catch {
      throw new Error('APP_ORIGINS must contain comma-separated HTTP(S) origins without paths.');
    }
  }
  if (
    nodeEnv === 'production' &&
    (!values.APP_ORIGINS || allowedOrigins.some((origin) => !origin.startsWith('https://')))
  ) {
    throw new Error('Production requires explicit HTTPS APP_ORIGINS.');
  }
  return { port, nodeEnv, databaseUrl, allowedOrigins, host: values.HOST || '127.0.0.1' };
}

export const env = parseEnv(process.env);
