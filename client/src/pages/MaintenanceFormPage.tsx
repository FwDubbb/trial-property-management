import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api, ApiError } from '../services/http';
import { label } from '../types/portfolio';
import {
  maintenancePriorities,
  type MaintenanceRequest,
  type MaintenanceOptions,
  type MaintenanceDetail,
} from '../types/maintenance';

function MaintenanceForm({
  options,
  item,
}: {
  options: MaintenanceOptions;
  item?: MaintenanceRequest;
}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialUnit = item?.unitId || params.get('unitId') || '';
  const [propertyId, setPropertyId] = useState(
    item?.propertyId ||
      params.get('propertyId') ||
      options.units.find((unit) => unit.id === initialUnit)?.propertyId ||
      '',
  );
  const [unitId, setUnitId] = useState(initialUnit);
  const [tenantId, setTenantId] = useState(item?.tenantId || params.get('tenantId') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const properties = options.properties.filter(
    (property) => property.active || property.id === item?.propertyId,
  );
  const units = options.units.filter((unit) => unit.propertyId === propertyId);
  const tenants = options.tenants.filter((tenant) => tenant.unitIds.includes(unitId));
  if (item && ['COMPLETED', 'CANCELLED'].includes(item.status))
    return (
      <EmptyState
        title="This request is closed"
        description="Reopen the request from its detail page before editing."
        action={{ to: `/maintenance/${item.id}`, label: 'View request' }}
      />
    );
  if (!properties.length)
    return (
      <EmptyState
        title="Add an active property first"
        description="Maintenance requests belong to a property."
        action={{ to: '/properties/new', label: 'Add property' }}
      />
    );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setStale(false);
    const details = {
      title: String(fields.get('title') || '').trim(),
      description: String(fields.get('description') || '').trim(),
      priority: String(fields.get('priority')),
      submittedDate: String(fields.get('submittedDate')),
      assignedTo: String(fields.get('assignedTo') || '').trim(),
      notes: String(fields.get('notes') || '').trim(),
    };
    try {
      const result = await api<{ request: MaintenanceRequest }>(
        item ? `/maintenance/${item.id}` : '/maintenance',
        {
          method: item ? 'PUT' : 'POST',
          body: item
            ? { ...details, version: item.version }
            : {
                ...details,
                propertyId,
                unitId: unitId || null,
                tenantId: tenants.some((tenant) => tenant.id === tenantId) ? tenantId : null,
              },
        },
      );
      navigate(`/maintenance/${result.request.id}`, {
        replace: true,
        state: { message: item ? 'Request updated.' : 'Maintenance request created.' },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save request.');
      setStale(error instanceof ApiError && error.status === 409);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Request details</h2>
      <p className="intro">Required fields are marked with an asterisk.</p>
      <fieldset className="maintenance-fields" disabled={busy}>
        <div className="form-grid">
          <label className="span-two">
            Property *
            <select
              required
              disabled={!!item}
              value={properties.some((property) => property.id === propertyId) ? propertyId : ''}
              onChange={(event) => {
                setPropertyId(event.target.value);
                setUnitId('');
                setTenantId('');
              }}
            >
              <option value="" disabled>
                Select a property
              </option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                  {property.active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unit
            <select
              disabled={!!item || !propertyId}
              value={units.some((unit) => unit.id === unitId) ? unitId : ''}
              onChange={(event) => {
                setUnitId(event.target.value);
                setTenantId('');
              }}
            >
              <option value="">Property-wide / common area</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tenant
            <select
              disabled={!!item || !unitId}
              value={tenants.some((tenant) => tenant.id === tenantId) ? tenantId : ''}
              onChange={(event) => setTenantId(event.target.value)}
            >
              <option value="">No linked tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <p className="field-help span-two">
            A tenant is optional. Choices include tenants with a lease for the selected unit. The
            property, unit, and tenant stay fixed after creation.
          </p>
          <label className="span-two">
            Title *
            <input
              name="title"
              required
              maxLength={150}
              defaultValue={item?.title}
              placeholder="Kitchen sink leaking"
            />
          </label>
          <label className="span-two">
            Description *
            <textarea
              name="description"
              required
              maxLength={10000}
              defaultValue={item?.description}
              placeholder="Describe the problem and where it is located."
            />
          </label>
          <label>
            Priority *
            <select name="priority" required defaultValue={item?.priority || 'MEDIUM'}>
              {maintenancePriorities.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date submitted *
            <input
              name="submittedDate"
              type="date"
              required
              min="1900-01-01"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={item?.submittedDate || new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="span-two">
            Assigned to
            <input
              name="assignedTo"
              maxLength={150}
              defaultValue={item?.assignedTo}
              placeholder="Employee or contractor name"
            />
          </label>
          <p className="field-help span-two">
            Adding a person moves a Submitted request to Assigned. This records the assignment; it
            does not send a message.
          </p>
          <label className="span-two">
            Notes
            <textarea
              name="notes"
              maxLength={5000}
              defaultValue={item?.notes}
              placeholder="Access details, repair notes, or follow-up information"
            />
          </label>
        </div>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {stale && (
        <button type="button" className="secondary-button" onClick={() => window.location.reload()}>
          Reload latest details
        </button>
      )}
      <div className="form-actions">
        <Link className="secondary-button" to={item ? `/maintenance/${item.id}` : '/maintenance'}>
          Cancel
        </Link>
        <button className="primary-button" disabled={busy || stale}>
          {busy ? 'Saving…' : item ? 'Save changes' : 'Create request'}
        </button>
      </div>
    </form>
  );
}
function LoadedForm({ item }: { item?: MaintenanceRequest }) {
  const options = useApiQuery<MaintenanceOptions>('/maintenance/options');
  return options.loading ? (
    <LoadingState />
  ) : options.error ? (
    <ErrorState message={options.error} retry={options.reload} />
  ) : (
    <MaintenanceForm options={options.data!} item={item} />
  );
}
function EditRequest({ id }: { id: string }) {
  const result = useApiQuery<MaintenanceDetail>(`/maintenance/${id}`);
  return result.loading ? (
    <LoadingState />
  ) : result.error ? (
    <ErrorState message={result.error} retry={result.reload} />
  ) : (
    <LoadedForm item={result.data!.request} />
  );
}
export function MaintenanceFormPage() {
  const { id } = useParams();
  return (
    <>
      <Link className="back-link" to={id ? `/maintenance/${id}` : '/maintenance'}>
        ← Back to {id ? 'request' : 'maintenance'}
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">REPAIRS & UPKEEP</p>
          <h1>{id ? 'Edit request' : 'Add maintenance request'}</h1>
          <p className="intro">Keep the details needed to resolve the issue.</p>
        </div>
      </section>
      {id ? <EditRequest id={id} /> : <LoadedForm />}
    </>
  );
}
