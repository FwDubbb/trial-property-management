import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { amount, label, type Page, type PropertyOption } from '../types/portfolio';
import { formatDate } from '../types/tenancy';
import { formatMonth, paymentMethods, type Payment } from '../types/payments';
import { EmptyState, ErrorState, LoadingState, Pagination } from './RecordStates';

export function PaymentHistory({
  tenantId,
  leaseId,
  filters = false,
}: {
  tenantId?: string;
  leaseId?: string;
  filters?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [method, setMethod] = useState('');
  const [state, setState] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const query = new URLSearchParams({ page: String(page), q: useDebouncedValue(search) });
  for (const [key, value] of Object.entries({
    tenantId,
    leaseId,
    period,
    method,
    state,
    propertyId,
  }))
    if (value) query.set(key, value);
  const result = useApiQuery<Page<Payment>>(`/payments?${query}`);
  return (
    <section className="list-panel">
      {filters && (
        <div className="filter-bar payment-filters">
          <label className="search-label">
            Search payments
            <input
              type="search"
              placeholder="Tenant, unit, property, or reference"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Rent month
            <input
              type="month"
              min="1900-01"
              max="9999-12"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Payment method
            <select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All methods</option>
              {paymentMethods.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Record status
            <select
              value={state}
              onChange={(event) => {
                setState(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All records</option>
              <option value="RECORDED">Recorded</option>
              <option value="VOIDED">Voided</option>
            </select>
          </label>
          <PropertyFilter
            value={propertyId}
            onChange={(value) => {
              setPropertyId(value);
              setPage(1);
            }}
          />
        </div>
      )}
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.items.length ? (
        <>
          <div className="table-scroll">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Tenant / home</th>
                  <th>Rent month</th>
                  <th>Payment date</th>
                  <th>Amount</th>
                  <th>Method / reference</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <Link to={`/tenants/${payment.tenantId}`}>{payment.tenantName}</Link>
                      <small>
                        {payment.propertyName} · {payment.unitName}
                      </small>
                    </td>
                    <td>{formatMonth(payment.period)}</td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td>{amount(payment.amount)}</td>
                    <td>
                      {label(payment.method)}
                      <small>{payment.reference || 'No reference'}</small>
                    </td>
                    <td>
                      <span className={`status-pill ${payment.state.toLowerCase()}`}>
                        {label(payment.state)}
                      </span>
                    </td>
                    <td>
                      <Link to={`/payments/${payment.id}`}>View payment →</Link>
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
          title="No payments found"
          description="Recorded rent payments appear here. Try changing filters or record your first payment."
        />
      )}
    </section>
  );
}
export function PropertyFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const properties = useApiQuery<{ items: PropertyOption[] }>('/properties/options');
  return (
    <>
      <label>
        Property
        <select
          value={value}
          disabled={properties.loading || !!properties.error}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">All properties</option>
          {properties.data?.items.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
              {property.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </label>
      {properties.error && <ErrorState message={properties.error} retry={properties.reload} />}
    </>
  );
}
