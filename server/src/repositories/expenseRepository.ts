import type { Pool, PoolClient } from 'pg';
import type { ExpenseQuery } from '../validation/expenses.js';
const columns = `e.id,e.property_id AS "propertyId",p.name AS "propertyName",p.active AS "propertyActive",e.category,e.description,e.amount::text,
 e.expense_date::text AS "expenseDate",e.notes,e.created_at AS "createdAt",e.voided_at AS "voidedAt",e.void_reason AS "voidReason",
 recorder.name AS "recordedByName",voider.name AS "voidedByName",CASE WHEN e.voided_at IS NULL THEN 'RECORDED' ELSE 'VOIDED' END AS state`;
const joins = `JOIN properties p ON p.company_id=e.company_id AND p.id=e.property_id
 JOIN users recorder ON recorder.company_id=e.company_id AND recorder.id=e.recorded_by
 LEFT JOIN users voider ON voider.company_id=e.company_id AND voider.id=e.voided_by`;
export async function findExpense(database: Pool | PoolClient, companyId: string, id: string) {
  return (
    await database.query(
      `SELECT ${columns} FROM expenses e ${joins} WHERE e.company_id=$1 AND e.id=$2`,
      [companyId, id],
    )
  ).rows[0];
}
export async function listExpenses(database: Pool, companyId: string, query: ExpenseQuery) {
  const params = [
    companyId,
    `%${query.q.replace(/[\\%_]/g, '\\$&')}%`,
    query.propertyId || null,
    query.category || null,
    query.period ? `${query.period}-01` : null,
    query.state || null,
  ];
  const where = `e.company_id=$1 AND (e.description ILIKE $2 OR p.name ILIKE $2)
    AND ($3::uuid IS NULL OR e.property_id=$3) AND ($4::text IS NULL OR e.category=$4)
    AND ($5::date IS NULL OR (e.expense_date >= $5::date AND e.expense_date < $5::date+interval '1 month'))
    AND ($6::text IS NULL OR CASE WHEN e.voided_at IS NULL THEN 'RECORDED' ELSE 'VOIDED' END=$6)`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${columns} FROM expenses e ${joins} WHERE ${where} ORDER BY e.expense_date DESC,e.created_at DESC,e.id LIMIT $7 OFFSET $8`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(
      `SELECT count(*)::int AS total,coalesce(sum(e.amount) FILTER(WHERE e.voided_at IS NULL),0)::text AS "recordedTotal" FROM expenses e ${joins} WHERE ${where}`,
      params,
    ),
  ]);
  return {
    items: items.rows,
    total: total.rows[0].total,
    recordedTotal: total.rows[0].recordedTotal,
    page: query.page,
    pageSize: query.pageSize,
  };
}
