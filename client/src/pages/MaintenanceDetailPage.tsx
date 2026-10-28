import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api, ApiError } from '../services/http';
import { label } from '../types/portfolio';
import { formatDate } from '../types/tenancy';
import type { MaintenanceDetail, MaintenanceStatus } from '../types/maintenance';
export function MaintenanceDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<MaintenanceDetail>(`/maintenance/${id}`);
  const [target, setTarget] = useState<MaintenanceStatus | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [notice, setNotice] = useState(location.state?.message || '');
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const item = result.data!.request;
  const closed = ['COMPLETED', 'CANCELLED'].includes(item.status);
  const reasonRequired = target === 'CANCELLED' || closed;
  function choose(status: MaintenanceStatus) {
    setTarget(status);
    setReason('');
    setError('');
    setStale(false);
  }
  async function changeStatus() {
    if (reasonRequired && !reason.trim()) {
      setError('Enter a reason for this change.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/maintenance/${id}/status`, {
        method: 'PATCH',
        body: { status: target, reason: reason.trim(), version: item.version },
      });
      setTarget(null);
      setNotice('Request status updated.');
      result.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update status.');
      setStale(error instanceof ApiError && error.status === 409);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/maintenance">
        ← All maintenance
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">REQUEST #{item.requestNumber}</p>
          <h1>{item.title}</h1>
          <p className="intro">
            {item.propertyName}
            {item.unitName ? ` · Unit ${item.unitName}` : ' · Property-wide'}
          </p>
        </div>
        <div className="heading-actions">
          {!closed && (
            <Link className="secondary-button" to={`/maintenance/${id}/edit`}>
              Edit request
            </Link>
          )}
        </div>
      </section>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <section className="detail-panel">
        <div className="section-heading">
          <h2>Request details</h2>
          <div className="maintenance-badges">
            <span className={`priority-badge priority-${item.priority.toLowerCase()}`}>
              {label(item.priority)} priority
            </span>
            <span className={`status-pill maintenance-${item.status.toLowerCase()}`}>
              {label(item.status)}
            </span>
          </div>
        </div>
        <p className="maintenance-description">{item.description}</p>
        <dl className="detail-grid">
          <div>
            <dt>Property</dt>
            <dd>
              <Link to={`/properties/${item.propertyId}`}>{item.propertyName}</Link>
              {!item.propertyActive && ' (inactive)'}
            </dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>
              {item.unitId ? (
                <Link to={`/units/${item.unitId}`}>{item.unitName}</Link>
              ) : (
                'Property-wide / common area'
              )}
            </dd>
          </div>
          <div>
            <dt>Tenant</dt>
            <dd>
              {item.tenantId ? (
                <Link to={`/tenants/${item.tenantId}`}>{item.tenantName}</Link>
              ) : (
                'No linked tenant'
              )}
            </dd>
          </div>
          <div>
            <dt>Assigned to</dt>
            <dd>{item.assignedTo || 'Unassigned'}</dd>
          </div>
          <div>
            <dt>Date submitted</dt>
            <dd>{formatDate(item.submittedDate)}</dd>
          </div>
          <div>
            <dt>Completion date</dt>
            <dd>
              {item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Not completed'}
            </dd>
          </div>
          <div>
            <dt>Created by</dt>
            <dd>{item.createdByName}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{new Date(item.updatedAt).toLocaleString()}</dd>
          </div>
          <div className="span-two">
            <dt>Notes</dt>
            <dd className="maintenance-description">{item.notes || 'No notes yet.'}</dd>
          </div>
        </dl>
        <div className="maintenance-actions">
          {closed ? (
            <button
              className="primary-button"
              onClick={() => choose(item.assignedTo ? 'ASSIGNED' : 'SUBMITTED')}
            >
              Reopen request
            </button>
          ) : (
            <>
              {item.assignedTo && item.status !== 'IN_PROGRESS' && (
                <button className="primary-button" onClick={() => choose('IN_PROGRESS')}>
                  Start work
                </button>
              )}
              {item.status === 'IN_PROGRESS' && (
                <button className="secondary-button" onClick={() => choose('ASSIGNED')}>
                  Return to assigned
                </button>
              )}
              <button className="primary-button" onClick={() => choose('COMPLETED')}>
                Mark completed
              </button>
              <button className="secondary-button" onClick={() => choose('CANCELLED')}>
                Cancel request
              </button>
            </>
          )}
        </div>
        {!closed && !item.assignedTo && (
          <p className="field-help">Use Edit request to assign a person before starting work.</p>
        )}
      </section>
      <div className="section-heading">
        <h2>Activity history</h2>
      </div>
      <section className="detail-panel">
        <ol className="maintenance-timeline">
          {result.data!.events.map((event) => (
            <li key={event.id}>
              <strong>
                {event.action === 'CREATED'
                  ? 'Request created'
                  : event.action === 'UPDATED'
                    ? 'Details updated'
                    : `Status changed to ${label(event.toStatus)}`}
              </strong>
              <p>
                {event.actorName} · {new Date(event.createdAt).toLocaleString()}
              </p>
              <p>
                {event.fromStatus ? `${label(event.fromStatus)} → ` : ''}
                {label(event.toStatus)} · {label(event.priority)} priority ·{' '}
                {event.assignedTo || 'Unassigned'}
              </p>
              {event.reason && <p className="maintenance-description">{event.reason}</p>}
            </li>
          ))}
        </ol>
      </section>
      {target && (
        <ConfirmDialog
          title={
            closed
              ? 'Reopen this request?'
              : target === 'CANCELLED'
                ? 'Cancel this request?'
                : target === 'COMPLETED'
                  ? 'Mark this request completed?'
                  : 'Update request status?'
          }
          message={
            target === 'CANCELLED'
              ? 'The request will be closed and kept in the history. You can reopen it later.'
              : target === 'COMPLETED'
                ? 'This records the completion date and closes the request. You can reopen it if more work is needed.'
                : 'This updates the request and records the change in its activity history.'
          }
          confirmLabel={
            stale
              ? 'Reload latest details'
              : closed
                ? 'Confirm reopen'
                : target === 'CANCELLED'
                  ? 'Confirm cancellation'
                  : target === 'COMPLETED'
                    ? 'Confirm completion'
                    : 'Confirm status'
          }
          busy={busy}
          error={error}
          onConfirm={() => {
            if (stale) {
              setTarget(null);
              result.reload();
            } else void changeStatus();
          }}
          onClose={() => setTarget(null)}
        >
          <label>
            {reasonRequired ? 'Reason for change *' : 'Update note (optional)'}
            <textarea
              maxLength={1000}
              required={reasonRequired}
              disabled={busy || stale}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </ConfirmDialog>
      )}
    </>
  );
}
