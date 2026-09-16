import type { Pool, PoolClient } from 'pg';
import type { PaymentQuery, RentQuery } from '../validation/payments.js';

const parties = `JOIN tenants t ON t.company_id=l.company_id AND t.id=l.tenant_id
 JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id
 JOIN properties p ON p.company_id=u.company_id AND p.id=u.property_id`;
const partyColumns = `l.id AS "leaseId",t.id AS "tenantId",concat_ws(' ',t.first_name,t.last_name) AS "tenantName",
 u.id AS "unitId",u.name AS "unitName",p.id AS "propertyId",p.name AS "propertyName"`;

// Unrecorded months follow the lease. A recorded month keeps its original charge, even after termination.
const rentCte = `WITH balances AS (
 SELECT ${partyColumns},to_char($2::date,'YYYY-MM') AS period,
 coalesce(c.expected_amount,l.monthly_rent) AS expected,
 coalesce(c.due_date,greatest(l.start_date,$2::date)) AS due_date,
 coalesce(paid.amount,0) AS paid,
 greatest(coalesce(c.expected_amount,l.monthly_rent)-coalesce(paid.amount,0),0) AS outstanding,
 c.id IS NOT NULL AS "termsRecorded"
 FROM leases l ${parties}
 LEFT JOIN rent_charges c ON c.company_id=l.company_id AND c.lease_id=l.id AND c.period=$2::date
 LEFT JOIN LATERAL (SELECT sum(amount) AS amount FROM payments pay
   WHERE pay.company_id=c.company_id AND pay.charge_id=c.id AND pay.voided_at IS NULL) paid ON true
 WHERE l.company_id=$1 AND (c.id IS NOT NULL OR
   (l.start_date < $2::date + interval '1 month' AND l.end_date >= $2::date
    AND (l.terminated_at IS NULL OR
      (l.start_date <= (l.terminated_at AT TIME ZONE 'UTC')::date AND
       (l.terminated_at AT TIME ZONE 'UTC')::date >= $2::date))))
), classified AS (
 SELECT *,outstanding>0 AND due_date<(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS overdue,
 CASE WHEN outstanding=0 THEN 'PAID' WHEN paid>0 THEN 'PARTIALLY_PAID' ELSE 'UNPAID' END AS "paymentStatus",
 CASE WHEN outstanding=0 THEN 'PAID'
 WHEN due_date<(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date THEN 'OVERDUE'
 WHEN paid>0 THEN 'PARTIALLY_PAID' ELSE 'UNPAID' END AS status
 FROM balances
)`;
const escapeSearch = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;
export async function listRent(database: Pool | PoolClient, companyId: string, query: RentQuery) {
  const params = [
    companyId,
    `${query.period}-01`,
    escapeSearch(query.q),
    query.tenantId || null,
    query.leaseId || null,
    query.propertyId || null,
    query.status || null,
  ];
  const where = `("tenantName" ILIKE $3 OR "unitName" ILIKE $3 OR "propertyName" ILIKE $3)
    AND ($4::uuid IS NULL OR "tenantId"=$4) AND ($5::uuid IS NULL OR "leaseId"=$5)
    AND ($6::uuid IS NULL OR "propertyId"=$6) AND ($7::text IS NULL OR status=$7)`;
  const items = await database.query(
    `${rentCte} SELECT *,expected::text,paid::text,outstanding::text,due_date::text AS "dueDate"
    FROM classified WHERE ${where} ORDER BY "tenantName","leaseId" LIMIT $8 OFFSET $9`,
    [...params, query.pageSize, (query.page - 1) * query.pageSize],
  );
  const summary = await database.query(
    `${rentCte} SELECT count(*)::int AS total,coalesce(sum(expected),0)::text AS expected,
    coalesce(sum(paid),0)::text AS paid,coalesce(sum(outstanding),0)::text AS outstanding,
    coalesce(sum(outstanding) FILTER(WHERE overdue),0)::text AS overdue FROM classified WHERE ${where}`,
    params,
  );
  return {
    items: items.rows,
    total: summary.rows[0].total,
    page: query.page,
    pageSize: query.pageSize,
    summary: summary.rows[0],
    period: query.period,
  };
}

const paymentColumns = `pay.id,${partyColumns},to_char(c.period,'YYYY-MM') AS period,
 pay.amount::text,pay.payment_date::text AS "paymentDate",pay.method,pay.reference,pay.notes,
 pay.created_at AS "createdAt",pay.voided_at AS "voidedAt",pay.void_reason AS "voidReason",
 recorder.name AS "recordedByName",voider.name AS "voidedByName",
 CASE WHEN pay.voided_at IS NULL THEN 'RECORDED' ELSE 'VOIDED' END AS state`;
const paymentJoins = `JOIN rent_charges c ON c.company_id=pay.company_id AND c.id=pay.charge_id
 JOIN leases l ON l.company_id=c.company_id AND l.id=c.lease_id ${parties}
 JOIN users recorder ON recorder.company_id=pay.company_id AND recorder.id=pay.recorded_by
 LEFT JOIN users voider ON voider.company_id=pay.company_id AND voider.id=pay.voided_by`;
export async function findPayment(database: Pool | PoolClient, companyId: string, id: string) {
  return (
    await database.query(
      `SELECT ${paymentColumns} FROM payments pay ${paymentJoins} WHERE pay.company_id=$1 AND pay.id=$2`,
      [companyId, id],
    )
  ).rows[0];
}
export async function listPayments(database: Pool, companyId: string, query: PaymentQuery) {
  const params = [
    companyId,
    escapeSearch(query.q),
    query.tenantId || null,
    query.leaseId || null,
    query.propertyId || null,
    query.period ? `${query.period}-01` : null,
    query.method || null,
    query.state || null,
  ];
  const where = `pay.company_id=$1 AND (concat_ws(' ',t.first_name,t.last_name) ILIKE $2 OR u.name ILIKE $2 OR p.name ILIKE $2 OR pay.reference ILIKE $2)
    AND ($3::uuid IS NULL OR t.id=$3) AND ($4::uuid IS NULL OR l.id=$4) AND ($5::uuid IS NULL OR p.id=$5)
    AND ($6::date IS NULL OR c.period=$6) AND ($7::text IS NULL OR pay.method=$7)
    AND ($8::text IS NULL OR CASE WHEN pay.voided_at IS NULL THEN 'RECORDED' ELSE 'VOIDED' END=$8)`;
  const [items, total] = await Promise.all([
    database.query(
      `SELECT ${paymentColumns} FROM payments pay ${paymentJoins} WHERE ${where}
      ORDER BY pay.payment_date DESC,pay.created_at DESC,pay.id LIMIT $9 OFFSET $10`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    ),
    database.query(
      `SELECT count(*)::int AS total FROM payments pay ${paymentJoins} WHERE ${where}`,
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
export async function paymentOptions(database: Pool, companyId: string) {
  return (
    await database.query(
      `SELECT ${partyColumns},l.start_date::text AS "startDate",l.end_date::text AS "endDate"
    FROM leases l ${parties} WHERE l.company_id=$1 ORDER BY t.last_name,t.first_name,l.start_date DESC,l.id`,
      [companyId],
    )
  ).rows;
}
