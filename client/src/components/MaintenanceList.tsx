import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiQuery, useDebouncedValue } from '../hooks/useApiQuery';
import { label, type Page, type PropertyOption } from '../types/portfolio';
import { formatDate } from '../types/tenancy';
import {
  maintenanceStatuses,
  maintenancePriorities,
  type MaintenanceRequest,
} from '../types/maintenance';
import { EmptyState, ErrorState, LoadingState, Pagination } from './RecordStates';

function PropertyFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const result = useApiQuery<{ items: PropertyOption[] }>('/properties/options');
  return (
    <>
      <label>
        Property
        <select
          value={value}
          disabled={result.loading || !!result.error}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">All properties</option>
          {result.data?.items.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
              {property.active ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </label>
      {result.error && <ErrorState message={result.error} retry={result.reload} />}
    </>
  );
}
export function MaintenanceList({
  tenantId,
  unitId,
  propertyId: fixedPropertyId,
  filters = false,
}: {
  tenantId?: string;
  unitId?: string;
  propertyId?: string;
  filters?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ q: useDebouncedValue(search), page: String(page) });
  for (const [key, value] of Object.entries({
    tenantId,
    unitId,
    propertyId: fixedPropertyId || propertyId,
    status,
    priority,
  }))
    if (value) query.set(key, value);
  const result = useApiQuery<Page<MaintenanceRequest>>(`/maintenance?${query}`);
  return (
    <section className="list-panel">
      {filters && (
        <div className="filter-bar">
          <label className="search-label">
            Search maintenance
            <input
              type="search"
              placeholder="Request, issue, property, or assigned person"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Request status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {maintenanceStatuses.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All priorities</option>
              {maintenancePriorities.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
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
            <table>
              <caption className="sr-only">Maintenance requests</caption>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Property / unit</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned to</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className="record-link" to={`/maintenance/${item.id}`}>
                        {item.title}
                      </Link>
                      <span className="table-secondary">Request #{item.requestNumber}</span>
                    </td>
                    <td>
                      <Link to={`/properties/${item.propertyId}`}>{item.propertyName}</Link>
                      {item.unitId ? (
                        <Link className="table-secondary" to={`/units/${item.unitId}`}>
                          Unit {item.unitName}
                        </Link>
                      ) : (
                        <span className="table-secondary">Property-wide</span>
                      )}
                      {item.tenantId && (
                        <Link className="table-secondary" to={`/tenants/${item.tenantId}`}>
                          {item.tenantName}
                        </Link>
                      )}
                    </td>
                    <td>
                      <span className={`priority-badge priority-${item.priority.toLowerCase()}`}>
                        {label(item.priority)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill maintenance-${item.status.toLowerCase()}`}>
                        {label(item.status)}
                      </span>
                    </td>
                    <td>{item.assignedTo || 'Unassigned'}</td>
                    <td className="date-cell">{formatDate(item.submittedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...result.data} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          title="No maintenance requests found"
          description={
            filters
              ? 'Try changing your filters, or add a request to track a repair.'
              : 'Requests linked to this record will appear here.'
          }
        />
      )}
    </section>
  );
}
