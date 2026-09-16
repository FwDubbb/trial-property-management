import type { Pool, PoolClient } from 'pg';
import { findPayment, listRent } from '../repositories/paymentRepository.js';
import { ApiError } from '../utils/ApiError.js';
import { rentQuerySchema, type PaymentInput } from '../validation/payments.js';

async function lockProperty(client: PoolClient, companyId: string, leaseId: string) {
  const found = await client.query(
    `SELECT u.property_id FROM leases l JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id
    WHERE l.company_id=$1 AND l.id=$2`,
    [companyId, leaseId],
  );
  if (!found.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Lease not found.');
  // Same ordering as lease edits/termination. Serializes balance checks and avoids lost updates.
  await client.query('SELECT id FROM properties WHERE company_id=$1 AND id=$2 FOR UPDATE', [
    companyId,
    found.rows[0].property_id,
  ]);
}
async function previousRequest(client: PoolClient, companyId: string, input: PaymentInput) {
  const existing = (
    await client.query(
      `SELECT pay.id,c.lease_id,c.period::text,pay.amount::text,pay.payment_date::text,pay.method,pay.reference,pay.notes
    FROM payments pay JOIN rent_charges c ON c.company_id=pay.company_id AND c.id=pay.charge_id
    WHERE pay.company_id=$1 AND pay.request_id=$2`,
      [companyId, input.requestId],
    )
  ).rows[0];
  if (!existing) return;
  if (
    existing.lease_id !== input.leaseId ||
    existing.period !== `${input.period}-01` ||
    Number(existing.amount) !== input.amount ||
    existing.payment_date !== input.paymentDate ||
    existing.method !== input.method ||
    existing.reference !== input.reference ||
    existing.notes !== input.notes
  )
    throw new ApiError(
      409,
      'REQUEST_REUSED',
      'This payment request was already used. Reload the form before recording a different payment.',
    );
  return findPayment(client, companyId, existing.id);
}
export async function recordPayment(
  database: Pool,
  companyId: string,
  userId: string,
  input: PaymentInput,
) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await lockProperty(client, companyId, input.leaseId);
    const previous = await previousRequest(client, companyId, input);
    if (previous) {
      await client.query('COMMIT');
      return { payment: previous, replayed: true };
    }
    const rent = await listRent(
      client,
      companyId,
      rentQuerySchema.parse({ period: input.period, leaseId: input.leaseId }),
    );
    const balance = rent.items[0];
    if (!balance)
      throw new ApiError(
        400,
        'INVALID_PERIOD',
        'This rent month is outside the lease term or was cancelled before it started.',
      );
    const charge = await client.query(
      `INSERT INTO rent_charges(company_id,lease_id,period,expected_amount,due_date)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_id,lease_id,period) DO UPDATE SET lease_id=EXCLUDED.lease_id RETURNING id`,
      [companyId, input.leaseId, `${input.period}-01`, balance.expected, balance.dueDate],
    );
    // Compare and sum in PostgreSQL numeric, never floating-point currency arithmetic.
    const allowed = await client.query(
      `SELECT $3::numeric <= c.expected_amount - coalesce((SELECT sum(amount) FROM payments
      WHERE company_id=$1 AND charge_id=c.id AND voided_at IS NULL),0) AS allowed FROM rent_charges c WHERE c.company_id=$1 AND c.id=$2`,
      [companyId, charge.rows[0].id, input.amount],
    );
    if (!allowed.rows[0]?.allowed)
      throw new ApiError(
        409,
        'EXCEEDS_BALANCE',
        'Payment exceeds the outstanding rent for this month. Split payments across their rent months.',
      );
    const saved = await client.query(
      `INSERT INTO payments(company_id,charge_id,request_id,amount,payment_date,method,reference,notes,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        companyId,
        charge.rows[0].id,
        input.requestId,
        input.amount,
        input.paymentDate,
        input.method,
        input.reference,
        input.notes,
        userId,
      ],
    );
    const payment = await findPayment(client, companyId, saved.rows[0].id);
    await client.query('COMMIT');
    return { payment, replayed: false };
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505')
      throw new ApiError(
        409,
        'REQUEST_REUSED',
        'This payment request was already recorded. Check payment history before trying again.',
      );
    throw error;
  } finally {
    client.release();
  }
}
export async function voidPayment(
  database: Pool,
  companyId: string,
  userId: string,
  id: string,
  reason: string,
) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const payment = await findPayment(client, companyId, id);
    if (!payment) throw new ApiError(404, 'NOT_FOUND', 'Payment not found.');
    await lockProperty(client, companyId, payment.leaseId);
    const result = await client.query(
      `UPDATE payments SET voided_at=now(),voided_by=$3,void_reason=$4
      WHERE company_id=$1 AND id=$2 AND voided_at IS NULL RETURNING id`,
      [companyId, id, userId, reason],
    );
    if (!result.rowCount)
      throw new ApiError(409, 'PAYMENT_VOIDED', 'This payment has already been voided.');
    const updated = await findPayment(client, companyId, id);
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
