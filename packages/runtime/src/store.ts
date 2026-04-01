import { and, desc, eq, sql } from 'drizzle-orm';

import type {
  AllocatorDecision,
  AllocatorPolicy,
  AllocatorRationale,
  RebalanceBlockedReason,
  RebalanceProposal,
} from '@sentinel-apex/allocator';
import type { CarryExecutionIntent, CarryOperationalBlockedReason } from '@sentinel-apex/carry';
import {
  allocatorCurrent,
  allocatorRebalanceBundleEscalationEvents,
  allocatorRebalanceBundleEscalations,
  allocatorRebalanceBundleRecoveryActions,
  allocatorRebalanceBundleResolutionActions,
  allocatorRebalanceBundles,
  allocatorRebalanceCurrent,
  allocatorRebalanceExecutions,
  allocatorRebalanceProposalIntents,
  allocatorRebalanceProposals,
  allocatorRecommendations,
  allocatorRuns,
  allocatorSleeveTargets,
  auditEvents,
  carryActionExecutions,
  carryActionOrderIntents,
  carryExecutionSteps,
  carryActions,
  carryVenueSnapshots,
  executionEvents,
  fills,
  internalDerivativeCurrent,
  internalDerivativeSnapshots,
  orders,
  portfolioCurrent,
  portfolioSnapshots,
  positions,
  riskCurrent,
  riskBreaches,
  riskSnapshots,
  runtimeCommands,
  runtimeMismatchRemediations,
  runtimeMismatches,
  runtimeReconciliationFindings,
  runtimeReconciliationRuns,
  runtimeRecoveryEvents,
  runtimeState,
  runtimeWorkerState,
  strategyIntents,
  strategyOpportunities,
  strategyRuns,
  treasuryActionExecutions,
  treasuryActions,
  treasuryCurrent,
  treasuryRuns,
  treasuryVenueSnapshots,
  venueConnectorSnapshots,
  type Database,
} from '@sentinel-apex/db';
import type { OrderFill, OrderIntent, OrderStatus, RiskAssessment } from '@sentinel-apex/domain';
import type { OrderRecord, OrderStore } from '@sentinel-apex/execution';
import type { AuditEvent, AuditWriter } from '@sentinel-apex/observability';
import type { PortfolioState, RiskSummary } from '@sentinel-apex/risk-engine';
import type {
  TreasuryActionBlockedReason,
  TreasuryEvaluation,
  TreasuryExecutionIntent,
  TreasuryPolicy,
} from '@sentinel-apex/treasury';

import { buildVenueDerivativeComparisonDetail } from './internal-derivative-state.js';

import type {
  InternalDerivativeCoverageView,
  InternalDerivativeSnapshotView,
  AllocatorDecisionDetailView,
  AllocatorRecommendationView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  AuditEventView,
  CarryActionDetailView,
  CarryActionPlannedOrderView,
  CarryActionView,
  CarryExecutionDetailView,
  CarryExecutionStepView,
  CarryExecutionTimelineEntry,
  CarryExecutionView,
  CarryVenueView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  ProjectionStatus,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RebalanceCurrentView,
  RebalanceBundleCompletionState,
  RebalanceBundleRecoveryActionType,
  RebalanceBundleRecoveryActionView,
  RebalanceBundleRecoveryBlockedReason,
  RebalanceBundleRecoveryCandidateView,
  RebalanceBundleRecoveryEligibilityState,
  RebalanceBundleRecoveryStatus,
  RebalanceBundleEscalationBlockedReason,
  RebalanceBundleEscalationEventType,
  RebalanceBundleEscalationEventView,
  RebalanceEscalationQueueFilters,
  RebalanceEscalationQueueItemView,
  RebalanceEscalationQueueState,
  RebalanceEscalationQueueSummaryView,
  RebalanceBundleEscalationTransitionView,
  RebalanceBundleEscalationStatus,
  RebalanceBundleEscalationTransitionType,
  RebalanceBundleEscalationView,
  RebalanceBundleResolutionActionStatus,
  RebalanceBundleResolutionActionType,
  RebalanceBundleResolutionActionView,
  RebalanceBundleResolutionBlockedReason,
  RebalanceBundleResolutionOptionView,
  RebalanceBundleResolutionState,
  RebalanceBundleDetailView,
  RebalanceBundleInterventionRecommendation,
  RebalanceBundleOutcomeClassification,
  RebalanceBundleStatus,
  RebalanceBundleView,
  RebalanceBundlePartialProgressView,
  RebalanceBundlePartialProgressSleeveView,
  RebalanceBundleChildInspectionView,
  RebalanceDownstreamStatusRollupView,
  RebalanceExecutionView,
  RebalanceExecutionGraphView,
  RebalanceExecutionTimelineEntry,
  RebalanceCarryActionNodeView,
  RebalanceProposalDetailView,
  RebalanceProposalIntentView,
  RebalanceProposalView,
  RebalanceTreasuryActionNodeView,
  RiskBreachView,
  RuntimeCommandStatus,
  RuntimeCommandType,
  RuntimeCommandView,
  RuntimeLifecycleState,
  RuntimeMismatchDetailView,
  RuntimeMismatchRemediationView,
  RuntimeMismatchSourceKind,
  RuntimeMismatchStatus,
  RuntimeMismatchSummaryView,
  RuntimeMismatchView,
  RuntimeReconciliationFindingDetailView,
  RuntimeReconciliationFindingSeverity,
  RuntimeReconciliationFindingStatus,
  RuntimeReconciliationFindingType,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunStatus,
  RuntimeReconciliationRunType,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRemediationActionType,
  RuntimeRemediationStatus,
  RuntimeRecoveryEventView,
  RuntimeVerificationOutcome,
  RiskSummaryView,
  RuntimeStatusView,
  TreasuryActionDetailView,
  TreasuryActionTimelineEntry,
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryExecutionDetailView,
  TreasuryExecutionView,
  TreasuryPolicyView,
  TreasurySummaryView,
  VenueAccountStateSnapshot,
  VenueTruthComparisonCoverageView,
  VenueDerivativeAccountStateSnapshot,
  VenueDerivativeHealthStateSnapshot,
  VenueDerivativePositionStateSnapshot,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueDetailView,
  VenueExecutionReferenceStateSnapshot,
  VenueExposureStateSnapshot,
  VenueHealthState,
  VenueInventoryItemView,
  VenueInventorySummaryView,
  VenueOnboardingState,
  VenueOrderStateSnapshot,
  VenueSnapshotFreshness,
  VenueSnapshotView,
  VenueTruthConnectorDepthSummaryView,
  VenueTruthCoverage,
  VenueTruthSnapshotCompleteness,
  VenueTruthProfile,
  VenueTruthSummaryView,
  VenueTruthSourceMetadata,
  VenueTruthMode,
  VenueTruthSleeve,
  TreasuryVenueDetailView,
  TreasuryVenueView,
  WorkerLifecycleState,
  WorkerSchedulerState,
  WorkerStatusView,
} from './types.js';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const VENUE_SNAPSHOT_STALE_AFTER_MS = 15 * 60 * 1000;

interface PersistedVenueSnapshotPayload {
  rawPayload: Record<string, unknown>;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  truthCoverage: VenueTruthCoverage;
  sourceMetadata: VenueTruthSourceMetadata;
  accountState: VenueAccountStateSnapshot | null;
  balanceState: VenueSnapshotView['balanceState'];
  capacityState: VenueSnapshotView['capacityState'];
  exposureState: VenueExposureStateSnapshot | null;
  derivativeAccountState: VenueDerivativeAccountStateSnapshot | null;
  derivativePositionState: VenueDerivativePositionStateSnapshot | null;
  derivativeHealthState: VenueDerivativeHealthStateSnapshot | null;
  orderState: VenueOrderStateSnapshot | null;
  executionReferenceState: VenueExecutionReferenceStateSnapshot | null;
}

function classifyVenueSnapshotFreshness(capturedAt: Date): VenueSnapshotFreshness {
  const ageMs = Date.now() - capturedAt.getTime();
  return ageMs > VENUE_SNAPSHOT_STALE_AFTER_MS ? 'stale' : 'fresh';
}

function createEmptyVenueTruthCoverage(): VenueTruthCoverage {
  return {
    accountState: {
      status: 'unsupported',
      reason: 'No account identity coverage was recorded for this snapshot.',
      limitations: [],
    },
    balanceState: {
      status: 'unsupported',
      reason: 'No balance coverage was recorded for this snapshot.',
      limitations: [],
    },
    capacityState: {
      status: 'unsupported',
      reason: 'No capacity coverage was recorded for this snapshot.',
      limitations: [],
    },
    exposureState: {
      status: 'unsupported',
      reason: 'No exposure coverage was recorded for this snapshot.',
      limitations: [],
    },
    derivativeAccountState: {
      status: 'unsupported',
      reason: 'No derivative account coverage was recorded for this snapshot.',
      limitations: [],
    },
    derivativePositionState: {
      status: 'unsupported',
      reason: 'No derivative position coverage was recorded for this snapshot.',
      limitations: [],
    },
    derivativeHealthState: {
      status: 'unsupported',
      reason: 'No derivative health coverage was recorded for this snapshot.',
      limitations: [],
    },
    orderState: {
      status: 'unsupported',
      reason: 'No order-state coverage was recorded for this snapshot.',
      limitations: [],
    },
    executionReferences: {
      status: 'unsupported',
      reason: 'No execution-reference coverage was recorded for this snapshot.',
      limitations: [],
    },
  };
}

function defaultVenueTruthSourceMetadata(
  connectorType: string,
  truthMode: VenueTruthMode,
): VenueTruthSourceMetadata {
  return {
    sourceKind: truthMode === 'simulated' ? 'simulation' : 'adapter',
    sourceName: connectorType,
    observedScope: [],
  };
}

function deserialiseVenueSnapshotPayload(
  snapshotPayload: unknown,
  connectorType: string,
  truthMode: VenueTruthMode,
): PersistedVenueSnapshotPayload {
  const payload = asJsonObject(snapshotPayload);
  const rawPayload = asJsonObject(payload['rawPayload']);
  const coverage = payload['truthCoverage'];
  const sourceMetadata = payload['sourceMetadata'];

  return {
    rawPayload: Object.keys(rawPayload).length === 0 ? payload : rawPayload,
    snapshotCompleteness: payload['snapshotCompleteness'] === 'complete'
      || payload['snapshotCompleteness'] === 'partial'
      || payload['snapshotCompleteness'] === 'minimal'
      ? payload['snapshotCompleteness']
      : 'minimal',
    truthCoverage: asJsonObject(coverage)['accountState'] !== undefined
      ? coverage as VenueTruthCoverage
      : createEmptyVenueTruthCoverage(),
    sourceMetadata: asJsonObject(sourceMetadata)['sourceName'] !== undefined
      ? sourceMetadata as VenueTruthSourceMetadata
      : defaultVenueTruthSourceMetadata(connectorType, truthMode),
    accountState: asJsonObject(payload['accountState'])['accountAddress'] !== undefined
      || asJsonObject(payload['accountState'])['accountExists'] !== undefined
      ? payload['accountState'] as VenueAccountStateSnapshot
      : null,
    balanceState: Array.isArray(asJsonObject(payload['balanceState'])['balances'])
      ? payload['balanceState'] as VenueSnapshotView['balanceState']
      : null,
    capacityState: asJsonObject(payload['capacityState'])['availableCapacityUsd'] !== undefined
      ? payload['capacityState'] as VenueSnapshotView['capacityState']
      : null,
    exposureState: Array.isArray(asJsonObject(payload['exposureState'])['exposures'])
      ? payload['exposureState'] as VenueExposureStateSnapshot
      : null,
    derivativeAccountState: asJsonObject(payload['derivativeAccountState'])['accountModel'] !== undefined
      || asJsonObject(payload['derivativeAccountState'])['venueAccountType'] !== undefined
      ? payload['derivativeAccountState'] as VenueDerivativeAccountStateSnapshot
      : null,
    derivativePositionState: Array.isArray(asJsonObject(payload['derivativePositionState'])['positions'])
      ? payload['derivativePositionState'] as VenueDerivativePositionStateSnapshot
      : null,
    derivativeHealthState: asJsonObject(payload['derivativeHealthState'])['healthStatus'] !== undefined
      || asJsonObject(payload['derivativeHealthState'])['methodology'] !== undefined
      ? payload['derivativeHealthState'] as VenueDerivativeHealthStateSnapshot
      : null,
    orderState: Array.isArray(asJsonObject(payload['orderState'])['openOrders'])
      || asJsonObject(payload['orderState'])['referenceMode'] !== undefined
      ? payload['orderState'] as VenueOrderStateSnapshot
      : null,
    executionReferenceState: Array.isArray(asJsonObject(payload['executionReferenceState'])['references'])
      ? payload['executionReferenceState'] as VenueExecutionReferenceStateSnapshot
      : null,
  };
}

function serialiseVenueSnapshotPayload(snapshot: VenueSnapshotView): Record<string, unknown> {
  return {
    rawPayload: snapshot.snapshotPayload,
    snapshotCompleteness: snapshot.snapshotCompleteness,
    truthCoverage: snapshot.truthCoverage,
    sourceMetadata: snapshot.sourceMetadata,
    accountState: snapshot.accountState,
    balanceState: snapshot.balanceState,
    capacityState: snapshot.capacityState,
    exposureState: snapshot.exposureState,
    derivativeAccountState: snapshot.derivativeAccountState,
    derivativePositionState: snapshot.derivativePositionState,
    derivativeHealthState: snapshot.derivativeHealthState,
    orderState: snapshot.orderState,
    executionReferenceState: snapshot.executionReferenceState,
  };
}

interface PersistedInternalDerivativeSections {
  coverage: InternalDerivativeCoverageView;
  accountState: InternalDerivativeSnapshotView['accountState'];
  positionState: InternalDerivativeSnapshotView['positionState'];
  healthState: InternalDerivativeSnapshotView['healthState'];
  orderState: InternalDerivativeSnapshotView['orderState'];
}

interface PersistedInternalDerivativeRowShape {
  coverage: unknown;
  accountState: unknown;
  positionState: unknown;
  healthState: unknown;
  orderState: unknown;
}

function defaultInternalDerivativeCoverage(): InternalDerivativeCoverageView {
  return {
    accountState: coverageItem('unsupported', 'No internal derivative account state is currently persisted.', []),
    positionState: coverageItem('unsupported', 'No internal derivative position state is currently persisted.', []),
    healthState: coverageItem('unsupported', 'No internal derivative health state is currently persisted.', []),
    orderState: coverageItem('unsupported', 'No internal derivative order state is currently persisted.', []),
  };
}

function coverageItem(
  status: InternalDerivativeCoverageView['accountState']['status'],
  reason: string | null,
  limitations: string[],
): InternalDerivativeCoverageView['accountState'] {
  return {
    status,
    reason,
    limitations,
  };
}

function deserialiseInternalDerivativeSections(
  row: PersistedInternalDerivativeRowShape,
): PersistedInternalDerivativeSections {
  const coverage = asJsonObject(row.coverage);
  const accountState = asJsonObject(row.accountState);
  const positionState = asJsonObject(row.positionState);
  const healthState = asJsonObject(row.healthState);
  const orderState = asJsonObject(row.orderState);

  return {
    coverage: coverage['accountState'] !== undefined
      ? row.coverage as InternalDerivativeCoverageView
      : defaultInternalDerivativeCoverage(),
    accountState: accountState['venueId'] !== undefined
      ? row.accountState as InternalDerivativeSnapshotView['accountState']
      : null,
    positionState: Array.isArray(positionState['positions'])
      ? row.positionState as InternalDerivativeSnapshotView['positionState']
      : null,
    healthState: healthState['methodology'] !== undefined
      ? row.healthState as InternalDerivativeSnapshotView['healthState']
      : null,
    orderState: Array.isArray(orderState['openOrders'])
      ? row.orderState as InternalDerivativeSnapshotView['orderState']
      : null,
  };
}

function mapInternalDerivativeSnapshotRow(
  row: typeof internalDerivativeSnapshots.$inferSelect,
): InternalDerivativeSnapshotView {
  const sections = deserialiseInternalDerivativeSections(row);

  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    sourceComponent: row.sourceComponent,
    sourceRunId: row.sourceRunId ?? null,
    sourceReference: row.sourceReference ?? null,
    capturedAt: row.capturedAt.toISOString(),
    updatedAt: row.createdAt.toISOString(),
    coverage: sections.coverage,
    accountState: sections.accountState,
    positionState: sections.positionState,
    healthState: sections.healthState,
    orderState: sections.orderState,
    metadata: asJsonObject(row.metadata),
  };
}

function mapInternalDerivativeCurrentRow(
  row: typeof internalDerivativeCurrent.$inferSelect,
): InternalDerivativeSnapshotView {
  const sections = deserialiseInternalDerivativeSections(row);

  return {
    id: row.latestSnapshotId ?? row.venueId,
    venueId: row.venueId,
    venueName: row.venueName,
    sourceComponent: row.sourceComponent,
    sourceRunId: row.sourceRunId ?? null,
    sourceReference: row.sourceReference ?? null,
    capturedAt: row.capturedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    coverage: sections.coverage,
    accountState: sections.accountState,
    positionState: sections.positionState,
    healthState: sections.healthState,
    orderState: sections.orderState,
    metadata: asJsonObject(row.metadata),
  };
}

function createVenueTruthCoverageAggregate(): VenueTruthSummaryView['accountState'] {
  return {
    available: 0,
    partial: 0,
    unsupported: 0,
  };
}

function createVenueTruthConnectorDepthSummary(): VenueTruthConnectorDepthSummaryView {
  return {
    simulation: 0,
    generic_rpc_readonly: 0,
    drift_native_readonly: 0,
    execution_capable: 0,
  };
}

function inferVenueTruthSourceDepth(input: {
  connectorType: string;
  truthMode: VenueTruthMode;
  executionSupport: boolean;
  sourceMetadata: VenueTruthSourceMetadata;
}): keyof VenueTruthConnectorDepthSummaryView {
  if (input.sourceMetadata.connectorDepth !== undefined) {
    return input.sourceMetadata.connectorDepth;
  }

  if (input.truthMode === 'simulated' || input.sourceMetadata.sourceKind === 'simulation') {
    return 'simulation';
  }

  if (input.executionSupport) {
    return 'execution_capable';
  }

  if (
    input.connectorType === 'drift_native_readonly'
    || input.sourceMetadata.sourceName === 'drift_native_readonly'
  ) {
    return 'drift_native_readonly';
  }

  return 'generic_rpc_readonly';
}

function comparisonCoverageItem(
  status: VenueTruthComparisonCoverageView['executionReferences']['status'],
  reason: string | null,
): VenueTruthComparisonCoverageView['executionReferences'] {
  return {
    status,
    reason,
  };
}

function deriveVenueTruthProfile(
  snapshotData: PersistedVenueSnapshotPayload,
): VenueTruthProfile {
  if (
    snapshotData.truthCoverage.derivativeAccountState.status !== 'unsupported'
    || snapshotData.truthCoverage.derivativePositionState.status !== 'unsupported'
    || snapshotData.truthCoverage.derivativeHealthState.status !== 'unsupported'
    || snapshotData.truthCoverage.orderState.status !== 'unsupported'
  ) {
    return 'derivative_aware';
  }

  if (snapshotData.truthCoverage.capacityState.status === 'available') {
    return 'capacity_only';
  }

  if (
    snapshotData.truthCoverage.accountState.status === 'available'
    || snapshotData.truthCoverage.balanceState.status === 'available'
    || snapshotData.truthCoverage.exposureState.status === 'available'
    || snapshotData.truthCoverage.executionReferences.status === 'available'
  ) {
    return 'generic_wallet';
  }

  return 'minimal';
}

function deriveVenueTruthComparisonCoverage(input: {
  connectorType: string;
  truthMode: VenueTruthMode;
  executionSupport: boolean;
  snapshotData: PersistedVenueSnapshotPayload;
}): VenueTruthComparisonCoverageView {
  const connectorDepth = inferVenueTruthSourceDepth({
    connectorType: input.connectorType,
    truthMode: input.truthMode,
    executionSupport: input.executionSupport,
    sourceMetadata: input.snapshotData.sourceMetadata,
  });
  const isDriftNativeReadonly = connectorDepth === 'drift_native_readonly';
  const executionReferenceCoverage = input.snapshotData.truthCoverage.executionReferences;

  return {
    executionReferences: executionReferenceCoverage.status === 'available'
      ? comparisonCoverageItem('available', null)
      : comparisonCoverageItem(
        executionReferenceCoverage.status,
        executionReferenceCoverage.reason
          ?? 'Recent execution references are not available for comparison.',
      ),
    positionInventory: comparisonCoverageItem(
      'unsupported',
      isDriftNativeReadonly && input.snapshotData.truthCoverage.derivativePositionState.status === 'available'
        ? 'Decoded Drift position inventory is visible, but the runtime does not yet persist venue-native Drift position projections for direct comparison.'
        : 'The runtime does not yet maintain a truthful internal position model that can be compared directly against this venue snapshot.',
    ),
    healthState: comparisonCoverageItem(
      'unsupported',
      isDriftNativeReadonly && input.snapshotData.truthCoverage.derivativeHealthState.status === 'available'
        ? 'Drift health and margin metrics are visible, but the runtime does not yet persist an internal canonical health model for direct comparison.'
        : 'No internal health-state model is available for direct reconciliation against this venue snapshot.',
    ),
    orderInventory: comparisonCoverageItem(
      'unsupported',
      isDriftNativeReadonly && input.snapshotData.truthCoverage.orderState.status === 'available'
        ? 'Decoded Drift open-order inventory is visible, but the runtime does not yet persist a venue-native open-order model for direct comparison.'
        : 'No venue-native internal open-order inventory is available for direct reconciliation against this venue snapshot.',
    ),
    notes: isDriftNativeReadonly
      ? [
        'Decoded Drift account, position, health, and order sections are operator-visible venue truth.',
        'Current reconciliation directly compares internal execution references when they are available.',
        'Direct internal-versus-external Drift position, health, and order comparisons remain intentionally unsupported until the runtime persists matching canonical internal models.',
      ]
      : connectorDepth === 'generic_rpc_readonly'
        ? [
          'This connector exposes generic read-only truth rather than venue-native Drift decode.',
          'Execution-reference comparison is the only direct real-venue reconciliation path currently available.',
        ]
        : connectorDepth === 'simulation'
          ? [
            'Simulated venue truth is generated internally and is not treated as external reconciliation coverage.',
          ]
          : [
            'This connector depth does not currently expose additional direct reconciliation coverage beyond the recorded truth sections.',
          ],
  };
}

function serialiseMap(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map.entries());
}

function asJsonObject(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function asTreasuryBlockedReasons(value: unknown): TreasuryActionBlockedReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const code = record['code'];
    const category = record['category'];
    const message = record['message'];
    const operatorAction = record['operatorAction'];

    if (
      typeof code !== 'string'
      || typeof category !== 'string'
      || typeof message !== 'string'
      || typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [{
      code: code as TreasuryActionBlockedReason['code'],
      category: category as TreasuryActionBlockedReason['category'],
      message,
      operatorAction,
      details: asJsonObject(record['details']),
    }];
  });
}

function asCarryBlockedReasons(value: unknown): CarryOperationalBlockedReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const code = record['code'];
    const category = record['category'];
    const message = record['message'];
    const operatorAction = record['operatorAction'];

    if (
      typeof code !== 'string'
      || typeof category !== 'string'
      || typeof message !== 'string'
      || typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [{
      code: code as CarryOperationalBlockedReason['code'],
      category: category as CarryOperationalBlockedReason['category'],
      message,
      operatorAction,
      details: asJsonObject(record['details']),
    }];
  });
}

function asBundleRecoveryBlockedReasons(value: unknown): RebalanceBundleRecoveryBlockedReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const code = record['code'];
    const category = record['category'];
    const message = record['message'];
    const operatorAction = record['operatorAction'];

    if (
      typeof code !== 'string'
      || typeof category !== 'string'
      || typeof message !== 'string'
      || typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [{
      code: code as RebalanceBundleRecoveryBlockedReason['code'],
      category: category as RebalanceBundleRecoveryBlockedReason['category'],
      message,
      operatorAction,
      details: asJsonObject(record['details']),
    }];
  });
}

function asBundleResolutionBlockedReasons(value: unknown): RebalanceBundleResolutionBlockedReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const code = record['code'];
    const category = record['category'];
    const message = record['message'];
    const operatorAction = record['operatorAction'];

    if (
      typeof code !== 'string'
      || typeof category !== 'string'
      || typeof message !== 'string'
      || typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [{
      code: code as RebalanceBundleResolutionBlockedReason['code'],
      category: category as RebalanceBundleResolutionBlockedReason['category'],
      message,
      operatorAction,
      details: asJsonObject(record['details']),
    }];
  });
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function asAllocatorRationales(value: unknown): AllocatorRationale[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const code = record['code'];
    const severity = record['severity'];
    const summary = record['summary'];
    if (typeof code !== 'string' || typeof severity !== 'string' || typeof summary !== 'string') {
      return [];
    }

    return [{
      code,
      severity: severity as AllocatorRationale['severity'],
      summary,
      details: asJsonObject(record['details']),
    }];
  });
}

function asRebalanceBlockedReasons(value: unknown): RebalanceBlockedReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const code = record['code'];
    const message = record['message'];
    const operatorAction = record['operatorAction'];
    if (
      typeof code !== 'string'
      || typeof message !== 'string'
      || typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [{
      code: code as RebalanceBlockedReason['code'],
      message,
      operatorAction,
      details: asJsonObject(record['details']),
    }];
  });
}

function buildTreasuryVenueReadinessLabel(input: {
  venueMode: TreasuryVenueView['venueMode'];
  executionSupported: boolean;
  readOnly: boolean;
  approvedForLiveUse: boolean;
  onboardingState: TreasuryVenueView['onboardingState'];
}): string {
  if (input.venueMode === 'simulated') {
    return 'Simulated execution-capable';
  }

  if (input.readOnly) {
    return 'Real read-only';
  }

  if (!input.executionSupported) {
    return 'Execution not implemented';
  }

  if (!input.approvedForLiveUse) {
    return input.onboardingState === 'ready_for_review'
      ? 'Ready for live review'
      : 'Live approval pending';
  }

  return 'Approved for live use';
}

function extractSleeveId(intent: OrderIntent): string {
  const raw = intent.metadata['sleeveId'];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`Order intent "${intent.intentId}" is missing metadata.sleeveId`);
  }
  return raw;
}

function createMismatchStatusCounts(): Record<RuntimeMismatchStatus, number> {
  return {
    open: 0,
    acknowledged: 0,
    recovering: 0,
    resolved: 0,
    verified: 0,
    reopened: 0,
  };
}

function createFindingStatusCounts(): Record<RuntimeReconciliationFindingStatus, number> {
  return {
    active: 0,
    resolved: 0,
  };
}

