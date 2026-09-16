import type { Pool, PoolClient } from 'pg';
import type { UnitQuery } from '../validation/portfolio.js';

const columns = `u.id, u.property_id AS "propertyId", p.name AS "propertyName", p.active AS "propertyActive",
  u.name, u.bedrooms, u.bathrooms::float8 AS bathrooms, u.monthly_rent::text AS "monthlyRent",
  u.status, u.notes, u.created_at AS "createdAt", u.updated_at AS "updatedAt"`;
const join = 'JOIN properties p ON p.id=u.property_id AND p.company_id=u.company_id';

export async function findUnit(database: Pool | PoolClient, companyId: string, id: string) {
  const result = await database.query(
    `SELECT ${columns} FROM units u ${join} WHERE u.company_id=$1 AND u.id=$2`,
    [companyId, id],
  );
  return result.rows[0];
}

export async function listUnits(database: Pool, companyId: string, query: UnitQuery) {
  const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const params = [
    companyId,
    search,
    query.status || null,
    query.propertyId || null,
    query.propertyStatus,
  ];
  const where = `u.company_id=$1 AND (u.name ILIKE $2 OR p.name ILIKE $2)
    AND ($3::text IS NULL OR u.status=$3) AND ($4::uuid IS NULL OR u.property_id=$4)
    AND ($5='all' OR p.active=($5='active'))`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${columns} FROM units u ${join} WHERE ${where} ORDER BY p.name, u.name, u.id
      LIMIT $6 OFFSET $7`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(`SELECT count(*)::int AS total FROM units u ${join} WHERE ${where}`, params),
  ]);
  return {
    items: items.rows,
    total: total.rows[0].total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
