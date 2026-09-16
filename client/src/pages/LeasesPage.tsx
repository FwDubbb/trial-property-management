import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LeasesTable } from '../components/LeasesTable';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/RecordStates';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { label, type Page, type PropertyOption } from '../types/portfolio';
import { leaseStatuses, type Lease } from '../types/tenancy';

export function LeasesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [page, setPage] = useState(1);
  const properties = useApiQuery<{ items: PropertyOption[] }>('/properties/options');
  const query = new URLSearchParams({ q: useDebouncedValue(search), page: String(page) });
  if (status) query.set('status', status);
  if (propertyId) query.set('propertyId', propertyId);
  const result = useApiQuery<Page<Lease>>(`/leases?${query}`);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">AGREEMENTS, ORGANIZED</p>
          <h1>Leases</h1>
          <p className="intro">Connect people to properties and keep track of every term.</p>
        </div>
        <Link className="primary-button" to="/leases/new">
          + Create lease
        </Link>
      </section>
      <section className="list-panel">
        <div className="filter-bar">
          <label className="search-label">
            Search leases
            <input
              type="search"
              placeholder="Search tenant, unit, or property…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Lease status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {leaseStatuses.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Property
            <select
              value={propertyId}
              disabled={properties.loading || !!properties.error}
              onChange={(event) => {
                setPropertyId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All properties</option>
              {properties.data?.items.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                  {!property.active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {properties.error && <ErrorState message={properties.error} retry={properties.reload} />}
        {result.loading ? (
          <LoadingState />
        ) : result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : result.data?.items.length ? (
          <>
            <LeasesTable leases={result.data.items} />
            <Pagination {...result.data} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No leases found"
            description={
              search || status || propertyId
                ? 'Try another search or change your filters.'
                : 'Create a lease to connect a tenant with a rental unit.'
            }
            action={{ to: '/leases/new', label: 'Create lease' }}
          />
        )}
      </section>
      <p className="section-footnote">
        Lease dates are inclusive. Status is based on the current UTC date; refresh to see date
        changes.
      </p>
    </>
  );
}
