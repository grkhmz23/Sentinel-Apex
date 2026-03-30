import Link from 'next/link';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { JsonBlock } from '../../../../src/components/json-block';
import { Panel } from '../../../../src/components/panel';
import { StatusBadge } from '../../../../src/components/status-badge';
import { TreasuryBlockedReasons } from '../../../../src/components/treasury-blocked-reasons';
import { TreasuryTimeline } from '../../../../src/components/treasury-timeline';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../../../src/lib/format';
import { loadTreasuryActionDetailPageData } from '../../../../src/lib/runtime-api.server';
import { treasuryModeTone, treasuryReadinessTone, treasuryStatusTone } from '../../../../src/lib/treasury-display';

export const dynamic = 'force-dynamic';

export default async function TreasuryActionDetailPage(
  { params }: { params: { actionId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/treasury/actions/${params.actionId}`);
  const state = await loadTreasuryActionDetailPageData(params.actionId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Treasury action detail unavailable.'} title="Action detail unavailable" />
      </AppShell>
    );
  }

  const { detail } = state.data;
  const { action } = detail;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Treasury Action Detail</p>
            <h1>{action.summary}</h1>
            <p className="panel__hint">{action.id}</p>
          </div>
          <div className="button-row">
            <StatusBadge label={action.status} tone={treasuryStatusTone(action.status)} />
            <StatusBadge label={action.readiness} tone={treasuryReadinessTone(action.readiness)} />
          </div>
        </header>

        <div className="inline-links">
          <Link href="/treasury">Back to treasury</Link>
          <Link href="/treasury/executions">Execution history</Link>
          {detail.linkedRebalanceProposal !== null ? (
            <Link href={`/allocator/rebalance-proposals/${detail.linkedRebalanceProposal.id}`}>Parent rebalance proposal</Link>
          ) : null}
          {action.venueId !== null ? <Link href={`/treasury/venues/${action.venueId}`}>Venue detail</Link> : null}
          {action.latestExecutionId !== null ? <Link href={`/treasury/executions/${action.latestExecutionId}`}>Latest execution</Link> : null}
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Lifecycle, command linkage, and approval posture" title="Overview">
            <DefinitionList
              items={[
                { label: 'Action type', value: action.actionType },
                { label: 'Reason code', value: action.reasonCode },
                { label: 'Parent rebalance', value: detail.linkedRebalanceProposal === null ? 'None' : <Link href={`/allocator/rebalance-proposals/${detail.linkedRebalanceProposal.id}`}>{detail.linkedRebalanceProposal.id}</Link> },
                { label: 'Amount', value: formatUsd(action.amountUsd) },
                { label: 'Venue', value: action.venueName ?? action.venueId ?? 'Reserve' },
                { label: 'Venue mode', value: <StatusBadge label={action.venueMode} tone={treasuryModeTone(action.venueMode)} /> },
                { label: 'Execution mode', value: action.executionMode },
                { label: 'Approval requirement', value: action.approvalRequirement },
                { label: 'Approved by', value: action.approvedBy ?? 'Pending' },
                { label: 'Approved at', value: formatDateTime(action.approvedAt) },
                { label: 'Execution requested by', value: action.executionRequestedBy ?? 'Not requested' },
                { label: 'Execution requested at', value: formatDateTime(action.executionRequestedAt) },
              ]}
            />
          </Panel>

          <Panel subtitle="Policy/risk rule failures with operator guidance" title="Blocked Reasons">
            <TreasuryBlockedReasons reasons={action.blockedReasons} />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Durable event sequence for recommendation, approval, and execution" title="Timeline">
            <TreasuryTimeline entries={detail.timeline} />
          </Panel>

          <Panel subtitle="Latest linked command, venue capability state, and summary context" title="Context">
            <DefinitionList
              items={[
                { label: 'Actor', value: action.actorId },
                { label: 'Linked command', value: detail.latestCommand?.commandId ?? action.linkedCommandId ?? 'Unavailable' },
                { label: 'Latest execution', value: action.latestExecutionId ?? 'Unavailable' },
                { label: 'Venue readiness', value: detail.venue?.readinessLabel ?? 'Unavailable' },
                { label: 'Venue healthy', value: detail.venue?.healthy ? 'Yes' : detail.venue === null ? 'Unavailable' : 'No' },
                { label: 'Current reserve', value: detail.summary === null ? 'Unavailable' : formatUsd(detail.summary.reserveStatus.currentReserveUsd) },
                { label: 'Required reserve', value: detail.summary === null ? 'Unavailable' : formatUsd(detail.summary.reserveStatus.requiredReserveUsd) },
                { label: 'Max venue allocation', value: detail.policy === null ? 'Unavailable' : `${detail.policy.policy.maxAllocationPctPerVenue}%` },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Persisted execution attempts for this treasury action" title="Executions">
            {detail.executions.length === 0 ? (
              <EmptyState message="No executions have been recorded for this action." title="No executions" />
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
                      <td><Link href={`/treasury/executions/${execution.id}`}>{execution.id}</Link></td>
                      <td><StatusBadge label={execution.status} tone={treasuryStatusTone(execution.status)} /></td>
                      <td><StatusBadge label={execution.venueMode} tone={treasuryModeTone(execution.venueMode)} /></td>
                      <td>{execution.requestedBy}</td>
                      <td>{formatDateTime(execution.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Persisted action payload and planner effects" title="Payload">
            <JsonBlock value={{
              details: action.details,
              blockedReasons: action.blockedReasons,
            }} />
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
