import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestDatabase } from './database.js';

let context: Awaited<ReturnType<typeof createTestDatabase>>;
let owner: ReturnType<typeof request.agent>;
let other: ReturnType<typeof request.agent>;
let app: ReturnType<typeof createApp>;
let companyId: string;
let ownerId: string;
let otherCompanyId: string;
let otherId: string;
let propertyId: string;
const headers = { 'X-Requested-With': 'PropertyPlatform', Origin: 'http://127.0.0.1:5173' };
const today = () => new Date().toISOString().slice(0, 10);
function month(offset = 0) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
async function fixture(overrides: Record<string, unknown> = {}) {
  const tenant = (
    await owner
      .post('/api/tenants')
      .set(headers)
      .send({ firstName: 'Ama', lastName: randomUUID() })
      .expect(201)
  ).body.tenant;
  const unit = (
    await owner
      .post('/api/units')
      .set(headers)
      .send({
        propertyId,
        name: randomUUID(),
        bedrooms: 1,
        bathrooms: 1,
        monthlyRent: 1500,
        status: 'VACANT',
      })
      .expect(201)
  ).body.unit;
  const body = {
    tenantId: tenant.id,
    unitId: unit.id,
    startDate: `${month(-2)}-01`,
    endDate: `${month(3)}-28`,
    monthlyRent: 1200.3,
    securityDeposit: 2000,
    ...overrides,
  };
  const lease = (await owner.post('/api/leases').set(headers).send(body).expect(201)).body.lease;
  return { tenant, unit, lease, body };
}
function payment(leaseId: string, overrides: Record<string, unknown> = {}) {
  return {
    leaseId,
    period: month(),
    amount: 400.1,
    paymentDate: today(),
    method: 'MOBILE_MONEY',
    reference: 'MOMO-123',
    notes: 'Rent received',
    requestId: randomUUID(),
    ...overrides,
  };
}
async function rent(leaseId: string, period = month()) {
  return (await owner.get(`/api/payments/rent?period=${period}&leaseId=${leaseId}`).expect(200))
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
          password: 'Payment integration passphrase!',
        })
        .expect(201)
    ).body.user;
  const user = await register(owner, 'Mensah');
  companyId = user.companyId;
  ownerId = user.id;
  const stranger = await register(other, 'Smith');
  otherCompanyId = stranger.companyId;
  otherId = stranger.id;
  propertyId = (
    await owner
      .post('/api/properties')
      .set(headers)
      .send({
        name: 'Rent Apartments',
        address: '123 Test Street',
        city: 'Accra',
        country: 'Ghana',
        propertyType: 'APARTMENT',
      })
      .expect(201)
  ).body.property.id;
});
after(async () => {
  if (context) await context.cleanup();
});

