import type { Pool, PoolClient } from 'pg';
import type { LeaseQuery } from '../validation/tenancy.js';

const columns = `l.id, l.tenant_id AS "tenantId", concat_ws(' ',t.first_name,t.last_name) AS "tenantName",
 l.unit_id AS "unitId", u.name AS "unitName", p.id AS "propertyId", p.name AS "propertyName", p.active AS "propertyActive",
 l.start_date::text AS "startDate", l.end_date::text AS "endDate", l.monthly_rent::text AS "monthlyRent",
 l.security_deposit::text AS "securityDeposit", l.status, l.notes, l.terminated_at AS "terminatedAt",
 l.termination_reason AS "terminationReason", l.created_at AS "createdAt", l.updated_at AS "updatedAt"`;
const joins = `JOIN tenants t ON t.company_id=l.company_id AND t.id=l.tenant_id
 JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id
 JOIN properties p ON p.company_id=u.company_id AND p.id=u.property_id`;
export async function findLease(database: Pool | PoolClient, companyId: string, id: string) {
  return (
    await database.query(
      `SELECT ${columns} FROM lease_details l ${joins} WHERE l.company_id=$1 AND l.id=$2`,
      [companyId, id],
    )
  ).rows[0];
}
export async function listLeases(database: Pool, companyId: string, query: LeaseQuery) {
  const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const params = [
    companyId,
    search,
    query.status || null,
    query.tenantId || null,
    query.unitId || null,
    query.propertyId || null,
  ];
  const where = `l.company_id=$1 AND (concat_ws(' ',t.first_name,t.last_name) ILIKE $2 OR u.name ILIKE $2 OR p.name ILIKE $2)
    AND ($3::text IS NULL OR l.status=$3) AND ($4::uuid IS NULL OR l.tenant_id=$4)
    AND ($5::uuid IS NULL OR l.unit_id=$5) AND ($6::uuid IS NULL OR p.id=$6)`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${columns} FROM lease_details l ${joins} WHERE ${where} ORDER BY l.start_date DESC,l.id LIMIT $7 OFFSET $8`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(
      `SELECT count(*)::int AS total FROM lease_details l ${joins} WHERE ${where}`,
      params,
    ),
  ]);
  return {
    items: items.rows,
    total: total.rows[0].total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
