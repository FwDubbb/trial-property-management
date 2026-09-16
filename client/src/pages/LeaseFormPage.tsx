import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { label } from '../types/portfolio';
import type { Lease, LeaseOptions } from '../types/tenancy';

function LeaseForm({ options, lease }: { options: LeaseOptions; lease?: Lease }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialUnit = lease?.unitId || params.get('unitId') || '';
  const [unitId, setUnitId] = useState(initialUnit);
  const [rent, setRent] = useState(
    lease?.monthlyRent || options.units.find((unit) => unit.id === initialUnit)?.monthlyRent || '',
  );
  const [startDate, setStartDate] = useState(
    lease?.startDate || new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(lease?.endDate || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const units = options.units.filter((unit) => unit.propertyActive || unit.id === lease?.unitId);
  if (lease && (['EXPIRED', 'TERMINATED'].includes(lease.status) || !lease.propertyActive))
    return (
      <EmptyState
        title="This lease cannot be edited"
        description={
          !lease.propertyActive
            ? 'Reactivate the property before editing this lease.'
            : 'Ended leases are preserved as history. Create a new lease for a new term.'
        }
        action={{ to: `/leases/${lease.id}`, label: 'View lease' }}
      />
    );
  if (!options.tenants.length)
    return (
      <EmptyState
        title="Add a tenant first"
        description="Every lease connects a tenant to a rental unit."
        action={{ to: '/tenants/new', label: 'Add tenant' }}
      />
    );
  if (!units.length)
    return (
      <EmptyState
        title="Add an active rental unit first"
        description="A lease needs a unit in an active property."
        action={{ to: '/units/new', label: 'Add unit' }}
      />
    );
  const today = new Date().toISOString().slice(0, 10);
  const preview =
    !endDate || endDate < startDate
      ? 'Choose lease dates'
      : endDate < today
        ? 'Expired'
        : startDate > today
          ? 'Upcoming'
          : 'Active';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (endDate < startDate) {
      setError('The end date must be on or after the start date.');
      return;
    }
    const data = new FormData(event.currentTarget);
    const body = {
      tenantId: lease?.tenantId || String(data.get('tenantId')),
      unitId,
      startDate,
      endDate,
      monthlyRent: Number(rent),
      securityDeposit: Number(data.get('securityDeposit')),
      notes: String(data.get('notes') || '').trim(),
    };
    setBusy(true);
    setError('');
    try {
      const result = await api<{ lease: Lease }>(lease ? `/leases/${lease.id}` : '/leases', {
        method: lease ? 'PUT' : 'POST',
        body,
      });
      navigate(`/leases/${result.lease.id}`, {
        replace: true,
        state: {
          message: lease
            ? 'Lease updated. Occupancy reflects the new dates.'
            : 'Lease created. Unit occupancy is managed automatically.',
        },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save lease.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Lease details</h2>
      <p className="intro">Required fields are marked with an asterisk.</p>
      <div className="form-grid">
        <label className="span-two">
          Tenant *
          <select
            name="tenantId"
            required
            disabled={!!lease}
            defaultValue={
              lease?.tenantId ||
              (options.tenants.some((tenant) => tenant.id === params.get('tenantId'))
                ? params.get('tenantId')!
                : '')
            }
          >
            <option value="" disabled>
              Select a tenant
            </option>
            {options.tenants.map((tenant) => (
              <option value={tenant.id} key={tenant.id}>
                {tenant.name}
                {tenant.email ? ` · ${tenant.email}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="span-two">
          Unit / property *
          <select
            name="unitId"
            required
            disabled={!!lease}
            value={units.some((unit) => unit.id === unitId) ? unitId : ''}
            onChange={(event) => {
              setUnitId(event.target.value);
              setRent(
                options.units.find((unit) => unit.id === event.target.value)?.monthlyRent || '',
              );
            }}
          >
            <option value="" disabled>
              Select a unit
            </option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.propertyName} · Unit {unit.name} ({label(unit.status)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Start date *
          <input
            name="startDate"
            type="date"
            required
            min="1900-01-01"
            max="9999-12-31"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label>
          End date *
          <input
            name="endDate"
            type="date"
            required
            min={startDate || '1900-01-01'}
            max="9999-12-31"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label>
          Monthly rent *
          <input
            name="monthlyRent"
            type="number"
            required
            min={0}
            max={9999999999.99}
            step={0.01}
            value={rent}
            onChange={(event) => setRent(event.target.value)}
          />
        </label>
        <label>
          Security deposit *
          <input
            name="securityDeposit"
            type="number"
            required
            min={0}
            max={9999999999.99}
            step={0.01}
            defaultValue={lease?.securityDeposit || '0.00'}
          />
        </label>
        <label className="span-two">
          Notes
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={lease?.notes}
            placeholder="Terms or details you want to keep with this lease…"
          />
        </label>
      </div>
      <div className="lease-status-preview">
        <span>Lease status</span>
        <strong>{preview}</strong>
      </div>
      <p className="field-help">
        Status follows the lease dates using UTC. The end date is included; another lease can start
        the following day. Rent and deposit are recorded amounts, not payments.
      </p>
      {lease && (
        <p className="field-help">
          Changing lease terms updates unrecorded rent months. Months with recorded payments keep
          their original expected rent and due date.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Link className="secondary-button" to={lease ? `/leases/${lease.id}` : '/leases'}>
          Cancel
        </Link>
        <button className="primary-button" disabled={busy}>
          {busy ? 'Saving…' : lease ? 'Save changes' : 'Create lease'}
        </button>
      </div>
    </form>
  );
}
function LoadedForm({ lease }: { lease?: Lease }) {
  const options = useApiQuery<LeaseOptions>('/leases/options');
  if (options.loading) return <LoadingState />;
  if (options.error) return <ErrorState message={options.error} retry={options.reload} />;
  return <LeaseForm options={options.data!} lease={lease} />;
}
function EditLease({ id }: { id: string }) {
  const result = useApiQuery<{ lease: Lease }>(`/leases/${id}`);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  return <LoadedForm lease={result.data!.lease} />;
}
export function LeaseFormPage() {
  const { id } = useParams();
  return (
    <>
      <Link className="back-link" to={id ? `/leases/${id}` : '/leases'}>
        ← Back to {id ? 'lease' : 'leases'}
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">A HOME, AGREED</p>
          <h1>{id ? 'Edit lease' : 'Create a lease'}</h1>
          <p className="intro">Connect a tenant, a unit, and the dates of their stay.</p>
        </div>
      </section>
      {id ? <EditLease id={id} /> : <LoadedForm />}
    </>
  );
}
