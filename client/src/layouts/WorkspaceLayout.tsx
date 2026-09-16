import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function WorkspaceLayout() {
  const { user, logout } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-layout workspace">
      <aside className="sidebar">
        <NavLink className="brand" to="/">
          <span className="brand-mark">
            P<span>.</span>
          </span>
          <span>
            Property<span className="brand-subtitle">MANAGEMENT PLATFORM</span>
          </span>
        </NavLink>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="workspace-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/properties">Properties</NavLink>
          <NavLink to="/units">Units</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/setup">Connection checks</NavLink>
        </nav>
        <div className="workspace-account">
          <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.role === 'OWNER' ? 'Owner' : 'Manager'}</span>
          </div>
        </div>
        <button className="secondary-button" disabled={busy} onClick={() => void signOut()}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </aside>
      <div className="main-column">
        <header className="topbar">
          <strong>{user?.companyName}</strong>
          <span className="environment-tag">
            {user?.role === 'OWNER' ? 'Owner workspace' : 'Manager workspace'}
          </span>
        </header>
        <main id="main">
          <Outlet />
        </main>
        <footer className="page-footer">
          Property Management Platform<span>{user?.companyName}</span>
        </footer>
      </div>
    </div>
  );
}
