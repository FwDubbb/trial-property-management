import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from './database.js';

let context: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
const headers = { 'X-Requested-With': 'PropertyPlatform', Origin: 'http://127.0.0.1:5173' };
const account = {
  companyName: 'Mensah Properties',
  name: 'John Mensah',
  email: 'john@example.test',
  password: 'A long test passphrase 2026!',
};
before(async () => {
  context = await createTestDatabase();
  app = createApp(async () => {}, context.database);
});
after(async () => {
  if (context) await context.cleanup();
});

test('register creates company and owner; session stores only token hash; logout revokes session', async () => {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').set(headers).send(account).expect(201);
  assert.equal(response.body.user.role, 'OWNER');
  assert.equal(response.body.user.companyName, account.companyName);
  assert.doesNotMatch(JSON.stringify(response.body), /password|token|hash/);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const rawToken = /property_session=([a-f0-9]+)/.exec(cookie)![1];
  const stored = await context.database.query(
    'SELECT token_hash FROM sessions WHERE user_id = $1',
    [response.body.user.id],
  );
  assert.notEqual(stored.rows[0].token_hash, rawToken);
  const user = await context.database.query('SELECT password_hash FROM users WHERE id = $1', [
    response.body.user.id,
  ]);
  assert.notEqual(user.rows[0].password_hash, account.password);
  await agent.get('/api/auth/me').expect(200);
  await agent.post('/api/auth/logout').set(headers).send({}).expect(204);
  await agent.get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]).expect(401);
});

test('login is case-insensitive and returns only the account company', async () => {
  const other = await request(app)
    .post('/api/auth/register')
    .set(headers)
    .send({ ...account, companyName: 'Smith Group', email: 'smith@example.test' })
    .expect(201);
  const response = await request(app)
    .post('/api/auth/login')
    .set(headers)
    .send({ email: 'JOHN@EXAMPLE.TEST', password: account.password })
    .expect(200);
  assert.equal(response.body.user.companyName, account.companyName);
  assert.notEqual(response.body.user.companyId, other.body.user.companyId);
  await request(app)
    .post('/api/auth/login')
    .set(headers)
    .send({ email: account.email, password: 'wrong password' })
    .expect(401);
  await request(app)
    .post('/api/auth/login')
    .set(headers)
    .send({ email: 'unknown@example.test', password: account.password })
    .expect(401);
});

test('duplicate registration rolls back its company and rejects injected role/company IDs', async () => {
  const before = await context.database.query('SELECT count(*) FROM companies');
  await request(app).post('/api/auth/register').set(headers).send(account).expect(409);
  const after = await context.database.query('SELECT count(*) FROM companies');
  assert.equal(before.rows[0].count, after.rows[0].count);
  await request(app)
    .post('/api/auth/register')
    .set(headers)
    .send({ ...account, companyId: 'other-company', role: 'MANAGER' })
    .expect(400);
  await request(app)
    .post('/api/auth/register')
    .set(headers)
    .send({ ...account, password: 'short' })
    .expect(400);
});

test('expired and fabricated sessions cannot authenticate', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set(headers)
    .send({ email: account.email, password: account.password })
    .expect(200);
  await context.database.query(
    "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1",
    [response.body.user.id],
  );
  await request(app)
    .get('/api/auth/me')
    .set('Cookie', response.headers['set-cookie'][0].split(';')[0])
    .expect(401);
  await request(app)
    .get('/api/auth/me')
    .set('Cookie', `property_session=${'f'.repeat(64)}`)
    .expect(401);
});

test('cross-site and headerless authentication writes are rejected', async () => {
  await request(app)
    .post('/api/auth/login')
    .send({ email: account.email, password: account.password })
    .expect(403);
  await request(app)
    .post('/api/auth/login')
    .set({ ...headers, Origin: 'https://untrusted.example' })
    .send(account)
    .expect(403);
});

test('production sessions use Secure cookies', async () => {
  const productionApp = createApp(async () => {}, context.database, {
    production: true,
    allowedOrigins: ['https://property.example'],
  });
  const response = await request(productionApp)
    .post('/api/auth/login')
    .set({ ...headers, Origin: 'https://property.example' })
    .send({ email: account.email, password: account.password })
    .expect(200);
  assert.match(response.headers['set-cookie'][0], /; Secure/);
});

test('authentication endpoints reject excessive attempts', async () => {
  const limitedApp = createApp(async () => {}, context.database);
  for (let attempt = 0; attempt < 30; attempt++) {
    await request(limitedApp).post('/api/auth/login').set(headers).send({}).expect(400);
  }
  const response = await request(limitedApp)
    .post('/api/auth/login')
    .set(headers)
    .send({})
    .expect(429);
  assert.equal(response.body.error.code, 'RATE_LIMITED');
});
