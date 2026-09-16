import type { Pool } from 'pg';
import { findUnit } from '../repositories/unitRepository.js';
import { ApiError } from '../utils/ApiError.js';
import type { UnitInput } from '../validation/portfolio.js';

export async function saveUnit(database: Pool, companyId: string, input: UnitInput, id?: string) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    if (id) {
      const existing = await findUnit(client, companyId, id);
      if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Unit not found.');
      // Moving a unit could detach future lease/payment history, so property is fixed after creation.
      if (existing.propertyId !== input.propertyId)
        throw new ApiError(400, 'PROPERTY_FIXED', 'A unit cannot be moved to another property.');
    }
    // Lock the parent so deactivation cannot race a unit creation or edit.
    const property = await client.query(
      'SELECT active FROM properties WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [companyId, input.propertyId],
    );
    if (!property.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Property not found.');
    if (!property.rows[0].active)
      throw new ApiError(
        409,
        'PROPERTY_INACTIVE',
        'Reactivate this property before adding or editing units.',
      );
    const current = id ? await findUnit(client, companyId, id) : undefined;
    if (current?.activeLeaseId && input.status !== 'OCCUPIED')
      throw new ApiError(
        409,
        'LEASE_CONTROLS_OCCUPANCY',
        'End the active lease before changing this unit’s occupancy status.',
      );
    if (current?.hasUpcomingLease && !current.activeLeaseId && input.status !== 'VACANT')
      throw new ApiError(
        409,
        'LEASE_RESERVATION',
        'This unit is reserved by an upcoming lease. Change the lease before changing its availability.',
      );
    const values = [
      companyId,
      input.propertyId,
      input.name,
      input.bedrooms,
      input.bathrooms,
      input.monthlyRent,
      current?.activeLeaseId ? 'VACANT' : input.status,
      input.notes,
    ];
    const result = id
      ? await client.query(
          `UPDATE units SET name=$3, bedrooms=$4, bathrooms=$5, monthly_rent=$6, status=$7, notes=$8, updated_at=now()
          WHERE company_id=$1 AND property_id=$2 AND id=$9 RETURNING id`,
          [...values, id],
        )
      : await client.query(
          `INSERT INTO units(company_id, property_id, name, bedrooms, bathrooms, monthly_rent, status, notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          values,
        );
    if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Unit not found.');
    const unit = await findUnit(client, companyId, result.rows[0].id);
    await client.query('COMMIT');
    return unit;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505')
      throw new ApiError(
        409,
        'DUPLICATE_UNIT',
        'A unit with that name already exists in this property.',
      );
    throw error;
  } finally {
    client.release();
  }
}
