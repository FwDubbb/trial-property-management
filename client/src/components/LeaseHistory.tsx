import { useState } from 'react';
import { useApiQuery } from '../hooks/useApiQuery';
import type { Page } from '../types/portfolio';
import type { Lease } from '../types/tenancy';
import { EmptyState, ErrorState, LoadingState, Pagination } from './RecordStates';
import { LeasesTable } from './LeasesTable';

export function LeaseHistory({ tenantId, unitId }: { tenantId?: string; unitId?: string }) {
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page) });
  if (tenantId) query.set('tenantId', tenantId);
  if (unitId) query.set('unitId', unitId);
  const result = useApiQuery<Page<Lease>>(`/leases?${query}`);
  return (
    <section className="list-panel">
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : result.data?.items.length ? (
        <>
          <LeasesTable leases={result.data.items} />
          <Pagination {...result.data} onPage={setPage} />
        </>
      ) : (
        <EmptyState
          title="No leases yet"
          description="Create a lease to connect a tenant to a rental unit."
        />
      )}
    </section>
  );
}
