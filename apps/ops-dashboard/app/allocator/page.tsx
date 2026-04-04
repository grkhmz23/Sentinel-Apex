import Link from 'next/link';

import { AllocatorActions } from '../../src/components/allocator-actions';
import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../src/lib/format';
import { loadAllocatorPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function toneForPressure(pressure: string): 'good' | 'warn' | 'bad' {
  if (pressure === 'high') {
    return 'bad';
  }

  return pressure === 'elevated' ? 'warn' : 'good';
}

export default async function AllocatorPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/allocator');
  const state = await loadAllocatorPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Allocator view unavailable.'} title="Allocator unavailable" />
      </AppShell>
    );
  }

  const { summary, targets, decisions, rebalanceProposals } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Sentinel</p>
            <h1>Allocator</h1>
          </div>
          <AllocatorActions />
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Latest persisted allocator decision" title="Summary">
            {summary === null ? (
              <EmptyState message="Allocator has not produced a persisted decision yet." title="No allocator summary" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Regime', value: <StatusBadge label={summary.regimeState} tone={toneForPressure(summary.pressureLevel)} /> },
                  { label: 'Pressure', value: <StatusBadge label={summary.pressureLevel} tone={toneForPressure(summary.pressureLevel)} /> },
                  { label: 'Total capital', value: formatUsd(summary.totalCapitalUsd) },
                  { label: 'Reserve-constrained capital', value: formatUsd(summary.reserveConstrainedCapitalUsd) },
                  { label: 'Allocatable capital', value: formatUsd(summary.allocatableCapitalUsd) },
                  { label: 'Carry target', value: `${summary.carryTargetPct.toFixed(2)}%` },
                  { label: 'Treasury target', value: `${summary.treasuryTargetPct.toFixed(2)}%` },
                  { label: 'Evaluated', value: formatDateTime(summary.evaluatedAt) },
                ]}
              />
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Current versus target budget per sleeve" title="Targets">
            {targets.length === 0 ? (
              <EmptyState message="No allocator sleeve targets are available yet." title="No targets" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sleeve</th>
                    <th>Status</th>
                    <th>Current</th>
                    <th>Target</th>
                    <th>Delta</th>
                    <th>Throttle</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((target) => (
                    <tr key={target.sleeveId}>
                      <td>{target.sleeveName}</td>
                      <td><StatusBadge label={target.status} tone={target.status === 'active' ? 'good' : target.status === 'blocked' ? 'bad' : 'warn'} /></td>
                      <td>{formatUsd(target.currentAllocationUsd)} ({target.currentAllocationPct.toFixed(2)}%)</td>
                      <td>{formatUsd(target.targetAllocationUsd)} ({target.targetAllocationPct.toFixed(2)}%)</td>
                      <td>{formatUsd(target.deltaUsd)}</td>
                      <td>{target.throttleState}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Why Sentinel shifted or held sleeve budgets" title="Reasoning">
            {targets.length === 0 ? (
              <EmptyState message="Allocator rationale will appear after the first persisted decision." title="No rationale" />
            ) : (
              <div className="stack">
                {targets.flatMap((target) => target.rationale.map((reason) => (
                  <div className="feedback feedback--warning" key={`${target.sleeveId}:${reason.code}`}>
                    <strong>{target.sleeveName}:</strong> {reason.summary}
                  </div>
                )))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Most recent allocator decisions" title="Decision History">
            {decisions.length === 0 ? (
              <EmptyState message="No allocator decisions are currently persisted." title="No decisions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Decision</th>
                    <th>Pressure</th>
                    <th>Carry Target</th>
                    <th>Treasury Target</th>
                    <th>Recommendations</th>
                    <th>Evaluated</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((decision) => (
                    <tr key={decision.allocatorRunId}>
                      <td>
                        <Link href={`/allocator/decisions/${decision.allocatorRunId}`}>
                          {decision.allocatorRunId}
                        </Link>
                      </td>
                      <td><StatusBadge label={decision.pressureLevel} tone={toneForPressure(decision.pressureLevel)} /></td>
                      <td>{summary?.allocatorRunId === decision.allocatorRunId ? `${summary.carryTargetPct.toFixed(2)}%` : 'Open detail'}</td>
                      <td>{summary?.allocatorRunId === decision.allocatorRunId ? `${summary.treasuryTargetPct.toFixed(2)}%` : 'Open detail'}</td>
                      <td>{String(decision.recommendationCount)}</td>
                      <td>{formatDateTime(decision.evaluatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Operator-approved bridge from allocator decision to sleeve budget action" title="Rebalance Proposals">
            {rebalanceProposals.length === 0 ? (
              <EmptyState message="No rebalance proposals have been generated yet." title="No proposals" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Approval</th>
                    <th>Allocator Run</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rebalanceProposals.map((proposal) => (
                    <tr key={proposal.id}>
                      <td>
                        <Link href={`/allocator/rebalance-proposals/${proposal.id}`}>
                          {proposal.summary}
                        </Link>
                      </td>
                      <td><StatusBadge label={proposal.status} tone={proposal.status === 'completed' ? 'good' : proposal.status === 'failed' || proposal.status === 'rejected' ? 'bad' : 'warn'} /></td>
                      <td>{proposal.executionMode}</td>
                      <td>{proposal.approvalRequirement}</td>
                      <td>{proposal.allocatorRunId}</td>
                      <td>{formatDateTime(proposal.createdAt)}</td>
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
