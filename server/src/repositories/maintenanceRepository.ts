import type { Pool, PoolClient } from 'pg';
import type { MaintenanceQuery } from '../validation/maintenance.js';
const columns = `m.id,m.request_number::text AS "requestNumber",m.property_id AS "propertyId",p.name AS "propertyName",p.active AS "propertyActive",
 m.unit_id AS "unitId",u.name AS "unitName",m.tenant_id AS "tenantId",CASE WHEN t.id IS NOT NULL THEN concat_ws(' ',t.first_name,t.last_name) END AS "tenantName",
 m.title,m.description,m.priority,m.status,m.submitted_date::text AS "submittedDate",m.assigned_to AS "assignedTo",m.notes,
 m.completed_at AS "completedAt",m.created_at AS "createdAt",m.updated_at AS "updatedAt",m.version,creator.name AS "createdByName"`;
const joins = `JOIN properties p ON p.company_id=m.company_id AND p.id=m.property_id
 LEFT JOIN units u ON u.company_id=m.company_id AND u.id=m.unit_id
 LEFT JOIN tenants t ON t.company_id=m.company_id AND t.id=m.tenant_id
 JOIN users creator ON creator.company_id=m.company_id AND creator.id=m.created_by`;
export async function findMaintenance(database: Pool | PoolClient, companyId: string, id: string) {
  return (
    await database.query(
      `SELECT ${columns} FROM maintenance_requests m ${joins} WHERE m.company_id=$1 AND m.id=$2`,
      [companyId, id],
    )
  ).rows[0];
}
export async function maintenanceEvents(
  database: Pool | PoolClient,
  companyId: string,
  id: string,
) {
  return (
    await database.query(
      `SELECT e.id,e.action,e.from_status AS "fromStatus",e.to_status AS "toStatus",e.assigned_to AS "assignedTo",
    e.priority,e.reason,e.created_at AS "createdAt",u.name AS "actorName" FROM maintenance_events e
    JOIN users u ON u.company_id=e.company_id AND u.id=e.actor_id WHERE e.company_id=$1 AND e.request_id=$2 ORDER BY e.created_at DESC,e.id`,
      [companyId, id],
    )
  ).rows;
}
export async function listMaintenance(database: Pool, companyId: string, query: MaintenanceQuery) {
  const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  const params = [
    companyId,
    search,
    query.status || null,
    query.priority || null,
    query.propertyId || null,
    query.unitId || null,
    query.tenantId || null,
  ];
  const where = `m.company_id=$1 AND (m.title ILIKE $2 OR m.description ILIKE $2 OR m.request_number::text ILIKE $2 OR m.assigned_to ILIKE $2 OR p.name ILIKE $2 OR u.name ILIKE $2 OR concat_ws(' ',t.first_name,t.last_name) ILIKE $2)
    AND ($3::text IS NULL OR m.status=$3) AND ($4::text IS NULL OR m.priority=$4) AND ($5::uuid IS NULL OR m.property_id=$5)
    AND ($6::uuid IS NULL OR m.unit_id=$6) AND ($7::uuid IS NULL OR m.tenant_id=$7)`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${columns} FROM maintenance_requests m ${joins} WHERE ${where}
      ORDER BY CASE WHEN m.status IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END,
      CASE m.priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      m.submitted_date DESC,m.request_number DESC LIMIT $8 OFFSET $9`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(
      `SELECT count(*)::int AS total FROM maintenance_requests m ${joins} WHERE ${where}`,
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
export async function maintenanceOptions(database: Pool, companyId: string) {
  const [properties, units, tenants] = await Promise.all([
    database.query('SELECT id,name,active FROM properties WHERE company_id=$1 ORDER BY name,id', [
      companyId,
    ]),
    database.query(
      'SELECT id,name,property_id AS "propertyId" FROM units WHERE company_id=$1 ORDER BY name,id',
      [companyId],
    ),
    database.query(
      `SELECT t.id,concat_ws(' ',t.first_name,t.last_name) AS name,array_agg(DISTINCT l.unit_id) AS "unitIds"
      FROM tenants t JOIN leases l ON l.company_id=t.company_id AND l.tenant_id=t.id WHERE t.company_id=$1 GROUP BY t.id ORDER BY t.last_name,t.first_name,t.id`,
      [companyId],
    ),
  ]);
  return { properties: properties.rows, units: units.rows, tenants: tenants.rows };
}
