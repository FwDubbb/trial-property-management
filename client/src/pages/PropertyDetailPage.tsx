import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../components/RecordStates';
import { UnitsTable } from '../components/UnitsTable';
import { useApiQuery } from '../hooks/useApiQuery';
import { api } from '../services/http';
import { label, type Page, type Property, type Unit } from '../types/portfolio';

export function PropertyDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<{ property: Property }>(`/properties/${id}`);
  const [page, setPage] = useState(1);
  const units = useApiQuery<Page<Unit>>(`/units?propertyId=${id}&propertyStatus=all&page=${page}`);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.message || '');
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const property = result.data!.property;
  async function changeStatus() {
    setBusy(true);
    setError('');
    try {
      await api(`/properties/${id}/status`, {
        method: 'PATCH',
        body: { active: !property.active },
      });
      setConfirm(false);
      setNotice(
        property.active
          ? 'Property deactivated. Its units have been preserved.'
          : 'Property reactivated.',
      );
      result.reload();
      units.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change status.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/properties">
        ← All properties
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PROPERTY DETAILS</p>
          <h1>{property.name}</h1>
          <p className="intro">
            {property.address} · {property.city}, {property.country}
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" to={`/properties/${id}/edit`}>
            Edit property
          </Link>
          <button
            className="secondary-button"
            onClick={() => {
              setError('');
              setConfirm(true);
            }}
          >
            {property.active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </section>
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      {!property.active && (
        <p className="info-notice">
          This property is inactive. Its units are preserved and excluded from the active portfolio.
          Reactivate it to add or edit units.
        </p>
      )}
      <section className="detail-panel">
        <h2>At a glance</h2>
        <dl className="detail-grid">
          <div>
            <dt>Property type</dt>
            <dd>{label(property.propertyType)}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`status-pill ${property.active ? 'active' : 'inactive'}`}>
                {property.active ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
          <div>
            <dt>Total units</dt>
            <dd>{property.unitCount}</dd>
          </div>
          <div>
            <dt>Occupied units</dt>
            <dd>{property.occupiedCount}</dd>
          </div>
          <div>
            <dt>State / region</dt>
            <dd>{property.region || 'Not specified'}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{property.notes || 'No notes yet.'}</dd>
          </div>
        </dl>
      </section>
      <div className="section-heading">
        <h2>Rental units</h2>
        {property.active && (
          <Link className="primary-button" to={`/units/new?propertyId=${id}`}>
            + Add unit
          </Link>
        )}
      </div>
      <section className="list-panel">
        {units.loading ? (
          <LoadingState />
        ) : units.error ? (
          <ErrorState message={units.error} retry={units.reload} />
        ) : units.data?.items.length ? (
          <>
            <UnitsTable units={units.data.items} />
            <Pagination {...units.data} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No units yet"
            description={
              property.active
                ? 'Add the rental units that make up this property.'
                : 'Reactivate this property to add units.'
            }
          />
        )}
      </section>
      {confirm && (
        <ConfirmDialog
          title={`${property.active ? 'Deactivate' : 'Reactivate'} ${property.name}?`}
          message={
            property.active
              ? 'This hides the property and its units from the active portfolio. All records are preserved, and you can reactivate the property later.'
              : 'This returns the property and its units to your active portfolio.'
          }
          confirmLabel={property.active ? 'Deactivate property' : 'Reactivate property'}
          busy={busy}
          error={error}
          onConfirm={() => void changeStatus()}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  );
}
