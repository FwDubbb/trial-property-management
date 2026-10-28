import type { Pool } from 'pg';
import { findExpense } from '../repositories/expenseRepository.js';
import { ApiError } from '../utils/ApiError.js';
import type { ExpenseInput } from '../validation/expenses.js';
export async function recordExpense(
  database: Pool,
  companyId: string,
  userId: string,
  input: ExpenseInput,
) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    // Historical expenses remain recordable for inactive properties. Lock also serializes retries.
    const property = await client.query(
      'SELECT id FROM properties WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [companyId, input.propertyId],
    );
    if (!property.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Property not found.');
    const previous = (
      await client.query(
        `SELECT id,property_id,category,description,amount::text,expense_date::text,notes FROM expenses WHERE company_id=$1 AND request_id=$2`,
        [companyId, input.requestId],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.property_id !== input.propertyId ||
        previous.category !== input.category ||
        previous.description !== input.description ||
        Number(previous.amount) !== input.amount ||
        previous.expense_date !== input.expenseDate ||
        previous.notes !== input.notes
      )
        throw new ApiError(
          409,
          'REQUEST_REUSED',
          'This submission was already recorded. Check expense history before recording a different expense.',
        );
      const expense = await findExpense(client, companyId, previous.id);
      await client.query('COMMIT');
      return { expense, replayed: true };
    }
    const saved = await client.query(
      `INSERT INTO expenses(company_id,property_id,category,description,amount,expense_date,notes,request_id,recorded_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        companyId,
        input.propertyId,
        input.category,
        input.description,
        input.amount,
        input.expenseDate,
        input.notes,
        input.requestId,
        userId,
      ],
    );
    const expense = await findExpense(client, companyId, saved.rows[0].id);
    await client.query('COMMIT');
    return { expense, replayed: false };
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505')
      throw new ApiError(
        409,
        'REQUEST_REUSED',
        'This submission was already recorded. Check expense history before trying again.',
      );
    throw error;
  } finally {
    client.release();
  }
}
export async function voidExpense(
  database: Pool,
  companyId: string,
  userId: string,
  id: string,
  reason: string,
) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT voided_at FROM expenses WHERE company_id=$1 AND id=$2 FOR UPDATE',
      [companyId, id],
    );
    if (!existing.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Expense not found.');
    if (existing.rows[0].voided_at)
      throw new ApiError(409, 'EXPENSE_VOIDED', 'This expense has already been voided.');
    await client.query(
      'UPDATE expenses SET voided_at=now(),voided_by=$3,void_reason=$4 WHERE company_id=$1 AND id=$2',
      [companyId, id, userId, reason],
    );
    const expense = await findExpense(client, companyId, id);
    await client.query('COMMIT');
    return expense;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