function createFindingSeverityCounts(): Record<RuntimeReconciliationFindingSeverity, number> {
  return {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
}

function createFindingTypeCounts(): Record<RuntimeReconciliationFindingType, number> {
  return {
    order_state_mismatch: 0,
    position_exposure_mismatch: 0,
    projection_state_mismatch: 0,
    stale_projection_state: 0,
    command_outcome_mismatch: 0,
    missing_venue_truth_snapshot: 0,
    stale_venue_truth_snapshot: 0,
    venue_truth_unavailable: 0,
    venue_truth_partial_coverage: 0,
    venue_execution_reference_mismatch: 0,
    drift_position_mismatch: 0,
    drift_order_inventory_mismatch: 0,
    drift_subaccount_identity_mismatch: 0,
    drift_truth_comparison_gap: 0,
    stale_internal_derivative_state: 0,
  };
}

function isMismatchActionable(
  status: RuntimeMismatchStatus,
  remediationInFlight: boolean,
): boolean {
  if (remediationInFlight) {
    return false;
  }

  return status === 'open'
    || status === 'acknowledged'
    || status === 'recovering'
    || status === 'reopened';
}

function recommendedRemediationsForMismatch(
  mismatch: RuntimeMismatchView,
  latestFinding: RuntimeReconciliationFindingView | null,
): RuntimeRemediationActionType[] {
  const findingType = latestFinding?.findingType ?? null;
  if (
    findingType === 'projection_state_mismatch'
    || findingType === 'stale_projection_state'
    || mismatch.category === 'projection_mismatch'
  ) {
    return ['rebuild_projections'];
  }

  if (
    findingType === 'order_state_mismatch'
    || findingType === 'position_exposure_mismatch'
    || findingType === 'command_outcome_mismatch'
    || mismatch.category === 'execution_state_mismatch'
  ) {
    return ['run_cycle', 'rebuild_projections'];
  }

  return ['run_cycle'];
}

function mapMismatchRow(row: typeof runtimeMismatches.$inferSelect): RuntimeMismatchView {
  return {
    id: row.id,
    dedupeKey: row.dedupeKey,
    category: row.category,
    severity: row.severity,
    sourceKind: row.sourceKind as RuntimeMismatchSourceKind,
    sourceComponent: row.sourceComponent,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    summary: row.summary,
    details: asJsonObject(row.details),
    status: row.status as RuntimeMismatchStatus,
    firstDetectedAt: row.firstDetectedAt.toISOString(),
    lastDetectedAt: row.lastDetectedAt.toISOString(),
    occurrenceCount: row.occurrenceCount,
    acknowledgedAt: toIsoString(row.acknowledgedAt),
    acknowledgedBy: row.acknowledgedBy ?? null,
    recoveryStartedAt: toIsoString(row.recoveryStartedAt),
    recoveryStartedBy: row.recoveryStartedBy ?? null,
    recoverySummary: row.recoverySummary ?? null,
    linkedCommandId: row.linkedCommandId ?? null,
    linkedRecoveryEventId: row.linkedRecoveryEventId ?? null,
    resolvedAt: toIsoString(row.resolvedAt),
    resolvedBy: row.resolvedBy ?? null,
    resolutionSummary: row.resolutionSummary ?? null,
    verifiedAt: toIsoString(row.verifiedAt),
    verifiedBy: row.verifiedBy ?? null,
    verificationSummary: row.verificationSummary ?? null,
    verificationOutcome: row.verificationOutcome as RuntimeVerificationOutcome | null,
    reopenedAt: toIsoString(row.reopenedAt),
    reopenedBy: row.reopenedBy ?? null,
    reopenSummary: row.reopenSummary ?? null,
    lastStatusChangeAt: row.lastStatusChangeAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapReconciliationRunRow(
  row: typeof runtimeReconciliationRuns.$inferSelect,
): RuntimeReconciliationRunView {
  return {
    id: row.id,
    runType: row.runType as RuntimeReconciliationRunType,
    trigger: row.trigger,
    triggerReference: row.triggerReference ?? null,
    sourceComponent: row.sourceComponent,
    triggeredBy: row.triggeredBy ?? null,
    status: row.status as RuntimeReconciliationRunStatus,
    findingCount: row.findingCount,
    linkedMismatchCount: row.linkedMismatchCount,
    summary: asJsonObject(row.summary),
    errorMessage: row.errorMessage ?? null,
    startedAt: row.startedAt.toISOString(),
    completedAt: toIsoString(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapReconciliationFindingRow(
  row: typeof runtimeReconciliationFindings.$inferSelect,
): RuntimeReconciliationFindingView {
  return {
    id: row.id,
    reconciliationRunId: row.reconciliationRunId,
    dedupeKey: row.dedupeKey,
    findingType: row.findingType as RuntimeReconciliationFindingType,
    severity: row.severity as RuntimeReconciliationFindingSeverity,
    status: row.status as RuntimeReconciliationFindingStatus,
    sourceComponent: row.sourceComponent,
    subsystem: row.subsystem,
    venueId: row.venueId ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    mismatchId: row.mismatchId ?? null,
    summary: row.summary,
    expectedState: asJsonObject(row.expectedState),
    actualState: asJsonObject(row.actualState),
    delta: asJsonObject(row.delta),
    details: asJsonObject(row.details),
    detectedAt: row.detectedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRecoveryEventRow(row: typeof runtimeRecoveryEvents.$inferSelect): RuntimeRecoveryEventView {
  return {
    id: row.id,
    mismatchId: row.mismatchId ?? null,
    commandId: row.commandId ?? null,
    runId: row.runId ?? null,
    eventType: row.eventType,
    status: row.status,
    sourceComponent: row.sourceComponent,
    actorId: row.actorId ?? null,
    message: row.message,
    details: asJsonObject(row.details),
    occurredAt: row.occurredAt.toISOString(),
  };
}

function mapTreasurySummaryRow(
  row: typeof treasuryRuns.$inferSelect,
): TreasurySummaryView {
  const summary = asJsonObject(row.summary);
  const reserveStatus = asRecord(summary['reserveStatus']);
  const alerts = Array.isArray(summary['alerts'])
    ? summary['alerts'].filter((value): value is string => typeof value === 'string')
    : [];

  return {
    treasuryRunId: row.treasuryRunId,
    sourceRunId: row.sourceRunId ?? null,
    sleeveId: row.sleeveId,
    simulated: row.simulated,
    policy: row.policy as TreasuryPolicy,
    reserveStatus: {
      totalCapitalUsd: String(reserveStatus['totalCapitalUsd'] ?? row.totalCapitalUsd),
      idleCapitalUsd: String(reserveStatus['idleCapitalUsd'] ?? row.idleCapitalUsd),
      allocatedCapitalUsd: String(reserveStatus['allocatedCapitalUsd'] ?? row.allocatedCapitalUsd),
      requiredReserveUsd: String(reserveStatus['requiredReserveUsd'] ?? row.requiredReserveUsd),
      currentReserveUsd: String(reserveStatus['currentReserveUsd'] ?? row.availableReserveUsd),
      reserveCoveragePct: String(reserveStatus['reserveCoveragePct'] ?? '0'),
      surplusCapitalUsd: String(reserveStatus['surplusCapitalUsd'] ?? row.surplusCapitalUsd),
      reserveShortfallUsd: String(reserveStatus['reserveShortfallUsd'] ?? row.reserveShortfallUsd),
    },
    actionCount: row.actionCount,
    alerts,
    concentrationLimitBreached: row.concentrationLimitBreached,
    evaluatedAt: row.evaluatedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTreasuryAllocationRow(
  row: typeof treasuryVenueSnapshots.$inferSelect,
): TreasuryAllocationView {
  return {
    treasuryRunId: row.treasuryRunId,
    venueId: row.venueId,
    venueName: row.venueName,
    venueMode: row.venueMode as TreasuryAllocationView['venueMode'],
    liquidityTier: row.liquidityTier as TreasuryAllocationView['liquidityTier'],
    healthy: row.healthy,
    aprBps: row.aprBps,
    currentAllocationUsd: row.currentAllocationUsd,
    withdrawalAvailableUsd: row.withdrawalAvailableUsd,
    availableCapacityUsd: row.availableCapacityUsd,
    concentrationPct: row.concentrationPct,
    updatedAt: row.updatedAt.toISOString(),
    metadata: asJsonObject(row.metadata),
  };
}

function mapTreasuryVenueRow(
  row: typeof treasuryVenueSnapshots.$inferSelect,
): TreasuryVenueView {
  const metadata = asJsonObject(row.metadata);
  const executionSupported = metadata['executionSupported'] === true;
  const supportsAllocation = metadata['supportsAllocation'] === true;
  const supportsReduction = metadata['supportsReduction'] === true;
  const readOnly = metadata['readOnly'] === true;
  const approvedForLiveUse = metadata['approvedForLiveUse'] === true;
  const onboardingState = typeof metadata['onboardingState'] === 'string'
    ? metadata['onboardingState'] as TreasuryVenueView['onboardingState']
    : row.venueMode === 'simulated'
      ? 'simulated'
      : readOnly
        ? 'read_only'
        : approvedForLiveUse
          ? 'approved_for_live'
          : 'ready_for_review';

  return {
    venueId: row.venueId,
    venueName: row.venueName,
    venueMode: row.venueMode as TreasuryVenueView['venueMode'],
    liquidityTier: row.liquidityTier as TreasuryVenueView['liquidityTier'],
    healthy: row.healthy,
    aprBps: row.aprBps,
    currentAllocationUsd: row.currentAllocationUsd,
    withdrawalAvailableUsd: row.withdrawalAvailableUsd,
    availableCapacityUsd: row.availableCapacityUsd,
    concentrationPct: row.concentrationPct,
    executionSupported,
    supportsAllocation,
    supportsReduction,
    readOnly,
    approvedForLiveUse,
    onboardingState,
    missingPrerequisites: asStringArray(metadata['missingPrerequisites']),
    readinessLabel: buildTreasuryVenueReadinessLabel({
      venueMode: row.venueMode as TreasuryVenueView['venueMode'],
      executionSupported,
      readOnly,
      approvedForLiveUse,
      onboardingState,
    }),
    simulationState: row.venueMode === 'simulated' ? 'simulated' : 'real',
    lastSnapshotAt: row.updatedAt.toISOString(),
    metadata,
  };
}

function mapTreasuryActionRow(
  row: typeof treasuryActions.$inferSelect,
): TreasuryActionView {
  return {
    id: row.id,
    treasuryRunId: row.treasuryRunId,
    linkedRebalanceProposalId: row.linkedRebalanceProposalId ?? null,
    actionType: row.actionType as TreasuryActionView['actionType'],
    status: row.status as TreasuryActionView['status'],
    readiness: row.readiness as TreasuryActionView['readiness'],
    executable: row.executable,
    blockedReasons: asTreasuryBlockedReasons(row.blockedReasons),
    approvalRequirement: row.approvalRequirement as TreasuryActionView['approvalRequirement'],
    venueId: row.venueId ?? null,
    venueName: row.venueName ?? null,
    venueMode: row.venueMode as TreasuryActionView['venueMode'],
    amountUsd: row.amountUsd,
    reasonCode: row.reasonCode,
    summary: row.summary,
    details: asJsonObject(row.details),
    actorId: row.actorId ?? null,
    approvedBy: row.approvedBy ?? null,
    approvedAt: toIsoString(row.approvedAt),
    executionRequestedBy: row.executionRequestedBy ?? null,
    executionRequestedAt: toIsoString(row.executionRequestedAt),
    linkedCommandId: row.linkedCommandId ?? null,
    latestExecutionId: row.latestExecutionId ?? null,
    simulated: row.simulated,
    executionMode: row.executionMode as TreasuryActionView['executionMode'],
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTreasuryExecutionRow(
  row: typeof treasuryActionExecutions.$inferSelect,
): TreasuryExecutionView {
  return {
    id: row.id,
    treasuryActionId: row.treasuryActionId,
    treasuryRunId: row.treasuryRunId,
    commandId: row.commandId ?? null,
    status: row.status as TreasuryExecutionView['status'],
    executionMode: row.executionMode as TreasuryExecutionView['executionMode'],
    venueMode: row.venueMode as TreasuryExecutionView['venueMode'],
    simulated: row.simulated,
    requestedBy: row.requestedBy,
    startedBy: row.startedBy ?? null,
    blockedReasons: asTreasuryBlockedReasons(row.blockedReasons),
    outcomeSummary: row.outcomeSummary ?? null,
    outcome: asJsonObject(row.outcome),
    venueExecutionReference: row.venueExecutionReference ?? null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAllocatorSummaryRow(row: typeof allocatorRuns.$inferSelect): AllocatorSummaryView {
  const summary = asJsonObject(row.summary);
  return {
    allocatorRunId: row.allocatorRunId,
    sourceRunId: row.sourceRunId ?? null,
    trigger: row.trigger,
    triggeredBy: row.triggeredBy ?? null,
    regimeState: row.regimeState as AllocatorSummaryView['regimeState'],
    pressureLevel: row.pressureLevel as AllocatorSummaryView['pressureLevel'],
    totalCapitalUsd: row.totalCapitalUsd,
    reserveConstrainedCapitalUsd: row.reserveConstrainedCapitalUsd,
    allocatableCapitalUsd: row.allocatableCapitalUsd,
    carryTargetPct: Number(summary['carryTargetPct'] ?? 0),
    treasuryTargetPct: Number(summary['treasuryTargetPct'] ?? 0),
    recommendationCount: row.recommendationCount,
    evaluatedAt: row.evaluatedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCarryVenueRow(
  row: typeof carryVenueSnapshots.$inferSelect,
): CarryVenueView {
  return {
    strategyRunId: row.strategyRunId,
    venueId: row.venueId,
    venueMode: row.venueMode as CarryVenueView['venueMode'],
    executionSupported: row.executionSupported,
    supportsIncreaseExposure: row.supportsIncreaseExposure,
    supportsReduceExposure: row.supportsReduceExposure,
    readOnly: row.readOnly,
    approvedForLiveUse: row.approvedForLiveUse,
    healthy: row.healthy,
    onboardingState: row.onboardingState as CarryVenueView['onboardingState'],
    missingPrerequisites: Array.isArray(row.missingPrerequisites) ? row.missingPrerequisites as string[] : [],
    metadata: asJsonObject(row.metadata),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapVenueSnapshotRow(
  row: typeof venueConnectorSnapshots.$inferSelect,
): VenueSnapshotView {
  const snapshotData = deserialiseVenueSnapshotPayload(
    row.snapshotPayload,
    row.connectorType,
    row.truthMode as VenueTruthMode,
  );

  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    connectorType: row.connectorType,
    sleeveApplicability: asStringArray(row.sleeveApplicability) as VenueTruthSleeve[],
    truthMode: row.truthMode as VenueTruthMode,
    readOnlySupport: row.readOnlySupport,
    executionSupport: row.executionSupport,
    approvedForLiveUse: row.approvedForLiveUse,
    onboardingState: row.onboardingState as VenueOnboardingState,
    missingPrerequisites: asStringArray(row.missingPrerequisites),
    authRequirementsSummary: asStringArray(row.authRequirementsSummary),
    healthy: row.healthy,
    healthState: row.healthState as VenueHealthState,
    degradedReason: row.degradedReason ?? null,
    truthProfile: deriveVenueTruthProfile(snapshotData),
    snapshotType: row.snapshotType,
    snapshotSuccessful: row.snapshotSuccessful,
    snapshotSummary: row.snapshotSummary,
    snapshotPayload: snapshotData.rawPayload,
    errorMessage: row.errorMessage ?? null,
    capturedAt: row.capturedAt.toISOString(),
    snapshotCompleteness: snapshotData.snapshotCompleteness,
    truthCoverage: snapshotData.truthCoverage,
    comparisonCoverage: deriveVenueTruthComparisonCoverage({
      connectorType: row.connectorType,
      truthMode: row.truthMode as VenueTruthMode,
      executionSupport: row.executionSupport,
      snapshotData,
    }),
    sourceMetadata: snapshotData.sourceMetadata,
    accountState: snapshotData.accountState,
    balanceState: snapshotData.balanceState,
    capacityState: snapshotData.capacityState,
    exposureState: snapshotData.exposureState,
    derivativeAccountState: snapshotData.derivativeAccountState,
    derivativePositionState: snapshotData.derivativePositionState,
    derivativeHealthState: snapshotData.derivativeHealthState,
    orderState: snapshotData.orderState,
    executionReferenceState: snapshotData.executionReferenceState,
    metadata: asJsonObject(row.metadata),
  };
}

function mapVenueInventoryItem(
  latest: typeof venueConnectorSnapshots.$inferSelect,
  lastSuccessfulSnapshotAt: Date | null,
): VenueInventoryItemView {
  const snapshotData = deserialiseVenueSnapshotPayload(
    latest.snapshotPayload,
    latest.connectorType,
    latest.truthMode as VenueTruthMode,
  );

  return {
    venueId: latest.venueId,
    venueName: latest.venueName,
    connectorType: latest.connectorType,
    sleeveApplicability: asStringArray(latest.sleeveApplicability) as VenueTruthSleeve[],
    truthMode: latest.truthMode as VenueTruthMode,
    readOnlySupport: latest.readOnlySupport,
    executionSupport: latest.executionSupport,
    approvedForLiveUse: latest.approvedForLiveUse,
    onboardingState: latest.onboardingState as VenueOnboardingState,
    missingPrerequisites: asStringArray(latest.missingPrerequisites),
    authRequirementsSummary: asStringArray(latest.authRequirementsSummary),
    healthy: latest.healthy,
    healthState: latest.healthState as VenueHealthState,
    degradedReason: latest.degradedReason ?? null,
    truthProfile: deriveVenueTruthProfile(snapshotData),
    latestSnapshotType: latest.snapshotType,
    latestSnapshotSummary: latest.snapshotSummary,
    latestErrorMessage: latest.errorMessage ?? null,
    snapshotFreshness: classifyVenueSnapshotFreshness(latest.capturedAt),
    snapshotCompleteness: snapshotData.snapshotCompleteness,
    lastSnapshotAt: latest.capturedAt.toISOString(),
    lastSuccessfulSnapshotAt: lastSuccessfulSnapshotAt?.toISOString() ?? null,
    truthCoverage: snapshotData.truthCoverage,
    comparisonCoverage: deriveVenueTruthComparisonCoverage({
      connectorType: latest.connectorType,
      truthMode: latest.truthMode as VenueTruthMode,
      executionSupport: latest.executionSupport,
      snapshotData,
    }),
    sourceMetadata: snapshotData.sourceMetadata,
    metadata: asJsonObject(latest.metadata),
  };
}

function mapCarryActionRow(
  row: typeof carryActions.$inferSelect,
): CarryActionView {
  return {
    id: row.id,
    strategyRunId: row.strategyRunId ?? null,
    linkedRebalanceProposalId: row.linkedRebalanceProposalId ?? null,
    actionType: row.actionType as CarryActionView['actionType'],
    status: row.status as CarryActionView['status'],
    sourceKind: row.sourceKind as CarryActionView['sourceKind'],
    sourceReference: row.sourceReference ?? null,
    opportunityId: row.opportunityId ?? null,
    asset: row.asset ?? null,
    summary: row.summary,
    notionalUsd: row.notionalUsd,
    details: asJsonObject(row.details),
    readiness: row.readiness as CarryActionView['readiness'],
    executable: row.executable,
    blockedReasons: asCarryBlockedReasons(row.blockedReasons),
    approvalRequirement: row.approvalRequirement as CarryActionView['approvalRequirement'],
    executionMode: row.executionMode as CarryActionView['executionMode'],
    simulated: row.simulated,
    executionPlan: asJsonObject(row.executionPlan),
    approvedBy: row.approvedBy ?? null,
    approvedAt: toIsoString(row.approvedAt),
    executionRequestedBy: row.executionRequestedBy ?? null,
    executionRequestedAt: toIsoString(row.executionRequestedAt),
    queuedAt: toIsoString(row.queuedAt),
    executingAt: toIsoString(row.executingAt),
    completedAt: toIsoString(row.completedAt),
    failedAt: toIsoString(row.failedAt),
    cancelledAt: toIsoString(row.cancelledAt),
    linkedCommandId: row.linkedCommandId ?? null,
    latestExecutionId: row.latestExecutionId ?? null,
    lastError: row.lastError ?? null,
    actorId: row.actorId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCarryPlannedOrderRow(
  row: typeof carryActionOrderIntents.$inferSelect,
): CarryActionPlannedOrderView {
  return {
    id: row.id,
    carryActionId: row.carryActionId,
    intentId: row.intentId,
    venueId: row.venueId,
    asset: row.asset,
    side: row.side as CarryActionPlannedOrderView['side'],
    orderType: row.orderType as CarryActionPlannedOrderView['orderType'],
    requestedSize: row.requestedSize,
    requestedPrice: row.requestedPrice ?? null,
    reduceOnly: row.reduceOnly,
    metadata: asJsonObject(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCarryExecutionRow(
  row: typeof carryActionExecutions.$inferSelect,
): CarryExecutionView {
  return {
    id: row.id,
    carryActionId: row.carryActionId,
    strategyRunId: row.strategyRunId ?? null,
    commandId: row.commandId ?? null,
    status: row.status as CarryExecutionView['status'],
    executionMode: row.executionMode as CarryExecutionView['executionMode'],
    simulated: row.simulated,
    requestedBy: row.requestedBy,
    startedBy: row.startedBy ?? null,
    blockedReasons: asCarryBlockedReasons(row.blockedReasons),
    outcomeSummary: row.outcomeSummary ?? null,
    outcome: asJsonObject(row.outcome),
    venueExecutionReference: row.venueExecutionReference ?? null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCarryExecutionStepRow(
  row: typeof carryExecutionSteps.$inferSelect,
): CarryExecutionStepView {
  return {
    id: row.id,
    carryExecutionId: row.carryExecutionId,
    carryActionId: row.carryActionId,
    strategyRunId: row.strategyRunId ?? null,
    plannedOrderId: row.plannedOrderId ?? null,
    intentId: row.intentId,
    venueId: row.venueId,
    venueMode: row.venueMode as CarryExecutionStepView['venueMode'],
    executionSupported: row.executionSupported,
    readOnly: row.readOnly,
    approvedForLiveUse: row.approvedForLiveUse,
    onboardingState: row.onboardingState as CarryExecutionStepView['onboardingState'],
    asset: row.asset,
    side: row.side as CarryExecutionStepView['side'],
    orderType: row.orderType as CarryExecutionStepView['orderType'],
    requestedSize: row.requestedSize,
    requestedPrice: row.requestedPrice ?? null,
    reduceOnly: row.reduceOnly,
    clientOrderId: row.clientOrderId ?? null,
    venueOrderId: row.venueOrderId ?? null,
    executionReference: row.executionReference ?? null,
    status: row.status,
    simulated: row.simulated,
    filledSize: row.filledSize ?? null,
    averageFillPrice: row.averageFillPrice ?? null,
    outcomeSummary: row.outcomeSummary ?? null,
    outcome: asJsonObject(row.outcome),
    lastError: row.lastError ?? null,
    metadata: asJsonObject(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: toIsoString(row.completedAt),
  };
}

function mapAllocatorRunRow(row: typeof allocatorRuns.$inferSelect): AllocatorRunView {
  return {
    allocatorRunId: row.allocatorRunId,
    sourceRunId: row.sourceRunId ?? null,
    trigger: row.trigger,
    triggeredBy: row.triggeredBy ?? null,
    regimeState: row.regimeState as AllocatorRunView['regimeState'],
    pressureLevel: row.pressureLevel as AllocatorRunView['pressureLevel'],
    totalCapitalUsd: row.totalCapitalUsd,
    reserveConstrainedCapitalUsd: row.reserveConstrainedCapitalUsd,
    allocatableCapitalUsd: row.allocatableCapitalUsd,
    recommendationCount: row.recommendationCount,
    rationale: asAllocatorRationales(row.rationale),
    constraints: Array.isArray(row.constraints) ? row.constraints as AllocatorRunView['constraints'] : [],
    inputSnapshot: asJsonObject(row.inputSnapshot),
    policySnapshot: asJsonObject(row.policySnapshot),
    evaluatedAt: row.evaluatedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAllocatorTargetRow(
  row: typeof allocatorSleeveTargets.$inferSelect,
): AllocatorSleeveTargetView {
  return {
    allocatorRunId: row.allocatorRunId,
    sleeveId: row.sleeveId as AllocatorSleeveTargetView['sleeveId'],
    sleeveKind: row.sleeveKind as AllocatorSleeveTargetView['sleeveKind'],
    sleeveName: row.sleeveName,
    status: row.status,
    throttleState: row.throttleState,
    currentAllocationUsd: row.currentAllocationUsd,
    currentAllocationPct: Number(row.currentAllocationPct),
    targetAllocationUsd: row.targetAllocationUsd,
    targetAllocationPct: Number(row.targetAllocationPct),
    minAllocationPct: Number(row.minAllocationPct),
    maxAllocationPct: Number(row.maxAllocationPct),
    deltaUsd: row.deltaUsd,
    opportunityScore: row.opportunityScore === null ? null : Number(row.opportunityScore),
    capacityUsd: row.capacityUsd ?? null,
    rationale: asAllocatorRationales(row.rationale),
    metadata: asJsonObject(row.metadata),
  };
}

function mapAllocatorRecommendationRow(
  row: typeof allocatorRecommendations.$inferSelect,
): AllocatorRecommendationView {
  return {
    id: row.id,
    allocatorRunId: row.allocatorRunId,
    sleeveId: row.sleeveId as AllocatorRecommendationView['sleeveId'],
    recommendationType: row.recommendationType,
    priority: row.priority as AllocatorRecommendationView['priority'],
    summary: row.summary,
    details: asJsonObject(row.details),
    rationale: asAllocatorRationales(row.rationale),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapRebalanceProposalRow(
  row: typeof allocatorRebalanceProposals.$inferSelect,
): RebalanceProposalView {
  return {
    id: row.id,
    allocatorRunId: row.allocatorRunId,
    actionType: row.actionType as RebalanceProposalView['actionType'],
    status: row.status as RebalanceProposalView['status'],
    summary: row.summary,
    executionMode: row.executionMode as RebalanceProposalView['executionMode'],
    simulated: row.simulated,
    executable: row.executable,
    approvalRequirement: row.approvalRequirement as RebalanceProposalView['approvalRequirement'],
    rationale: asAllocatorRationales(row.rationale),
    blockedReasons: asRebalanceBlockedReasons(row.blockedReasons),
    details: asJsonObject(row.details),
    approvedBy: row.approvedBy ?? null,
    approvedAt: toIsoString(row.approvedAt),
    rejectedBy: row.rejectedBy ?? null,
    rejectedAt: toIsoString(row.rejectedAt),
    rejectionReason: row.rejectionReason ?? null,
    linkedCommandId: row.linkedCommandId ?? null,
    latestExecutionId: row.latestExecutionId ?? null,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceIntentRow(
  row: typeof allocatorRebalanceProposalIntents.$inferSelect,
): RebalanceProposalIntentView {
  return {
    id: row.id,
    proposalId: row.proposalId,
    sleeveId: row.sleeveId as RebalanceProposalIntentView['sleeveId'],
    sourceSleeveId: row.sourceSleeveId as RebalanceProposalIntentView['sourceSleeveId'],
    targetSleeveId: row.targetSleeveId as RebalanceProposalIntentView['targetSleeveId'],
    actionType: row.actionType as RebalanceProposalIntentView['actionType'],
    status: row.status as RebalanceProposalIntentView['status'],
    readiness: row.readiness as RebalanceProposalIntentView['readiness'],
    executable: row.executable,
    currentAllocationUsd: row.currentAllocationUsd,
    currentAllocationPct: Number(row.currentAllocationPct),
    targetAllocationUsd: row.targetAllocationUsd,
    targetAllocationPct: Number(row.targetAllocationPct),
    deltaUsd: row.deltaUsd,
    rationale: asAllocatorRationales(row.rationale),
    blockedReasons: asRebalanceBlockedReasons(row.blockedReasons),
    details: asJsonObject(row.details),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceExecutionRow(
  row: typeof allocatorRebalanceExecutions.$inferSelect,
): RebalanceExecutionView {
  return {
    id: row.id,
    proposalId: row.proposalId,
    commandId: row.commandId ?? null,
    status: row.status as RebalanceExecutionView['status'],
    executionMode: row.executionMode as RebalanceExecutionView['executionMode'],
    simulated: row.simulated,
    requestedBy: row.requestedBy,
    startedBy: row.startedBy ?? null,
    outcomeSummary: row.outcomeSummary ?? null,
    outcome: asJsonObject(row.outcome),
    lastError: row.lastError ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceCurrentRow(
  row: typeof allocatorRebalanceCurrent.$inferSelect,
): RebalanceCurrentView {
  return {
    allocatorRunId: row.allocatorRunId,
    latestProposalId: row.latestProposalId ?? null,
    carryTargetAllocationUsd: row.carryTargetAllocationUsd,
    carryTargetAllocationPct: Number(row.carryTargetAllocationPct),
    treasuryTargetAllocationUsd: row.treasuryTargetAllocationUsd,
    treasuryTargetAllocationPct: Number(row.treasuryTargetAllocationPct),
    appliedAt: row.appliedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceBundleRow(
  row: typeof allocatorRebalanceBundles.$inferSelect,
  proposal: RebalanceProposalView,
): RebalanceBundleView {
  return {
    id: row.id,
    proposalId: row.proposalId,
    allocatorRunId: proposal.allocatorRunId,
    proposalStatus: proposal.status,
    status: row.status as RebalanceBundleStatus,
    completionState: row.completionState as RebalanceBundleCompletionState,
    outcomeClassification: row.outcomeClassification as RebalanceBundleOutcomeClassification,
    interventionRecommendation: row.interventionRecommendation as RebalanceBundleInterventionRecommendation,
    totalChildCount: row.totalChildCount,
    blockedChildCount: row.blockedChildCount,
    failedChildCount: row.failedChildCount,
    completedChildCount: row.completedChildCount,
    pendingChildCount: row.pendingChildCount,
    childRollup: asJsonObject(row.childRollup),
    finalizationReason: row.finalizationReason ?? null,
    finalizedAt: toIsoString(row.finalizedAt),
    resolutionState: row.resolutionState as RebalanceBundleResolutionState,
    latestResolutionActionId: row.latestResolutionActionId ?? null,
    resolutionSummary: row.resolutionSummary ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolvedAt: toIsoString(row.resolvedAt),
    latestEscalationId: row.latestEscalationId ?? null,
    escalationStatus: row.escalationStatus as RebalanceBundleEscalationStatus | null,
    escalationOwnerId: row.escalationOwnerId ?? null,
    escalationAssignedAt: toIsoString(row.escalationAssignedAt),
    escalationDueAt: toIsoString(row.escalationDueAt),
    escalationSummary: row.escalationSummary ?? null,
    executionMode: proposal.executionMode,
    simulated: proposal.simulated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceBundleRecoveryActionRow(
  row: typeof allocatorRebalanceBundleRecoveryActions.$inferSelect,
): RebalanceBundleRecoveryActionView {
  return {
    id: row.id,
    bundleId: row.bundleId,
    proposalId: row.proposalId,
    recoveryActionType: row.recoveryActionType as RebalanceBundleRecoveryActionType,
    targetChildType: row.targetChildType as RebalanceBundleRecoveryActionView['targetChildType'],
    targetChildId: row.targetChildId,
    targetChildStatus: row.targetChildStatus,
    targetChildSummary: row.targetChildSummary,
    eligibilityState: row.eligibilityState as RebalanceBundleRecoveryEligibilityState,
    blockedReasons: asBundleRecoveryBlockedReasons(row.blockedReasons),
    approvalRequirement: row.approvalRequirement as RebalanceBundleRecoveryActionView['approvalRequirement'],
    status: row.status as RebalanceBundleRecoveryStatus,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    note: row.note ?? null,
    linkedCommandId: row.linkedCommandId ?? null,
    targetCommandType: row.targetCommandType as RebalanceBundleRecoveryActionView['targetCommandType'],
    linkedCarryActionId: row.linkedCarryActionId ?? null,
    linkedTreasuryActionId: row.linkedTreasuryActionId ?? null,
    outcomeSummary: row.outcomeSummary ?? null,
    outcome: asJsonObject(row.outcome),
    lastError: row.lastError ?? null,
    executionMode: row.executionMode as RebalanceBundleRecoveryActionView['executionMode'],
    simulated: row.simulated,
    queuedAt: toIsoString(row.queuedAt),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceBundleResolutionActionRow(
  row: typeof allocatorRebalanceBundleResolutionActions.$inferSelect,
): RebalanceBundleResolutionActionView {
  return {
    id: row.id,
    bundleId: row.bundleId,
    proposalId: row.proposalId,
    resolutionActionType: row.resolutionActionType as RebalanceBundleResolutionActionType,
    status: row.status as RebalanceBundleResolutionActionStatus,
    resolutionState: row.resolutionState as RebalanceBundleResolutionState,
    note: row.note,
    acknowledgedPartialApplication: row.acknowledgedPartialApplication,
    escalated: row.escalated,
    affectedChildSummary: asJsonObject(row.affectedChildSummary),
    linkedRecoveryActionIds: asStringArray(row.linkedRecoveryActionIds),
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    completedBy: row.completedBy ?? null,
    completedAt: toIsoString(row.completedAt),
    outcomeSummary: row.outcomeSummary ?? null,
    blockedReasons: asBundleResolutionBlockedReasons(row.blockedReasons),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceBundleEscalationRow(
  row: typeof allocatorRebalanceBundleEscalations.$inferSelect,
): RebalanceBundleEscalationView {
  return {
    id: row.id,
    bundleId: row.bundleId,
    proposalId: row.proposalId,
    sourceResolutionActionId: row.sourceResolutionActionId ?? null,
    status: row.status as RebalanceBundleEscalationStatus,
    isOpen: row.status !== 'resolved',
    ownerId: row.ownerId ?? null,
    assignedBy: row.assignedBy ?? null,
    assignedAt: toIsoString(row.assignedAt),
    acknowledgedBy: row.acknowledgedBy ?? null,
    acknowledgedAt: toIsoString(row.acknowledgedAt),
    dueAt: toIsoString(row.dueAt),
    handoffNote: row.handoffNote ?? null,
    reviewNote: row.reviewNote ?? null,
    resolutionNote: row.resolutionNote ?? null,
    closedBy: row.closedBy ?? null,
    closedAt: toIsoString(row.closedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRebalanceBundleEscalationEventRow(
  row: typeof allocatorRebalanceBundleEscalationEvents.$inferSelect,
): RebalanceBundleEscalationEventView {
  return {
    id: row.id,
    escalationId: row.escalationId,
    bundleId: row.bundleId,
    proposalId: row.proposalId,
    eventType: row.eventType as RebalanceBundleEscalationEventView['eventType'],
    fromStatus: row.fromStatus as RebalanceBundleEscalationStatus | null,
    toStatus: row.toStatus as RebalanceBundleEscalationStatus,
    actorId: row.actorId,
    ownerId: row.ownerId ?? null,
    note: row.note ?? null,
    dueAt: toIsoString(row.dueAt),
    createdAt: row.createdAt.toISOString(),
  };
}

function deriveEscalationQueueState(input: {
  status: RebalanceBundleEscalationStatus;
  ownerId: string | null;
  dueAt: string | null;
  now: Date;
}): RebalanceEscalationQueueState {
  if (input.status === 'resolved') {
    return 'resolved';
  }
  if (input.ownerId === null) {
    return 'unassigned';
  }
  if (input.dueAt !== null) {
    const dueAt = new Date(input.dueAt).getTime();
    const now = input.now.getTime();
    if (dueAt < now) {
      return 'overdue';
    }
    if (dueAt - now <= 24 * 60 * 60 * 1000) {
      return 'due_soon';
    }
  }

  return 'on_track';
}

function sortEscalationQueueItems(
  items: RebalanceEscalationQueueItemView[],
  sortBy: NonNullable<RebalanceEscalationQueueFilters['sortBy']>,
  sortDirection: NonNullable<RebalanceEscalationQueueFilters['sortDirection']>,
): RebalanceEscalationQueueItemView[] {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const toTime = (value: string | null): number => {
    if (value === null) {
      return sortDirection === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }

    return new Date(value).getTime();
  };

  return [...items].sort((left, right) => {
    let comparison = 0;
    switch (sortBy) {
      case 'due_at':
        comparison = toTime(left.dueAt) - toTime(right.dueAt);
        break;
      case 'created_at':
        comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        break;
      case 'updated_at':
        comparison = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
        break;
      case 'latest_activity':
      default:
        comparison = new Date(left.latestActivityAt).getTime() - new Date(right.latestActivityAt).getTime();
        break;
    }

    if (comparison !== 0) {
      return comparison * direction;
    }

    return left.escalationId.localeCompare(right.escalationId) * direction;
  });
}

function summariseRebalanceDownstreamRollup(input: {
  actionCount: number;
  executionCount: number;
  blockedCount: number;
  failureCount: number;
  completedCount: number;
  simulated: boolean;
  live: boolean;
  references: string[];
}): RebalanceDownstreamStatusRollupView {
  let status: RebalanceDownstreamStatusRollupView['status'] = 'idle';
  if (input.blockedCount > 0) {
    status = 'blocked';
  } else if (input.failureCount > 0) {
    status = 'failed';
  } else if (input.executionCount === 0 && input.actionCount > 0) {
    status = 'pending';
  } else if (input.executionCount > 0 && input.completedCount < input.executionCount) {
    status = 'in_progress';
  } else if (input.executionCount > 0 && input.completedCount === input.executionCount) {
    status = 'completed';
  }

  const summary = input.actionCount === 0
    ? 'No downstream actions were persisted.'
    : `${input.actionCount} actions and ${input.executionCount} executions recorded.`;

  return {
    status,
    actionCount: input.actionCount,
    executionCount: input.executionCount,
    blockedCount: input.blockedCount,
    failureCount: input.failureCount,
    completedCount: input.completedCount,
    simulated: input.simulated,
    live: input.live,
    references: Array.from(new Set(input.references.filter((value) => value.length > 0))),
    summary,
  };
}

function deriveBundleChildState(
  action:
    | RebalanceCarryActionNodeView['action']
    | RebalanceTreasuryActionNodeView['action'],
  executions: Array<CarryExecutionView | TreasuryExecutionView>,
): 'blocked' | 'failed' | 'completed' | 'pending' | 'executing' {
  if (executions.some((execution) => execution.status === 'failed')) {
    return 'failed';
  }

  if (executions.length > 0) {
    if (executions.every((execution) => execution.status === 'completed')) {
      return 'completed';
    }

    return 'executing';
  }

  if (action.status === 'failed') {
    return 'failed';
  }

  if (action.status === 'completed') {
    return 'completed';
  }

  if (!action.executable || action.blockedReasons.length > 0) {
    return 'blocked';
  }

  if (action.status === 'executing' || action.status === 'queued' || action.status === 'approved') {
    return 'executing';
  }

  return 'pending';
}

function deriveRebalanceBundleSnapshot(
  graph: RebalanceExecutionGraphView,
): {
  status: RebalanceBundleStatus;
  completionState: RebalanceBundleCompletionState;
  outcomeClassification: RebalanceBundleOutcomeClassification;
  interventionRecommendation: RebalanceBundleInterventionRecommendation;
  totalChildCount: number;
  blockedChildCount: number;
  failedChildCount: number;
  completedChildCount: number;
  pendingChildCount: number;
  childRollup: Record<string, unknown>;
  finalizationReason: string | null;
  finalizedAt: string | null;
} {
  const carryChildStates = graph.downstream.carry.actions.map((node) =>
    deriveBundleChildState(node.action, node.executions)
  );
  const treasuryChildStates = graph.downstream.treasury.actions.map((node) =>
    deriveBundleChildState(node.action, node.executions)
  );
  const childStates = [...carryChildStates, ...treasuryChildStates];

  const totalChildCount = childStates.length;
  const blockedChildCount = childStates.filter((state) => state === 'blocked').length;
  const failedChildCount = childStates.filter((state) => state === 'failed').length;
  const completedChildCount = childStates.filter((state) => state === 'completed').length;
  const pendingChildCount = childStates.filter((state) => state === 'pending' || state === 'executing').length;
  const hasCompletedChildren = completedChildCount > 0;
  const hasPendingChildren = pendingChildCount > 0;
  const hasFailedChildren = failedChildCount > 0;
  const hasBlockedChildren = blockedChildCount > 0;
  const proposal = graph.detail.proposal;

  let status: RebalanceBundleStatus = 'proposed';
  let completionState: RebalanceBundleCompletionState = 'open';
  let outcomeClassification: RebalanceBundleOutcomeClassification = 'pending';
  let interventionRecommendation: RebalanceBundleInterventionRecommendation = 'operator_review_required';
  let finalizationReason: string | null = null;

  if (proposal.status === 'rejected') {
    status = 'rejected';
    completionState = 'finalized';
    outcomeClassification = 'rejected';
    interventionRecommendation = 'no_action_needed';
    finalizationReason = proposal.rejectionReason ?? 'Proposal was rejected before coordinated execution.';
  } else if (proposal.status === 'proposed' || proposal.status === 'approved' || proposal.status === 'queued') {
    status = proposal.status === 'queued' ? 'queued' : 'proposed';
    completionState = 'open';
    outcomeClassification = 'pending';
    interventionRecommendation = proposal.status === 'queued'
      ? 'wait_for_inflight_children'
      : 'operator_review_required';
  } else if (proposal.status === 'executing' || hasPendingChildren) {
    status = 'executing';
    completionState = 'open';
    outcomeClassification = hasCompletedChildren ? 'partial_application' : 'pending';
    interventionRecommendation = 'wait_for_inflight_children';
  } else if (hasFailedChildren && hasCompletedChildren) {
    status = 'requires_intervention';
    completionState = 'finalized';
    outcomeClassification = 'partial_application';
    interventionRecommendation = 'inspect_child_failures';
    finalizationReason = 'At least one downstream child completed and at least one failed.';
  } else if (hasBlockedChildren && hasCompletedChildren) {
    status = 'requires_intervention';
    completionState = 'finalized';
    outcomeClassification = 'partial_application';
    interventionRecommendation = 'unresolved_partial_application';
    finalizationReason = 'At least one downstream child completed and at least one remains blocked.';
  } else if (hasFailedChildren) {
    status = 'failed';
    completionState = 'finalized';
    outcomeClassification = 'failed';
    interventionRecommendation = 'inspect_child_failures';
    finalizationReason = 'At least one downstream child failed and no child completed successfully.';
  } else if (hasBlockedChildren) {
    status = 'blocked';
    completionState = 'finalized';
    outcomeClassification = 'blocked';
    interventionRecommendation = 'operator_review_required';
    finalizationReason = 'At least one downstream child remained blocked.';
  } else if (hasCompletedChildren && completedChildCount < totalChildCount) {
    status = 'partially_completed';
    completionState = 'finalized';
    outcomeClassification = 'partial_application';
    interventionRecommendation = 'unresolved_partial_application';
    finalizationReason = 'The rebalance finished with only a subset of downstream children completed.';
  } else if (proposal.status === 'failed') {
    status = hasCompletedChildren ? 'requires_intervention' : 'failed';
    completionState = 'finalized';
    outcomeClassification = hasCompletedChildren ? 'partial_application' : 'failed';
    interventionRecommendation = hasCompletedChildren
      ? 'unresolved_partial_application'
      : 'inspect_child_failures';
    finalizationReason = proposal.lastError ?? 'Rebalance execution failed.';
  } else if (proposal.status === 'completed') {
    status = completedChildCount > 0 || totalChildCount === 0 ? 'completed' : 'partially_completed';
    completionState = 'finalized';
    outcomeClassification = 'safe_complete';
    interventionRecommendation = 'no_action_needed';
    finalizationReason = 'All downstream work recorded for the rebalance bundle completed successfully.';
  }

  const terminalTimestamp = graph.timeline
    .filter((entry) =>
      entry.scope !== 'recovery_action'
      && (entry.status === 'completed' || entry.status === 'failed' || entry.status === 'rejected')
    )
    .map((entry) => entry.at)
    .sort()
    .at(-1) ?? null;

  return {
    status,
    completionState,
    outcomeClassification,
    interventionRecommendation,
    totalChildCount,
    blockedChildCount,
    failedChildCount,
    completedChildCount,
    pendingChildCount,
    childRollup: {
      carry: {
        status: graph.downstream.carry.rollup.status,
        actionCount: graph.downstream.carry.rollup.actionCount,
        executionCount: graph.downstream.carry.rollup.executionCount,
        blockedCount: graph.downstream.carry.rollup.blockedCount,
        failureCount: graph.downstream.carry.rollup.failureCount,
        completedCount: graph.downstream.carry.rollup.completedCount,
      },
      treasury: {
        status: graph.downstream.treasury.rollup.status,
        actionCount: graph.downstream.treasury.rollup.actionCount,
        executionCount: graph.downstream.treasury.rollup.executionCount,
        blockedCount: graph.downstream.treasury.rollup.blockedCount,
        failureCount: graph.downstream.treasury.rollup.failureCount,
        completedCount: graph.downstream.treasury.rollup.completedCount,
        note: graph.downstream.treasury.note,
      },
    },
    finalizationReason,
    finalizedAt: completionState === 'finalized' ? terminalTimestamp : null,
  };
}

function recommendationForResolutionState(
  resolutionState: RebalanceBundleResolutionState,
): RebalanceBundleInterventionRecommendation | null {
  switch (resolutionState) {
    case 'accepted_partial':
      return 'accepted_partial_application';
    case 'manually_resolved':
      return 'manually_resolved';
    case 'escalated':
      return 'escalated_for_review';
    case 'unresolved':
      return null;
  }
}

function createRebalanceTimeline(input: {
  detail: RebalanceProposalDetailView;
  commands: RuntimeCommandView[];
  carryActions: RebalanceCarryActionNodeView[];
  treasuryActions: RebalanceTreasuryActionNodeView[];
  recoveryActions: RebalanceBundleRecoveryActionView[];
  resolutionActions: RebalanceBundleResolutionActionView[];
  escalationHistory: RebalanceBundleEscalationEventView[];
}): RebalanceExecutionTimelineEntry[] {
  const entries: RebalanceExecutionTimelineEntry[] = [{
    id: `${input.detail.proposal.id}:proposed`,
    eventType: 'proposed',
    at: input.detail.proposal.createdAt,
    actorId: null,
    sleeveId: 'allocator',
    scope: 'proposal',
    status: input.detail.proposal.status,
    summary: 'Rebalance proposal was persisted from the allocator decision.',
    linkedCommandId: null,
    linkedRebalanceExecutionId: null,
    linkedActionId: null,
    linkedExecutionId: null,
    linkedRecoveryActionId: null,
    linkedResolutionActionId: null,
    linkedEscalationId: null,
    details: {
      allocatorRunId: input.detail.proposal.allocatorRunId,
      actionType: input.detail.proposal.actionType,
    },
  }];

  if (input.detail.proposal.approvedAt !== null) {
    entries.push({
      id: `${input.detail.proposal.id}:approved`,
      eventType: 'approved',
      at: input.detail.proposal.approvedAt,
      actorId: input.detail.proposal.approvedBy,
      sleeveId: 'allocator',
      scope: 'proposal',
      status: 'approved',
      summary: 'Rebalance proposal was approved for command execution.',
      linkedCommandId: input.detail.proposal.linkedCommandId,
      linkedRebalanceExecutionId: null,
      linkedActionId: null,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: {
        approvalRequirement: input.detail.proposal.approvalRequirement,
      },
    });
  }

  if (input.detail.proposal.rejectedAt !== null) {
    entries.push({
      id: `${input.detail.proposal.id}:rejected`,
      eventType: 'rejected',
      at: input.detail.proposal.rejectedAt,
      actorId: input.detail.proposal.rejectedBy,
      sleeveId: 'allocator',
      scope: 'proposal',
      status: 'rejected',
      summary: input.detail.proposal.rejectionReason ?? 'Rebalance proposal was rejected.',
      linkedCommandId: null,
      linkedRebalanceExecutionId: null,
      linkedActionId: null,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: {
        rejectionReason: input.detail.proposal.rejectionReason,
      },
    });
  }

  for (const command of input.commands) {
    entries.push({
      id: `${input.detail.proposal.id}:command:${command.commandId}`,
      eventType: 'command_linked',
      at: command.requestedAt,
      actorId: command.requestedBy,
      sleeveId: 'allocator',
      scope: 'command',
      status: command.status,
      summary: `Runtime command ${command.commandType} was linked to the rebalance proposal.`,
      linkedCommandId: command.commandId,
      linkedRebalanceExecutionId: null,
      linkedActionId: null,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: {
        commandType: command.commandType,
      },
    });
  }

  for (const execution of input.detail.executions) {
    entries.push({
      id: `${input.detail.proposal.id}:execution:${execution.id}`,
      eventType: 'execution_recorded',
      at: execution.createdAt,
      actorId: execution.requestedBy,
      sleeveId: 'allocator',
      scope: 'rebalance_execution',
      status: execution.status,
      summary: execution.outcomeSummary ?? execution.lastError ?? 'Rebalance execution was recorded.',
      linkedCommandId: execution.commandId,
      linkedRebalanceExecutionId: execution.id,
      linkedActionId: null,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: execution.outcome,
    });

    if (execution.startedAt !== null) {
      entries.push({
        id: `${input.detail.proposal.id}:executing:${execution.id}`,
        eventType: 'executing',
        at: execution.startedAt,
        actorId: execution.startedBy,
        sleeveId: 'allocator',
        scope: 'rebalance_execution',
        status: 'executing',
        summary: 'Rebalance execution started.',
        linkedCommandId: execution.commandId,
        linkedRebalanceExecutionId: execution.id,
        linkedActionId: null,
        linkedExecutionId: null,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {},
      });
    }

    if (execution.completedAt !== null) {
      const applied = execution.outcome['applied'] === true;
      entries.push({
        id: `${input.detail.proposal.id}:${execution.status}:${execution.id}`,
        eventType: execution.status === 'completed' ? 'completed' : 'failed',
        at: execution.completedAt,
        actorId: execution.startedBy ?? execution.requestedBy,
        sleeveId: 'allocator',
        scope: 'rebalance_execution',
        status: execution.status,
        summary: execution.outcomeSummary ?? execution.lastError ?? 'Rebalance execution completed.',
        linkedCommandId: execution.commandId,
        linkedRebalanceExecutionId: execution.id,
        linkedActionId: null,
        linkedExecutionId: null,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: execution.outcome,
      });

      if (applied) {
        entries.push({
          id: `${input.detail.proposal.id}:applied:${execution.id}`,
          eventType: 'budget_state_applied',
          at: execution.completedAt,
          actorId: execution.startedBy ?? execution.requestedBy,
          sleeveId: 'allocator',
          scope: 'rebalance_execution',
          status: execution.status,
          summary: 'Approved rebalance budget state was applied.',
          linkedCommandId: execution.commandId,
          linkedRebalanceExecutionId: execution.id,
          linkedActionId: null,
          linkedExecutionId: null,
          linkedRecoveryActionId: null,
          linkedResolutionActionId: null,
          linkedEscalationId: null,
          details: {
            carryTargetAllocationUsd: execution.outcome['carryTargetAllocationUsd'],
            treasuryTargetAllocationUsd: execution.outcome['treasuryTargetAllocationUsd'],
          },
        });
      }
    }
  }

  for (const node of input.carryActions) {
    entries.push({
      id: `${input.detail.proposal.id}:carry-action:${node.action.id}`,
      eventType: 'downstream_action_recorded',
      at: node.action.createdAt,
      actorId: node.action.actorId,
      sleeveId: 'carry',
      scope: 'downstream_action',
      status: node.action.status,
      summary: node.action.summary,
      linkedCommandId: node.action.linkedCommandId,
      linkedRebalanceExecutionId: null,
      linkedActionId: node.action.id,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: {
        actionType: node.action.actionType,
        blockedReasons: node.action.blockedReasons,
      },
    });

    for (const execution of node.executions) {
      entries.push({
        id: `${input.detail.proposal.id}:carry-execution:${execution.id}`,
        eventType: 'downstream_execution_recorded',
        at: execution.createdAt,
        actorId: execution.requestedBy,
        sleeveId: 'carry',
        scope: 'downstream_execution',
        status: execution.status,
        summary: execution.outcomeSummary ?? execution.lastError ?? 'Carry execution was recorded.',
        linkedCommandId: execution.commandId,
        linkedRebalanceExecutionId: null,
        linkedActionId: node.action.id,
        linkedExecutionId: execution.id,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {
          blockedReasons: execution.blockedReasons,
          venueExecutionReference: execution.venueExecutionReference,
        },
      });
    }
  }

  for (const node of input.treasuryActions) {
    entries.push({
      id: `${input.detail.proposal.id}:treasury-action:${node.action.id}`,
      eventType: 'downstream_action_recorded',
      at: node.action.createdAt,
      actorId: node.action.actorId,
      sleeveId: 'treasury',
      scope: 'downstream_action',
      status: node.action.status,
      summary: node.action.summary,
      linkedCommandId: node.action.linkedCommandId,
      linkedRebalanceExecutionId: null,
      linkedActionId: node.action.id,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: {
        actionType: node.action.actionType,
        blockedReasons: node.action.blockedReasons,
      },
    });

    for (const execution of node.executions) {
      entries.push({
        id: `${input.detail.proposal.id}:treasury-execution:${execution.id}`,
        eventType: 'downstream_execution_recorded',
        at: execution.createdAt,
        actorId: execution.requestedBy,
        sleeveId: 'treasury',
        scope: 'downstream_execution',
        status: execution.status,
        summary: execution.outcomeSummary ?? execution.lastError ?? 'Treasury execution was recorded.',
        linkedCommandId: execution.commandId,
        linkedRebalanceExecutionId: null,
        linkedActionId: node.action.id,
        linkedExecutionId: execution.id,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {
          blockedReasons: execution.blockedReasons,
          venueExecutionReference: execution.venueExecutionReference,
        },
      });
    }
  }

  for (const recoveryAction of input.recoveryActions) {
    const sleeveId: RebalanceExecutionTimelineEntry['sleeveId'] = recoveryAction.targetChildType === 'carry_action'
      ? 'carry'
      : recoveryAction.targetChildType === 'treasury_action'
        ? 'treasury'
        : 'allocator';

    entries.push({
      id: `${recoveryAction.id}:requested`,
      eventType: 'recovery_requested',
      at: recoveryAction.requestedAt,
      actorId: recoveryAction.requestedBy,
      sleeveId,
      scope: 'recovery_action',
      status: recoveryAction.status,
      summary: `Recovery requested for ${recoveryAction.targetChildType} ${recoveryAction.targetChildId}.`,
      linkedCommandId: recoveryAction.linkedCommandId,
      linkedRebalanceExecutionId: null,
      linkedActionId: recoveryAction.targetChildType === 'carry_action' || recoveryAction.targetChildType === 'treasury_action'
        ? recoveryAction.targetChildId
        : null,
      linkedExecutionId: null,
      linkedRecoveryActionId: recoveryAction.id,
      linkedResolutionActionId: null,
      linkedEscalationId: null,
      details: {
        recoveryActionType: recoveryAction.recoveryActionType,
        eligibilityState: recoveryAction.eligibilityState,
        blockedReasons: recoveryAction.blockedReasons,
        note: recoveryAction.note,
      },
    });

    if (recoveryAction.queuedAt !== null) {
      entries.push({
        id: `${recoveryAction.id}:queued`,
        eventType: 'recovery_queued',
        at: recoveryAction.queuedAt,
        actorId: recoveryAction.requestedBy,
        sleeveId,
        scope: 'recovery_action',
        status: 'queued',
        summary: `Recovery action queued ${recoveryAction.targetCommandType ?? 'command'} for ${recoveryAction.targetChildId}.`,
        linkedCommandId: recoveryAction.linkedCommandId,
        linkedRebalanceExecutionId: null,
        linkedActionId: recoveryAction.targetChildType === 'carry_action' || recoveryAction.targetChildType === 'treasury_action'
          ? recoveryAction.targetChildId
          : null,
        linkedExecutionId: null,
        linkedRecoveryActionId: recoveryAction.id,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {
          targetCommandType: recoveryAction.targetCommandType,
        },
      });
    }

    if (recoveryAction.completedAt !== null) {
      const eventType = recoveryAction.status === 'completed'
        ? 'recovery_completed'
        : recoveryAction.status === 'blocked'
          ? 'recovery_blocked'
          : 'recovery_failed';
      entries.push({
        id: `${recoveryAction.id}:${recoveryAction.status}`,
        eventType,
        at: recoveryAction.completedAt,
        actorId: recoveryAction.requestedBy,
        sleeveId,
        scope: 'recovery_action',
        status: recoveryAction.status,
        summary: recoveryAction.outcomeSummary
          ?? recoveryAction.lastError
          ?? `Recovery action ${recoveryAction.status}.`,
        linkedCommandId: recoveryAction.linkedCommandId,
        linkedRebalanceExecutionId: null,
        linkedActionId: recoveryAction.targetChildType === 'carry_action' || recoveryAction.targetChildType === 'treasury_action'
          ? recoveryAction.targetChildId
          : null,
        linkedExecutionId: null,
        linkedRecoveryActionId: recoveryAction.id,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: recoveryAction.outcome,
      });
    }
  }

  for (const resolutionAction of input.resolutionActions) {
    entries.push({
      id: `${resolutionAction.id}:${resolutionAction.status}`,
      eventType: resolutionAction.status === 'blocked' ? 'resolution_blocked' : 'resolution_completed',
      at: resolutionAction.completedAt ?? resolutionAction.requestedAt,
      actorId: resolutionAction.completedBy ?? resolutionAction.requestedBy,
      sleeveId: 'allocator',
      scope: 'resolution_action',
      status: resolutionAction.status,
      summary: resolutionAction.outcomeSummary
        ?? resolutionAction.note
        ?? `Bundle resolution recorded as ${resolutionAction.resolutionState}.`,
      linkedCommandId: null,
      linkedRebalanceExecutionId: null,
      linkedActionId: null,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: resolutionAction.id,
      linkedEscalationId: null,
      details: {
        resolutionActionType: resolutionAction.resolutionActionType,
        resolutionState: resolutionAction.resolutionState,
        acknowledgedPartialApplication: resolutionAction.acknowledgedPartialApplication,
        escalated: resolutionAction.escalated,
        linkedRecoveryActionIds: resolutionAction.linkedRecoveryActionIds,
        blockedReasons: resolutionAction.blockedReasons,
      },
    });
  }

  for (const escalationEvent of input.escalationHistory) {
    const eventType = escalationEvent.eventType === 'created'
      ? 'escalation_created'
      : escalationEvent.eventType === 'assigned'
        ? 'escalation_assigned'
        : escalationEvent.eventType === 'acknowledged'
          ? 'escalation_acknowledged'
          : escalationEvent.eventType === 'review_started'
            ? 'escalation_review_started'
            : 'escalation_resolved';
    entries.push({
      id: `${escalationEvent.escalationId}:${escalationEvent.eventType}:${escalationEvent.id}`,
      eventType,
      at: escalationEvent.createdAt,
      actorId: escalationEvent.actorId,
      sleeveId: 'allocator',
      scope: 'escalation',
      status: escalationEvent.toStatus,
      summary: escalationEvent.note
        ?? `Bundle escalation transitioned to ${escalationEvent.toStatus}.`,
      linkedCommandId: null,
      linkedRebalanceExecutionId: null,
      linkedActionId: null,
      linkedExecutionId: null,
      linkedRecoveryActionId: null,
      linkedResolutionActionId: null,
      linkedEscalationId: escalationEvent.escalationId,
      details: {
        eventType: escalationEvent.eventType,
        fromStatus: escalationEvent.fromStatus,
        toStatus: escalationEvent.toStatus,
        ownerId: escalationEvent.ownerId,
        dueAt: escalationEvent.dueAt,
        note: escalationEvent.note,
      },
    });
  }

  return entries.sort((left, right) => left.at.localeCompare(right.at));
}

function createTreasuryTimeline(
  action: TreasuryActionView,
  executions: TreasuryExecutionView[],
): TreasuryActionTimelineEntry[] {
  const entries: TreasuryActionTimelineEntry[] = [
    {
      id: `${action.id}:recommended`,
      eventType: 'recommended',
      at: action.createdAt,
      actorId: action.actorId,
      status: 'recommended',
      summary: 'Treasury action was recommended by the latest evaluation.',
      linkedCommandId: null,
      linkedExecutionId: null,
      details: {
        readiness: action.readiness,
        approvalRequirement: action.approvalRequirement,
      },
    },
  ];

  if (action.approvedAt !== null) {
    entries.push({
      id: `${action.id}:approved`,
      eventType: 'approved',
      at: action.approvedAt,
      actorId: action.approvedBy,
      status: 'approved',
      summary: 'Treasury action was approved for execution.',
      linkedCommandId: null,
      linkedExecutionId: null,
      details: {
        approvalRequirement: action.approvalRequirement,
      },
    });
  }

  if (action.executionRequestedAt !== null) {
    entries.push({
      id: `${action.id}:queued`,
      eventType: 'queued',
      at: action.executionRequestedAt,
      actorId: action.executionRequestedBy,
      status: 'queued',
      summary: 'Treasury action was queued on the runtime command rail.',
      linkedCommandId: action.linkedCommandId,
      linkedExecutionId: action.latestExecutionId,
      details: {
        linkedCommandId: action.linkedCommandId,
      },
    });
  }

  for (const execution of executions) {
    entries.push({
      id: `${action.id}:execution:${execution.id}`,
      eventType: 'execution_recorded',
      at: execution.createdAt,
      actorId: execution.requestedBy,
      status: execution.status,
      summary: execution.outcomeSummary
        ?? execution.lastError
        ?? 'Treasury execution attempt was recorded.',
      linkedCommandId: execution.commandId,
      linkedExecutionId: execution.id,
      details: {
        blockedReasons: execution.blockedReasons,
        venueExecutionReference: execution.venueExecutionReference,
      },
    });

    if (execution.startedAt !== null) {
      entries.push({
        id: `${action.id}:executing:${execution.id}`,
        eventType: 'executing',
        at: execution.startedAt,
        actorId: execution.startedBy,
        status: 'executing',
        summary: 'Treasury execution started.',
        linkedCommandId: execution.commandId,
        linkedExecutionId: execution.id,
        details: {},
      });
    }

    if (execution.completedAt !== null) {
      entries.push({
        id: `${action.id}:${execution.status}:${execution.id}`,
        eventType: execution.status === 'completed' ? 'completed' : 'failed',
        at: execution.completedAt,
        actorId: execution.startedBy ?? execution.requestedBy,
        status: execution.status,
        summary: execution.outcomeSummary
          ?? execution.lastError
          ?? (execution.status === 'completed'
            ? 'Treasury execution completed.'
            : 'Treasury execution failed.'),
        linkedCommandId: execution.commandId,
        linkedExecutionId: execution.id,
        details: {
          blockedReasons: execution.blockedReasons,
          venueExecutionReference: execution.venueExecutionReference,
          outcome: execution.outcome,
        },
      });
    }
  }

  return entries.sort((left, right) => left.at.localeCompare(right.at));
}

function createCarryTimeline(
  action: CarryActionView | null,
  execution: CarryExecutionView,
  steps: CarryExecutionStepView[],
): CarryExecutionTimelineEntry[] {
  const entries: CarryExecutionTimelineEntry[] = [];

  if (action !== null) {
    entries.push({
      id: `${action.id}:recommended`,
      eventType: 'recommended',
      at: action.createdAt,
      actorId: action.actorId,
      status: 'recommended',
      summary: 'Carry action was recommended by the latest evaluation.',
      linkedCommandId: null,
      linkedExecutionId: null,
      linkedStepId: null,
      details: {
        readiness: action.readiness,
        approvalRequirement: action.approvalRequirement,
      },
    });

    if (action.approvedAt !== null) {
      entries.push({
        id: `${action.id}:approved`,
        eventType: 'approved',
        at: action.approvedAt,
        actorId: action.approvedBy,
        status: 'approved',
        summary: 'Carry action was approved for execution.',
        linkedCommandId: null,
        linkedExecutionId: null,
        linkedStepId: null,
        details: {
          approvalRequirement: action.approvalRequirement,
        },
      });
    }

    if (action.executionRequestedAt !== null) {
      entries.push({
        id: `${action.id}:queued`,
        eventType: 'queued',
        at: action.executionRequestedAt,
        actorId: action.executionRequestedBy,
        status: 'queued',
        summary: 'Carry action was queued on the runtime command rail.',
        linkedCommandId: action.linkedCommandId,
        linkedExecutionId: action.latestExecutionId,
        linkedStepId: null,
        details: {
          linkedCommandId: action.linkedCommandId,
        },
      });
    }
  }

  entries.push({
    id: `${execution.carryActionId}:execution:${execution.id}`,
    eventType: execution.startedAt === null ? 'failed' : 'executing',
    at: execution.createdAt,
    actorId: execution.requestedBy,
    status: execution.status,
    summary: execution.outcomeSummary
      ?? execution.lastError
      ?? 'Carry execution attempt was recorded.',
    linkedCommandId: execution.commandId,
    linkedExecutionId: execution.id,
    linkedStepId: null,
    details: {
      blockedReasons: execution.blockedReasons,
      venueExecutionReference: execution.venueExecutionReference,
    },
  });

  if (execution.startedAt !== null) {
    entries.push({
      id: `${execution.carryActionId}:executing:${execution.id}`,
      eventType: 'executing',
      at: execution.startedAt,
      actorId: execution.startedBy,
      status: 'executing',
      summary: 'Carry execution started.',
      linkedCommandId: execution.commandId,
      linkedExecutionId: execution.id,
      linkedStepId: null,
      details: {},
    });
  }

  for (const step of steps) {
    entries.push({
      id: `${execution.carryActionId}:step:${step.id}`,
      eventType: 'step_recorded',
      at: step.createdAt,
      actorId: execution.startedBy ?? execution.requestedBy,
      status: null,
      summary: step.outcomeSummary
        ?? step.lastError
        ?? `Execution step ${step.intentId} recorded with status ${step.status}.`,
      linkedCommandId: execution.commandId,
      linkedExecutionId: execution.id,
      linkedStepId: step.id,
      details: {
        intentId: step.intentId,
        venueId: step.venueId,
        venueOrderId: step.venueOrderId,
        executionReference: step.executionReference,
        status: step.status,
      },
    });
  }

  if (execution.completedAt !== null) {
    entries.push({
      id: `${execution.carryActionId}:${execution.status}:${execution.id}`,
      eventType: execution.status === 'completed' ? 'completed' : 'failed',
      at: execution.completedAt,
      actorId: execution.startedBy ?? execution.requestedBy,
      status: execution.status,
      summary: execution.outcomeSummary
        ?? execution.lastError
        ?? (execution.status === 'completed'
          ? 'Carry execution completed.'
          : 'Carry execution failed.'),
      linkedCommandId: execution.commandId,
      linkedExecutionId: execution.id,
      linkedStepId: null,
      details: {
        blockedReasons: execution.blockedReasons,
        venueExecutionReference: execution.venueExecutionReference,
        outcome: execution.outcome,
      },
    });
  }

  return entries.sort((left, right) => left.at.localeCompare(right.at));
}

async function mapRemediationRow(
  store: RuntimeStore,
  row: typeof runtimeMismatchRemediations.$inferSelect,
): Promise<RuntimeMismatchRemediationView> {
  const [command, latestRecoveryEvent] = await Promise.all([
    store.getRuntimeCommand(row.commandId),
    row.latestRecoveryEventId === null
      ? Promise.resolve<RuntimeRecoveryEventView | null>(null)
      : store.getRecoveryEventById(row.latestRecoveryEventId),
  ]);

  return {
    id: row.id,
    mismatchId: row.mismatchId,
    attemptSequence: row.attemptSequence,
    remediationType: row.remediationType as RuntimeRemediationActionType,
    commandId: row.commandId,
    status: row.status as RuntimeRemediationStatus,
    requestedBy: row.requestedBy,
    requestedSummary: row.requestedSummary ?? null,
    outcomeSummary: row.outcomeSummary ?? null,
    latestRecoveryEventId: row.latestRecoveryEventId ?? null,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: toIsoString(row.startedAt),
    completedAt: toIsoString(row.completedAt),
    failedAt: toIsoString(row.failedAt),
    updatedAt: row.updatedAt.toISOString(),
    command,
    latestRecoveryEvent,
  };
}

export class DatabaseAuditWriter implements AuditWriter {
  constructor(private readonly db: Database) {}

  async write(event: AuditEvent): Promise<void> {
    await this.db
      .insert(auditEvents)
      .values({
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        actorType: event.actorType,
        actorId: event.actorId,
        sleeveId: event.sleeveId ?? null,
        correlationId: event.correlationId ?? null,
        data: asRecord(event.data),
      })
      .onConflictDoNothing({
        target: auditEvents.eventId,
      });
  }
}

export class RuntimeOrderStore implements OrderStore {
  constructor(private readonly db: Database) {}

  async save(record: OrderRecord): Promise<void> {
    await this.db
      .insert(orders)
      .values({
        clientOrderId: record.intent.intentId,
        strategyRunId: typeof record.intent.metadata['runId'] === 'string'
          ? record.intent.metadata['runId']
          : null,
        sleeveId: extractSleeveId(record.intent),
        opportunityId: record.intent.opportunityId,
        venueId: record.intent.venueId,
        venueOrderId: record.venueOrderId,
        asset: record.intent.asset,
        side: record.intent.side,
        orderType: record.intent.type,
        executionMode: typeof record.intent.metadata['executionMode'] === 'string'
          ? String(record.intent.metadata['executionMode'])
          : 'dry-run',
        reduceOnly: record.intent.reduceOnly,
        requestedSize: record.intent.size,
        requestedPrice: record.intent.limitPrice,
        filledSize: record.filledSize,
        averageFillPrice: record.averageFillPrice,
        status: record.status,
        attemptCount: record.attemptCount,
        lastError: record.lastError,
        metadata: asRecord(record.intent.metadata),
        submittedAt: record.submittedAt,
        completedAt: record.completedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: orders.clientOrderId,
        set: {
          strategyRunId: typeof record.intent.metadata['runId'] === 'string'
            ? String(record.intent.metadata['runId'])
            : null,
          sleeveId: extractSleeveId(record.intent),
          opportunityId: record.intent.opportunityId,
          venueId: record.intent.venueId,
          venueOrderId: record.venueOrderId,
          asset: record.intent.asset,
          side: record.intent.side,
          orderType: record.intent.type,
          executionMode: typeof record.intent.metadata['executionMode'] === 'string'
            ? String(record.intent.metadata['executionMode'])
            : 'dry-run',
          reduceOnly: record.intent.reduceOnly,
          requestedSize: record.intent.size,
          requestedPrice: record.intent.limitPrice,
          filledSize: record.filledSize,
          averageFillPrice: record.averageFillPrice,
          status: record.status,
          attemptCount: record.attemptCount,
          lastError: record.lastError,
          metadata: asRecord(record.intent.metadata),
          submittedAt: record.submittedAt,
          completedAt: record.completedAt,
          updatedAt: new Date(),
        },
      });
  }

  async getByClientId(clientOrderId: string): Promise<OrderRecord | null> {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.clientOrderId, clientOrderId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const fillRows = await this.db
      .select()
      .from(fills)
      .where(eq(fills.clientOrderId, clientOrderId))
      .orderBy(desc(fills.filledAt));

    return {
      intent: {
        intentId: row.clientOrderId,
        venueId: row.venueId,
        asset: row.asset,
        side: row.side as OrderIntent['side'],
        type: row.orderType as OrderIntent['type'],
        size: row.requestedSize,
        limitPrice: row.requestedPrice,
        opportunityId: row.opportunityId as OrderIntent['opportunityId'],
        reduceOnly: row.reduceOnly,
        createdAt: row.createdAt,
        metadata: asRecord(row.metadata),
      },
      status: row.status as OrderStatus,
      venueOrderId: row.venueOrderId,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice,
      feesPaid: fillRows[0]?.fee ?? null,
      fills: fillRows.map((fillRow): OrderFill => ({
        fillId: fillRow.fillId ?? fillRow.id,
        orderId: row.clientOrderId as OrderFill['orderId'],
        filledSize: fillRow.size,
        fillPrice: fillRow.price,
        fee: fillRow.fee,
        feeAsset: (fillRow.feeAsset ?? row.asset),
        filledAt: fillRow.filledAt,
      })),
      submittedAt: row.submittedAt,
      completedAt: row.completedAt,
      lastError: row.lastError,
      attemptCount: row.attemptCount,
    };
  }

  async updateStatus(
    clientOrderId: string,
    status: OrderStatus,
    updates: Partial<OrderRecord> = {},
  ): Promise<void> {
    const existing = await this.getByClientId(clientOrderId);

    if (existing === null) {
      throw new Error(`RuntimeOrderStore.updateStatus: unknown order "${clientOrderId}"`);
    }

    const merged: OrderRecord = {
      ...existing,
      ...updates,
      status,
      fills: updates.fills ?? existing.fills,
    };

    await this.save(merged);
  }

  async listByStatus(status: OrderStatus): Promise<OrderRecord[]> {
    const rows = await this.db
      .select({
        clientOrderId: orders.clientOrderId,
      })
      .from(orders)
      .where(eq(orders.status, status));

    const result: OrderRecord[] = [];

    for (const row of rows) {
      const record = await this.getByClientId(row.clientOrderId);
      if (record !== null) {
        result.push(record);
      }
    }

    return result;
  }
}

export class RuntimeStore {
  constructor(
    readonly db: Database,
    readonly auditWriter: DatabaseAuditWriter,
  ) {}

  async ensureRuntimeState(
    executionMode: 'dry-run' | 'live',
    liveExecutionEnabled: boolean,
    riskLimits: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .insert(runtimeState)
      .values({
        id: 'primary',
        executionMode,
        liveExecutionEnabled,
        riskLimits,
        halted: false,
        lifecycleState: 'starting',
        projectionStatus: 'stale',
        startedAt: now,
        lastUpdatedBy: 'runtime-bootstrap',
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: runtimeState.id,
      });
  }

  async getRuntimeStatus(): Promise<RuntimeStatusView> {
    const [row] = await this.db
      .select()
      .from(runtimeState)
      .where(eq(runtimeState.id, 'primary'))
      .limit(1);

    if (row === undefined) {
      return {
        executionMode: 'dry-run',
        liveExecutionEnabled: false,
        riskLimits: {},
        halted: false,
        lifecycleState: 'stopped',
        projectionStatus: 'stale',
        lastRunId: null,
        lastRunStatus: null,
        lastSuccessfulRunId: null,
        lastCycleStartedAt: null,
        lastCycleCompletedAt: null,
        lastProjectionRebuildAt: null,
        lastProjectionSourceRunId: null,
        startedAt: null,
        readyAt: null,
        stoppedAt: null,
        lastError: null,
        reason: null,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return {
      executionMode: row.executionMode as 'dry-run' | 'live',
      liveExecutionEnabled: row.liveExecutionEnabled,
      riskLimits: asJsonObject(row.riskLimits),
      halted: row.halted,
      lifecycleState: row.lifecycleState as RuntimeLifecycleState,
      projectionStatus: row.projectionStatus as ProjectionStatus,
      lastRunId: row.lastRunId ?? null,
      lastRunStatus: row.lastRunStatus ?? null,
      lastSuccessfulRunId: row.lastSuccessfulRunId ?? null,
      lastCycleStartedAt: toIsoString(row.lastCycleStartedAt),
      lastCycleCompletedAt: toIsoString(row.lastCycleCompletedAt),
      lastProjectionRebuildAt: toIsoString(row.lastProjectionRebuildAt),
      lastProjectionSourceRunId: row.lastProjectionSourceRunId ?? null,
      startedAt: toIsoString(row.startedAt),
      readyAt: toIsoString(row.readyAt),
      stoppedAt: toIsoString(row.stoppedAt),
      lastError: row.lastError ?? null,
      reason: row.reason ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listCarryRecommendations(limit = 50): Promise<CarryActionView[]> {
    return this.listCarryActions(limit);
  }

  async listCarryActions(limit = 50): Promise<CarryActionView[]> {
    const rows = await this.db
      .select()
      .from(carryActions)
      .orderBy(desc(carryActions.createdAt))
      .limit(limit);

    return rows.map(mapCarryActionRow);
  }

  async getCarryAction(actionId: string): Promise<CarryActionDetailView | null> {
    const [actionRow] = await this.db
      .select()
      .from(carryActions)
      .where(eq(carryActions.id, actionId))
      .limit(1);

    if (actionRow === undefined) {
      return null;
    }

    const [plannedOrderRows, executionRows, latestCommand, linkedRebalanceProposal] = await Promise.all([
      this.db
        .select()
        .from(carryActionOrderIntents)
        .where(eq(carryActionOrderIntents.carryActionId, actionRow.id))
        .orderBy(desc(carryActionOrderIntents.createdAt)),
      this.db
        .select()
        .from(carryActionExecutions)
        .where(eq(carryActionExecutions.carryActionId, actionRow.id))
        .orderBy(desc(carryActionExecutions.createdAt)),
      actionRow.linkedCommandId === null
        ? Promise.resolve<RuntimeCommandView | null>(null)
        : this.getRuntimeCommand(actionRow.linkedCommandId),
      actionRow.linkedRebalanceProposalId === null
        ? Promise.resolve<RebalanceProposalView | null>(null)
        : this.db
          .select()
          .from(allocatorRebalanceProposals)
          .where(eq(allocatorRebalanceProposals.id, actionRow.linkedRebalanceProposalId))
          .limit(1)
          .then((rows) => rows[0] === undefined ? null : mapRebalanceProposalRow(rows[0])),
    ]);

    return {
      action: mapCarryActionRow(actionRow),
      plannedOrders: plannedOrderRows.map(mapCarryPlannedOrderRow),
      latestCommand,
      executions: executionRows.map(mapCarryExecutionRow),
      linkedRebalanceProposal,
    };
  }

  async listCarryExecutions(limit = 50): Promise<CarryExecutionView[]> {
    const rows = await this.db
      .select()
      .from(carryActionExecutions)
      .orderBy(desc(carryActionExecutions.createdAt))
      .limit(limit);

    return rows.map(mapCarryExecutionRow);
  }

  async listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]> {
    const rows = await this.db
      .select()
      .from(carryActionExecutions)
      .where(eq(carryActionExecutions.carryActionId, actionId))
      .orderBy(desc(carryActionExecutions.createdAt));

    return rows.map(mapCarryExecutionRow);
  }

  private async getCarryExecutionViewRecord(executionId: string): Promise<CarryExecutionView | null> {
    const [row] = await this.db
      .select()
      .from(carryActionExecutions)
      .where(eq(carryActionExecutions.id, executionId))
      .limit(1);

    return row === undefined ? null : mapCarryExecutionRow(row);
  }

  async getCarryExecution(executionId: string): Promise<CarryExecutionDetailView | null> {
    const [executionRow] = await this.db
      .select()
      .from(carryActionExecutions)
      .where(eq(carryActionExecutions.id, executionId))
      .limit(1);

    if (executionRow === undefined) {
      return null;
    }

    const execution = mapCarryExecutionRow(executionRow);
    const [actionDetail, command, stepRows] = await Promise.all([
      this.getCarryAction(execution.carryActionId),
      execution.commandId === null
        ? Promise.resolve<RuntimeCommandView | null>(null)
        : this.getRuntimeCommand(execution.commandId),
      this.db
        .select()
        .from(carryExecutionSteps)
        .where(eq(carryExecutionSteps.carryExecutionId, executionId))
        .orderBy(desc(carryExecutionSteps.createdAt)),
    ]);

    const action = actionDetail?.action ?? null;
    const linkedRebalanceProposal = actionDetail?.linkedRebalanceProposal ?? null;
    const venueIds = new Set<string>();
    for (const step of stepRows) {
      venueIds.add(step.venueId);
    }
    for (const plannedOrder of actionDetail?.plannedOrders ?? []) {
      venueIds.add(plannedOrder.venueId);
    }

    const venueSnapshots = action === null || action.strategyRunId === null || venueIds.size === 0
      ? []
      : (await this.db
        .select()
        .from(carryVenueSnapshots)
        .where(eq(carryVenueSnapshots.strategyRunId, action.strategyRunId)))
        .filter((row) => venueIds.has(row['venueId']))
        .map(mapCarryVenueRow);
    const steps = stepRows.map(mapCarryExecutionStepRow).sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt),
    );

    return {
      execution,
      action,
      command,
      linkedRebalanceProposal,
      venueSnapshots,
      steps,
      timeline: createCarryTimeline(action, execution, steps),
    };
  }

  async listCarryVenues(limit = 50): Promise<CarryVenueView[]> {
    const rows = await this.db
      .select()
      .from(carryVenueSnapshots)
      .orderBy(desc(carryVenueSnapshots.updatedAt))
      .limit(limit);

    return rows.map(mapCarryVenueRow);
  }

  async listVenues(limit = 100): Promise<VenueInventoryItemView[]> {
    const rows = await this.db
      .select()
      .from(venueConnectorSnapshots)
      .orderBy(desc(venueConnectorSnapshots.capturedAt));

    const latestByVenue = new Map<string, typeof venueConnectorSnapshots.$inferSelect>();
    const lastSuccessfulByVenue = new Map<string, Date>();

    for (const row of rows) {
      if (!latestByVenue.has(row['venueId'])) {
        latestByVenue.set(row['venueId'], row);
      }
      if (row['snapshotSuccessful'] && !lastSuccessfulByVenue.has(row['venueId'])) {
        lastSuccessfulByVenue.set(row['venueId'], row['capturedAt']);
      }
    }

    return Array.from(latestByVenue.values())
      .slice(0, limit)
      .map((row) => mapVenueInventoryItem(row, lastSuccessfulByVenue.get(row.venueId) ?? null));
  }

  async getVenueSummary(): Promise<VenueInventorySummaryView> {
    const venues = await this.listVenues(500);

    return {
      totalVenues: venues.length,
      simulatedOnly: venues.filter((venue) => venue.truthMode === 'simulated').length,
      realReadOnly: venues.filter((venue) => venue.truthMode === 'real' && venue.readOnlySupport).length,
      realExecutionCapable: venues.filter((venue) => venue.truthMode === 'real' && venue.executionSupport).length,
      derivativeAware: venues.filter((venue) => venue.truthProfile === 'derivative_aware').length,
      genericWallet: venues.filter((venue) => venue.truthProfile === 'generic_wallet').length,
      capacityOnly: venues.filter((venue) => venue.truthProfile === 'capacity_only').length,
      approvedForLiveUse: venues.filter((venue) => venue.approvedForLiveUse).length,
      degraded: venues.filter((venue) => venue.healthState === 'degraded').length,
      unavailable: venues.filter((venue) => venue.healthState === 'unavailable').length,
      stale: venues.filter((venue) => venue.snapshotFreshness === 'stale').length,
      missingPrerequisites: venues.filter((venue) => venue.missingPrerequisites.length > 0).length,
    };
  }

  async getVenueTruthSummary(): Promise<VenueTruthSummaryView> {
    const venues = await this.listVenues(500);
    const summary: VenueTruthSummaryView = {
      totalVenues: venues.length,
      derivativeAwareVenues: 0,
      genericWalletVenues: 0,
      capacityOnlyVenues: 0,
      connectorDepth: createVenueTruthConnectorDepthSummary(),
      completeSnapshots: 0,
      partialSnapshots: 0,
      minimalSnapshots: 0,
      decodedDerivativeAccountVenues: 0,
      decodedDerivativePositionVenues: 0,
      healthMetricVenues: 0,
      venueOpenOrderInventoryVenues: 0,
      accountState: createVenueTruthCoverageAggregate(),
      balanceState: createVenueTruthCoverageAggregate(),
      capacityState: createVenueTruthCoverageAggregate(),
      exposureState: createVenueTruthCoverageAggregate(),
      derivativeAccountState: createVenueTruthCoverageAggregate(),
      derivativePositionState: createVenueTruthCoverageAggregate(),
      derivativeHealthState: createVenueTruthCoverageAggregate(),
      orderState: createVenueTruthCoverageAggregate(),
      executionReferences: createVenueTruthCoverageAggregate(),
    };

    for (const venue of venues) {
      if (venue.truthProfile === 'derivative_aware') {
        summary.derivativeAwareVenues += 1;
      } else if (venue.truthProfile === 'generic_wallet') {
        summary.genericWalletVenues += 1;
      } else if (venue.truthProfile === 'capacity_only') {
        summary.capacityOnlyVenues += 1;
      }

      summary.connectorDepth[inferVenueTruthSourceDepth({
        connectorType: venue.connectorType,
        truthMode: venue.truthMode,
        executionSupport: venue.executionSupport,
        sourceMetadata: venue.sourceMetadata,
      })] += 1;

      if (venue.snapshotCompleteness === 'complete') {
        summary.completeSnapshots += 1;
      } else if (venue.snapshotCompleteness === 'partial') {
        summary.partialSnapshots += 1;
      } else {
        summary.minimalSnapshots += 1;
      }

      if (venue.truthCoverage.derivativeAccountState.status === 'available') {
        summary.decodedDerivativeAccountVenues += 1;
      }
      if (venue.truthCoverage.derivativePositionState.status === 'available') {
        summary.decodedDerivativePositionVenues += 1;
      }
      if (venue.truthCoverage.derivativeHealthState.status === 'available') {
        summary.healthMetricVenues += 1;
      }
      if (venue.truthCoverage.orderState.status === 'available') {
        summary.venueOpenOrderInventoryVenues += 1;
      }

      summary.accountState[venue.truthCoverage.accountState.status] += 1;
      summary.balanceState[venue.truthCoverage.balanceState.status] += 1;
      summary.capacityState[venue.truthCoverage.capacityState.status] += 1;
      summary.exposureState[venue.truthCoverage.exposureState.status] += 1;
      summary.derivativeAccountState[venue.truthCoverage.derivativeAccountState.status] += 1;
      summary.derivativePositionState[venue.truthCoverage.derivativePositionState.status] += 1;
      summary.derivativeHealthState[venue.truthCoverage.derivativeHealthState.status] += 1;
      summary.orderState[venue.truthCoverage.orderState.status] += 1;
      summary.executionReferences[venue.truthCoverage.executionReferences.status] += 1;
    }

    return summary;
  }

  async listVenueReadiness(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.listVenues(limit);
  }

  async listVenueSnapshots(venueId: string, limit = 20): Promise<VenueSnapshotView[]> {
    const rows = await this.db
      .select()
      .from(venueConnectorSnapshots)
      .where(eq(venueConnectorSnapshots.venueId, venueId))
      .orderBy(desc(venueConnectorSnapshots.capturedAt))
      .limit(limit);

    return rows.map(mapVenueSnapshotRow);
  }

  async getVenue(venueId: string): Promise<VenueDetailView | null> {
    const [inventory, snapshots, internalState, comparisonDetail] = await Promise.all([
      this.listVenues(500),
      this.listVenueSnapshots(venueId, 20),
      this.getVenueInternalState(venueId),
      this.getVenueComparisonDetail(venueId),
    ]);
    const venue = inventory.find((item) => item.venueId === venueId) ?? null;
    if (venue === null || comparisonDetail === null) {
      return null;
    }

    return {
      venue,
      snapshots,
      internalState,
      comparisonSummary: comparisonDetail.summary,
      comparisonDetail,
    };
  }

  async getVenueInternalState(venueId: string): Promise<InternalDerivativeSnapshotView | null> {
    const [row] = await this.db
      .select()
      .from(internalDerivativeCurrent)
      .where(eq(internalDerivativeCurrent.venueId, venueId))
      .limit(1);

    return row === undefined ? null : mapInternalDerivativeCurrentRow(row);
  }

  async listInternalDerivativeSnapshots(
    venueId: string,
    limit = 20,
  ): Promise<InternalDerivativeSnapshotView[]> {
    const rows = await this.db
      .select()
      .from(internalDerivativeSnapshots)
      .where(eq(internalDerivativeSnapshots.venueId, venueId))
      .orderBy(desc(internalDerivativeSnapshots.capturedAt), desc(internalDerivativeSnapshots.createdAt))
      .limit(limit);

    return rows.map(mapInternalDerivativeSnapshotRow);
  }

  async getVenueComparisonSummary(
    venueId: string,
  ): Promise<VenueDerivativeComparisonSummaryView | null> {
    const detail = await this.getVenueComparisonDetail(venueId);
    return detail?.summary ?? null;
  }

  async getVenueComparisonDetail(
    venueId: string,
  ): Promise<VenueDerivativeComparisonDetailView | null> {
    const [internalState, snapshots, venueRows, activeFindings] = await Promise.all([
      this.getVenueInternalState(venueId),
      this.listVenueSnapshots(venueId, 1),
      this.db
        .select({
          venueId: venueConnectorSnapshots.venueId,
          venueName: venueConnectorSnapshots.venueName,
        })
        .from(venueConnectorSnapshots)
        .where(eq(venueConnectorSnapshots.venueId, venueId))
        .orderBy(desc(venueConnectorSnapshots.capturedAt))
        .limit(1),
      this.listReconciliationFindings({
        limit: 100,
        status: 'active',
        venueId,
      }),
    ]);

    const venueRow = venueRows[0];
    if (venueRow === undefined) {
      return null;
    }

    return buildVenueDerivativeComparisonDetail({
      venueId,
      venueName: venueRow.venueName,
      internalState,
      externalSnapshot: snapshots[0] ?? null,
      activeFindings,
    });
  }

  async listExpectedVenueExecutionReferences(venueId: string, limit = 100): Promise<string[]> {
    const [carryRows, treasuryRows] = await Promise.all([
      this.db
        .select({
          reference: carryExecutionSteps.executionReference,
        })
        .from(carryExecutionSteps)
        .where(eq(carryExecutionSteps.venueId, venueId))
        .orderBy(desc(carryExecutionSteps.updatedAt))
        .limit(limit),
      this.db
        .select({
          reference: treasuryActionExecutions.venueExecutionReference,
        })
        .from(treasuryActionExecutions)
        .innerJoin(treasuryActions, eq(treasuryActions.id, treasuryActionExecutions.treasuryActionId))
        .where(eq(treasuryActions.venueId, venueId))
        .orderBy(desc(treasuryActionExecutions.updatedAt))
        .limit(limit),
    ]);

    const references = new Set<string>();

    for (const row of carryRows) {
      if (row.reference !== null) {
        references.add(row.reference);
      }
    }

    for (const row of treasuryRows) {
      if (row.reference !== null) {
        references.add(row.reference);
      }
    }

    return Array.from(references);
  }

  async updateRuntimeStatus(
    patch: {
      executionMode?: 'dry-run' | 'live';
      liveExecutionEnabled?: boolean;
      riskLimits?: Record<string, unknown>;
      halted?: boolean;
      lifecycleState?: RuntimeLifecycleState;
      projectionStatus?: ProjectionStatus;
      lastRunId?: string | null;
      lastRunStatus?: string | null;
      lastSuccessfulRunId?: string | null;
      lastCycleStartedAt?: Date | null;
      lastCycleCompletedAt?: Date | null;
      lastProjectionRebuildAt?: Date | null;
      lastProjectionSourceRunId?: string | null;
      startedAt?: Date | null;
      readyAt?: Date | null;
      stoppedAt?: Date | null;
      lastError?: string | null;
      reason?: string | null;
      lastUpdatedBy: string;
    },
  ): Promise<void> {
    await this.db
      .update(runtimeState)
      .set({
        ...(patch.executionMode !== undefined ? { executionMode: patch.executionMode } : {}),
        ...(patch.liveExecutionEnabled !== undefined
          ? { liveExecutionEnabled: patch.liveExecutionEnabled }
          : {}),
        ...(patch.riskLimits !== undefined ? { riskLimits: patch.riskLimits } : {}),
        ...(patch.halted !== undefined ? { halted: patch.halted } : {}),
        ...(patch.lifecycleState !== undefined ? { lifecycleState: patch.lifecycleState } : {}),
        ...(patch.projectionStatus !== undefined ? { projectionStatus: patch.projectionStatus } : {}),
        ...(patch.lastRunId !== undefined ? { lastRunId: patch.lastRunId } : {}),
        ...(patch.lastRunStatus !== undefined ? { lastRunStatus: patch.lastRunStatus } : {}),
        ...(patch.lastSuccessfulRunId !== undefined
          ? { lastSuccessfulRunId: patch.lastSuccessfulRunId }
          : {}),
        ...(patch.lastCycleStartedAt !== undefined
          ? { lastCycleStartedAt: patch.lastCycleStartedAt }
          : {}),
        ...(patch.lastCycleCompletedAt !== undefined
          ? { lastCycleCompletedAt: patch.lastCycleCompletedAt }
          : {}),
        ...(patch.lastProjectionRebuildAt !== undefined
          ? { lastProjectionRebuildAt: patch.lastProjectionRebuildAt }
          : {}),
        ...(patch.lastProjectionSourceRunId !== undefined
          ? { lastProjectionSourceRunId: patch.lastProjectionSourceRunId }
          : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.readyAt !== undefined ? { readyAt: patch.readyAt } : {}),
        ...(patch.stoppedAt !== undefined ? { stoppedAt: patch.stoppedAt } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
        lastUpdatedBy: patch.lastUpdatedBy,
        updatedAt: new Date(),
      })
      .where(eq(runtimeState.id, 'primary'));
  }

  async ensureWorkerState(workerId: string, cycleIntervalMs: number): Promise<void> {
    await this.db
      .insert(runtimeWorkerState)
      .values({
        id: 'primary',
        workerId,
        lifecycleState: 'stopped',
        schedulerState: 'idle',
        cycleIntervalMs,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: runtimeWorkerState.id,
      });
  }

  async getWorkerStatus(): Promise<WorkerStatusView> {
    const [row] = await this.db
      .select()
      .from(runtimeWorkerState)
      .where(eq(runtimeWorkerState.id, 'primary'))
      .limit(1);

    if (row === undefined) {
      return {
        workerId: 'unassigned',
        lifecycleState: 'stopped',
        schedulerState: 'idle',
        currentOperation: null,
        currentCommandId: null,
        currentRunId: null,
        cycleIntervalMs: 60000,
        processId: null,
        hostname: null,
        lastHeartbeatAt: null,
        lastStartedAt: null,
        lastStoppedAt: null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        nextScheduledRunAt: null,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return {
      workerId: row.workerId,
      lifecycleState: row.lifecycleState as WorkerLifecycleState,
      schedulerState: row.schedulerState as WorkerSchedulerState,
      currentOperation: row.currentOperation ?? null,
      currentCommandId: row.currentCommandId ?? null,
      currentRunId: row.currentRunId ?? null,
      cycleIntervalMs: row.cycleIntervalMs,
      processId: row.processId ?? null,
      hostname: row.hostname ?? null,
      lastHeartbeatAt: toIsoString(row.lastHeartbeatAt),
      lastStartedAt: toIsoString(row.lastStartedAt),
      lastStoppedAt: toIsoString(row.lastStoppedAt),
      lastRunStartedAt: toIsoString(row.lastRunStartedAt),
      lastRunCompletedAt: toIsoString(row.lastRunCompletedAt),
      lastSuccessAt: toIsoString(row.lastSuccessAt),
      lastFailureAt: toIsoString(row.lastFailureAt),
      lastFailureReason: row.lastFailureReason ?? null,
      nextScheduledRunAt: toIsoString(row.nextScheduledRunAt),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateWorkerStatus(
    patch: {
      workerId?: string;
      lifecycleState?: WorkerLifecycleState;
      schedulerState?: WorkerSchedulerState;
      currentOperation?: string | null;
      currentCommandId?: string | null;
      currentRunId?: string | null;
      cycleIntervalMs?: number;
      processId?: number | null;
      hostname?: string | null;
      lastHeartbeatAt?: Date | null;
      lastStartedAt?: Date | null;
      lastStoppedAt?: Date | null;
      lastRunStartedAt?: Date | null;
      lastRunCompletedAt?: Date | null;
      lastSuccessAt?: Date | null;
      lastFailureAt?: Date | null;
      lastFailureReason?: string | null;
      nextScheduledRunAt?: Date | null;
    },
  ): Promise<void> {
    await this.db
      .update(runtimeWorkerState)
      .set({
        ...(patch.workerId !== undefined ? { workerId: patch.workerId } : {}),
        ...(patch.lifecycleState !== undefined ? { lifecycleState: patch.lifecycleState } : {}),
        ...(patch.schedulerState !== undefined ? { schedulerState: patch.schedulerState } : {}),
        ...(patch.currentOperation !== undefined ? { currentOperation: patch.currentOperation } : {}),
        ...(patch.currentCommandId !== undefined ? { currentCommandId: patch.currentCommandId } : {}),
        ...(patch.currentRunId !== undefined ? { currentRunId: patch.currentRunId } : {}),
        ...(patch.cycleIntervalMs !== undefined ? { cycleIntervalMs: patch.cycleIntervalMs } : {}),
        ...(patch.processId !== undefined ? { processId: patch.processId } : {}),
        ...(patch.hostname !== undefined ? { hostname: patch.hostname } : {}),
        ...(patch.lastHeartbeatAt !== undefined ? { lastHeartbeatAt: patch.lastHeartbeatAt } : {}),
        ...(patch.lastStartedAt !== undefined ? { lastStartedAt: patch.lastStartedAt } : {}),
        ...(patch.lastStoppedAt !== undefined ? { lastStoppedAt: patch.lastStoppedAt } : {}),
        ...(patch.lastRunStartedAt !== undefined ? { lastRunStartedAt: patch.lastRunStartedAt } : {}),
        ...(patch.lastRunCompletedAt !== undefined ? { lastRunCompletedAt: patch.lastRunCompletedAt } : {}),
        ...(patch.lastSuccessAt !== undefined ? { lastSuccessAt: patch.lastSuccessAt } : {}),
        ...(patch.lastFailureAt !== undefined ? { lastFailureAt: patch.lastFailureAt } : {}),
        ...(patch.lastFailureReason !== undefined ? { lastFailureReason: patch.lastFailureReason } : {}),
        ...(patch.nextScheduledRunAt !== undefined ? { nextScheduledRunAt: patch.nextScheduledRunAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(runtimeWorkerState.id, 'primary'));
  }

  async enqueueRuntimeCommand(input: {
    commandId: string;
    commandType: RuntimeCommandType;
    requestedBy: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .insert(runtimeCommands)
      .values({
        commandId: input.commandId,
        commandType: input.commandType,
        status: 'pending',
        requestedBy: input.requestedBy,
        payload: input.payload ?? {},
        result: {},
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: runtimeCommands.commandId,
      });
  }

  async getRuntimeCommand(commandId: string): Promise<RuntimeCommandView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeCommands)
      .where(eq(runtimeCommands.commandId, commandId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      commandId: row.commandId,
      commandType: row.commandType as RuntimeCommandType,
      status: row.status as RuntimeCommandStatus,
      requestedBy: row.requestedBy,
      claimedBy: row.claimedBy ?? null,
      payload: asJsonObject(row.payload),
      result: asJsonObject(row.result),
      errorMessage: row.errorMessage ?? null,
      requestedAt: row.requestedAt.toISOString(),
      startedAt: toIsoString(row.startedAt),
      completedAt: toIsoString(row.completedAt),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async claimNextPendingCommand(claimedBy: string): Promise<RuntimeCommandView | null> {
    const [pending] = await this.db
      .select()
      .from(runtimeCommands)
      .where(eq(runtimeCommands.status, 'pending'))
      .orderBy(runtimeCommands.requestedAt)
      .limit(1);

    if (pending === undefined) {
      return null;
    }

    await this.db
      .update(runtimeCommands)
      .set({
        status: 'running',
        claimedBy,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(runtimeCommands.commandId, pending.commandId),
          eq(runtimeCommands.status, 'pending'),
        ),
      );

    return this.getRuntimeCommand(pending.commandId);
  }

  async completeRuntimeCommand(
    commandId: string,
    result: Record<string, unknown>,
  ): Promise<RuntimeCommandView | null> {
    await this.db
      .update(runtimeCommands)
      .set({
        status: 'completed',
        result,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(runtimeCommands.commandId, commandId));

    return this.getRuntimeCommand(commandId);
  }

  async failRuntimeCommand(commandId: string, errorMessage: string): Promise<RuntimeCommandView | null> {
    await this.db
      .update(runtimeCommands)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(runtimeCommands.commandId, commandId));

    return this.getRuntimeCommand(commandId);
  }

  async createReconciliationRun(input: {
    runType?: RuntimeReconciliationRunType;
    trigger: string;
    triggerReference?: string | null;
    sourceComponent: string;
    triggeredBy?: string | null;
  }): Promise<RuntimeReconciliationRunView> {
    const [inserted] = await this.db
      .insert(runtimeReconciliationRuns)
      .values({
        runType: input.runType ?? 'runtime_reconciliation',
        trigger: input.trigger,
        triggerReference: input.triggerReference ?? null,
        sourceComponent: input.sourceComponent,
        triggeredBy: input.triggeredBy ?? null,
        status: 'running',
        summary: {},
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (inserted === undefined) {
      throw new Error('RuntimeStore.createReconciliationRun: run was not persisted');
    }

    return mapReconciliationRunRow(inserted);
  }

  async getReconciliationRun(
    reconciliationRunId: string,
  ): Promise<RuntimeReconciliationRunView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeReconciliationRuns)
      .where(eq(runtimeReconciliationRuns.id, reconciliationRunId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapReconciliationRunRow(row);
  }

  async listReconciliationRuns(limit: number): Promise<RuntimeReconciliationRunView[]> {
    const rows = await this.db
      .select()
      .from(runtimeReconciliationRuns)
      .orderBy(desc(runtimeReconciliationRuns.startedAt))
      .limit(limit);

    return rows.map((row) => mapReconciliationRunRow(row));
  }

  async getLatestReconciliationRun(): Promise<RuntimeReconciliationRunView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeReconciliationRuns)
      .orderBy(desc(runtimeReconciliationRuns.startedAt))
      .limit(1);

    return row === undefined ? null : mapReconciliationRunRow(row);
  }

  async getLatestCompletedReconciliationRun(): Promise<RuntimeReconciliationRunView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeReconciliationRuns)
      .where(eq(runtimeReconciliationRuns.status, 'completed'))
      .orderBy(desc(runtimeReconciliationRuns.completedAt), desc(runtimeReconciliationRuns.startedAt))
      .limit(1);

    return row === undefined ? null : mapReconciliationRunRow(row);
  }

  async completeReconciliationRun(input: {
    reconciliationRunId: string;
    findingCount: number;
    linkedMismatchCount: number;
    summary: Record<string, unknown>;
  }): Promise<RuntimeReconciliationRunView | null> {
    await this.db
      .update(runtimeReconciliationRuns)
      .set({
        status: 'completed',
        findingCount: input.findingCount,
        linkedMismatchCount: input.linkedMismatchCount,
        summary: input.summary,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(runtimeReconciliationRuns.id, input.reconciliationRunId));

    return this.getReconciliationRun(input.reconciliationRunId);
  }

  async failReconciliationRun(input: {
    reconciliationRunId: string;
    errorMessage: string;
    summary?: Record<string, unknown>;
  }): Promise<RuntimeReconciliationRunView | null> {
    await this.db
      .update(runtimeReconciliationRuns)
      .set({
        status: 'failed',
        errorMessage: input.errorMessage,
        summary: input.summary ?? {},
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(runtimeReconciliationRuns.id, input.reconciliationRunId));

    return this.getReconciliationRun(input.reconciliationRunId);
  }

  async recordReconciliationFinding(input: {
    reconciliationRunId: string;
    dedupeKey: string;
    findingType: RuntimeReconciliationFindingType;
    severity: RuntimeReconciliationFindingSeverity;
    status: RuntimeReconciliationFindingStatus;
    sourceComponent: string;
    subsystem: string;
    venueId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    mismatchId?: string | null;
    summary: string;
    expectedState?: Record<string, unknown>;
    actualState?: Record<string, unknown>;
    delta?: Record<string, unknown>;
    details?: Record<string, unknown>;
    detectedAt?: Date;
  }): Promise<RuntimeReconciliationFindingView> {
    const [inserted] = await this.db
      .insert(runtimeReconciliationFindings)
      .values({
        reconciliationRunId: input.reconciliationRunId,
        dedupeKey: input.dedupeKey,
        findingType: input.findingType,
        severity: input.severity,
        status: input.status,
        sourceComponent: input.sourceComponent,
        subsystem: input.subsystem,
        venueId: input.venueId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        mismatchId: input.mismatchId ?? null,
        summary: input.summary,
        expectedState: input.expectedState ?? {},
        actualState: input.actualState ?? {},
        delta: input.delta ?? {},
        details: input.details ?? {},
        detectedAt: input.detectedAt ?? new Date(),
      })
      .returning();

    if (inserted === undefined) {
      throw new Error(`RuntimeStore.recordReconciliationFinding: finding "${input.dedupeKey}" was not persisted`);
    }

    return mapReconciliationFindingRow(inserted);
  }

  async getReconciliationFinding(
    findingId: string,
  ): Promise<RuntimeReconciliationFindingView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeReconciliationFindings)
      .where(eq(runtimeReconciliationFindings.id, findingId))
      .limit(1);

    return row === undefined ? null : mapReconciliationFindingRow(row);
  }

  async listReconciliationFindings(input: {
    limit: number;
    findingType?: RuntimeReconciliationFindingType;
    severity?: RuntimeReconciliationFindingSeverity;
    status?: RuntimeReconciliationFindingStatus;
    venueId?: string;
    mismatchId?: string;
    reconciliationRunId?: string;
  }): Promise<RuntimeReconciliationFindingView[]> {
    const predicates = [
      input.findingType !== undefined ? eq(runtimeReconciliationFindings.findingType, input.findingType) : undefined,
      input.severity !== undefined ? eq(runtimeReconciliationFindings.severity, input.severity) : undefined,
      input.status !== undefined ? eq(runtimeReconciliationFindings.status, input.status) : undefined,
      input.venueId !== undefined ? eq(runtimeReconciliationFindings.venueId, input.venueId) : undefined,
      input.mismatchId !== undefined ? eq(runtimeReconciliationFindings.mismatchId, input.mismatchId) : undefined,
      input.reconciliationRunId !== undefined
        ? eq(runtimeReconciliationFindings.reconciliationRunId, input.reconciliationRunId)
        : undefined,
    ].filter((value): value is NonNullable<typeof value> => value !== undefined);

    const rows = predicates.length === 0
      ? await this.db
        .select()
        .from(runtimeReconciliationFindings)
        .orderBy(desc(runtimeReconciliationFindings.detectedAt), desc(runtimeReconciliationFindings.createdAt))
        .limit(input.limit)
      : await this.db
        .select()
        .from(runtimeReconciliationFindings)
        .where(and(...predicates))
        .orderBy(desc(runtimeReconciliationFindings.detectedAt), desc(runtimeReconciliationFindings.createdAt))
        .limit(input.limit);

    return rows.map((row) => mapReconciliationFindingRow(row));
  }

  async getReconciliationFindingDetail(
    findingId: string,
  ): Promise<RuntimeReconciliationFindingDetailView | null> {
    const finding = await this.getReconciliationFinding(findingId);
    if (finding === null) {
      return null;
    }

    const [run, mismatch] = await Promise.all([
      this.getReconciliationRun(finding.reconciliationRunId),
      finding.mismatchId === null ? Promise.resolve<RuntimeMismatchView | null>(null) : this.getMismatchById(finding.mismatchId),
    ]);

    return {
      finding,
      run,
      mismatch,
    };
  }

  async summarizeLatestReconciliation(): Promise<RuntimeReconciliationSummaryView | null> {
    const latestRun = await this.getLatestReconciliationRun();
    const latestCompletedRun = await this.getLatestCompletedReconciliationRun();

    if (latestRun === null) {
      return null;
    }

    const findings = await this.listReconciliationFindings({
      limit: 500,
      reconciliationRunId: latestRun.id,
    });

    const latestStatusCounts = createFindingStatusCounts();
    const latestSeverityCounts = createFindingSeverityCounts();
    const latestTypeCounts = createFindingTypeCounts();

    for (const finding of findings) {
      latestStatusCounts[finding.status] += 1;
      latestSeverityCounts[finding.severity] += 1;
      latestTypeCounts[finding.findingType] += 1;
    }

    return {
      latestRun,
      latestCompletedRun,
      latestFindingCount: findings.length,
      latestLinkedMismatchCount: findings.filter((finding) => finding.mismatchId !== null).length,
      latestStatusCounts,
      latestSeverityCounts,
      latestTypeCounts,
    };
  }

  async createMismatchRemediation(input: {
    mismatchId: string;
    remediationType: RuntimeRemediationActionType;
    commandId: string;
    requestedBy: string;
    requestedSummary?: string | null;
  }): Promise<RuntimeMismatchRemediationView> {
    const rows = await this.db
      .select({
        attemptSequence: sql<number>`coalesce(max(${runtimeMismatchRemediations.attemptSequence}), 0)`,
      })
      .from(runtimeMismatchRemediations)
      .where(eq(runtimeMismatchRemediations.mismatchId, input.mismatchId));

    const nextAttemptSequence = Number(rows[0]?.attemptSequence ?? 0) + 1;

    const [inserted] = await this.db
      .insert(runtimeMismatchRemediations)
      .values({
        mismatchId: input.mismatchId,
        attemptSequence: nextAttemptSequence,
        remediationType: input.remediationType,
        commandId: input.commandId,
        status: 'requested',
        requestedBy: input.requestedBy,
        requestedSummary: input.requestedSummary ?? null,
        updatedAt: new Date(),
      })
      .returning();

    if (inserted === undefined) {
      throw new Error(`RuntimeStore.createMismatchRemediation: remediation for mismatch "${input.mismatchId}" was not persisted`);
    }

    return mapRemediationRow(this, inserted);
  }

  async getMismatchRemediationById(remediationId: string): Promise<RuntimeMismatchRemediationView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatchRemediations)
      .where(eq(runtimeMismatchRemediations.id, remediationId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapRemediationRow(this, row);
  }

  async getMismatchRemediationByCommandId(commandId: string): Promise<RuntimeMismatchRemediationView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatchRemediations)
      .where(eq(runtimeMismatchRemediations.commandId, commandId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapRemediationRow(this, row);
  }

  async getLatestMismatchRemediation(
    mismatchId: string,
  ): Promise<RuntimeMismatchRemediationView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatchRemediations)
      .where(eq(runtimeMismatchRemediations.mismatchId, mismatchId))
      .orderBy(desc(runtimeMismatchRemediations.attemptSequence))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapRemediationRow(this, row);
  }

  async getInFlightMismatchRemediation(
    mismatchId: string,
  ): Promise<RuntimeMismatchRemediationView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatchRemediations)
      .where(
        and(
          eq(runtimeMismatchRemediations.mismatchId, mismatchId),
          sql`${runtimeMismatchRemediations.status} in ('requested', 'running')`,
        ),
      )
      .orderBy(desc(runtimeMismatchRemediations.attemptSequence))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapRemediationRow(this, row);
  }

  async listMismatchRemediations(
    mismatchId: string,
    limit = 50,
  ): Promise<RuntimeMismatchRemediationView[]> {
    const rows = await this.db
      .select()
      .from(runtimeMismatchRemediations)
      .where(eq(runtimeMismatchRemediations.mismatchId, mismatchId))
      .orderBy(desc(runtimeMismatchRemediations.attemptSequence))
      .limit(limit);

    return Promise.all(rows.map((row) => mapRemediationRow(this, row)));
  }

  async updateMismatchRemediationById(
    remediationId: string,
    patch: Partial<typeof runtimeMismatchRemediations.$inferInsert>,
  ): Promise<RuntimeMismatchRemediationView | null> {
    await this.db
      .update(runtimeMismatchRemediations)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(runtimeMismatchRemediations.id, remediationId));

    return this.getMismatchRemediationById(remediationId);
  }

  async createStrategyRun(input: {
    runId: string;
    sleeveId: string;
    executionMode: 'dry-run' | 'live';
    triggerSource: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(strategyRuns).values({
      runId: input.runId,
      sleeveId: input.sleeveId,
      executionMode: input.executionMode,
      triggerSource: input.triggerSource,
      status: 'running',
      startedAt: new Date(),
      metadata: input.metadata ?? {},
      updatedAt: new Date(),
    });
  }

  async completeStrategyRun(input: {
    runId: string;
    status: 'completed' | 'failed';
    opportunitiesDetected: number;
    opportunitiesApproved: number;
    intentsGenerated: number;
    intentsApproved: number;
    intentsRejected: number;
    intentsExecuted: number;
    errorMessage?: string;
  }): Promise<void> {
    await this.db
      .update(strategyRuns)
      .set({
        status: input.status,
        opportunitiesDetected: input.opportunitiesDetected,
        opportunitiesApproved: input.opportunitiesApproved,
        intentsGenerated: input.intentsGenerated,
        intentsApproved: input.intentsApproved,
        intentsRejected: input.intentsRejected,
        intentsExecuted: input.intentsExecuted,
        errorMessage: input.errorMessage ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(strategyRuns.runId, input.runId));
  }

  async persistOpportunity(input: OpportunityView): Promise<void> {
    await this.db
      .insert(strategyOpportunities)
      .values({
        opportunityId: input.opportunityId,
        runId: input.runId,
        sleeveId: input.sleeveId,
        asset: input.asset,
        opportunityType: input.opportunityType,
        expectedAnnualYieldPct: input.expectedAnnualYieldPct,
        netYieldPct: input.netYieldPct,
        confidenceScore: input.confidenceScore,
        detectedAt: new Date(input.detectedAt),
        expiresAt: new Date(input.expiresAt),
        approved: input.approved,
        payload: input.payload,
      })
      .onConflictDoNothing({
        target: strategyOpportunities.opportunityId,
      });
  }

  async persistIntent(input: {
    runId: string;
    intent: OrderIntent;
    approved: boolean;
    riskAssessment: RiskAssessment;
    executionDisposition: string;
  }): Promise<void> {
    await this.db
      .insert(strategyIntents)
      .values({
        intentId: input.intent.intentId,
        runId: input.runId,
        opportunityId: input.intent.opportunityId,
        sleeveId: extractSleeveId(input.intent),
        venueId: input.intent.venueId,
        asset: input.intent.asset,
        side: input.intent.side,
        orderType: input.intent.type,
        requestedSize: input.intent.size,
        requestedPrice: input.intent.limitPrice,
        reduceOnly: input.intent.reduceOnly,
        positionSizeUsd:
          typeof input.intent.metadata['positionSizeUsd'] === 'string'
            ? input.intent.metadata['positionSizeUsd']
            : null,
        riskStatus: input.riskAssessment.overallStatus,
        approved: input.approved,
        executionDisposition: input.executionDisposition,
        riskAssessment: {
          overallStatus: input.riskAssessment.overallStatus,
          timestamp: input.riskAssessment.timestamp.toISOString(),
          results: input.riskAssessment.results,
        },
        metadata: asRecord(input.intent.metadata),
        createdAt: input.intent.createdAt,
      })
      .onConflictDoNothing({
        target: strategyIntents.intentId,
      });
  }

  async persistExecutionEvent(input: {
    eventId: string;
    runId: string;
    intentId: string;
    clientOrderId?: string | null;
    venueOrderId?: string | null;
    eventType: string;
    status: string;
    payload: Record<string, unknown>;
    occurredAt: Date;
  }): Promise<void> {
    await this.db
      .insert(executionEvents)
      .values({
        eventId: input.eventId,
        runId: input.runId,
        intentId: input.intentId,
        clientOrderId: input.clientOrderId ?? null,
        venueOrderId: input.venueOrderId ?? null,
        eventType: input.eventType,
        status: input.status,
        payload: input.payload,
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing({
        target: executionEvents.eventId,
      });
  }

  async persistRiskSnapshot(input: {
    runId: string;
    sleeveId: string;
    summary: RiskSummary;
    approvedIntentCount: number;
    rejectedIntentCount: number;
    capturedAt: Date;
  }): Promise<void> {
    await this.db.insert(riskSnapshots).values({
      runId: input.runId,
      sleeveId: input.sleeveId,
      summary: input.summary as unknown as Record<string, unknown>,
      approvedIntentCount: input.approvedIntentCount,
      rejectedIntentCount: input.rejectedIntentCount,
      openCircuitBreakers: input.summary.openCircuitBreakers,
      capturedAt: input.capturedAt,
    });

    await this.db
      .insert(riskCurrent)
      .values({
        id: 'primary',
        sourceRunId: input.runId,
        sleeveId: input.sleeveId,
        summary: input.summary as unknown as Record<string, unknown>,
        approvedIntentCount: input.approvedIntentCount,
        rejectedIntentCount: input.rejectedIntentCount,
        openCircuitBreakers: input.summary.openCircuitBreakers,
        capturedAt: input.capturedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: riskCurrent.id,
        set: {
          sourceRunId: input.runId,
          sleeveId: input.sleeveId,
          summary: input.summary as unknown as Record<string, unknown>,
          approvedIntentCount: input.approvedIntentCount,
          rejectedIntentCount: input.rejectedIntentCount,
          openCircuitBreakers: input.summary.openCircuitBreakers,
          capturedAt: input.capturedAt,
          updatedAt: new Date(),
        },
      });
  }

  async persistRiskBreach(input: RiskBreachView): Promise<void> {
    await this.db
      .insert(riskBreaches)
      .values({
        id: input.id,
        breachType: input.breachType,
        severity: input.severity,
        description: input.description,
        triggeredAt: new Date(input.triggeredAt),
        resolvedAt: input.resolvedAt !== null ? new Date(input.resolvedAt) : null,
        details: input.details,
      })
      .onConflictDoNothing({
        target: riskBreaches.id,
      });
  }

  async persistPortfolioSnapshot(input: {
    sourceRunId: string | null;
    snapshotAt: Date;
    portfolioState: PortfolioState;
    riskSummary: RiskSummary;
    dailyPnl: string;
    cumulativePnl: string;
  }): Promise<void> {
    const totalNav = Number.parseFloat(input.portfolioState.totalNav || '0');
    const sleeves = Array.from(input.portfolioState.sleeveNav.entries()).map(([sleeveId, nav]) => ({
      sleeveId,
      nav,
      allocationPct: totalNav === 0 ? 0 : (Number.parseFloat(nav) / totalNav) * 100,
    }));

    await this.db.insert(portfolioSnapshots).values({
      snapshotAt: input.snapshotAt,
      sourceRunId: input.sourceRunId,
      totalNav: input.portfolioState.totalNav,
      grossExposure: input.portfolioState.grossExposure,
      netExposure: input.portfolioState.netExposure,
      liquidityReserve: input.portfolioState.liquidityReserve,
      openPositionCount: String(input.portfolioState.openPositionCount),
      dailyPnl: input.dailyPnl,
      cumulativePnl: input.cumulativePnl,
      sleeveAllocations: sleeves as unknown as Record<string, unknown>,
      venueExposures: serialiseMap(input.portfolioState.venueExposures),
      assetExposures: serialiseMap(input.portfolioState.assetExposures),
      riskMetrics: input.riskSummary as unknown as Record<string, unknown>,
    });

    await this.db
      .insert(portfolioCurrent)
      .values({
        id: 'primary',
        sourceSnapshotAt: input.snapshotAt,
        sourceRunId: input.sourceRunId,
        totalNav: input.portfolioState.totalNav,
        grossExposure: input.portfolioState.grossExposure,
        netExposure: input.portfolioState.netExposure,
        liquidityReserve: input.portfolioState.liquidityReserve,
        openPositionCount: String(input.portfolioState.openPositionCount),
        dailyPnl: input.dailyPnl,
        cumulativePnl: input.cumulativePnl,
        sleeveAllocations: sleeves as unknown as Record<string, unknown>,
        venueExposures: serialiseMap(input.portfolioState.venueExposures),
        assetExposures: serialiseMap(input.portfolioState.assetExposures),
        riskMetrics: input.riskSummary as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioCurrent.id,
        set: {
          sourceSnapshotAt: input.snapshotAt,
          sourceRunId: input.sourceRunId,
          totalNav: input.portfolioState.totalNav,
          grossExposure: input.portfolioState.grossExposure,
          netExposure: input.portfolioState.netExposure,
          liquidityReserve: input.portfolioState.liquidityReserve,
          openPositionCount: String(input.portfolioState.openPositionCount),
          dailyPnl: input.dailyPnl,
          cumulativePnl: input.cumulativePnl,
          sleeveAllocations: sleeves as unknown as Record<string, unknown>,
          venueExposures: serialiseMap(input.portfolioState.venueExposures),
          assetExposures: serialiseMap(input.portfolioState.assetExposures),
          riskMetrics: input.riskSummary as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      });
  }

  async syncPositions(positionsSnapshot: PositionView[]): Promise<void> {
    await this.db.execute(sql`DELETE FROM ${positions};`);

    if (positionsSnapshot.length === 0) {
      return;
    }

    await this.db.insert(positions).values(
      positionsSnapshot.map((positionRow) => ({
        id: positionRow.id,
        sleeveId: positionRow.sleeveId,
        venueId: positionRow.venueId,
        asset: positionRow.asset,
        side: positionRow.side,
        size: positionRow.size,
        entryPrice: positionRow.entryPrice,
        markPrice: positionRow.markPrice,
        unrealizedPnl: positionRow.unrealizedPnl,
        realizedPnl: positionRow.realizedPnl,
        fundingAccrued: positionRow.fundingAccrued,
        hedgeState: positionRow.hedgeState,
        status: positionRow.status,
        openedAt: new Date(positionRow.openedAt),
        closedAt: positionRow.closedAt !== null ? new Date(positionRow.closedAt) : null,
        updatedAt: new Date(positionRow.updatedAt),
      })),
    );
  }

  async persistFill(orderId: string, fill: OrderFill): Promise<void> {
    const [orderRow] = await this.db
      .select({
        id: orders.id,
        clientOrderId: orders.clientOrderId,
        venueOrderId: orders.venueOrderId,
        side: orders.side,
      })
      .from(orders)
      .where(eq(orders.clientOrderId, orderId))
      .limit(1);

    if (orderRow === undefined || orderRow.venueOrderId === null) {
      return;
    }

    await this.db
      .insert(fills)
      .values({
        orderId: orderRow.id,
        clientOrderId: orderRow.clientOrderId,
        venueOrderId: orderRow.venueOrderId,
        fillId: fill.fillId,
        size: fill.filledSize,
        price: fill.fillPrice,
        fee: fill.fee,
        side: orderRow.side,
        feeAsset: fill.feeAsset,
        filledAt: fill.filledAt,
        metadata: asRecord(fill),
      })
      .onConflictDoNothing({
        target: fills.id,
      });
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryView | null> {
    const [row] = await this.db
      .select()
      .from(portfolioCurrent)
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const sleevesRaw = Array.isArray(row.sleeveAllocations) ? row.sleeveAllocations : [];

    return {
      totalNav: row.totalNav,
      grossExposure: row.grossExposure,
      netExposure: row.netExposure,
      liquidityReserve: row.liquidityReserve,
      openPositionCount: Number.parseInt(row.openPositionCount, 10),
      dailyPnl: row.dailyPnl,
      cumulativePnl: row.cumulativePnl,
      sleeves: sleevesRaw.map((item) => ({
        sleeveId: String(asRecord(item)['sleeveId'] ?? 'unknown'),
        nav: String(asRecord(item)['nav'] ?? '0'),
        allocationPct: Number(asRecord(item)['allocationPct'] ?? 0),
      })),
      venueExposures: (row.venueExposures ?? {}) as Record<string, string>,
      assetExposures: (row.assetExposures ?? {}) as Record<string, string>,
      updatedAt: row.sourceSnapshotAt.toISOString(),
    };
  }

  async listPortfolioSnapshots(limit: number): Promise<PortfolioSnapshotView[]> {
    const rows = await this.db
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(limit);

    return Promise.all(rows.map(async (row) => this.getPortfolioSummaryFromRow(row)));
  }

  private async getPortfolioSummaryFromRow(
    row: typeof portfolioSnapshots.$inferSelect,
  ): Promise<PortfolioSnapshotView> {
    const sleevesRaw = Array.isArray(row.sleeveAllocations) ? row.sleeveAllocations : [];

    return {
      totalNav: row.totalNav,
      grossExposure: row.grossExposure,
      netExposure: row.netExposure,
      liquidityReserve: row.liquidityReserve,
      openPositionCount: Number.parseInt(row.openPositionCount, 10),
      dailyPnl: row.dailyPnl,
      cumulativePnl: row.cumulativePnl,
      sleeves: sleevesRaw.map((item) => ({
        sleeveId: String(asRecord(item)['sleeveId'] ?? 'unknown'),
        nav: String(asRecord(item)['nav'] ?? '0'),
        allocationPct: Number(asRecord(item)['allocationPct'] ?? 0),
      })),
      venueExposures: (row.venueExposures ?? {}) as Record<string, string>,
      assetExposures: (row.assetExposures ?? {}) as Record<string, string>,
      updatedAt: row.snapshotAt.toISOString(),
    };
  }

  async getPnlSummary(): Promise<PnlSummaryView> {
    const [row] = await this.db
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(1);

    return {
      dailyPnl: row?.dailyPnl ?? '0',
      cumulativePnl: row?.cumulativePnl ?? '0',
      lastSnapshotAt: row?.snapshotAt.toISOString() ?? null,
    };
  }

  async getRiskSummary(): Promise<RiskSummaryView | null> {
    const [row] = await this.db
      .select()
      .from(riskCurrent)
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      summary: row.summary as RiskSummary,
      approvedIntentCount: row.approvedIntentCount,
      rejectedIntentCount: row.rejectedIntentCount,
      capturedAt: row.capturedAt.toISOString(),
    };
  }

  async replacePortfolioCurrentFromSnapshot(
    row: typeof portfolioSnapshots.$inferSelect,
  ): Promise<void> {
    await this.db
      .insert(portfolioCurrent)
      .values({
        id: 'primary',
        sourceSnapshotAt: row.snapshotAt,
        sourceRunId: row.sourceRunId ?? null,
        totalNav: row.totalNav,
        grossExposure: row.grossExposure,
        netExposure: row.netExposure,
        liquidityReserve: row.liquidityReserve,
        openPositionCount: row.openPositionCount,
        dailyPnl: row.dailyPnl,
        cumulativePnl: row.cumulativePnl,
        sleeveAllocations: row.sleeveAllocations,
        venueExposures: row.venueExposures,
        assetExposures: row.assetExposures,
        riskMetrics: row.riskMetrics,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioCurrent.id,
        set: {
          sourceSnapshotAt: row.snapshotAt,
          sourceRunId: row.sourceRunId ?? null,
          totalNav: row.totalNav,
          grossExposure: row.grossExposure,
          netExposure: row.netExposure,
          liquidityReserve: row.liquidityReserve,
          openPositionCount: row.openPositionCount,
          dailyPnl: row.dailyPnl,
          cumulativePnl: row.cumulativePnl,
          sleeveAllocations: row.sleeveAllocations,
          venueExposures: row.venueExposures,
          assetExposures: row.assetExposures,
          riskMetrics: row.riskMetrics,
          updatedAt: new Date(),
        },
      });
  }

  async replaceRiskCurrentFromSnapshot(
    row: typeof riskSnapshots.$inferSelect,
  ): Promise<void> {
    await this.db
      .insert(riskCurrent)
      .values({
        id: 'primary',
        sourceRunId: row.runId,
        sleeveId: row.sleeveId,
        summary: row.summary,
        approvedIntentCount: row.approvedIntentCount,
        rejectedIntentCount: row.rejectedIntentCount,
        openCircuitBreakers: row.openCircuitBreakers,
        capturedAt: row.capturedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: riskCurrent.id,
        set: {
          sourceRunId: row.runId,
          sleeveId: row.sleeveId,
          summary: row.summary,
          approvedIntentCount: row.approvedIntentCount,
          rejectedIntentCount: row.rejectedIntentCount,
          openCircuitBreakers: row.openCircuitBreakers,
          capturedAt: row.capturedAt,
          updatedAt: new Date(),
        },
      });
  }

  async getLatestPortfolioSnapshotRow(): Promise<typeof portfolioSnapshots.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(1);

    return row ?? null;
  }

  async getLatestRiskSnapshotRow(): Promise<typeof riskSnapshots.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(riskSnapshots)
      .orderBy(desc(riskSnapshots.capturedAt))
      .limit(1);

    return row ?? null;
  }

  async getLatestSuccessfulRunId(): Promise<string | null> {
    const [row] = await this.db
      .select({ runId: strategyRuns.runId })
      .from(strategyRuns)
      .where(eq(strategyRuns.status, 'completed'))
      .orderBy(desc(strategyRuns.completedAt), desc(strategyRuns.startedAt))
      .limit(1);

    return row?.runId ?? null;
  }

  async getStrategyRun(runId: string): Promise<{
    runId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        runId: strategyRuns.runId,
        status: strategyRuns.status,
        startedAt: strategyRuns.startedAt,
        completedAt: strategyRuns.completedAt,
      })
      .from(strategyRuns)
      .where(eq(strategyRuns.runId, runId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      runId: row.runId,
      status: row.status,
      startedAt: row.startedAt.toISOString(),
      completedAt: toIsoString(row.completedAt),
    };
  }

  async listRuntimeCommands(limit: number): Promise<RuntimeCommandView[]> {
    const rows = await this.db
      .select()
      .from(runtimeCommands)
      .orderBy(desc(runtimeCommands.requestedAt))
      .limit(limit);

    return rows.map((row) => ({
      commandId: row.commandId,
      commandType: row.commandType as RuntimeCommandType,
      status: row.status as RuntimeCommandStatus,
      requestedBy: row.requestedBy,
      claimedBy: row.claimedBy ?? null,
      payload: asJsonObject(row.payload),
      result: asJsonObject(row.result),
      errorMessage: row.errorMessage ?? null,
      requestedAt: row.requestedAt.toISOString(),
      startedAt: toIsoString(row.startedAt),
      completedAt: toIsoString(row.completedAt),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listPositionsByVenue(venueId: string): Promise<PositionView[]> {
    const rows = await this.db
      .select()
      .from(positions)
      .where(eq(positions.venueId, venueId))
      .orderBy(desc(positions.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      sleeveId: row.sleeveId,
      venueId: row.venueId,
      asset: row.asset,
      side: row.side,
      size: row.size,
      entryPrice: row.entryPrice,
      markPrice: row.markPrice,
      unrealizedPnl: row.unrealizedPnl,
      realizedPnl: row.realizedPnl,
      fundingAccrued: row.fundingAccrued,
      hedgeState: row.hedgeState,
      status: row.status,
      openedAt: row.openedAt.toISOString(),
      closedAt: toIsoString(row.closedAt),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listFillHistory(): Promise<Array<{
    venueId: string;
    venueOrderId: string;
    clientOrderId: string;
    asset: string;
    side: 'buy' | 'sell';
    size: string;
    price: string;
    fee: string;
    feeAsset: string | null;
    reduceOnly: boolean;
    filledAt: Date;
  }>> {
    const rows = await this.db
      .select({
        venueId: orders.venueId,
        venueOrderId: fills.venueOrderId,
        clientOrderId: fills.clientOrderId,
        asset: orders.asset,
        side: fills.side,
        size: fills.size,
        price: fills.price,
        fee: fills.fee,
        feeAsset: fills.feeAsset,
        reduceOnly: orders.reduceOnly,
        filledAt: fills.filledAt,
      })
      .from(fills)
      .innerJoin(orders, eq(fills.clientOrderId, orders.clientOrderId))
      .orderBy(fills.filledAt, fills.createdAt);

    return rows.map((row) => ({
      venueId: row.venueId,
      venueOrderId: row.venueOrderId,
      clientOrderId: row.clientOrderId,
      asset: row.asset,
      side: row.side as 'buy' | 'sell',
      size: row.size,
      price: row.price,
      fee: row.fee,
      feeAsset: row.feeAsset,
      reduceOnly: row.reduceOnly,
      filledAt: row.filledAt,
    }));
  }

  async getInternalDerivativeSourceWatermark(venueId: string): Promise<string | null> {
    const [latestOrder, latestFill] = await Promise.all([
      this.db
        .select({
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .where(eq(orders.venueId, venueId))
        .orderBy(desc(orders.updatedAt))
        .limit(1)
        .then((rows) => rows[0]?.updatedAt ?? null),
      this.db
        .select({
          filledAt: fills.filledAt,
        })
        .from(fills)
        .innerJoin(orders, eq(fills.clientOrderId, orders.clientOrderId))
        .where(eq(orders.venueId, venueId))
        .orderBy(desc(fills.filledAt))
        .limit(1)
        .then((rows) => rows[0]?.filledAt ?? null),
    ]);

    if (latestOrder === null && latestFill === null) {
      return null;
    }

    const watermark = latestOrder === null
      ? latestFill
      : latestFill === null
        ? latestOrder
        : latestOrder > latestFill
          ? latestOrder
          : latestFill;

    return watermark?.toISOString() ?? null;
  }

  async listRiskBreaches(limit: number): Promise<RiskBreachView[]> {
    const rows = await this.db
      .select()
      .from(riskBreaches)
      .orderBy(desc(riskBreaches.triggeredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      breachType: row.breachType,
      severity: row.severity,
      description: row.description,
      triggeredAt: row.triggeredAt.toISOString(),
      resolvedAt: toIsoString(row.resolvedAt),
      details: (row.details ?? {}) as Record<string, unknown>,
    }));
  }

  async listOrders(limit: number): Promise<OrderView[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      clientOrderId: row.clientOrderId,
      runId: row.strategyRunId ?? null,
      sleeveId: row.sleeveId,
      opportunityId: row.opportunityId ?? null,
      venueId: row.venueId,
      venueOrderId: row.venueOrderId ?? null,
      asset: row.asset,
      side: row.side,
      orderType: row.orderType,
      executionMode: row.executionMode,
      requestedSize: row.requestedSize,
      requestedPrice: row.requestedPrice ?? null,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice ?? null,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError ?? null,
      reduceOnly: row.reduceOnly,
      metadata: asRecord(row.metadata),
      submittedAt: toIsoString(row.submittedAt),
      completedAt: toIsoString(row.completedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listOrdersByVenue(venueId: string): Promise<OrderView[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.venueId, venueId))
      .orderBy(desc(orders.createdAt));

    return rows.map((row) => ({
      clientOrderId: row.clientOrderId,
      runId: row.strategyRunId ?? null,
      sleeveId: row.sleeveId,
      opportunityId: row.opportunityId ?? null,
      venueId: row.venueId,
      venueOrderId: row.venueOrderId ?? null,
      asset: row.asset,
      side: row.side,
      orderType: row.orderType,
      executionMode: row.executionMode,
      requestedSize: row.requestedSize,
      requestedPrice: row.requestedPrice ?? null,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice ?? null,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError ?? null,
      reduceOnly: row.reduceOnly,
      metadata: asRecord(row.metadata),
      submittedAt: toIsoString(row.submittedAt),
      completedAt: toIsoString(row.completedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getOrder(clientOrderId: string): Promise<OrderView | null> {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.clientOrderId, clientOrderId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      clientOrderId: row.clientOrderId,
      runId: row.strategyRunId ?? null,
      sleeveId: row.sleeveId,
      opportunityId: row.opportunityId ?? null,
      venueId: row.venueId,
      venueOrderId: row.venueOrderId ?? null,
      asset: row.asset,
      side: row.side,
      orderType: row.orderType,
      executionMode: row.executionMode,
      requestedSize: row.requestedSize,
      requestedPrice: row.requestedPrice ?? null,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice ?? null,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError ?? null,
      reduceOnly: row.reduceOnly,
      metadata: asRecord(row.metadata),
      submittedAt: toIsoString(row.submittedAt),
      completedAt: toIsoString(row.completedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listPositions(limit: number): Promise<PositionView[]> {
    const rows = await this.db
      .select()
      .from(positions)
      .orderBy(desc(positions.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      sleeveId: row.sleeveId,
      venueId: row.venueId,
      asset: row.asset,
      side: row.side,
      size: row.size,
      entryPrice: row.entryPrice,
      markPrice: row.markPrice,
      unrealizedPnl: row.unrealizedPnl,
      realizedPnl: row.realizedPnl,
      fundingAccrued: row.fundingAccrued,
      hedgeState: row.hedgeState,
      status: row.status,
      openedAt: row.openedAt.toISOString(),
      closedAt: toIsoString(row.closedAt),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getPosition(id: string): Promise<PositionView | null> {
    const [row] = await this.db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      sleeveId: row.sleeveId,
      venueId: row.venueId,
      asset: row.asset,
      side: row.side,
      size: row.size,
      entryPrice: row.entryPrice,
      markPrice: row.markPrice,
      unrealizedPnl: row.unrealizedPnl,
      realizedPnl: row.realizedPnl,
      fundingAccrued: row.fundingAccrued,
      hedgeState: row.hedgeState,
      status: row.status,
      openedAt: row.openedAt.toISOString(),
      closedAt: toIsoString(row.closedAt),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listOpportunities(limit: number): Promise<OpportunityView[]> {
    const rows = await this.db
      .select()
      .from(strategyOpportunities)
      .orderBy(desc(strategyOpportunities.detectedAt))
      .limit(limit);

    return rows.map((row) => ({
      opportunityId: row.opportunityId,
      runId: row.runId,
      sleeveId: row.sleeveId,
      asset: row.asset,
      opportunityType: row.opportunityType,
      expectedAnnualYieldPct: row.expectedAnnualYieldPct,
      netYieldPct: row.netYieldPct,
      confidenceScore: row.confidenceScore,
      detectedAt: row.detectedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      approved: row.approved,
      payload: row.payload as Record<string, unknown>,
    }));
  }

  async getLatestStrategyRunId(): Promise<string | null> {
    const [row] = await this.db
      .select({ runId: strategyRuns.runId })
      .from(strategyRuns)
      .orderBy(desc(strategyRuns.createdAt))
      .limit(1);

    return row?.runId ?? null;
  }

  async listApprovedOpportunitiesForRun(runId: string): Promise<OpportunityView[]> {
    const rows = await this.db
      .select()
      .from(strategyOpportunities)
      .where(and(eq(strategyOpportunities.runId, runId), eq(strategyOpportunities.approved, true)))
      .orderBy(desc(strategyOpportunities.detectedAt));

    return rows.map((row) => ({
      opportunityId: row.opportunityId,
      runId: row.runId,
      sleeveId: row.sleeveId,
      asset: row.asset,
      opportunityType: row.opportunityType,
      expectedAnnualYieldPct: row.expectedAnnualYieldPct,
      netYieldPct: row.netYieldPct,
      confidenceScore: row.confidenceScore,
      detectedAt: row.detectedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      approved: row.approved,
      payload: row.payload as Record<string, unknown>,
    }));
  }

  async listApprovedStrategyIntentsForRun(runId: string): Promise<OrderIntent[]> {
    const rows = await this.db
      .select()
      .from(strategyIntents)
      .where(and(eq(strategyIntents.runId, runId), eq(strategyIntents.approved, true)))
      .orderBy(desc(strategyIntents.createdAt));

    return rows.map((row) => ({
      intentId: row.intentId,
      venueId: row.venueId,
      asset: row.asset,
      side: row.side as OrderIntent['side'],
      type: row.orderType as OrderIntent['type'],
      size: row.requestedSize,
      limitPrice: row.requestedPrice ?? null,
      opportunityId: row.opportunityId as OrderIntent['opportunityId'],
      reduceOnly: row.reduceOnly,
      createdAt: row.createdAt,
      metadata: asJsonObject(row.metadata),
    }));
  }

  async listRecentEvents(limit: number): Promise<AuditEventView[]> {
    const rows = await this.db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      eventId: row.eventId,
      eventType: row.eventType,
      occurredAt: row.occurredAt.toISOString(),
      actorType: row.actorType,
      actorId: row.actorId,
      sleeveId: row.sleeveId ?? null,
      correlationId: row.correlationId ?? null,
      data: row.data as Record<string, unknown>,
    }));
  }

  async upsertMismatch(input: {
    dedupeKey: string;
    category: string;
    severity: string;
    sourceKind?: RuntimeMismatchSourceKind;
    sourceComponent: string;
    entityType?: string | null;
    entityId?: string | null;
    summary: string;
    details?: Record<string, unknown>;
    detectedAt: Date;
  }): Promise<{
    mismatch: RuntimeMismatchView;
    outcome: 'opened' | 'redetected' | 'reopened';
  }> {
    const [existing] = await this.db
      .select()
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.dedupeKey, input.dedupeKey))
      .limit(1);

    if (existing === undefined) {
      await this.db.insert(runtimeMismatches).values({
        dedupeKey: input.dedupeKey,
        category: input.category,
        severity: input.severity,
        sourceKind: input.sourceKind ?? 'workflow',
        sourceComponent: input.sourceComponent,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        details: input.details ?? {},
        status: 'open',
        firstDetectedAt: input.detectedAt,
        lastDetectedAt: input.detectedAt,
        occurrenceCount: 1,
        lastStatusChangeAt: input.detectedAt,
        updatedAt: new Date(),
      });
      const mismatch = await this.getMismatchByDedupeKey(input.dedupeKey);
      if (mismatch === null) {
        throw new Error(`RuntimeStore.upsertMismatch: mismatch "${input.dedupeKey}" was not persisted`);
      }

      return {
        mismatch,
        outcome: 'opened',
      };
    }

    const currentStatus = existing.status as RuntimeMismatchStatus;
    const shouldReopen = currentStatus === 'resolved' || currentStatus === 'verified';
    const nextStatus: RuntimeMismatchStatus = shouldReopen ? 'reopened' : currentStatus;

    await this.db
      .update(runtimeMismatches)
      .set({
        category: input.category,
        severity: input.severity,
        sourceKind: input.sourceKind ?? existing.sourceKind,
        sourceComponent: input.sourceComponent,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        details: input.details ?? {},
        status: nextStatus,
        lastDetectedAt: input.detectedAt,
        occurrenceCount: existing.occurrenceCount + 1,
        ...(shouldReopen
          ? {
            reopenedAt: input.detectedAt,
            reopenedBy: input.sourceComponent,
            reopenSummary: input.summary,
            linkedCommandId: null,
            linkedRecoveryEventId: null,
            recoveryStartedAt: null,
            recoveryStartedBy: null,
            recoverySummary: null,
            lastStatusChangeAt: input.detectedAt,
          }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(runtimeMismatches.dedupeKey, input.dedupeKey));

    const mismatch = await this.getMismatchByDedupeKey(input.dedupeKey);
    if (mismatch === null) {
      throw new Error(`RuntimeStore.upsertMismatch: mismatch "${input.dedupeKey}" was not persisted`);
    }

    return {
      mismatch,
      outcome: shouldReopen ? 'reopened' : 'redetected',
    };
  }

  async getMismatchByDedupeKey(dedupeKey: string): Promise<RuntimeMismatchView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.dedupeKey, dedupeKey))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapMismatchRow(row);
  }

  async getMismatchById(mismatchId: string): Promise<RuntimeMismatchView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.id, mismatchId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapMismatchRow(row);
  }

  async updateMismatchById(
    mismatchId: string,
    patch: Partial<typeof runtimeMismatches.$inferInsert>,
  ): Promise<RuntimeMismatchView | null> {
    await this.db
      .update(runtimeMismatches)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(runtimeMismatches.id, mismatchId));

    return this.getMismatchById(mismatchId);
  }

  async updateMismatchByDedupeKey(
    dedupeKey: string,
    patch: Partial<typeof runtimeMismatches.$inferInsert>,
  ): Promise<RuntimeMismatchView | null> {
    await this.db
      .update(runtimeMismatches)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(runtimeMismatches.dedupeKey, dedupeKey));

    return this.getMismatchByDedupeKey(dedupeKey);
  }

  async listMismatches(
    limit: number,
    filters: {
      status?: RuntimeMismatchStatus;
      severity?: string;
      sourceKind?: RuntimeMismatchSourceKind;
      category?: string;
    } = {},
  ): Promise<RuntimeMismatchView[]> {
    const conditions = [
      filters.status !== undefined ? eq(runtimeMismatches.status, filters.status) : undefined,
      filters.severity !== undefined ? eq(runtimeMismatches.severity, filters.severity) : undefined,
      filters.sourceKind !== undefined ? eq(runtimeMismatches.sourceKind, filters.sourceKind) : undefined,
      filters.category !== undefined ? eq(runtimeMismatches.category, filters.category) : undefined,
    ].filter((condition): condition is Exclude<typeof condition, undefined> => condition !== undefined);

    const rows = conditions.length === 0
      ? await this.db
        .select()
        .from(runtimeMismatches)
        .orderBy(desc(runtimeMismatches.lastDetectedAt))
        .limit(limit)
      : await this.db
        .select()
        .from(runtimeMismatches)
        .where(and(...conditions))
        .orderBy(desc(runtimeMismatches.lastDetectedAt))
        .limit(limit);

    return rows.map((row) => mapMismatchRow(row));
  }

  async countOpenMismatches(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.status, 'open'));

    return Number(rows[0]?.count ?? 0);
  }

  async summarizeMismatches(): Promise<RuntimeMismatchSummaryView> {
    const rows = await this.db
      .select({
        status: runtimeMismatches.status,
        count: sql<number>`count(*)`,
      })
      .from(runtimeMismatches)
      .groupBy(runtimeMismatches.status);

    const statusCounts = createMismatchStatusCounts();
    let activeMismatchCount = 0;

    for (const row of rows) {
      const status = row.status as RuntimeMismatchStatus;
      const count = Number(row.count);
      statusCounts[status] = count;
      if (status !== 'verified') {
        activeMismatchCount += count;
      }
    }

    return {
      activeMismatchCount,
      statusCounts,
    };
  }

  async recordRecoveryEvent(input: {
    mismatchId?: string | null;
    commandId?: string | null;
    runId?: string | null;
    eventType: string;
    status: string;
    sourceComponent: string;
    actorId?: string | null;
    message: string;
    details?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<RuntimeRecoveryEventView> {
    const [inserted] = await this.db.insert(runtimeRecoveryEvents).values({
      mismatchId: input.mismatchId ?? null,
      commandId: input.commandId ?? null,
      runId: input.runId ?? null,
      eventType: input.eventType,
      status: input.status,
      sourceComponent: input.sourceComponent,
      actorId: input.actorId ?? null,
      message: input.message,
      details: input.details ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    }).returning();

    if (inserted === undefined) {
      throw new Error(`RuntimeStore.recordRecoveryEvent: event "${input.eventType}" was not persisted`);
    }

    return mapRecoveryEventRow(inserted);
  }

  async getRecoveryEventById(recoveryEventId: string): Promise<RuntimeRecoveryEventView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .where(eq(runtimeRecoveryEvents.id, recoveryEventId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapRecoveryEventRow(row);
  }

  async listRecoveryEventsForMismatch(
    mismatchId: string,
    limit: number,
  ): Promise<RuntimeRecoveryEventView[]> {
    const rows = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .where(eq(runtimeRecoveryEvents.mismatchId, mismatchId))
      .orderBy(desc(runtimeRecoveryEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => mapRecoveryEventRow(row));
  }

  async listRecoveryEvents(limit: number): Promise<RuntimeRecoveryEventView[]> {
    const rows = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .orderBy(desc(runtimeRecoveryEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => mapRecoveryEventRow(row));
  }

  async listRecoveryOutcomes(limit: number): Promise<RuntimeRecoveryEventView[]> {
    const rows = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .where(sql`${runtimeRecoveryEvents.status} in ('recovering', 'resolved', 'verified', 'reopened', 'completed', 'failed')`)
      .orderBy(desc(runtimeRecoveryEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => mapRecoveryEventRow(row));
  }

  async getLatestRecoveryEvent(): Promise<RuntimeRecoveryEventView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .orderBy(desc(runtimeRecoveryEvents.occurredAt))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return mapRecoveryEventRow(row);
  }

  async getMismatchDetail(
    mismatchId: string,
    recoveryEventLimit = 100,
  ): Promise<RuntimeMismatchDetailView | null> {
    const mismatch = await this.getMismatchById(mismatchId);
    if (mismatch === null) {
      return null;
    }

    const [linkedCommand, recoveryEvents, remediationHistory, reconciliationFindings] = await Promise.all([
      mismatch.linkedCommandId === null
        ? Promise.resolve<RuntimeCommandView | null>(null)
        : this.getRuntimeCommand(mismatch.linkedCommandId),
      this.listRecoveryEventsForMismatch(mismatchId, recoveryEventLimit),
      this.listMismatchRemediations(mismatchId),
      this.listReconciliationFindings({
        limit: recoveryEventLimit,
        mismatchId,
      }),
    ]);

    const latestRemediation = remediationHistory[0] ?? null;
    const latestReconciliationFinding = reconciliationFindings[0] ?? null;
    const remediationInFlight = remediationHistory.some(
      (remediation) => remediation.status === 'requested' || remediation.status === 'running',
    );

    return {
      mismatch,
      linkedCommand,
      recoveryEvents,
      remediationHistory,
      latestRemediation,
      reconciliationFindings,
      latestReconciliationFinding,
      recommendedRemediationTypes: recommendedRemediationsForMismatch(
        mismatch,
        latestReconciliationFinding,
      ),
      isActionable: isMismatchActionable(mismatch.status, remediationInFlight),
      remediationInFlight,
    };
  }

  async persistAllocatorEvaluation(input: {
    allocatorRunId: string;
    sourceRunId?: string | null;
    trigger: string;
    triggeredBy?: string | null;
    policy: AllocatorPolicy;
    evaluationInput: Record<string, unknown>;
    decision: AllocatorDecision;
    evaluatedAt: Date;
  }): Promise<void> {
    const carryTarget = input.decision.targets.find((target) => target.sleeveId === 'carry');
    const treasuryTarget = input.decision.targets.find((target) => target.sleeveId === 'treasury');

    await this.db.insert(allocatorRuns).values({
      allocatorRunId: input.allocatorRunId,
      sourceRunId: input.sourceRunId ?? null,
      trigger: input.trigger,
      triggeredBy: input.triggeredBy ?? null,
      regimeState: input.decision.regimeState,
      pressureLevel: input.decision.pressureLevel,
      totalCapitalUsd: input.decision.totalCapitalUsd,
      reserveConstrainedCapitalUsd: input.decision.reserveConstrainedCapitalUsd,
      allocatableCapitalUsd: input.decision.allocatableCapitalUsd,
      inputSnapshot: input.evaluationInput,
      policySnapshot: input.policy as unknown as Record<string, unknown>,
      rationale: input.decision.rationale as unknown as Record<string, unknown>[],
      constraints: input.decision.constraints as unknown as Record<string, unknown>[],
      summary: {
        carryTargetPct: carryTarget?.targetAllocationPct ?? 0,
        treasuryTargetPct: treasuryTarget?.targetAllocationPct ?? 0,
        targetCount: input.decision.targets.length,
      },
      recommendationCount: input.decision.recommendations.length,
      evaluatedAt: input.evaluatedAt,
      updatedAt: input.evaluatedAt,
    });

    if (input.decision.targets.length > 0) {
      await this.db.insert(allocatorSleeveTargets).values(
        input.decision.targets.map((target) => ({
          allocatorRunId: input.allocatorRunId,
          sleeveId: target.sleeveId,
          sleeveKind: target.sleeveKind,
          sleeveName: target.sleeveName,
          status: target.status,
          throttleState: target.throttleState,
          currentAllocationUsd: target.currentAllocationUsd,
          currentAllocationPct: target.currentAllocationPct.toFixed(4),
          targetAllocationUsd: target.targetAllocationUsd,
          targetAllocationPct: target.targetAllocationPct.toFixed(4),
          minAllocationPct: target.minAllocationPct.toFixed(4),
          maxAllocationPct: target.maxAllocationPct.toFixed(4),
          deltaUsd: target.deltaUsd,
          opportunityScore: target.opportunityScore === null ? null : target.opportunityScore.toFixed(4),
          capacityUsd: target.capacityUsd,
          rationale: target.rationale as unknown as Record<string, unknown>[],
          metadata: target.metadata,
          updatedAt: input.evaluatedAt,
        })),
      );
    }

    if (input.decision.recommendations.length > 0) {
      await this.db.insert(allocatorRecommendations).values(
        input.decision.recommendations.map((recommendation) => ({
          allocatorRunId: input.allocatorRunId,
          sleeveId: recommendation.sleeveId,
          recommendationType: recommendation.recommendationType,
          priority: recommendation.priority,
          summary: recommendation.summary,
          details: recommendation.details,
          rationale: recommendation.rationale as unknown as Record<string, unknown>[],
        })),
      );
    }

    const currentSummary = {
      allocatorRunId: input.allocatorRunId,
      sourceRunId: input.sourceRunId ?? null,
      trigger: input.trigger,
      triggeredBy: input.triggeredBy ?? null,
      regimeState: input.decision.regimeState,
      pressureLevel: input.decision.pressureLevel,
      totalCapitalUsd: input.decision.totalCapitalUsd,
      reserveConstrainedCapitalUsd: input.decision.reserveConstrainedCapitalUsd,
      allocatableCapitalUsd: input.decision.allocatableCapitalUsd,
      carryTargetPct: carryTarget?.targetAllocationPct ?? 0,
      treasuryTargetPct: treasuryTarget?.targetAllocationPct ?? 0,
      recommendationCount: input.decision.recommendations.length,
      evaluatedAt: input.evaluatedAt.toISOString(),
    };

    await this.db
      .insert(allocatorCurrent)
      .values({
        id: 'primary',
        latestAllocatorRunId: input.allocatorRunId,
        summary: currentSummary,
        updatedAt: input.evaluatedAt,
      })
      .onConflictDoUpdate({
        target: allocatorCurrent.id,
        set: {
          latestAllocatorRunId: input.allocatorRunId,
          summary: currentSummary,
          updatedAt: input.evaluatedAt,
        },
      });
  }

  async getAllocatorSummary(): Promise<AllocatorSummaryView | null> {
    const [current] = await this.db
      .select()
      .from(allocatorCurrent)
      .where(eq(allocatorCurrent.id, 'primary'))
      .limit(1);

    if (current === undefined) {
      return null;
    }

    const [runRow] = await this.db
      .select()
      .from(allocatorRuns)
      .where(eq(allocatorRuns.allocatorRunId, current.latestAllocatorRunId))
      .limit(1);

    return runRow === undefined ? null : mapAllocatorSummaryRow(runRow);
  }

  async listAllocatorTargets(limit = 20): Promise<AllocatorSleeveTargetView[]> {
    const runs = await this.listAllocatorRuns(limit);
    const latestRunId = runs[0]?.allocatorRunId;
    if (latestRunId === undefined) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(allocatorSleeveTargets)
      .where(eq(allocatorSleeveTargets.allocatorRunId, latestRunId));

    return rows.map(mapAllocatorTargetRow);
  }

  async listAllocatorRuns(limit = 20): Promise<AllocatorRunView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRuns)
      .orderBy(desc(allocatorRuns.evaluatedAt))
      .limit(limit);

    return rows.map(mapAllocatorRunRow);
  }

  async getAllocatorDecision(
    allocatorRunId: string,
  ): Promise<AllocatorDecisionDetailView | null> {
    const [runRow] = await this.db
      .select()
      .from(allocatorRuns)
      .where(eq(allocatorRuns.allocatorRunId, allocatorRunId))
      .limit(1);

    if (runRow === undefined) {
      return null;
    }

    const [summary, targetRows, recommendationRows] = await Promise.all([
      this.getAllocatorSummary(),
      this.db
        .select()
        .from(allocatorSleeveTargets)
        .where(eq(allocatorSleeveTargets.allocatorRunId, allocatorRunId)),
      this.db
        .select()
        .from(allocatorRecommendations)
        .where(eq(allocatorRecommendations.allocatorRunId, allocatorRunId))
        .orderBy(desc(allocatorRecommendations.createdAt)),
    ]);

    return {
      run: mapAllocatorRunRow(runRow),
      summary,
      targets: targetRows.map(mapAllocatorTargetRow),
      recommendations: recommendationRows.map(mapAllocatorRecommendationRow),
      rationale: asAllocatorRationales(runRow.rationale),
      constraints: Array.isArray(runRow.constraints)
        ? runRow.constraints as AllocatorDecisionDetailView['constraints']
        : [],
    };
  }

  async createRebalanceProposal(input: {
    proposal: RebalanceProposal;
    createdAt: Date;
  }): Promise<RebalanceProposalView> {
    const [row] = await this.db
      .insert(allocatorRebalanceProposals)
      .values({
        allocatorRunId: input.proposal.allocatorRunId,
        actionType: input.proposal.actionType,
        status: input.proposal.status,
        summary: input.proposal.summary,
        executionMode: input.proposal.executionMode,
        simulated: input.proposal.simulated,
        executable: input.proposal.executable,
        approvalRequirement: input.proposal.approvalRequirement,
        rationale: input.proposal.rationale as unknown as Record<string, unknown>[],
        blockedReasons: input.proposal.blockedReasons as unknown as Record<string, unknown>[],
        details: input.proposal.details,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createRebalanceProposal: proposal was not persisted');
    }

    if (input.proposal.intents.length > 0) {
      await this.db.insert(allocatorRebalanceProposalIntents).values(
        input.proposal.intents.map((intent: RebalanceProposal['intents'][number]) => ({
          proposalId: row['id'],
          sleeveId: intent.sleeveId,
          sourceSleeveId: intent.sourceSleeveId,
          targetSleeveId: intent.targetSleeveId,
          actionType: intent.actionType,
          status: intent.status,
          readiness: intent.readiness,
          executable: intent.executable,
          currentAllocationUsd: intent.currentAllocationUsd,
          currentAllocationPct: intent.currentAllocationPct.toFixed(4),
          targetAllocationUsd: intent.targetAllocationUsd,
          targetAllocationPct: intent.targetAllocationPct.toFixed(4),
          deltaUsd: intent.deltaUsd,
          rationale: intent.rationale as unknown as Record<string, unknown>[],
          blockedReasons: intent.blockedReasons as unknown as Record<string, unknown>[],
          details: intent.details,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        })),
      );
    }

    await this.db.insert(allocatorRebalanceBundles).values({
      proposalId: row.id,
      status: input.proposal.status,
      completionState: 'open',
      outcomeClassification: 'pending',
      interventionRecommendation: input.proposal.status === 'proposed'
        ? 'operator_review_required'
        : 'wait_for_inflight_children',
      totalChildCount: 0,
      blockedChildCount: input.proposal.blockedReasons.length > 0 || !input.proposal.executable ? 1 : 0,
      failedChildCount: 0,
      completedChildCount: 0,
      pendingChildCount: 0,
      childRollup: {},
      finalizationReason: null,
      finalizedAt: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });

    return mapRebalanceProposalRow(row);
  }

  async listRebalanceProposals(limit = 50): Promise<RebalanceProposalView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRebalanceProposals)
      .orderBy(desc(allocatorRebalanceProposals.createdAt))
      .limit(limit);

    return rows.map(mapRebalanceProposalRow);
  }

  async listRebalanceProposalsForDecision(
    allocatorRunId: string,
  ): Promise<RebalanceProposalView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRebalanceProposals)
      .where(eq(allocatorRebalanceProposals.allocatorRunId, allocatorRunId))
      .orderBy(desc(allocatorRebalanceProposals.createdAt));

    return rows.map(mapRebalanceProposalRow);
  }

  async listRebalanceBundles(limit = 50): Promise<RebalanceBundleView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRebalanceBundles)
      .orderBy(desc(allocatorRebalanceBundles.createdAt))
      .limit(limit);

    return (
      await Promise.all(rows.map(async (row): Promise<RebalanceBundleView | null> => {
        const detail = await this.getRebalanceProposal(row['proposalId']);
        return detail === null ? null : mapRebalanceBundleRow(row, detail.proposal);
      }))
    ).filter((bundle): bundle is RebalanceBundleView => bundle !== null);
  }

  async listRebalanceEscalations(
    filters: RebalanceEscalationQueueFilters = {},
  ): Promise<RebalanceEscalationQueueItemView[]> {
    const limit = Math.min(filters.limit ?? 100, 200);
    const sortBy = filters.sortBy ?? 'latest_activity';
    const sortDirection = filters.sortDirection ?? 'desc';
    const now = new Date();

    const [escalationRows, bundleRows, proposalRows, eventRows] = await Promise.all([
      this.db
        .select()
        .from(allocatorRebalanceBundleEscalations)
        .orderBy(desc(allocatorRebalanceBundleEscalations.updatedAt))
        .limit(400),
      this.db.select().from(allocatorRebalanceBundles),
      this.db.select().from(allocatorRebalanceProposals),
      this.db
        .select()
        .from(allocatorRebalanceBundleEscalationEvents)
        .orderBy(desc(allocatorRebalanceBundleEscalationEvents.createdAt)),
    ]);

    const bundleById = new Map(bundleRows.map((row) => [row.id, row] as const));
    const proposalById = new Map(proposalRows.map((row) => [row.id, row] as const));
    const latestEventByEscalationId = new Map<string, typeof allocatorRebalanceBundleEscalationEvents.$inferSelect>();
    const acknowledgedAtByEscalationId = new Map<string, string>();
    const inReviewAtByEscalationId = new Map<string, string>();

    for (const row of eventRows) {
      if (!latestEventByEscalationId.has(row.escalationId)) {
        latestEventByEscalationId.set(row.escalationId, row);
      }
      if (row.eventType === 'acknowledged' && !acknowledgedAtByEscalationId.has(row.escalationId)) {
        acknowledgedAtByEscalationId.set(row.escalationId, row.createdAt.toISOString());
      }
      if (row.eventType === 'review_started' && !inReviewAtByEscalationId.has(row.escalationId)) {
        inReviewAtByEscalationId.set(row.escalationId, row.createdAt.toISOString());
      }
    }

    const items = escalationRows.flatMap((escalationRow): RebalanceEscalationQueueItemView[] => {
      const bundleRow = bundleById.get(escalationRow.bundleId);
      const proposalRow = proposalById.get(escalationRow.proposalId);
      if (bundleRow === undefined || proposalRow === undefined) {
        return [];
      }

      const latestEvent = latestEventByEscalationId.get(escalationRow.id);
      const queueState = deriveEscalationQueueState({
        status: escalationRow.status as RebalanceBundleEscalationStatus,
        ownerId: escalationRow.ownerId ?? null,
        dueAt: toIsoString(escalationRow.dueAt),
        now,
      });
      const childRollup = asJsonObject(bundleRow.childRollup);
      const childSleeves = ['carry', 'treasury'].filter((sleeve): sleeve is 'carry' | 'treasury' => {
        const rollup = childRollup[sleeve];
        return typeof rollup === 'object' && rollup !== null;
      });
      const latestEventSummary = latestEvent === undefined
        ? escalationRow.handoffNote ?? escalationRow.reviewNote ?? escalationRow.resolutionNote ?? null
        : latestEvent.note ?? `${latestEvent.eventType} -> ${latestEvent.toStatus}`;
      const item: RebalanceEscalationQueueItemView = {
        escalationId: escalationRow.id,
        bundleId: bundleRow.id,
        proposalId: proposalRow.id,
        allocatorRunId: proposalRow.allocatorRunId,
        escalationStatus: escalationRow.status as RebalanceBundleEscalationStatus,
        escalationQueueState: queueState,
        isOpen: escalationRow.status !== 'resolved',
        ownerId: escalationRow.ownerId ?? null,
        assignedBy: escalationRow.assignedBy ?? null,
        assignedAt: toIsoString(escalationRow.assignedAt),
        acknowledgedAt: acknowledgedAtByEscalationId.get(escalationRow.id) ?? toIsoString(escalationRow.acknowledgedAt),
        inReviewAt: inReviewAtByEscalationId.get(escalationRow.id) ?? null,
        dueAt: toIsoString(escalationRow.dueAt),
        latestActivityAt: latestEvent?.createdAt.toISOString() ?? escalationRow.updatedAt.toISOString(),
        latestEventType: latestEvent?.eventType as RebalanceBundleEscalationEventType | null ?? null,
        latestEventSummary,
        bundleStatus: bundleRow.status as RebalanceBundleStatus,
        interventionRecommendation: bundleRow.interventionRecommendation as RebalanceBundleInterventionRecommendation,
        resolutionState: bundleRow.resolutionState as RebalanceBundleResolutionState,
        outcomeClassification: bundleRow.outcomeClassification as RebalanceBundleOutcomeClassification,
        failedChildCount: bundleRow.failedChildCount,
        blockedChildCount: bundleRow.blockedChildCount,
        pendingChildCount: bundleRow.pendingChildCount,
        totalChildCount: bundleRow.totalChildCount,
        childSleeves,
        executionMode: proposalRow.executionMode as RebalanceProposalView['executionMode'],
        simulated: proposalRow.simulated,
        createdAt: escalationRow.createdAt.toISOString(),
        updatedAt: escalationRow.updatedAt.toISOString(),
      };

      return [item];
    });

    const filtered = items.filter((item) => {
      if (filters.status !== undefined && item.escalationStatus !== filters.status) {
        return false;
      }
      if (filters.ownerId !== undefined && item.ownerId !== filters.ownerId) {
        return false;
      }
      if (filters.openState === 'open' && !item.isOpen) {
        return false;
      }
      if (filters.openState === 'closed' && item.isOpen) {
        return false;
      }
      if (filters.queueState !== undefined && item.escalationQueueState !== filters.queueState) {
        return false;
      }

      return true;
    });

    return sortEscalationQueueItems(filtered, sortBy, sortDirection).slice(0, limit);
  }

  async getRebalanceEscalationSummary(
    actorId?: string | null,
  ): Promise<RebalanceEscalationQueueSummaryView> {
    const items = await this.listRebalanceEscalations({ limit: 200 });

    return items.reduce<RebalanceEscalationQueueSummaryView>((summary, item) => {
      summary.total += 1;
      if (item.isOpen) {
        summary.open += 1;
      }
      if (item.escalationStatus === 'acknowledged') {
        summary.acknowledged += 1;
      }
      if (item.escalationStatus === 'in_review') {
        summary.inReview += 1;
      }
      if (item.escalationStatus === 'resolved') {
        summary.resolved += 1;
      }
      if (item.escalationQueueState === 'overdue') {
        summary.overdue += 1;
      }
      if (item.escalationQueueState === 'due_soon') {
        summary.dueSoon += 1;
      }
      if (item.ownerId === null && item.isOpen) {
        summary.unassigned += 1;
      }
      if (actorId !== undefined && actorId !== null && item.ownerId === actorId && item.isOpen) {
        summary.mine += 1;
      }

      return summary;
    }, {
      total: 0,
      open: 0,
      acknowledged: 0,
      inReview: 0,
      resolved: 0,
      overdue: 0,
      dueSoon: 0,
      unassigned: 0,
      mine: 0,
    });
  }

  async getRebalanceProposal(proposalId: string): Promise<RebalanceProposalDetailView | null> {
    const [proposalRow] = await this.db
      .select()
      .from(allocatorRebalanceProposals)
      .where(eq(allocatorRebalanceProposals.id, proposalId))
      .limit(1);

    if (proposalRow === undefined) {
      return null;
    }

    const [intentRows, executionRows, latestCommand, currentState] = await Promise.all([
      this.db
        .select()
        .from(allocatorRebalanceProposalIntents)
        .where(eq(allocatorRebalanceProposalIntents.proposalId, proposalRow['id']))
        .orderBy(desc(allocatorRebalanceProposalIntents.createdAt)),
      this.db
        .select()
        .from(allocatorRebalanceExecutions)
        .where(eq(allocatorRebalanceExecutions.proposalId, proposalRow['id']))
        .orderBy(desc(allocatorRebalanceExecutions.createdAt)),
      proposalRow['linkedCommandId'] === null
        ? Promise.resolve<RuntimeCommandView | null>(null)
        : this.getRuntimeCommand(proposalRow['linkedCommandId']),
      this.getRebalanceCurrent(),
    ]);

    return {
      proposal: mapRebalanceProposalRow(proposalRow),
      intents: intentRows.map(mapRebalanceIntentRow),
      latestCommand,
      executions: executionRows.map(mapRebalanceExecutionRow),
      currentState,
    };
  }

  async syncRebalanceBundleForProposal(
    proposalId: string,
  ): Promise<RebalanceBundleDetailView | null> {
    const graph = await this.getRebalanceExecutionGraph(proposalId);
    if (graph === null) {
      return null;
    }

    const [existingRow] = await this.db
      .select()
      .from(allocatorRebalanceBundles)
      .where(eq(allocatorRebalanceBundles.proposalId, proposalId))
      .limit(1);

    const snapshot = deriveRebalanceBundleSnapshot(graph);
    const updatedAt = new Date();
    let bundleRow = existingRow;
    const resolvedRecommendation = existingRow === undefined
      ? null
      : recommendationForResolutionState(existingRow.resolutionState as RebalanceBundleResolutionState);
    const nextRecommendation = resolvedRecommendation ?? snapshot.interventionRecommendation;

    if (bundleRow === undefined) {
      const [insertedRow] = await this.db
        .insert(allocatorRebalanceBundles)
        .values({
          proposalId,
          status: snapshot.status,
          completionState: snapshot.completionState,
          outcomeClassification: snapshot.outcomeClassification,
          interventionRecommendation: nextRecommendation,
          totalChildCount: snapshot.totalChildCount,
          blockedChildCount: snapshot.blockedChildCount,
          failedChildCount: snapshot.failedChildCount,
          completedChildCount: snapshot.completedChildCount,
          pendingChildCount: snapshot.pendingChildCount,
          childRollup: snapshot.childRollup,
          finalizationReason: snapshot.finalizationReason,
          finalizedAt: snapshot.finalizedAt === null ? null : new Date(snapshot.finalizedAt),
          resolutionState: 'unresolved',
          latestResolutionActionId: null,
          resolutionSummary: null,
          resolvedBy: null,
          resolvedAt: null,
          latestEscalationId: null,
          escalationStatus: null,
          escalationOwnerId: null,
          escalationAssignedAt: null,
          escalationDueAt: null,
          escalationSummary: null,
          createdAt: updatedAt,
          updatedAt,
        })
        .returning();
      bundleRow = insertedRow;
    } else {
      const [updatedRow] = await this.db
        .update(allocatorRebalanceBundles)
        .set({
          status: snapshot.status,
          completionState: snapshot.completionState,
          outcomeClassification: snapshot.outcomeClassification,
          interventionRecommendation: nextRecommendation,
          totalChildCount: snapshot.totalChildCount,
          blockedChildCount: snapshot.blockedChildCount,
          failedChildCount: snapshot.failedChildCount,
          completedChildCount: snapshot.completedChildCount,
          pendingChildCount: snapshot.pendingChildCount,
          childRollup: snapshot.childRollup,
          finalizationReason: snapshot.finalizationReason,
          finalizedAt: snapshot.finalizedAt === null ? null : new Date(snapshot.finalizedAt),
          updatedAt,
        })
        .where(eq(allocatorRebalanceBundles.id, bundleRow['id']))
        .returning();
      bundleRow = updatedRow;
    }

    if (bundleRow === undefined) {
      throw new Error('RuntimeStore.syncRebalanceBundleForProposal: bundle was not persisted');
    }

    const bundle = mapRebalanceBundleRow(bundleRow, graph.detail.proposal);
    const detail: RebalanceBundleDetailView = {
      bundle,
      graph,
      partialProgress: {
        totalChildren: 0,
        appliedChildren: 0,
        progressRecordedChildren: 0,
        retryableChildren: 0,
        nonRetryableChildren: 0,
        blockedBeforeApplicationChildren: 0,
        inflightChildren: 0,
        sleeves: [],
        children: [],
      },
      recoveryCandidates: [],
      recoveryActions: [],
      resolutionOptions: [],
      resolutionActions: [],
      escalation: null,
      escalationHistory: [],
      escalationTransitions: [],
    };
    const [recoveryActions, recoveryCandidates, resolutionActions, escalation, escalationHistory] = await Promise.all([
      this.listRebalanceBundleRecoveryActions(bundle.id),
      this.buildRebalanceBundleRecoveryCandidatesForBundle(detail),
      this.listRebalanceBundleResolutionActions(bundle.id),
      this.getRebalanceBundleEscalation(bundle.id),
      this.listRebalanceBundleEscalationHistory(bundle.id),
    ]);
    const partialProgress = await this.buildBundlePartialProgress(detail, recoveryCandidates);
    const resolutionOptions = this.buildBundleResolutionOptions(detail, partialProgress);
    const escalationTransitions = this.buildBundleEscalationTransitions(detail, escalation);

    return {
      bundle,
      graph: {
        ...graph,
        resolutionActions,
        escalation,
        escalationHistory,
      },
      partialProgress,
      recoveryCandidates,
      recoveryActions,
      resolutionOptions,
      resolutionActions,
      escalation,
      escalationHistory,
      escalationTransitions,
    };
  }

  async getRebalanceBundle(bundleId: string): Promise<RebalanceBundleDetailView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundles)
      .where(eq(allocatorRebalanceBundles.id, bundleId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return this.syncRebalanceBundleForProposal(row['proposalId']);
  }

  async getRebalanceBundleForProposal(proposalId: string): Promise<RebalanceBundleDetailView | null> {
    return this.syncRebalanceBundleForProposal(proposalId);
  }

  private async buildRebalanceBundleRecoveryCandidatesForBundle(
    bundle: RebalanceBundleDetailView,
  ): Promise<RebalanceBundleRecoveryCandidateView[]> {
    const [carryCandidates, treasuryCandidates] = await Promise.all([
      Promise.all(bundle.graph.downstream.carry.actions.map(async (node) => this.buildCarryRecoveryCandidate(bundle, node))),
      Promise.all(bundle.graph.downstream.treasury.actions.map(async (node) => this.buildTreasuryRecoveryCandidate(bundle, node))),
    ]);

    return [
      ...carryCandidates,
      ...treasuryCandidates,
      this.buildProposalRecoveryCandidate(bundle),
    ];
  }

  async listRebalanceBundleRecoveryActions(
    bundleId: string,
  ): Promise<RebalanceBundleRecoveryActionView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRebalanceBundleRecoveryActions)
      .where(eq(allocatorRebalanceBundleRecoveryActions.bundleId, bundleId))
      .orderBy(desc(allocatorRebalanceBundleRecoveryActions.requestedAt));

    return rows.map(mapRebalanceBundleRecoveryActionRow);
  }

  async getRebalanceBundleRecoveryAction(
    bundleId: string,
    recoveryActionId: string,
  ): Promise<RebalanceBundleRecoveryActionView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleRecoveryActions)
      .where(and(
        eq(allocatorRebalanceBundleRecoveryActions.bundleId, bundleId),
        eq(allocatorRebalanceBundleRecoveryActions.id, recoveryActionId),
      ))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleRecoveryActionRow(row);
  }

  private buildBundleRecoveryBlockedReason(
    code: RebalanceBundleRecoveryBlockedReason['code'],
    category: RebalanceBundleRecoveryBlockedReason['category'],
    message: string,
    operatorAction: string,
    details: Record<string, unknown> = {},
  ): RebalanceBundleRecoveryBlockedReason {
    return {
      code,
      category,
      message,
      operatorAction,
      details,
    };
  }

  private buildProposalRecoveryCandidate(
    bundle: RebalanceBundleDetailView,
  ): RebalanceBundleRecoveryCandidateView {
    const now = new Date().toISOString();
    return {
      id: `${bundle.bundle.id}:rebalance_proposal:${bundle.bundle.proposalId}:requeue_child_execution`,
      bundleId: bundle.bundle.id,
      proposalId: bundle.bundle.proposalId,
      recoveryActionType: 'requeue_child_execution',
      targetChildType: 'rebalance_proposal',
      targetChildId: bundle.bundle.proposalId,
      targetChildStatus: bundle.graph.detail.proposal.status,
      targetChildSummary: bundle.graph.detail.proposal.summary,
      targetCommandType: 'execute_rebalance_proposal',
      approvalRequirement: bundle.graph.detail.proposal.approvalRequirement,
      eligibilityState: 'blocked',
      blockedReasons: [this.buildBundleRecoveryBlockedReason(
        'proposal_requeue_not_supported',
        'safety',
        'Proposal-level rebalance retry is not safely supported in this pass because it can duplicate downstream child work.',
        'Inspect child actions directly and use child-scoped recovery actions when they are explicitly eligible.',
        {
          proposalId: bundle.bundle.proposalId,
        },
      )],
      executionMode: bundle.bundle.executionMode,
      simulated: bundle.bundle.simulated,
      note: 'Bundle recovery currently supports explicit child action recovery only.',
      createdAt: now,
      updatedAt: now,
    };
  }

  private async buildCarryRecoveryCandidate(
    bundle: RebalanceBundleDetailView,
    node: RebalanceCarryActionNodeView,
  ): Promise<RebalanceBundleRecoveryCandidateView> {
    const blockedReasons: RebalanceBundleRecoveryBlockedReason[] = [];
    const now = new Date().toISOString();
    const stepRows = await this.db
      .select()
      .from(carryExecutionSteps)
      .where(eq(carryExecutionSteps.carryActionId, node.action.id));
    const actionableBundleStatuses: RebalanceBundleStatus[] = [
      'failed',
      'blocked',
      'requires_intervention',
      'partially_completed',
    ];

    if (!actionableBundleStatuses.includes(bundle.bundle.status)) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'bundle_not_actionable',
        'bundle_state',
        `Bundle status "${bundle.bundle.status}" does not permit recovery mutation requests.`,
        'Wait for the bundle to reach a failed, blocked, partial, or intervention-required state before requesting recovery.',
        {
          bundleStatus: bundle.bundle.status,
        },
      ));
    }

    const runtimeStatus = await this.getRuntimeStatus();
    if (
      runtimeStatus.halted
      || runtimeStatus.lifecycleState === 'paused'
      || runtimeStatus.lifecycleState === 'stopped'
      || runtimeStatus.lifecycleState === 'starting'
    ) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'runtime_not_ready',
        'runtime',
        'Runtime is not in a state that permits child recovery execution.',
        'Return runtime to ready state before requesting bundle recovery.',
        {
          lifecycleState: runtimeStatus.lifecycleState,
          halted: runtimeStatus.halted,
        },
      ));
    }

    if (node.executions.some((execution) => execution.status === 'completed') || node.action.status === 'completed') {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_already_completed',
        'target_child',
        'Carry child already completed successfully and should not be retried.',
        'Inspect the completed child execution history instead of requeueing it.',
        {
          carryActionId: node.action.id,
        },
      ));
    }

    if (node.action.status === 'queued' || node.action.status === 'executing') {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_has_inflight_command',
        'target_child',
        'Carry child is already queued or executing.',
        'Wait for the in-flight carry child to settle before requesting another recovery action.',
        {
          carryActionId: node.action.id,
          status: node.action.status,
          linkedCommandId: node.action.linkedCommandId,
        },
      ));
    }

    if (node.action.status === 'cancelled') {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_not_retryable',
        'target_child',
        'Cancelled carry children are inspect-only in this pass.',
        'Create a new allocator or carry evaluation if a replacement action is required.',
        {
          carryActionId: node.action.id,
        },
      ));
    }

    if (!node.action.executable || node.action.blockedReasons.length > 0) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_remains_blocked',
        'safety',
        'Carry child remains operationally blocked and cannot be requeued safely.',
        'Resolve the carry child blocked reasons before requesting recovery.',
        {
          carryActionId: node.action.id,
          blockedReasons: node.action.blockedReasons,
        },
      ));
    }

    const latestFailedExecution = node.executions.find((execution) => execution.id === node.action.latestExecutionId)
      ?? node.executions.find((execution) => execution.status === 'failed')
      ?? null;
    const hasExecutionSideEffects = node.executions.some((execution) => execution.venueExecutionReference !== null)
      || stepRows.some((row) =>
        row.executionReference !== null
        || row.venueOrderId !== null
        || !['pending', 'failed'].includes(row.status),
      );
    if (hasExecutionSideEffects) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'carry_execution_partial_progress_detected',
        'safety',
        'Carry child shows partial execution progress, so replaying it could duplicate fills or orders.',
        'Inspect the carry execution detail and resolve the partial application manually before retrying.',
        {
          carryActionId: node.action.id,
          latestExecutionId: latestFailedExecution?.id ?? null,
        },
      ));
    }

    if (
      !['recommended', 'approved', 'failed'].includes(node.action.status)
      && node.action.status !== 'completed'
      && node.action.status !== 'cancelled'
      && node.action.status !== 'queued'
      && node.action.status !== 'executing'
    ) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_not_retryable',
        'target_child',
        `Carry child status "${node.action.status}" is not supported for bundle recovery.`,
        'Inspect the child action directly before requesting recovery.',
        {
          carryActionId: node.action.id,
          status: node.action.status,
        },
      ));
    }

    return {
      id: `${bundle.bundle.id}:carry_action:${node.action.id}:requeue_child_execution`,
      bundleId: bundle.bundle.id,
      proposalId: bundle.bundle.proposalId,
      recoveryActionType: 'requeue_child_execution',
      targetChildType: 'carry_action',
      targetChildId: node.action.id,
      targetChildStatus: node.action.status,
      targetChildSummary: node.action.summary,
      targetCommandType: 'execute_carry_action',
      approvalRequirement: node.action.approvalRequirement,
      eligibilityState: blockedReasons.length === 0 ? 'eligible' : 'blocked',
      blockedReasons,
      executionMode: node.action.executionMode,
      simulated: node.action.simulated,
      note: latestFailedExecution === null
        ? 'Carry child can be requeued from its persisted action record because no venue-side progress is recorded.'
        : `Latest failed carry execution: ${latestFailedExecution.id}.`,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async buildTreasuryRecoveryCandidate(
    bundle: RebalanceBundleDetailView,
    node: RebalanceTreasuryActionNodeView,
  ): Promise<RebalanceBundleRecoveryCandidateView> {
    const blockedReasons: RebalanceBundleRecoveryBlockedReason[] = [];
    const now = new Date().toISOString();
    const actionableBundleStatuses: RebalanceBundleStatus[] = [
      'failed',
      'blocked',
      'requires_intervention',
      'partially_completed',
    ];

    if (!actionableBundleStatuses.includes(bundle.bundle.status)) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'bundle_not_actionable',
        'bundle_state',
        `Bundle status "${bundle.bundle.status}" does not permit recovery mutation requests.`,
        'Wait for the bundle to reach a failed, blocked, partial, or intervention-required state before requesting recovery.',
        {
          bundleStatus: bundle.bundle.status,
        },
      ));
    }

    const runtimeStatus = await this.getRuntimeStatus();
    if (
      runtimeStatus.halted
      || runtimeStatus.lifecycleState === 'paused'
      || runtimeStatus.lifecycleState === 'stopped'
      || runtimeStatus.lifecycleState === 'starting'
    ) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'runtime_not_ready',
        'runtime',
        'Runtime is not in a state that permits child recovery execution.',
        'Return runtime to ready state before requesting bundle recovery.',
        {
          lifecycleState: runtimeStatus.lifecycleState,
          halted: runtimeStatus.halted,
        },
      ));
    }

    if (node.executions.some((execution) => execution.status === 'completed') || node.action.status === 'completed') {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_already_completed',
        'target_child',
        'Treasury child already completed successfully and should not be retried.',
        'Inspect the completed child execution history instead of requeueing it.',
        {
          treasuryActionId: node.action.id,
        },
      ));
    }

    if (node.action.status === 'queued' || node.action.status === 'executing') {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_has_inflight_command',
        'target_child',
        'Treasury child is already queued or executing.',
        'Wait for the in-flight treasury child to settle before requesting another recovery action.',
        {
          treasuryActionId: node.action.id,
          status: node.action.status,
          linkedCommandId: node.action.linkedCommandId,
        },
      ));
    }

    if (node.action.status === 'cancelled') {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_not_retryable',
        'target_child',
        'Cancelled treasury children are inspect-only in this pass.',
        'Create a new treasury or allocator evaluation if a replacement action is required.',
        {
          treasuryActionId: node.action.id,
        },
      ));
    }

    if (!node.action.executable || node.action.readiness === 'blocked' || node.action.blockedReasons.length > 0) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_remains_blocked',
        'safety',
        'Treasury child remains operationally blocked and cannot be requeued safely.',
        'Resolve the treasury child blocked reasons before requesting recovery.',
        {
          treasuryActionId: node.action.id,
          blockedReasons: node.action.blockedReasons,
        },
      ));
    }

    const latestFailedExecution = node.executions.find((execution) => execution.id === node.action.latestExecutionId)
      ?? node.executions.find((execution) => execution.status === 'failed')
      ?? null;
    const hasSideEffects = node.executions.some((execution) => execution.venueExecutionReference !== null);
    if (hasSideEffects) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'treasury_execution_side_effect_detected',
        'safety',
        'Treasury child shows venue-side execution evidence, so replaying it could duplicate external state changes.',
        'Inspect the treasury execution detail before requesting recovery.',
        {
          treasuryActionId: node.action.id,
          latestExecutionId: latestFailedExecution?.id ?? null,
        },
      ));
    }

    if (
      !['recommended', 'approved', 'failed'].includes(node.action.status)
      && node.action.status !== 'completed'
      && node.action.status !== 'cancelled'
      && node.action.status !== 'queued'
      && node.action.status !== 'executing'
    ) {
      blockedReasons.push(this.buildBundleRecoveryBlockedReason(
        'target_child_not_retryable',
        'target_child',
        `Treasury child status "${node.action.status}" is not supported for bundle recovery.`,
        'Inspect the child action directly before requesting recovery.',
        {
          treasuryActionId: node.action.id,
          status: node.action.status,
        },
      ));
    }

    return {
      id: `${bundle.bundle.id}:treasury_action:${node.action.id}:requeue_child_execution`,
      bundleId: bundle.bundle.id,
      proposalId: bundle.bundle.proposalId,
      recoveryActionType: 'requeue_child_execution',
      targetChildType: 'treasury_action',
      targetChildId: node.action.id,
      targetChildStatus: node.action.status,
      targetChildSummary: node.action.summary,
      targetCommandType: 'execute_treasury_action',
      approvalRequirement: node.action.approvalRequirement,
      eligibilityState: blockedReasons.length === 0 ? 'eligible' : 'blocked',
      blockedReasons,
      executionMode: node.action.executionMode,
      simulated: node.action.simulated,
      note: latestFailedExecution === null
        ? 'Treasury child can be queued from its persisted action record when no external side effects were recorded.'
        : `Latest failed treasury execution: ${latestFailedExecution.id}.`,
      createdAt: now,
      updatedAt: now,
    };
  }

  async listRebalanceBundleRecoveryCandidates(
    bundleId: string,
  ): Promise<RebalanceBundleRecoveryCandidateView[]> {
    const detail = await this.getRebalanceBundle(bundleId);
    return detail?.recoveryCandidates ?? [];
  }

  private buildBundleResolutionBlockedReason(
    code: RebalanceBundleResolutionBlockedReason['code'],
    category: RebalanceBundleResolutionBlockedReason['category'],
    message: string,
    operatorAction: string,
    details: Record<string, unknown> = {},
  ): RebalanceBundleResolutionBlockedReason {
    return {
      code,
      category,
      message,
      operatorAction,
      details,
    };
  }

  private async buildCarryChildInspection(
    node: RebalanceCarryActionNodeView,
    recoveryCandidate: RebalanceBundleRecoveryCandidateView | undefined,
  ): Promise<RebalanceBundleChildInspectionView> {
    const stepRows = await this.db
      .select()
      .from(carryExecutionSteps)
      .where(eq(carryExecutionSteps.carryActionId, node.action.id));
    const latestExecution = node.executions.find((execution) => execution.id === node.action.latestExecutionId)
      ?? node.executions.at(-1)
      ?? null;
    const completed = node.action.status === 'completed' || node.executions.some((execution) => execution.status === 'completed');
    const progressRecorded = completed
      || node.executions.some((execution) => execution.venueExecutionReference !== null)
      || stepRows.some((row) =>
        row.executionReference !== null
        || row.venueOrderId !== null
        || !['pending', 'failed'].includes(row.status),
      );
    const retryability = recoveryCandidate?.eligibilityState === 'eligible'
      ? 'retryable'
      : completed
        ? 'not_applicable'
        : 'non_retryable';

    let progressState: RebalanceBundleChildInspectionView['progressState'] = 'pending';
    if (completed) {
      progressState = 'completed';
    } else if (node.action.status === 'queued' || node.action.status === 'executing') {
      progressState = 'inflight';
    } else if (progressRecorded) {
      progressState = 'partial_progress';
    } else if (recoveryCandidate?.eligibilityState === 'eligible') {
      progressState = 'retryable_failure';
    } else if (!node.action.executable || node.action.blockedReasons.length > 0) {
      progressState = 'blocked_before_progress';
    } else if (node.action.status === 'failed') {
      progressState = 'failed_without_progress';
    } else if (recoveryCandidate !== undefined) {
      progressState = 'non_retryable';
    }

    const evidence = [
      completed ? 'Completed carry execution recorded.' : null,
      node.executions.some((execution) => execution.venueExecutionReference !== null)
        ? 'Venue execution references recorded.'
        : null,
      stepRows.some((row) => row.venueOrderId !== null)
        ? 'Carry execution step venue order ids recorded.'
        : null,
      stepRows.some((row) => row.executionReference !== null)
        ? 'Carry execution step execution references recorded.'
        : null,
      stepRows.some((row) => !['pending', 'failed'].includes(row.status))
        ? 'Carry execution steps advanced beyond pre-execution failure.'
        : null,
    ].filter((value): value is string => value !== null);

    return {
      childType: 'carry_action',
      sleeveId: 'carry',
      childId: node.action.id,
      summary: node.action.summary,
      actionStatus: node.action.status,
      latestExecutionId: latestExecution?.id ?? null,
      latestExecutionStatus: latestExecution?.status ?? null,
      progressState,
      retryability,
      applied: completed,
      progressRecorded,
      blockedBeforeApplication: !progressRecorded && (!node.action.executable || node.action.blockedReasons.length > 0 || node.action.status === 'failed'),
      retryCandidateId: recoveryCandidate?.id ?? null,
      retryBlockedReasons: recoveryCandidate?.blockedReasons ?? [],
      evidence,
    };
  }

  private async buildTreasuryChildInspection(
    node: RebalanceTreasuryActionNodeView,
    recoveryCandidate: RebalanceBundleRecoveryCandidateView | undefined,
  ): Promise<RebalanceBundleChildInspectionView> {
    const latestExecution = node.executions.find((execution) => execution.id === node.action.latestExecutionId)
      ?? node.executions.at(-1)
      ?? null;
    const completed = node.action.status === 'completed' || node.executions.some((execution) => execution.status === 'completed');
    const progressRecorded = completed
      || node.executions.some((execution) => execution.venueExecutionReference !== null);
    const retryability = recoveryCandidate?.eligibilityState === 'eligible'
      ? 'retryable'
      : completed
        ? 'not_applicable'
        : 'non_retryable';

    let progressState: RebalanceBundleChildInspectionView['progressState'] = 'pending';
    if (completed) {
      progressState = 'completed';
    } else if (node.action.status === 'queued' || node.action.status === 'executing') {
      progressState = 'inflight';
    } else if (progressRecorded) {
      progressState = 'partial_progress';
    } else if (recoveryCandidate?.eligibilityState === 'eligible') {
      progressState = 'retryable_failure';
    } else if (!node.action.executable || node.action.readiness === 'blocked' || node.action.blockedReasons.length > 0) {
      progressState = 'blocked_before_progress';
    } else if (node.action.status === 'failed') {
      progressState = 'failed_without_progress';
    } else if (recoveryCandidate !== undefined) {
      progressState = 'non_retryable';
    }

    const evidence = [
      completed ? 'Treasury execution completed and applied state changes.' : null,
      node.executions.some((execution) => execution.venueExecutionReference !== null)
        ? 'Venue-side treasury execution references recorded.'
        : null,
      completed && node.executions.every((execution) => execution.venueExecutionReference === null)
        ? 'Budget-state-only treasury application recorded.'
        : null,
    ].filter((value): value is string => value !== null);

    return {
      childType: 'treasury_action',
      sleeveId: 'treasury',
      childId: node.action.id,
      summary: node.action.summary,
      actionStatus: node.action.status,
      latestExecutionId: latestExecution?.id ?? null,
      latestExecutionStatus: latestExecution?.status ?? null,
      progressState,
      retryability,
      applied: completed,
      progressRecorded,
      blockedBeforeApplication: !progressRecorded && (!node.action.executable || node.action.readiness === 'blocked' || node.action.blockedReasons.length > 0 || node.action.status === 'failed'),
      retryCandidateId: recoveryCandidate?.id ?? null,
      retryBlockedReasons: recoveryCandidate?.blockedReasons ?? [],
      evidence,
    };
  }

  private async buildBundlePartialProgress(
    bundle: RebalanceBundleDetailView,
    recoveryCandidates: RebalanceBundleRecoveryCandidateView[],
  ): Promise<RebalanceBundlePartialProgressView> {
    const carryChildren = await Promise.all(bundle.graph.downstream.carry.actions.map(async (node) =>
      this.buildCarryChildInspection(
        node,
        recoveryCandidates.find((candidate) =>
          candidate.targetChildType === 'carry_action' && candidate.targetChildId === node.action.id,
        ),
      )
    ));
    const treasuryChildren = await Promise.all(bundle.graph.downstream.treasury.actions.map(async (node) =>
      this.buildTreasuryChildInspection(
        node,
        recoveryCandidates.find((candidate) =>
          candidate.targetChildType === 'treasury_action' && candidate.targetChildId === node.action.id,
        ),
      )
    ));
    const children = [...carryChildren, ...treasuryChildren];
    const summariseSleeve = (
      sleeveId: 'carry' | 'treasury',
    ): RebalanceBundlePartialProgressSleeveView => {
      const items = children.filter((child) => child.sleeveId === sleeveId);
      return {
        sleeveId,
        totalChildren: items.length,
        appliedChildren: items.filter((child) => child.applied).length,
        progressRecordedChildren: items.filter((child) => child.progressRecorded).length,
        retryableChildren: items.filter((child) => child.retryability === 'retryable').length,
        nonRetryableChildren: items.filter((child) => child.retryability === 'non_retryable').length,
        blockedBeforeApplicationChildren: items.filter((child) => child.blockedBeforeApplication).length,
      };
    };

    return {
      totalChildren: children.length,
      appliedChildren: children.filter((child) => child.applied).length,
      progressRecordedChildren: children.filter((child) => child.progressRecorded).length,
      retryableChildren: children.filter((child) => child.retryability === 'retryable').length,
      nonRetryableChildren: children.filter((child) => child.retryability === 'non_retryable').length,
      blockedBeforeApplicationChildren: children.filter((child) => child.blockedBeforeApplication).length,
      inflightChildren: children.filter((child) => child.progressState === 'inflight').length,
      sleeves: [
        summariseSleeve('carry'),
        summariseSleeve('treasury'),
      ],
      children,
    };
  }

  private buildBundleResolutionOptions(
    bundle: RebalanceBundleDetailView,
    partialProgress: RebalanceBundlePartialProgressView,
  ): RebalanceBundleResolutionOptionView[] {
    const now = new Date().toISOString();
    const actionableBundleStatuses: RebalanceBundleStatus[] = [
      'failed',
      'blocked',
      'requires_intervention',
      'partially_completed',
    ];
    const buildOption = (
      resolutionActionType: RebalanceBundleResolutionActionType,
      targetResolutionState: RebalanceBundleResolutionState,
      summary: string,
      operatorAction: string,
      approvalRequirement: 'operator' | 'admin',
    ): RebalanceBundleResolutionOptionView => {
      const blockedReasons: RebalanceBundleResolutionBlockedReason[] = [];
      if (!actionableBundleStatuses.includes(bundle.bundle.status)) {
        blockedReasons.push(this.buildBundleResolutionBlockedReason(
          'bundle_not_actionable',
          'bundle_state',
          `Bundle status "${bundle.bundle.status}" does not permit manual resolution.`,
          'Only request manual resolution for failed, blocked, partial, or intervention-required bundles.',
          { bundleStatus: bundle.bundle.status },
        ));
      }
      if (bundle.bundle.pendingChildCount > 0 || partialProgress.inflightChildren > 0) {
        blockedReasons.push(this.buildBundleResolutionBlockedReason(
          'bundle_has_inflight_children',
          'safety',
          'Bundle still has in-flight downstream children and cannot be manually closed yet.',
          'Wait for in-flight children to settle before recording manual resolution.',
          {
            pendingChildCount: bundle.bundle.pendingChildCount,
            inflightChildren: partialProgress.inflightChildren,
          },
        ));
      }
      if (
        resolutionActionType === 'accept_partial_application'
        && bundle.bundle.outcomeClassification !== 'partial_application'
      ) {
        blockedReasons.push(this.buildBundleResolutionBlockedReason(
          'bundle_not_partial_application',
          'bundle_state',
          'Accept-partial resolution is only available when the bundle outcome is partial application.',
          'Use manual resolution or escalation for fully failed or fully blocked bundles.',
          {
            outcomeClassification: bundle.bundle.outcomeClassification,
          },
        ));
      }
      if (bundle.bundle.resolutionState === targetResolutionState) {
        blockedReasons.push(this.buildBundleResolutionBlockedReason(
          'resolution_state_already_current',
          'validation',
          `Bundle is already marked as ${targetResolutionState}.`,
          'Inspect the existing manual resolution history instead of repeating the same decision.',
          {
            resolutionState: bundle.bundle.resolutionState,
          },
        ));
      }

      return {
        id: `${bundle.bundle.id}:${resolutionActionType}`,
        bundleId: bundle.bundle.id,
        proposalId: bundle.bundle.proposalId,
        resolutionActionType,
        targetResolutionState,
        approvalRequirement,
        eligibilityState: blockedReasons.length === 0 ? 'eligible' : 'blocked',
        blockedReasons,
        noteRequired: true,
        summary,
        operatorAction,
        createdAt: now,
        updatedAt: now,
      };
    };

    return [
      buildOption(
        'accept_partial_application',
        'accepted_partial',
        'Accept the current partial application as the intended bundle outcome without retrying remaining children.',
        'Record why the partially applied state is acceptable and acknowledge the remaining non-retryable context.',
        'operator',
      ),
      buildOption(
        'mark_bundle_manually_resolved',
        'manually_resolved',
        'Record that the operator resolved the bundle outside the retry rails and no further bundle recovery is required.',
        'Document the manual remediation or external resolution steps that closed the bundle.',
        'operator',
      ),
      buildOption(
        'escalate_bundle_for_review',
        'escalated',
        'Escalate the bundle for further review when current partial or non-retryable state cannot be safely closed yet.',
        'Document why the bundle remains escalated and what follow-up is required.',
        'operator',
      ),
    ];
  }

  private buildBundleEscalationBlockedReason(
    code: RebalanceBundleEscalationBlockedReason['code'],
    category: RebalanceBundleEscalationBlockedReason['category'],
    message: string,
    operatorAction: string,
    details: Record<string, unknown> = {},
  ): RebalanceBundleEscalationBlockedReason {
    return {
      code,
      category,
      message,
      operatorAction,
      details,
    };
  }

  private buildBundleEscalationTransitions(
    bundle: RebalanceBundleDetailView,
    escalation: RebalanceBundleEscalationView | null,
  ): RebalanceBundleEscalationTransitionView[] {
    const now = new Date().toISOString();
    const buildTransition = (
      transitionType: RebalanceBundleEscalationTransitionType,
      targetStatus: RebalanceBundleEscalationStatus,
      summary: string,
      operatorAction: string,
      noteRequired: boolean,
      assigneeRequired: boolean,
    ): RebalanceBundleEscalationTransitionView => {
      const blockedReasons: RebalanceBundleEscalationBlockedReason[] = [];
      if (bundle.bundle.resolutionState !== 'escalated') {
        blockedReasons.push(this.buildBundleEscalationBlockedReason(
          'bundle_not_escalated',
          'bundle_state',
          'Bundle is not currently in an escalated resolution state.',
          'Only use escalation workflow actions on bundles that are explicitly escalated.',
          { resolutionState: bundle.bundle.resolutionState },
        ));
      }
      if (escalation === null) {
        blockedReasons.push(this.buildBundleEscalationBlockedReason(
          'escalation_not_found',
          'escalation_state',
          'No escalation record exists for this bundle yet.',
          'Escalate the bundle first or inspect the manual resolution history.',
        ));
      } else {
        if (!escalation.isOpen) {
          blockedReasons.push(this.buildBundleEscalationBlockedReason(
            'escalation_already_resolved',
            'escalation_state',
            'This escalation is already resolved.',
            'Inspect the resolved escalation history instead of applying more workflow transitions.',
            { escalationStatus: escalation.status },
          ));
        }
        if (
          (transitionType === 'acknowledge' || transitionType === 'start_review' || transitionType === 'close')
          && escalation.ownerId === null
        ) {
          blockedReasons.push(this.buildBundleEscalationBlockedReason(
            'escalation_owner_required',
            'ownership',
            'Escalation must have an assigned owner before acknowledgement, review, or close.',
            'Assign the escalation to an operator before continuing.',
          ));
        }
        if (
          transitionType === 'acknowledge'
          && escalation.status !== 'open'
        ) {
          blockedReasons.push(this.buildBundleEscalationBlockedReason(
            'invalid_status_transition',
            'escalation_state',
            `Escalation cannot be acknowledged from status "${escalation.status}".`,
            'Only acknowledge newly open escalations.',
            { escalationStatus: escalation.status },
          ));
        }
        if (
          transitionType === 'start_review'
          && !['open', 'acknowledged'].includes(escalation.status)
        ) {
          blockedReasons.push(this.buildBundleEscalationBlockedReason(
            'invalid_status_transition',
            'escalation_state',
            `Escalation cannot enter review from status "${escalation.status}".`,
            'Start review only after the escalation is open or acknowledged.',
            { escalationStatus: escalation.status },
          ));
        }
      }

      return {
        id: `${bundle.bundle.id}:${transitionType}`,
        bundleId: bundle.bundle.id,
        escalationId: escalation?.id ?? null,
        transitionType,
        targetStatus,
        approvalRequirement: 'operator',
        eligibilityState: blockedReasons.length === 0 ? 'eligible' : 'blocked',
        blockedReasons,
        noteRequired,
        assigneeRequired,
        summary,
        operatorAction,
        createdAt: now,
        updatedAt: now,
      };
    };

    return [
      buildTransition(
        'assign',
        escalation?.status ?? 'open',
        'Assign or reassign the escalation owner and optional follow-up date.',
        'Document the handoff and choose the operator who now owns the escalated bundle.',
        true,
        true,
      ),
      buildTransition(
        'acknowledge',
        'acknowledged',
        'Acknowledge that the escalation owner has accepted the handoff.',
        'Record acknowledgement once the owner accepts responsibility for follow-up.',
        false,
        false,
      ),
      buildTransition(
        'start_review',
        'in_review',
        'Mark the escalation as actively under review.',
        'Record review progress when the assigned owner begins investigating the escalated bundle.',
        false,
        false,
      ),
      buildTransition(
        'close',
        'resolved',
        'Resolve the escalation once follow-up is complete and the handoff workflow is closed.',
        'Document the resolution outcome and who closed the escalation.',
        true,
        false,
      ),
    ];
  }

  async getRebalanceBundleEscalation(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleEscalations)
      .where(eq(allocatorRebalanceBundleEscalations.bundleId, bundleId))
      .orderBy(desc(allocatorRebalanceBundleEscalations.createdAt))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleEscalationRow(row);
  }

  async getOpenRebalanceBundleEscalation(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleEscalations)
      .where(and(
        eq(allocatorRebalanceBundleEscalations.bundleId, bundleId),
        sql`${allocatorRebalanceBundleEscalations.status} <> 'resolved'`,
      ))
      .orderBy(desc(allocatorRebalanceBundleEscalations.createdAt))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleEscalationRow(row);
  }

  async listRebalanceBundleEscalationHistory(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationEventView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRebalanceBundleEscalationEvents)
      .where(eq(allocatorRebalanceBundleEscalationEvents.bundleId, bundleId))
      .orderBy(desc(allocatorRebalanceBundleEscalationEvents.createdAt));

    return rows.map(mapRebalanceBundleEscalationEventRow);
  }

  async listRebalanceBundleEscalationTransitions(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationTransitionView[]> {
    const detail = await this.getRebalanceBundle(bundleId);
    return detail?.escalationTransitions ?? [];
  }

  async createRebalanceBundleEscalation(input: {
    bundleId: string;
    proposalId: string;
    sourceResolutionActionId?: string | null;
    status: RebalanceBundleEscalationStatus;
    ownerId?: string | null;
    assignedBy?: string | null;
    assignedAt?: Date | null;
    acknowledgedBy?: string | null;
    acknowledgedAt?: Date | null;
    dueAt?: Date | null;
    handoffNote?: string | null;
    reviewNote?: string | null;
    resolutionNote?: string | null;
    closedBy?: string | null;
    closedAt?: Date | null;
    createdAt?: Date;
  }): Promise<RebalanceBundleEscalationView> {
    const createdAt = input.createdAt ?? new Date();
    const [row] = await this.db
      .insert(allocatorRebalanceBundleEscalations)
      .values({
        bundleId: input.bundleId,
        proposalId: input.proposalId,
        sourceResolutionActionId: input.sourceResolutionActionId ?? null,
        status: input.status,
        ownerId: input.ownerId ?? null,
        assignedBy: input.assignedBy ?? null,
        assignedAt: input.assignedAt ?? null,
        acknowledgedBy: input.acknowledgedBy ?? null,
        acknowledgedAt: input.acknowledgedAt ?? null,
        dueAt: input.dueAt ?? null,
        handoffNote: input.handoffNote ?? null,
        reviewNote: input.reviewNote ?? null,
        resolutionNote: input.resolutionNote ?? null,
        closedBy: input.closedBy ?? null,
        closedAt: input.closedAt ?? null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createRebalanceBundleEscalation: escalation was not persisted');
    }

    return mapRebalanceBundleEscalationRow(row);
  }

  async updateRebalanceBundleEscalation(
    escalationId: string,
    patch: Partial<{
      status: RebalanceBundleEscalationStatus;
      ownerId: string | null;
      assignedBy: string | null;
      assignedAt: Date | null;
      acknowledgedBy: string | null;
      acknowledgedAt: Date | null;
      dueAt: Date | null;
      handoffNote: string | null;
      reviewNote: string | null;
      resolutionNote: string | null;
      closedBy: string | null;
      closedAt: Date | null;
    }>,
  ): Promise<RebalanceBundleEscalationView | null> {
    await this.db
      .update(allocatorRebalanceBundleEscalations)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.ownerId !== undefined ? { ownerId: patch.ownerId } : {}),
        ...(patch.assignedBy !== undefined ? { assignedBy: patch.assignedBy } : {}),
        ...(patch.assignedAt !== undefined ? { assignedAt: patch.assignedAt } : {}),
        ...(patch.acknowledgedBy !== undefined ? { acknowledgedBy: patch.acknowledgedBy } : {}),
        ...(patch.acknowledgedAt !== undefined ? { acknowledgedAt: patch.acknowledgedAt } : {}),
        ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
        ...(patch.handoffNote !== undefined ? { handoffNote: patch.handoffNote } : {}),
        ...(patch.reviewNote !== undefined ? { reviewNote: patch.reviewNote } : {}),
        ...(patch.resolutionNote !== undefined ? { resolutionNote: patch.resolutionNote } : {}),
        ...(patch.closedBy !== undefined ? { closedBy: patch.closedBy } : {}),
        ...(patch.closedAt !== undefined ? { closedAt: patch.closedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceBundleEscalations.id, escalationId));

    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleEscalations)
      .where(eq(allocatorRebalanceBundleEscalations.id, escalationId))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleEscalationRow(row);
  }

  async recordRebalanceBundleEscalationEvent(input: {
    escalationId: string;
    bundleId: string;
    proposalId: string;
    eventType: RebalanceBundleEscalationEventView['eventType'];
    fromStatus: RebalanceBundleEscalationStatus | null;
    toStatus: RebalanceBundleEscalationStatus;
    actorId: string;
    ownerId?: string | null;
    note?: string | null;
    dueAt?: Date | null;
    createdAt?: Date;
  }): Promise<RebalanceBundleEscalationEventView> {
    const createdAt = input.createdAt ?? new Date();
    const [row] = await this.db
      .insert(allocatorRebalanceBundleEscalationEvents)
      .values({
        escalationId: input.escalationId,
        bundleId: input.bundleId,
        proposalId: input.proposalId,
        eventType: input.eventType,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        actorId: input.actorId,
        ownerId: input.ownerId ?? null,
        note: input.note ?? null,
        dueAt: input.dueAt ?? null,
        createdAt,
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.recordRebalanceBundleEscalationEvent: escalation event was not persisted');
    }

    return mapRebalanceBundleEscalationEventRow(row);
  }

  async updateRebalanceBundleEscalationState(input: {
    bundleId: string;
    latestEscalationId: string | null;
    escalationStatus: RebalanceBundleEscalationStatus | null;
    escalationOwnerId: string | null;
    escalationAssignedAt: Date | null;
    escalationDueAt: Date | null;
    escalationSummary: string | null;
  }): Promise<void> {
    await this.db
      .update(allocatorRebalanceBundles)
      .set({
        latestEscalationId: input.latestEscalationId,
        escalationStatus: input.escalationStatus,
        escalationOwnerId: input.escalationOwnerId,
        escalationAssignedAt: input.escalationAssignedAt,
        escalationDueAt: input.escalationDueAt,
        escalationSummary: input.escalationSummary,
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceBundles.id, input.bundleId));
  }

  async listRebalanceBundleResolutionActions(
    bundleId: string,
  ): Promise<RebalanceBundleResolutionActionView[]> {
    const rows = await this.db
      .select()
      .from(allocatorRebalanceBundleResolutionActions)
      .where(eq(allocatorRebalanceBundleResolutionActions.bundleId, bundleId))
      .orderBy(desc(allocatorRebalanceBundleResolutionActions.requestedAt));

    return rows.map(mapRebalanceBundleResolutionActionRow);
  }

  async getRebalanceBundleResolutionAction(
    bundleId: string,
    resolutionActionId: string,
  ): Promise<RebalanceBundleResolutionActionView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleResolutionActions)
      .where(and(
        eq(allocatorRebalanceBundleResolutionActions.bundleId, bundleId),
        eq(allocatorRebalanceBundleResolutionActions.id, resolutionActionId),
      ))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleResolutionActionRow(row);
  }

  async listRebalanceBundleResolutionOptions(
    bundleId: string,
  ): Promise<RebalanceBundleResolutionOptionView[]> {
    const detail = await this.getRebalanceBundle(bundleId);
    return detail?.resolutionOptions ?? [];
  }

  async createRebalanceBundleResolutionAction(input: {
    bundleId: string;
    proposalId: string;
    resolutionActionType: RebalanceBundleResolutionActionType;
    status: RebalanceBundleResolutionActionStatus;
    resolutionState: RebalanceBundleResolutionState;
    note: string;
    acknowledgedPartialApplication: boolean;
    escalated: boolean;
    affectedChildSummary: Record<string, unknown>;
    linkedRecoveryActionIds: string[];
    blockedReasons: RebalanceBundleResolutionBlockedReason[];
    outcomeSummary?: string | null;
    requestedBy: string;
    completedBy?: string | null;
    requestedAt?: Date;
    completedAt?: Date | null;
  }): Promise<RebalanceBundleResolutionActionView> {
    const requestedAt = input.requestedAt ?? new Date();
    const [row] = await this.db
      .insert(allocatorRebalanceBundleResolutionActions)
      .values({
        bundleId: input.bundleId,
        proposalId: input.proposalId,
        resolutionActionType: input.resolutionActionType,
        status: input.status,
        resolutionState: input.resolutionState,
        note: input.note,
        acknowledgedPartialApplication: input.acknowledgedPartialApplication,
        escalated: input.escalated,
        affectedChildSummary: input.affectedChildSummary,
        linkedRecoveryActionIds: input.linkedRecoveryActionIds,
        blockedReasons: input.blockedReasons as unknown as Record<string, unknown>[],
        outcomeSummary: input.outcomeSummary ?? null,
        requestedBy: input.requestedBy,
        completedBy: input.completedBy ?? null,
        requestedAt,
        completedAt: input.completedAt ?? null,
        updatedAt: requestedAt,
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createRebalanceBundleResolutionAction: resolution action was not persisted');
    }

    return mapRebalanceBundleResolutionActionRow(row);
  }

  async updateRebalanceBundleResolutionState(input: {
    bundleId: string;
    resolutionState: RebalanceBundleResolutionState;
    latestResolutionActionId: string;
    resolutionSummary: string;
    resolvedBy: string;
    resolvedAt: Date;
  }): Promise<void> {
    const recommendation = recommendationForResolutionState(input.resolutionState);
    await this.db
      .update(allocatorRebalanceBundles)
      .set({
        resolutionState: input.resolutionState,
        latestResolutionActionId: input.latestResolutionActionId,
        resolutionSummary: input.resolutionSummary,
        resolvedBy: input.resolvedBy,
        resolvedAt: input.resolvedAt,
        ...(recommendation === null ? {} : { interventionRecommendation: recommendation }),
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceBundles.id, input.bundleId));
  }

  async createRebalanceBundleRecoveryAction(input: {
    bundleId: string;
    proposalId: string;
    recoveryActionType: RebalanceBundleRecoveryActionType;
    targetChildType: RebalanceBundleRecoveryActionView['targetChildType'];
    targetChildId: string;
    targetChildStatus: string;
    targetChildSummary: string;
    eligibilityState: RebalanceBundleRecoveryEligibilityState;
    blockedReasons: RebalanceBundleRecoveryBlockedReason[];
    approvalRequirement: RebalanceBundleRecoveryActionView['approvalRequirement'];
    status: RebalanceBundleRecoveryStatus;
    requestedBy: string;
    note?: string | null;
    linkedCommandId?: string | null;
    targetCommandType?: RuntimeCommandType | null;
    linkedCarryActionId?: string | null;
    linkedTreasuryActionId?: string | null;
    outcomeSummary?: string | null;
    outcome?: Record<string, unknown>;
    lastError?: string | null;
    executionMode: RebalanceBundleRecoveryActionView['executionMode'];
    simulated: boolean;
    requestedAt?: Date;
    queuedAt?: Date | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<RebalanceBundleRecoveryActionView> {
    const requestedAt = input.requestedAt ?? new Date();
    const [row] = await this.db
      .insert(allocatorRebalanceBundleRecoveryActions)
      .values({
        bundleId: input.bundleId,
        proposalId: input.proposalId,
        recoveryActionType: input.recoveryActionType,
        targetChildType: input.targetChildType,
        targetChildId: input.targetChildId,
        targetChildStatus: input.targetChildStatus,
        targetChildSummary: input.targetChildSummary,
        eligibilityState: input.eligibilityState,
        blockedReasons: input.blockedReasons as unknown as Record<string, unknown>[],
        approvalRequirement: input.approvalRequirement,
        status: input.status,
        requestedBy: input.requestedBy,
        note: input.note ?? null,
        linkedCommandId: input.linkedCommandId ?? null,
        targetCommandType: input.targetCommandType ?? null,
        linkedCarryActionId: input.linkedCarryActionId ?? null,
        linkedTreasuryActionId: input.linkedTreasuryActionId ?? null,
        outcomeSummary: input.outcomeSummary ?? null,
        outcome: input.outcome ?? {},
        lastError: input.lastError ?? null,
        executionMode: input.executionMode,
        simulated: input.simulated,
        requestedAt,
        queuedAt: input.queuedAt ?? null,
        startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? null,
        updatedAt: requestedAt,
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createRebalanceBundleRecoveryAction: recovery action was not persisted');
    }

    return mapRebalanceBundleRecoveryActionRow(row);
  }

  async updateRebalanceBundleRecoveryAction(
    recoveryActionId: string,
    patch: Partial<{
      targetChildStatus: string;
      targetChildSummary: string;
      eligibilityState: RebalanceBundleRecoveryEligibilityState;
      blockedReasons: RebalanceBundleRecoveryBlockedReason[];
      status: RebalanceBundleRecoveryStatus;
      linkedCommandId: string | null;
      targetCommandType: RuntimeCommandType | null;
      linkedCarryActionId: string | null;
      linkedTreasuryActionId: string | null;
      outcomeSummary: string | null;
      outcome: Record<string, unknown>;
      lastError: string | null;
      queuedAt: Date | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>,
  ): Promise<RebalanceBundleRecoveryActionView | null> {
    await this.db
      .update(allocatorRebalanceBundleRecoveryActions)
      .set({
        ...(patch.targetChildStatus !== undefined ? { targetChildStatus: patch.targetChildStatus } : {}),
        ...(patch.targetChildSummary !== undefined ? { targetChildSummary: patch.targetChildSummary } : {}),
        ...(patch.eligibilityState !== undefined ? { eligibilityState: patch.eligibilityState } : {}),
        ...(patch.blockedReasons !== undefined ? { blockedReasons: patch.blockedReasons as unknown as Record<string, unknown>[] } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.linkedCommandId !== undefined ? { linkedCommandId: patch.linkedCommandId } : {}),
        ...(patch.targetCommandType !== undefined ? { targetCommandType: patch.targetCommandType } : {}),
        ...(patch.linkedCarryActionId !== undefined ? { linkedCarryActionId: patch.linkedCarryActionId } : {}),
        ...(patch.linkedTreasuryActionId !== undefined ? { linkedTreasuryActionId: patch.linkedTreasuryActionId } : {}),
        ...(patch.outcomeSummary !== undefined ? { outcomeSummary: patch.outcomeSummary } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.queuedAt !== undefined ? { queuedAt: patch.queuedAt } : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceBundleRecoveryActions.id, recoveryActionId));

    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleRecoveryActions)
      .where(eq(allocatorRebalanceBundleRecoveryActions.id, recoveryActionId))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleRecoveryActionRow(row);
  }

  async getRebalanceBundleRecoveryActionByCommandId(
    commandId: string,
  ): Promise<RebalanceBundleRecoveryActionView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceBundleRecoveryActions)
      .where(eq(allocatorRebalanceBundleRecoveryActions.linkedCommandId, commandId))
      .orderBy(desc(allocatorRebalanceBundleRecoveryActions.requestedAt))
      .limit(1);

    return row === undefined ? null : mapRebalanceBundleRecoveryActionRow(row);
  }

  async getRebalanceExecutionGraph(proposalId: string): Promise<RebalanceExecutionGraphView | null> {
    const detail = await this.getRebalanceProposal(proposalId);
    if (detail === null) {
      return null;
    }

    const [allocatorDecision, carryActionRows, recoveryActionRows, resolutionActionRows, escalationRow, escalationEventRows] = await Promise.all([
      this.getAllocatorDecision(detail.proposal.allocatorRunId),
      this.db
        .select()
        .from(carryActions)
        .where(eq(carryActions.linkedRebalanceProposalId, proposalId))
        .orderBy(desc(carryActions.createdAt)),
      this.db
        .select()
        .from(allocatorRebalanceBundleRecoveryActions)
        .where(eq(allocatorRebalanceBundleRecoveryActions.proposalId, proposalId))
        .orderBy(desc(allocatorRebalanceBundleRecoveryActions.requestedAt)),
      this.db
        .select()
        .from(allocatorRebalanceBundleResolutionActions)
        .where(eq(allocatorRebalanceBundleResolutionActions.proposalId, proposalId))
        .orderBy(desc(allocatorRebalanceBundleResolutionActions.requestedAt)),
      this.db
        .select()
        .from(allocatorRebalanceBundleEscalations)
        .where(eq(allocatorRebalanceBundleEscalations.proposalId, proposalId))
        .orderBy(desc(allocatorRebalanceBundleEscalations.createdAt))
        .limit(1)
        .then((rows) => rows[0]),
      this.db
        .select()
        .from(allocatorRebalanceBundleEscalationEvents)
        .where(eq(allocatorRebalanceBundleEscalationEvents.proposalId, proposalId))
        .orderBy(desc(allocatorRebalanceBundleEscalationEvents.createdAt)),
    ]);

    const carryNodes: RebalanceCarryActionNodeView[] = (
      await Promise.all(carryActionRows.map(async (row): Promise<RebalanceCarryActionNodeView> => {
        const action = mapCarryActionRow(row);
        const executions = await this.listCarryExecutionsForAction(action.id);
        return { action, executions };
      }))
    ).sort((left, right) => left.action.createdAt.localeCompare(right.action.createdAt));

    const commandIds = Array.from(new Set([
      ...(detail.proposal.linkedCommandId === null ? [] : [detail.proposal.linkedCommandId]),
      ...detail.executions.flatMap((execution) => execution.commandId === null ? [] : [execution.commandId]),
    ]));
    const commands = (
      await Promise.all(commandIds.map(async (commandId) => this.getRuntimeCommand(commandId)))
    ).filter((command): command is RuntimeCommandView => command !== null);

    const carryRollup = summariseRebalanceDownstreamRollup({
      actionCount: carryNodes.length,
      executionCount: carryNodes.reduce((sum, node) => sum + node.executions.length, 0),
      blockedCount: carryNodes.filter((node) => node.action.blockedReasons.length > 0 || !node.action.executable).length,
      failureCount: carryNodes.reduce(
        (sum, node) => sum + node.executions.filter((execution) => execution.status === 'failed').length,
        0,
      ),
      completedCount: carryNodes.reduce(
        (sum, node) => sum + node.executions.filter((execution) => execution.status === 'completed').length,
        0,
      ),
      simulated: carryNodes.some((node) => node.action.simulated || node.executions.some((execution) => execution.simulated)),
      live: carryNodes.some((node) => !node.action.simulated || node.executions.some((execution) => execution.executionMode === 'live' && !execution.simulated)),
      references: carryNodes.flatMap((node) => node.executions.flatMap((execution) => execution.venueExecutionReference === null ? [] : [execution.venueExecutionReference])),
    });

    const treasuryActionRows = await this.db
      .select()
      .from(treasuryActions)
      .where(eq(treasuryActions.linkedRebalanceProposalId, proposalId))
      .orderBy(desc(treasuryActions.createdAt));

    const treasuryNodes: RebalanceTreasuryActionNodeView[] = (
      await Promise.all(treasuryActionRows.map(async (row): Promise<RebalanceTreasuryActionNodeView> => {
        const action = mapTreasuryActionRow(row);
        const executions = await this.listTreasuryExecutionsForAction(action.id);
        return { action, executions };
      }))
    ).sort((left, right) => left.action.createdAt.localeCompare(right.action.createdAt));
    const treasuryRollup = summariseRebalanceDownstreamRollup({
      actionCount: treasuryNodes.length,
      executionCount: treasuryNodes.reduce((sum, node) => sum + node.executions.length, 0),
      blockedCount: treasuryNodes.filter((node) => node.action.blockedReasons.length > 0 || !node.action.executable).length,
      failureCount: treasuryNodes.reduce(
        (sum, node) => sum + node.executions.filter((execution) => execution.status === 'failed').length,
        0,
      ),
      completedCount: treasuryNodes.reduce(
        (sum, node) => sum + node.executions.filter((execution) => execution.status === 'completed').length,
        0,
      ),
      simulated: treasuryNodes.some((node) => node.action.simulated || node.executions.some((execution) => execution.simulated)),
      live: treasuryNodes.some((node) => !node.action.simulated || node.executions.some((execution) => execution.executionMode === 'live' && !execution.simulated)),
      references: treasuryNodes.flatMap((node) => node.executions.flatMap((execution) => execution.venueExecutionReference === null ? [] : [execution.venueExecutionReference])),
    });
    const recoveryActions = recoveryActionRows.map(mapRebalanceBundleRecoveryActionRow);
    const resolutionActions = resolutionActionRows.map(mapRebalanceBundleResolutionActionRow);
    const escalation = escalationRow === undefined ? null : mapRebalanceBundleEscalationRow(escalationRow);
    const escalationHistory = escalationEventRows.map(mapRebalanceBundleEscalationEventRow);

    const timeline = createRebalanceTimeline({
      detail,
      commands,
      carryActions: carryNodes,
      treasuryActions: treasuryNodes,
      recoveryActions,
      resolutionActions,
      escalationHistory,
    });

    return {
      detail,
      allocatorDecision,
      commands,
      downstream: {
        carry: {
          actions: carryNodes,
          rollup: carryRollup,
        },
        treasury: {
          actions: treasuryNodes,
          rollup: {
            ...treasuryRollup,
            summary: treasuryNodes.length > 0
              ? treasuryRollup.summary
              : detail.currentState?.latestProposalId === detail.proposal.id
              ? 'Treasury participation is represented by the applied approved budget state; no downstream treasury action records are persisted for this proposal.'
              : 'No downstream treasury actions are persisted for this proposal.',
          },
          note: treasuryNodes.length > 0
            ? null
            : detail.currentState?.latestProposalId === detail.proposal.id
              ? 'Treasury sleeve impact is currently represented by approved rebalance budget-state application, not by proposal-linked treasury action records.'
              : 'No proposal-linked treasury action records were persisted.',
        },
      },
      recoveryActions,
      resolutionActions,
      escalation,
      escalationHistory,
      timeline,
    };
  }

  async getRebalanceTimeline(proposalId: string): Promise<RebalanceExecutionTimelineEntry[]> {
    const graph = await this.getRebalanceExecutionGraph(proposalId);
    return graph?.timeline ?? [];
  }

  async getRebalanceCurrent(): Promise<RebalanceCurrentView | null> {
    const [row] = await this.db
      .select()
      .from(allocatorRebalanceCurrent)
      .where(eq(allocatorRebalanceCurrent.id, 'primary'))
      .limit(1);

    return row === undefined ? null : mapRebalanceCurrentRow(row);
  }

  async approveRebalanceProposal(
    proposalId: string,
    actorId: string,
  ): Promise<RebalanceProposalView | null> {
    await this.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'approved',
        approvedBy: actorId,
        approvedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceProposals.id, proposalId));

    const detail = await this.getRebalanceProposal(proposalId);
    await this.syncRebalanceBundleForProposal(proposalId);
    return detail?.proposal ?? null;
  }

  async rejectRebalanceProposal(
    proposalId: string,
    actorId: string,
    reason: string,
  ): Promise<RebalanceProposalView | null> {
    await this.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'rejected',
        rejectedBy: actorId,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceProposals.id, proposalId));

    const detail = await this.getRebalanceProposal(proposalId);
    await this.syncRebalanceBundleForProposal(proposalId);
    return detail?.proposal ?? null;
  }

  async queueRebalanceProposalExecution(input: {
    proposalId: string;
    commandId: string;
  }): Promise<RebalanceProposalView | null> {
    await this.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'queued',
        linkedCommandId: input.commandId,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceProposals.id, input.proposalId));

    const detail = await this.getRebalanceProposal(input.proposalId);
    await this.syncRebalanceBundleForProposal(input.proposalId);
    return detail?.proposal ?? null;
  }

  async markRebalanceProposalExecuting(proposalId: string): Promise<RebalanceProposalView | null> {
    await this.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'executing',
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceProposals.id, proposalId));

    const detail = await this.getRebalanceProposal(proposalId);
    await this.syncRebalanceBundleForProposal(proposalId);
    return detail?.proposal ?? null;
  }

  async completeRebalanceProposal(input: {
    proposalId: string;
    latestExecutionId: string;
  }): Promise<RebalanceProposalView | null> {
    await this.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: input.latestExecutionId,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceProposals.id, input.proposalId));

    const detail = await this.getRebalanceProposal(input.proposalId);
    await this.syncRebalanceBundleForProposal(input.proposalId);
    return detail?.proposal ?? null;
  }

  async failRebalanceProposal(input: {
    proposalId: string;
    latestExecutionId?: string | null;
    errorMessage: string;
  }): Promise<RebalanceProposalView | null> {
    await this.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'failed',
        latestExecutionId: input.latestExecutionId ?? null,
        lastError: input.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceProposals.id, input.proposalId));

    const detail = await this.getRebalanceProposal(input.proposalId);
    await this.syncRebalanceBundleForProposal(input.proposalId);
    return detail?.proposal ?? null;
  }

  async createRebalanceExecution(input: {
    proposalId: string;
    commandId: string | null;
    status: RebalanceExecutionView['status'];
    executionMode: RebalanceExecutionView['executionMode'];
    simulated: boolean;
    requestedBy: string;
    startedBy?: string | null;
    outcomeSummary?: string | null;
    outcome?: Record<string, unknown>;
    lastError?: string | null;
  }): Promise<RebalanceExecutionView> {
    const [row] = await this.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: input.proposalId,
        commandId: input.commandId,
        status: input.status,
        executionMode: input.executionMode,
        simulated: input.simulated,
        requestedBy: input.requestedBy,
        startedBy: input.startedBy ?? null,
        outcomeSummary: input.outcomeSummary ?? null,
        outcome: input.outcome ?? {},
        lastError: input.lastError ?? null,
        startedAt: input.status === 'executing' ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createRebalanceExecution: execution was not persisted');
    }

    return mapRebalanceExecutionRow(row);
  }

  async updateRebalanceExecution(
    executionId: string,
    patch: Partial<{
      status: RebalanceExecutionView['status'];
      outcomeSummary: string | null;
      outcome: Record<string, unknown>;
      lastError: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>,
  ): Promise<RebalanceExecutionView | null> {
    await this.db
      .update(allocatorRebalanceExecutions)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.outcomeSummary !== undefined ? { outcomeSummary: patch.outcomeSummary } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(allocatorRebalanceExecutions.id, executionId));

    const [row] = await this.db
      .select()
      .from(allocatorRebalanceExecutions)
      .where(eq(allocatorRebalanceExecutions.id, executionId))
      .limit(1);

    return row === undefined ? null : mapRebalanceExecutionRow(row);
  }

  async applyRebalanceCurrent(input: {
    proposalId: string;
    allocatorRunId: string;
    carryTargetAllocationUsd: string;
    carryTargetAllocationPct: number;
    treasuryTargetAllocationUsd: string;
    treasuryTargetAllocationPct: number;
    appliedAt: Date;
  }): Promise<void> {
    await this.db
      .insert(allocatorRebalanceCurrent)
      .values({
        id: 'primary',
        latestProposalId: input.proposalId,
        allocatorRunId: input.allocatorRunId,
        carryTargetAllocationUsd: input.carryTargetAllocationUsd,
        carryTargetAllocationPct: input.carryTargetAllocationPct.toFixed(4),
        treasuryTargetAllocationUsd: input.treasuryTargetAllocationUsd,
        treasuryTargetAllocationPct: input.treasuryTargetAllocationPct.toFixed(4),
        appliedAt: input.appliedAt,
        updatedAt: input.appliedAt,
      })
      .onConflictDoUpdate({
        target: allocatorRebalanceCurrent.id,
        set: {
          latestProposalId: input.proposalId,
          allocatorRunId: input.allocatorRunId,
          carryTargetAllocationUsd: input.carryTargetAllocationUsd,
          carryTargetAllocationPct: input.carryTargetAllocationPct.toFixed(4),
          treasuryTargetAllocationUsd: input.treasuryTargetAllocationUsd,
          treasuryTargetAllocationPct: input.treasuryTargetAllocationPct.toFixed(4),
          appliedAt: input.appliedAt,
          updatedAt: input.appliedAt,
        },
      });
  }

  async persistCarryVenueSnapshots(input: {
    strategyRunId: string;
    venues: CarryVenueView[];
  }): Promise<void> {
    if (input.venues.length === 0) {
      return;
    }

    await this.db.insert(carryVenueSnapshots).values(
      input.venues.map((venue) => ({
        strategyRunId: input.strategyRunId,
        venueId: venue.venueId,
        venueMode: venue.venueMode,
        executionSupported: venue.executionSupported,
        supportsIncreaseExposure: venue.supportsIncreaseExposure,
        supportsReduceExposure: venue.supportsReduceExposure,
        readOnly: venue.readOnly,
        approvedForLiveUse: venue.approvedForLiveUse,
        healthy: venue.healthy,
        onboardingState: venue.onboardingState,
        missingPrerequisites: venue.missingPrerequisites,
        metadata: venue.metadata,
        updatedAt: new Date(venue.updatedAt),
        createdAt: new Date(venue.createdAt),
      })),
    );
  }

  async persistVenueConnectorSnapshots(input: {
    snapshots: VenueSnapshotView[];
  }): Promise<void> {
    if (input.snapshots.length === 0) {
      return;
    }

    await this.db.insert(venueConnectorSnapshots).values(
      input.snapshots.map((snapshot) => ({
        venueId: snapshot.venueId,
        venueName: snapshot.venueName,
        connectorType: snapshot.connectorType,
        sleeveApplicability: snapshot.sleeveApplicability,
        truthMode: snapshot.truthMode,
        readOnlySupport: snapshot.readOnlySupport,
        executionSupport: snapshot.executionSupport,
        approvedForLiveUse: snapshot.approvedForLiveUse,
        onboardingState: snapshot.onboardingState,
        missingPrerequisites: snapshot.missingPrerequisites,
        authRequirementsSummary: snapshot.authRequirementsSummary,
        healthy: snapshot.healthy,
        healthState: snapshot.healthState,
        degradedReason: snapshot.degradedReason,
        snapshotType: snapshot.snapshotType,
        snapshotSuccessful: snapshot.snapshotSuccessful,
        snapshotSummary: snapshot.snapshotSummary,
        snapshotPayload: serialiseVenueSnapshotPayload(snapshot),
        errorMessage: snapshot.errorMessage,
        metadata: snapshot.metadata,
        capturedAt: new Date(snapshot.capturedAt),
      })),
    );
  }

  async persistInternalDerivativeSnapshots(input: {
    snapshots: Array<Omit<InternalDerivativeSnapshotView, 'id' | 'updatedAt'>>;
  }): Promise<void> {
    for (const snapshot of input.snapshots) {
      const [inserted] = await this.db
        .insert(internalDerivativeSnapshots)
        .values({
          venueId: snapshot.venueId,
          venueName: snapshot.venueName,
          sourceComponent: snapshot.sourceComponent,
          sourceRunId: snapshot.sourceRunId,
          sourceReference: snapshot.sourceReference,
          accountState: snapshot.accountState ?? {},
          positionState: snapshot.positionState ?? {},
          healthState: snapshot.healthState ?? {},
          orderState: snapshot.orderState ?? {},
          coverage: snapshot.coverage,
          metadata: snapshot.metadata,
          capturedAt: new Date(snapshot.capturedAt),
        })
        .returning();

      if (inserted === undefined) {
        throw new Error('RuntimeStore.persistInternalDerivativeSnapshots: internal derivative snapshot was not persisted');
      }

      await this.db
        .insert(internalDerivativeCurrent)
        .values({
          venueId: snapshot.venueId,
          venueName: snapshot.venueName,
          latestSnapshotId: inserted.id,
          sourceComponent: snapshot.sourceComponent,
          sourceRunId: snapshot.sourceRunId,
          sourceReference: snapshot.sourceReference,
          accountState: snapshot.accountState ?? {},
          positionState: snapshot.positionState ?? {},
          healthState: snapshot.healthState ?? {},
          orderState: snapshot.orderState ?? {},
          coverage: snapshot.coverage,
          metadata: snapshot.metadata,
          capturedAt: new Date(snapshot.capturedAt),
          updatedAt: new Date(snapshot.capturedAt),
        })
        .onConflictDoUpdate({
          target: internalDerivativeCurrent.venueId,
          set: {
            venueName: snapshot.venueName,
            latestSnapshotId: inserted.id,
            sourceComponent: snapshot.sourceComponent,
            sourceRunId: snapshot.sourceRunId,
            sourceReference: snapshot.sourceReference,
            accountState: snapshot.accountState ?? {},
            positionState: snapshot.positionState ?? {},
            healthState: snapshot.healthState ?? {},
            orderState: snapshot.orderState ?? {},
            coverage: snapshot.coverage,
            metadata: snapshot.metadata,
            capturedAt: new Date(snapshot.capturedAt),
            updatedAt: new Date(snapshot.capturedAt),
          },
        });
    }
  }

  async createCarryActions(input: {
    strategyRunId: string | null;
    linkedRebalanceProposalId?: string | null;
    intents: CarryExecutionIntent[];
    actorId: string | null;
    createdAt: Date;
  }): Promise<CarryActionView[]> {
    const created: CarryActionView[] = [];

    for (const intent of input.intents) {
      const [row] = await this.db
        .insert(carryActions)
        .values({
          strategyRunId: input.strategyRunId,
          linkedRebalanceProposalId: input.linkedRebalanceProposalId ?? null,
          actionType: intent.actionType,
          status: 'recommended',
          sourceKind: intent.sourceKind,
          sourceReference: intent.sourceReference,
          opportunityId: intent.opportunityId,
          asset: intent.asset,
          summary: intent.summary,
          notionalUsd: intent.notionalUsd,
          details: intent.details,
          readiness: intent.readiness,
          executable: intent.executable,
          blockedReasons: intent.blockedReasons as unknown as Record<string, unknown>[],
          approvalRequirement: intent.approvalRequirement,
          executionMode: intent.executionMode,
          simulated: intent.simulated,
          executionPlan: {
            effects: intent.effects,
            plannedOrderCount: intent.plannedOrders.length,
          },
          actorId: input.actorId,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        })
        .returning();

      if (row === undefined) {
        throw new Error('RuntimeStore.createCarryActions: action was not persisted');
      }

      if (intent.plannedOrders.length > 0) {
        await this.db.insert(carryActionOrderIntents).values(
          intent.plannedOrders.map((order) => ({
            carryActionId: row.id,
            intentId: order.intentId,
            venueId: order.venueId,
            asset: order.asset,
            side: order.side,
            orderType: order.type,
            requestedSize: order.size,
            requestedPrice: order.limitPrice,
            reduceOnly: order.reduceOnly,
            metadata: order.metadata,
            createdAt: order.createdAt,
          })),
        );
      }

      created.push(mapCarryActionRow(row));
    }

    return created;
  }

  async approveCarryAction(actionId: string, actorId: string): Promise<CarryActionView | null> {
    await this.db
      .update(carryActions)
      .set({
        status: 'approved',
        approvedBy: actorId,
        approvedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(carryActions.id, actionId));

    const detail = await this.getCarryAction(actionId);
    return detail?.action ?? null;
  }

  async queueCarryActionExecution(input: {
    actionId: string;
    commandId: string;
    actorId: string;
  }): Promise<CarryActionView | null> {
    await this.db
      .update(carryActions)
      .set({
        status: 'queued',
        linkedCommandId: input.commandId,
        executionRequestedBy: input.actorId,
        executionRequestedAt: new Date(),
        queuedAt: new Date(),
        executingAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(carryActions.id, input.actionId));

    const detail = await this.getCarryAction(input.actionId);
    return detail?.action ?? null;
  }

  async markCarryActionExecuting(actionId: string): Promise<CarryActionView | null> {
    await this.db
      .update(carryActions)
      .set({
        status: 'executing',
        executingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(carryActions.id, actionId));

    const detail = await this.getCarryAction(actionId);
    return detail?.action ?? null;
  }

  async completeCarryAction(input: {
    actionId: string;
    latestExecutionId: string;
  }): Promise<CarryActionView | null> {
    await this.db
      .update(carryActions)
      .set({
        status: 'completed',
        latestExecutionId: input.latestExecutionId,
        lastError: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(carryActions.id, input.actionId));

    const detail = await this.getCarryAction(input.actionId);
    return detail?.action ?? null;
  }

  async failCarryAction(input: {
    actionId: string;
    latestExecutionId?: string | null;
    errorMessage: string;
  }): Promise<CarryActionView | null> {
    await this.db
      .update(carryActions)
      .set({
        status: 'failed',
        latestExecutionId: input.latestExecutionId ?? null,
        lastError: input.errorMessage,
        failedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(carryActions.id, input.actionId));

    const detail = await this.getCarryAction(input.actionId);
    return detail?.action ?? null;
  }

  async createCarryExecution(input: {
    carryActionId: string;
    strategyRunId: string | null;
    commandId: string | null;
    status: CarryExecutionView['status'];
    executionMode: CarryExecutionView['executionMode'];
    simulated: boolean;
    requestedBy: string;
    startedBy?: string | null;
    blockedReasons?: CarryOperationalBlockedReason[];
    outcomeSummary?: string | null;
    outcome?: Record<string, unknown>;
    venueExecutionReference?: string | null;
    lastError?: string | null;
  }): Promise<CarryExecutionView> {
    const [row] = await this.db
      .insert(carryActionExecutions)
      .values({
        carryActionId: input.carryActionId,
        strategyRunId: input.strategyRunId,
        commandId: input.commandId,
        status: input.status,
        executionMode: input.executionMode,
        simulated: input.simulated,
        requestedBy: input.requestedBy,
        startedBy: input.startedBy ?? null,
        blockedReasons: (input.blockedReasons ?? []) as unknown as Record<string, unknown>[],
        outcomeSummary: input.outcomeSummary ?? null,
        outcome: input.outcome ?? {},
        venueExecutionReference: input.venueExecutionReference ?? null,
        lastError: input.lastError ?? null,
        startedAt: input.status === 'executing' ? new Date() : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createCarryExecution: execution was not persisted');
    }

    return mapCarryExecutionRow(row);
  }

  async updateCarryExecution(
    executionId: string,
    patch: Partial<{
      status: CarryExecutionView['status'];
      blockedReasons: CarryOperationalBlockedReason[];
      outcomeSummary: string | null;
      outcome: Record<string, unknown>;
      venueExecutionReference: string | null;
      lastError: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>,
  ): Promise<CarryExecutionView | null> {
    await this.db
      .update(carryActionExecutions)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.blockedReasons !== undefined ? { blockedReasons: patch.blockedReasons as unknown as Record<string, unknown>[] } : {}),
        ...(patch.outcomeSummary !== undefined ? { outcomeSummary: patch.outcomeSummary } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.venueExecutionReference !== undefined ? { venueExecutionReference: patch.venueExecutionReference } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(carryActionExecutions.id, executionId));

    return this.getCarryExecutionViewRecord(executionId);
  }

  async createCarryExecutionStep(input: {
    carryExecutionId: string;
    carryActionId: string;
    strategyRunId: string | null;
    plannedOrderId: string | null;
    intentId: string;
    venueId: string;
    venueMode: CarryExecutionStepView['venueMode'];
    executionSupported: boolean;
    readOnly: boolean;
    approvedForLiveUse: boolean;
    onboardingState: CarryExecutionStepView['onboardingState'];
    asset: string;
    side: CarryExecutionStepView['side'];
    orderType: CarryExecutionStepView['orderType'];
    requestedSize: string;
    requestedPrice?: string | null;
    reduceOnly: boolean;
    clientOrderId?: string | null;
    venueOrderId?: string | null;
    executionReference?: string | null;
    status: string;
    simulated: boolean;
    filledSize?: string | null;
    averageFillPrice?: string | null;
    outcomeSummary?: string | null;
    outcome?: Record<string, unknown>;
    lastError?: string | null;
    metadata?: Record<string, unknown>;
    completedAt?: Date | null;
  }): Promise<CarryExecutionStepView> {
    const [row] = await this.db
      .insert(carryExecutionSteps)
      .values({
        carryExecutionId: input.carryExecutionId,
        carryActionId: input.carryActionId,
        strategyRunId: input.strategyRunId,
        plannedOrderId: input.plannedOrderId,
        intentId: input.intentId,
        venueId: input.venueId,
        venueMode: input.venueMode,
        executionSupported: input.executionSupported,
        readOnly: input.readOnly,
        approvedForLiveUse: input.approvedForLiveUse,
        onboardingState: input.onboardingState,
        asset: input.asset,
        side: input.side,
        orderType: input.orderType,
        requestedSize: input.requestedSize,
        requestedPrice: input.requestedPrice ?? null,
        reduceOnly: input.reduceOnly,
        clientOrderId: input.clientOrderId ?? null,
        venueOrderId: input.venueOrderId ?? null,
        executionReference: input.executionReference ?? null,
        status: input.status,
        simulated: input.simulated,
        filledSize: input.filledSize ?? null,
        averageFillPrice: input.averageFillPrice ?? null,
        outcomeSummary: input.outcomeSummary ?? null,
        outcome: input.outcome ?? {},
        lastError: input.lastError ?? null,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: input.completedAt ?? null,
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.createCarryExecutionStep: execution step was not persisted');
    }

    return mapCarryExecutionStepRow(row);
  }

  async updateCarryExecutionStep(
    stepId: string,
    patch: Partial<{
      clientOrderId: string | null;
      venueOrderId: string | null;
      executionReference: string | null;
      status: string;
      simulated: boolean;
      filledSize: string | null;
      averageFillPrice: string | null;
      outcomeSummary: string | null;
      outcome: Record<string, unknown>;
      lastError: string | null;
      metadata: Record<string, unknown>;
      completedAt: Date | null;
    }>,
  ): Promise<CarryExecutionStepView | null> {
    await this.db
      .update(carryExecutionSteps)
      .set({
        ...(patch.clientOrderId !== undefined ? { clientOrderId: patch.clientOrderId } : {}),
        ...(patch.venueOrderId !== undefined ? { venueOrderId: patch.venueOrderId } : {}),
        ...(patch.executionReference !== undefined ? { executionReference: patch.executionReference } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.simulated !== undefined ? { simulated: patch.simulated } : {}),
        ...(patch.filledSize !== undefined ? { filledSize: patch.filledSize } : {}),
        ...(patch.averageFillPrice !== undefined ? { averageFillPrice: patch.averageFillPrice } : {}),
        ...(patch.outcomeSummary !== undefined ? { outcomeSummary: patch.outcomeSummary } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(carryExecutionSteps.id, stepId));

    const [row] = await this.db
      .select()
      .from(carryExecutionSteps)
      .where(eq(carryExecutionSteps.id, stepId))
      .limit(1);

    return row === undefined ? null : mapCarryExecutionStepRow(row);
  }

  async persistTreasuryEvaluation(input: {
    treasuryRunId: string;
    sourceRunId: string | null;
    sleeveId: string;
    policy: TreasuryPolicy;
    evaluation: TreasuryEvaluation;
    executionIntents: TreasuryExecutionIntent[];
    venueCapabilities?: Array<{
      venueId: string;
      venueMode: 'simulated' | 'live';
      supportsAllocation: boolean;
      supportsReduction: boolean;
      executionSupported: boolean;
      readOnly: boolean;
      approvedForLiveUse: boolean;
      onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
      missingPrerequisites: string[];
      healthy: boolean;
      metadata: Record<string, unknown>;
    }>;
    actorId: string | null;
  }): Promise<void> {
    const now = new Date();
    const capabilitiesByVenueId = new Map(
      (input.venueCapabilities ?? []).map((capability) => [capability.venueId, capability] as const),
    );
    await this.db.insert(treasuryRuns).values({
      treasuryRunId: input.treasuryRunId,
      sourceRunId: input.sourceRunId,
      sleeveId: input.sleeveId,
      simulated: input.evaluation.simulated,
      policy: input.policy as unknown as Record<string, unknown>,
      summary: input.evaluation as unknown as Record<string, unknown>,
      totalCapitalUsd: input.evaluation.reserveStatus.totalCapitalUsd,
      idleCapitalUsd: input.evaluation.reserveStatus.idleCapitalUsd,
      allocatedCapitalUsd: input.evaluation.reserveStatus.allocatedCapitalUsd,
      requiredReserveUsd: input.evaluation.reserveStatus.requiredReserveUsd,
      availableReserveUsd: input.evaluation.reserveStatus.currentReserveUsd,
      reserveShortfallUsd: input.evaluation.reserveStatus.reserveShortfallUsd,
      surplusCapitalUsd: input.evaluation.reserveStatus.surplusCapitalUsd,
      concentrationLimitBreached: input.evaluation.recommendations.some(
        (recommendation) => recommendation.reasonCode === 'venue_concentration',
      ),
      actionCount: input.evaluation.recommendations.length,
      evaluatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    if (input.evaluation.venueSnapshots.length > 0) {
      await this.db.insert(treasuryVenueSnapshots).values(
        input.evaluation.venueSnapshots.map((snapshot) => ({
          treasuryRunId: input.treasuryRunId,
          venueId: snapshot.venueId,
          venueName: snapshot.venueName,
          venueMode: snapshot.mode,
          liquidityTier: snapshot.liquidityTier,
          healthy: snapshot.healthy,
          aprBps: snapshot.aprBps,
          currentAllocationUsd: snapshot.currentAllocationUsd,
          withdrawalAvailableUsd: snapshot.withdrawalAvailableUsd,
          availableCapacityUsd: snapshot.availableCapacityUsd,
          concentrationPct: snapshot.concentrationPct,
          metadata: {
            ...snapshot.metadata,
            ...(capabilitiesByVenueId.get(snapshot.venueId) ?? {}),
          },
          updatedAt: new Date(snapshot.updatedAt),
          createdAt: now,
        })),
      );
    }

    if (input.executionIntents.length > 0) {
      await this.db.insert(treasuryActions).values(
        input.executionIntents.map((intent) => ({
          treasuryRunId: input.treasuryRunId,
          linkedRebalanceProposalId: null,
          actionType: intent.actionType,
          status: 'recommended',
          venueId: intent.venueId,
          venueName: intent.venueName,
          venueMode: intent.venueMode,
          amountUsd: intent.amountUsd,
          reasonCode: intent.reasonCode,
          summary: intent.summary,
          details: intent.details,
          readiness: intent.readiness,
          executable: intent.executable,
          blockedReasons: intent.blockedReasons,
          approvalRequirement: intent.approvalRequirement,
          executionMode: intent.executionMode,
          simulated: intent.simulated,
          executionPlan: {
            recommendationType: intent.recommendationType,
            effects: intent.effects,
          },
          actorId: input.actorId,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    await this.db
      .insert(treasuryCurrent)
      .values({
        id: 'primary',
        latestTreasuryRunId: input.treasuryRunId,
        cashBalanceUsd: input.evaluation.reserveStatus.idleCapitalUsd,
        policy: input.policy as unknown as Record<string, unknown>,
        summary: input.evaluation as unknown as Record<string, unknown>,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: treasuryCurrent.id,
        set: {
          latestTreasuryRunId: input.treasuryRunId,
          cashBalanceUsd: input.evaluation.reserveStatus.idleCapitalUsd,
          policy: input.policy as unknown as Record<string, unknown>,
          summary: input.evaluation as unknown as Record<string, unknown>,
          updatedAt: now,
        },
      });
  }

  async getTreasurySummary(): Promise<TreasurySummaryView | null> {
    const [row] = await this.db
      .select()
      .from(treasuryRuns)
      .orderBy(desc(treasuryRuns.evaluatedAt))
      .limit(1);

    return row === undefined ? null : mapTreasurySummaryRow(row);
  }

  async listTreasuryAllocations(limit = 50): Promise<TreasuryAllocationView[]> {
    const [latestRun] = await this.db
      .select({ treasuryRunId: treasuryRuns.treasuryRunId })
      .from(treasuryRuns)
      .orderBy(desc(treasuryRuns.evaluatedAt))
      .limit(1);

    if (latestRun === undefined) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(treasuryVenueSnapshots)
      .where(eq(treasuryVenueSnapshots.treasuryRunId, latestRun.treasuryRunId))
      .limit(limit);

    return rows
      .map(mapTreasuryAllocationRow)
      .sort((left, right) => Number(right.currentAllocationUsd) - Number(left.currentAllocationUsd))
      .slice(0, limit);
  }

  async getTreasuryPolicy(): Promise<TreasuryPolicyView | null> {
    const [row] = await this.db
      .select()
      .from(treasuryCurrent)
      .where(eq(treasuryCurrent.id, 'primary'))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      treasuryRunId: row['latestTreasuryRunId'],
      policy: row['policy'] as TreasuryPolicy,
      updatedAt: row['updatedAt'].toISOString(),
    };
  }

  async getTreasuryCashBalanceUsd(): Promise<string | null> {
    const [row] = await this.db
      .select({ cashBalanceUsd: treasuryCurrent.cashBalanceUsd })
      .from(treasuryCurrent)
      .where(eq(treasuryCurrent.id, 'primary'))
      .limit(1);

    return row?.cashBalanceUsd ?? null;
  }

  async setTreasuryCashBalanceUsd(cashBalanceUsd: string): Promise<void> {
    await this.db
      .update(treasuryCurrent)
      .set({
        cashBalanceUsd,
        updatedAt: new Date(),
      })
      .where(eq(treasuryCurrent.id, 'primary'));
  }

  async listTreasuryActions(limit = 50): Promise<TreasuryActionView[]> {
    const rows = await this.db
      .select()
      .from(treasuryActions)
      .orderBy(desc(treasuryActions.createdAt))
      .limit(limit);

    return rows.map(mapTreasuryActionRow);
  }

  async getTreasuryAction(actionId: string): Promise<TreasuryActionDetailView | null> {
    const [row] = await this.db
      .select()
      .from(treasuryActions)
      .where(eq(treasuryActions.id, actionId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const [latestCommand, executionRows, venue, summary, policy, linkedRebalanceProposal] = await Promise.all([
      row.linkedCommandId === null
        ? Promise.resolve<RuntimeCommandView | null>(null)
        : this.getRuntimeCommand(row.linkedCommandId),
      this.db
        .select()
        .from(treasuryActionExecutions)
        .where(eq(treasuryActionExecutions.treasuryActionId, row.id))
        .orderBy(desc(treasuryActionExecutions.createdAt)),
      row.venueId === null ? Promise.resolve<TreasuryVenueView | null>(null) : this.getTreasuryVenueView(row.venueId),
      this.getTreasurySummary(),
      this.getTreasuryPolicy(),
      row.linkedRebalanceProposalId === null
        ? Promise.resolve<RebalanceProposalView | null>(null)
        : this.db
          .select()
          .from(allocatorRebalanceProposals)
          .where(eq(allocatorRebalanceProposals.id, row.linkedRebalanceProposalId))
          .limit(1)
          .then((proposalRows) => proposalRows[0] === undefined ? null : mapRebalanceProposalRow(proposalRows[0])),
    ]);
    const action = mapTreasuryActionRow(row);
    const executions = executionRows.map(mapTreasuryExecutionRow);

    return {
      action,
      latestCommand,
      executions,
      timeline: createTreasuryTimeline(action, executions),
      linkedRebalanceProposal,
      venue,
      summary,
      policy,
    };
  }

  async listTreasuryExecutions(limit = 50): Promise<TreasuryExecutionView[]> {
    const rows = await this.db
      .select()
      .from(treasuryActionExecutions)
      .orderBy(desc(treasuryActionExecutions.createdAt))
      .limit(limit);

    return rows.map(mapTreasuryExecutionRow);
  }

  async listTreasuryExecutionsForAction(actionId: string): Promise<TreasuryExecutionView[]> {
    const rows = await this.db
      .select()
      .from(treasuryActionExecutions)
      .where(eq(treasuryActionExecutions.treasuryActionId, actionId))
      .orderBy(desc(treasuryActionExecutions.createdAt));

    return rows.map(mapTreasuryExecutionRow);
  }

  async getTreasuryExecution(executionId: string): Promise<TreasuryExecutionView | null> {
    const [row] = await this.db
      .select()
      .from(treasuryActionExecutions)
      .where(eq(treasuryActionExecutions.id, executionId))
      .limit(1);

    return row === undefined ? null : mapTreasuryExecutionRow(row);
  }

  async getTreasuryExecutionDetail(executionId: string): Promise<TreasuryExecutionDetailView | null> {
    const [row] = await this.db
      .select()
      .from(treasuryActionExecutions)
      .where(eq(treasuryActionExecutions.id, executionId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const execution = mapTreasuryExecutionRow(row);
    const actionDetail = await this.getTreasuryAction(row.treasuryActionId);
    const action = actionDetail?.action ?? null;

    return {
      execution,
      action,
      command: row.commandId === null ? null : await this.getRuntimeCommand(row.commandId),
      linkedRebalanceProposal: actionDetail?.linkedRebalanceProposal ?? null,
      executionKind: action?.actionType === 'rebalance_treasury_budget'
        ? 'budget_state_application'
        : 'venue_execution',
      venue: action?.venueId === null || action?.venueId === undefined
        ? null
        : await this.getTreasuryVenueView(action.venueId),
      timeline: actionDetail?.timeline.filter((entry) => (
        entry.linkedExecutionId === null
        || entry.linkedExecutionId === execution.id
      )) ?? [],
    };
  }

  async listTreasuryVenues(limit = 50): Promise<TreasuryVenueView[]> {
    const [latestRun] = await this.db
      .select({ treasuryRunId: treasuryRuns.treasuryRunId })
      .from(treasuryRuns)
      .orderBy(desc(treasuryRuns.evaluatedAt))
      .limit(1);

    if (latestRun === undefined) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(treasuryVenueSnapshots)
      .where(eq(treasuryVenueSnapshots.treasuryRunId, latestRun.treasuryRunId))
      .limit(limit);

    return rows
      .map(mapTreasuryVenueRow)
      .sort((left, right) => left.venueName.localeCompare(right.venueName))
      .slice(0, limit);
  }

  async getTreasuryVenue(venueId: string): Promise<TreasuryVenueDetailView | null> {
    const venue = await this.getTreasuryVenueView(venueId);
    if (venue === null) {
      return null;
    }

    const [policy, latestSummary, actionRows, executionRows] = await Promise.all([
      this.getTreasuryPolicy(),
      this.getTreasurySummary(),
      this.db
        .select()
        .from(treasuryActions)
        .where(eq(treasuryActions.venueId, venueId))
        .orderBy(desc(treasuryActions.createdAt))
        .limit(10),
      this.db
        .select()
        .from(treasuryActionExecutions)
        .where(sql`${treasuryActionExecutions.treasuryActionId} IN (
          SELECT ${treasuryActions.id}
          FROM ${treasuryActions}
          WHERE ${treasuryActions.venueId} = ${venueId}
        )`)
        .orderBy(desc(treasuryActionExecutions.createdAt))
        .limit(10),
    ]);

    return {
      venue,
      policy,
      latestSummary,
      recentActions: actionRows.map(mapTreasuryActionRow),
      recentExecutions: executionRows.map(mapTreasuryExecutionRow),
    };
  }

  private async getTreasuryVenueView(venueId: string): Promise<TreasuryVenueView | null> {
    const [latestRun] = await this.db
      .select({ treasuryRunId: treasuryRuns.treasuryRunId })
      .from(treasuryRuns)
      .orderBy(desc(treasuryRuns.evaluatedAt))
      .limit(1);

    if (latestRun === undefined) {
      return null;
    }

    const [row] = await this.db
      .select()
      .from(treasuryVenueSnapshots)
      .where(and(
        eq(treasuryVenueSnapshots.treasuryRunId, latestRun.treasuryRunId),
        eq(treasuryVenueSnapshots.venueId, venueId),
      ))
      .limit(1);

    return row === undefined ? null : mapTreasuryVenueRow(row);
  }

  async approveTreasuryAction(actionId: string, actorId: string): Promise<TreasuryActionView | null> {
    await this.db
      .update(treasuryActions)
      .set({
        status: 'approved',
        approvedBy: actorId,
        approvedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, actionId));

    const detail = await this.getTreasuryAction(actionId);
    return detail?.action ?? null;
  }

  async queueTreasuryActionExecution(input: {
    actionId: string;
    commandId: string;
    actorId: string;
  }): Promise<TreasuryActionView | null> {
    await this.db
      .update(treasuryActions)
      .set({
        status: 'queued',
        executionRequestedBy: input.actorId,
        executionRequestedAt: new Date(),
        queuedAt: new Date(),
        linkedCommandId: input.commandId,
        executingAt: null,
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, input.actionId));

    const detail = await this.getTreasuryAction(input.actionId);
    return detail?.action ?? null;
  }

  async markTreasuryActionExecuting(actionId: string): Promise<TreasuryActionView | null> {
    await this.db
      .update(treasuryActions)
      .set({
        status: 'executing',
        executingAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, actionId));

    const detail = await this.getTreasuryAction(actionId);
    return detail?.action ?? null;
  }

  async completeTreasuryAction(input: {
    actionId: string;
    latestExecutionId: string;
  }): Promise<TreasuryActionView | null> {
    await this.db
      .update(treasuryActions)
      .set({
        status: 'completed',
        latestExecutionId: input.latestExecutionId,
        completedAt: new Date(),
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, input.actionId));

    const detail = await this.getTreasuryAction(input.actionId);
    return detail?.action ?? null;
  }

  async failTreasuryAction(input: {
    actionId: string;
    latestExecutionId?: string | null;
    errorMessage: string;
  }): Promise<TreasuryActionView | null> {
    await this.db
      .update(treasuryActions)
      .set({
        status: 'failed',
        latestExecutionId: input.latestExecutionId ?? null,
        failedAt: new Date(),
        lastError: input.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, input.actionId));

    const detail = await this.getTreasuryAction(input.actionId);
    return detail?.action ?? null;
  }

  async createTreasuryAction(input: {
    treasuryRunId: string;
    linkedRebalanceProposalId?: string | null;
    actionType: TreasuryActionView['actionType'];
    venueId: string | null;
    venueName: string | null;
    venueMode: TreasuryActionView['venueMode'];
    amountUsd: string;
    reasonCode: string;
    summary: string;
    details: Record<string, unknown>;
    readiness: TreasuryActionView['readiness'];
    executable: boolean;
    blockedReasons: TreasuryActionBlockedReason[];
    approvalRequirement: TreasuryActionView['approvalRequirement'];
    executionMode: TreasuryActionView['executionMode'];
    simulated: boolean;
    actorId: string | null;
    createdAt: Date;
  }): Promise<TreasuryActionView> {
    const [row] = await this.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: input.treasuryRunId,
        linkedRebalanceProposalId: input.linkedRebalanceProposalId ?? null,
        actionType: input.actionType,
        status: 'recommended',
        venueId: input.venueId,
        venueName: input.venueName,
        venueMode: input.venueMode,
        amountUsd: input.amountUsd,
        reasonCode: input.reasonCode,
        summary: input.summary,
        details: input.details,
        readiness: input.readiness,
        executable: input.executable,
        blockedReasons: input.blockedReasons,
        approvalRequirement: input.approvalRequirement,
        executionMode: input.executionMode,
        simulated: input.simulated,
        executionPlan: {},
        actorId: input.actorId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      })
      .returning();

    if (row === undefined) {
      throw new Error('Failed to persist treasury action row.');
    }

    return mapTreasuryActionRow(row);
  }

  async createTreasuryExecution(input: {
    treasuryActionId: string;
    treasuryRunId: string;
    commandId: string | null;
    status: TreasuryExecutionView['status'];
    executionMode: TreasuryExecutionView['executionMode'];
    venueMode: TreasuryExecutionView['venueMode'];
    simulated: boolean;
    requestedBy: string;
    startedBy?: string | null;
    blockedReasons?: TreasuryActionBlockedReason[];
    outcomeSummary?: string | null;
    outcome?: Record<string, unknown>;
    venueExecutionReference?: string | null;
    lastError?: string | null;
  }): Promise<TreasuryExecutionView> {
    const [row] = await this.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: input.treasuryActionId,
        treasuryRunId: input.treasuryRunId,
        commandId: input.commandId,
        status: input.status,
        executionMode: input.executionMode,
        venueMode: input.venueMode,
        simulated: input.simulated,
        requestedBy: input.requestedBy,
        startedBy: input.startedBy ?? null,
        blockedReasons: input.blockedReasons ?? [],
        outcomeSummary: input.outcomeSummary ?? null,
        outcome: input.outcome ?? {},
        venueExecutionReference: input.venueExecutionReference ?? null,
        lastError: input.lastError ?? null,
        startedAt: input.status === 'executing' ? new Date() : null,
        completedAt: input.status === 'completed' || input.status === 'failed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .returning();

    if (row === undefined) {
      throw new Error('Failed to persist treasury execution row.');
    }

    return mapTreasuryExecutionRow(row);
  }

  async updateTreasuryExecution(
    executionId: string,
    patch: {
      status?: TreasuryExecutionView['status'];
      startedBy?: string | null;
      blockedReasons?: TreasuryActionBlockedReason[];
      outcomeSummary?: string | null;
      outcome?: Record<string, unknown>;
      venueExecutionReference?: string | null;
      lastError?: string | null;
    },
  ): Promise<TreasuryExecutionView | null> {
    await this.db
      .update(treasuryActionExecutions)
      .set({
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.startedBy !== undefined ? { startedBy: patch.startedBy } : {}),
        ...(patch.blockedReasons !== undefined ? { blockedReasons: patch.blockedReasons } : {}),
        ...(patch.outcomeSummary !== undefined ? { outcomeSummary: patch.outcomeSummary } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.venueExecutionReference !== undefined
          ? { venueExecutionReference: patch.venueExecutionReference }
          : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.status === 'executing' ? { startedAt: new Date() } : {}),
        ...(patch.status === 'completed' || patch.status === 'failed'
          ? { completedAt: new Date() }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(treasuryActionExecutions.id, executionId));

    return this.getTreasuryExecution(executionId);
  }

  async countApprovedIntentsForRun(runId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(strategyIntents)
      .where(and(eq(strategyIntents.runId, runId), eq(strategyIntents.approved, true)));

    return Number(rows[0]?.count ?? 0);
  }

  async countOrdersForRun(runId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.strategyRunId, runId));

    return Number(rows[0]?.count ?? 0);
  }

  async getProjectionSources(): Promise<{
    latestSuccessfulRunId: string | null;
    runtimeProjectionSourceRunId: string | null;
    riskCurrentSourceRunId: string | null;
    portfolioCurrentSourceRunId: string | null;
    projectionStatus: ProjectionStatus;
  }> {
    const [runtimeRow] = await this.db
      .select({
        projectionStatus: runtimeState.projectionStatus,
        lastProjectionSourceRunId: runtimeState.lastProjectionSourceRunId,
      })
      .from(runtimeState)
      .where(eq(runtimeState.id, 'primary'))
      .limit(1);

    const [riskRow] = await this.db
      .select({ sourceRunId: riskCurrent.sourceRunId })
      .from(riskCurrent)
      .limit(1);

    const [portfolioRow] = await this.db
      .select({ sourceRunId: portfolioCurrent.sourceRunId })
      .from(portfolioCurrent)
      .limit(1);

    return {
      latestSuccessfulRunId: await this.getLatestSuccessfulRunId(),
      runtimeProjectionSourceRunId: runtimeRow?.lastProjectionSourceRunId ?? null,
      riskCurrentSourceRunId: riskRow?.sourceRunId ?? null,
      portfolioCurrentSourceRunId: portfolioRow?.sourceRunId ?? null,
      projectionStatus: (runtimeRow?.projectionStatus ?? 'stale') as ProjectionStatus,
    };
  }

  async getPortfolioCurrentRow(): Promise<typeof portfolioCurrent.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(portfolioCurrent)
      .limit(1);

    return row ?? null;
  }

  async getRiskCurrentRow(): Promise<typeof riskCurrent.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(riskCurrent)
      .limit(1);

    return row ?? null;
  }
}
