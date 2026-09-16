import { Link } from 'react-router-dom';

export function LoadingState() {
  return (
    <div className="record-state" role="status">
      Loading records…
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="record-state">
      <p className="form-error" role="alert">
        {message}
      </p>
      <button className="secondary-button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="record-state">
      <span className="empty-icon" aria-hidden="true">
        ⌂
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Link className="primary-button" to={action.to}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
export function Pagination({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>
        {total} {total === 1 ? 'record' : 'records'} · Page {page} of {pages}
      </span>
      <div>
        <button className="secondary-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          className="secondary-button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
