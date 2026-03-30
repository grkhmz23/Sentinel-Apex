import Link from 'next/link';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { Panel } from '../../../../src/components/panel';
import { StatusBadge } from '../../../../src/components/status-badge';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../../../src/lib/format';
import { loadAllocatorDecisionPageData } from '../../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function toneForPressure(pressure: string): 'good' | 'warn' | 'bad' {
  if (pressure === 'high') {
    return 'bad';
  }

  return pressure === 'elevated' ? 'warn' : 'good';
}

export default async function AllocatorDecisionPage(
  { params }: { params: { allocatorRunId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/allocator/decisions/${params.allocatorRunId}`);
  const state = await loadAllocatorDecisionPageData(params.allocatorRunId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Allocator decision unavailable.'} title="Allocator decision unavailable" />
      </AppShell>
    );
  }

  const { detail, rebalanceProposals } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Sentinel</p>
            <h1>Allocator Decision Detail</h1>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Decision envelope" title="Summary">
            <DefinitionList
              items={[
                { label: 'Run', value: detail.run.allocatorRunId },
                { label: 'Regime', value: <StatusBadge label={detail.run.regimeState} tone={toneForPressure(detail.run.pressureLevel)} /> },
                { label: 'Pressure', value: <StatusBadge label={detail.run.pressureLevel} tone={toneForPressure(detail.run.pressureLevel)} /> },
                { label: 'Total capital', value: formatUsd(detail.run.totalCapitalUsd) },
                { label: 'Reserve-constrained capital', value: formatUsd(detail.run.reserveConstrainedCapitalUsd) },
                { label: 'Allocatable capital', value: formatUsd(detail.run.allocatableCapitalUsd) },
                { label: 'Evaluated', value: formatDateTime(detail.run.evaluatedAt) },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Per-sleeve budget targets" title="Targets">
            {detail.targets.length === 0 ? (
              <EmptyState message="No sleeve targets were persisted for this decision." title="No targets" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sleeve</th>
                    <th>Status</th>
                    <th>Current</th>
                    <th>Target</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.targets.map((target) => (
                    <tr key={target.sleeveId}>
                      <td>{target.sleeveName}</td>
                      <td><StatusBadge label={target.status} tone={target.status === 'active' ? 'good' : 'warn'} /></td>
                      <td>{formatUsd(target.currentAllocationUsd)} ({target.currentAllocationPct.toFixed(2)}%)</td>
                      <td>{formatUsd(target.targetAllocationUsd)} ({target.targetAllocationPct.toFixed(2)}%)</td>
                      <td>{formatUsd(target.deltaUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Structured allocator rationale and constraints" title="Reasoning">
            <div className="stack">
              {detail.rationale.map((reason) => (
                <p className="feedback feedback--warning" key={reason.code}>{reason.summary}</p>
              ))}
              {detail.constraints.map((constraint) => (
                <p className="feedback feedback--success" key={constraint.code}>
                  {constraint.binding ? 'Binding:' : 'Informational:'} {constraint.summary}
                </p>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Persisted rebalance and budget recommendations" title="Recommendations">
            {detail.recommendations.length === 0 ? (
              <EmptyState message="No allocator recommendations were persisted for this decision." title="No recommendations" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Sleeve</th>
                    <th>Recommendation</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recommendations.map((recommendation) => (
                    <tr key={recommendation.id}>
                      <td><StatusBadge label={recommendation.priority} tone={recommendation.priority === 'high' ? 'bad' : recommendation.priority === 'medium' ? 'warn' : 'good'} /></td>
                      <td>{recommendation.sleeveId}</td>
                      <td>{recommendation.summary}</td>
                      <td>{formatDateTime(recommendation.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Explicit operator workflow derived from this allocator decision" title="Rebalance Proposals">
            {rebalanceProposals.length === 0 ? (
              <EmptyState message="This allocator decision has not emitted any rebalance proposal." title="No proposals" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Proposal</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Command</th>
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
                      <td>{proposal.linkedCommandId ?? 'Not queued'}</td>
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
