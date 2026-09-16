import type { Pool } from 'pg';
import type { TenantInput, TenantQuery } from '../validation/tenancy.js';

const columns = `t.id, t.first_name AS "firstName", t.last_name AS "lastName", t.phone, t.email,
 t.emergency_contact_name AS "emergencyContactName", t.emergency_contact_phone AS "emergencyContactPhone",
 t.notes, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
 l.id AS "currentLeaseId", u.id AS "currentUnitId", u.name AS "currentUnitName",
 p.id AS "currentPropertyId", p.name AS "currentPropertyName"`;
const joins = `LEFT JOIN lease_details l ON l.company_id=t.company_id AND l.tenant_id=t.id AND l.status='ACTIVE'
 LEFT JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id
 LEFT JOIN properties p ON p.company_id=u.company_id AND p.id=u.property_id`;

export async function findTenant(database: Pool, companyId: string, id: string) {
  return (
    await database.query(
      `SELECT ${columns} FROM tenants t ${joins} WHERE t.company_id=$1 AND t.id=$2`,
      [companyId, id],
    )
  ).rows[0];
}
export async function listTenants(database: Pool, companyId: string, query: TenantQuery) {
  const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const params = [companyId, search, query.housing];
  const where = `t.company_id=$1 AND (concat_ws(' ',t.first_name,t.last_name) ILIKE $2 OR t.email ILIKE $2 OR t.phone ILIKE $2)
    AND ($3='all' OR ($3='housed' AND l.id IS NOT NULL) OR ($3='unassigned' AND l.id IS NULL))`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${columns} FROM tenants t ${joins} WHERE ${where} ORDER BY t.last_name,t.first_name,t.id LIMIT $4 OFFSET $5`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(`SELECT count(*)::int AS total FROM tenants t ${joins} WHERE ${where}`, params),
  ]);
  return {
    items: items.rows,
    total: total.rows[0].total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
export async function saveTenant(
  database: Pool,
  companyId: string,
  input: TenantInput,
  id?: string,
) {
  const values = [
    companyId,
    input.firstName,
    input.lastName,
    input.phone,
    input.email,
    input.emergencyContactName,
    input.emergencyContactPhone,
    input.notes,
  ];
  const result = id
    ? await database.query(
        `UPDATE tenants SET first_name=$2,last_name=$3,phone=$4,email=$5,emergency_contact_name=$6,emergency_contact_phone=$7,notes=$8,updated_at=now() WHERE company_id=$1 AND id=$9 RETURNING id`,
        [...values, id],
      )
    : await database.query(
        `INSERT INTO tenants(company_id,first_name,last_name,phone,email,emergency_contact_name,emergency_contact_phone,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        values,
      );
  return result.rowCount ? findTenant(database, companyId, result.rows[0].id) : undefined;
}
