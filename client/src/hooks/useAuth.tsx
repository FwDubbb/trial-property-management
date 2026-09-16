import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '../services/http';
import type { AuthUser } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const setUser = useCallback((next: AuthUser | null) => {
    generation.current++;
    updateUser(next);
    setLoading(false);
    setError('');
  }, []);
  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await api<{ user: AuthUser }>('/auth/me');
      if (current === generation.current) updateUser(result.user);
    } catch (error) {
      if (current !== generation.current) return;
      updateUser(null);
      if (!(error instanceof ApiError && error.status === 401))
        setError(error instanceof Error ? error.message : 'Could not load your account.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const expired = () => setUser(null);
    window.addEventListener('session-expired', expired);
    return () => {
      generation.current++;
      window.removeEventListener('session-expired', expired);
    };
  }, [reload, setUser]);
  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, loading, error, reload, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
