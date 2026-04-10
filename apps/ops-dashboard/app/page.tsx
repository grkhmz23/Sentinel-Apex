import Link from 'next/link';

import { AppShell } from '../src/components/app-shell';
import { EmptyState } from '../src/components/empty-state';
import { ErrorState } from '../src/components/error-state';
import { MetricCard } from '../src/components/metric-card';
import { Panel } from '../src/components/panel';
import { QuickActions } from '../src/components/quick-actions';
import { SignalList } from '../src/components/signal-list';
import { StatusBadge } from '../src/components/status-badge';
import { TableSurface } from '../src/components/table-surface';
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
        <header className="page__header page__header--hero">
          <div className="page__header-copy">
            <p className="eyebrow">Runtime Overview</p>
            <h1>Control Plane Status</h1>
            <p className="page__summary">
              Operator-facing view of runtime posture, reconciliation freshness, treasury readiness,
              and the latest incidents affecting deployment confidence.
            </p>
            <div className="page__header-meta">
              <StatusBadge
                label={overview.runtime.lifecycleState}
                tone={overview.runtime.lifecycleState === 'ready' ? 'good' : 'warn'}
              />
              <StatusBadge
                label={staleReconciliation ? 'reconciliation stale' : 'reconciliation current'}
                tone={staleReconciliation ? 'warn' : 'good'}
              />
              <StatusBadge
                label={overview.runtime.projectionStatus}
                tone={overview.runtime.projectionStatus === 'fresh' ? 'good' : 'warn'}
              />
            </div>
          </div>
          <QuickActions />
        </header>

        <div className="metric-grid">
          <MetricCard
            detail={`Last successful run ${formatDateTime(overview.runtime.lastCycleCompletedAt)}`}
            label="Runtime lifecycle"
            tone={overview.runtime.lifecycleState === 'ready' ? 'good' : 'warn'}
            value={<StatusBadge label={overview.runtime.lifecycleState} tone={overview.runtime.lifecycleState === 'ready' ? 'good' : 'warn'} />}
          />
          <MetricCard
            detail={`Next scheduled run ${formatDateTime(overview.worker.nextScheduledRunAt)}`}
            label="Worker lifecycle"
            tone={overview.worker.lifecycleState === 'ready' ? 'good' : 'warn'}
            value={<StatusBadge label={overview.worker.lifecycleState} tone={overview.worker.lifecycleState === 'ready' ? 'good' : 'warn'} />}
          />
          <MetricCard
            detail={`Execution mode ${overview.runtime.executionMode}`}
            label="Open mismatches"
            tone={overview.openMismatchCount > 0 ? 'warn' : 'good'}
            value={String(overview.openMismatchCount)}
          />
          <MetricCard
            detail={overview.treasurySummary === null
              ? 'Treasury has not been evaluated yet.'
              : `Required reserve ${formatUsd(overview.treasurySummary.reserveStatus.requiredReserveUsd)}`}
            label="Reserve coverage"
            tone={overview.treasurySummary !== null && Number(overview.treasurySummary.reserveStatus.reserveCoveragePct) < 100 ? 'warn' : 'accent'}
            value={overview.treasurySummary === null ? 'Unavailable' : `${overview.treasurySummary.reserveStatus.reserveCoveragePct}%`}
          />
        </div>

      <div className="grid grid--two-column">
        <Panel subtitle="Live operating state for the vault runtime, worker, and projection layer" title="Status">
          <div className="overview-stack">
            <SignalList
              items={[
                {
                  id: 'projection',
                  label: 'Projection freshness',
                  value: <StatusBadge label={overview.runtime.projectionStatus} tone={overview.runtime.projectionStatus === 'fresh' ? 'good' : 'warn'} />,
                  detail: `Execution mode ${overview.runtime.executionMode}`,
                },
                {
                  id: 'reconciliation',
                  label: 'Reconciliation cadence',
                  value: staleReconciliation ? 'Stale after the latest cycle window.' : 'Current against the expected cycle interval.',
                  detail: `Latest completed run ${formatDateTime(overview.reconciliationSummary?.latestCompletedRun?.completedAt ?? null)}`,
                },
                {
                  id: 'recovery',
                  label: 'Latest recovery event',
                  value: overview.lastRecoveryEvent?.eventType ?? 'Unavailable',
                  detail: overview.lastRecoveryEvent?.status ?? 'No recovery status recorded',
                },
              ]}
            />
          </div>
        </Panel>

        <Panel subtitle="Integrity posture, degradation signals, and reconciliation freshness" title="Health">
          <SignalList
            items={[
              {
                id: 'halt',
                label: 'Runtime halted',
                value: overview.runtime.halted ? 'Yes' : 'No',
                detail: overview.latestReconciliationRun?.status ?? 'Latest reconciliation unavailable',
              },
              {
                id: 'degraded',
                label: 'Degraded reasons',
                value: overview.degradedReasons.length === 0 ? 'None' : overview.degradedReasons.join(', '),
                detail: `Latest recovery event ${overview.lastRecoveryEvent?.eventType ?? 'Unavailable'}`,
              },
              {
                id: 'freshness',
                label: 'Reconciliation freshness',
                value: staleReconciliation
                  ? <StatusBadge label="stale" tone="warn" />
                  : <StatusBadge label="current" tone="good" />,
                detail: `Latest reconciliation ${overview.latestReconciliationRun?.status ?? 'Unavailable'}`,
              },
            ]}
          />
        </Panel>
      </div>

      <div className="grid">
        <Panel subtitle="Reserve coverage and idle-capital posture for controlled deployment" title="Treasury">
          {overview.treasurySummary === null ? (
            <EmptyState message="Treasury has not been evaluated yet." title="No treasury data" />
          ) : (
            <div className="metric-grid metric-grid--compact">
              <MetricCard
                detail={`Evaluated ${formatDateTime(overview.treasurySummary.evaluatedAt)}`}
                label="Idle capital"
                tone="accent"
                value={formatUsd(overview.treasurySummary.reserveStatus.idleCapitalUsd)}
              />
              <MetricCard
                detail={`Required reserve ${formatUsd(overview.treasurySummary.reserveStatus.requiredReserveUsd)}`}
                label="Allocated capital"
                tone="good"
                value={formatUsd(overview.treasurySummary.reserveStatus.allocatedCapitalUsd)}
              />
              <MetricCard
                detail={`${overview.treasurySummary.actionCount} recommended actions`}
                label="Reserve shortfall"
                tone={Number(overview.treasurySummary.reserveStatus.reserveShortfallUsd) > 0 ? 'warn' : 'good'}
                value={formatUsd(overview.treasurySummary.reserveStatus.reserveShortfallUsd)}
              />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid--two-column">
        <Panel subtitle="Newest integrity incidents that can block or constrain deployment" title="Recent Mismatches">
          {mismatches.length === 0 ? (
            <EmptyState message="No mismatches are currently recorded." title="No mismatches" />
          ) : (
            <div className="event-feed">
              {mismatches.map((mismatch) => (
                <article className="event-feed__item" key={mismatch.id}>
                  <div className="event-feed__row">
                    <div>
                      <p className="event-feed__title">
                        <Link href={`/mismatches/${mismatch.id}`}>{mismatch.summary}</Link>
                      </p>
                      <p className="event-feed__detail">Updated {formatDateTime(mismatch.updatedAt)}</p>
                    </div>
                    <StatusBadge label={mismatch.status} tone={mismatch.status === 'verified' ? 'good' : 'warn'} />
                  </div>
                  <div className="pill-row">
                    <span className="pill">{mismatch.sourceKind}</span>
                    <span className="pill">{mismatch.id}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel subtitle="Most recent operator and runtime actions moving the protocol forward" title="Recent Commands">
          {commands.length === 0 ? (
            <EmptyState message="No runtime commands have been recorded." title="No commands" />
          ) : (
            <div className="event-feed">
              {commands.map((command) => (
                <article className="event-feed__item" key={command.commandId}>
                  <div className="event-feed__row">
                    <div>
                      <p className="event-feed__title">{command.commandType}</p>
                      <p className="event-feed__detail">
                        Requested by {command.requestedBy} at {formatDateTime(command.requestedAt)}
                      </p>
                    </div>
                    <StatusBadge
                      label={command.status}
                      tone={command.status === 'completed' ? 'good' : command.status === 'failed' ? 'bad' : 'accent'}
                    />
                  </div>
                  <div className="pill-row">
                    <span className="pill">{command.commandId}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid--two-column">
        <Panel subtitle="Recent state-verification runs across runtime, execution, and portfolio truth" title="Reconciliation">
          {reconciliationRuns.length === 0 ? (
            <EmptyState message="No reconciliation runs have been recorded." title="No reconciliation runs" />
          ) : (
            <TableSurface caption="Recent reconciliation runs">
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
            </TableSurface>
          )}
          {activeFindings.length > 0 ? (
            <p className="panel__hint">Active findings: {activeFindings.length}</p>
          ) : null}
        </Panel>

        <Panel subtitle="Latest recovery outcomes from fail-closed operating workflows" title="Recovery">
          {recoveryOutcomes.length === 0 ? (
            <EmptyState message="No recovery outcomes have been recorded." title="No recovery outcomes" />
          ) : (
            <TableSurface caption="Latest recovery outcomes">
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
            </TableSurface>
          )}
        </Panel>
      </div>
      </div>
    </AppShell>
  );
}
