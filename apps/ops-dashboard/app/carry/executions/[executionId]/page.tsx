import Link from 'next/link';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { Panel } from '../../../../src/components/panel';
import { StatusBadge } from '../../../../src/components/status-badge';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { carryModeTone, carryOnboardingTone, carryStatusTone, formatCarryOnboardingState } from '../../../../src/lib/carry-display';
import { formatDateTime } from '../../../../src/lib/format';
import { loadCarryExecutionDetailPageData } from '../../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function formatMarketIdentityLabel(
  identity: {
    marketSymbol: string | null;
    marketKey: string | null;
    normalizedKey: string | null;
  } | null,
): string {
  if (identity === null) {
    return 'Unsupported';
  }

  return identity.marketSymbol ?? identity.marketKey ?? identity.normalizedKey ?? 'Unsupported';
}

function formatMarketIdentityDetail(
  identity: {
    provenance: string;
    confidence: string;
    capturedAtStage: string;
    source: string;
  } | null,
): string {
  if (identity === null) {
    return 'No persisted market identity.';
  }

  return `${identity.provenance} / ${identity.confidence} via ${identity.capturedAtStage} (${identity.source})`;
}

function formatExecutionModes(value: unknown): string {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value.join(', ')
    : 'Not recorded';
}

function formatStepExecutionMode(
  outcome: Record<string, unknown> | null | undefined,
  simulated: boolean,
): string {
  const mode = outcome?.['executionMode'];
  if (mode === 'real' || mode === 'simulated') {
    return mode;
  }

  return simulated ? 'simulated' : 'Not recorded';
}

function toneForPostTradeConfirmation(
  status: string | null | undefined,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'confirmed_full') {
    return 'good';
  }
  if (
    status === 'confirmed_partial'
    || status === 'confirmed_partial_event_only'
    || status === 'confirmed_partial_position_only'
    || status === 'pending_event'
    || status === 'pending_position_delta'
  ) {
    return 'warn';
  }
  if (
    status === 'missing_reference'
    || status === 'invalid_position_delta'
    || status === 'insufficient_context'
    || status === 'conflicting_event'
    || status === 'conflicting_event_vs_position'
  ) {
    return 'bad';
  }
  return 'neutral';
}

function toneForEventCorrelation(
  status: string | null | undefined,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'event_matched_strong') {
    return 'good';
  }
  if (status === 'event_matched_probable') {
    return 'warn';
  }
  if (status === 'conflicting_event') {
    return 'bad';
  }
  return 'neutral';
}

