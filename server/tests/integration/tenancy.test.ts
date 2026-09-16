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
let propertyId: string;
let otherPropertyId: string;
let sequence = 0;
const headers = { 'X-Requested-With': 'PropertyPlatform', Origin: 'http://127.0.0.1:5173' };
function day(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
const tenantInput = {
  firstName: 'Ama',
  lastName: 'Mensah',
  phone: '+233 20 123 4567',
  email: 'ama@example.test',
  emergencyContactName: 'Kwame Owusu',
  emergencyContactPhone: '+233 24 111 2222',
  notes: 'Call in the afternoon.',
};
const unitInput = {
  name: '1A',
  bedrooms: 2,
  bathrooms: 1,
  monthlyRent: 1200,
  status: 'VACANT',
  notes: '',
};
const terms = {
  startDate: day(-5),
  endDate: day(30),
  monthlyRent: 1150.5,
  securityDeposit: 2000,
  notes: 'Annual tenancy.',
};
async function fixture(agent = owner, property = propertyId, status = 'VACANT') {
  const tenant = (
    await agent
      .post('/api/tenants')
      .set(headers)
      .send({ ...tenantInput, lastName: `Tenant ${++sequence}` })
      .expect(201)
  ).body.tenant;
  const unit = (
    await agent
      .post('/api/units')
      .set(headers)
      .send({ ...unitInput, propertyId: property, name: `Unit ${sequence}`, status })
      .expect(201)
  ).body.unit;
  return { tenant, unit, body: { ...terms, tenantId: tenant.id, unitId: unit.id } };
}
before(async () => {
  context = await createTestDatabase();
  app = createApp(async () => {}, context.database);
  owner = request.agent(app);
  other = request.agent(app);
  companyId = (
    await owner
      .post('/api/auth/register')
      .set(headers)
      .send({
        companyName: 'Mensah Properties',
        name: 'John',
        email: 'john@example.test',
        password: 'Company password 2026!',
      })
      .expect(201)
  ).body.user.companyId;
  await other
    .post('/api/auth/register')
    .set(headers)
    .send({
      companyName: 'Smith Group',
      name: 'David',
      email: 'david@example.test',
      password: 'Company password 2026!',
    })
    .expect(201);
  const property = {
    name: 'Apartments',
    address: '123 Example Street',
    city: 'Accra',
    country: 'Ghana',
    propertyType: 'APARTMENT',
  };
  propertyId = (await owner.post('/api/properties').set(headers).send(property).expect(201)).body
    .property.id;
  otherPropertyId = (await other.post('/api/properties').set(headers).send(property).expect(201))
    .body.property.id;
});
after(async () => {
  if (context) await context.cleanup();
});

test('tenant contact details can be created, edited, searched and paginated', async () => {
  const data = await fixture();
  assert.equal(data.tenant.emergencyContactName, tenantInput.emergencyContactName);
  assert.equal(data.tenant.currentUnitId, null);
  const updated = await owner
    .put(`/api/tenants/${data.tenant.id}`)
    .set(headers)
    .send({ ...tenantInput, firstName: 'Searchable', email: 'UPDATED@EXAMPLE.TEST' })
    .expect(200);
  assert.equal(updated.body.tenant.email, 'updated@example.test');
  const list = await owner.get('/api/tenants?q=Searchable&pageSize=1').expect(200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].id, data.tenant.id);
  await owner
    .post('/api/tenants')
    .set(headers)
    .send({ ...tenantInput, firstName: ' ' })
    .expect(400);
  await owner
    .post('/api/tenants')
    .set(headers)
    .send({ ...tenantInput, email: 'bad email' })
    .expect(400);
  await owner
    .post('/api/tenants')
    .set(headers)
    .send({ ...tenantInput, companyId: randomUUID() })
    .expect(400);
});

