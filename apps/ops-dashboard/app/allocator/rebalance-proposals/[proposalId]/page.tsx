import Link from 'next/link';

import type {
  RebalanceCarryActionNodeView,
  RebalanceExecutionTimelineEntry,
  RebalanceExecutionView,
  RebalanceProposalIntentView,
  RebalanceTreasuryActionNodeView,
} from '@sentinel-apex/runtime';

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

  const { bundle } = state.data;
  const { graph } = bundle;
  const { detail } = graph;

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
          <Panel subtitle="Approval, command, execution, and coordinated bundle envelope" title="Proposal">
            <DefinitionList
              items={[
                { label: 'Proposal', value: detail.proposal.id },
                { label: 'Bundle', value: <Link href={`/allocator/rebalance-bundles/${bundle.bundle.id}`}>{bundle.bundle.id}</Link> },
                { label: 'Allocator run', value: <Link href={`/allocator/decisions/${detail.proposal.allocatorRunId}`}>{detail.proposal.allocatorRunId}</Link> },
                { label: 'Status', value: <StatusBadge label={detail.proposal.status} tone={detail.proposal.status === 'completed' ? 'good' : detail.proposal.status === 'failed' || detail.proposal.status === 'rejected' ? 'bad' : 'warn'} /> },
                { label: 'Bundle status', value: <StatusBadge label={bundle.bundle.status} tone={bundle.bundle.status === 'completed' ? 'good' : bundle.bundle.status === 'failed' || bundle.bundle.status === 'blocked' || bundle.bundle.status === 'requires_intervention' ? 'bad' : 'warn'} /> },
                { label: 'Recovery', value: bundle.bundle.interventionRecommendation },
                { label: 'Mode', value: detail.proposal.executionMode },
                { label: 'Approval requirement', value: detail.proposal.approvalRequirement },
                { label: 'Linked command', value: detail.proposal.linkedCommandId ?? 'Not queued' },
                { label: 'Latest execution', value: detail.proposal.latestExecutionId ?? 'Not executed' },
                { label: 'Created', value: formatDateTime(detail.proposal.createdAt) },
                { label: 'Downstream carry', value: `${graph.downstream.carry.rollup.actionCount} actions / ${graph.downstream.carry.rollup.executionCount} executions` },
                { label: 'Downstream treasury', value: graph.downstream.treasury.note ?? graph.downstream.treasury.rollup.summary },
              ]}
            />
            <p className="panel__hint">{detail.proposal.summary}</p>
            <RebalanceProposalActions proposalId={detail.proposal.id} status={detail.proposal.status} />
          </Panel>
        </div>

        <div className="grid grid--metrics">
          <Panel subtitle="Operator coordination rollup derived from downstream child truth" title="Bundle Coordination">
            <DefinitionList
              items={[
                { label: 'Completion state', value: bundle.bundle.completionState },
                { label: 'Outcome', value: bundle.bundle.outcomeClassification },
                { label: 'Children', value: String(bundle.bundle.totalChildCount) },
                { label: 'Completed', value: String(bundle.bundle.completedChildCount) },
                { label: 'Pending / in flight', value: String(bundle.bundle.pendingChildCount) },
                { label: 'Blocked', value: String(bundle.bundle.blockedChildCount) },
                { label: 'Failed', value: String(bundle.bundle.failedChildCount) },
                { label: 'Finalized', value: bundle.bundle.finalizedAt === null ? 'Not finalized' : formatDateTime(bundle.bundle.finalizedAt) },
              ]}
            />
            <p className="panel__hint">
              {bundle.bundle.finalizationReason ?? 'The bundle remains open until all downstream sleeve work reaches a durable terminal state.'}
            </p>
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
                  {detail.intents.map((intent: RebalanceProposalIntentView) => (
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
              {detail.proposal.rationale.map((reason: typeof detail.proposal.rationale[number]) => (
                <p className="feedback feedback--warning" key={reason.code}>{reason.summary}</p>
              ))}
              {detail.proposal.blockedReasons.map((reason: typeof detail.proposal.blockedReasons[number]) => (
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
                    <th>Carry Actions</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.executions.map((execution: RebalanceExecutionView) => (
                    <tr key={execution.id}>
                      <td>{execution.id}</td>
                      <td><StatusBadge label={execution.status} tone={execution.status === 'completed' ? 'good' : execution.status === 'failed' ? 'bad' : 'warn'} /></td>
                      <td>{execution.executionMode}</td>
                      <td>{execution.requestedBy}</td>
                      <td>
                        {Array.isArray(execution.outcome['downstreamCarryActionIds']) && execution.outcome['downstreamCarryActionIds'].length > 0
                          ? (
                            <div className="stack stack--compact">
                              {(execution.outcome['downstreamCarryActionIds'] as string[]).map((actionId: string) => (
                                <div className="stack stack--compact" key={actionId}>
                                  <Link href={`/carry/actions/${actionId}`}>{actionId}</Link>
                                  {graph.downstream.carry.actions.find((node: RebalanceCarryActionNodeView) => node.action.id === actionId)?.executions.length
                                    ? graph.downstream.carry.actions.find((node: RebalanceCarryActionNodeView) => node.action.id === actionId)?.executions.map((carryExecution: RebalanceCarryActionNodeView['executions'][number]) => (
                                      <Link href={`/carry/executions/${carryExecution.id}`} key={carryExecution.id}>
                                        {carryExecution.id}
                                      </Link>
                                    ))
                                    : <span className="panel__hint">Execution pending</span>}
                                </div>
                              ))}
                            </div>
                          )
                          : 'None'}
                      </td>
                      <td>{execution.completedAt === null ? 'In flight' : formatDateTime(execution.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Backend-native carry action and execution drill-through for this proposal" title="Carry Downstream">
            {graph.downstream.carry.actions.length === 0 ? (
              <EmptyState message="No downstream carry actions were persisted for this proposal." title="No carry downstream" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Executions</th>
                    <th>References</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.downstream.carry.actions.map((node: RebalanceCarryActionNodeView) => (
                    <tr key={node.action.id}>
                      <td>
                        <div className="stack stack--compact">
                          <Link href={`/carry/actions/${node.action.id}`}>{node.action.id}</Link>
                          <span className="panel__hint">{node.action.summary}</span>
                        </div>
                      </td>
                      <td><StatusBadge label={node.action.status} tone={node.action.status === 'completed' ? 'good' : node.action.status === 'failed' ? 'bad' : 'warn'} /></td>
                      <td>{node.action.executionMode}{node.action.simulated ? ' / simulated' : ''}</td>
                      <td>
                        {node.executions.length === 0
                          ? 'Pending'
                          : (
                            <div className="stack stack--compact">
                              {node.executions.map((execution) => (
                                <Link href={`/carry/executions/${execution.id}`} key={execution.id}>{execution.id}</Link>
                              ))}
                            </div>
                          )}
                      </td>
                      <td>
                        {node.executions.flatMap((execution) => execution.venueExecutionReference === null ? [] : [execution.venueExecutionReference]).join(', ') || 'None'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Treasury-side participation currently reflected by budget-state application, not proposal-linked treasury actions" title="Treasury Downstream">
            {graph.downstream.treasury.actions.length === 0 ? (
              <EmptyState message={graph.downstream.treasury.note ?? 'No downstream treasury actions were persisted for this proposal.'} title="No treasury downstream" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Executions</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.downstream.treasury.actions.map((node: RebalanceTreasuryActionNodeView) => (
                    <tr key={node.action.id}>
                      <td><Link href={`/treasury/actions/${node.action.id}`}>{node.action.id}</Link></td>
                      <td><StatusBadge label={node.action.status} tone={node.action.status === 'completed' ? 'good' : node.action.status === 'failed' ? 'bad' : 'warn'} /></td>
                      <td>{node.action.executionMode}{node.action.simulated ? ' / simulated' : ''}</td>
                      <td>
                        {node.executions.length === 0
                          ? 'Pending'
                          : (
                            <div className="stack stack--compact">
                              {node.executions.map((execution) => (
                                <Link href={`/treasury/executions/${execution.id}`} key={execution.id}>{execution.id}</Link>
                              ))}
                            </div>
                          )}
                      </td>
                      <td>{node.executions.map((execution) => execution.venueExecutionReference).filter((value: string | null): value is string => value !== null).join(', ') || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Ordered proposal, command, execution, and downstream sleeve workflow" title="Timeline">
            {graph.timeline.length === 0 ? (
              <EmptyState message="No timeline entries were available for this proposal." title="No timeline" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>At</th>
                    <th>Sleeve</th>
                    <th>Scope</th>
                    <th>Status</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.timeline.map((entry: RebalanceExecutionTimelineEntry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.at)}</td>
                      <td>{entry.sleeveId}</td>
                      <td>{entry.scope}</td>
                      <td>{entry.status === null ? 'N/A' : <StatusBadge label={entry.status} tone={entry.status === 'completed' || entry.status === 'approved' ? 'good' : entry.status === 'failed' || entry.status === 'rejected' ? 'bad' : 'warn'} />}</td>
                      <td>{entry.summary}</td>
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