export default async function CarryExecutionDetailPage(
  { params }: { params: { executionId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/carry/executions/${params.executionId}`);
  const state = await loadCarryExecutionDetailPageData(params.executionId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Carry execution unavailable.'} title="Carry execution unavailable" />
      </AppShell>
    );
  }

  const { detail } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Apex Carry</p>
            <h1>Carry Execution Detail</h1>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Top-level execution outcome, mode, command, and source linkage" title="Execution">
            <DefinitionList
              items={[
                { label: 'Execution', value: detail.execution.id },
                {
                  label: 'Action',
                  value: detail.action === null
                    ? detail.execution.carryActionId
                    : <Link href={`/carry/actions/${detail.action.id}`}>{detail.action.id}</Link>,
                },
                { label: 'Status', value: <StatusBadge label={detail.execution.status} tone={carryStatusTone(detail.execution.status)} /> },
                { label: 'Mode', value: <StatusBadge label={detail.execution.executionMode} tone={carryModeTone(detail.execution.executionMode)} /> },
                { label: 'Simulation', value: detail.execution.simulated ? 'Simulated' : 'Real connector path' },
                { label: 'Execution modes', value: formatExecutionModes(detail.execution.outcome['executionModes']) },
                {
                  label: 'Post-trade truth',
                  value: detail.steps.every((step) => step.postTradeConfirmation === null)
                    ? 'Not recorded'
                    : detail.steps
                      .map((step) => step.postTradeConfirmation?.status ?? 'not_recorded')
                      .join(', '),
                },
                { label: 'Requested by', value: detail.execution.requestedBy },
                { label: 'Started by', value: detail.execution.startedBy ?? 'Unavailable' },
                { label: 'Command', value: detail.command?.commandId ?? 'No linked command' },
                {
                  label: 'Rebalance proposal',
                  value: detail.linkedRebalanceProposal === null
                    ? 'Standalone carry action'
                    : <Link href={`/allocator/rebalance-proposals/${detail.linkedRebalanceProposal.id}`}>{detail.linkedRebalanceProposal.id}</Link>,
                },
                { label: 'Execution reference', value: detail.execution.venueExecutionReference ?? 'No aggregate reference' },
                { label: 'Completed', value: formatDateTime(detail.execution.completedAt) },
              ]}
            />
            <p className="panel__hint">{detail.execution.outcomeSummary ?? detail.execution.lastError ?? 'Execution attempt recorded without a summary.'}</p>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Structured failure and policy gating captured on the execution record" title="Blocked or Failed Reasons">
            {detail.execution.blockedReasons.length === 0 && detail.execution.lastError === null ? (
              <EmptyState message="No blocked or failed reasons were persisted for this execution." title="No blocking detail" />
            ) : (
              <div className="stack">
                {detail.execution.blockedReasons.map((reason) => (
                  <p className="feedback feedback--warning" key={`${reason.category}:${reason.code}`}>
                    <strong>{reason.code}:</strong> {reason.message} Operator action: {reason.operatorAction}
                  </p>
                ))}
                {detail.execution.lastError === null ? null : (
                  <p className="feedback feedback--error">{detail.execution.lastError}</p>
                )}
              </div>
            )}
          </Panel>

          <Panel subtitle="Venue capability snapshots captured for the venues touched by this execution" title="Venue Context">
            {detail.venueSnapshots.length === 0 ? (
              <EmptyState message="No matching venue snapshots were available for this execution." title="No venue snapshots" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Mode</th>
                    <th>Onboarding</th>
                    <th>Execution</th>
                    <th>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.venueSnapshots.map((venue) => (
                    <tr key={venue.venueId}>
                      <td>{venue.venueId}</td>
                      <td><StatusBadge label={venue.venueMode} tone={carryModeTone(venue.venueMode)} /></td>
                      <td><StatusBadge label={formatCarryOnboardingState(venue.onboardingState)} tone={carryOnboardingTone(venue.onboardingState)} /></td>
                      <td>{venue.executionSupported ? 'Supported' : 'Unsupported'}</td>
                      <td>{venue.missingPrerequisites.join(', ') || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Order-like execution steps persisted for operator drill-through" title="Execution Steps">
            {detail.steps.length === 0 ? (
              <EmptyState message="This execution did not persist any downstream execution steps." title="No steps" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Intent</th>
                    <th>Venue</th>
                    <th>Market</th>
                    <th>Identity</th>
                    <th>Status</th>
                    <th>Execution mode</th>
                    <th>Post-trade truth</th>
                    <th>Venue event</th>
                    <th>Requested</th>
                    <th>Reference</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.steps.map((step) => (
                    <tr key={step.id}>
                      <td>
                        <div className="stack stack--compact">
                          <span>{step.intentId}</span>
                          <span className="panel__hint">{step.asset} {step.side} {step.requestedSize}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack stack--compact">
                          <span>{step.venueId}</span>
                          <span className="panel__hint">{step.venueMode}{step.simulated ? ' / simulated' : ''}</span>
                        </div>
                      </td>
                      <td>{formatMarketIdentityLabel(step.marketIdentity)}</td>
                      <td>{formatMarketIdentityDetail(step.marketIdentity)}</td>
                      <td><StatusBadge label={step.status} tone={carryStatusTone(step.status)} /></td>
                      <td>{formatStepExecutionMode(step.outcome, step.simulated)}</td>
                      <td>
                        {step.postTradeConfirmation === null ? 'Not recorded' : (
                          <div className="stack stack--compact">
                            <StatusBadge
                              label={step.postTradeConfirmation.status}
                              tone={toneForPostTradeConfirmation(step.postTradeConfirmation.status)}
                            />
                            <span className="panel__hint">{step.postTradeConfirmation.evidenceBasis}</span>
                            <span className="panel__hint">{step.postTradeConfirmation.summary}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {step.postTradeConfirmation?.eventEvidence === null || step.postTradeConfirmation?.eventEvidence === undefined ? 'Not recorded' : (
                          <div className="stack stack--compact">
                            <StatusBadge
                              label={`${step.postTradeConfirmation.eventEvidence.correlationStatus} / ${step.postTradeConfirmation.eventEvidence.correlationConfidence}`}
                              tone={toneForEventCorrelation(step.postTradeConfirmation.eventEvidence.correlationStatus)}
                            />
                            <span className="panel__hint">{step.postTradeConfirmation.eventEvidence.summary}</span>
                          </div>
                        )}
                      </td>
                      <td>{step.requestedPrice ?? 'Market'} / {step.orderType}</td>
                      <td>{step.executionReference ?? step.venueOrderId ?? step.clientOrderId ?? 'Unavailable'}</td>
                      <td>{step.outcomeSummary ?? step.lastError ?? 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Execution lifecycle and audit-oriented timestamps" title="Timeline">
            {detail.timeline.length === 0 ? (
              <EmptyState message="No timeline entries were derived for this execution." title="No timeline" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>At</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Actor</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.timeline.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.at)}</td>
                      <td>{entry.eventType}</td>
                      <td>{entry.status === null ? 'N/A' : <StatusBadge label={entry.status} tone={carryStatusTone(entry.status)} />}</td>
                      <td>{entry.actorId ?? 'System'}</td>
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
