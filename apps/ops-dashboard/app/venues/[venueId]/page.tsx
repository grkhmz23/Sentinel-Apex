import Link from 'next/link';

import { AppShell } from '../../../src/components/app-shell';
import { ConnectorPromotionActions } from '../../../src/components/connector-promotion-actions';
import { DefinitionList } from '../../../src/components/definition-list';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { Panel } from '../../../src/components/panel';
import { StatusBadge } from '../../../src/components/status-badge';
import { requireDashboardSession } from '../../../src/lib/auth.server';
import { formatDateTime } from '../../../src/lib/format';
import { loadVenueDetailPageData } from '../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function toneForTruthMode(mode: 'simulated' | 'real'): 'warn' | 'good' {
  return mode === 'real' ? 'good' : 'warn';
}

function toneForHealthState(state: string): 'good' | 'warn' | 'bad' {
  if (state === 'healthy') {
    return 'good';
  }
  if (state === 'degraded') {
    return 'warn';
  }
  return 'bad';
}

function toneForTruthProfile(
  profile: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (profile === 'derivative_aware') {
    return 'good';
  }
  if (profile === 'generic_wallet') {
    return 'warn';
  }
  if (profile === 'capacity_only') {
    return 'neutral';
  }
  return 'bad';
}

function toneForCapabilityClass(
  capabilityClass: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (capabilityClass === 'execution_capable') {
    return 'good';
  }
  if (capabilityClass === 'real_readonly') {
    return 'warn';
  }
  return 'neutral';
}

function toneForPromotionPosture(
  posture: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (posture === 'approved_for_live') {
    return 'good';
  }
  if (posture === 'promotion_pending' || posture === 'execution_capable_unapproved') {
    return 'warn';
  }
  if (posture === 'rejected' || posture === 'suspended') {
    return 'bad';
  }
  return 'neutral';
}

