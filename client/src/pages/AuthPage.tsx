import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/http';
import type { AuthUser } from '../types/auth';

export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (register && password !== form.get('confirmPassword')) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const payload = {
        email: String(form.get('email')).trim(),
        password,
        ...(register
          ? {
              name: String(form.get('name')).trim(),
              companyName: String(form.get('companyName')).trim(),
            }
          : {}),
      };
      const result = await api<{ user: AuthUser }>(register ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: payload,
      });
      setUser(result.user);
      navigate('/', { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Link className="brand" to="/login">
          <span className="brand-mark">P.</span>
          <span>
            Property<span className="brand-subtitle">MANAGEMENT PLATFORM</span>
          </span>
        </Link>
        <div>
          <p className="eyebrow">A PLACE FOR EVERY PROPERTY</p>
          <h1>
            Your properties.
            <br />
            Your people.
            <br />
            One workspace.
          </h1>
          <p>
            Keep your company’s rental portfolio organized, with a workspace that belongs to you.
          </p>
        </div>
        <span className="auth-footnote">Built for landlords and property managers.</span>
      </aside>
      <main className="auth-main">
        <div className="auth-form-wrap">
          <p className="eyebrow">{register ? 'START YOUR WORKSPACE' : 'WELCOME BACK'}</p>
          <h1>{register ? 'Make it your own.' : 'Sign in to your workspace.'}</h1>
          <p className="intro">
            {register
              ? 'Create your company and its owner account.'
              : 'Your company’s workspace is waiting for you.'}
          </p>
          <form onSubmit={submit} className="stack-form">
            {register && (
              <>
                <label>
                  Company name
                  <input
                    name="companyName"
                    required
                    maxLength={150}
                    autoComplete="organization"
                    placeholder="Mensah Properties"
                  />
                </label>
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="John Mensah"
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                autoComplete={register ? 'new-password' : 'current-password'}
                aria-describedby={register ? 'password-hint' : undefined}
              />
            </label>
            {register && (
              <>
                <p id="password-hint" className="field-help">
                  Use at least 12 characters. A memorable passphrase works well.
                </p>
                <label>
                  Confirm password
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : register ? 'Create company account' : 'Sign in'}
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to Property?'}{' '}
            <Link to={register ? '/login' : '/register'}>
              {register ? 'Sign in' : 'Create a company'}
            </Link>
          </p>
          <Link className="muted-link" to="/setup">
            Check application connections
          </Link>
        </div>
      </main>
    </div>
  );
}
