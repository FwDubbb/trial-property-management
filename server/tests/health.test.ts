import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('test endpoint works independently of PostgreSQL', async () => {
  let databaseCalled = false;
  const app = createApp(async () => {
    databaseCalled = true;
    throw new Error('offline');
  });
  const response = await request(app).get('/api/test').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.match(response.body.message, /Express API/);
  assert.ok(Number.isFinite(Date.parse(response.body.timestamp)));
  assert.equal(databaseCalled, false);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-powered-by'], undefined);
});

test('database health reports successful query', async () => {
  let called = false;
  const response = await request(
    createApp(async () => {
      called = true;
    }),
  )
    .get('/api/health/database')
    .expect(200);
  assert.equal(called, true);
  assert.equal(response.body.database, 'connected');
});

test('database failures return 503 without exposing credentials', async () => {
  const response = await request(
    createApp(async () => {
      throw new Error('postgresql://user:secret@private-host/database');
    }),
  )
    .get('/api/health/database')
    .expect(503);
  assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(response.body), /secret|private-host|stack/);
});

test('unknown endpoint returns JSON 404', async () => {
  const response = await request(createApp(async () => {}))
    .get('/api/missing')
    .expect(404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('malformed JSON returns a helpful 400', async () => {
  const response = await request(createApp(async () => {}))
    .post('/api/test')
    .set('Content-Type', 'application/json')
    .send('{bad')
    .expect(400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
});
