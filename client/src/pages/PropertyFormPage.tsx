import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { label, propertyTypes, type Property } from '../types/portfolio';

function PropertyForm({ property }: { property?: Property }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ['name', 'address', 'city', 'region', 'country', 'propertyType', 'notes'].map((key) => [
        key,
        String(form.get(key) ?? '').trim(),
      ]),
    );
    setBusy(true);
    setError('');
    try {
      const result = await api<{ property: Property }>(
        property ? `/properties/${property.id}` : '/properties',
        { method: property ? 'PUT' : 'POST', body },
      );
      navigate(`/properties/${result.property.id}`, {
        replace: true,
        state: {
          message: property
            ? 'Property updated.'
            : 'Property created. Add units whenever you’re ready.',
        },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save property.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Property details</h2>
      <p className="intro">Required fields are marked with an asterisk.</p>
      <div className="form-grid">
        <label className="span-two">
          Property name *
          <input
            name="name"
            required
            maxLength={150}
            defaultValue={property?.name}
            placeholder="Mensah Apartments"
          />
        </label>
        <label className="span-two">
          Address *
          <input
            name="address"
            required
            maxLength={250}
            defaultValue={property?.address}
            autoComplete="street-address"
          />
        </label>
        <label>
          City *
          <input
            name="city"
            required
            maxLength={100}
            defaultValue={property?.city}
            autoComplete="address-level2"
          />
        </label>
        <label>
          State / region
          <input
            name="region"
            maxLength={100}
            defaultValue={property?.region}
            autoComplete="address-level1"
          />
        </label>
        <label>
          Country *
          <input
            name="country"
            required
            maxLength={100}
            defaultValue={property?.country}
            autoComplete="country-name"
          />
        </label>
        <label>
          Property type *
          <select name="propertyType" defaultValue={property?.propertyType || 'APARTMENT'}>
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {label(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="span-two">
          Notes
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={property?.notes}
            placeholder="Useful details about this property…"
          />
        </label>
      </div>
      <p className="field-help">
        The number of units is calculated automatically as you add units to this property.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Link
          className="secondary-button"
          to={property ? `/properties/${property.id}` : '/properties'}
        >
          Cancel
        </Link>
        <button className="primary-button" disabled={busy}>
          {busy ? 'Saving…' : property ? 'Save changes' : 'Create property'}
        </button>
      </div>
    </form>
  );
}
function EditProperty({ id }: { id: string }) {
  const result = useApiQuery<{ property: Property }>(`/properties/${id}`);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  return <PropertyForm property={result.data!.property} />;
}
export function PropertyFormPage() {
  const { id } = useParams();
  return (
    <>
      <Link className="back-link" to={id ? `/properties/${id}` : '/properties'}>
        ← Back to {id ? 'property' : 'properties'}
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR PORTFOLIO</p>
          <h1>{id ? 'Edit property' : 'Add a property'}</h1>
          <p className="intro">Give every address a place in your workspace.</p>
        </div>
      </section>
      {id ? <EditProperty id={id} /> : <PropertyForm />}
    </>
  );
}