test('rent months use full rent, due dates, overdue precedence and exact partial/full payment totals', async () => {
  const data = await fixture({ startDate: today() });
  const initial = await rent(data.lease.id);
  assert.equal(initial.items[0].expected, '1200.30');
  assert.equal(initial.items[0].dueDate, today());
  assert.equal(initial.items[0].status, 'UNPAID');
  await owner.post('/api/payments').set(headers).send(payment(data.lease.id)).expect(201);
  const partial = (await rent(data.lease.id)).items[0];
  assert.equal(partial.paid, '400.10');
  assert.equal(partial.outstanding, '800.20');
  assert.equal(partial.status, 'PARTIALLY_PAID');
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(data.lease.id, { amount: 800.2 }))
    .expect(201);
  const paid = await rent(data.lease.id);
  assert.equal(paid.items[0].status, 'PAID');
  assert.equal(paid.summary.paid, '1200.30');
  assert.equal(paid.summary.outstanding, '0.00');
  const old = await fixture();
  const overdue = (await rent(old.lease.id, month(-1))).items[0];
  assert.equal(overdue.status, 'OVERDUE');
  assert.equal(overdue.overdue, true);
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(old.lease.id, { period: month(-1) }))
    .expect(201);
  const overduePartial = (await rent(old.lease.id, month(-1))).items[0];
  assert.equal(overduePartial.status, 'OVERDUE');
  assert.equal(overduePartial.paymentStatus, 'PARTIALLY_PAID');
});
test('payment period is independent of receipt date, and deposits or advertised unit rent do not increase rent due', async () => {
  const data = await fixture();
  const body = payment(data.lease.id, { period: month(-1), amount: 1200.3, method: 'CASH' });
  const saved = (await owner.post('/api/payments').set(headers).send(body).expect(201)).body
    .payment;
  assert.equal(saved.paymentDate, today());
  assert.equal(saved.period, month(-1));
  assert.equal(saved.tenantId, data.tenant.id);
  assert.equal(saved.unitId, data.unit.id);
  assert.equal(saved.propertyId, propertyId);
  assert.equal((await rent(data.lease.id, month(-1))).summary.paid, '1200.30');
  assert.equal((await rent(data.lease.id)).summary.paid, '0');
  assert.equal((await rent(data.lease.id)).summary.expected, '1200.30');
});
test('zero rent is settled without payments; months outside the term and cancelled reservations cannot receive a payment', async () => {
  const free = await fixture({ monthlyRent: 0 });
  assert.equal((await rent(free.lease.id)).items[0].status, 'PAID');
  await owner.post('/api/payments').set(headers).send(payment(free.lease.id)).expect(409);
  const data = await fixture();
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(data.lease.id, { period: month(-3) }))
    .expect(400);
  const upcoming = await fixture({ startDate: `${month(1)}-01` });
  await owner
    .post(`/api/leases/${upcoming.lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Cancelled before move-in' })
    .expect(200);
  assert.equal((await rent(upcoming.lease.id, month(1))).total, 0);
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(upcoming.lease.id, { period: month(1) }))
    .expect(400);
});
test('overpayments and concurrent payments cannot exceed a month balance', async () => {
  const data = await fixture();
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(data.lease.id, { amount: 1200.31 }))
    .expect(409);
  const results = await Promise.all([
    owner
      .post('/api/payments')
      .set(headers)
      .send(payment(data.lease.id, { amount: 800 })),
    owner
      .post('/api/payments')
      .set(headers)
      .send(payment(data.lease.id, { amount: 800 })),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await rent(data.lease.id)).summary.paid, '800.00');
});
test('retrying one request records only one payment, including simultaneous retries and changed-body rejection', async () => {
  const data = await fixture();
  const body = payment(data.lease.id);
  const results = await Promise.all([
    owner.post('/api/payments').set(headers).send(body),
    owner.post('/api/payments').set(headers).send(body),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 201]);
  assert.equal(results[0].body.payment.id, results[1].body.payment.id);
  await owner
    .post('/api/payments')
    .set(headers)
    .send({ ...body, amount: 10 })
    .expect(409);
  assert.equal((await rent(data.lease.id)).summary.paid, '400.10');
});
test('void requires a reason, preserves history and audit names, restores balance, and allows a replacement', async () => {
  const data = await fixture();
  const body = payment(data.lease.id, { amount: 1200.3 });
  const saved = (await owner.post('/api/payments').set(headers).send(body).expect(201)).body
    .payment;
  await owner.post(`/api/payments/${saved.id}/void`).set(headers).send({ reason: ' ' }).expect(400);
  const voided = (
    await owner
      .post(`/api/payments/${saved.id}/void`)
      .set(headers)
      .send({ reason: 'Wrong receipt' })
      .expect(200)
  ).body.payment;
  assert.equal(voided.state, 'VOIDED');
  assert.equal(voided.voidReason, 'Wrong receipt');
  assert.equal(voided.recordedByName, 'Mensah');
  assert.equal(voided.voidedByName, 'Mensah');
  assert.equal(voided.amount, '1200.30');
  assert.equal((await rent(data.lease.id)).summary.paid, '0');
  assert.equal((await rent(data.lease.id)).summary.outstanding, '1200.30');
  await owner
    .post(`/api/payments/${saved.id}/void`)
    .set(headers)
    .send({ reason: 'Again' })
    .expect(409);
  const replay = await owner.post('/api/payments').set(headers).send(body).expect(200);
  assert.equal(replay.body.payment.state, 'VOIDED');
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(data.lease.id, { amount: 1200.3 }))
    .expect(201);
  const history = (await owner.get(`/api/payments?leaseId=${data.lease.id}`).expect(200)).body;
  assert.equal(history.total, 2);
});
test('recorded month terms survive lease edits and termination; unrecorded months use new lease terms', async () => {
  const data = await fixture();
  await owner.post('/api/payments').set(headers).send(payment(data.lease.id)).expect(201);
  await owner
    .put(`/api/leases/${data.lease.id}`)
    .set(headers)
    .send({ ...data.body, monthlyRent: 1500 })
    .expect(200);
  assert.equal((await rent(data.lease.id)).summary.expected, '1200.30');
  assert.equal((await rent(data.lease.id, month(1))).summary.expected, '1500.00');
  await owner
    .post(`/api/leases/${data.lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Moved out' })
    .expect(200);
  assert.equal((await rent(data.lease.id)).summary.outstanding, '800.20');
  assert.equal((await rent(data.lease.id, month(1))).total, 0);
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(data.lease.id, { amount: 800.2 }))
    .expect(201);
});
test('past and inactive leases can settle arrears, and recorded future months retain their balances after termination', async () => {
  const expired = await fixture({ startDate: `${month(-2)}-12`, endDate: `${month(-1)}-05` });
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(expired.lease.id, { period: month(-1) }))
    .expect(201);
  const upcoming = await fixture({ startDate: `${month(1)}-15` });
  await owner
    .post('/api/payments')
    .set(headers)
    .send(payment(upcoming.lease.id, { period: month(1) }))
    .expect(201);
  await owner
    .post(`/api/leases/${upcoming.lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Cancelled' })
    .expect(200);
  assert.equal((await rent(upcoming.lease.id, month(1))).summary.expected, '1200.30');
  await owner
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: false })
    .expect(200);
  try {
    await owner
      .post('/api/payments')
      .set(headers)
      .send(payment(expired.lease.id, { period: month(-1), amount: 800.2 }))
      .expect(201);
  } finally {
    await owner
      .patch(`/api/properties/${propertyId}/status`)
      .set(headers)
      .send({ active: true })
      .expect(200);
  }
});
test('search, method, month, state, tenant and property filters paginate and sum only matching company records', async () => {
  const data = await fixture();
  const reference = `Unique%_${randomUUID()}`;
  for (const method of ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHECK', 'OTHER'])
    await owner
      .post('/api/payments')
      .set(headers)
      .send(payment(data.lease.id, { amount: 1, method, reference }))
      .expect(201);
  const list = (
    await owner
      .get(
        `/api/payments?q=${encodeURIComponent(reference)}&tenantId=${data.tenant.id}&propertyId=${propertyId}&period=${month()}&pageSize=2&page=2`,
      )
      .expect(200)
  ).body;
  assert.equal(list.total, 5);
  assert.equal(list.items.length, 2);
  assert.equal(
    (
      await owner
        .get(`/api/payments?leaseId=${data.lease.id}&method=CHECK&state=RECORDED`)
        .expect(200)
    ).body.total,
    1,
  );
  const report = (
    await owner.get(`/api/payments/rent?tenantId=${data.tenant.id}&period=${month()}`).expect(200)
  ).body;
  assert.equal(report.total, 1);
  assert.equal(report.summary.paid, '5.00');
  assert.equal(report.summary.outstanding, '1195.30');
  assert.equal(
    (
      await owner
        .get(`/api/payments/rent?tenantId=${data.tenant.id}&period=${month()}&status=PAID`)
        .expect(200)
    ).body.total,
    0,
  );
});
test('company boundaries protect every endpoint and reject forged links and actor IDs at database level', async () => {
  const data = await fixture();
  const saved = (
    await owner.post('/api/payments').set(headers).send(payment(data.lease.id)).expect(201)
  ).body.payment;
  await other.get(`/api/payments/${saved.id}`).expect(404);
  await other
    .post(`/api/payments/${saved.id}/void`)
    .set(headers)
    .send({ reason: 'Foreign' })
    .expect(404);
  await other.post('/api/payments').set(headers).send(payment(data.lease.id)).expect(404);
  for (const path of [
    '/api/payments',
    '/api/payments/options',
    `/api/payments?tenantId=${data.tenant.id}`,
    `/api/payments/rent?period=${month()}&leaseId=${data.lease.id}`,
  ]) {
    const result = await other.get(path).expect(200);
    assert.equal(result.body.items.length, 0);
  }
  await owner
    .post('/api/payments')
    .set(headers)
    .send({ ...payment(data.lease.id), companyId: otherCompanyId })
    .expect(400);
  await assert.rejects(
    context.database.query(
      'INSERT INTO rent_charges(company_id,lease_id,period,expected_amount,due_date) VALUES($1,$2,$3,100,$3)',
      [otherCompanyId, data.lease.id, `${month()}-01`],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    context.database.query('UPDATE payments SET recorded_by=$1 WHERE company_id=$2 AND id=$3', [
      otherId,
      companyId,
      saved.id,
    ]),
    { code: '23503' },
  );
});
test('authentication, roles, mutation protection, and invalid dates or amounts are enforced', async () => {
  await request(app).get('/api/payments').expect(401);
  await request(app).get('/api/payments/rent').expect(401);
  const data = await fixture();
  for (const changes of [
    { amount: 0 },
    { amount: -1 },
    { amount: 1.001 },
    { amount: '5' },
    { method: 'CARD' },
    { period: '2026-13' },
    { period: '2026-1' },
    { paymentDate: '2026-02-30' },
    { paymentDate: '9999-01-01' },
    { requestId: 'bad' },
    { tenantId: data.tenant.id },
    { unitId: data.unit.id },
  ])
    await owner
      .post('/api/payments')
      .set(headers)
      .send(payment(data.lease.id, changes))
      .expect(400);
  await owner.post('/api/payments').send(payment(data.lease.id)).expect(403);
  await owner.get('/api/payments/rent?period=invalid').expect(400);
  await owner.get('/api/payments?pageSize=1000').expect(400);
  await context.database.query("UPDATE users SET role='MANAGER' WHERE company_id=$1 AND id=$2", [
    companyId,
    ownerId,
  ]);
  try {
    const saved = (
      await owner.post('/api/payments').set(headers).send(payment(data.lease.id)).expect(201)
    ).body.payment;
    await owner
      .post(`/api/payments/${saved.id}/void`)
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
