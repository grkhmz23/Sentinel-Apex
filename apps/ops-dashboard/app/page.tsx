import Link from 'next/link';

import { AppShell } from '../src/components/app-shell';
import { DefinitionList } from '../src/components/definition-list';
import { EmptyState } from '../src/components/empty-state';
import { ErrorState } from '../src/components/error-state';
import { Panel } from '../src/components/panel';
import { QuickActions } from '../src/components/quick-actions';
import { StatusBadge } from '../src/components/status-badge';
import { requireDashboardSession } from '../src/lib/auth.server';
import { formatDateTime, formatUsd, isStaleTimestamp } from '../src/lib/format';
import { loadOverviewPageData } from '../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function OverviewPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/');
  const state = await loadOverviewPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Overview unavailable.'} title="Overview unavailable" />
      </AppShell>
    );
  }

  const { overview, mismatches, commands, recoveryOutcomes, reconciliationRuns, activeFindings } = state.data;
  const staleReconciliation = isStaleTimestamp(
    overview.reconciliationSummary?.latestCompletedRun?.completedAt ?? null,
    overview.worker.cycleIntervalMs * 2,
  );

  return (
    <AppShell session={session}>
      <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Runtime Overview</p>
          <h1>Control Plane Status</h1>
        </div>
        <QuickActions />
      </header>

      <div className="grid grid--metrics">
        <Panel subtitle="Runtime and worker state" title="Status">
          <DefinitionList
            items={[
              { label: 'Runtime lifecycle', value: <StatusBadge label={overview.runtime.lifecycleState} tone={overview.runtime.lifecycleState === 'ready' ? 'good' : 'warn'} /> },
              { label: 'Worker lifecycle', value: <StatusBadge label={overview.worker.lifecycleState} tone={overview.worker.lifecycleState === 'ready' ? 'good' : 'warn'} /> },
              { label: 'Projection freshness', value: <StatusBadge label={overview.runtime.projectionStatus} tone={overview.runtime.projectionStatus === 'fresh' ? 'good' : 'warn'} /> },
              { label: 'Execution mode', value: overview.runtime.executionMode },
              { label: 'Last successful run', value: formatDateTime(overview.runtime.lastCycleCompletedAt) },
              { label: 'Next scheduled run', value: formatDateTime(overview.worker.nextScheduledRunAt) },
            ]}
          />
        </Panel>

        <Panel subtitle="Mismatch and degradation posture" title="Health">
          <DefinitionList
            items={[
              { label: 'Open mismatches', value: String(overview.openMismatchCount) },
              { label: 'Runtime halted', value: overview.runtime.halted ? 'Yes' : 'No' },
              { label: 'Degraded reasons', value: overview.degradedReasons.length === 0 ? 'None' : overview.degradedReasons.join(', ') },
              { label: 'Latest recovery event', value: overview.lastRecoveryEvent?.eventType ?? 'Unavailable' },
              { label: 'Latest reconciliation', value: overview.latestReconciliationRun?.status ?? 'Unavailable' },
              { label: 'Reconciliation freshness', value: staleReconciliation ? <StatusBadge label="stale" tone="warn" /> : <StatusBadge label="current" tone="good" /> },
            ]}
          />
        </Panel>

        <Panel subtitle="Idle capital and reserve posture" title="Treasury">
          {overview.treasurySummary === null ? (
            <EmptyState message="Treasury has not been evaluated yet." title="No treasury data" />
          ) : (
            <DefinitionList
              items={[
                { label: 'Reserve coverage', value: `${overview.treasurySummary.reserveStatus.reserveCoveragePct}%` },
                { label: 'Idle capital', value: formatUsd(overview.treasurySummary.reserveStatus.idleCapitalUsd) },
                { label: 'Allocated capital', value: formatUsd(overview.treasurySummary.reserveStatus.allocatedCapitalUsd) },
                { label: 'Required reserve', value: formatUsd(overview.treasurySummary.reserveStatus.requiredReserveUsd) },
                { label: 'Recommended actions', value: String(overview.treasurySummary.actionCount) },
                { label: 'Evaluated at', value: formatDateTime(overview.treasurySummary.evaluatedAt) },
              ]}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid--two-column">
        <Panel subtitle="Newest runtime integrity incidents" title="Recent Mismatches">
          {mismatches.length === 0 ? (
            <EmptyState message="No mismatches are currently recorded." title="No mismatches" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {mismatches.map((mismatch) => (
                  <tr key={mismatch.id}>
                    <td><Link href={`/mismatches/${mismatch.id}`}>{mismatch.summary}</Link></td>
                    <td><StatusBadge label={mismatch.status} tone={mismatch.status === 'verified' ? 'good' : 'warn'} /></td>
                    <td>{mismatch.sourceKind}</td>
                    <td>{formatDateTime(mismatch.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel subtitle="Most recent queued and completed actions" title="Recent Commands">
          {commands.length === 0 ? (
            <EmptyState message="No runtime commands have been recorded." title="No commands" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  <th>Requested At</th>
                </tr>
              </thead>
              <tbody>
                {commands.map((command) => (
                  <tr key={command.commandId}>
                    <td>{command.commandType}</td>
                    <td><StatusBadge label={command.status} tone={command.status === 'completed' ? 'good' : command.status === 'failed' ? 'bad' : 'accent'} /></td>
                    <td>{command.requestedBy}</td>
                    <td>{formatDateTime(command.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="grid grid--two-column">
        <Panel subtitle="Recent reconciliation activity" title="Reconciliation">
          {reconciliationRuns.length === 0 ? (
            <EmptyState message="No reconciliation runs have been recorded." title="No reconciliation runs" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Findings</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.trigger}</td>
                    <td><StatusBadge label={run.status} tone={run.status === 'completed' ? 'good' : run.status === 'failed' ? 'bad' : 'accent'} /></td>
                    <td>{String(run.findingCount)}</td>
                    <td>{formatDateTime(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeFindings.length > 0 ? (
            <p className="panel__hint">Active findings: {activeFindings.length}</p>
          ) : null}
        </Panel>

        <Panel subtitle="Latest recovery outcomes" title="Recovery">
          {recoveryOutcomes.length === 0 ? (
            <EmptyState message="No recovery outcomes have been recorded." title="No recovery outcomes" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {recoveryOutcomes.map((event) => (
                  <tr key={event.id}>
                    <td>{event.eventType}</td>
                    <td><StatusBadge label={event.status} tone={event.status === 'failed' ? 'bad' : 'neutral'} /></td>
                    <td>{event.sourceComponent}</td>
                    <td>{formatDateTime(event.occurredAt)}</td>
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
