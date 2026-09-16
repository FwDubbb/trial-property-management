import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';
import { checkDatabase } from './services/healthService.js';

const server = createApp(checkDatabase, pool, {
  production: env.nodeEnv === 'production',
  allowedOrigins: env.allowedOrigins,
}).listen(env.port, env.host, () => {
  console.log(`API running at http://${env.host}:${env.port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? 'The API port is already in use. Stop the other server or change PORT.'
      : 'The API could not start. Check HOST and PORT.',
  );
  void pool.end().finally(() => {
    process.exitCode = 1;
  });
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(() => {
    void pool.end().finally(() => {
      clearTimeout(timeout);
    });
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
