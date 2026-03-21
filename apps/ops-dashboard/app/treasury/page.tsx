import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { TreasuryActionTable } from '../../src/components/treasury-action-table';
import { TreasuryActions } from '../../src/components/treasury-actions';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../src/lib/format';
import { loadTreasuryPageData } from '../../src/lib/runtime-api.server';

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

  const { summary, allocations, policy, actions, executions } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Atlas Treasury</p>
            <h1>Treasury Sleeve</h1>
          </div>
          <TreasuryActions />
        </header>

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
                      <td>{allocation.venueName}</td>
                      <td><StatusBadge label={allocation.venueMode} tone={allocation.venueMode === 'simulated' ? 'warn' : 'good'} /></td>
                      <td>{formatUsd(allocation.currentAllocationUsd)}</td>
                      <td>{formatUsd(allocation.withdrawalAvailableUsd)}</td>
                      <td>{allocation.concentrationPct}%</td>
                      <td>{(allocation.aprBps / 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                      <td><StatusBadge label={execution.status} tone={execution.status === 'completed' ? 'good' : execution.status === 'failed' ? 'bad' : 'accent'} /></td>
                      <td>{execution.treasuryActionId}</td>
                      <td>{execution.venueMode === 'live' ? 'live' : 'simulated'}</td>
                      <td>{execution.requestedBy}</td>
                      <td>{execution.outcomeSummary ?? execution.lastError ?? 'Pending'}</td>
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
