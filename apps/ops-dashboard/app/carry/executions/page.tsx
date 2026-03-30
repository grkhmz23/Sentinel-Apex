import Link from 'next/link';

import { AppShell } from '../../../src/components/app-shell';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { Panel } from '../../../src/components/panel';
import { StatusBadge } from '../../../src/components/status-badge';
import { requireDashboardSession } from '../../../src/lib/auth.server';
import { carryModeTone, carryStatusTone } from '../../../src/lib/carry-display';
import { formatDateTime } from '../../../src/lib/format';
import { loadCarryExecutionsPageData } from '../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function CarryExecutionsPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/carry/executions');
  const state = await loadCarryExecutionsPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Carry executions unavailable.'} title="Carry executions unavailable" />
      </AppShell>
    );
  }

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Apex Carry</p>
            <h1>Carry Executions</h1>
          </div>
        </header>

        <div className="grid">
          <Panel subtitle="Direct execution drill-through with action linkage and execution mode visibility" title="Execution Attempts">
            {state.data.executions.length === 0 ? (
              <EmptyState message="No carry execution attempts are currently persisted." title="No executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Action</th>
                    <th>Requested By</th>
                    <th>Started</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.executions.map((execution) => (
                    <tr key={execution.id}>
                      <td><Link href={`/carry/executions/${execution.id}`}>{execution.id}</Link></td>
                      <td><StatusBadge label={execution.status} tone={carryStatusTone(execution.status)} /></td>
                      <td><StatusBadge label={execution.executionMode} tone={carryModeTone(execution.executionMode)} />{execution.simulated ? ' simulated' : ''}</td>
                      <td><Link href={`/carry/actions/${execution.carryActionId}`}>{execution.carryActionId}</Link></td>
                      <td>{execution.requestedBy}</td>
                      <td>{formatDateTime(execution.startedAt)}</td>
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
