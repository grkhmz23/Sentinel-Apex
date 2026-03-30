import Link from 'next/link';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { Panel } from '../../../../src/components/panel';
import { RebalanceProposalActions } from '../../../../src/components/rebalance-proposal-actions';
import { StatusBadge } from '../../../../src/components/status-badge';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../../../src/lib/format';
import { loadRebalanceProposalPageData } from '../../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function RebalanceProposalPage(
  { params }: { params: { proposalId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/allocator/rebalance-proposals/${params.proposalId}`);
  const state = await loadRebalanceProposalPageData(params.proposalId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Rebalance proposal unavailable.'} title="Rebalance proposal unavailable" />
      </AppShell>
    );
  }

  const { detail } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Sentinel</p>
            <h1>Rebalance Proposal Detail</h1>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Approval, command, and execution envelope" title="Proposal">
            <DefinitionList
              items={[
                { label: 'Proposal', value: detail.proposal.id },
                { label: 'Allocator run', value: <Link href={`/allocator/decisions/${detail.proposal.allocatorRunId}`}>{detail.proposal.allocatorRunId}</Link> },
                { label: 'Status', value: <StatusBadge label={detail.proposal.status} tone={detail.proposal.status === 'completed' ? 'good' : detail.proposal.status === 'failed' || detail.proposal.status === 'rejected' ? 'bad' : 'warn'} /> },
                { label: 'Mode', value: detail.proposal.executionMode },
                { label: 'Approval requirement', value: detail.proposal.approvalRequirement },
                { label: 'Linked command', value: detail.proposal.linkedCommandId ?? 'Not queued' },
                { label: 'Latest execution', value: detail.proposal.latestExecutionId ?? 'Not executed' },
                { label: 'Created', value: formatDateTime(detail.proposal.createdAt) },
              ]}
            />
            <p className="panel__hint">{detail.proposal.summary}</p>
            <RebalanceProposalActions proposalId={detail.proposal.id} status={detail.proposal.status} />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Per-sleeve deltas and downstream action meaning" title="Sleeve Intents">
            {detail.intents.length === 0 ? (
              <EmptyState message="No sleeve intents were persisted for this proposal." title="No intents" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Sleeve</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Current</th>
                    <th>Target</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.intents.map((intent) => (
                    <tr key={intent.id}>
                      <td>{intent.sleeveId}</td>
                      <td>{intent.actionType}</td>
                      <td><StatusBadge label={intent.readiness} tone={intent.readiness === 'actionable' ? 'good' : 'bad'} /></td>
                      <td>{formatUsd(intent.currentAllocationUsd)} ({intent.currentAllocationPct.toFixed(2)}%)</td>
                      <td>{formatUsd(intent.targetAllocationUsd)} ({intent.targetAllocationPct.toFixed(2)}%)</td>
                      <td>{formatUsd(intent.deltaUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Why approval is allowed or blocked" title="Rationale">
            <div className="stack">
              {detail.proposal.rationale.map((reason) => (
                <p className="feedback feedback--warning" key={reason.code}>{reason.summary}</p>
              ))}
              {detail.proposal.blockedReasons.map((reason) => (
                <p className="feedback feedback--error" key={reason.code}>{reason.message}</p>
              ))}
              {detail.proposal.rationale.length === 0 && detail.proposal.blockedReasons.length === 0 ? (
                <EmptyState message="No rationale or blocked reasons were persisted for this proposal." title="No rationale" />
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Latest applied operator-approved budget state" title="Current State">
            {detail.currentState === null ? (
              <EmptyState message="No rebalance proposal has been applied to the current sleeve budget state yet." title="No applied state" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Latest proposal', value: detail.currentState.latestProposalId ?? 'Unavailable' },
                  { label: 'Carry target', value: `${formatUsd(detail.currentState.carryTargetAllocationUsd)} (${detail.currentState.carryTargetAllocationPct.toFixed(2)}%)` },
                  { label: 'Treasury target', value: `${formatUsd(detail.currentState.treasuryTargetAllocationUsd)} (${detail.currentState.treasuryTargetAllocationPct.toFixed(2)}%)` },
                  { label: 'Applied', value: formatDateTime(detail.currentState.appliedAt) },
                ]}
              />
            )}
          </Panel>

          <Panel subtitle="Execution outcomes linked to the proposal command rail" title="Executions">
            {detail.executions.length === 0 ? (
              <EmptyState message="This proposal has not produced a rebalance execution record yet." title="No executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Requested By</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.executions.map((execution) => (
                    <tr key={execution.id}>
                      <td>{execution.id}</td>
                      <td><StatusBadge label={execution.status} tone={execution.status === 'completed' ? 'good' : execution.status === 'failed' ? 'bad' : 'warn'} /></td>
                      <td>{execution.executionMode}</td>
                      <td>{execution.requestedBy}</td>
                      <td>{execution.completedAt === null ? 'In flight' : formatDateTime(execution.completedAt)}</td>
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
