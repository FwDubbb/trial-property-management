import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { amount, label } from '../types/portfolio';
import { formatDate } from '../types/tenancy';
import type { Expense } from '../types/finance';
export function ExpenseDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<{ expense: Expense }>(`/expenses/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(location.state?.message || '');
  async function voidRecord() {
    if (!reason.trim()) {
      setError('Enter a reason for voiding this expense.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/expenses/${id}/void`, { method: 'POST', body: { reason: reason.trim() } });
      setConfirm(false);
      setNotice('Expense voided. Its amount is excluded from totals.');
      result.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to void expense.');
    } finally {
      setBusy(false);
    }
  }
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const item = result.data!.expense;
  return (
    <>
      <Link className="back-link" to="/expenses">
        ← All expenses
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">EXPENSE RECORD</p>
          <h1>{item.description}</h1>
          <p className="intro">
            {item.propertyName} · {label(item.category)}
          </p>
        </div>
        {!item.voidedAt && (
          <button
            className="secondary-button"
            onClick={() => {
              setConfirm(true);
              setReason('');
              setError('');
            }}
          >
            Void expense
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
          <h2>{amount(item.amount)}</h2>
          <span className={`status-pill ${item.state.toLowerCase()}`}>{label(item.state)}</span>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Property</dt>
            <dd>
              <Link to={`/properties/${item.propertyId}`}>{item.propertyName}</Link>
            </dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{label(item.category)}</dd>
          </div>
          <div>
            <dt>Date paid</dt>
            <dd>{formatDate(item.expenseDate)}</dd>
          </div>
          <div>
            <dt>Recorded by</dt>
            <dd>{item.recordedByName}</dd>
          </div>
          <div>
            <dt>Recorded on</dt>
            <dd>{new Date(item.createdAt).toLocaleString()}</dd>
          </div>
          <div className="span-two">
            <dt>Notes</dt>
            <dd>{item.notes || 'No notes.'}</dd>
          </div>
          {item.voidedAt && (
            <>
              <div>
                <dt>Voided by</dt>
                <dd>{item.voidedByName}</dd>
              </div>
              <div>
                <dt>Voided on</dt>
                <dd>{new Date(item.voidedAt).toLocaleString()}</dd>
              </div>
              <div className="span-two">
                <dt>Void reason</dt>
                <dd>{item.voidReason}</dd>
              </div>
            </>
          )}
        </dl>
        <Link className="secondary-button" to={`/expenses/new?propertyId=${item.propertyId}`}>
          Record another expense
        </Link>
      </section>
      <p className="section-footnote">
        To correct an entry, void it and record a replacement. The original record stays visible.
        Voiding does not request a refund.
      </p>
      {confirm && (
        <ConfirmDialog
          title="Void this expense?"
          message="This removes the expense from totals while preserving its original record. This cannot be undone."
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
