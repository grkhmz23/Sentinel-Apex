import Link from 'next/link';

import type {
  RuntimeMismatchSourceKind,
  RuntimeMismatchStatus,
} from '@sentinel-apex/runtime';

import { AppShell } from '../../src/components/app-shell';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { ReconciliationActions } from '../../src/components/reconciliation-actions';
import { StatusBadge } from '../../src/components/status-badge';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime } from '../../src/lib/format';
import { listMismatches } from '../../src/lib/runtime-api.server';

import type { MismatchListFilters } from '../../src/lib/types';

export const dynamic = 'force-dynamic';

function readFilters(
  searchParams: Record<string, string | string[] | undefined>,
): MismatchListFilters {
  const status = typeof searchParams['status'] === 'string' ? searchParams['status'] : undefined;
  const severity = typeof searchParams['severity'] === 'string' ? searchParams['severity'] : undefined;
  const sourceKind = typeof searchParams['sourceKind'] === 'string' ? searchParams['sourceKind'] : undefined;
  const category = typeof searchParams['category'] === 'string' ? searchParams['category'] : undefined;

  return {
    ...(status !== undefined ? { status: status as RuntimeMismatchStatus } : {}),
    ...(severity !== undefined ? { severity } : {}),
    ...(sourceKind !== undefined ? { sourceKind: sourceKind as RuntimeMismatchSourceKind } : {}),
    ...(category !== undefined ? { category } : {}),
  };
}

export default async function MismatchesPage(
  { searchParams }: { searchParams: Record<string, string | string[] | undefined> },
): Promise<JSX.Element> {
  const session = await requireDashboardSession('/mismatches');
  const filters = readFilters(searchParams);

  try {
    const mismatches = await listMismatches({ ...filters, limit: 100 });

    return (
      <AppShell session={session}>
        <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Mismatches</p>
            <h1>Integrity Incident Queue</h1>
          </div>
          <ReconciliationActions idleLabel="Run Manual Recon" />
        </header>

        <Panel subtitle="Filter current and historical mismatches" title="Filters">
          <form className="filters" method="get">
            <select className="select" defaultValue={filters.status ?? ''} name="status">
              <option value="">All statuses</option>
              <option value="open">open</option>
              <option value="acknowledged">acknowledged</option>
              <option value="recovering">recovering</option>
              <option value="resolved">resolved</option>
              <option value="verified">verified</option>
              <option value="reopened">reopened</option>
            </select>
            <select className="select" defaultValue={filters.sourceKind ?? ''} name="sourceKind">
              <option value="">All sources</option>
              <option value="workflow">workflow</option>
              <option value="reconciliation">reconciliation</option>
            </select>
            <input className="input" defaultValue={filters.severity ?? ''} name="severity" placeholder="Severity" />
            <input className="input" defaultValue={filters.category ?? ''} name="category" placeholder="Category" />
            <button className="button" type="submit">Apply</button>
          </form>
        </Panel>

        <Panel subtitle="Select a mismatch to inspect detail and act" title="Mismatch Queue">
          {mismatches.length === 0 ? (
            <EmptyState message="No mismatches matched the current filter." title="No results" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th>Last Detected</th>
                </tr>
              </thead>
              <tbody>
                {mismatches.map((mismatch) => (
                  <tr key={mismatch.id}>
                    <td><Link href={`/mismatches/${mismatch.id}`}>{mismatch.summary}</Link></td>
                    <td><StatusBadge label={mismatch.status} tone={mismatch.status === 'verified' ? 'good' : 'warn'} /></td>
                    <td>{mismatch.severity}</td>
                    <td>{mismatch.sourceKind}</td>
                    <td>{mismatch.category}</td>
                    <td>{formatDateTime(mismatch.lastDetectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        </div>
      </AppShell>
    );
  } catch (error) {
    return (
      <AppShell session={session}>
        <ErrorState message={error instanceof Error ? error.message : 'Failed to load mismatches.'} title="Mismatches unavailable" />
      </AppShell>
    );
  }
}
