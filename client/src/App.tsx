import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { WorkspaceLayout } from './layouts/WorkspaceLayout';
import { AuthPage } from './pages/AuthPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyFormPage } from './pages/PropertyFormPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { UnitsPage } from './pages/UnitsPage';
import { UnitFormPage } from './pages/UnitFormPage';
import { UnitDetailPage } from './pages/UnitDetailPage';

function SessionGate() {
  const { loading, error, reload } = useAuth();
  if (loading)
    return (
      <main className="center-state" role="status">
        Loading your workspace…
      </main>
    );
  if (error)
    return (
      <main className="center-state">
        <h1>Unable to load your workspace</h1>
        <p role="alert">{error}</p>
        <button className="primary-button" onClick={() => void reload()}>
          Try again
        </button>
        <Link to="/setup">Connection checks</Link>
      </main>
    );
  return <Outlet />;
}
function ProtectedRoute() {
  const { user } = useAuth();
  return user ? <WorkspaceLayout /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route element={<SessionGate />}>
            <Route path="/login" element={<AuthPage key="login" />} />
            <Route path="/register" element={<AuthPage key="register" register />} />
            <Route element={<ProtectedRoute />}>
              <Route index element={<OverviewPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/properties" element={<PropertiesPage />} />
              <Route path="/properties/new" element={<PropertyFormPage key="new-property" />} />
              <Route path="/properties/:id" element={<PropertyDetailPage />} />
              <Route
                path="/properties/:id/edit"
                element={<PropertyFormPage key="edit-property" />}
              />
              <Route path="/units" element={<UnitsPage />} />
              <Route path="/units/new" element={<UnitFormPage key="new-unit" />} />
              <Route path="/units/:id" element={<UnitDetailPage />} />
              <Route path="/units/:id/edit" element={<UnitFormPage key="edit-unit" />} />
            </Route>
            <Route
              path="*"
              element={
                <main className="center-state">
                  <h1>Page not found</h1>
                  <Link to="/">Return to your workspace</Link>
                </main>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
