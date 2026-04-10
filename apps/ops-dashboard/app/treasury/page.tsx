import Link from 'next/link';

import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { MetricCard } from '../../src/components/metric-card';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { TableSurface } from '../../src/components/table-surface';
import { TreasuryActionTable } from '../../src/components/treasury-action-table';
import { TreasuryActions } from '../../src/components/treasury-actions';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../src/lib/format';
import { loadTreasuryPageData } from '../../src/lib/runtime-api.server';
import { formatOnboardingState, treasuryModeTone, treasuryOnboardingTone, treasuryStatusTone } from '../../src/lib/treasury-display';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/treasury');
  const state = await loadTreasuryPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Treasury view unavailable.'} title="Treasury unavailable" />
      </AppShell>
    );
  }

  const { summary, allocations, policy, actions, executions, venues } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header page__header--hero">
          <div className="page__header-copy">
            <p className="eyebrow">Atlas Treasury</p>
            <h1>Treasury Sleeve</h1>
            <p className="page__summary">
              Reserve management surface for venue allocation posture, policy boundaries,
              action approval flow, and execution readiness across treasury connectors.
            </p>
            <div className="page__header-meta">
              {summary !== null ? (
                <StatusBadge
                  label={summary.simulated ? 'simulated' : 'live'}
                  tone={summary.simulated ? 'warn' : 'good'}
                />
              ) : null}
              {policy !== null ? (
                <StatusBadge
                  label={`${policy.policy.reserveFloorPct}% reserve floor`}
                  tone="accent"
                />
              ) : null}
            </div>
          </div>
          <div className="stack stack--compact stack--align-end">
            <TreasuryActions />
            <div className="inline-links">
              <Link href="/treasury/executions">Execution history</Link>
              <Link href="/treasury/venues">Venue readiness</Link>
            </div>
          </div>
        </header>

        {summary !== null ? (
          <div className="metric-grid">
            <MetricCard
              detail={`Allocated capital ${formatUsd(summary.reserveStatus.allocatedCapitalUsd)}`}
              label="Total capital"
              tone="accent"
              value={formatUsd(summary.reserveStatus.totalCapitalUsd)}
            />
            <MetricCard
              detail={`Required reserve ${formatUsd(summary.reserveStatus.requiredReserveUsd)}`}
              label="Idle capital"
              tone="good"
              value={formatUsd(summary.reserveStatus.idleCapitalUsd)}
            />
            <MetricCard
              detail={`Surplus capital ${formatUsd(summary.reserveStatus.surplusCapitalUsd)}`}
              label="Reserve shortfall"
              tone={Number(summary.reserveStatus.reserveShortfallUsd) > 0 ? 'warn' : 'good'}
              value={formatUsd(summary.reserveStatus.reserveShortfallUsd)}
            />
            <MetricCard
              detail={`${summary.actionCount} recommended actions`}
              label="Reserve coverage"
              tone={Number(summary.reserveStatus.reserveCoveragePct) < 100 ? 'warn' : 'accent'}
              value={`${summary.reserveStatus.reserveCoveragePct}%`}
            />
          </div>
        ) : null}

        <div className="grid grid--metrics">
          <Panel subtitle="Reserve and capital posture" title="Summary">
            {summary === null ? (
              <EmptyState message="Treasury has not produced a persisted evaluation yet." title="No treasury summary" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Evaluation mode', value: <StatusBadge label={summary.simulated ? 'simulated' : 'live'} tone={summary.simulated ? 'warn' : 'good'} /> },
                  { label: 'Total capital', value: formatUsd(summary.reserveStatus.totalCapitalUsd) },
                  { label: 'Idle capital', value: formatUsd(summary.reserveStatus.idleCapitalUsd) },
                  { label: 'Allocated capital', value: formatUsd(summary.reserveStatus.allocatedCapitalUsd) },
                  { label: 'Required reserve', value: formatUsd(summary.reserveStatus.requiredReserveUsd) },
                  { label: 'Reserve shortfall', value: formatUsd(summary.reserveStatus.reserveShortfallUsd) },
                  { label: 'Surplus capital', value: formatUsd(summary.reserveStatus.surplusCapitalUsd) },
                  { label: 'Reserve coverage', value: `${summary.reserveStatus.reserveCoveragePct}%` },
                ]}
              />
            )}
          </Panel>

          <Panel subtitle="Latest policy snapshot" title="Policy">
            {policy === null ? (
              <EmptyState message="No treasury policy has been persisted yet." title="No policy snapshot" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Reserve floor', value: `${policy.policy.reserveFloorPct}%` },
                  { label: 'Minimum reserve', value: formatUsd(policy.policy.minReserveUsd) },
                  { label: 'Minimum idle cash', value: formatUsd(policy.policy.minimumRemainingIdleUsd) },
                  { label: 'Max venue allocation', value: `${policy.policy.maxAllocationPctPerVenue}%` },
                  { label: 'Minimum deployable', value: formatUsd(policy.policy.minimumDeployableUsd) },
                  { label: 'Eligible venues', value: policy.policy.eligibleVenues.join(', ') },
                  { label: 'Updated', value: formatDateTime(policy.updatedAt) },
                ]}
              />
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Latest venue allocation state" title="Allocations">
            {allocations.length === 0 ? (
              <EmptyState message="No treasury allocations are available yet." title="No allocations" />
            ) : (
              <TableSurface caption="Latest venue allocation state">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Mode</th>
                      <th>Allocation</th>
                      <th>Withdrawal Available</th>
                      <th>Concentration</th>
                      <th>APR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((allocation) => (
                      <tr key={allocation.venueId}>
                        <td><Link href={`/treasury/venues/${allocation.venueId}`}>{allocation.venueName}</Link></td>
                        <td><StatusBadge label={allocation.venueMode} tone={treasuryModeTone(allocation.venueMode)} /></td>
                        <td>{formatUsd(allocation.currentAllocationUsd)}</td>
                        <td>{formatUsd(allocation.withdrawalAvailableUsd)}</td>
                        <td>{allocation.concentrationPct}%</td>
                        <td>{(allocation.aprBps / 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSurface>
            )}
          </Panel>

          <Panel subtitle="Latest recommendations and reserve alerts" title="Actions">
            {summary !== null && summary.alerts.length > 0 ? (
              <div className="stack">
                {summary.alerts.map((alert: string) => (
                  <p className="feedback feedback--warning" key={alert}>{alert}</p>
                ))}
              </div>
            ) : null}
            {actions.length === 0 ? (
              <EmptyState message="No treasury recommendations are currently persisted." title="No actions" />
            ) : (
              <TreasuryActionTable actions={actions} />
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Most recent treasury execution attempts" title="Execution History">
            {executions.length === 0 ? (
              <EmptyState message="No treasury execution attempts are currently persisted." title="No executions" />
            ) : (
              <TableSurface caption="Most recent treasury execution attempts">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Action</th>
                      <th>Mode</th>
                      <th>Requested By</th>
                      <th>Outcome</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((execution) => (
                      <tr key={execution.id}>
                        <td><StatusBadge label={execution.status} tone={treasuryStatusTone(execution.status)} /></td>
                        <td><Link href={`/treasury/actions/${execution.treasuryActionId}`}>{execution.treasuryActionId}</Link></td>
                        <td><StatusBadge label={execution.venueMode} tone={treasuryModeTone(execution.venueMode)} /></td>
                        <td>{execution.requestedBy}</td>
                        <td>
                          <div className="stack stack--compact">
                            <Link href={`/treasury/executions/${execution.id}`}>{execution.outcomeSummary ?? execution.lastError ?? 'Pending'}</Link>
                            <span className="panel__hint">{execution.id}</span>
                          </div>
                        </td>
                        <td>{formatDateTime(execution.completedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSurface>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Simulation boundaries and live onboarding posture" title="Venue Readiness">
            {venues.length === 0 ? (
              <EmptyState message="No venue capability snapshots are persisted yet." title="No venues" />
            ) : (
              <TableSurface caption="Simulation boundaries and live onboarding posture">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th>Mode</th>
                      <th>Onboarding</th>
                      <th>Execution</th>
                      <th>Live Approval</th>
                      <th>Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venues.map((venue) => (
                      <tr key={venue.venueId}>
                        <td>
                          <div className="stack stack--compact">
                            <Link href={`/treasury/venues/${venue.venueId}`}>{venue.venueName}</Link>
                            <span className="panel__hint">{venue.readinessLabel}</span>
                          </div>
                        </td>
                        <td><StatusBadge label={venue.simulationState} tone={treasuryModeTone(venue.venueMode)} /></td>
                        <td><StatusBadge label={formatOnboardingState(venue.onboardingState)} tone={treasuryOnboardingTone(venue.onboardingState)} /></td>
                        <td>{venue.executionSupported ? 'Supported' : 'Read-only'}</td>
                        <td>{venue.approvedForLiveUse ? 'Approved' : 'Not approved'}</td>
                        <td>{formatDateTime(venue.lastSnapshotAt)}</td>
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
