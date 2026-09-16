import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import type { Tenant } from '../types/tenancy';

function TenantForm({ tenant }: { tenant?: Tenant }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      [
        'firstName',
        'lastName',
        'phone',
        'email',
        'emergencyContactName',
        'emergencyContactPhone',
        'notes',
      ].map((key) => [key, String(data.get(key) || '').trim()]),
    );
    if (!body.firstName || !body.lastName) {
      setError('First and last name are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api<{ tenant: Tenant }>(tenant ? `/tenants/${tenant.id}` : '/tenants', {
        method: tenant ? 'PUT' : 'POST',
        body,
      });
      navigate(`/tenants/${result.tenant.id}`, {
        replace: true,
        state: {
          message: tenant
            ? 'Tenant updated.'
            : 'Tenant added. Create a lease to assign their unit.',
        },
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save tenant.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="detail-panel record-form" onSubmit={submit}>
      <h2>Contact details</h2>
      <p className="intro">Required fields are marked with an asterisk.</p>
      <div className="form-grid">
        <label>
          First name *
          <input
            name="firstName"
            required
            maxLength={100}
            autoComplete="given-name"
            defaultValue={tenant?.firstName}
          />
        </label>
        <label>
          Last name *
          <input
            name="lastName"
            required
            maxLength={100}
            autoComplete="family-name"
            defaultValue={tenant?.lastName}
          />
        </label>
        <label>
          Phone number
          <input
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            defaultValue={tenant?.phone}
          />
        </label>
        <label>
          Email address
          <input
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            defaultValue={tenant?.email}
          />
        </label>
        <label>
          Emergency contact name
          <input
            name="emergencyContactName"
            maxLength={150}
            defaultValue={tenant?.emergencyContactName}
          />
        </label>
        <label>
          Emergency contact phone
          <input
            name="emergencyContactPhone"
            type="tel"
            maxLength={40}
            defaultValue={tenant?.emergencyContactPhone}
          />
        </label>
        <label className="span-two">
          Notes
          <textarea
            name="notes"
            maxLength={5000}
            defaultValue={tenant?.notes}
            placeholder="Useful information for managing this tenancy…"
          />
        </label>
      </div>
      <p className="field-help">The current unit is assigned through an active lease.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Link className="secondary-button" to={tenant ? `/tenants/${tenant.id}` : '/tenants'}>
          Cancel
        </Link>
        <button className="primary-button" disabled={busy}>
          {busy ? 'Saving…' : tenant ? 'Save changes' : 'Add tenant'}
        </button>
      </div>
    </form>
  );
}
function EditTenant({ id }: { id: string }) {
  const result = useApiQuery<{ tenant: Tenant }>(`/tenants/${id}`);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  return <TenantForm tenant={result.data!.tenant} />;
}
export function TenantFormPage() {
  const { id } = useParams();
  return (
    <>
      <Link className="back-link" to={id ? `/tenants/${id}` : '/tenants'}>
        ← Back to {id ? 'profile' : 'tenants'}
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">TENANT INFORMATION</p>
          <h1>{id ? 'Edit tenant' : 'Add a tenant'}</h1>
          <p className="intro">Keep the details that help you stay in touch.</p>
        </div>
      </section>
      {id ? <EditTenant id={id} /> : <TenantForm />}
    </>
  );
}
