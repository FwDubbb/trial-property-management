import { useCallback, useEffect, useRef, useState } from 'react';
import { getDatabaseHealth, getTest } from '../services/api';
import type { ConnectionState } from '../types/api';

export function useConnectionChecks() {
  const [api, setApi] = useState<ConnectionState>({ status: 'loading' });
  const [database, setDatabase] = useState<ConnectionState>({ status: 'loading' });
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const generation = useRef(0);

  const check = useCallback(async () => {
    const current = ++generation.current;
    setApi({ status: 'loading' });
    setDatabase({ status: 'loading' });
    setCheckedAt(null);

    async function run(request: () => Promise<string>, update: (state: ConnectionState) => void) {
      try {
        const message = await request();
        if (current === generation.current) update({ status: 'success', message });
      } catch (error) {
        if (current === generation.current) {
          update({
            status: 'error',
            message: error instanceof Error ? error.message : 'Connection check failed.',
          });
        }
      }
    }

    await Promise.all([
      run(async () => (await getTest()).message, setApi),
      run(async () => {
        await getDatabaseHealth();
        return 'A live PostgreSQL query completed successfully.';
      }, setDatabase),
    ]);
    if (current === generation.current) setCheckedAt(new Date());
  }, []);

  useEffect(() => {
    void check();
    // Ignore stale responses after unmount or React Strict Mode's effect cleanup.
    return () => {
      generation.current += 1;
    };
  }, [check]);

  return {
    api,
    database,
    checkedAt,
    check,
    checking: api.status === 'loading' || database.status === 'loading',
  };
}
