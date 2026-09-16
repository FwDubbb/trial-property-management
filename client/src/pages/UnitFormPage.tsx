import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { label, unitStatuses, type PropertyOption, type Unit } from '../types/portfolio';

function UnitForm({ unit }: { unit?: Unit }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const properties = useApiQuery<{ items: PropertyOption[] }>('/properties/options');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (properties.loading) return <LoadingState />;
  if (properties.error) return <ErrorState message={properties.error} retry={properties.reload} />;
  const available = properties.data!.items.filter(
    (property) => property.active || property.id === unit?.propertyId,
  );
  if (unit && !unit.propertyActive)
    return (
      <EmptyState
        title="This property is inactive"
        description="Reactivate the property before editing its units."
        action={{ to: `/properties/${unit.propertyId}`, label: 'View property' }}
      />
    );
  if (!available.length)
    return (
      <EmptyState
        title="Add a property first"
        description="Every rental unit belongs to an active property."
        action={{ to: '/properties/new', label: 'Add property' }}
      />
    );
  const preselected =
    unit?.propertyId ||
    (available.some((property) => property.id === searchParams.get('propertyId'))
      ? searchParams.get('propertyId')!
      : '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      propertyId: unit?.propertyId || String(form.get('propertyId')),
      name: String(form.get('name')).trim(),
      bedrooms: Number(form.get('bedrooms')),
      bathrooms: Number(form.get('bathrooms')),
      monthlyRent: Number(form.get('monthlyRent')),
      status:
        unit?.activeLeaseId || unit?.hasUpcomingLease ? unit.status : String(form.get('status')),
      notes: String(form.get('notes')).trim(),
    };
    setBusy(true);
    setError('');
    try {
      const result = await api<{ unit: Unit }>(unit ? `/units/${unit.id}` : '/units', {
        method: unit ? 'PUT' : 'POST',
        body,
      });
      navigate(`/units/${result.unit.id}`, {
        replace: true,
        state: { message: unit ? 'Unit updated.' : 'Unit created.' },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save unit.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Unit details</h2>
      <p className="intro">Required fields are marked with an asterisk.</p>
      <div className="form-grid">
        <label>
          Property *
          <select name="propertyId" required defaultValue={preselected} disabled={!!unit}>
            <option value="" disabled>
              Select a property
            </option>
            {available.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unit name / number *
          <input name="name" required maxLength={50} defaultValue={unit?.name} placeholder="1A" />
        </label>
        <label>
          Bedrooms *
          <input
            name="bedrooms"
            type="number"
            required
            min={0}
            max={100}
            step={1}
            defaultValue={unit?.bedrooms ?? 1}
          />
        </label>
        <label>
          Bathrooms *
          <input
            name="bathrooms"
            type="number"
            required
            min={0}
            max={100}
            step={0.5}
            defaultValue={unit?.bathrooms ?? 1}
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
            defaultValue={unit?.monthlyRent}
            placeholder="0.00"
          />
        </label>
        <label>
          Occupancy status *
          <select
            name="status"
            defaultValue={unit?.status || 'VACANT'}
            disabled={!!(unit?.activeLeaseId || unit?.hasUpcomingLease)}
          >
            {unitStatuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="span-two">
          Notes
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={unit?.notes}
            placeholder="Useful details about this rental unit…"
          />
        </label>
      </div>
      <p className="field-help">
        Enter rent in the currency you use for this company. Active and upcoming leases control this
        unit’s occupancy and availability.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Link className="secondary-button" to={unit ? `/units/${unit.id}` : '/units'}>
          Cancel
        </Link>
        <button className="primary-button" disabled={busy}>
          {busy ? 'Saving…' : unit ? 'Save changes' : 'Create unit'}
        </button>
      </div>
    </form>
  );
}
function EditUnit({ id }: { id: string }) {
  const result = useApiQuery<{ unit: Unit }>(`/units/${id}`);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  return <UnitForm unit={result.data!.unit} />;
}
export function UnitFormPage() {
  const { id } = useParams();
  return (
    <>
      <Link className="back-link" to={id ? `/units/${id}` : '/units'}>
        ← Back to {id ? 'unit' : 'units'}
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR RENTAL SPACES</p>
          <h1>{id ? 'Edit unit' : 'Add a unit'}</h1>
          <p className="intro">A few details for a space that’s ready to manage.</p>
        </div>
      </section>
      {id ? <EditUnit id={id} /> : <UnitForm />}
    </>
  );
}
