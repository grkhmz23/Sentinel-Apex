import { and, desc, eq, sql } from 'drizzle-orm';

import type {
  AllocatorDecision,
  AllocatorPolicy,
  AllocatorRationale,
  RebalanceBlockedReason,
  RebalanceProposal,
} from '@sentinel-apex/allocator';
import {
  allocatorCurrent,
  allocatorRebalanceCurrent,
  allocatorRebalanceExecutions,
  allocatorRebalanceProposalIntents,
  allocatorRebalanceProposals,
  allocatorRecommendations,
  allocatorRuns,
  allocatorSleeveTargets,
  auditEvents,
  executionEvents,
  fills,
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

import type {
  AllocatorDecisionDetailView,
  AllocatorRecommendationView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  AuditEventView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  ProjectionStatus,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RebalanceCurrentView,
  RebalanceExecutionView,
  RebalanceProposalDetailView,
  RebalanceProposalIntentView,
  RebalanceProposalView,
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
    mismatchId?: string;
    reconciliationRunId?: string;
  }): Promise<RuntimeReconciliationFindingView[]> {
    const predicates = [
      input.findingType !== undefined ? eq(runtimeReconciliationFindings.findingType, input.findingType) : undefined,
      input.severity !== undefined ? eq(runtimeReconciliationFindings.severity, input.severity) : undefined,
      input.status !== undefined ? eq(runtimeReconciliationFindings.status, input.status) : undefined,
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

    const [latestCommand, executionRows, venue, summary, policy] = await Promise.all([
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
    ]);
    const action = mapTreasuryActionRow(row);
    const executions = executionRows.map(mapTreasuryExecutionRow);

    return {
      action,
      latestCommand,
      executions,
      timeline: createTreasuryTimeline(action, executions),
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
      venue: action?.venueId === null || action?.venueId === undefined
        ? null
        : await this.getTreasuryVenueView(action.venueId),
      timeline: actionDetail?.timeline ?? [],
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
