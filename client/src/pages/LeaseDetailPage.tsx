import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PaymentHistory } from '../components/PaymentHistory';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { amount, label } from '../types/portfolio';
import { formatDate, type Lease } from '../types/tenancy';

export function LeaseDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<{ lease: Lease }>(`/leases/${id}`);
  const [notice, setNotice] = useState(location.state?.message || '');
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const lease = result.data!.lease;
  const open = ['ACTIVE', 'UPCOMING'].includes(lease.status);
  async function terminate() {
    if (!reason.trim()) {
      setError('Enter a reason for ending this lease.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/leases/${id}/terminate`, { method: 'POST', body: { reason: reason.trim() } });
      setConfirm(false);
      setNotice('Lease terminated. Its record is preserved in the tenant’s history.');
      result.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to terminate lease.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/leases">
        ← All leases
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">LEASE DETAILS</p>
          <h1>{lease.tenantName}</h1>
          <p className="intro">
            {lease.propertyName} · Unit {lease.unitName}
          </p>
        </div>
        <div className="heading-actions">
          {open && lease.propertyActive && (
            <Link className="secondary-button" to={`/leases/${id}/edit`}>
              Edit lease
            </Link>
          )}
          {open && (
            <button
              className="secondary-button"
              onClick={() => {
                setError('');
                setReason('');
                setConfirm(true);
              }}
            >
              Terminate lease
            </button>
          )}
        </div>
      </section>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {!lease.propertyActive && (
        <p className="info-notice">
          This property is inactive. The lease still determines occupancy; you can terminate it
          here, or reactivate the property to edit it.
        </p>
      )}
      <section className="detail-panel">
        <div className="section-heading">
          <h2>The agreement</h2>
          <span className={`status-pill ${lease.status.toLowerCase()}`}>{label(lease.status)}</span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Tenant</dt>
            <dd>
              <Link to={`/tenants/${lease.tenantId}`}>{lease.tenantName}</Link>
            </dd>
          </div>
          <div>
            <dt>Unit / property</dt>
            <dd>
              <Link to={`/units/${lease.unitId}`}>Unit {lease.unitName}</Link> ·{' '}
              <Link to={`/properties/${lease.propertyId}`}>{lease.propertyName}</Link>
            </dd>
          </div>
          <div>
            <dt>Start date</dt>
            <dd>{formatDate(lease.startDate)}</dd>
          </div>
          <div>
            <dt>End date (inclusive)</dt>
            <dd>{formatDate(lease.endDate)}</dd>
          </div>
          <div>
            <dt>Monthly rent</dt>
            <dd>{amount(lease.monthlyRent)}</dd>
          </div>
          <div>
            <dt>Security deposit</dt>
            <dd>{amount(lease.securityDeposit)}</dd>
          </div>
          <div className="span-two">
            <dt>Notes</dt>
            <dd>{lease.notes || 'No notes yet.'}</dd>
          </div>
          {lease.terminatedAt && (
            <>
              <div>
                <dt>Terminated on</dt>
                <dd>{new Date(lease.terminatedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Termination reason</dt>
                <dd>{lease.terminationReason}</dd>
              </div>
            </>
          )}
        </dl>
      </section>
      <p className="section-footnote">
        {lease.status === 'ACTIVE'
          ? 'This lease automatically marks the unit occupied.'
          : lease.status === 'UPCOMING'
            ? 'This lease reserves the unit for its start date. Occupancy updates when the term begins.'
            : 'This lease is closed and preserved as read-only history.'}
      </p>
      <div className="section-heading">
        <h2>Payment history</h2>
        <Link className="primary-button" to={`/payments/new?leaseId=${id}`}>
          + Record payment
        </Link>
      </div>
      <PaymentHistory key={id} leaseId={id} />
      <p className="section-footnote">
        Recorded rent months keep their original amounts after lease edits or termination.
        Termination does not cancel recorded rent charges or refund payments.
      </p>
      {confirm && (
        <ConfirmDialog
          title="Terminate this lease?"
          message={
            (lease.status === 'ACTIVE'
              ? 'This ends the lease immediately and releases the unit. The lease stays in the tenant’s history. This cannot be undone.'
              : 'This cancels the future reservation. The lease stays in the tenant’s history. This cannot be undone.') +
            ' Recorded rent charges and payments are preserved; this does not issue a refund.'
          }
          confirmLabel="Confirm termination"
          busy={busy}
          error={error}
          onConfirm={() => void terminate()}
          onClose={() => setConfirm(false)}
        >
          <label>
            Reason for termination
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              required
              disabled={busy}
            />
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}
