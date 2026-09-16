import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
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
let unitId: string;
const headers = { 'X-Requested-With': 'PropertyPlatform', Origin: 'http://127.0.0.1:5173' };
const propertyInput = {
  name: 'Mensah Apartments',
  address: '123 Example Street',
  city: 'Accra',
  region: 'Greater Accra',
  country: 'Ghana',
  propertyType: 'APARTMENT',
  notes: 'Near the park.',
};
const unitInput = {
  name: '1A',
  bedrooms: 2,
  bathrooms: 1.5,
  monthlyRent: 1250.5,
  status: 'VACANT',
  notes: 'Top floor.',
};

before(async () => {
  context = await createTestDatabase();
  app = createApp(async () => {}, context.database);
  owner = request.agent(app);
  other = request.agent(app);
  const account = await owner
    .post('/api/auth/register')
    .set(headers)
    .send({
      companyName: 'Mensah Properties',
      name: 'John',
      email: 'john@example.test',
      password: 'Company A password 2026!',
    })
    .expect(201);
  companyId = account.body.user.companyId;
  await other
    .post('/api/auth/register')
    .set(headers)
    .send({
      companyName: 'Smith Group',
      name: 'David',
      email: 'david@example.test',
      password: 'Company B password 2026!',
    })
    .expect(201);
  const property = await owner.post('/api/properties').set(headers).send(propertyInput).expect(201);
  propertyId = property.body.property.id;
  otherPropertyId = (
    await other
      .post('/api/properties')
      .set(headers)
      .send({ ...propertyInput, name: 'Smith House' })
      .expect(201)
  ).body.property.id;
  unitId = (
    await owner
      .post('/api/units')
      .set(headers)
      .send({ ...unitInput, propertyId })
      .expect(201)
  ).body.unit.id;
});
after(async () => {
  if (context) await context.cleanup();
});

test('properties and units are protected and scoped to the signed-in company', async () => {
  await request(app).get('/api/properties').expect(401);
  await request(app).get('/api/units').expect(401);
  const properties = await owner.get('/api/properties').expect(200);
  assert.deepEqual(
    properties.body.items.map((item: { id: string }) => item.id),
    [propertyId],
  );
  assert.equal(properties.body.items[0].unitCount, 1);
  const otherUnits = await other.get('/api/units').expect(200);
  assert.equal(otherUnits.body.total, 0);
  await other.get(`/api/properties/${propertyId}`).expect(404);
  await other.get(`/api/units/${unitId}`).expect(404);
  await other.put(`/api/properties/${propertyId}`).set(headers).send(propertyInput).expect(404);
  await other
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: false })
    .expect(404);
  await other
    .put(`/api/units/${unitId}`)
    .set(headers)
    .send({ ...unitInput, propertyId })
    .expect(404);
  await owner
    .post('/api/units')
    .set(headers)
    .send({ ...unitInput, propertyId: otherPropertyId })
    .expect(404);
  const filtered = await other.get(`/api/units?propertyId=${propertyId}`).expect(200);
  assert.equal(filtered.body.total, 0);
  const options = await other.get('/api/properties/options').expect(200);
  assert.deepEqual(
    options.body.items.map((item: { id: string }) => item.id),
    [otherPropertyId],
  );
  const summary = await other.get('/api/properties/summary').expect(200);
  assert.equal(summary.body.properties, 1);
  assert.equal(summary.body.units, 0);
});

test('company identity cannot be injected through bodies or query strings', async () => {
  await owner
    .post('/api/properties')
    .set(headers)
    .send({ ...propertyInput, companyId: randomUUID() })
    .expect(400);
  await owner
    .put(`/api/properties/${propertyId}`)
    .set(headers)
    .send({ ...propertyInput, companyId: randomUUID() })
    .expect(400);
  await owner
    .post('/api/units')
    .set(headers)
    .send({ ...unitInput, propertyId, companyId: randomUUID() })
    .expect(400);
  await owner.get(`/api/properties?companyId=${randomUUID()}`).expect(400);
  await owner.get('/api/properties/not-a-uuid').expect(400);
  await owner.get(`/api/properties/${randomUUID()}`).expect(404);
});

test('database rejects cross-company foreign keys even outside the API', async () => {
  await assert.rejects(
    context.database.query(
      `INSERT INTO units(company_id, property_id, name, bedrooms, bathrooms, monthly_rent, status)
    VALUES ($1,$2,'Illegal',1,1,100,'VACANT')`,
      [companyId, otherPropertyId],
    ),
    (error: unknown) => (error as { code: string }).code === '23503',
  );
});

