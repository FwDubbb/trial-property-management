import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import { useApiQuery } from '../hooks/useApiQuery';
import { ErrorState, LoadingState } from '../components/RecordStates';
import type { PortfolioSummary } from '../types/portfolio';

export function OverviewPage() {
  const { user } = useAuth();
  const summary = useApiQuery<PortfolioSummary>('/properties/summary');
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR COMPANY WORKSPACE</p>
          <h1>Welcome, {user?.name.split(' ')[0]}.</h1>
          <p className="intro">A clear view of {user?.companyName}.</p>
        </div>
        <Link className="primary-button" to="/properties/new">
          + Add property
        </Link>
      </section>
      <section className="welcome-panel">
        <div>
          <span className="welcome-kicker">ROOM TO GROW</span>
          <h2>
            Every property.
            <br />A little more organized.
          </h2>
          <p>
            Manage your addresses, keep track of your units,
            <br />
            and make space for what’s next.
          </p>
        </div>
        <div className="building-art" aria-hidden="true">
          <div className="building building-back">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="building building-front">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>
      <div className="section-heading">
        <h2>Your active portfolio</h2>
        <span>Inactive properties are excluded</span>
      </div>
      {summary.loading ? (
        <LoadingState />
      ) : summary.error ? (
        <ErrorState message={summary.error} retry={summary.reload} />
      ) : (
        <section className="stats-grid">
          {[
            ['Properties', summary.data!.properties],
            ['Total units', summary.data!.units],
            ['Occupied units', summary.data!.occupied],
            ['Vacant units', summary.data!.vacant],
          ].map(([title, value]) => (
            <article className="stat-card" key={title}>
              <span>{title}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>
      )}
      <section className="next-grid">
        <article className="guide-panel">
          <p className="eyebrow">YOUR ADDRESSES</p>
          <h2>A place for every property.</h2>
          <p className="intro">Add your properties, update their details, and see their units.</p>
          <Link className="secondary-button" to="/properties">
            Manage properties →
          </Link>
        </article>
        <article className="guide-panel">
          <p className="eyebrow">YOUR RENTAL SPACES</p>
          <h2>Know where every unit stands.</h2>
          <p className="intro">Review unit details, monthly rents, and occupancy statuses.</p>
          <Link className="secondary-button" to="/units">
            Manage units →
          </Link>
        </article>
      </section>
    </>
  );
}
