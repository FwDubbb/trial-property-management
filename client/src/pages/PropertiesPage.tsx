import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/RecordStates';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { label, propertyTypes, type Page, type Property } from '../types/portfolio';

export function PropertiesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ q: useDebouncedValue(search), status, page: String(page) });
  if (type) query.set('type', type);
  const result = useApiQuery<Page<Property>>(`/properties?${query}`);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR PORTFOLIO</p>
          <h1>Properties</h1>
          <p className="intro">Every address, organized in one place.</p>
        </div>
        <Link className="primary-button" to="/properties/new">
          + Add property
        </Link>
      </section>
      <section className="list-panel">
        <div className="filter-bar">
          <label className="search-label">
            Search properties
            <input
              type="search"
              placeholder="Search name, address, or city…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="active">Active properties</option>
              <option value="inactive">Inactive properties</option>
              <option value="all">All properties</option>
            </select>
          </label>
          <label>
            Property type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All types</option>
              {propertyTypes.map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {result.loading ? (
          <LoadingState />
        ) : result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : result.data?.items.length ? (
          <>
            <div className="table-scroll">
              <table>
                <caption className="sr-only">Properties</caption>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Location</th>
                    <th>Type</th>
                    <th>Units</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((property) => (
                    <tr key={property.id}>
                      <td>
                        <Link className="record-link" to={`/properties/${property.id}`}>
                          {property.name}
                        </Link>
                        <span className="table-secondary">{property.address}</span>
                      </td>
                      <td>
                        {property.city}
                        <span className="table-secondary">{property.country}</span>
                      </td>
                      <td>{label(property.propertyType)}</td>
                      <td>
                        {property.unitCount}
                        <span className="table-secondary">{property.occupiedCount} occupied</span>
                      </td>
                      <td>
                        <span className={`status-pill ${property.active ? 'active' : 'inactive'}`}>
                          {property.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link className="table-action" to={`/properties/${property.id}`}>
                          View<span className="sr-only"> {property.name}</span> →
                        </Link>
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
            title="No properties found"
            description={
              search || type || status !== 'active'
                ? 'Try another search or change your filters.'
                : 'Add your first property to start building your portfolio.'
            }
            action={{ to: '/properties/new', label: 'Add property' }}
          />
        )}
      </section>
    </>
  );
}