test('active lease assigns tenant and occupancy consistently across units, properties and overview', async () => {
  const data = await fixture();
  const before = (await owner.get('/api/properties/summary').expect(200)).body;
  const lease = (await owner.post('/api/leases').set(headers).send(data.body).expect(201)).body
    .lease;
  assert.equal(lease.status, 'ACTIVE');
  assert.equal(lease.monthlyRent, '1150.50');
  const tenant = (await owner.get(`/api/tenants/${data.tenant.id}`).expect(200)).body.tenant;
  assert.equal(tenant.currentUnitId, data.unit.id);
  assert.equal(tenant.currentLeaseId, lease.id);
  const unit = (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit;
  assert.equal(unit.status, 'OCCUPIED');
  assert.equal(unit.activeLeaseId, lease.id);
  const summary = (await owner.get('/api/properties/summary').expect(200)).body;
  assert.equal(summary.occupied, before.occupied + 1);
  assert.equal(summary.vacant, before.vacant - 1);
  const property = (await owner.get(`/api/properties/${propertyId}`).expect(200)).body.property;
  assert.equal(property.occupiedCount, summary.occupied);
  assert.equal(
    (await owner.get(`/api/leases?tenantId=${data.tenant.id}`).expect(200)).body.items[0].id,
    lease.id,
  );
  assert.ok(
    (await owner.get('/api/tenants?housing=housed').expect(200)).body.items.some(
      (row: { id: string }) => row.id === data.tenant.id,
    ),
  );
  await owner
    .put(`/api/units/${data.unit.id}`)
    .set(headers)
    .send({ ...unitInput, name: data.unit.name, propertyId, status: 'VACANT' })
    .expect(409);
  await owner
    .put(`/api/units/${data.unit.id}`)
    .set(headers)
    .send({ ...unitInput, name: data.unit.name, propertyId, status: 'OCCUPIED', monthlyRent: 1300 })
    .expect(200);
  assert.equal(
    (await owner.get(`/api/leases/${lease.id}`).expect(200)).body.lease.monthlyRent,
    '1150.50',
  );
});

test('unit and tenant date overlaps are rejected; next-day renewal is allowed', async () => {
  const first = await fixture();
  const second = await fixture();
  await owner.post('/api/leases').set(headers).send(first.body).expect(201);
  const sameUnit = await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...second.body, unitId: first.unit.id })
    .expect(409);
  assert.equal(sameUnit.body.error.code, 'LEASE_OVERLAP');
  const sameTenant = await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...first.body, unitId: second.unit.id })
    .expect(409);
  assert.match(sameTenant.body.error.message, /tenant/);
  await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...first.body, startDate: day(30), endDate: day(60) })
    .expect(409);
  const next = await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...first.body, startDate: day(31), endDate: day(60) })
    .expect(201);
  assert.equal(next.body.lease.status, 'UPCOMING');
});

test('simultaneous bookings for a unit permit exactly one lease', async () => {
  const a = await fixture();
  const b = await fixture();
  const results = await Promise.all([
    owner.post('/api/leases').set(headers).send(a.body),
    owner
      .post('/api/leases')
      .set(headers)
      .send({ ...b.body, unitId: a.unit.id }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal((await owner.get(`/api/leases?unitId=${a.unit.id}`).expect(200)).body.total, 1);
});

test('upcoming leases activate and expire from dates without a background job', async () => {
  const data = await fixture();
  const lease = (
    await owner
      .post('/api/leases')
      .set(headers)
      .send({ ...data.body, startDate: day(1), endDate: day(10) })
      .expect(201)
  ).body.lease;
  assert.equal(lease.status, 'UPCOMING');
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'VACANT',
  );
  await owner
    .put(`/api/units/${data.unit.id}`)
    .set(headers)
    .send({ ...unitInput, name: data.unit.name, propertyId, status: 'MAINTENANCE' })
    .expect(409);
  // Move the dates to exercise the same view logic used when the UTC day changes.
  await context.database.query(
    'UPDATE leases SET start_date=$3,end_date=$4 WHERE company_id=$1 AND id=$2',
    [companyId, lease.id, day(-1), day(0)],
  );
  assert.equal(
    (await owner.get(`/api/leases/${lease.id}`).expect(200)).body.lease.status,
    'ACTIVE',
  );
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'OCCUPIED',
  );
  await context.database.query('UPDATE leases SET end_date=$3 WHERE company_id=$1 AND id=$2', [
    companyId,
    lease.id,
    day(-1),
  ]);
  assert.equal(
    (await owner.get(`/api/leases/${lease.id}`).expect(200)).body.lease.status,
    'EXPIRED',
  );
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'VACANT',
  );
  assert.equal(
    (await owner.get(`/api/tenants/${data.tenant.id}`).expect(200)).body.tenant.currentUnitId,
    null,
  );
  await owner.put(`/api/leases/${lease.id}`).set(headers).send(data.body).expect(409);
});