test('property and unit updates persist; duplicate and invalid units are rejected', async () => {
  const property = await owner
    .put(`/api/properties/${propertyId}`)
    .set(headers)
    .send({ ...propertyInput, notes: 'Updated notes' })
    .expect(200);
  assert.equal(property.body.property.notes, 'Updated notes');
  const unit = await owner
    .put(`/api/units/${unitId}`)
    .set(headers)
    .send({ ...unitInput, propertyId, monthlyRent: 1500.25, status: 'OCCUPIED' })
    .expect(200);
  assert.equal(unit.body.unit.monthlyRent, '1500.25');
  assert.equal(unit.body.unit.status, 'OCCUPIED');
  await owner
    .post('/api/units')
    .set(headers)
    .send({ ...unitInput, propertyId, name: '1a' })
    .expect(409);
  for (const changed of [
    { monthlyRent: -1 },
    { monthlyRent: 1.234 },
    { monthlyRent: 1.000001 },
    { bedrooms: 1.2 },
    { bathrooms: 1.2 },
    { status: 'INVALID' },
    { name: ' ' },
  ]) {
    await owner
      .post('/api/units')
      .set(headers)
      .send({ ...unitInput, propertyId, ...changed })
      .expect(400);
  }
  await owner
    .put(`/api/units/${unitId}`)
    .set(headers)
    .send({ ...unitInput, propertyId: otherPropertyId })
    .expect(400);
});

test('search, filters, pagination, and summary reflect real records', async () => {
  await owner
    .post('/api/units')
    .set(headers)
    .send({ ...unitInput, propertyId, name: '2B', status: 'MAINTENANCE' })
    .expect(201);
  const page = await owner.get('/api/units?pageSize=1&page=2').expect(200);
  assert.equal(page.body.total, 2);
  assert.equal(page.body.items.length, 1);
  assert.equal(page.body.items[0].name, '2B');
  const status = await owner.get('/api/units?status=OCCUPIED').expect(200);
  assert.equal(status.body.total, 1);
  const search = await owner.get('/api/units?q=2b').expect(200);
  assert.equal(search.body.items[0].name, '2B');
  const noMatch = await owner.get('/api/properties?q=Smith').expect(200);
  assert.equal(noMatch.body.total, 0);
  const injection = await owner.get('/api/properties').query({ q: "' OR 1=1 --" }).expect(200);
  assert.equal(injection.body.total, 0);
  const summary = await owner.get('/api/properties/summary').expect(200);
  assert.deepEqual(summary.body, { properties: 1, units: 2, occupied: 1, vacant: 0 });
});

test('deactivation preserves units, blocks edits, hides active counts, and can be reversed', async () => {
  await owner
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: false })
    .expect(200);
  const properties = await owner.get('/api/properties').expect(200);
  assert.equal(properties.body.total, 0);
  const units = await owner.get('/api/units').expect(200);
  assert.equal(units.body.total, 0);
  const inactive = await owner
    .get(`/api/units?propertyStatus=inactive&propertyId=${propertyId}`)
    .expect(200);
  assert.equal(inactive.body.total, 2);
  await owner
    .post('/api/units')
    .set(headers)
    .send({ ...unitInput, propertyId, name: '3C' })
    .expect(409);
  await owner
    .put(`/api/units/${unitId}`)
    .set(headers)
    .send({ ...unitInput, propertyId })
    .expect(409);
  const summary = await owner.get('/api/properties/summary').expect(200);
  assert.deepEqual(summary.body, { properties: 0, units: 0, occupied: 0, vacant: 0 });
  await owner
    .patch(`/api/properties/${propertyId}/status`)
    .set(headers)
    .send({ active: true })
    .expect(200);
  assert.equal((await owner.get(`/api/units/${unitId}`).expect(200)).body.unit.status, 'OCCUPIED');
});

test('MANAGER can manage its own portfolio and still cannot access other companies', async () => {
  await context.database.query("UPDATE users SET role='MANAGER' WHERE company_id=$1", [companyId]);
  await owner.put(`/api/properties/${propertyId}`).set(headers).send(propertyInput).expect(200);
  await owner
    .put(`/api/units/${unitId}`)
    .set(headers)
    .send({ ...unitInput, propertyId })
    .expect(200);
  await owner.get(`/api/properties/${otherPropertyId}`).expect(404);
});
