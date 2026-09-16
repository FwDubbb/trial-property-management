import { ConnectionCard } from '../components/ConnectionCard';
import { useConnectionChecks } from '../hooks/useConnectionChecks';
import { AppLayout } from '../layouts/AppLayout';
import { Link } from 'react-router-dom';

export function SetupPage() {
  const { api, database, checkedAt, check, checking } = useConnectionChecks();
  return (
    <AppLayout>
      <section className="page-heading">
        <div>
          <p className="eyebrow">PHASE 01 · PROJECT SETUP</p>
          <h1>Let’s get connected.</h1>
          <p className="intro">A clear view of your application’s foundation.</p>
        </div>
        <button className="primary-button" onClick={() => void check()} disabled={checking}>
          <span aria-hidden="true">↻</span>{' '}
          {checking ? 'Checking connections…' : 'Check connections'}
        </button>
      </section>
      <section className="welcome-panel">
        <div>
          <span className="welcome-kicker">YOUR WORKSPACE, TAKING SHAPE</span>
          <h2>
            Good management starts
            <br />
            with a strong foundation.
          </h2>
          <p>
            React, Express, and PostgreSQL — connected
            <br className="desktop-break" /> and ready for the next chapter.
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
          <div className="building-ground" />
        </div>
        <span className="foundation-label">01 — FOUNDATION</span>
      </section>
      <div className="section-heading">
        <h2>Connection status</h2>
        <span>
          {checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : 'Running checks'}
        </span>
      </div>
      <section
        className="connection-grid"
        aria-live="polite"
        aria-busy={checking}
        aria-label="Connection status"
      >
        <ConnectionCard
          number="01"
          title="Frontend"
          subtitle="React · TypeScript · Vite"
          state={{ status: 'success', message: 'Your application is running in the browser.' }}
        />
        <ConnectionCard
          number="02"
          title="Backend API"
          subtitle="Node.js · Express · TypeScript"
          state={api}
        />
        <ConnectionCard
          number="03"
          title="Database"
          subtitle="PostgreSQL · Connection pool"
          state={database}
        />
      </section>
      <section className="next-grid">
        <article className="guide-panel">
          <span className="eyebrow">LOCAL CHECKLIST</span>
          <h2>Make yourself at home.</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Start your services</strong>
                <p>
                  Run <code>npm run dev</code> from the project root.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Connect your database</strong>
                <p>
                  Set <code>DATABASE_URL</code> in <code>server/.env</code>, then run{' '}
                  <code>npm run db:check</code>.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Check the connection</strong>
                <p>Use the button above to check the API and database again.</p>
              </div>
            </li>
          </ol>
        </article>
        <article className="next-panel">
          <span className="eyebrow">YOUR COMPANY WORKSPACE</span>
          <div className="next-icon" aria-hidden="true">
            ↗
          </div>
          <h2>A workspace of your own.</h2>
          <p>
            Sign in to manage your company’s properties and units, or register a company to get
            started.
          </p>
          <Link className="secondary-button" to="/">
            Open workspace →
          </Link>
        </article>
      </section>
    </AppLayout>
  );
}
