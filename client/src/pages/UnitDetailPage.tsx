import { Link, useLocation, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/RecordStates';
import { useApiQuery } from '../hooks/useApiQuery';
import { amount, label, type Unit } from '../types/portfolio';

export function UnitDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const result = useApiQuery<{ unit: Unit }>(`/units/${id}`);
  if (result.loading) return <LoadingState />;
  if (result.error) return <ErrorState message={result.error} retry={result.reload} />;
  const unit = result.data!.unit;
  return (
    <>
      <Link className="back-link" to="/units">
        ← All units
      </Link>
      <section className="page-heading">
        <div>
          <p className="eyebrow">UNIT DETAILS</p>
          <h1>Unit {unit.name}</h1>
          <p className="intro">
            <Link to={`/properties/${unit.propertyId}`}>{unit.propertyName}</Link>
          </p>
        </div>
        {unit.propertyActive && (
          <Link className="primary-button" to={`/units/${id}/edit`}>
            Edit unit
          </Link>
        )}
      </section>
      {location.state?.message && (
        <p className="success-notice" role="status">
          {location.state.message}
        </p>
      )}
      {!unit.propertyActive && (
        <p className="info-notice">
          This unit belongs to an inactive property.{' '}
          <Link to={`/properties/${unit.propertyId}`}>View the property</Link> to reactivate it.
        </p>
      )}
      <section className="detail-panel">
        <h2>At a glance</h2>
        <dl className="detail-grid">
          <div>
            <dt>Property</dt>
            <dd>
              <Link to={`/properties/${unit.propertyId}`}>{unit.propertyName}</Link>
            </dd>
          </div>
          <div>
            <dt>Occupancy status</dt>
            <dd>
              <span className={`status-pill ${unit.status.toLowerCase()}`}>
                {label(unit.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt>Bedrooms</dt>
            <dd>{unit.bedrooms}</dd>
          </div>
          <div>
            <dt>Bathrooms</dt>
            <dd>{unit.bathrooms}</dd>
          </div>
          <div>
            <dt>Monthly rent</dt>
            <dd>{amount(unit.monthlyRent)}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{unit.notes || 'No notes yet.'}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
