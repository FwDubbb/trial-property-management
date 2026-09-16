import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/RecordStates';
import { UnitsTable } from '../components/UnitsTable';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { label, unitStatuses, type Page, type PropertyOption, type Unit } from '../types/portfolio';

export function UnitsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [propertyStatus, setPropertyStatus] = useState('active');
  const [page, setPage] = useState(1);
  const properties = useApiQuery<{ items: PropertyOption[] }>('/properties/options');
  const query = new URLSearchParams({
    q: useDebouncedValue(search),
    propertyStatus,
    page: String(page),
  });
  if (status) query.set('status', status);
  if (propertyId) query.set('propertyId', propertyId);
  const result = useApiQuery<Page<Unit>>(`/units?${query}`);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR RENTAL SPACES</p>
          <h1>Units</h1>
          <p className="intro">Keep an eye on every unit in your portfolio.</p>
        </div>
        <Link className="primary-button" to="/units/new">
          + Add unit
        </Link>
      </section>
      <section className="list-panel">
        <div className="filter-bar">
          <label className="search-label">
            Search units
            <input
              type="search"
              placeholder="Search unit or property…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
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
          <label>
            Unit status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {unitStatuses.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Property status
            <select
              value={propertyStatus}
              onChange={(event) => {
                setPropertyStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
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
            <UnitsTable units={result.data.items} />
            <Pagination {...result.data} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No units found"
            description={
              search || status || propertyId || propertyStatus !== 'active'
                ? 'Try another search or change your filters.'
                : 'Add a rental unit to one of your properties to get started.'
            }
            action={{ to: '/units/new', label: 'Add unit' }}
          />
        )}
      </section>
    </>
  );
}
