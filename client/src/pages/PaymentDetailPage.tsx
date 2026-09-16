import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { amount, label } from '../types/portfolio';
import { formatMonth, type Payment } from '../types/payments';
import { formatDate } from '../types/tenancy';
export function PaymentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<{ payment: Payment }>(`/payments/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.message || '');
  async function voidRecord() {
    if (!reason.trim()) {
      setError('Enter a reason for voiding this payment.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/payments/${id}/void`, { method: 'POST', body: { reason: reason.trim() } });
      setConfirm(false);
      setNotice('Payment voided. Its amount has been removed from the paid total.');
      result.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to void payment.');
    } finally {
      setBusy(false);
    }
  }
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const payment = result.data!.payment;
  return (
    <>
      <Link className="back-link" to="/payments/history">
        ← Payment history
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PAYMENT RECORD</p>
          <h1>Rent payment</h1>
          <p className="intro">
            {payment.tenantName} · {formatMonth(payment.period)}
          </p>
        </div>
        {!payment.voidedAt && (
          <button
            className="secondary-button"
            onClick={() => {
              setConfirm(true);
              setReason('');
              setError('');
            }}
          >
            Void payment
          </button>
        )}
      </section>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <section className="detail-panel">
        <div className="section-heading">
          <h2>{amount(payment.amount)}</h2>
          <span className={`status-pill ${payment.state.toLowerCase()}`}>
            {label(payment.state)}
          </span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Tenant</dt>
            <dd>
              <Link to={`/tenants/${payment.tenantId}`}>{payment.tenantName}</Link>
            </dd>
          </div>
          <div>
            <dt>Property / unit</dt>
            <dd>
              <Link to={`/properties/${payment.propertyId}`}>{payment.propertyName}</Link> ·{' '}
              <Link to={`/units/${payment.unitId}`}>{payment.unitName}</Link>
            </dd>
          </div>
          <div>
            <dt>Rent month</dt>
            <dd>{formatMonth(payment.period)}</dd>
          </div>
          <div>
            <dt>Payment date</dt>
            <dd>{formatDate(payment.paymentDate)}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd>{label(payment.method)}</dd>
          </div>
          <div>
            <dt>Reference number</dt>
            <dd>{payment.reference || 'Not provided'}</dd>
          </div>
          <div>
            <dt>Recorded by</dt>
            <dd>{payment.recordedByName}</dd>
          </div>
          <div>
            <dt>Recorded on</dt>
            <dd>{new Date(payment.createdAt).toLocaleString()}</dd>
          </div>
          <div className="span-two">
            <dt>Notes</dt>
            <dd>{payment.notes || 'No notes.'}</dd>
          </div>
          {payment.voidedAt && (
            <>
              <div>
                <dt>Voided by</dt>
                <dd>{payment.voidedByName}</dd>
              </div>
              <div>
                <dt>Voided on</dt>
                <dd>{new Date(payment.voidedAt).toLocaleString()}</dd>
              </div>
              <div className="span-two">
                <dt>Void reason</dt>
                <dd>{payment.voidReason}</dd>
              </div>
            </>
          )}
        </dl>
        <div className="profile-links">
          <Link to={`/leases/${payment.leaseId}`}>View lease →</Link>
          <Link to={`/payments/new?leaseId=${payment.leaseId}&period=${payment.period}`}>
            Record another payment →
          </Link>
        </div>
      </section>
      <p className="section-footnote">
        To correct an entry, void it with a reason and record a replacement. Voiding changes the
        rent balance and preserves the original entry; it does not issue a refund.
      </p>
      {confirm && (
        <ConfirmDialog
          title="Void this payment?"
          message="This removes the amount from the paid total and restores the outstanding balance. The original record remains visible. This cannot be undone."
          confirmLabel="Confirm void"
          busy={busy}
          error={error}
          onConfirm={() => void voidRecord()}
          onClose={() => setConfirm(false)}
        >
          <label>
            Reason for voiding
            <textarea
              required
              maxLength={1000}
              disabled={busy}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}
