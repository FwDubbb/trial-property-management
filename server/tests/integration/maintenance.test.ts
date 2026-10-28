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
let secondPropertyId: string;
let unitId: string;
let tenantId: string;
let foreignPropertyId: string;
let foreignUnitId: string;
let foreignTenantId: string;
const headers = { 'X-Requested-With': 'PropertyPlatform', Origin: 'http://127.0.0.1:5173' };
const today = () => new Date().toISOString().slice(0, 10);
const details = {
  title: 'Kitchen sink leaking',
  description: 'Water dripping under the kitchen sink.',
  priority: 'MEDIUM',
  submittedDate: today(),
  assignedTo: '',
  notes: 'Call before visiting.',
};
async function create(changes: Record<string, unknown> = {}) {
  return (
    await owner
      .post('/api/maintenance')
      .set(headers)
      .send({ ...details, propertyId, unitId, tenantId, ...changes })
      .expect(201)
  ).body.request;
}
async function get(id: string) {
  return (await owner.get(`/api/maintenance/${id}`).expect(200)).body;
}
async function status(item: { id: string; version: number }, next: string, reason = '') {
  return (
    await owner
      .patch(`/api/maintenance/${item.id}/status`)
      .set(headers)
      .send({ version: item.version, status: next, reason })
      .expect(200)
  ).body.request;
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
          password: 'Maintenance integration passphrase!',
        })
        .expect(201)
    ).body.user;
  const user = await register(owner, 'Mensah');
  companyId = user.companyId;
  ownerId = user.id;
  const foreign = await register(other, 'Smith');
  otherId = foreign.id;
  otherCompanyId = foreign.companyId;
  const property = async (agent: typeof owner) =>
    (
      await agent
        .post('/api/properties')
        .set(headers)
        .send({
          name: randomUUID(),
          address: '123 Test Street',
          city: 'Accra',
          country: 'Ghana',
          propertyType: 'APARTMENT',
        })
        .expect(201)
    ).body.property.id;
  propertyId = await property(owner);
  secondPropertyId = await property(owner);
  foreignPropertyId = await property(other);
  const unit = async (agent: typeof owner, parent: string) =>
    (
      await agent
        .post('/api/units')
        .set(headers)
        .send({
          propertyId: parent,
          name: '1A',
          bedrooms: 2,
          bathrooms: 1,
          monthlyRent: 1200,
          status: 'VACANT',
        })
        .expect(201)
    ).body.unit.id;
  unitId = await unit(owner, propertyId);
  foreignUnitId = await unit(other, foreignPropertyId);
  const tenant = async (agent: typeof owner) =>
    (
      await agent
        .post('/api/tenants')
        .set(headers)
        .send({ firstName: 'Ama', lastName: 'Mensah' })
        .expect(201)
    ).body.tenant.id;
  tenantId = await tenant(owner);
  foreignTenantId = await tenant(other);
  await owner
    .post('/api/leases')
    .set(headers)
    .send({
      unitId,
      tenantId,
      startDate: today(),
      endDate: '9999-12-31',
      monthlyRent: 1200,
      securityDeposit: 0,
    })
    .expect(201);
});
after(async () => {
  if (context) await context.cleanup();
});