test('lease edits update terms and occupancy, preserve parties, and validate dates and money', async () => {
  const data = await fixture();
  const different = await fixture();
  const lease = (await owner.post('/api/leases').set(headers).send(data.body).expect(201)).body
    .lease;
  const edited = await owner
    .put(`/api/leases/${lease.id}`)
    .set(headers)
    .send({ ...data.body, monthlyRent: 1500.25, securityDeposit: 3000, notes: 'New terms' })
    .expect(200);
  assert.equal(edited.body.lease.monthlyRent, '1500.25');
  assert.equal(edited.body.lease.notes, 'New terms');
  await owner
    .put(`/api/leases/${lease.id}`)
    .set(headers)
    .send({ ...data.body, tenantId: different.tenant.id })
    .expect(400);
  for (const changed of [
    { startDate: '2026-02-30' },
    { startDate: day(20), endDate: day(10) },
    { monthlyRent: -1 },
    { securityDeposit: 1.000001 },
    { status: 'ACTIVE' },
    { companyId: randomUUID() },
  ]) {
    await owner
      .post('/api/leases')
      .set(headers)
      .send({ ...different.body, ...changed })
      .expect(400);
  }
  const ended = await owner
    .put(`/api/leases/${lease.id}`)
    .set(headers)
    .send({ ...data.body, endDate: day(-1) })
    .expect(200);
  assert.equal(ended.body.lease.status, 'EXPIRED');
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'VACANT',
  );
});

test('termination releases occupancy, preserves history, and cancelling a future lease leaves the active lease intact', async () => {
  const data = await fixture();
  const current = (await owner.post('/api/leases').set(headers).send(data.body).expect(201)).body
    .lease;
  const future = (
    await owner
      .post('/api/leases')
      .set(headers)
      .send({ ...data.body, startDate: day(31), endDate: day(60) })
      .expect(201)
  ).body.lease;
  await owner
    .post(`/api/leases/${future.id}/terminate`)
    .set(headers)
    .send({ reason: ' ' })
    .expect(400);
  await owner
    .post(`/api/leases/${future.id}/terminate`)
    .set(headers)
    .send({ reason: 'Renewal cancelled' })
    .expect(200);
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'OCCUPIED',
  );
  const result = await owner
    .post(`/api/leases/${current.id}/terminate`)
    .set(headers)
    .send({ reason: 'Tenant moved out' })
    .expect(200);
  assert.equal(result.body.lease.status, 'TERMINATED');
  assert.equal(result.body.lease.terminationReason, 'Tenant moved out');
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'VACANT',
  );
  assert.equal(
    (await owner.get(`/api/tenants/${data.tenant.id}`).expect(200)).body.tenant.currentUnitId,
    null,
  );
  assert.equal(
    (await owner.get(`/api/leases?tenantId=${data.tenant.id}&status=TERMINATED`).expect(200)).body
      .total,
    2,
  );
  await owner
    .post(`/api/leases/${current.id}/terminate`)
    .set(headers)
    .send({ reason: 'Again' })
    .expect(409);
  await owner.put(`/api/leases/${current.id}`).set(headers).send(data.body).expect(409);
  await owner.post('/api/leases').set(headers).send(data.body).expect(201);
});

