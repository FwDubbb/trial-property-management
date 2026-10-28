import type { Pool, PoolClient } from 'pg';
import { findMaintenance } from '../repositories/maintenanceRepository.js';
import { ApiError } from '../utils/ApiError.js';
import type {
  MaintenanceCreate,
  MaintenanceUpdate,
  MaintenanceStatus,
} from '../validation/maintenance.js';
const closed = (status: string) => ['COMPLETED', 'CANCELLED'].includes(status);
async function event(
  client: PoolClient,
  companyId: string,
  userId: string,
  id: string,
  action: string,
  from: string | null,
  to: string,
  assignedTo: string,
  priority: string,
  reason = '',
) {
  await client.query(
    `INSERT INTO maintenance_events(company_id,request_id,actor_id,action,from_status,to_status,assigned_to,priority,reason)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [companyId, id, userId, action, from, to, assignedTo, priority, reason],
  );
}
async function transaction<T>(database: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
async function lockRequest(client: PoolClient, companyId: string, id: string, version: number) {
  const row = (
    await client.query(
      'SELECT id,version FROM maintenance_requests WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [companyId, id],
    )
  ).rows[0];
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Maintenance request not found.');
  if (row.version !== version)
    throw new ApiError(
      409,
      'STALE_REQUEST',
      'This request changed since you opened it. Reload the page to review the latest details before saving.',
    );
  return (await findMaintenance(client, companyId, id))!;
}
export async function createMaintenance(
  database: Pool,
  companyId: string,
  userId: string,
  input: MaintenanceCreate,
) {
  return transaction(database, async (client) => {
    // Serialize with property deactivation and unit changes; maintenance never changes occupancy.
    const parent = (
      await client.query('SELECT active FROM properties WHERE company_id=$1 AND id=$2 FOR UPDATE', [
        companyId,
        input.propertyId,
      ])
    ).rows[0];
    if (!parent) throw new ApiError(404, 'NOT_FOUND', 'Property not found.');
    if (!parent.active)
      throw new ApiError(
        409,
        'PROPERTY_INACTIVE',
        'Reactivate this property before creating a maintenance request.',
      );
    if (input.unitId) {
      const unit = await client.query(
        'SELECT id FROM units WHERE company_id=$1 AND property_id=$2 AND id=$3',
        [companyId, input.propertyId, input.unitId],
      );
      if (!unit.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Unit not found in this property.');
    }
    if (input.tenantId) {
      const tenant = await client.query(
        `SELECT t.id FROM tenants t WHERE t.company_id=$1 AND t.id=$2 AND EXISTS
      (SELECT 1 FROM leases l WHERE l.company_id=t.company_id AND l.tenant_id=t.id AND l.unit_id=$3)`,
        [companyId, input.tenantId, input.unitId],
      );
      if (!tenant.rowCount)
        throw new ApiError(
          400,
          'TENANT_UNIT_MISMATCH',
          'Select a tenant with a lease for this unit, or leave the tenant blank.',
        );
    }
    const status = input.assignedTo ? 'ASSIGNED' : 'SUBMITTED';
    const saved = await client.query(
      `INSERT INTO maintenance_requests(company_id,property_id,unit_id,tenant_id,title,description,priority,status,submitted_date,assigned_to,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        companyId,
        input.propertyId,
        input.unitId,
        input.tenantId,
        input.title,
        input.description,
        input.priority,
        status,
        input.submittedDate,
        input.assignedTo,
        input.notes,
        userId,
      ],
    );
    const id = saved.rows[0].id;
    await event(
      client,
      companyId,
      userId,
      id,
      'CREATED',
      null,
      status,
      input.assignedTo,
      input.priority,
    );
    return findMaintenance(client, companyId, id);
  });
}
export async function updateMaintenance(
  database: Pool,
  companyId: string,
  userId: string,
  id: string,
  input: MaintenanceUpdate,
) {
  return transaction(database, async (client) => {
    const current = await lockRequest(client, companyId, id, input.version);
    if (closed(current.status))
      throw new ApiError(409, 'REQUEST_CLOSED', 'Reopen this request before editing its details.');
    if (current.status === 'IN_PROGRESS' && !input.assignedTo)
      throw new ApiError(
        400,
        'ASSIGNEE_REQUIRED',
        'Keep an assigned person while work is in progress.',
      );
    const status = ['SUBMITTED', 'ASSIGNED'].includes(current.status)
      ? input.assignedTo
        ? 'ASSIGNED'
        : 'SUBMITTED'
      : current.status;
    await client.query(
      `UPDATE maintenance_requests SET title=$3,description=$4,priority=$5,submitted_date=$6,assigned_to=$7,notes=$8,status=$9,version=version+1,updated_at=now()
      WHERE company_id=$1 AND id=$2`,
      [
        companyId,
        id,
        input.title,
        input.description,
        input.priority,
        input.submittedDate,
        input.assignedTo,
        input.notes,
        status,
      ],
    );
    await event(
      client,
      companyId,
      userId,
      id,
      'UPDATED',
      current.status,
      status,
      input.assignedTo,
      input.priority,
    );
    return findMaintenance(client, companyId, id);
  });
}
export async function changeMaintenanceStatus(
  database: Pool,
  companyId: string,
  userId: string,
  id: string,
  input: MaintenanceStatus,
) {
  return transaction(database, async (client) => {
    const current = await lockRequest(client, companyId, id, input.version);
    if (current.status === input.status)
      throw new ApiError(409, 'SAME_STATUS', 'This request already has that status.');
    const reopening = closed(current.status);
    if (reopening && input.status !== (current.assignedTo ? 'ASSIGNED' : 'SUBMITTED'))
      throw new ApiError(
        400,
        'INVALID_TRANSITION',
        'Reopen this request before changing its status.',
      );
    if ((reopening || input.status === 'CANCELLED') && !input.reason)
      throw new ApiError(
        400,
        'REASON_REQUIRED',
        'Enter a reason for cancelling or reopening the request.',
      );
    if (['ASSIGNED', 'IN_PROGRESS'].includes(input.status) && !current.assignedTo)
      throw new ApiError(400, 'ASSIGNEE_REQUIRED', 'Assign a person before starting work.');
    if (input.status === 'SUBMITTED' && current.assignedTo)
      throw new ApiError(
        400,
        'HAS_ASSIGNEE',
        'Remove the assigned person in Edit request to return to Submitted.',
      );
    await client.query(
      `UPDATE maintenance_requests SET status=$3::text,completed_at=CASE WHEN $3::text='COMPLETED' THEN now() ELSE NULL END,
      version=version+1,updated_at=now() WHERE company_id=$1 AND id=$2`,
      [companyId, id, input.status],
    );
    await event(
      client,
      companyId,
      userId,
      id,
      'STATUS_CHANGED',
      current.status,
      input.status,
      current.assignedTo,
      current.priority,
      input.reason,
    );
    return findMaintenance(client, companyId, id);
  });
}