test('creates a tenant/unit repair and a property-wide request with generated IDs and initial history', async () => {
  const item = await create();
  assert.equal(item.status, 'SUBMITTED');
  assert.match(item.requestNumber, /^\d+$/);
  assert.equal(item.tenantId, tenantId);
  assert.equal(item.completedAt, null);
  assert.equal(item.createdByName, 'Mensah');
  assert.equal(item.version, 1);
  const saved = await get(item.id);
  assert.equal(saved.events.length, 1);
  assert.equal(saved.events[0].action, 'CREATED');
  assert.equal(saved.events[0].actorName, 'Mensah');
  const common = await create({
    unitId: null,
    tenantId: null,
    title: 'Lobby light',
    assignedTo: 'Electrician',
  });
  assert.equal(common.unitId, null);
  assert.equal(common.status, 'ASSIGNED');
  assert.notEqual(common.requestNumber, item.requestNumber);
  assert.equal((await owner.get(`/api/units/${unitId}`).expect(200)).body.unit.status, 'OCCUPIED');
});
test('assignment, start, completion, reopen and re-completion preserve activity and server completion timestamps', async () => {
  let item = await create();
  await owner
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ version: item.version, status: 'IN_PROGRESS' })
    .expect(400);
  item = (
    await owner
      .put(`/api/maintenance/${item.id}`)
      .set(headers)
      .send({ ...details, assignedTo: 'Kofi Plumbing', priority: 'HIGH', version: item.version })
      .expect(200)
  ).body.request;
  assert.equal(item.status, 'ASSIGNED');
  item = await status(item, 'IN_PROGRESS', 'Repair started');
  assert.equal(item.completedAt, null);
  item = await status(item, 'COMPLETED', 'Replaced drain seal');
  assert.ok(item.completedAt);
  const completedAt = item.completedAt;
  await owner
    .put(`/api/maintenance/${item.id}`)
    .set(headers)
    .send({ ...details, version: item.version })
    .expect(409);
  await owner
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ version: item.version, status: 'ASSIGNED' })
    .expect(400);
  item = await status(item, 'ASSIGNED', 'Leak returned');
  assert.equal(item.completedAt, null);
  item = await status(item, 'COMPLETED', 'Verified under running water');
  assert.ok(new Date(item.completedAt) >= new Date(completedAt));
  const history = (await get(item.id)).events;
  assert.equal(
    history.filter((entry: { toStatus: string }) => entry.toStatus === 'COMPLETED').length,
    2,
  );
  assert.ok(history.some((entry: { reason: string }) => entry.reason === 'Replaced drain seal'));
});
test('cancellation requires a reason, closed requests must reopen first, and assignee rules stay consistent', async () => {
  let item = await create();
  await owner
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ version: 1, status: 'CANCELLED', reason: ' ' })
    .expect(400);
  item = await status(item, 'CANCELLED', 'Duplicate report');
  assert.equal(item.completedAt, null);
  await owner
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ version: item.version, status: 'COMPLETED' })
    .expect(400);
  item = await status(item, 'SUBMITTED', 'Needs attention again');
  item = (
    await owner
      .put(`/api/maintenance/${item.id}`)
      .set(headers)
      .send({ ...details, version: item.version, assignedTo: 'Contractor' })
      .expect(200)
  ).body.request;
  await owner
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ version: item.version, status: 'SUBMITTED' })
    .expect(400);
  item = (
    await owner
      .put(`/api/maintenance/${item.id}`)
      .set(headers)
      .send({ ...details, version: item.version })
      .expect(200)
  ).body.request;
  assert.equal(item.status, 'SUBMITTED');
  item = (
    await owner
      .put(`/api/maintenance/${item.id}`)
      .set(headers)
      .send({ ...details, version: item.version, assignedTo: 'Contractor' })
      .expect(200)
  ).body.request;
  item = await status(item, 'IN_PROGRESS');
  await owner
    .put(`/api/maintenance/${item.id}`)
    .set(headers)
    .send({ ...details, version: item.version })
    .expect(400);
  item = await status(item, 'ASSIGNED');
  assert.equal(item.status, 'ASSIGNED');
});
test('concurrent status and detail updates reject stale versions without adding misleading history', async () => {
  const item = await create({ assignedTo: 'Repair Team' });
  const results = await Promise.all([
    owner
      .patch(`/api/maintenance/${item.id}/status`)
      .set(headers)
      .send({ version: item.version, status: 'IN_PROGRESS' }),
    owner
      .put(`/api/maintenance/${item.id}`)
      .set(headers)
      .send({
        ...details,
        version: item.version,
        title: 'Changed title',
        assignedTo: 'Repair Team',
      }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  const saved = await get(item.id);
  assert.equal(saved.request.version, 2);
  assert.equal(saved.events.length, 2);
  await owner
    .put(`/api/maintenance/${item.id}`)
    .set(headers)
    .send({ ...details, version: 1 })
    .expect(409);
});
test('search/filter/pagination includes linked tenant history and sorts open emergencies ahead of closed requests', async () => {
  const marker = `Filter%_${randomUUID()}`;
  const low = await create({ title: marker, priority: 'LOW' });
  const urgent = await create({ title: marker, priority: 'EMERGENCY' });
  let done = await create({ title: marker, priority: 'EMERGENCY' });
  done = await status(done, 'COMPLETED');
  const path = `/api/maintenance?q=${encodeURIComponent(marker)}&propertyId=${propertyId}&unitId=${unitId}&tenantId=${tenantId}`;
  const result = (await owner.get(`${path}&pageSize=2`).expect(200)).body;
  assert.equal(result.total, 3);
  assert.deepEqual(
    result.items.map((item: { id: string }) => item.id),
    [urgent.id, low.id],
  );
  assert.equal(
    (await owner.get(`${path}&pageSize=2&page=2`).expect(200)).body.items[0].id,
    done.id,
  );
  assert.equal(
    (await owner.get(`${path}&priority=EMERGENCY&status=SUBMITTED`).expect(200)).body.total,
    1,
  );
  assert.equal(
    (await owner.get(`/api/maintenance?q=${urgent.requestNumber}`).expect(200)).body.items.some(
      (item: { id: string }) => item.id === urgent.id,
    ),
    true,
  );
});
test('unit/property and tenant/unit links are validated; location fields remain fixed after creation', async () => {
  await owner
    .post('/api/maintenance')
    .set(headers)
    .send({ ...details, propertyId: secondPropertyId, unitId, tenantId })
    .expect(404);
  await owner
    .post('/api/maintenance')
    .set(headers)
    .send({ ...details, propertyId, tenantId })
    .expect(400);
  await owner
    .post('/api/maintenance')
    .set(headers)
    .send({ ...details, propertyId, unitId, tenantId: foreignTenantId })
    .expect(400);
  const unrelated = (
    await owner
      .post('/api/tenants')
      .set(headers)
      .send({ firstName: 'Other', lastName: 'Tenant' })
      .expect(201)
  ).body.tenant;
  await owner
    .post('/api/maintenance')
    .set(headers)
    .send({ ...details, propertyId, unitId, tenantId: unrelated.id })
    .expect(400);
  const item = await create();
  await owner
    .put(`/api/maintenance/${item.id}`)
    .set(headers)
    .send({ ...details, version: item.version, propertyId: secondPropertyId })
    .expect(400);
});
test('inactive properties reject new requests while existing repairs can be updated and completed', async () => {
  let item = await create();
  await owner
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: false })
    .expect(200);
  try {
    await owner
      .post('/api/maintenance')
      .set(headers)
      .send({ ...details, propertyId })
      .expect(409);
    item = (
      await owner
        .put(`/api/maintenance/${item.id}`)
        .set(headers)
        .send({ ...details, version: item.version, notes: 'Finish existing repair' })
        .expect(200)
    ).body.request;
    item = await status(item, 'COMPLETED');
    assert.equal(item.propertyActive, false);
  } finally {
    await owner
      .patch(`/api/properties/${propertyId}/status`)
      .set(headers)
      .send({ active: true })
      .expect(200);
  }
});
test('company isolation covers list/details/options/writes and database foreign keys reject cross-company actors and links', async () => {
  const item = await create();
  await other.get(`/api/maintenance/${item.id}`).expect(404);
  await other
    .put(`/api/maintenance/${item.id}`)
    .set(headers)
    .send({ ...details, version: 1 })
    .expect(404);
  await other
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ version: 1, status: 'COMPLETED' })
    .expect(404);
  await other
    .post('/api/maintenance')
    .set(headers)
    .send({ ...details, propertyId, unitId, tenantId })
    .expect(404);
  await owner
    .post('/api/maintenance')
    .set(headers)
    .send({ ...details, propertyId, unitId: foreignUnitId })
    .expect(404);
  const list = (
    await other.get(`/api/maintenance?tenantId=${tenantId}&propertyId=${propertyId}`).expect(200)
  ).body;
  assert.equal(list.total, 0);
  const options = (await other.get('/api/maintenance/options').expect(200)).body;
  assert.ok(options.properties.every((property: { id: string }) => property.id !== propertyId));
  assert.ok(options.units.every((unit: { id: string }) => unit.id !== unitId));
  assert.ok(options.tenants.every((tenant: { id: string }) => tenant.id !== tenantId));
  await assert.rejects(
    context.database.query(
      'UPDATE maintenance_requests SET tenant_id=$1 WHERE company_id=$2 AND id=$3',
      [foreignTenantId, companyId, item.id],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    context.database.query(
      'UPDATE maintenance_requests SET property_id=$1 WHERE company_id=$2 AND id=$3',
      [secondPropertyId, companyId, item.id],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    context.database.query(
      'UPDATE maintenance_requests SET created_by=$1 WHERE company_id=$2 AND id=$3',
      [otherId, companyId, item.id],
    ),
    { code: '23503' },
  );
  await assert.rejects(
    context.database.query('UPDATE maintenance_events SET company_id=$1 WHERE request_id=$2', [
      otherCompanyId,
      item.id,
    ]),
    { code: '23503' },
  );
});
test('input validation, session protection, and manager access apply to maintenance', async () => {
  await request(app).get('/api/maintenance').expect(401);
  await request(app).get('/api/maintenance/options').expect(401);
  for (const change of [
    { title: ' ' },
    { description: '' },
    { priority: 'URGENT' },
    { submittedDate: '2026-02-30' },
    { submittedDate: '9999-12-31' },
    { companyId },
    { status: 'COMPLETED' },
    { completedAt: today() },
  ])
    await owner
      .post('/api/maintenance')
      .set(headers)
      .send({ ...details, propertyId, ...change })
      .expect(400);
  await owner
    .post('/api/maintenance')
    .send({ ...details, propertyId })
    .expect(403);
  await owner.get('/api/maintenance?pageSize=1000').expect(400);
  const item = await create();
  await owner
    .patch(`/api/maintenance/${item.id}/status`)
    .set(headers)
    .send({ status: 'COMPLETED' })
    .expect(400);
  await context.database.query("UPDATE users SET role='MANAGER' WHERE company_id=$1 AND id=$2", [
    companyId,
    ownerId,
  ]);
  try {
    const managed = await create({ unitId: null, tenantId: null });
    assert.equal((await status(managed, 'COMPLETED')).status, 'COMPLETED');
  } finally {
    await context.database.query("UPDATE users SET role='OWNER' WHERE company_id=$1 AND id=$2", [
      companyId,
      ownerId,
    ]);
  }
});
