import { Link, useLocation, useParams } from 'react-router-dom';
import { LeaseHistory } from '../components/LeaseHistory';
import { PaymentHistory } from '../components/PaymentHistory';
import { RentBalances } from './PaymentsPage';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import type { Tenant } from '../types/tenancy';

export function TenantDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<{ tenant: Tenant }>(`/tenants/${id}`);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const tenant = result.data!.tenant;
  return (
    <>
      <Link className="back-link" to="/tenants">
        ← All tenants
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">TENANT PROFILE</p>
          <h1>
            {tenant.firstName} {tenant.lastName}
          </h1>
          <p className="intro">Contact information and tenancy at a glance.</p>
        </div>
        <Link className="secondary-button" to={`/tenants/${id}/edit`}>
          Edit tenant
        </Link>
      </section>
      {location.state?.message && (
        <p className="success-notice" role="status">
          {location.state.message}
        </p>
      )}
      <div className="profile-grid">
        <section className="detail-panel">
          <h2>Contact details</h2>
          <dl className="detail-grid">
            <div>
              <dt>Phone</dt>
              <dd>{tenant.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{tenant.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Emergency contact</dt>
              <dd>{tenant.emergencyContactName || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Emergency phone</dt>
              <dd>{tenant.emergencyContactPhone || 'Not provided'}</dd>
            </div>
            <div className="span-two">
              <dt>Notes</dt>
              <dd>{tenant.notes || 'No notes yet.'}</dd>
            </div>
          </dl>
        </section>
        <section className="detail-panel current-home">
          <p className="eyebrow">CURRENT HOME</p>
          {tenant.currentUnitId ? (
            <>
              <h2>Unit {tenant.currentUnitName}</h2>
              <p>{tenant.currentPropertyName}</p>
              <span className="status-pill active">Active lease</span>
              <div className="profile-links">
                <Link to={`/units/${tenant.currentUnitId}`}>View unit →</Link>
                <Link to={`/leases/${tenant.currentLeaseId}`}>View current lease →</Link>
              </div>
            </>
          ) : (
            <>
              <h2>No active lease</h2>
              <p>A current unit appears here when a lease is active.</p>
              <Link className="secondary-button" to={`/leases/new?tenantId=${id}`}>
                Create a lease
              </Link>
            </>
          )}
        </section>
      </div>
      <div className="section-heading">
        <h2>Lease history</h2>
        <Link className="primary-button" to={`/leases/new?tenantId=${id}`}>
          + Create lease
        </Link>
      </div>
      <LeaseHistory key={id} tenantId={id} />
      <div className="section-heading">
        <h2>Rent balances</h2>
      </div>
      <RentBalances key={`rent-${id}`} tenantId={id} />
      <div className="section-heading">
        <h2>Payment history</h2>
      </div>
      <PaymentHistory key={`payments-${id}`} tenantId={id} />
      <div className="next-grid">
        <section className="guide-panel">
          <h2>Maintenance history</h2>
          <p className="intro">Maintenance tracking is not available yet.</p>
        </section>
      </div>
    </>
  );
}
