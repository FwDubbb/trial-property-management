import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from './database.js';
let context: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let owner: ReturnType<typeof request.agent>;
let other: ReturnType<typeof request.agent>;
let companyId: string;
let ownerId: string;
let otherId: string;
let otherCompanyId: string;
let propertyId: string;
let foreignPropertyId: string;
const headers = { 'X-Requested-With': 'PropertyPlatform', Origin: 'http://127.0.0.1:5173' };
const today = () => new Date().toISOString().slice(0, 10);
function month(offset = 0) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
const propertyBody = {
  name: 'Finance Apartments',
  address: '123 Test Street',
  city: 'Accra',
  country: 'Ghana',
  propertyType: 'APARTMENT',
};
const expense = (changes: Record<string, unknown> = {}) => ({
  propertyId,
  category: 'REPAIRS',
  description: 'Replaced sink seal',
  amount: 125.15,
  expenseDate: today(),
  notes: 'Receipt 123',
  requestId: randomUUID(),
  ...changes,
});
async function record(body = expense()) {
  return (await owner.post('/api/expenses').set(headers).send(body).expect(201)).body.expense;
}
async function report(property = propertyId, period = month()) {
  return (await owner.get(`/api/dashboard?propertyId=${property}&period=${period}`).expect(200))
    .body;
}
before(async () => {
  context = await createTestDatabase();
  app = createApp(async () => {}, context.database);
  owner = request.agent(app);
  other = request.agent(app);
  const register = async (agent: typeof owner, name: string) =>
    (
      await agent
        .post('/api/auth/register')
        .set(headers)
        .send({
          companyName: name,
          name,
          email: `${randomUUID()}@example.test`,
          password: 'Finance integration passphrase!',
        })
        .expect(201)
    ).body.user;
  const user = await register(owner, 'Mensah');
  companyId = user.companyId;
  ownerId = user.id;
  const stranger = await register(other, 'Smith');
  otherId = stranger.id;
  otherCompanyId = stranger.companyId;
  propertyId = (await owner.post('/api/properties').set(headers).send(propertyBody).expect(201))
    .body.property.id;
  foreignPropertyId = (
    await other.post('/api/properties').set(headers).send(propertyBody).expect(201)
  ).body.property.id;
});
after(async () => {
  if (context) await context.cleanup();
});
test('expense records persist, search filters paginate, and totals include all matching rows with exact cents', async () => {
  const marker = `Unique%_${randomUUID()}`;
  const first = await record(expense({ description: marker, amount: 0.1 }));
  await record(expense({ description: marker, amount: 0.2 }));
  await record(expense({ description: marker, amount: 500, category: 'UTILITIES' }));
  const saved = (await owner.get(`/api/expenses/${first.id}`).expect(200)).body.expense;
  assert.equal(saved.amount, '0.10');
  assert.equal(saved.recordedByName, 'Mensah');
  assert.equal(saved.propertyId, propertyId);
  const result = (
    await owner
      .get(
        `/api/expenses?q=${encodeURIComponent(marker)}&category=REPAIRS&propertyId=${propertyId}&period=${month()}&pageSize=1&page=2`,
      )
      .expect(200)
  ).body;
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.recordedTotal, '0.30');
  assert.equal(
    (
      await owner
        .get(`/api/expenses?q=${encodeURIComponent(marker)}&period=${month(-1)}`)
        .expect(200)
    ).body.total,
    0,
  );
});
test('duplicate retries record once, and voiding preserves audit history while excluding costs from totals', async () => {
  const body = expense({ description: `Retry ${randomUUID()}` });
  const results = await Promise.all([
    owner.post('/api/expenses').set(headers).send(body),
    owner.post('/api/expenses').set(headers).send(body),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 201]);
  const id = results[0].body.expense.id;
  assert.equal(id, results[1].body.expense.id);
  await owner
    .post('/api/expenses')
    .set(headers)
    .send({ ...body, amount: 1 })
    .expect(409);
  await owner.post(`/api/expenses/${id}/void`).set(headers).send({ reason: ' ' }).expect(400);
  const voided = (
    await owner
      .post(`/api/expenses/${id}/void`)
      .set(headers)
      .send({ reason: 'Wrong receipt' })
      .expect(200)
  ).body.expense;
  assert.equal(voided.state, 'VOIDED');
  assert.equal(voided.amount, '125.15');
  assert.equal(voided.voidedByName, 'Mensah');
  assert.equal(voided.voidReason, 'Wrong receipt');
  await owner.post(`/api/expenses/${id}/void`).set(headers).send({ reason: 'Again' }).expect(409);
  const list = (
    await owner
      .get(`/api/expenses?q=${encodeURIComponent(body.description)}&state=VOIDED`)
      .expect(200)
  ).body;
  assert.equal(list.total, 1);
  assert.equal(list.recordedTotal, '0');
  assert.equal(
    (await owner.post('/api/expenses').set(headers).send(body).expect(200)).body.expense.state,
    'VOIDED',
  );
});
test('dashboard separates receipt dates from rent periods, reconciles costs, and includes current tenant/maintenance counts', async () => {
  const property = (
    await owner
      .post('/api/properties')
      .set(headers)
      .send({ ...propertyBody, name: 'Analytics fixture' })
      .expect(201)
  ).body.property.id;
  const unit = (
    await owner
      .post('/api/units')
      .set(headers)
      .send({
        propertyId: property,
        name: '1A',
        bedrooms: 1,
        bathrooms: 1,
        monthlyRent: 999,
        status: 'VACANT',
      })
      .expect(201)
  ).body.unit.id;
  const tenant = (
    await owner
      .post('/api/tenants')
      .set(headers)
      .send({ firstName: 'Analytics', lastName: 'Tenant' })
      .expect(201)
  ).body.tenant.id;
  const lease = (
    await owner
      .post('/api/leases')
      .set(headers)
      .send({
        tenantId: tenant,
        unitId: unit,
        startDate: `${month(-1)}-01`,
        endDate: `${month(1)}-28`,
        monthlyRent: 1000.3,
        securityDeposit: 2500,
      })
      .expect(201)
  ).body.lease.id;
  const pay = async (period: string, amount: number, paymentDate = today()) =>
    (
      await owner
        .post('/api/payments')
        .set(headers)
        .send({
          leaseId: lease,
          period,
          amount,
          paymentDate,
          method: 'CASH',
          requestId: randomUUID(),
        })
        .expect(201)
    ).body.payment;
  await pay(month(-1), 200.1);
  await pay(month(), 300.2);
  await pay(month(-1), 100, `${month(-1)}-01`);
  const voidPay = await pay(month(), 50);
  await owner
    .post(`/api/payments/${voidPay.id}/void`)
    .set(headers)
    .send({ reason: 'Wrong receipt' })
    .expect(200);
  await record(expense({ propertyId: property, amount: 100.1 }));
  await record(expense({ propertyId: property, amount: 50.05, category: 'UTILITIES' }));
  await record(expense({ propertyId: property, amount: 250, expenseDate: `${month(-1)}-01` }));
  const voidCost = await record(expense({ propertyId: property, amount: 999 }));
  await owner
    .post(`/api/expenses/${voidCost.id}/void`)
    .set(headers)
    .send({ reason: 'Incorrect' })
    .expect(200);
  const repair = {
    propertyId: property,
    unitId: unit,
    tenantId: tenant,
    title: 'Analytics repair',
    description: 'Window repair',
    priority: 'HIGH',
    submittedDate: today(),
  };
  await owner.post('/api/maintenance').set(headers).send(repair).expect(201);
  const done = (
    await owner
      .post('/api/maintenance')
      .set(headers)
      .send({ ...repair, title: 'Finished repair' })
      .expect(201)
  ).body.request;
  await owner
    .patch(`/api/maintenance/${done.id}/status`)
    .set(headers)
    .send({ version: done.version, status: 'COMPLETED' })
    .expect(200);
  const data = await report(property);
  assert.deepEqual(data.portfolio, {
    properties: 1,
    activeProperties: 1,
    units: 1,
    occupied: 1,
    vacant: 0,
    tenants: 1,
    openMaintenance: 1,
  });
  assert.equal(data.rent.expected, '1000.30');
  assert.equal(data.rent.paid, '300.20');
  assert.equal(data.rent.outstanding, '700.10');
  assert.equal(data.cash.received, '500.30');
  assert.equal(data.cash.expenses, '150.15');
  assert.equal(data.cash.net, '350.15');
  assert.equal(data.recentPayments.length, 2);
  assert.equal(data.recentMaintenance.length, 2);
  assert.equal(data.trend.length, 6);
  assert.deepEqual(data.trend.at(-2), {
    period: month(-1),
    received: '100.00',
    expenses: '250.00',
    net: '-150.00',
  });
  assert.equal(data.trend[0].received, '0');
  assert.deepEqual(data.categories, [
    { category: 'REPAIRS', amount: '100.10' },
    { category: 'UTILITIES', amount: '50.05' },
  ]);
  const rent = (
    await owner.get(`/api/payments/rent?period=${month()}&propertyId=${property}`).expect(200)
  ).body.summary;
  assert.deepEqual(data.rent, rent);
  await owner
    .patch(`/api/properties/${property}/status`)
    .set(headers)
    .send({ active: false })
    .expect(200);
  const inactive = await report(property);
  assert.equal(inactive.portfolio.activeProperties, 0);
  assert.equal(inactive.cash.received, '500.30');
  assert.equal(inactive.portfolio.openMaintenance, 1);
  await record(expense({ propertyId: property, amount: 1 }));
  assert.equal((await report(property)).cash.expenses, '151.15');
});
test('dashboard month boundaries exclude adjacent dates, returns negative differences, and zeros empty months', async () => {
  const property = (
    await owner
      .post('/api/properties')
      .set(headers)
      .send({ ...propertyBody, name: 'Date boundaries' })
      .expect(201)
  ).body.property.id;
  for (const expenseDate of ['2024-02-01', '2024-02-29', '2024-03-01'])
    await record(expense({ propertyId: property, expenseDate, amount: 10.25 }));
  const february = await report(property, '2024-02');
  assert.equal(february.cash.expenses, '20.50');
  assert.equal(february.cash.net, '-20.50');
  assert.equal(february.cash.received, '0');
  const empty = await report(property, '2024-04');
  assert.equal(empty.cash.expenses, '0');
  assert.equal(empty.rent.expected, '0');
  assert.deepEqual(empty.recentPayments, []);
  assert.equal(empty.trend.length, 6);
  await report(property, '1900-01');
  await report(property, '9999-12');
});
test('company boundaries protect expense reads, writes, filters, dashboard summaries, and foreign keys', async () => {
  const item = await record();
  await other.get(`/api/expenses/${item.id}`).expect(404);
  await other
    .post(`/api/expenses/${item.id}/void`)
    .set(headers)
    .send({ reason: 'Foreign' })
    .expect(404);
  await owner
    .post('/api/expenses')
    .set(headers)
    .send(expense({ propertyId: foreignPropertyId }))
    .expect(404);
  assert.equal(
    (await other.get(`/api/expenses?propertyId=${propertyId}`).expect(200)).body.total,
    0,
  );
  const report = (await other.get(`/api/dashboard?propertyId=${propertyId}`).expect(200)).body;
  assert.equal(report.portfolio.properties, 0);
  assert.equal(report.cash.expenses, '0');
  assert.deepEqual(report.categories, []);
  assert.deepEqual(report.recentPayments, []);
  assert.deepEqual(report.recentMaintenance, []);
  await assert.rejects(
    context.database.query('UPDATE expenses SET property_id=$1 WHERE company_id=$2 AND id=$3', [
      foreignPropertyId,
      companyId,
      item.id,
    ]),
    { code: '23503' },
  );
  await assert.rejects(
    context.database.query('UPDATE expenses SET recorded_by=$1 WHERE company_id=$2 AND id=$3', [
      otherId,
      companyId,
      item.id,
    ]),
    { code: '23503' },
  );
  await owner
    .post('/api/expenses')
    .set(headers)
    .send(expense({ companyId: otherCompanyId }))
    .expect(400);
});
test('validation, authentication, mutation protection and manager expense access are enforced', async () => {
  await request(app).get('/api/dashboard').expect(401);
  await request(app).get('/api/expenses').expect(401);
  for (const change of [
    { amount: 0 },
    { amount: -1 },
    { amount: 0.001 },
    { amount: '1' },
    { description: ' ' },
    { category: 'INVALID' },
    { expenseDate: '2024-02-30' },
    { expenseDate: '9999-01-01' },
    { recordedBy: ownerId },
    { requestId: 'bad' },
  ])
    await owner.post('/api/expenses').set(headers).send(expense(change)).expect(400);
  await owner.post('/api/expenses').send(expense()).expect(403);
  await owner.get('/api/dashboard?period=2026-13').expect(400);
  await owner.get('/api/dashboard?companyId=bad').expect(400);
  await owner.get('/api/expenses?pageSize=1000').expect(400);
  await context.database.query("UPDATE users SET role='MANAGER' WHERE company_id=$1 AND id=$2", [
    companyId,
    ownerId,
  ]);
  try {
    const item = await record();
    await owner.get('/api/dashboard').expect(200);
    await owner
      .post(`/api/expenses/${item.id}/void`)
      .set(headers)
      .send({ reason: 'Manager correction' })
      .expect(200);
  } finally {
    await context.database.query("UPDATE users SET role='OWNER' WHERE company_id=$1 AND id=$2", [
      companyId,
      ownerId,
    ]);
  }
});
