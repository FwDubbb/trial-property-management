import type { Pool, PoolClient } from 'pg';
import type { PropertyInput, PropertyQuery } from '../validation/portfolio.js';

const columns = `p.id, p.name, p.address, p.city, p.region, p.country, p.property_type AS "propertyType",
  p.notes, p.active, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
  (SELECT count(*)::int FROM units u WHERE u.company_id = p.company_id AND u.property_id = p.id) AS "unitCount",
  (SELECT count(*)::int FROM unit_occupancy u WHERE u.company_id = p.company_id AND u.property_id = p.id AND u.occupancy_status = 'OCCUPIED') AS "occupiedCount"`;

// Company identity is always passed from request.user, never from request bodies or query strings.
export async function findProperty(database: Pool | PoolClient, companyId: string, id: string) {
  const result = await database.query(
    `SELECT ${columns} FROM properties p WHERE p.company_id = $1 AND p.id = $2`,
    [companyId, id],
  );
  return result.rows[0];
}

export async function listProperties(database: Pool, companyId: string, query: PropertyQuery) {
  const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const params = [companyId, search, query.status, query.type || null];
  const where = `p.company_id = $1 AND (p.name ILIKE $2 OR p.address ILIKE $2 OR p.city ILIKE $2 OR p.country ILIKE $2)
    AND ($3 = 'all' OR p.active = ($3 = 'active')) AND ($4::text IS NULL OR p.property_type = $4)`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${columns} FROM properties p WHERE ${where} ORDER BY p.created_at DESC, p.id
      LIMIT $5 OFFSET $6`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(`SELECT count(*)::int AS total FROM properties p WHERE ${where}`, params),
  ]);
  return {
    items: items.rows,
    total: total.rows[0].total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function insertProperty(database: Pool, companyId: string, input: PropertyInput) {
  const result = await database.query(
    `INSERT INTO properties(company_id, name, address, city, region, country, property_type, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      companyId,
      input.name,
      input.address,
      input.city,
      input.region,
      input.country,
      input.propertyType,
      input.notes,
    ],
  );
  return findProperty(database, companyId, result.rows[0].id);
}

export async function updateProperty(
  database: Pool,
  companyId: string,
  id: string,
  input: PropertyInput,
) {
  const result = await database.query(
    `UPDATE properties SET name=$3, address=$4, city=$5, region=$6, country=$7,
    property_type=$8, notes=$9, updated_at=now() WHERE company_id=$1 AND id=$2 RETURNING id`,
    [
      companyId,
      id,
      input.name,
      input.address,
      input.city,
      input.region,
      input.country,
      input.propertyType,
      input.notes,
    ],
  );
  return result.rowCount ? findProperty(database, companyId, id) : undefined;
}

export async function setPropertyStatus(
  database: Pool,
  companyId: string,
  id: string,
  active: boolean,
) {
  const result = await database.query(
    'UPDATE properties SET active=$3, updated_at=now() WHERE company_id=$1 AND id=$2 RETURNING id',
    [companyId, id, active],
  );
  return result.rowCount ? findProperty(database, companyId, id) : undefined;
}

export async function portfolioSummary(database: Pool, companyId: string) {
  const properties = await database.query(
    'SELECT count(*)::int AS total FROM properties WHERE company_id=$1 AND active=true',
    [companyId],
  );
  const units = await database.query(
    `SELECT count(*)::int AS total,
    count(*) FILTER (WHERE u.occupancy_status='OCCUPIED')::int AS occupied,
    count(*) FILTER (WHERE u.occupancy_status='VACANT')::int AS vacant
    FROM unit_occupancy u JOIN properties p ON p.id=u.property_id AND p.company_id=u.company_id
    WHERE u.company_id=$1 AND p.active=true`,
    [companyId],
  );
  return {
    properties: properties.rows[0].total,
    units: units.rows[0].total,
    occupied: units.rows[0].occupied,
    vacant: units.rows[0].vacant,
  };
}
