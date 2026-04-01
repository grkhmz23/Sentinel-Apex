import Link from 'next/link';

import type {
  RebalanceCarryActionNodeView,
  RebalanceExecutionTimelineEntry,
  RebalanceTreasuryActionNodeView,
} from '@sentinel-apex/runtime';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { Panel } from '../../../../src/components/panel';
import { RebalanceBundleEscalationActions } from '../../../../src/components/rebalance-bundle-escalation-actions';
import { RebalanceBundleRecoveryActions } from '../../../../src/components/rebalance-bundle-recovery-actions';
import { RebalanceBundleResolutionActions } from '../../../../src/components/rebalance-bundle-resolution-actions';
import { StatusBadge } from '../../../../src/components/status-badge';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { formatDateTime } from '../../../../src/lib/format';
import { loadRebalanceBundlePageData } from '../../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function RebalanceBundlePage(
  { params }: { params: { bundleId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/allocator/rebalance-bundles/${params.bundleId}`);
  const state = await loadRebalanceBundlePageData(params.bundleId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Rebalance bundle unavailable.'} title="Rebalance bundle unavailable" />
      </AppShell>
    );
  }

  const { bundle } = state.data;
  const { graph } = bundle;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Sentinel</p>
            <h1>Rebalance Bundle Detail</h1>
            <p className="panel__hint"><Link href="/allocator/escalations">Back to escalations queue</Link></p>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Coordinated proposal-level execution status and recovery guidance" title="Bundle">
            <DefinitionList
              items={[
                { label: 'Bundle', value: bundle.bundle.id },
                { label: 'Proposal', value: <Link href={`/allocator/rebalance-proposals/${bundle.bundle.proposalId}`}>{bundle.bundle.proposalId}</Link> },
                { label: 'Allocator run', value: <Link href={`/allocator/decisions/${bundle.bundle.allocatorRunId}`}>{bundle.bundle.allocatorRunId}</Link> },
                { label: 'Bundle status', value: <StatusBadge label={bundle.bundle.status} tone={bundle.bundle.status === 'completed' ? 'good' : bundle.bundle.status === 'failed' || bundle.bundle.status === 'blocked' || bundle.bundle.status === 'requires_intervention' ? 'bad' : 'warn'} /> },
                { label: 'Proposal status', value: <StatusBadge label={bundle.bundle.proposalStatus} tone={bundle.bundle.proposalStatus === 'completed' ? 'good' : bundle.bundle.proposalStatus === 'failed' || bundle.bundle.proposalStatus === 'rejected' ? 'bad' : 'warn'} /> },
                { label: 'Outcome', value: bundle.bundle.outcomeClassification },
                { label: 'Recommendation', value: bundle.bundle.interventionRecommendation },
                { label: 'Completion state', value: bundle.bundle.completionState },
                { label: 'Finalized', value: bundle.bundle.finalizedAt === null ? 'Not finalized' : formatDateTime(bundle.bundle.finalizedAt) },
                { label: 'Resolution state', value: bundle.bundle.resolutionState },
                { label: 'Resolved at', value: bundle.bundle.resolvedAt === null ? 'Not resolved' : formatDateTime(bundle.bundle.resolvedAt) },
                { label: 'Escalation status', value: bundle.bundle.escalationStatus ?? 'No escalation workflow' },
                { label: 'Escalation owner', value: bundle.bundle.escalationOwnerId ?? 'Unassigned' },
              ]}
            />
            <p className="panel__hint">
              {bundle.bundle.resolutionSummary ?? bundle.bundle.finalizationReason ?? 'This bundle remains open until downstream sleeve work reaches a terminal coordinated state.'}
            </p>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Rollup of downstream sleeve actions and execution outcomes" title="Child Rollup">
            <DefinitionList
              items={[
                { label: 'Total children', value: String(bundle.bundle.totalChildCount) },
                { label: 'Completed', value: String(bundle.bundle.completedChildCount) },
                { label: 'Pending / in flight', value: String(bundle.bundle.pendingChildCount) },
                { label: 'Blocked', value: String(bundle.bundle.blockedChildCount) },
                { label: 'Failed', value: String(bundle.bundle.failedChildCount) },
              ]}
            />
          </Panel>

          <Panel subtitle="Rebalance command and proposal context" title="Execution Envelope">
            <DefinitionList
              items={[
                { label: 'Mode', value: bundle.bundle.executionMode },
                { label: 'Simulated', value: bundle.bundle.simulated ? 'Yes' : 'No' },
                { label: 'Linked command', value: graph.detail.proposal.linkedCommandId ?? 'Not queued' },
                { label: 'Latest execution', value: graph.detail.proposal.latestExecutionId ?? 'Not executed' },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Inspect-first summary of applied, retryable, and non-retryable child state" title="Partial Progress">
            <DefinitionList
              items={[
                { label: 'Applied children', value: String(bundle.partialProgress.appliedChildren) },
                { label: 'Progress recorded', value: String(bundle.partialProgress.progressRecordedChildren) },
                { label: 'Retryable children', value: String(bundle.partialProgress.retryableChildren) },
                { label: 'Non-retryable children', value: String(bundle.partialProgress.nonRetryableChildren) },
                { label: 'Blocked before application', value: String(bundle.partialProgress.blockedBeforeApplicationChildren) },
                { label: 'In flight', value: String(bundle.partialProgress.inflightChildren) },
              ]}
            />
            <table className="table">
              <thead>
                <tr>
                  <th>Child</th>
                  <th>Progress</th>
                  <th>Retryability</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {bundle.partialProgress.children.map((child) => (
                  <tr key={`${child.childType}:${child.childId}`}>
                    <td>{child.childType} / {child.childId}</td>
                    <td>{child.progressState}</td>
                    <td>{child.retryability}</td>
                    <td>{child.evidence[0] ?? 'No external or budget-state progress recorded.'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel subtitle="Backend-computed recovery eligibility for proposal-linked child rails only" title="Recovery Candidates">
            {bundle.recoveryCandidates.length === 0 ? (
              <EmptyState message="No recovery candidates were computed for this bundle." title="No recovery candidates" />
            ) : (
              <RebalanceBundleRecoveryActions
                bundleId={bundle.bundle.id}
                candidates={bundle.recoveryCandidates}
              />
            )}
          </Panel>

          <Panel subtitle="Durable operator-triggered recovery attempts linked back to this bundle" title="Recovery History">
            {bundle.recoveryActions.length === 0 ? (
              <EmptyState message="No bundle recovery actions have been requested yet." title="No recovery history" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Command</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.recoveryActions.map((action) => (
                    <tr key={action.id}>
                      <td>{formatDateTime(action.requestedAt)}</td>
                      <td>{action.targetChildType} / {action.targetChildId}</td>
                      <td><StatusBadge label={action.status} tone={action.status === 'completed' ? 'good' : action.status === 'failed' || action.status === 'blocked' ? 'bad' : 'warn'} /></td>
                      <td>{action.linkedCommandId ?? 'No command'}</td>
                      <td>{action.outcomeSummary ?? action.lastError ?? 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Ownership and follow-up state for escalated bundles" title="Escalation Ownership">
            {bundle.escalation === null ? (
              <EmptyState message="No escalation workflow record exists for this bundle." title="No escalation" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Status', value: bundle.escalation.status },
                  { label: 'Owner', value: bundle.escalation.ownerId ?? 'Unassigned' },
                  { label: 'Assigned by', value: bundle.escalation.assignedBy ?? 'Not assigned' },
                  { label: 'Assigned at', value: bundle.escalation.assignedAt === null ? 'Not assigned' : formatDateTime(bundle.escalation.assignedAt) },
                  { label: 'Acknowledged at', value: bundle.escalation.acknowledgedAt === null ? 'Not acknowledged' : formatDateTime(bundle.escalation.acknowledgedAt) },
                  { label: 'Due at', value: bundle.escalation.dueAt === null ? 'No follow-up target' : formatDateTime(bundle.escalation.dueAt) },
                  { label: 'Closed at', value: bundle.escalation.closedAt === null ? 'Still open' : formatDateTime(bundle.escalation.closedAt) },
                ]}
              />
            )}
            <p className="panel__hint">
              {bundle.escalation?.handoffNote
                ?? bundle.escalation?.reviewNote
                ?? bundle.escalation?.resolutionNote
                ?? 'Escalation workflow remains a process overlay and does not change bundle execution truth.'}
            </p>
          </Panel>

          <Panel subtitle="Explicit handoff, acknowledgement, review, and close actions" title="Escalation Workflow">
            {bundle.escalationTransitions.length === 0 ? (
              <EmptyState message="No escalation transitions were computed for this bundle." title="No escalation actions" />
            ) : (
              <RebalanceBundleEscalationActions
                bundleId={bundle.bundle.id}
                escalation={bundle.escalation}
                transitions={bundle.escalationTransitions}
              />
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Explicit operator closure paths for partial or non-retryable bundle outcomes" title="Resolution Options">
            {bundle.resolutionOptions.length === 0 ? (
              <EmptyState message="No manual resolution options were computed for this bundle." title="No resolution options" />
            ) : (
              <RebalanceBundleResolutionActions
                bundleId={bundle.bundle.id}
                options={bundle.resolutionOptions}
                history={bundle.resolutionActions}
              />
            )}
          </Panel>

          <Panel subtitle="Durable escalation handoff and review history" title="Escalation History">
            {bundle.escalationHistory.length === 0 ? (
              <EmptyState message="No escalation workflow events have been recorded yet." title="No escalation history" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>At</th>
                    <th>Event</th>
                    <th>Actor</th>
                    <th>Owner</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.escalationHistory.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDateTime(event.createdAt)}</td>
                      <td>{event.eventType} / {event.toStatus}</td>
                      <td>{event.actorId}</td>
                      <td>{event.ownerId ?? 'Unassigned'}</td>
                      <td>{event.note ?? 'No note'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Durable operator manual closure and escalation history" title="Resolution History">
            {bundle.resolutionActions.length === 0 ? (
              <EmptyState message="No manual bundle resolution actions have been recorded yet." title="No resolution history" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Resolution</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.resolutionActions.map((action) => (
                    <tr key={action.id}>
                      <td>{formatDateTime(action.requestedAt)}</td>
                      <td>{action.resolutionActionType}</td>
                      <td><StatusBadge label={action.status} tone={action.status === 'completed' ? 'good' : action.status === 'blocked' ? 'bad' : 'warn'} /></td>
                      <td>{action.resolutionState}</td>
                      <td>{action.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Coordinated carry child actions and executions" title="Carry Children">
            {graph.downstream.carry.actions.length === 0 ? (
              <EmptyState message="No carry child actions were recorded for this bundle." title="No carry children" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Executions</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.downstream.carry.actions.map((node: RebalanceCarryActionNodeView) => (
                    <tr key={node.action.id}>
                      <td><Link href={`/carry/actions/${node.action.id}`}>{node.action.id}</Link></td>
                      <td><StatusBadge label={node.action.status} tone={node.action.status === 'completed' ? 'good' : node.action.status === 'failed' ? 'bad' : 'warn'} /></td>
                      <td>
                        {node.executions.length === 0
                          ? 'Pending'
                          : node.executions.map((execution) => (
                            <div key={execution.id}>
                              <Link href={`/carry/executions/${execution.id}`}>{execution.id}</Link>
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Coordinated treasury child actions and executions" title="Treasury Children">
            {graph.downstream.treasury.actions.length === 0 ? (
              <EmptyState message={graph.downstream.treasury.note ?? 'No treasury child actions were recorded for this bundle.'} title="No treasury children" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Executions</th>
                  </tr>
                </thead>
                <tbody>
                  {graph.downstream.treasury.actions.map((node: RebalanceTreasuryActionNodeView) => (
                    <tr key={node.action.id}>
                      <td><Link href={`/treasury/actions/${node.action.id}`}>{node.action.id}</Link></td>
                      <td><StatusBadge label={node.action.status} tone={node.action.status === 'completed' ? 'good' : node.action.status === 'failed' ? 'bad' : 'warn'} /></td>
                      <td>
                        {node.executions.length === 0
                          ? 'Pending'
                          : node.executions.map((execution) => (
                            <div key={execution.id}>
                              <Link href={`/treasury/executions/${execution.id}`}>{execution.id}</Link>
                            </div>
                          ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Ordered proposal, command, bundle, and downstream sleeve events" title="Timeline">
            {graph.timeline.length === 0 ? (
              <EmptyState message="No timeline entries were available for this bundle." title="No timeline" />
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
