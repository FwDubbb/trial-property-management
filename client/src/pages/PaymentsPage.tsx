import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PaymentHistory, PropertyFilter } from '../components/PaymentHistory';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/RecordStates';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { amount, label } from '../types/portfolio';
import { currentMonth, formatMonth, rentStatuses, type RentPage } from '../types/payments';
import { formatDate } from '../types/tenancy';

export function PaymentsPage({ history = false }: { history?: boolean }) {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">RENT & PAYMENTS</p>
          <h1>{history ? 'Payment history' : 'Rent balances'}</h1>
          <p className="intro">Track rent received and see what is still outstanding.</p>
        </div>
        <Link className="primary-button" to="/payments/new">
          + Record payment
        </Link>
      </section>
      <nav className="payment-tabs" aria-label="Payment views">
        <Link className={!history ? 'selected' : ''} to="/payments">
          Rent balances
        </Link>
        <Link className={history ? 'selected' : ''} to="/payments/history">
          Payment history
        </Link>
      </nav>
      {history ? <PaymentHistory filters /> : <RentBalances />}
    </>
  );
}
export function RentBalances({ tenantId }: { tenantId?: string }) {
  const [period, setPeriod] = useState(currentMonth);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    period: period || currentMonth(),
    q: useDebouncedValue(search),
    page: String(page),
  });
  for (const [key, value] of Object.entries({ tenantId, status, propertyId }))
    if (value) query.set(key, value);
  const result = useApiQuery<RentPage>(`/payments/rent?${query}`);
  return (
    <>
      <section className="list-panel">
        <div className="filter-bar payment-filters">
          <label>
            Rent month
            <input
              type="month"
              required
              min="1900-01"
              max="9999-12"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setPage(1);
              }}
              onBlur={() => {
                if (!period) setPeriod(currentMonth());
              }}
            />
          </label>
          {!tenantId && (
            <label className="search-label">
              Search rent balances
              <input
                type="search"
                value={search}
                placeholder="Tenant, unit, or property"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          )}
          <label>
            Rent status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {rentStatuses.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          {!tenantId && (
            <PropertyFilter
              value={propertyId}
              onChange={(value) => {
                setPropertyId(value);
                setPage(1);
              }}
            />
          )}
        </div>
      </section>
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : (
        result.data && (
          <>
            <p className="section-footnote">
              {formatMonth(result.data.period)} · Totals match the selected filters. Paid amounts
              are allocated to this rent month, regardless of payment date.
            </p>
            <section className="stats-grid rent-stats">
              {[
                ['Expected rent', result.data.summary.expected],
                ['Paid toward rent', result.data.summary.paid],
                ['Outstanding rent', result.data.summary.outstanding],
                ['Overdue rent', result.data.summary.overdue],
              ].map(([title, value]) => (
                <article className="stat-card" key={title}>
                  <span>{title}</span>
                  <strong>{amount(value)}</strong>
                </article>
              ))}
            </section>
            <section className="list-panel">
              {result.data.items.length ? (
                <>
                  <div className="table-scroll">
                    <table className="records-table">
                      <thead>
                        <tr>
                          <th>Tenant / home</th>
                          <th>Due date</th>
                          <th>Expected</th>
                          <th>Paid</th>
                          <th>Outstanding</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.items.map((row) => (
                          <tr key={row.leaseId}>
                            <td>
                              <Link to={`/tenants/${row.tenantId}`}>{row.tenantName}</Link>
                              <small>
                                {row.propertyName} · {row.unitName}
                              </small>
                              <Link className="table-sub-link" to={`/leases/${row.leaseId}`}>
                                View lease
                              </Link>
                            </td>
                            <td>{formatDate(row.dueDate)}</td>
                            <td>{amount(row.expected)}</td>
                            <td>{amount(row.paid)}</td>
                            <td>{amount(row.outstanding)}</td>
                            <td>
                              <span className={`status-pill ${row.status.toLowerCase()}`}>
                                {label(row.status)}
                              </span>
                              {row.overdue && row.paymentStatus === 'PARTIALLY_PAID' && (
                                <small>Partially paid</small>
                              )}
                            </td>
                            <td>
                              {Number(row.outstanding) > 0 ? (
                                <Link
                                  to={`/payments/new?leaseId=${row.leaseId}&period=${row.period}`}
                                >
                                  Record payment →
                                </Link>
                              ) : (
                                <span>Settled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination {...result.data} onPage={setPage} />
                </>
              ) : (
                <EmptyState
                  title="No rent due for these filters"
                  description="Choose another month or create a lease to start tracking rent."
                />
              )}
            </section>
          </>
        )
      )}
      <p className="section-footnote">
        Full monthly rent applies to partial months. Rent is due on the first day of the month or
        the lease start date, whichever is later. Unpaid balances become overdue the next UTC day.
        Deposits and fees are excluded.
      </p>
    </>
  );
}
