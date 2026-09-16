import type { ConnectionState } from '../types/api';

interface Props {
  title: string;
  subtitle: string;
  number: string;
  state: ConnectionState;
}

export function ConnectionCard({ title, subtitle, number, state }: Props) {
  const label =
    state.status === 'success'
      ? 'Connected'
      : state.status === 'loading'
        ? 'Checking…'
        : 'Needs attention';
  return (
    <article className="connection-card">
      <div className="card-top">
        <span className="step-number">{number}</span>
        <span className={`badge ${state.status}`}>
          <span className="status-dot" />
          {label}
        </span>
      </div>
      <h3>{title}</h3>
      <p className="card-subtitle">{subtitle}</p>
      <p className="connection-message">
        {state.status === 'loading' ? 'Waiting for a response…' : state.message}
      </p>
    </article>
  );
}
