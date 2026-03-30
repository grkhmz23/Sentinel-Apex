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
import { formatDateTime } from '../../../../src/lib/format';
import { loadTreasuryExecutionDetailPageData } from '../../../../src/lib/runtime-api.server';
import { treasuryModeTone, treasuryStatusTone } from '../../../../src/lib/treasury-display';

export const dynamic = 'force-dynamic';

export default async function TreasuryExecutionDetailPage(
  { params }: { params: { executionId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/treasury/executions/${params.executionId}`);
  const state = await loadTreasuryExecutionDetailPageData(params.executionId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Treasury execution detail unavailable.'} title="Execution detail unavailable" />
      </AppShell>
    );
  }

  const { detail } = state.data;
  const { execution } = detail;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Treasury Execution Detail</p>
            <h1>{execution.outcomeSummary ?? execution.lastError ?? execution.id}</h1>
            <p className="panel__hint">{execution.id}</p>
          </div>
          <div className="button-row">
            <StatusBadge label={execution.status} tone={treasuryStatusTone(execution.status)} />
            <StatusBadge label={execution.venueMode} tone={treasuryModeTone(execution.venueMode)} />
          </div>
        </header>

        <div className="inline-links">
          <Link href="/treasury">Back to treasury</Link>
          <Link href="/treasury/executions">Execution history</Link>
          {detail.action !== null ? <Link href={`/treasury/actions/${detail.action.id}`}>Action detail</Link> : null}
          {detail.linkedRebalanceProposal !== null ? (
            <Link href={`/allocator/rebalance-proposals/${detail.linkedRebalanceProposal.id}`}>Parent rebalance proposal</Link>
          ) : null}
          {detail.venue !== null ? <Link href={`/treasury/venues/${detail.venue.venueId}`}>Venue detail</Link> : null}
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Requested, started, completed, and linked command metadata" title="Overview">
            <DefinitionList
              items={[
                { label: 'Requested by', value: execution.requestedBy },
                { label: 'Started by', value: execution.startedBy ?? 'Unavailable' },
                { label: 'Execution kind', value: detail.executionKind },
                { label: 'Execution mode', value: execution.executionMode },
                { label: 'Command', value: detail.command?.commandId ?? execution.commandId ?? 'Unavailable' },
                { label: 'Action', value: detail.action?.id ?? execution.treasuryActionId },
                { label: 'Parent rebalance', value: detail.linkedRebalanceProposal === null ? 'None' : <Link href={`/allocator/rebalance-proposals/${detail.linkedRebalanceProposal.id}`}>{detail.linkedRebalanceProposal.id}</Link> },
                { label: 'Venue reference', value: execution.venueExecutionReference ?? 'Unavailable' },
                { label: 'Requested at', value: formatDateTime(execution.createdAt) },
                { label: 'Started at', value: formatDateTime(execution.startedAt) },
                { label: 'Completed at', value: formatDateTime(execution.completedAt) },
              ]}
            />
          </Panel>

          <Panel subtitle="Structured blocked reasons and execution failures" title="Outcome Controls">
            <TreasuryBlockedReasons reasons={execution.blockedReasons} />
            {execution.lastError !== null ? <p className="feedback feedback--error">{execution.lastError}</p> : null}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Linked treasury action lifecycle around this execution" title="Timeline">
            <TreasuryTimeline entries={detail.timeline} />
          </Panel>

          <Panel subtitle="Persisted outcome payload and connector metadata" title="Outcome Payload">
            <JsonBlock value={execution.outcome} />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Current venue capability state used for operator interpretation" title="Venue">
            {detail.venue === null ? (
              <EmptyState message="No venue snapshot is linked to this execution." title="No venue data" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Venue', value: detail.venue.venueName },
                  { label: 'Mode', value: <StatusBadge label={detail.venue.venueMode} tone={treasuryModeTone(detail.venue.venueMode)} /> },
                  { label: 'Readiness', value: detail.venue.readinessLabel },
                  { label: 'Execution supported', value: detail.venue.executionSupported ? 'Yes' : 'No' },
                  { label: 'Approved for live', value: detail.venue.approvedForLiveUse ? 'Yes' : 'No' },
                  { label: 'Last snapshot', value: formatDateTime(detail.venue.lastSnapshotAt) },
                ]}
              />
            )}
          </Panel>

          <Panel subtitle="Linked command result as persisted in runtime control-plane history" title="Command Result">
            {detail.command === null ? (
              <EmptyState message="No command payload is linked to this execution." title="No command data" />
            ) : (
              <JsonBlock value={detail.command.result} />
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
