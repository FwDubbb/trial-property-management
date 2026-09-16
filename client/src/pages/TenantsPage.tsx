import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/RecordStates';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import type { Page } from '../types/portfolio';
import type { Tenant } from '../types/tenancy';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [housing, setHousing] = useState('all');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ q: useDebouncedValue(search), housing, page: String(page) });
  const result = useApiQuery<Page<Tenant>>(`/tenants?${query}`);
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">THE PEOPLE IN YOUR PROPERTIES</p>
          <h1>Tenants</h1>
          <p className="intro">Contact details, current homes, and lease history in one place.</p>
        </div>
        <Link className="primary-button" to="/tenants/new">
          + Add tenant
        </Link>
      </section>
      <section className="list-panel">
        <div className="filter-bar">
          <label className="search-label">
            Search tenants
            <input
              type="search"
              placeholder="Search name, email, or phone…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Housing status
            <select
              value={housing}
              onChange={(event) => {
                setHousing(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All tenants</option>
              <option value="housed">With an active lease</option>
              <option value="unassigned">Without an active lease</option>
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
                <caption className="sr-only">Tenants</caption>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Contact</th>
                    <th>Current unit</th>
                    <th>Lease</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <Link className="record-link" to={`/tenants/${tenant.id}`}>
                          {tenant.firstName} {tenant.lastName}
                        </Link>
                      </td>
                      <td>
                        {tenant.email || 'No email'}
                        <span className="table-secondary">{tenant.phone || 'No phone'}</span>
                      </td>
                      <td>
                        {tenant.currentUnitId ? (
                          <>
                            <Link to={`/units/${tenant.currentUnitId}`}>
                              Unit {tenant.currentUnitName}
                            </Link>
                            <span className="table-secondary">{tenant.currentPropertyName}</span>
                          </>
                        ) : (
                          <span className="table-secondary">Not currently assigned</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${tenant.currentLeaseId ? 'active' : 'inactive'}`}
                        >
                          {tenant.currentLeaseId ? 'Active' : 'No active lease'}
                        </span>
                      </td>
                      <td>
                        <Link className="table-action" to={`/tenants/${tenant.id}`}>
                          View profile →
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
            title="No tenants found"
            description={
              search || housing !== 'all'
                ? 'Try another search or change the housing filter.'
                : 'Add your first tenant, then connect them to a unit with a lease.'
            }
            action={{ to: '/tenants/new', label: 'Add tenant' }}
          />
        )}
      </section>
    </>
  );
}