function toneForPostTradeConfirmation(
  status: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'confirmed' || status === 'confirmed_full') {
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
  if (status === 'blocked') {
    return 'bad';
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

function toneForCoverageStatus(
  status: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'available') {
    return 'good';
  }
  if (status === 'partial') {
    return 'warn';
  }
  if (status === 'unsupported') {
    return 'neutral';
  }
  return 'bad';
}

function formatCoverage(status: string, reason: string | null): string {
  return reason === null ? status : `${status} - ${reason}`;
}

function formatJoined(values: string[] | null | undefined, fallback = 'None recorded'): string {
  return values === undefined || values === null || values.length === 0
    ? fallback
    : values.join('; ');
}

function formatConfigReadiness(
  markers: Array<{ key: string; ready: boolean; summary: string }> | null | undefined,
): string {
  if (markers === undefined || markers === null || markers.length === 0) {
    return 'No config markers detected';
  }

  return markers.map((marker) => `${marker.summary}: ${marker.ready ? 'ready' : 'missing'}`).join('; ');
}

function formatMetadataStringArray(value: unknown, fallback = 'Not recorded'): string {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value.join('; ')
    : fallback;
}

function formatProvenance(
  provenance:
    | {
      classification: string;
      source: string;
      notes: string[];
    }
    | null
    | undefined,
): string {
  if (provenance === null || provenance === undefined) {
    return 'None recorded';
  }

  return `${provenance.classification} via ${provenance.source}`;
}

function formatComparisonCoverage(
  item: { status: string; reason: string | null },
): string {
  return item.reason === null ? item.status : `${item.status} - ${item.reason}`;
}

function formatCanonicalMarketIdentityLabel(
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

function formatCanonicalMarketIdentityDetail(
  identity: {
    normalizedKeyType: string;
    confidence: string;
    provenance?: {
      classification: string;
      source: string;
    } | null;
  } | null,
): string {
  if (identity === null) {
    return 'No normalized identity.';
  }

  const provenanceSummary = identity.provenance === undefined || identity.provenance === null
    ? 'no provenance'
    : `${identity.provenance.classification} via ${identity.provenance.source}`;
  return `${identity.normalizedKeyType} / ${identity.confidence} / ${provenanceSummary}`;
}

function toneForComparisonStatus(
  status: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'matched') {
    return 'good';
  }
  if (status === 'mismatched') {
    return 'bad';
  }
  if (status === 'internal_only' || status === 'external_only') {
    return 'warn';
  }
  return 'neutral';
}

export default async function VenueDetailPage(
  { params }: { params: { venueId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/venues/${params.venueId}`);
  const state = await loadVenueDetailPageData(params.venueId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Venue detail unavailable.'} title="Venue detail unavailable" />
      </AppShell>
    );
  }

  const { venue, snapshots } = state.data.detail;
  const internalState = state.data.detail.internalState;
  const comparisonSummary = state.data.detail.comparisonSummary;
  const comparisonDetail = state.data.detail.comparisonDetail;
  const promotion = state.data.detail.promotion;
  const latestSnapshot = snapshots[0] ?? null;
  const internalHealthState = internalState?.healthState ?? null;
  const sourceMetadata = latestSnapshot?.sourceMetadata ?? venue.sourceMetadata;
  const accountState = latestSnapshot?.accountState ?? null;
  const balanceState = latestSnapshot?.balanceState ?? null;
  const exposureState = latestSnapshot?.exposureState ?? null;
  const derivativeAccountState = latestSnapshot?.derivativeAccountState ?? null;
  const derivativePositionState = latestSnapshot?.derivativePositionState ?? null;
  const derivativeHealthState = latestSnapshot?.derivativeHealthState ?? null;
  const orderState = latestSnapshot?.orderState ?? null;
  const executionReferenceState = latestSnapshot?.executionReferenceState ?? null;
  const executionConfirmationState = latestSnapshot?.executionConfirmationState
    ?? venue.executionConfirmationState
    ?? promotion.evidence.postTradeConfirmation;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Venue Detail</p>
            <h1>{venue.venueName}</h1>
            <p className="panel__hint">{venue.venueId}</p>
          </div>
          <div className="button-row">
            <StatusBadge label={venue.truthMode} tone={toneForTruthMode(venue.truthMode)} />
            <StatusBadge label={venue.truthProfile} tone={toneForTruthProfile(venue.truthProfile)} />
            <StatusBadge label={venue.healthState} tone={toneForHealthState(venue.healthState)} />
            <StatusBadge label={promotion.current.effectivePosture} tone={toneForPromotionPosture(promotion.current.effectivePosture)} />
          </div>
        </header>

        <div className="inline-links">
          <Link href="/venues">Back to venues</Link>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Connector maturity, execution posture, and live-readiness truth" title="Capability Overview">
            <DefinitionList
              items={[
                { label: 'Connector type', value: venue.connectorType },
                { label: 'Connector depth', value: sourceMetadata.connectorDepth ?? 'Not recorded' },
                { label: 'Sleeves', value: venue.sleeveApplicability.join(', ') },
                { label: 'Truth mode', value: <StatusBadge label={venue.truthMode} tone={toneForTruthMode(venue.truthMode)} /> },
                { label: 'Truth profile', value: <StatusBadge label={venue.truthProfile} tone={toneForTruthProfile(venue.truthProfile)} /> },
                { label: 'Read-only support', value: venue.readOnlySupport ? 'Yes' : 'No' },
                { label: 'Execution support', value: venue.executionSupport ? 'Yes' : 'No' },
                { label: 'Approved for live', value: venue.approvedForLiveUse ? 'Yes' : 'No' },
                { label: 'Onboarding state', value: venue.onboardingState },
                { label: 'Execution posture', value: typeof venue.metadata['executionPosture'] === 'string' ? String(venue.metadata['executionPosture']) : 'Not recorded' },
                { label: 'Connector mode', value: typeof venue.metadata['connectorMode'] === 'string' ? String(venue.metadata['connectorMode']) : 'Not recorded' },
                { label: 'Supported execution scope', value: formatMetadataStringArray(venue.metadata['supportedExecutionScope']) },
                { label: 'Unsupported scope', value: formatMetadataStringArray(venue.metadata['unsupportedExecutionScope']) },
                { label: 'Missing prerequisites', value: venue.missingPrerequisites.join(', ') || 'None documented' },
                { label: 'Auth/config requirements', value: venue.authRequirementsSummary.join(', ') || 'None documented' },
              ]}
            />
          </Panel>

          <Panel subtitle="Durable operator review state, current posture, and sensitive execution gate" title="Promotion Workflow">
            <>
              <DefinitionList
                items={[
                  { label: 'Capability class', value: <StatusBadge label={promotion.current.capabilityClass} tone={toneForCapabilityClass(promotion.current.capabilityClass)} /> },
                  { label: 'Promotion status', value: <StatusBadge label={promotion.current.promotionStatus} tone={toneForPromotionPosture(promotion.current.promotionStatus)} /> },
                  { label: 'Effective posture', value: <StatusBadge label={promotion.current.effectivePosture} tone={toneForPromotionPosture(promotion.current.effectivePosture)} /> },
                  { label: 'Approved for live', value: promotion.current.approvedForLiveUse ? 'Yes' : 'No' },
                  { label: 'Sensitive execution eligible', value: promotion.current.sensitiveExecutionEligible ? 'Yes' : 'No' },
                  { label: 'Requested by', value: promotion.current.requestedBy ?? 'Not requested' },
                  { label: 'Requested at', value: formatDateTime(promotion.current.requestedAt) },
                  { label: 'Approved by', value: promotion.current.approvedBy ?? 'Not approved' },
                  { label: 'Approved at', value: formatDateTime(promotion.current.approvedAt) },
                  { label: 'Rejected by', value: promotion.current.rejectedBy ?? 'Not rejected' },
                  { label: 'Rejected at', value: formatDateTime(promotion.current.rejectedAt) },
                  { label: 'Suspended by', value: promotion.current.suspendedBy ?? 'Not suspended' },
                  { label: 'Suspended at', value: formatDateTime(promotion.current.suspendedAt) },
                  { label: 'Latest note', value: promotion.current.latestNote ?? 'None recorded' },
                ]}
              />
              <ConnectorPromotionActions
                capabilityClass={promotion.current.capabilityClass}
                promotionStatus={promotion.current.promotionStatus}
                venueId={venue.venueId}
                venueName={venue.venueName}
              />
            </>
          </Panel>

          <Panel subtitle="Deterministic evidence and prerequisite checks that control promotion eligibility" title="Promotion Evidence">
            <DefinitionList
              items={[
                { label: 'Eligibility', value: promotion.evidence.eligibleForPromotion ? 'Eligible' : 'Blocked' },
                { label: 'Read-only validation', value: promotion.evidence.readOnlyValidationState },
                { label: 'Snapshot freshness', value: promotion.evidence.snapshotFreshness },
                { label: 'Snapshot completeness', value: promotion.evidence.snapshotCompleteness },
                { label: 'Health state', value: <StatusBadge label={promotion.evidence.healthState} tone={toneForHealthState(promotion.evidence.healthState)} /> },
                {
                  label: 'Post-trade confirmation',
                  value: (
                    <StatusBadge
                      label={promotion.evidence.postTradeConfirmation.status}
                      tone={toneForPostTradeConfirmation(promotion.evidence.postTradeConfirmation.status)}
                    />
                  ),
                },
                { label: 'Post-trade summary', value: promotion.evidence.postTradeConfirmation.summary },
                { label: 'Recent real executions', value: String(promotion.evidence.postTradeConfirmation.recentExecutionCount) },
                { label: 'Confirmed full', value: String(promotion.evidence.postTradeConfirmation.confirmedFullCount) },
                { label: 'Confirmed partial', value: String(promotion.evidence.postTradeConfirmation.confirmedPartialCount) },
                { label: 'Partial event only', value: String(promotion.evidence.postTradeConfirmation.confirmedPartialEventOnlyCount) },
                { label: 'Partial position only', value: String(promotion.evidence.postTradeConfirmation.confirmedPartialPositionOnlyCount) },
                { label: 'Pending', value: String(promotion.evidence.postTradeConfirmation.pendingCount) },
                { label: 'Pending event', value: String(promotion.evidence.postTradeConfirmation.pendingEventCount) },
                { label: 'Pending position delta', value: String(promotion.evidence.postTradeConfirmation.pendingPositionDeltaCount) },
                { label: 'Conflicting event', value: String(promotion.evidence.postTradeConfirmation.conflictingEventCount) },
                { label: 'Event vs position conflict', value: String(promotion.evidence.postTradeConfirmation.conflictingEventVsPositionCount) },
                { label: 'Missing references', value: String(promotion.evidence.postTradeConfirmation.missingReferenceCount) },
                { label: 'Latest confirmed reference', value: formatDateTime(promotion.evidence.postTradeConfirmation.latestConfirmedAt) },
                { label: 'Last truth snapshot', value: formatDateTime(promotion.evidence.lastSnapshotAt) },
                { label: 'Last successful truth snapshot', value: formatDateTime(promotion.evidence.lastSuccessfulSnapshotAt) },
                { label: 'Coverage available', value: String(promotion.evidence.truthCoverageAvailableCount) },
                { label: 'Coverage partial', value: String(promotion.evidence.truthCoveragePartialCount) },
                { label: 'Coverage unsupported', value: String(promotion.evidence.truthCoverageUnsupportedCount) },
                { label: 'Config readiness', value: formatConfigReadiness(promotion.evidence.configReadiness) },
                { label: 'Missing prerequisites', value: formatJoined(promotion.evidence.missingPrerequisites, 'None recorded') },
                { label: 'Blocking reasons', value: formatJoined(promotion.evidence.blockingReasons, 'None recorded') },
              ]}
            />
          </Panel>

          <Panel subtitle="Latest ingested venue-native truth, freshness, and decode provenance" title="Snapshot State">
            <DefinitionList
              items={[
                { label: 'Health state', value: <StatusBadge label={venue.healthState} tone={toneForHealthState(venue.healthState)} /> },
                { label: 'Latest snapshot type', value: venue.latestSnapshotType },
                { label: 'Latest snapshot summary', value: venue.latestSnapshotSummary },
                { label: 'Latest error', value: venue.latestErrorMessage ?? 'None recorded' },
                { label: 'Snapshot completeness', value: venue.snapshotCompleteness },
                { label: 'Snapshot freshness', value: venue.snapshotFreshness },
                { label: 'Last snapshot', value: formatDateTime(venue.lastSnapshotAt) },
                { label: 'Last successful snapshot', value: formatDateTime(venue.lastSuccessfulSnapshotAt) },
                { label: 'Source', value: `${sourceMetadata.sourceKind} (${sourceMetadata.sourceName})` },
                { label: 'Commitment', value: sourceMetadata.commitment ?? 'Not recorded' },
                { label: 'Observed slot', value: sourceMetadata.observedSlot ?? 'Not recorded' },
                { label: 'Observed scope', value: sourceMetadata.observedScope.join(', ') || 'None recorded' },
                { label: 'Source notes', value: formatJoined(sourceMetadata.provenanceNotes) },
                {
                  label: 'Execution confirmation state',
                  value: executionConfirmationState === null
                    ? 'Not recorded'
                    : (
                      <StatusBadge
                        label={executionConfirmationState.status}
                        tone={toneForPostTradeConfirmation(executionConfirmationState.status)}
                      />
                    ),
                },
                {
                  label: 'Execution confirmation summary',
                  value: executionConfirmationState?.summary ?? 'Not recorded',
                },
                { label: 'Degraded reason', value: venue.degradedReason ?? 'None recorded' },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Which truth domains are available, partial, or unsupported in the latest snapshot" title="Truth Coverage">
            <DefinitionList
              items={[
                { label: 'Account state', value: <StatusBadge label={venue.truthCoverage.accountState.status} tone={toneForCoverageStatus(venue.truthCoverage.accountState.status)} /> },
                { label: 'Account detail', value: formatCoverage(venue.truthCoverage.accountState.status, venue.truthCoverage.accountState.reason) },
                { label: 'Balance state', value: formatCoverage(venue.truthCoverage.balanceState.status, venue.truthCoverage.balanceState.reason) },
                { label: 'Capacity state', value: formatCoverage(venue.truthCoverage.capacityState.status, venue.truthCoverage.capacityState.reason) },
                { label: 'Exposure state', value: formatCoverage(venue.truthCoverage.exposureState.status, venue.truthCoverage.exposureState.reason) },
                { label: 'Derivative account', value: formatCoverage(venue.truthCoverage.derivativeAccountState.status, venue.truthCoverage.derivativeAccountState.reason) },
                { label: 'Derivative positions', value: formatCoverage(venue.truthCoverage.derivativePositionState.status, venue.truthCoverage.derivativePositionState.reason) },
                { label: 'Derivative health', value: formatCoverage(venue.truthCoverage.derivativeHealthState.status, venue.truthCoverage.derivativeHealthState.reason) },
                { label: 'Order inventory', value: formatCoverage(venue.truthCoverage.orderState.status, venue.truthCoverage.orderState.reason) },
                { label: 'Execution references', value: formatCoverage(venue.truthCoverage.executionReferences.status, venue.truthCoverage.executionReferences.reason) },
              ]}
            />
          </Panel>

          <Panel subtitle="What the control plane can compare directly against internal state today" title="Reconciliation Coverage">
            <DefinitionList
              items={[
                { label: 'Subaccount identity', value: formatComparisonCoverage(comparisonSummary.subaccountIdentity) },
                { label: 'Position inventory comparison', value: formatComparisonCoverage(comparisonSummary.positionInventory) },
                { label: 'Health-state comparison', value: formatComparisonCoverage(comparisonSummary.healthState) },
                { label: 'Order-inventory comparison', value: formatComparisonCoverage(comparisonSummary.orderInventory) },
                { label: 'Position mismatches', value: String(comparisonSummary.mismatchedPositionCount) },
                { label: 'Order mismatches', value: String(comparisonSummary.mismatchedOrderCount) },
                { label: 'Active findings', value: String(comparisonSummary.activeFindingCount) },
                { label: 'Active mismatches', value: String(comparisonSummary.activeMismatchCount) },
                { label: 'Coverage notes', value: formatJoined(comparisonSummary.notes) },
              ]}
            />
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Per-execution confirmation evidence, event confidence, and blocked reasons" title="Recent Execution Evidence">
            {executionConfirmationState === null || executionConfirmationState.entries.length === 0 ? (
              <EmptyState message="No recent execution confirmation entries were persisted for this venue." title="No recent execution evidence" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Basis</th>
                    <th>Event correlation</th>
                    <th>Event summary</th>
                    <th>Blocked reason</th>
                  </tr>
                </thead>
                <tbody>
                  {executionConfirmationState.entries.map((entry) => (
                    <tr key={entry.stepId}>
                      <td>{entry.executionReference}</td>
                      <td><StatusBadge label={entry.status} tone={toneForPostTradeConfirmation(entry.status)} /></td>
                      <td>{entry.evidenceBasis}</td>
                      <td>
                        {entry.eventEvidence === null ? 'No venue event' : (
                          <StatusBadge
                            label={`${entry.eventEvidence.correlationStatus} / ${entry.eventEvidence.correlationConfidence}`}
                            tone={toneForEventCorrelation(entry.eventEvidence.correlationStatus)}
                          />
                        )}
                      </td>
                      <td>{entry.eventEvidence?.summary ?? 'No venue-native event evidence recorded.'}</td>
                      <td>{entry.blockedReason ?? 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Canonical internal derivative account target and persisted state coverage for this venue" title="Internal Derivative State">
            <DefinitionList
              items={[
                { label: 'Internal snapshot', value: internalState?.capturedAt === null || internalState?.capturedAt === undefined ? 'Not persisted' : formatDateTime(internalState.capturedAt) },
                { label: 'Source component', value: internalState?.sourceComponent ?? 'Not recorded' },
                { label: 'Source run', value: internalState?.sourceRunId ?? 'Not recorded' },
                { label: 'Source reference', value: internalState?.sourceReference ?? 'Not recorded' },
                { label: 'Account coverage', value: internalState === null ? 'unsupported - no internal snapshot' : formatCoverage(internalState.coverage.accountState.status, internalState.coverage.accountState.reason) },
                { label: 'Position coverage', value: internalState === null ? 'unsupported - no internal snapshot' : formatCoverage(internalState.coverage.positionState.status, internalState.coverage.positionState.reason) },
                { label: 'Health coverage', value: internalState === null ? 'unsupported - no internal snapshot' : formatCoverage(internalState.coverage.healthState.status, internalState.coverage.healthState.reason) },
                { label: 'Order coverage', value: internalState === null ? 'unsupported - no internal snapshot' : formatCoverage(internalState.coverage.orderState.status, internalState.coverage.orderState.reason) },
                { label: 'Account locator', value: internalState?.accountState?.accountLocatorMode ?? 'Unsupported' },
                { label: 'Tracked account', value: internalState?.accountState?.accountAddress ?? 'Not configured' },
                { label: 'Authority', value: internalState?.accountState?.authorityAddress ?? 'Not configured' },
                { label: 'Subaccount id', value: internalState?.accountState?.subaccountId === null || internalState?.accountState?.subaccountId === undefined ? 'Not configured' : String(internalState.accountState.subaccountId) },
                { label: 'Internal methodology', value: internalState?.accountState?.methodology ?? 'Not recorded' },
                { label: 'Internal notes', value: formatJoined(internalState?.accountState?.notes) },
                { label: 'Internal health status', value: internalHealthState?.healthStatus ?? 'Unsupported' },
                { label: 'Health model', value: internalHealthState?.modelType ?? 'Unsupported' },
                { label: 'Health comparison mode', value: internalHealthState?.comparisonMode ?? 'Unsupported' },
                { label: 'Risk posture', value: internalHealthState?.riskPosture ?? 'Not recorded' },
                { label: 'Collateral-like USD', value: internalHealthState?.collateralLikeUsd ?? 'Not recorded' },
                { label: 'Venue exposure USD', value: internalHealthState?.venueExposureUsd ?? 'Not recorded' },
                { label: 'Exposure/NAV ratio', value: internalHealthState?.exposureToNavRatio ?? 'Not recorded' },
                { label: 'Internal leverage', value: internalHealthState?.leverage ?? 'Not recorded' },
                { label: 'Health notes', value: formatJoined(internalHealthState?.notes) },
              ]}
            />
          </Panel>

          <Panel subtitle="Latest account-identity truth captured for this venue connector" title="Account State">
            <DefinitionList
              items={[
                { label: 'Tracked account', value: accountState?.accountAddress ?? 'Unsupported or not configured' },
                { label: 'Account label', value: accountState?.accountLabel ?? 'None recorded' },
                { label: 'Account exists', value: accountState?.accountExists === null || accountState?.accountExists === undefined ? 'Unknown' : accountState.accountExists ? 'Yes' : 'No' },
                { label: 'Owner program', value: accountState?.ownerProgram ?? 'None recorded' },
                { label: 'Executable', value: accountState?.executable === null || accountState?.executable === undefined ? 'Unknown' : accountState.executable ? 'Yes' : 'No' },
                { label: 'Lamports', value: accountState?.lamports ?? 'None recorded' },
                { label: 'Native balance', value: accountState?.nativeBalanceDisplay ?? 'None recorded' },
                { label: 'Observed slot', value: accountState?.observedSlot ?? 'None recorded' },
              ]}
            />
          </Panel>

          <Panel subtitle="Venue-native derivative account identity, subaccount semantics, and decode posture" title="Derivative Account State">
            <DefinitionList
              items={[
                { label: 'Coverage', value: formatCoverage(venue.truthCoverage.derivativeAccountState.status, venue.truthCoverage.derivativeAccountState.reason) },
                { label: 'Venue', value: derivativeAccountState?.venue ?? 'None recorded' },
                { label: 'Account model', value: derivativeAccountState?.accountModel ?? 'No derivative account metadata' },
                { label: 'Venue account type', value: derivativeAccountState?.venueAccountType ?? 'Not recorded' },
                { label: 'Decoded venue account', value: derivativeAccountState?.decoded ? 'Yes' : 'No' },
                { label: 'Authority', value: derivativeAccountState?.authorityAddress ?? 'Unsupported' },
                { label: 'Subaccount id', value: derivativeAccountState?.subaccountId === null || derivativeAccountState?.subaccountId === undefined ? 'Unsupported' : String(derivativeAccountState.subaccountId) },
                { label: 'User name', value: derivativeAccountState?.userName ?? 'Not recorded' },
                { label: 'Delegate', value: derivativeAccountState?.delegateAddress ?? 'Not recorded' },
                { label: 'Margin mode', value: derivativeAccountState?.marginMode ?? 'Not recorded' },
                { label: 'Pool id', value: derivativeAccountState?.poolId === null || derivativeAccountState?.poolId === undefined ? 'Not recorded' : String(derivativeAccountState.poolId) },
                { label: 'Margin trading enabled', value: derivativeAccountState?.marginTradingEnabled === null || derivativeAccountState?.marginTradingEnabled === undefined ? 'Unknown' : derivativeAccountState.marginTradingEnabled ? 'Yes' : 'No' },
                { label: 'Open order count', value: derivativeAccountState?.openOrderCount === null || derivativeAccountState?.openOrderCount === undefined ? 'Not recorded' : String(derivativeAccountState.openOrderCount) },
                { label: 'Open auction count', value: derivativeAccountState?.openAuctionCount === null || derivativeAccountState?.openAuctionCount === undefined ? 'Not recorded' : String(derivativeAccountState.openAuctionCount) },
                { label: 'Status flags', value: formatJoined(derivativeAccountState?.statusFlags, 'None recorded') },
                { label: 'Raw discriminator', value: derivativeAccountState?.rawDiscriminatorHex ?? 'None recorded' },
                { label: 'Observed slot', value: derivativeAccountState?.observedSlot ?? 'None recorded' },
                { label: 'Decode provenance', value: formatProvenance(derivativeAccountState?.provenance) },
                { label: 'Decode notes', value: formatJoined(derivativeAccountState?.notes) },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Internal positions and open-order inventory that Sentinel Apex currently believes it owns" title="Internal Inventory">
            {internalState === null ? (
              <EmptyState message="No internal derivative snapshot is currently persisted for this venue." title="No internal state" />
            ) : (
              <>
                <DefinitionList
                  items={[
                    { label: 'Open positions', value: String(internalState.positionState?.openPositionCount ?? 0) },
                    { label: 'Open orders', value: String(internalState.orderState?.openOrderCount ?? 0) },
                    { label: 'Comparable open orders', value: String(internalState.orderState?.comparableOpenOrderCount ?? 0) },
                    { label: 'Non-comparable open orders', value: String(internalState.orderState?.nonComparableOpenOrderCount ?? 0) },
                    { label: 'Position methodology', value: internalState.positionState?.methodology ?? 'Not recorded' },
                    { label: 'Order methodology', value: internalState.orderState?.methodology ?? 'Not recorded' },
                  ]}
                />
                {internalState.positionState !== null && internalState.positionState.positions.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Market identity</th>
                        <th>Identity confidence</th>
                        <th>Side</th>
                        <th>Net qty</th>
                        <th>Avg entry</th>
                        <th>Fills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internalState.positionState.positions.map((position) => (
                        <tr key={position.positionKey}>
                          <td>{position.positionKey}</td>
                          <td>{formatCanonicalMarketIdentityLabel(position.marketIdentity)}</td>
                          <td>{formatCanonicalMarketIdentityDetail(position.marketIdentity)}</td>
                          <td>{position.side}</td>
                          <td>{position.netQuantity}</td>
                          <td>{position.averageEntryPrice ?? 'Not recorded'}</td>
                          <td>{position.fillCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState message="No internally open derivative positions are currently tracked." title="No internal positions" />
                )}
                {internalState.orderState !== null && internalState.orderState.openOrders.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Market identity</th>
                        <th>Status</th>
                        <th>Side</th>
                        <th>Remaining</th>
                        <th>Comparable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internalState.orderState.openOrders.map((order) => (
                        <tr key={order.orderKey}>
                          <td>{order.venueOrderId ?? order.clientOrderId}</td>
                          <td>{formatCanonicalMarketIdentityLabel(order.marketIdentity)}</td>
                          <td>{order.status}</td>
                          <td>{order.side}</td>
                          <td>{order.remainingSize}</td>
                          <td>{order.comparableByVenueOrderId ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <EmptyState message="No internal open-order inventory is currently tracked." title="No internal open orders" />
                )}
              </>
            )}
          </Panel>

          <Panel subtitle="Field-by-field comparison between internal derivative state and external Drift-native truth" title="Comparison Detail">
            <>
              <DefinitionList
                items={[
                  { label: 'Internal snapshot', value: formatDateTime(comparisonSummary.internalSnapshotAt) },
                  { label: 'External snapshot', value: formatDateTime(comparisonSummary.externalSnapshotAt) },
                  { label: 'Account comparison', value: formatComparisonCoverage(comparisonSummary.subaccountIdentity) },
                  { label: 'Market identity comparison', value: formatComparisonCoverage(comparisonSummary.marketIdentity) },
                  { label: 'Health comparison', value: formatComparisonCoverage(comparisonSummary.healthState) },
                  { label: 'Health comparison mode', value: comparisonSummary.healthComparisonMode },
                  { label: 'Exact position identities', value: String(comparisonSummary.exactPositionIdentityCount) },
                  { label: 'Partial position identities', value: String(comparisonSummary.partialPositionIdentityCount) },
                  { label: 'Position identity gaps', value: String(comparisonSummary.positionIdentityGapCount) },
                  { label: 'Account result', value: <StatusBadge label={comparisonDetail.accountComparison.status} tone={toneForComparisonStatus(comparisonDetail.accountComparison.status)} /> },
                  { label: 'Account notes', value: formatJoined(comparisonDetail.accountComparison.notes) },
                  { label: 'Health result', value: <StatusBadge label={comparisonDetail.healthComparison.status} tone={toneForComparisonStatus(comparisonDetail.healthComparison.status)} /> },
                  { label: 'Health notes', value: formatJoined(comparisonDetail.healthComparison.notes) },
                ]}
              />
              {comparisonDetail.positionComparisons.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Position key</th>
                      <th>Market identity</th>
                      <th>Identity basis</th>
                      <th>Internal qty</th>
                      <th>External qty</th>
                      <th>Delta</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonDetail.positionComparisons.map((comparison) => (
                      <tr key={comparison.comparisonKey}>
                        <td>{comparison.comparisonKey}</td>
                        <td>{comparison.marketIdentityComparison.normalizedIdentity?.key ?? comparison.marketIdentityComparison.internalIdentity?.normalizedKey ?? comparison.marketIdentityComparison.externalIdentity?.normalizedKey ?? 'None'}</td>
                        <td>{comparison.marketIdentityComparison.comparisonMode} / {formatCanonicalMarketIdentityDetail(comparison.marketIdentityComparison.internalIdentity)}</td>
                        <td>{comparison.internalPosition?.netQuantity ?? 'None'}</td>
                        <td>{comparison.externalPosition?.baseAssetAmount ?? 'None'}</td>
                        <td>{comparison.quantityDelta ?? 'None'}</td>
                        <td>
                          <StatusBadge label={comparison.status} tone={toneForComparisonStatus(comparison.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState message="No comparable position rows are currently available." title="No position comparisons" />
              )}
              {comparisonDetail.orderComparisons.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order key</th>
                      <th>Market identity</th>
                      <th>Identity basis</th>
                      <th>Internal remaining</th>
                      <th>External qty</th>
                      <th>Delta</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonDetail.orderComparisons.map((comparison) => (
                      <tr key={comparison.comparisonKey}>
                        <td>{comparison.comparisonKey}</td>
                        <td>{comparison.marketIdentityComparison.normalizedIdentity?.key ?? comparison.marketIdentityComparison.internalIdentity?.normalizedKey ?? comparison.marketIdentityComparison.externalIdentity?.normalizedKey ?? 'None'}</td>
                        <td>{comparison.marketIdentityComparison.comparisonMode} / {formatCanonicalMarketIdentityDetail(comparison.marketIdentityComparison.internalIdentity)}</td>
                        <td>{comparison.internalOrder?.remainingSize ?? 'None'}</td>
                        <td>{comparison.externalOrder?.quantity ?? 'None'}</td>
                        <td>{comparison.remainingSizeDelta ?? 'None'}</td>
                        <td>
                          <StatusBadge label={comparison.status} tone={toneForComparisonStatus(comparison.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState message="No comparable open-order rows are currently available." title="No order comparisons" />
              )}
              {comparisonDetail.healthComparison.fields.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Health field</th>
                      <th>Internal</th>
                      <th>External</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonDetail.healthComparison.fields.map((field) => (
                      <tr key={field.field}>
                        <td>{field.field}</td>
                        <td>{field.internalValue === null ? 'None' : String(field.internalValue)}</td>
                        <td>{field.externalValue === null ? 'None' : String(field.externalValue)}</td>
                        <td>
                          <StatusBadge label={field.status} tone={toneForComparisonStatus(field.status)} />
                        </td>
                        <td>{field.reason ?? 'Directly comparable'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Latest typed collateral and wallet-like balances captured for this connector" title="Balance State">
            {balanceState === null ? (
              <EmptyState message="This connector does not currently expose typed balance state." title="No balance state" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Account</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceState.balances.map((balance) => (
                    <tr key={`${balance.assetKey}:${balance.accountAddress ?? 'native'}`}>
                      <td>{balance.assetSymbol ?? balance.assetKey}</td>
                      <td>{balance.assetType}</td>
                      <td>{balance.amountDisplay}</td>
                      <td>{balance.accountAddress ?? 'Primary account'}</td>
                      <td>{balance.observedSlot ?? 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Operator-facing exposure convenience views over the latest venue truth" title="Exposure View">
            {exposureState === null ? (
              <EmptyState message="No exposure summary is available for this snapshot." title="No exposure state" />
            ) : (
              <>
                <DefinitionList
                  items={[
                    { label: 'Exposure rows', value: String(exposureState.exposures.length) },
                    { label: 'Methodology', value: exposureState.methodology },
                    { label: 'Provenance', value: formatProvenance(exposureState.provenance) },
                    { label: 'Source notes', value: formatJoined(exposureState.provenance?.notes) },
                  ]}
                />
                {exposureState.exposures.length > 0 ? (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Type</th>
                        <th>Quantity</th>
                        <th>Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exposureState.exposures.map((exposure) => (
                        <tr key={exposure.exposureKey}>
                          <td>{exposure.assetKey}</td>
                          <td>{exposure.exposureType}</td>
                          <td>{exposure.quantityDisplay}</td>
                          <td>{exposure.accountAddress ?? 'Not recorded'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Venue-native position rows, exact inventory fields, and derived valuation fields" title="Position Inventory">
            <DefinitionList
              items={[
                { label: 'Coverage', value: formatCoverage(venue.truthCoverage.derivativePositionState.status, venue.truthCoverage.derivativePositionState.reason) },
                { label: 'Open positions', value: String(derivativePositionState?.openPositionCount ?? 0) },
                { label: 'Methodology', value: derivativePositionState?.methodology ?? 'Unsupported' },
                { label: 'Provenance', value: formatProvenance(derivativePositionState?.provenance) },
                { label: 'Notes', value: formatJoined(derivativePositionState?.notes) },
              ]}
            />
            {derivativePositionState === null || derivativePositionState.positions.length === 0 ? (
              <EmptyState message="No decoded derivative positions are present in the latest snapshot." title="No position inventory" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Type</th>
                    <th>Side</th>
                    <th>Quantity</th>
                    <th>Entry</th>
                    <th>Value USD</th>
                    <th>Unrealized PnL</th>
                    <th>Liquidation</th>
                    <th>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {derivativePositionState.positions.map((position) => (
                    <tr key={`${position.marketKey ?? 'unknown'}:${position.positionType}:${position.side}`}>
                      <td>{position.marketSymbol ?? position.marketKey ?? 'Unknown market'}</td>
                      <td>{position.positionType}</td>
                      <td>{position.side}</td>
                      <td>{position.baseAssetAmount ?? position.quoteAssetAmount ?? 'None'}</td>
                      <td>{position.entryPrice ?? 'None'}</td>
                      <td>{position.positionValueUsd ?? 'None'}</td>
                      <td>{position.unrealizedPnlUsd ?? 'None'}</td>
                      <td>{position.liquidationPrice ?? 'None'}</td>
                      <td>{formatProvenance(position.provenance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Venue-native collateral, leverage, margin, and liquidation posture where supported" title="Health And Margin">
            <DefinitionList
              items={[
                { label: 'Coverage', value: formatCoverage(venue.truthCoverage.derivativeHealthState.status, venue.truthCoverage.derivativeHealthState.reason) },
                { label: 'Health status', value: derivativeHealthState?.healthStatus ?? 'Unsupported' },
                { label: 'Health score', value: derivativeHealthState?.healthScore === null || derivativeHealthState?.healthScore === undefined ? 'Not recorded' : String(derivativeHealthState.healthScore) },
                { label: 'Collateral USD', value: derivativeHealthState?.collateralUsd ?? 'Unsupported' },
                { label: 'Free collateral USD', value: derivativeHealthState?.freeCollateralUsd ?? 'Unsupported' },
                { label: 'Initial margin USD', value: derivativeHealthState?.initialMarginRequirementUsd ?? 'Unsupported' },
                { label: 'Maintenance margin USD', value: derivativeHealthState?.maintenanceMarginRequirementUsd ?? 'Unsupported' },
                { label: 'Margin ratio', value: derivativeHealthState?.marginRatio ?? 'Unsupported' },
                { label: 'Leverage', value: derivativeHealthState?.leverage ?? 'Unsupported' },
                { label: 'Methodology', value: derivativeHealthState?.methodology ?? 'Unsupported' },
                { label: 'Provenance', value: formatProvenance(derivativeHealthState?.provenance) },
                { label: 'Notes', value: formatJoined(derivativeHealthState?.notes) },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Decoded venue-native open-order rows and reference semantics" title="Order Inventory">
            <DefinitionList
              items={[
                { label: 'Coverage', value: formatCoverage(venue.truthCoverage.orderState.status, venue.truthCoverage.orderState.reason) },
                { label: 'Open order count', value: orderState?.openOrderCount === null || orderState?.openOrderCount === undefined ? 'Not recorded' : String(orderState.openOrderCount) },
                { label: 'Reference mode', value: orderState?.referenceMode ?? 'none' },
                { label: 'Methodology', value: orderState?.methodology ?? 'Unsupported' },
                { label: 'Provenance', value: formatProvenance(orderState?.provenance) },
                { label: 'Notes', value: formatJoined(orderState?.notes) },
              ]}
            />
            {orderState === null || orderState.openOrders.length === 0 ? (
              <EmptyState message="No decoded open-order inventory is present in the latest snapshot." title="No open orders" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Type</th>
                    <th>Side</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Reference</th>
                    <th>Provenance</th>
                  </tr>
                </thead>
                <tbody>
                  {orderState.openOrders.map((order) => (
                    <tr key={order.venueOrderId ?? order.reference ?? `${order.marketKey ?? 'unknown'}:${order.slot ?? 'unknown'}`}>
                      <td>{order.marketSymbol ?? order.marketKey ?? 'Unknown market'}</td>
                      <td>{order.marketType ?? 'unknown'}</td>
                      <td>{order.side}</td>
                      <td>{order.status}</td>
                      <td>{order.price ?? 'None'}</td>
                      <td>{order.quantity ?? 'None'}</td>
                      <td>{order.reference ?? order.venueOrderId ?? 'None'}</td>
                      <td>{formatProvenance(order.provenance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Recent transaction references used for reference-only reconciliation where available" title="Execution References">
            <DefinitionList
              items={[
                { label: 'Coverage', value: formatCoverage(venue.truthCoverage.executionReferences.status, venue.truthCoverage.executionReferences.reason) },
                { label: 'Recent references', value: String(executionReferenceState?.references.length ?? 0) },
                { label: 'Lookback limit', value: String(executionReferenceState?.referenceLookbackLimit ?? 0) },
                { label: 'Oldest reference', value: formatDateTime(executionReferenceState?.oldestReferenceAt ?? null) },
              ]}
            />
            {executionReferenceState === null || executionReferenceState.references.length === 0 ? (
              <EmptyState message="No recent execution references are available for this snapshot." title="No execution references" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Block time</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {executionReferenceState.references.slice(0, 10).map((reference) => (
                    <tr key={reference.reference}>
                      <td>{reference.reference}</td>
                      <td>{reference.confirmationStatus ?? (reference.errored ? 'errored' : 'unknown')}</td>
                      <td>{formatDateTime(reference.blockTime)}</td>
                      <td>{reference.slot ?? 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel subtitle="Durable request, approval, rejection, and suspension history for this connector" title="Promotion History">
          {promotion.history.length === 0 ? (
            <EmptyState message="No connector promotion history has been recorded for this venue yet." title="No promotion history" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Occurred</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Actor</th>
                  <th>Posture</th>
                  <th>Eligible</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {promotion.history.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.occurredAt)}</td>
                    <td>{entry.eventType}</td>
                    <td>{entry.toStatus}</td>
                    <td>{entry.actorId}</td>
                    <td>
                      <StatusBadge label={entry.effectivePosture} tone={toneForPromotionPosture(entry.effectivePosture)} />
                    </td>
                    <td>{entry.evidence.eligibleForPromotion ? 'Yes' : 'No'}</td>
                    <td>{entry.note ?? 'None recorded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel subtitle="Persisted snapshot history for this connector" title="Snapshot History">
          {snapshots.length === 0 ? (
            <EmptyState message="No snapshots are available for this venue yet." title="No snapshots" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Captured</th>
                  <th>Type</th>
                  <th>Completeness</th>
                  <th>Health</th>
                  <th>Connector depth</th>
                  <th>Summary</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{formatDateTime(snapshot.capturedAt)}</td>
                    <td>{snapshot.snapshotType}</td>
                    <td>{snapshot.snapshotCompleteness}</td>
                    <td><StatusBadge label={snapshot.healthState} tone={toneForHealthState(snapshot.healthState)} /></td>
                    <td>{snapshot.sourceMetadata.connectorDepth ?? 'Not recorded'}</td>
                    <td>{snapshot.snapshotSummary}</td>
                    <td>{snapshot.errorMessage ?? 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
