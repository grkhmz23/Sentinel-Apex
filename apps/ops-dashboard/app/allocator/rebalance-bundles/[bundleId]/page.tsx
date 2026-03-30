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
              ]}
            />
            <p className="panel__hint">
              {bundle.bundle.finalizationReason ?? 'This bundle remains open until downstream sleeve work reaches a terminal coordinated state.'}
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
