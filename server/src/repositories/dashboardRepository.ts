import type { Pool } from 'pg';
import { listRent } from './paymentRepository.js';
import { rentQuerySchema } from '../validation/payments.js';
import type { DashboardQuery } from '../validation/expenses.js';
export async function dashboard(database: Pool, companyId: string, query: DashboardQuery) {
  const client = await database.connect();
  const params = [companyId, query.propertyId || null, `${query.period}-01`];
  try {
    // Every card and list sees the same committed data, even while receipts are being entered.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const portfolio = (
      await client.query(
        `SELECT
      (SELECT count(*)::int FROM properties WHERE company_id=$1 AND ($2::uuid IS NULL OR id=$2)) AS properties,
      (SELECT count(*)::int FROM properties WHERE company_id=$1 AND active AND ($2::uuid IS NULL OR id=$2)) AS "activeProperties",
      (SELECT count(*)::int FROM unit_occupancy WHERE company_id=$1 AND ($2::uuid IS NULL OR property_id=$2)) AS units,
      (SELECT count(*)::int FROM unit_occupancy WHERE company_id=$1 AND occupancy_status='OCCUPIED' AND ($2::uuid IS NULL OR property_id=$2)) AS occupied,
      (SELECT count(*)::int FROM unit_occupancy WHERE company_id=$1 AND occupancy_status='VACANT' AND ($2::uuid IS NULL OR property_id=$2)) AS vacant,
      (SELECT count(*)::int FROM tenants t WHERE company_id=$1 AND ($2::uuid IS NULL OR EXISTS(
        SELECT 1 FROM leases l JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id WHERE l.company_id=t.company_id AND l.tenant_id=t.id AND u.property_id=$2))) AS tenants,
      (SELECT count(*)::int FROM maintenance_requests WHERE company_id=$1 AND status NOT IN ('COMPLETED','CANCELLED') AND ($2::uuid IS NULL OR property_id=$2)) AS "openMaintenance"`,
        params.slice(0, 2),
      )
    ).rows[0];
    const rent = await listRent(
      client,
      companyId,
      rentQuerySchema.parse({ period: query.period, propertyId: query.propertyId, pageSize: 1 }),
    );
    const cash = (
      await client.query(
        `WITH months AS (SELECT generate_series($3::date-interval '5 months',$3::date,interval '1 month')::date AS month),
      receipts AS (SELECT date_trunc('month',pay.payment_date)::date AS month,sum(pay.amount) AS amount FROM payments pay
        JOIN rent_charges c ON c.company_id=pay.company_id AND c.id=pay.charge_id
        JOIN leases l ON l.company_id=c.company_id AND l.id=c.lease_id
        JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id
        WHERE pay.company_id=$1 AND pay.voided_at IS NULL AND ($2::uuid IS NULL OR u.property_id=$2)
          AND pay.payment_date >= $3::date-interval '5 months' AND pay.payment_date < $3::date+interval '1 month' GROUP BY 1),
      costs AS (SELECT date_trunc('month',expense_date)::date AS month,sum(amount) AS amount FROM expenses
        WHERE company_id=$1 AND voided_at IS NULL AND ($2::uuid IS NULL OR property_id=$2)
          AND expense_date >= $3::date-interval '5 months' AND expense_date < $3::date+interval '1 month' GROUP BY 1)
      SELECT to_char(m.month,'YYYY-MM') AS period,coalesce(r.amount,0)::text AS received,coalesce(e.amount,0)::text AS expenses,
        (coalesce(r.amount,0)-coalesce(e.amount,0))::text AS net
      FROM months m LEFT JOIN receipts r ON r.month=m.month LEFT JOIN costs e ON e.month=m.month ORDER BY m.month`,
        params,
      )
    ).rows;
    const categories = (
      await client.query(
        `SELECT category,sum(amount)::text AS amount FROM expenses WHERE company_id=$1 AND voided_at IS NULL
      AND ($2::uuid IS NULL OR property_id=$2) AND expense_date >= $3::date AND expense_date < $3::date+interval '1 month' GROUP BY category ORDER BY sum(amount) DESC,category`,
        params,
      )
    ).rows;
    const recentPayments = (
      await client.query(
        `SELECT pay.id,concat_ws(' ',t.first_name,t.last_name) AS "tenantName",pay.amount::text,pay.payment_date::text AS "paymentDate",to_char(c.period,'YYYY-MM') AS period,p.name AS "propertyName"
      FROM payments pay JOIN rent_charges c ON c.company_id=pay.company_id AND c.id=pay.charge_id
      JOIN leases l ON l.company_id=c.company_id AND l.id=c.lease_id JOIN tenants t ON t.company_id=l.company_id AND t.id=l.tenant_id
      JOIN units u ON u.company_id=l.company_id AND u.id=l.unit_id JOIN properties p ON p.company_id=u.company_id AND p.id=u.property_id
      WHERE pay.company_id=$1 AND pay.voided_at IS NULL AND ($2::uuid IS NULL OR p.id=$2)
      AND pay.payment_date >= $3::date AND pay.payment_date < $3::date+interval '1 month'
      ORDER BY pay.payment_date DESC,pay.created_at DESC,pay.id LIMIT 5`,
        params,
      )
    ).rows;
    const recentMaintenance = (
      await client.query(
        `SELECT m.id,m.title,m.status,m.priority,m.submitted_date::text AS "submittedDate",p.name AS "propertyName"
      FROM maintenance_requests m JOIN properties p ON p.company_id=m.company_id AND p.id=m.property_id
      WHERE m.company_id=$1 AND ($2::uuid IS NULL OR m.property_id=$2) ORDER BY m.created_at DESC,m.id LIMIT 5`,
        params.slice(0, 2),
      )
    ).rows;
    await client.query('COMMIT');
    const current = cash[cash.length - 1];
    return {
      period: query.period,
      portfolio,
      rent: rent.summary,
      cash: current,
      trend: cash,
      categories,
      recentPayments,
      recentMaintenance,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
