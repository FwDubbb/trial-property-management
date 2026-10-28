import { Link } from 'react-router-dom';
import { MaintenanceList } from '../components/MaintenanceList';
export function MaintenancePage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">REPAIRS & UPKEEP</p>
          <h1>Maintenance</h1>
          <p className="intro">
            Track issues, assign a person, and follow each repair through completion.
          </p>
        </div>
        <Link className="primary-button" to="/maintenance/new">
          + Add request
        </Link>
      </section>
      <MaintenanceList filters />
      <p className="section-footnote">
        Open requests appear first, ordered by urgency and then submission date. Completed and
        cancelled requests remain in the history.
      </p>
    </>
  );
}
