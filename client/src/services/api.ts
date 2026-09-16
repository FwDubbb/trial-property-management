import type { DatabaseResponse, TestResponse } from '../types/api';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function get<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot reach the API. Check that the backend is running, then try again.');
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.error?.message || 'The API is unavailable. Check the backend and proxy settings.',
    );
  }
  if (!body || body.status !== 'ok') {
    throw new Error('Unexpected API response. Check the API URL and proxy settings.');
  }
  return body as T;
}

export const getTest = () => get<TestResponse>('/test');
export const getDatabaseHealth = () => get<DatabaseResponse>('/health/database');
