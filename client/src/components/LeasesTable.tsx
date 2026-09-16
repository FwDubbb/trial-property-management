import { Link } from 'react-router-dom';
import { amount, label } from '../types/portfolio';
import { formatDate, type Lease } from '../types/tenancy';

export function LeasesTable({ leases }: { leases: Lease[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">Leases</caption>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Property / unit</th>
            <th>Lease period</th>
            <th>Monthly rent</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {leases.map((lease) => (
            <tr key={lease.id}>
              <td>
                <Link className="record-link" to={`/tenants/${lease.tenantId}`}>
                  {lease.tenantName}
                </Link>
              </td>
              <td>
                <Link to={`/units/${lease.unitId}`}>Unit {lease.unitName}</Link>
                <Link className="table-secondary" to={`/properties/${lease.propertyId}`}>
                  {lease.propertyName}
                </Link>
                {!lease.propertyActive && (
                  <span className="table-secondary">Inactive property</span>
                )}
              </td>
              <td className="date-cell">
                {formatDate(lease.startDate)}
                <span className="table-secondary">to {formatDate(lease.endDate)}</span>
              </td>
              <td className="numeric">{amount(lease.monthlyRent)}</td>
              <td>
                <span className={`status-pill ${lease.status.toLowerCase()}`}>
                  {label(lease.status)}
                </span>
              </td>
              <td>
                <Link className="table-action" to={`/leases/${lease.id}`}>
                  View lease
                  <span className="sr-only">
                    {' '}
                    for {lease.tenantName}, {lease.unitName}
                  </span>{' '}
                  →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
