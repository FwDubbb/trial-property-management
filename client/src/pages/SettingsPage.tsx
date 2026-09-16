import { useAuth } from '../hooks/useAuth';

export function SettingsPage() {
  const { user } = useAuth();
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Workspace settings</h1>
          <p className="intro">Your company and account details.</p>
        </div>
      </section>
      <section className="detail-panel">
        <h2>Account details</h2>
        <dl className="detail-grid">
          <div>
            <dt>Company</dt>
            <dd>{user?.companyName}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user?.role === 'OWNER' ? 'Owner' : 'Manager'}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