test('tenants, leases, options and related records cannot cross company boundaries', async () => {
  const own = await fixture();
  const foreign = await fixture(other, otherPropertyId);
  const lease = (await owner.post('/api/leases').set(headers).send(own.body).expect(201)).body
    .lease;
  await request(app).get('/api/tenants').expect(401);
  await request(app).get('/api/leases').expect(401);
  await other.get(`/api/tenants/${own.tenant.id}`).expect(404);
  await other.put(`/api/tenants/${own.tenant.id}`).set(headers).send(tenantInput).expect(404);
  await other.get(`/api/leases/${lease.id}`).expect(404);
  await other.put(`/api/leases/${lease.id}`).set(headers).send(foreign.body).expect(404);
  await other
    .post(`/api/leases/${lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Unauthorized' })
    .expect(404);
  await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...own.body, tenantId: foreign.tenant.id })
    .expect(404);
  await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...own.body, unitId: foreign.unit.id })
    .expect(404);
  const options = (await other.get('/api/leases/options').expect(200)).body;
  assert.ok(!options.tenants.some((row: { id: string }) => row.id === own.tenant.id));
  assert.ok(!options.units.some((row: { id: string }) => row.id === own.unit.id));
  assert.equal(
    (await other.get(`/api/leases?tenantId=${own.tenant.id}`).expect(200)).body.total,
    0,
  );
  assert.equal((await other.get(`/api/leases?unitId=${own.unit.id}`).expect(200)).body.total, 0);
  assert.equal((await other.get(`/api/leases?propertyId=${propertyId}`).expect(200)).body.total, 0);
  await owner.get(`/api/tenants?companyId=${companyId}`).expect(400);
  await owner.get(`/api/leases?companyId=${companyId}`).expect(400);
  await owner.post('/api/leases').send(own.body).expect(403);
});

test('database rejects cross-company links and overlaps even outside the API', async () => {
  const own = await fixture();
  const foreign = await fixture(other, otherPropertyId);
  const sql = `INSERT INTO leases(company_id,tenant_id,unit_id,start_date,end_date,monthly_rent,security_deposit) VALUES ($1,$2,$3,$4,$5,1000,1000)`;
  await assert.rejects(
    context.database.query(sql, [companyId, foreign.tenant.id, own.unit.id, day(0), day(10)]),
    (error: unknown) => (error as { code: string }).code === '23503',
  );
  await assert.rejects(
    context.database.query(sql, [companyId, own.tenant.id, foreign.unit.id, day(0), day(10)]),
    (error: unknown) => (error as { code: string }).code === '23503',
  );
  await context.database.query(sql, [companyId, own.tenant.id, own.unit.id, day(0), day(10)]);
  await assert.rejects(
    context.database.query(sql, [companyId, own.tenant.id, own.unit.id, day(5), day(15)]),
    (error: unknown) => (error as { code: string }).code === '23P01',
  );
});

test('availability and inactive-property rules hold without preventing termination', async () => {
  const blocked = await fixture(owner, propertyId, 'MAINTENANCE');
  await owner.post('/api/leases').set(headers).send(blocked.body).expect(409);
  const manual = await fixture(owner, propertyId, 'OCCUPIED');
  await owner
    .post('/api/leases')
    .set(headers)
    .send({ ...manual.body, startDate: day(1) })
    .expect(409);
  const lease = (await owner.post('/api/leases').set(headers).send(manual.body).expect(201)).body
    .lease;
  await owner
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: false })
    .expect(200);
  await owner.put(`/api/leases/${lease.id}`).set(headers).send(manual.body).expect(409);
  await owner.post('/api/leases').set(headers).send(blocked.body).expect(409);
  await owner
    .post(`/api/leases/${lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Moved out' })
    .expect(200);
  await owner
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: true })
    .expect(200);
  assert.equal(
    (await owner.get(`/api/units/${manual.unit.id}`).expect(200)).body.unit.status,
    'VACANT',
  );
});

test('historic leases preserve current manual occupancy and ended records remain read-only', async () => {
  const data = await fixture(owner, propertyId, 'OCCUPIED');
  const lease = (
    await owner
      .post('/api/leases')
      .set(headers)
      .send({ ...data.body, startDate: day(-50), endDate: day(-20) })
      .expect(201)
  ).body.lease;
  assert.equal(lease.status, 'EXPIRED');
  assert.equal(
    (await owner.get(`/api/units/${data.unit.id}`).expect(200)).body.unit.status,
    'OCCUPIED',
  );
  await owner
    .post(`/api/leases/${lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Old history' })
    .expect(409);
  const list = await owner
    .get(`/api/leases?status=EXPIRED&tenantId=${data.tenant.id}&pageSize=1`)
    .expect(200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].id, lease.id);
});

test('MANAGER can manage tenants and leases in its own company', async () => {
  await context.database.query("UPDATE users SET role='MANAGER' WHERE company_id=$1", [companyId]);
  const data = await fixture();
  await owner.put(`/api/tenants/${data.tenant.id}`).set(headers).send(tenantInput).expect(200);
  const lease = (await owner.post('/api/leases').set(headers).send(data.body).expect(201)).body
    .lease;
  await owner
    .put(`/api/leases/${lease.id}`)
    .set(headers)
    .send({ ...data.body, notes: 'Manager edit' })
    .expect(200);
  await owner
    .post(`/api/leases/${lease.id}/terminate`)
    .set(headers)
    .send({ reason: 'Manager termination' })
    .expect(200);
});
