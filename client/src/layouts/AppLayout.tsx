import type { ReactNode } from 'react';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-mark" aria-hidden="true">
            P<span>.</span>
          </span>
          <span>
            Property<span className="brand-subtitle">MANAGEMENT PLATFORM</span>
          </span>
        </a>
        <div className="workspace-label">LOCAL WORKSPACE</div>
        <a className="nav-active" href="#main">
          <span aria-hidden="true">▦</span> Project overview <span className="nav-dot" />
        </a>
        <div className="sidebar-note">
          <span className="note-eyebrow">A solid foundation</span>
          <p>Your property management workspace starts here.</p>
          <span className="phase-label">PHASE 01 / 08</span>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Development environment
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb-divider">/</span>{' '}
            <strong>Project overview</strong>
          </span>
          <span className="environment-tag">Local development</span>
        </header>
        <main id="main">{children}</main>
        <footer className="page-footer">
          Property Management Platform <span>Built one phase at a time.</span>
        </footer>
      </div>
    </div>
  );
}
