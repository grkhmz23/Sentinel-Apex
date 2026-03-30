import Link from 'next/link';

import { AppShell } from '../../../src/components/app-shell';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { Panel } from '../../../src/components/panel';
import { StatusBadge } from '../../../src/components/status-badge';
import { requireDashboardSession } from '../../../src/lib/auth.server';
import { formatDateTime } from '../../../src/lib/format';
import { loadTreasuryExecutionsPageData } from '../../../src/lib/runtime-api.server';
import { treasuryModeTone, treasuryStatusTone } from '../../../src/lib/treasury-display';

export const dynamic = 'force-dynamic';

export default async function TreasuryExecutionsPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/treasury/executions');
  const state = await loadTreasuryExecutionsPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Treasury executions unavailable.'} title="Treasury executions unavailable" />
      </AppShell>
    );
  }

  const { executions } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Atlas Treasury</p>
            <h1>Treasury Execution History</h1>
          </div>
          <div className="inline-links">
            <Link href="/treasury">Back to treasury</Link>
          </div>
        </header>

        <div className="grid">
          <Panel subtitle="Direct treasury execution drill-through with mode and reference visibility" title="Executions">
            {executions.length === 0 ? (
              <EmptyState message="No treasury executions have been recorded yet." title="No executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Action</th>
                    <th>Mode</th>
                    <th>Requested By</th>
                    <th>Reference</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution.id}>
                      <td>
                        <div className="stack stack--compact">
                          <Link href={`/treasury/executions/${execution.id}`}>{execution.id}</Link>
                          <span className="panel__hint">{execution.outcomeSummary ?? execution.lastError ?? 'Pending'}</span>
                        </div>
                      </td>
                      <td><StatusBadge label={execution.status} tone={treasuryStatusTone(execution.status)} /></td>
                      <td><Link href={`/treasury/actions/${execution.treasuryActionId}`}>{execution.treasuryActionId}</Link></td>
                      <td><StatusBadge label={execution.venueMode} tone={treasuryModeTone(execution.venueMode)} /></td>
                      <td>{execution.requestedBy}</td>
                      <td>{execution.venueExecutionReference ?? 'Budget-state only'}</td>
                      <td>{formatDateTime(execution.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
