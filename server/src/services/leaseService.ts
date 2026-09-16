import type { Pool } from 'pg';
import { findLease } from '../repositories/leaseRepository.js';
import { ApiError } from '../utils/ApiError.js';
import type { LeaseInput } from '../validation/tenancy.js';

export async function saveLease(database: Pool, companyId: string, input: LeaseInput, id?: string) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const unit = await client.query(
      `SELECT u.id,u.property_id,p.active FROM units u
      JOIN properties p ON p.company_id=u.company_id AND p.id=u.property_id WHERE u.company_id=$1 AND u.id=$2`,
      [companyId, input.unitId],
    );
    if (!unit.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Unit not found.');
    // Use the same parent lock as unit edits, preventing availability/deactivation races.
    const parent = await client.query(
      'SELECT active FROM properties WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [companyId, unit.rows[0].property_id],
    );
    if (!parent.rows[0]?.active)
      throw new ApiError(
        409,
        'PROPERTY_INACTIVE',
        'Reactivate this property before creating or editing leases.',
      );
    if (id) {
      const existing = await findLease(client, companyId, id);
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Lease not found.');
      if (existing.unitId !== input.unitId || existing.tenantId !== input.tenantId)
        throw new ApiError(
          400,
          'LEASE_PARTIES_FIXED',
          'The tenant and unit cannot be changed on an existing lease.',
        );
      if (['EXPIRED', 'TERMINATED'].includes(existing.status))
        throw new ApiError(
          409,
          'LEASE_CLOSED',
          'Ended leases are read-only. Create a new lease instead.',
        );
    }
    const tenant = await client.query(
      'SELECT id FROM tenants WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [companyId, input.tenantId],
    );
    if (!tenant.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Tenant not found.');
    const state = (
      await client.query(
        `SELECT occupancy_status,active_lease_id,has_upcoming_lease,
      (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date::text AS today FROM unit_occupancy WHERE company_id=$1 AND id=$2`,
        [companyId, input.unitId],
      )
    ).rows[0];
    const live = input.endDate >= state.today;
    if (live && ['MAINTENANCE', 'UNAVAILABLE'].includes(state.occupancy_status))
      throw new ApiError(
        409,
        'UNIT_UNAVAILABLE',
        'Make the unit vacant before creating a current or upcoming lease.',
      );
    if (
      live &&
      input.startDate > state.today &&
      state.occupancy_status === 'OCCUPIED' &&
      !state.active_lease_id
    )
      throw new ApiError(
        409,
        'MANUAL_OCCUPANCY',
        'This unit is manually occupied. Record its current lease or mark it vacant before scheduling a future lease.',
      );
    const values = [
      companyId,
      input.tenantId,
      input.unitId,
      input.startDate,
      input.endDate,
      input.monthlyRent,
      input.securityDeposit,
      input.notes,
    ];
    const result = id
      ? await client.query(
          `UPDATE leases SET start_date=$4,end_date=$5,monthly_rent=$6,security_deposit=$7,notes=$8,updated_at=now()
          WHERE company_id=$1 AND tenant_id=$2 AND unit_id=$3 AND id=$9 RETURNING id`,
          [...values, id],
        )
      : await client.query(
          `INSERT INTO leases(company_id,tenant_id,unit_id,start_date,end_date,monthly_rent,security_deposit,notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          values,
        );
    if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Lease not found.');
    // Live occupancy is supplied by the view. Its fallback is vacant when the lease ends.
    // Importing old history must not change a currently manually occupied unit.
    if (live || id)
      await client.query(
        "UPDATE units SET status='VACANT',updated_at=now() WHERE company_id=$1 AND id=$2",
        [companyId, input.unitId],
      );
    const lease = await findLease(client, companyId, result.rows[0].id);
    await client.query('COMMIT');
    return lease;
  } catch (error) {
    await client.query('ROLLBACK');
    const dbError = error as { code?: string; constraint?: string };
    if (dbError.code === '23P01')
      throw new ApiError(
        409,
        'LEASE_OVERLAP',
        dbError.constraint === 'leases_tenant_no_overlap'
          ? 'This tenant already has a lease during those dates. Choose non-overlapping dates.'
          : 'This unit already has a lease during those dates. Choose non-overlapping dates.',
      );
    throw error;
  } finally {
    client.release();
  }
}

export async function terminateLease(
  database: Pool,
  companyId: string,
  id: string,
  reason: string,
) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const found = await findLease(client, companyId, id);
    if (!found) throw new ApiError(404, 'NOT_FOUND', 'Lease not found.');
    await client.query('SELECT id FROM properties WHERE company_id=$1 AND id=$2 FOR UPDATE', [
      companyId,
      found.propertyId,
    ]);
    const current = await findLease(client, companyId, id);
    if (!current || ['EXPIRED', 'TERMINATED'].includes(current.status))
      throw new ApiError(409, 'LEASE_CLOSED', 'This lease has already ended.');
    await client.query(
      'UPDATE leases SET terminated_at=now(),termination_reason=$3,updated_at=now() WHERE company_id=$1 AND id=$2',
      [companyId, id, reason],
    );
    const lease = await findLease(client, companyId, id);
    await client.query('COMMIT');
    return lease;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
