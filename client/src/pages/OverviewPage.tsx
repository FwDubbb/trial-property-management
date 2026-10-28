import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiQuery } from '../hooks/useApiQuery';
import { PropertyFilter } from '../components/PaymentHistory';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { amount, label } from '../types/portfolio';
import { currentMonth, formatMonth } from '../types/payments';
import { formatDate } from '../types/tenancy';
import type { Dashboard } from '../types/finance';
export function OverviewPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(currentMonth);
  const [propertyId, setPropertyId] = useState('');
  const query = new URLSearchParams({ period: period || currentMonth() });
  if (propertyId) query.set('propertyId', propertyId);
  const result = useApiQuery<Dashboard>(`/dashboard?${query}`);
  const data = result.data;
  const max = data
    ? Math.max(
        1,
        ...data.trend.flatMap((month) => [Number(month.received), Number(month.expenses)]),
      )
    : 1;
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR COMPANY WORKSPACE</p>
          <h1>Welcome, {user?.name.split(' ')[0]}.</h1>
          <p className="intro">A clear view of {user?.companyName}.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" to="/properties/new">
            + Add property
          </Link>
          <Link className="primary-button" to="/expenses/new">
            + Record expense
          </Link>
        </div>
      </section>
      <section className="list-panel">
        <div className="filter-bar">
          <label>
            Report month
            <input
              type="month"
              required
              min="1900-01"
              max="9999-12"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              onBlur={() => {
                if (!period) setPeriod(currentMonth());
              }}
            />
          </label>
          <PropertyFilter value={propertyId} onChange={setPropertyId} />
          <button className="secondary-button" onClick={result.reload}>
            Refresh dashboard
          </button>
        </div>
      </section>
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        data && (
          <>
            <div className="section-heading">
              <h2>Portfolio today</h2>
              <span>Includes inactive properties</span>
            </div>
            <section className="stats-grid dashboard-stats">
              {[
                ['Total properties', data.portfolio.properties],
                ['Total units', data.portfolio.units],
                ['Occupied units', data.portfolio.occupied],
                ['Vacant units', data.portfolio.vacant],
                ['Total tenants', data.portfolio.tenants],
                ['Open maintenance', data.portfolio.openMaintenance],
              ].map(([title, value]) => (
                <article className="stat-card" key={title}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </section>
            <p className="section-footnote">
              {data.portfolio.activeProperties} active properties. Counts show the current
              portfolio, regardless of report month. With a property selected, tenants include
              anyone with a lease at that property.
            </p>
            <div className="section-heading">
              <h2>{formatMonth(data.period)}</h2>
              <Link to="/payments">View rent balances →</Link>
            </div>
            <section className="stats-grid dashboard-stats">
              {[
                ['Expected rent', data.rent.expected, 'Rent scheduled for this month'],
                ['Paid toward rent', data.rent.paid, 'Payments allocated to this rent month'],
                [
                  'Outstanding rent',
                  data.rent.outstanding,
                  'Remaining balance for this rent month',
                ],
                ['Rent received', data.cash.received, 'Receipts dated in this month'],
                ['Total expenses', data.cash.expenses, 'Expenses paid in this month'],
                ['Rent less expenses', data.cash.net, 'Recorded receipts minus recorded expenses'],
              ].map(([title, value, help]) => (
                <article className="stat-card" key={title}>
                  <span>{title}</span>
                  <strong>{amount(value)}</strong>
                  <small>{help}</small>
                </article>
              ))}
            </section>
            <p className="section-footnote">
              Overdue for this rent month: {amount(data.rent.overdue)}. Late or advance receipts can
              make rent received differ from rent paid toward this month. Voided records are
              excluded. These totals reflect recorded activity, not a full profit statement.
            </p>
            <section className="detail-panel cash-panel">
              <div className="section-heading">
                <h2>Six-month cash comparison</h2>
                <span>Rent received and expenses paid</span>
              </div>
              <div className="table-scroll">
                <table className="cash-table">
                  <caption className="sr-only">
                    Six months ending {formatMonth(data.period)}
                  </caption>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Comparison</th>
                      <th>Rent received</th>
                      <th>Expenses</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trend.map((month) => (
                      <tr key={month.period}>
                        <th scope="row">{formatMonth(month.period)}</th>
                        <td>
                          <div className="cash-bars" aria-hidden="true">
                            <div
                              className="cash-received"
                              style={{ width: `${(Number(month.received) / max) * 100}%` }}
                            />
                            <div
                              className="cash-expenses"
                              style={{ width: `${(Number(month.expenses) / max) * 100}%` }}
                            />
                          </div>
                        </td>
                        <td>{amount(month.received)}</td>
                        <td>{amount(month.expenses)}</td>
                        <td>{amount(month.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cash-legend">
                <span>
                  <i className="cash-received" />
                  Rent received
                </span>
                <span>
                  <i className="cash-expenses" />
                  Expenses paid
                </span>
              </div>
            </section>
            <section className="detail-panel">
              <div className="section-heading">
                <h2>Expenses by category</h2>
                <Link to="/expenses">View expenses →</Link>
              </div>
              {data.categories.length ? (
                <ul className="category-totals">
                  {data.categories.map((item) => (
                    <li key={item.category}>
                      <span>{label(item.category)}</span>
                      <strong>{amount(item.amount)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="intro">No recorded expenses for this month.</p>
              )}
            </section>
            <div className="next-grid">
              <section className="detail-panel">
                <div className="section-heading">
                  <h2>Recent payments</h2>
                  <Link to="/payments/history">View all →</Link>
                </div>
                <p className="intro">Receipts dated in the selected month.</p>
                {data.recentPayments.length ? (
                  <ul className="dashboard-activity">
                    {data.recentPayments.map((item) => (
                      <li key={item.id}>
                        <Link to={`/payments/${item.id}`}>
                          {item.tenantName} · {amount(item.amount)}
                        </Link>
                        <span>
                          {item.propertyName} · Received {formatDate(item.paymentDate)}
                        </span>
                        <span>For {formatMonth(item.period)} rent</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="intro">No payments received in this month.</p>
                )}
              </section>
              <section className="detail-panel">
                <div className="section-heading">
                  <h2>Recent maintenance</h2>
                  <Link to="/maintenance">View all →</Link>
                </div>
                <p className="intro">Latest requests, across all dates.</p>
                {data.recentMaintenance.length ? (
                  <ul className="dashboard-activity">
                    {data.recentMaintenance.map((item) => (
                      <li key={item.id}>
                        <Link to={`/maintenance/${item.id}`}>{item.title}</Link>
                        <span>
                          {item.propertyName} · {formatDate(item.submittedDate)}
                        </span>
                        <span>
                          {label(item.priority)} priority · {label(item.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="intro">No maintenance requests yet.</p>
                )}
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
