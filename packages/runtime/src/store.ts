import Decimal from 'decimal.js';
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import type {
  AllocatorDecision,
  AllocatorPolicy,
  AllocatorRationale,
  RebalanceBlockedReason,
  RebalanceProposal,
} from '@sentinel-apex/allocator';
import {
  buildCarryStrategyProfile,
  type CarryExecutionIntent,
  type CarryOperationalBlockedReason,
} from '@sentinel-apex/carry';
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
  apyCurrent,
  auditEvents,
  carryActionExecutions,
  carryActionOrderIntents,
  carryExecutionSteps,
  carryActions,
  carryHedgeState,
  carryLegExecutions,
  carryMultiLegPlans,
  carryVenueSnapshots,
  cexApiCredentials,
  cexCrossValidations,
  cexImportedTrades,
  cexPnlSnapshots,
  cexTradeImports,
  executionEvents,
  executionGuardrailsConfig,
  executionGuardrailViolations,
  fills,
  internalDerivativeCurrent,
  internalDerivativeSnapshots,
  multiLegEvidenceSummary,
  orders,
  performanceReports,
  portfolioCurrent,
  portfolioSnapshots,
  positions,
  realizedTradePnl,
  riskCurrent,
  riskBreaches,
  riskSnapshots,
  runtimeCommands,
  runtimeMismatchRemediations,
  runtimeMismatches,
  runtimeReconciliationFindings,
  runtimeReconciliationRuns,
  runtimeRecoveryEvents,
  venueConnectorPromotionEvents,
  venueConnectorPromotions,
  venueConnectorSnapshots,
  runtimeState,
  runtimeWorkerState,
  strategyIntents,
  strategyOpportunityEvaluations,
  strategyOpportunities,
  strategyRuns,
  treasuryActionExecutions,
  treasuryActions,
  treasuryCurrent,
  treasuryRuns,
  treasuryVenueSnapshots,
  vaultCurrent,
  vaultDepositLots,
  vaultDepositors,
  vaultRedemptionRequests,
  vaultSubmissionEvidence,
  vaultSubmissionProfiles,
  type Database,
} from '@sentinel-apex/db';
import { createId, type OrderFill, type OrderIntent, type OrderStatus, type RiskAssessment } from '@sentinel-apex/domain';
import type { OrderRecord, OrderStore } from '@sentinel-apex/execution';
import type { AuditEvent, AuditWriter } from '@sentinel-apex/observability';
import type { PortfolioState, RiskSummary } from '@sentinel-apex/risk-engine';
import type {
  TreasuryActionBlockedReason,
  TreasuryEvaluation,
  TreasuryExecutionIntent,
  TreasuryPolicy,
} from '@sentinel-apex/treasury';
import {
  attachCanonicalMarketIdentityToMetadata,
  createCanonicalMarketIdentity,
  readCanonicalMarketIdentityFromMetadata,
  type CanonicalMarketIdentity,
} from '@sentinel-apex/venue-adapters';

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
  CarryOpportunityEvaluationView,
  CarryStrategyProfileView,
  CarryActionView,
  CarryExecutionPostTradeConfirmationView,
  CarryExecutionDetailView,
  CarryExecutionStepView,
  CarryExecutionTimelineEntry,
  CarryExecutionView,
  CarryVenueView,
  ConnectorCapabilityClass,
  ConnectorConfigReadinessMarkerView,
  ConnectorEffectivePosture,
  ConnectorPostTradeConfirmationEvidenceView,
  ConnectorPromotionDetailView,
  ConnectorPromotionEventType,
  ConnectorPromotionEventView,
  ConnectorPromotionOverviewView,
  ConnectorPromotionStatus,
  ConnectorPromotionSummaryView,
  ConnectorPromotionTargetPosture,
  ConnectorReadOnlyValidationState,
  ConnectorReadinessEvidenceView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioPnlResult,
  ProjectionStatus,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RecordVaultDepositInput,
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
  RecordMultiLegEvidenceInput,
  RecordSubmissionEvidenceInput,
  RequestVaultRedemptionInput,
  SubmissionAddressScope,
  SubmissionCompletenessView,
  SubmissionCheckStatus,
  SubmissionCluster,
  SubmissionDossierView,
  SubmissionEvidenceRecordView,
  SubmissionEvidenceSource,
  SubmissionEvidenceStatus,
  SubmissionEvidenceType,
  SubmissionExportArtifactView,
  SubmissionExportBundleView,
  SubmissionReadinessCheckView,
  SubmissionReadinessStatus,
  SubmissionTrack,
  GeneratePerformanceReportInput,
  PerformanceReportView,
  PerformanceReportMetadata,
  PerformanceReportStatus,
  PerformanceReportFormat,
  MultiLegExecutionEvidenceView,
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
  VaultDepositLotStatus,
  VaultDepositLotView,
  VaultDepositorStatus,
  VaultDepositorView,
  VaultExecutionEnvironment,
  VaultRedemptionRequestStatus,
  VaultRedemptionRequestView,
  VaultSummaryView,
  UpsertSubmissionDossierInput,
  WorkerLifecycleState,
  WorkerSchedulerState,
  WorkerStatusView,
} from './types.js';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readOpportunityOptimizer(payload: unknown): Record<string, unknown> {
  return asRecord(asRecord(payload)['optimizer']);
}

function readOpportunityOptimizerValue(
  payload: unknown,
  key: 'evaluationStage' | 'evaluationReason' | 'plannedNotionalUsd',
): string | null {
  const value = readOpportunityOptimizer(payload)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readOpportunityEvaluationStage(
  payload: unknown,
): 'threshold_filter' | 'portfolio_optimizer' | null {
  const value = readOpportunityOptimizerValue(payload, 'evaluationStage');
  return value === 'threshold_filter' || value === 'portfolio_optimizer'
    ? value
    : null;
}

function readOpportunityOptimizerNumber(
  payload: unknown,
  key: 'portfolioScore',
): number | null {
  const value = readOpportunityOptimizer(payload)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readOpportunityOptimizerScoreBreakdown(
  payload: unknown,
): Record<string, number> | null {
  const breakdown = asRecord(readOpportunityOptimizer(payload)['portfolioScoreBreakdown']);
  const entries = Object.entries(breakdown)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => [key, value as number] as const);

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
}

function readOpportunityOptimizerRationale(payload: unknown): string[] {
  const rationale = readOpportunityOptimizer(payload)['rationale'];
  return Array.isArray(rationale)
    ? rationale.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const VENUE_SNAPSHOT_STALE_AFTER_MS = 15 * 60 * 1000;
const CONNECTOR_PROMOTION_TARGET_POSTURE: ConnectorPromotionTargetPosture = 'approved_for_live';
const DEFAULT_PROTOCOL_VAULT_ID = 'apex-usdc-carry-vault';
const DEFAULT_PROTOCOL_MANAGER_NAME = 'Sentinel Apex';
const DEFAULT_SUBMISSION_DOSSIER_ID = 'build-a-bear-main-track';
const DEFAULT_SUBMISSION_NAME = 'Build-A-Bear Main Track';
const DEFAULT_SUBMISSION_BUILD_WINDOW_START = '2026-03-09T00:00:00.000Z';
const DEFAULT_SUBMISSION_BUILD_WINDOW_END = '2026-04-06T23:59:59.999Z';

type VenueInventoryCoreView = Omit<VenueInventoryItemView, 'promotion'>;
type VenueSnapshotCoreView = Omit<VenueSnapshotView, 'promotion'>;
type CarryVenueCoreView = Omit<CarryVenueView, 'promotion'>;
type TreasuryVenueCoreView = Omit<TreasuryVenueView, 'promotion'>;

interface VaultDefaultConfig {
  vaultId: string;
  vaultName: string;
  strategyId: string;
  strategyName: string;
  managerName: string | null;
  managerWalletAddress: string | null;
  baseAsset: string;
  lockPeriodMonths: number;
  rolling: boolean;
  reassessmentCadenceMonths: number;
  targetApyFloorPct: string;
  metadata: Record<string, unknown>;
}

interface SubmissionDefaultConfig {
  id: string;
  submissionName: string;
  track: SubmissionTrack;
  buildWindowStart: Date;
  buildWindowEnd: Date;
  cluster: SubmissionCluster;
  walletAddress: string | null;
  vaultAddress: string | null;
  cexExecutionUsed: boolean;
  cexVenues: string[];
  cexTradeHistoryProvided: boolean;
  cexReadOnlyApiKeyProvided: boolean;
  notes: string | null;
  metadata: Record<string, unknown>;
}

function mapStrategyEnvironmentToVaultExecutionEnvironment(
  environment: string | null | undefined,
): VaultExecutionEnvironment {
  switch (environment) {
    case 'live':
      return 'mainnet';
    case 'devnet':
      return 'devnet';
    case 'backtest':
      return 'backtest';
    case 'simulation':
      return 'simulation';
    default:
      return 'unknown';
  }
}

interface CarryExecutionConfirmationCandidateRecord {
  stepId: string;
  carryExecutionId: string;
  carryActionId: string;
  strategyRunId: string | null;
  intentId: string;
  venueId: string;
  asset: string;
  side: CarryExecutionStepView['side'];
  requestedSize: string;
  reduceOnly: boolean;
  clientOrderId: string | null;
  executionReference: string;
  status: string;
  simulated: boolean;
  metadata: Record<string, unknown>;
  outcome: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

function toSentenceCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

function summariseBooleanKey(key: string): string {
  return `${toSentenceCase(key)} marker`;
}

function countCoverageStatuses(coverage: VenueTruthCoverage): {
  available: number;
  partial: number;
  unsupported: number;
} {
  const summary = {
    available: 0,
    partial: 0,
    unsupported: 0,
  };

  for (const item of Object.values(coverage) as Array<
    VenueTruthCoverage[keyof VenueTruthCoverage]
  >) {
    if (item.status === 'available' || item.status === 'partial' || item.status === 'unsupported') {
      summary[item.status] += 1;
    }
  }

  return summary;
}

function inferConnectorCapabilityClass(input: {
  truthMode: VenueTruthMode;
  executionSupport: boolean;
}): ConnectorCapabilityClass {
  if (input.truthMode === 'simulated') {
    return 'simulated_only';
  }

  if (!input.executionSupport) {
    return 'real_readonly';
  }

  return 'execution_capable';
}

function inferReadOnlyValidationState(input: {
  truthMode: VenueTruthMode;
  snapshotFreshness: VenueSnapshotFreshness;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  healthState: VenueHealthState;
}): ConnectorReadOnlyValidationState {
  if (input.truthMode === 'simulated') {
    return 'not_applicable';
  }

  if (
    input.snapshotFreshness === 'fresh' &&
    input.healthState === 'healthy' &&
    input.snapshotCompleteness === 'complete'
  ) {
    return 'complete';
  }

  if (
    input.snapshotFreshness === 'fresh' &&
    input.healthState !== 'unavailable' &&
    input.snapshotCompleteness !== 'minimal'
  ) {
    return 'partial';
  }

  return 'insufficient';
}

function collectConnectorConfigReadinessMarkers(
  metadata: Record<string, unknown>,
): ConnectorConfigReadinessMarkerView[] {
  return Object.entries(metadata)
    .filter(
      ([key, value]) =>
        typeof value === 'boolean' && (key.endsWith('Configured') || key.endsWith('Enabled')),
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      ready: value === true,
      summary: summariseBooleanKey(key),
    }));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function buildDefaultPostTradeConfirmationEvidence(
  evaluatedAt: string | null,
): ConnectorPostTradeConfirmationEvidenceView {
  return {
    status: 'not_required',
    summary: 'No recent real execution references currently require post-trade confirmation.',
    evaluatedAt: evaluatedAt ?? new Date(0).toISOString(),
    recentExecutionCount: 0,
    confirmedFullCount: 0,
    confirmedPartialCount: 0,
    confirmedPartialEventOnlyCount: 0,
    confirmedPartialPositionOnlyCount: 0,
    pendingCount: 0,
    pendingEventCount: 0,
    pendingPositionDeltaCount: 0,
    conflictingEventCount: 0,
    conflictingEventVsPositionCount: 0,
    missingReferenceCount: 0,
    invalidCount: 0,
    insufficientContextCount: 0,
    latestConfirmedAt: null,
    blockingReasons: [],
    entries: [],
  };
}

function asCarryExecutionPostTradeConfirmation(
  value: unknown,
): CarryExecutionPostTradeConfirmationView | null {
  const candidate = asJsonObject(value);
  return typeof candidate['status'] === 'string' && typeof candidate['summary'] === 'string'
    ? (candidate as unknown as CarryExecutionPostTradeConfirmationView)
    : null;
}

function asConnectorPostTradeConfirmationEvidence(
  value: unknown,
  evaluatedAt: string | null,
): ConnectorPostTradeConfirmationEvidenceView {
  const candidate = asJsonObject(value);
  return typeof candidate['status'] === 'string' && Array.isArray(candidate['entries'])
    ? (candidate as unknown as ConnectorPostTradeConfirmationEvidenceView)
    : buildDefaultPostTradeConfirmationEvidence(evaluatedAt);
}

function buildConnectorEligibilityBlockers(input: {
  capabilityClass: ConnectorCapabilityClass;
  truthMode: VenueTruthMode;
  snapshotFreshness: VenueSnapshotFreshness;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  healthState: VenueHealthState;
  healthy: boolean;
  lastSuccessfulSnapshotAt: string | null;
  missingPrerequisites: string[];
  readOnlyValidationState: ConnectorReadOnlyValidationState;
  configReadiness: ConnectorConfigReadinessMarkerView[];
  postTradeConfirmation: ConnectorPostTradeConfirmationEvidenceView;
}): string[] {
  const blockers = [...input.missingPrerequisites];

  if (input.capabilityClass === 'simulated_only') {
    blockers.push('Connector is simulated only and cannot be promoted for live use.');
  } else if (input.capabilityClass === 'real_readonly') {
    blockers.push('Connector remains read-only and does not provide execution capability.');
  }

  if (input.truthMode !== 'real') {
    blockers.push('Connector does not currently expose real venue truth.');
  }

  if (input.lastSuccessfulSnapshotAt === null) {
    blockers.push('No successful venue-truth snapshot has been recorded.');
  }

  if (input.snapshotFreshness !== 'fresh') {
    blockers.push('Latest venue-truth snapshot is stale.');
  }

  if (!input.healthy || input.healthState !== 'healthy') {
    blockers.push(`Connector health is ${input.healthState}.`);
  }

  if (input.snapshotCompleteness !== 'complete') {
    blockers.push(`Latest venue-truth snapshot completeness is ${input.snapshotCompleteness}.`);
  }

  if (input.readOnlyValidationState !== 'complete') {
    blockers.push(`Read-only validation is ${input.readOnlyValidationState}.`);
  }

  for (const marker of input.configReadiness) {
    if (!marker.ready) {
      blockers.push(`${marker.summary} is not ready.`);
    }
  }

  if (
    input.capabilityClass === 'execution_capable' &&
    input.postTradeConfirmation.status === 'blocked'
  ) {
    blockers.push(...input.postTradeConfirmation.blockingReasons);
  }

  return uniqueStrings(blockers);
}

function buildConnectorReadinessEvidence(
  venue: VenueInventoryCoreView,
): ConnectorReadinessEvidenceView {
  const capabilityClass = inferConnectorCapabilityClass({
    truthMode: venue.truthMode,
    executionSupport: venue.executionSupport,
  });
  const coverageCounts = countCoverageStatuses(venue.truthCoverage);
  const configReadiness = collectConnectorConfigReadinessMarkers(venue.metadata);
  const postTradeConfirmation =
    venue.executionConfirmationState ??
    buildDefaultPostTradeConfirmationEvidence(venue.lastSnapshotAt);
  const readOnlyValidationState = inferReadOnlyValidationState({
    truthMode: venue.truthMode,
    snapshotFreshness: venue.snapshotFreshness,
    snapshotCompleteness: venue.snapshotCompleteness,
    healthState: venue.healthState,
  });
  const blockingReasons = buildConnectorEligibilityBlockers({
    capabilityClass,
    truthMode: venue.truthMode,
    snapshotFreshness: venue.snapshotFreshness,
    snapshotCompleteness: venue.snapshotCompleteness,
    healthState: venue.healthState,
    healthy: venue.healthy,
    lastSuccessfulSnapshotAt: venue.lastSuccessfulSnapshotAt,
    missingPrerequisites: venue.missingPrerequisites,
    readOnlyValidationState,
    configReadiness,
    postTradeConfirmation,
  });

  return {
    venueId: venue.venueId,
    venueName: venue.venueName,
    connectorType: venue.connectorType,
    sleeveApplicability: venue.sleeveApplicability,
    truthMode: venue.truthMode,
    capabilityClass,
    executionSupport: venue.executionSupport,
    readOnlySupport: venue.readOnlySupport,
    snapshotFreshness: venue.snapshotFreshness,
    snapshotCompleteness: venue.snapshotCompleteness,
    healthy: venue.healthy,
    healthState: venue.healthState,
    degradedReason: venue.degradedReason,
    lastSnapshotAt: venue.lastSnapshotAt,
    lastSuccessfulSnapshotAt: venue.lastSuccessfulSnapshotAt,
    truthCoverageAvailableCount: coverageCounts.available,
    truthCoveragePartialCount: coverageCounts.partial,
    truthCoverageUnsupportedCount: coverageCounts.unsupported,
    readOnlyValidationState,
    configReadiness,
    missingPrerequisites: venue.missingPrerequisites,
    blockingReasons,
    eligibleForPromotion: capabilityClass === 'execution_capable' && blockingReasons.length === 0,
    postTradeConfirmation,
  };
}

function buildFallbackConnectorReadinessEvidence(input: {
  venueId: string;
  venueName: string;
  connectorType: string;
  sleeveApplicability: VenueTruthSleeve[];
  truthMode: VenueTruthMode;
  executionSupport: boolean;
  readOnlySupport: boolean;
  healthy: boolean;
  healthState: VenueHealthState;
  degradedReason: string | null;
  lastSnapshotAt: string;
  missingPrerequisites: string[];
}): ConnectorReadinessEvidenceView {
  const capabilityClass = inferConnectorCapabilityClass({
    truthMode: input.truthMode,
    executionSupport: input.executionSupport,
  });
  const readOnlyValidationState = inferReadOnlyValidationState({
    truthMode: input.truthMode,
    snapshotFreshness: 'missing',
    snapshotCompleteness: 'minimal',
    healthState: input.healthState,
  });
  const postTradeConfirmation = buildDefaultPostTradeConfirmationEvidence(input.lastSnapshotAt);
  const blockingReasons = buildConnectorEligibilityBlockers({
    capabilityClass,
    truthMode: input.truthMode,
    snapshotFreshness: 'missing',
    snapshotCompleteness: 'minimal',
    healthState: input.healthState,
    healthy: input.healthy,
    lastSuccessfulSnapshotAt: null,
    missingPrerequisites: [
      ...input.missingPrerequisites,
      'No generic venue-truth inventory snapshot is available for this connector.',
    ],
    readOnlyValidationState,
    configReadiness: [],
    postTradeConfirmation,
  });

  return {
    venueId: input.venueId,
    venueName: input.venueName,
    connectorType: input.connectorType,
    sleeveApplicability: input.sleeveApplicability,
    truthMode: input.truthMode,
    capabilityClass,
    executionSupport: input.executionSupport,
    readOnlySupport: input.readOnlySupport,
    snapshotFreshness: 'missing',
    snapshotCompleteness: 'minimal',
    healthy: input.healthy,
    healthState: input.healthState,
    degradedReason: input.degradedReason,
    lastSnapshotAt: input.lastSnapshotAt,
    lastSuccessfulSnapshotAt: null,
    truthCoverageAvailableCount: 0,
    truthCoveragePartialCount: 0,
    truthCoverageUnsupportedCount: 0,
    readOnlyValidationState,
    configReadiness: [],
    missingPrerequisites: input.missingPrerequisites,
    blockingReasons,
    eligibleForPromotion: false,
    postTradeConfirmation,
  };
}

function deriveEffectivePosture(
  capabilityClass: ConnectorCapabilityClass,
  promotionStatus: ConnectorPromotionStatus,
): ConnectorEffectivePosture {
  if (promotionStatus === 'suspended') {
    return 'suspended';
  }

  if (capabilityClass === 'simulated_only') {
    return 'simulated_only';
  }

  if (capabilityClass === 'real_readonly') {
    return 'real_readonly';
  }

  if (promotionStatus === 'approved') {
    return 'approved_for_live';
  }

  if (promotionStatus === 'pending_review') {
    return 'promotion_pending';
  }

  if (promotionStatus === 'rejected') {
    return 'rejected';
  }

  return 'execution_capable_unapproved';
}

function buildDefaultPromotionSummary(
  evidence: ConnectorReadinessEvidenceView,
): ConnectorPromotionSummaryView {
  return {
    promotionId: null,
    requestedTargetPosture: null,
    capabilityClass: evidence.capabilityClass,
    promotionStatus: 'not_requested',
    effectivePosture: deriveEffectivePosture(evidence.capabilityClass, 'not_requested'),
    approvedForLiveUse: false,
    sensitiveExecutionEligible: false,
    requestedBy: null,
    requestedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    suspendedBy: null,
    suspendedAt: null,
    latestNote: null,
    blockers: evidence.blockingReasons,
  };
}

function buildPromotionSummaryFromRow(
  row: typeof venueConnectorPromotions.$inferSelect,
  evidence: ConnectorReadinessEvidenceView,
): ConnectorPromotionSummaryView {
  const promotionStatus = row.promotionStatus as ConnectorPromotionStatus;
  const effectivePosture = deriveEffectivePosture(evidence.capabilityClass, promotionStatus);
  const approvedForLiveUse = promotionStatus === 'approved';
  const sensitiveExecutionEligible =
    approvedForLiveUse && effectivePosture === 'approved_for_live' && evidence.eligibleForPromotion;

  return {
    promotionId: row.id,
    requestedTargetPosture: row.requestedTargetPosture as ConnectorPromotionTargetPosture,
    capabilityClass: evidence.capabilityClass,
    promotionStatus,
    effectivePosture,
    approvedForLiveUse,
    sensitiveExecutionEligible,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: toIsoString(row.reviewedAt),
    approvedBy: row.approvedBy ?? null,
    approvedAt: toIsoString(row.approvedAt),
    rejectedBy: row.rejectedBy ?? null,
    rejectedAt: toIsoString(row.rejectedAt),
    suspendedBy: row.suspendedBy ?? null,
    suspendedAt: toIsoString(row.suspendedAt),
    latestNote: row.decisionNote ?? null,
    blockers: evidence.blockingReasons,
  };
}

function asConnectorReadinessEvidence(value: unknown): ConnectorReadinessEvidenceView {
  return asRecord(value) as unknown as ConnectorReadinessEvidenceView;
}

function mapPromotionEventRow(
  row: typeof venueConnectorPromotionEvents.$inferSelect,
): ConnectorPromotionEventView {
  return {
    id: row.id,
    promotionId: row.promotionId,
    venueId: row.venueId,
    eventType: row.eventType as ConnectorPromotionEventType,
    fromStatus: row.fromStatus === null ? null : (row.fromStatus as ConnectorPromotionStatus),
    toStatus: row.toStatus as ConnectorPromotionStatus,
    effectivePosture: row.effectivePosture as ConnectorEffectivePosture,
    requestedTargetPosture: row.requestedTargetPosture as ConnectorPromotionTargetPosture,
    actorId: row.actorId,
    note: row.note ?? null,
    evidence: asConnectorReadinessEvidence(row.readinessEvidence),
    occurredAt: row.occurredAt.toISOString(),
    metadata: asJsonObject(row.metadata),
  };
}

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
  executionConfirmationState: ConnectorPostTradeConfirmationEvidenceView | null;
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
    snapshotCompleteness:
      payload['snapshotCompleteness'] === 'complete' ||
      payload['snapshotCompleteness'] === 'partial' ||
      payload['snapshotCompleteness'] === 'minimal'
        ? payload['snapshotCompleteness']
        : 'minimal',
    truthCoverage:
      asJsonObject(coverage)['accountState'] !== undefined
        ? (coverage as VenueTruthCoverage)
        : createEmptyVenueTruthCoverage(),
    sourceMetadata:
      asJsonObject(sourceMetadata)['sourceName'] !== undefined
        ? (sourceMetadata as VenueTruthSourceMetadata)
        : defaultVenueTruthSourceMetadata(connectorType, truthMode),
    accountState:
      asJsonObject(payload['accountState'])['accountAddress'] !== undefined ||
      asJsonObject(payload['accountState'])['accountExists'] !== undefined
        ? (payload['accountState'] as VenueAccountStateSnapshot)
        : null,
    balanceState: Array.isArray(asJsonObject(payload['balanceState'])['balances'])
      ? (payload['balanceState'] as VenueSnapshotView['balanceState'])
      : null,
    capacityState:
      asJsonObject(payload['capacityState'])['availableCapacityUsd'] !== undefined
        ? (payload['capacityState'] as VenueSnapshotView['capacityState'])
        : null,
    exposureState: Array.isArray(asJsonObject(payload['exposureState'])['exposures'])
      ? (payload['exposureState'] as VenueExposureStateSnapshot)
      : null,
    derivativeAccountState:
      asJsonObject(payload['derivativeAccountState'])['accountModel'] !== undefined ||
      asJsonObject(payload['derivativeAccountState'])['venueAccountType'] !== undefined
        ? (payload['derivativeAccountState'] as VenueDerivativeAccountStateSnapshot)
        : null,
    derivativePositionState: Array.isArray(
      asJsonObject(payload['derivativePositionState'])['positions'],
    )
      ? (payload['derivativePositionState'] as VenueDerivativePositionStateSnapshot)
      : null,
    derivativeHealthState:
      asJsonObject(payload['derivativeHealthState'])['healthStatus'] !== undefined ||
      asJsonObject(payload['derivativeHealthState'])['methodology'] !== undefined
        ? (payload['derivativeHealthState'] as VenueDerivativeHealthStateSnapshot)
        : null,
    orderState:
      Array.isArray(asJsonObject(payload['orderState'])['openOrders']) ||
      asJsonObject(payload['orderState'])['referenceMode'] !== undefined
        ? (payload['orderState'] as VenueOrderStateSnapshot)
        : null,
    executionReferenceState: Array.isArray(
      asJsonObject(payload['executionReferenceState'])['references'],
    )
      ? (payload['executionReferenceState'] as VenueExecutionReferenceStateSnapshot)
      : null,
    executionConfirmationState:
      asJsonObject(payload['executionConfirmationState'])['status'] !== undefined
        ? asConnectorPostTradeConfirmationEvidence(payload['executionConfirmationState'], null)
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
    executionConfirmationState: snapshot.executionConfirmationState,
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
    accountState: coverageItem(
      'unsupported',
      'No internal derivative account state is currently persisted.',
      [],
    ),
    positionState: coverageItem(
      'unsupported',
      'No internal derivative position state is currently persisted.',
      [],
    ),
    healthState: coverageItem(
      'unsupported',
      'No internal derivative health state is currently persisted.',
      [],
    ),
    orderState: coverageItem(
      'unsupported',
      'No internal derivative order state is currently persisted.',
      [],
    ),
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
    coverage:
      coverage['accountState'] !== undefined
        ? (row.coverage as InternalDerivativeCoverageView)
        : defaultInternalDerivativeCoverage(),
    accountState:
      accountState['venueId'] !== undefined
        ? (row.accountState as InternalDerivativeSnapshotView['accountState'])
        : null,
    positionState: Array.isArray(positionState['positions'])
      ? (row.positionState as InternalDerivativeSnapshotView['positionState'])
      : null,
    healthState:
      healthState['methodology'] !== undefined
        ? (row.healthState as InternalDerivativeSnapshotView['healthState'])
        : null,
    orderState: Array.isArray(orderState['openOrders'])
      ? (row.orderState as InternalDerivativeSnapshotView['orderState'])
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
    input.connectorType === 'drift_native_readonly' ||
    input.sourceMetadata.sourceName === 'drift_native_readonly'
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

function deriveVenueTruthProfile(snapshotData: PersistedVenueSnapshotPayload): VenueTruthProfile {
  if (
    snapshotData.truthCoverage.derivativeAccountState.status !== 'unsupported' ||
    snapshotData.truthCoverage.derivativePositionState.status !== 'unsupported' ||
    snapshotData.truthCoverage.derivativeHealthState.status !== 'unsupported' ||
    snapshotData.truthCoverage.orderState.status !== 'unsupported'
  ) {
    return 'derivative_aware';
  }

  if (snapshotData.truthCoverage.capacityState.status === 'available') {
    return 'capacity_only';
  }

  if (
    snapshotData.truthCoverage.accountState.status === 'available' ||
    snapshotData.truthCoverage.balanceState.status === 'available' ||
    snapshotData.truthCoverage.exposureState.status === 'available' ||
    snapshotData.truthCoverage.executionReferences.status === 'available'
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
    executionReferences:
      executionReferenceCoverage.status === 'available'
        ? comparisonCoverageItem('available', null)
        : comparisonCoverageItem(
            executionReferenceCoverage.status,
            executionReferenceCoverage.reason ??
              'Recent execution references are not available for comparison.',
          ),
    positionInventory: comparisonCoverageItem(
      'unsupported',
      isDriftNativeReadonly &&
        input.snapshotData.truthCoverage.derivativePositionState.status === 'available'
        ? 'Decoded Drift position inventory is visible, but the runtime does not yet persist venue-native Drift position projections for direct comparison.'
        : 'The runtime does not yet maintain a truthful internal position model that can be compared directly against this venue snapshot.',
    ),
    healthState: comparisonCoverageItem(
      'unsupported',
      isDriftNativeReadonly &&
        input.snapshotData.truthCoverage.derivativeHealthState.status === 'available'
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'string') {
      return [];
    }

    const trimmed = item.trim();
    return trimmed.length === 0 ? [] : [trimmed];
  });
}

function decimalOrZero(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }

  return new Decimal(value);
}

function formatDecimal(value: Decimal, decimalPlaces = 8): string {
  return value.toFixed(decimalPlaces);
}

function formatMoney(value: Decimal): string {
  return value.toFixed(2);
}

function addMonths(value: Date, months: number): Date {
  const next = new Date(value.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeSubmissionCluster(value: string | null | undefined): SubmissionCluster {
  switch (value) {
    case 'devnet':
    case 'mainnet-beta':
      return value;
    default:
      return 'unknown';
  }
}

function normalizeSubmissionTrack(value: string | null | undefined): SubmissionTrack {
  return value === 'drift_side_track' ? 'drift_side_track' : 'build_a_bear_main_track';
}

function normalizeSubmissionEvidenceType(value: string | null | undefined): SubmissionEvidenceType {
  switch (value) {
    case 'on_chain_transaction':
    case 'performance_snapshot':
    case 'cex_trade_history':
    case 'cex_read_only_api':
      return value;
    default:
      return 'document';
  }
}

function normalizeSubmissionEvidenceStatus(
  value: string | null | undefined,
): SubmissionEvidenceStatus {
  switch (value) {
    case 'verified':
    case 'rejected':
      return value;
    default:
      return 'recorded';
  }
}

function normalizeSubmissionEvidenceSource(
  value: string | null | undefined,
): SubmissionEvidenceSource {
  switch (value) {
    case 'runtime':
    case 'solscan':
    case 'exchange_export':
    case 'exchange_api':
      return value;
    default:
      return 'manual';
  }
}

function sanitizeSubmissionEvidenceReference(
  evidenceType: SubmissionEvidenceType,
  reference: string | null,
): string | null {
  if (evidenceType === 'cex_read_only_api') {
    return null;
  }

  return reference;
}

function resolveSubmissionAddressScope(
  walletAddress: string | null,
  vaultAddress: string | null,
): SubmissionAddressScope {
  if (walletAddress !== null && vaultAddress !== null) {
    return 'both';
  }
  if (walletAddress !== null) {
    return 'wallet';
  }
  if (vaultAddress !== null) {
    return 'vault';
  }
  return 'unconfigured';
}

function buildSolscanUrl(
  kind: 'account' | 'tx',
  value: string | null,
  cluster: SubmissionCluster,
): string | null {
  if (value === null || cluster === 'unknown') {
    return null;
  }

  const encodedValue = encodeURIComponent(value);
  const path = kind === 'account' ? 'account' : 'tx';
  const clusterQuery = cluster === 'devnet' ? '?cluster=devnet' : '';
  return `https://solscan.io/${path}/${encodedValue}${clusterQuery}`;
}

function mapVaultExecutionEnvironmentToSubmissionCluster(
  environment: VaultExecutionEnvironment,
): SubmissionCluster {
  switch (environment) {
    case 'devnet':
      return 'devnet';
    case 'mainnet':
      return 'mainnet-beta';
    default:
      return 'unknown';
  }
}

function buildDefaultVaultConfig(): VaultDefaultConfig {
  const profile = buildCarryStrategyProfile();
  return {
    vaultId: DEFAULT_PROTOCOL_VAULT_ID,
    vaultName: 'Apex USDC Delta-Neutral Carry Vault',
    strategyId: profile.strategyId,
    strategyName: profile.strategyName,
    managerName: DEFAULT_PROTOCOL_MANAGER_NAME,
    managerWalletAddress: null,
    baseAsset: profile.vaultBaseAsset,
    lockPeriodMonths: profile.tenor.lockPeriodMonths,
    rolling: profile.tenor.rolling,
    reassessmentCadenceMonths: profile.tenor.reassessmentCadenceMonths,
    targetApyFloorPct: profile.apy.targetFloorPct,
    metadata: {
      strategyFamily: profile.strategyFamily,
      lockReassessmentPolicy: profile.lockReassessmentPolicy,
    },
  };
}

function buildDefaultSubmissionConfig(): SubmissionDefaultConfig {
  return {
    id: DEFAULT_SUBMISSION_DOSSIER_ID,
    submissionName: DEFAULT_SUBMISSION_NAME,
    track: 'build_a_bear_main_track',
    buildWindowStart: new Date(DEFAULT_SUBMISSION_BUILD_WINDOW_START),
    buildWindowEnd: new Date(DEFAULT_SUBMISSION_BUILD_WINDOW_END),
    cluster: 'unknown',
    walletAddress: null,
    vaultAddress: null,
    cexExecutionUsed: false,
    cexVenues: [],
    cexTradeHistoryProvided: false,
    cexReadOnlyApiKeyProvided: false,
    notes: null,
    metadata: {},
  };
}

function buildSubmissionReadinessCheck(
  key: string,
  status: SubmissionCheckStatus,
  summary: string,
  blockedReason: string | null,
  details: Record<string, unknown>,
): SubmissionReadinessCheckView {
  return {
    key,
    status,
    summary,
    blockedReason,
    details,
  };
}

function buildSubmissionReadiness(input: {
  addressScope: SubmissionAddressScope;
  cluster: SubmissionCluster;
  baseAsset: string;
  lockPeriodMonths: number;
  rolling: boolean;
  reassessmentCadenceMonths: number;
  targetApyFloorPct: string;
  strategyEligibilityStatus: CarryStrategyProfileView['eligibility']['status'];
  strategyBlockedReasons: string[];
  realizedApyPct: string | null;
  realExecutionCountInWindow: number;
  onChainEvidenceCountInWindow: number;
  performanceEvidenceCount: number;
  cexExecutionUsed: boolean;
  cexTradeHistoryProvided: boolean;
  cexReadOnlyApiKeyProvided: boolean;
  cexTradeHistoryEvidenceCount: number;
  cexReadOnlyApiEvidenceCount: number;
}): SubmissionDossierView['readiness'] {
  const checks: SubmissionReadinessCheckView[] = [];

  checks.push(
    buildSubmissionReadinessCheck(
      'submission_address_present',
      input.addressScope === 'unconfigured' ? 'fail' : 'pass',
      input.addressScope === 'unconfigured'
        ? 'Submission is missing both wallet and vault addresses.'
        : 'Submission includes a wallet or vault address for on-chain verification.',
      input.addressScope === 'unconfigured' ? 'submission_address_required' : null,
      { addressScope: input.addressScope },
    ),
  );

  checks.push(
    buildSubmissionReadinessCheck(
      'mainnet_cluster',
      input.cluster === 'mainnet-beta' ? 'pass' : 'fail',
      input.cluster === 'mainnet-beta'
        ? 'Submission is configured for mainnet-beta verification.'
        : `Submission currently points to ${input.cluster}; verified performance for seeding requires mainnet-beta evidence.`,
      input.cluster === 'mainnet-beta' ? null : 'mainnet_cluster_required',
      { cluster: input.cluster },
    ),
  );

  checks.push(
    buildSubmissionReadinessCheck(
      'base_asset_usdc',
      input.baseAsset === 'USDC' ? 'pass' : 'fail',
      input.baseAsset === 'USDC'
        ? 'Vault base asset is USDC as required.'
        : `Vault base asset ${input.baseAsset} is not eligible; Build-A-Bear requires USDC.`,
      input.baseAsset === 'USDC' ? null : 'vault_base_asset_must_be_usdc',
      { baseAsset: input.baseAsset },
    ),
  );

  const validTenor =
    input.lockPeriodMonths === 3 && input.rolling && input.reassessmentCadenceMonths === 3;
  checks.push(
    buildSubmissionReadinessCheck(
      'tenor_three_month_rolling',
      validTenor ? 'pass' : 'fail',
      validTenor
        ? 'Vault tenor is a 3-month rolling lock with 3-month reassessment.'
        : 'Vault tenor does not match the required 3-month rolling lock with 3-month reassessment.',
      validTenor ? null : 'vault_tenor_must_be_three_month_rolling',
      {
        lockPeriodMonths: input.lockPeriodMonths,
        rolling: input.rolling,
        reassessmentCadenceMonths: input.reassessmentCadenceMonths,
      },
    ),
  );

  const targetApyPasses = decimalOrZero(input.targetApyFloorPct).gte(10);
  checks.push(
    buildSubmissionReadinessCheck(
      'target_apy_floor',
      targetApyPasses ? 'pass' : 'fail',
      targetApyPasses
        ? `Configured APY floor ${input.targetApyFloorPct}% meets the 10% minimum.`
        : `Configured APY floor ${input.targetApyFloorPct}% is below the 10% minimum.`,
      targetApyPasses ? null : 'target_apy_floor_below_minimum',
      { targetApyFloorPct: input.targetApyFloorPct },
    ),
  );

  checks.push(
    buildSubmissionReadinessCheck(
      'strategy_policy_eligibility',
      input.strategyEligibilityStatus === 'eligible' ? 'pass' : 'fail',
      input.strategyEligibilityStatus === 'eligible'
        ? 'Strategy metadata currently satisfies the Build-A-Bear policy rules.'
        : 'Strategy metadata is still blocked by Build-A-Bear policy rules.',
      input.strategyEligibilityStatus === 'eligible'
        ? null
        : input.strategyBlockedReasons[0] ?? 'strategy_policy_ineligible',
      {
        strategyEligibilityStatus: input.strategyEligibilityStatus,
        strategyBlockedReasons: input.strategyBlockedReasons,
      },
    ),
  );

  const realizedApyAvailable = input.realizedApyPct !== null;
  const realizedApyMeetsMinimum =
    realizedApyAvailable && decimalOrZero(input.realizedApyPct).gte(10);
  checks.push(
    buildSubmissionReadinessCheck(
      'realized_performance_evidence',
      !realizedApyAvailable || !realizedApyMeetsMinimum ? 'fail' : 'pass',
      !realizedApyAvailable
        ? input.performanceEvidenceCount > 0
          ? 'Performance evidence artifacts exist, but realized APY is still not persisted as a numeric value.'
          : 'Realized APY evidence is not currently persisted.'
        : realizedApyMeetsMinimum
          ? `Realized APY ${input.realizedApyPct}% meets the 10% minimum.`
          : `Realized APY ${input.realizedApyPct}% is below the 10% minimum.`,
      !realizedApyAvailable
        ? 'realized_apy_evidence_missing'
        : realizedApyMeetsMinimum
          ? null
          : 'realized_apy_below_minimum',
      {
        realizedApyPct: input.realizedApyPct,
        performanceEvidenceCount: input.performanceEvidenceCount,
      },
    ),
  );

  const onChainEvidenceCount = Math.max(
    input.realExecutionCountInWindow,
    input.onChainEvidenceCountInWindow,
  );
  checks.push(
    buildSubmissionReadinessCheck(
      'on_chain_trade_evidence',
      onChainEvidenceCount > 0 ? 'pass' : 'fail',
      onChainEvidenceCount > 0
        ? input.onChainEvidenceCountInWindow > 0
          ? `Submission window includes ${input.onChainEvidenceCountInWindow} explicit on-chain evidence record(s).`
          : `Submission window includes ${input.realExecutionCountInWindow} real execution record(s).`
        : 'No real on-chain execution evidence is currently persisted inside the submission window.',
      onChainEvidenceCount > 0 ? null : 'on_chain_trade_evidence_missing',
      {
        realExecutionCountInWindow: input.realExecutionCountInWindow,
        onChainEvidenceCountInWindow: input.onChainEvidenceCountInWindow,
      },
    ),
  );

  const cexArtifactsReady =
    !input.cexExecutionUsed || (
      (input.cexTradeHistoryProvided || input.cexTradeHistoryEvidenceCount > 0) &&
      (input.cexReadOnlyApiKeyProvided || input.cexReadOnlyApiEvidenceCount > 0)
    );
  checks.push(
    buildSubmissionReadinessCheck(
      'cex_verification_artifacts',
      cexArtifactsReady ? 'pass' : 'fail',
      !input.cexExecutionUsed
        ? 'CEX verification artifacts are not required for an on-chain-only submission.'
        : (
          input.cexTradeHistoryProvided || input.cexTradeHistoryEvidenceCount > 0
        ) && (
          input.cexReadOnlyApiKeyProvided || input.cexReadOnlyApiEvidenceCount > 0
        )
          ? 'Required CEX verification artifacts are marked as provided.'
          : 'CEX execution is enabled, but the required trade history or read-only API key artifact is still missing.',
      cexArtifactsReady ? null : 'cex_verification_artifacts_missing',
      {
        cexExecutionUsed: input.cexExecutionUsed,
        cexTradeHistoryProvided: input.cexTradeHistoryProvided,
        cexReadOnlyApiKeyProvided: input.cexReadOnlyApiKeyProvided,
        cexTradeHistoryEvidenceCount: input.cexTradeHistoryEvidenceCount,
        cexReadOnlyApiEvidenceCount: input.cexReadOnlyApiEvidenceCount,
      },
    ),
  );

  const blockedReasons = checks.flatMap((check) =>
    check.status === 'fail' && check.blockedReason !== null ? [check.blockedReason] : []);
  const warnings = checks.flatMap((check) =>
    check.status === 'warning' && check.blockedReason !== null ? [check.blockedReason] : []);
  const status: SubmissionReadinessStatus = blockedReasons.length > 0
    ? 'blocked'
    : warnings.length > 0
      ? 'partial'
      : 'ready';

  return {
    status,
    summary:
      status === 'ready'
        ? 'Submission dossier has the required eligibility, address, and evidence markers to support a Main Track review.'
        : status === 'partial'
          ? 'Submission dossier is usable but still has warnings to resolve before review.'
          : 'Submission dossier is still blocked because one or more eligibility or verification requirements are unmet.',
    blockedReasons,
    warnings,
    checks,
  };
}

function buildSubmissionExportArtifact(
  key: string,
  label: string,
  required: boolean,
  status: SubmissionCheckStatus,
  summary: string,
  blockedReason: string | null,
  evidenceCount: number,
  evidenceTypes: SubmissionEvidenceType[],
): SubmissionExportArtifactView {
  return {
    key,
    label,
    required,
    status,
    summary,
    blockedReason,
    evidenceCount,
    evidenceTypes,
  };
}

function buildSubmissionExportBundle(input: {
  dossier: SubmissionDossierView;
  evidence: SubmissionEvidenceRecordView[];
}): SubmissionExportBundleView {
  const evidenceByType = (type: SubmissionEvidenceType): SubmissionEvidenceRecordView[] =>
    input.evidence.filter((item) => item.evidenceType === type && item.status !== 'rejected');
  const addressCount = [input.dossier.walletAddress, input.dossier.vaultAddress].filter(
    (value): value is string => value !== null,
  ).length;
  const onChainEvidence = evidenceByType('on_chain_transaction').filter((item) => item.withinBuildWindow);
  const performanceEvidence = evidenceByType('performance_snapshot');
  const cexTradeHistoryEvidence = evidenceByType('cex_trade_history');
  const cexApiEvidence = evidenceByType('cex_read_only_api');
  const backtestEvidence = evidenceByType('backtest_simulation');
  const artifactChecklist: SubmissionExportArtifactView[] = [
    buildSubmissionExportArtifact(
      'addresses',
      'Canonical wallet or vault address',
      true,
      input.dossier.addressScope === 'unconfigured' ? 'fail' : 'pass',
      input.dossier.addressScope === 'unconfigured'
        ? 'Submission is still missing a canonical wallet or vault address.'
        : `Submission exposes ${addressCount} canonical on-chain verification address(es).`,
      input.dossier.addressScope === 'unconfigured' ? 'submission_address_required' : null,
      addressCount,
      [],
    ),
    buildSubmissionExportArtifact(
      'on_chain_trade_activity',
      'On-chain trade activity in the build window',
      true,
      onChainEvidence.length > 0 || input.dossier.realExecutionCountInWindow > 0 ? 'pass' : 'fail',
      onChainEvidence.length > 0
        ? `${onChainEvidence.length} explicit on-chain transaction evidence item(s) are attached to the build window.`
        : input.dossier.realExecutionCountInWindow > 0
          ? `Runtime persists ${input.dossier.realExecutionCountInWindow} real execution record(s) in the build window, but no explicit evidence attachment was recorded.`
          : 'No on-chain trade evidence is attached to the build window.',
      onChainEvidence.length > 0 || input.dossier.realExecutionCountInWindow > 0
        ? null
        : 'on_chain_trade_evidence_missing',
      onChainEvidence.length,
      ['on_chain_transaction'],
    ),
    buildSubmissionExportArtifact(
      'realized_performance',
      'Realized performance evidence',
      true,
      input.dossier.realizedApyPct !== null && decimalOrZero(input.dossier.realizedApyPct).gte(10)
        ? 'pass'
        : 'fail',
      input.dossier.realizedApyPct === null
        ? performanceEvidence.length > 0
          ? 'Performance evidence attachments exist, but no realized APY value is persisted yet.'
          : 'No realized APY evidence is attached or persisted yet.'
        : decimalOrZero(input.dossier.realizedApyPct).gte(10)
          ? `Realized APY ${input.dossier.realizedApyPct}% is persisted and meets the minimum.`
          : `Realized APY ${input.dossier.realizedApyPct}% is persisted but below the 10% minimum.`,
      input.dossier.realizedApyPct !== null && decimalOrZero(input.dossier.realizedApyPct).gte(10)
        ? null
        : input.dossier.realizedApyPct === null
          ? 'realized_apy_evidence_missing'
          : 'realized_apy_below_minimum',
      performanceEvidence.length,
      ['performance_snapshot'],
    ),
    buildSubmissionExportArtifact(
      'cex_trade_history',
      'CEX trade history export',
      input.dossier.cexExecutionUsed,
      !input.dossier.cexExecutionUsed || input.dossier.cexTradeHistoryProvided || cexTradeHistoryEvidence.length > 0
        ? 'pass'
        : 'fail',
      !input.dossier.cexExecutionUsed
        ? 'Not required for an on-chain-only submission.'
        : input.dossier.cexTradeHistoryProvided || cexTradeHistoryEvidence.length > 0
          ? 'CEX trade history evidence is marked as provided.'
          : 'CEX trade history export is still missing.',
      !input.dossier.cexExecutionUsed || input.dossier.cexTradeHistoryProvided || cexTradeHistoryEvidence.length > 0
        ? null
        : 'cex_verification_artifacts_missing',
      cexTradeHistoryEvidence.length,
      ['cex_trade_history'],
    ),
    buildSubmissionExportArtifact(
      'cex_read_only_api',
      'CEX read-only API verification',
      input.dossier.cexExecutionUsed,
      !input.dossier.cexExecutionUsed || input.dossier.cexReadOnlyApiKeyProvided || cexApiEvidence.length > 0
        ? 'pass'
        : 'fail',
      !input.dossier.cexExecutionUsed
        ? 'Not required for an on-chain-only submission.'
        : input.dossier.cexReadOnlyApiKeyProvided || cexApiEvidence.length > 0
          ? 'CEX read-only API verification is marked as provided.'
          : 'CEX read-only API verification is still missing.',
      !input.dossier.cexExecutionUsed || input.dossier.cexReadOnlyApiKeyProvided || cexApiEvidence.length > 0
        ? null
        : 'cex_verification_artifacts_missing',
      cexApiEvidence.length,
      ['cex_read_only_api'],
    ),
    buildSubmissionExportArtifact(
      'backtest_simulation',
      'Historical backtest simulation results',
      false, // Optional - not required for submission
      backtestEvidence.length > 0 ? 'pass' : 'warning',
      backtestEvidence.length > 0
        ? `${backtestEvidence.length} backtest simulation result(s) attached as supporting evidence.`
        : 'No backtest simulation evidence attached. Optional for submission but recommended for strategy validation.',
      null, // Not a blocker
      backtestEvidence.length,
      ['backtest_simulation'],
    ),
  ];

  const verificationLinks = [
    input.dossier.walletVerificationUrl,
    input.dossier.vaultVerificationUrl,
    input.dossier.latestExecutionReferenceUrl,
    ...input.evidence.map((item) => item.url),
  ].flatMap((value) => (value === null ? [] : [value]));

  const blockedReasons = artifactChecklist.flatMap((item) =>
    item.status === 'fail' && item.blockedReason !== null ? [item.blockedReason] : []);
  const judgeSummary = blockedReasons.length === 0
    ? 'Submission bundle includes the required verification artifacts for a Main Track review.'
    : `Submission bundle remains blocked by ${blockedReasons.length} requirement(s): ${blockedReasons.join(', ')}.`;

  return {
    generatedAt: new Date().toISOString(),
    dossier: input.dossier,
    evidence: input.evidence,
    artifactChecklist,
    judgeSummary,
    blockedReasons,
    verificationLinks: [...new Set(verificationLinks)],
  };
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
      typeof code !== 'string' ||
      typeof category !== 'string' ||
      typeof message !== 'string' ||
      typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [
      {
        code: code as TreasuryActionBlockedReason['code'],
        category: category as TreasuryActionBlockedReason['category'],
        message,
        operatorAction,
        details: asJsonObject(record['details']),
      },
    ];
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
      typeof code !== 'string' ||
      typeof category !== 'string' ||
      typeof message !== 'string' ||
      typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [
      {
        code: code as CarryOperationalBlockedReason['code'],
        category: category as CarryOperationalBlockedReason['category'],
        message,
        operatorAction,
        details: asJsonObject(record['details']),
      },
    ];
  });
}

function asCarryStrategyProfile(value: unknown): CarryStrategyProfileView | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record['strategyId'] !== 'string' ||
    typeof record['strategyName'] !== 'string' ||
    typeof record['vaultBaseAsset'] !== 'string' ||
    typeof record['strategyFamily'] !== 'string' ||
    typeof record['yieldSourceCategory'] !== 'string' ||
    typeof record['leverageModel'] !== 'string' ||
    typeof record['oracleDependencyClass'] !== 'string' ||
    typeof record['lockReassessmentPolicy'] !== 'string'
  ) {
    return null;
  }

  return record as unknown as CarryStrategyProfileView;
}

function asDecimalLikeString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
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
      typeof code !== 'string' ||
      typeof category !== 'string' ||
      typeof message !== 'string' ||
      typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [
      {
        code: code as RebalanceBundleRecoveryBlockedReason['code'],
        category: category as RebalanceBundleRecoveryBlockedReason['category'],
        message,
        operatorAction,
        details: asJsonObject(record['details']),
      },
    ];
  });
}

function asBundleResolutionBlockedReasons(
  value: unknown,
): RebalanceBundleResolutionBlockedReason[] {
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
      typeof code !== 'string' ||
      typeof category !== 'string' ||
      typeof message !== 'string' ||
      typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [
      {
        code: code as RebalanceBundleResolutionBlockedReason['code'],
        category: category as RebalanceBundleResolutionBlockedReason['category'],
        message,
        operatorAction,
        details: asJsonObject(record['details']),
      },
    ];
  });
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

    return [
      {
        code,
        severity: severity as AllocatorRationale['severity'],
        summary,
        details: asJsonObject(record['details']),
      },
    ];
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
      typeof code !== 'string' ||
      typeof message !== 'string' ||
      typeof operatorAction !== 'string'
    ) {
      return [];
    }

    return [
      {
        code: code as RebalanceBlockedReason['code'],
        message,
        operatorAction,
        details: asJsonObject(record['details']),
      },
    ];
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
    drift_health_state_mismatch: 0,
    drift_market_identity_mismatch: 0,
    drift_position_identity_gap: 0,
    drift_partial_health_comparison: 0,
    drift_partial_market_identity_comparison: 0,
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

  return (
    status === 'open' ||
    status === 'acknowledged' ||
    status === 'recovering' ||
    status === 'reopened'
  );
}

function recommendedRemediationsForMismatch(
  mismatch: RuntimeMismatchView,
  latestFinding: RuntimeReconciliationFindingView | null,
): RuntimeRemediationActionType[] {
  const findingType = latestFinding?.findingType ?? null;
  if (
    findingType === 'projection_state_mismatch' ||
    findingType === 'stale_projection_state' ||
    mismatch.category === 'projection_mismatch'
  ) {
    return ['rebuild_projections'];
  }

  if (
    findingType === 'order_state_mismatch' ||
    findingType === 'position_exposure_mismatch' ||
    findingType === 'command_outcome_mismatch' ||
    mismatch.category === 'execution_state_mismatch'
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

function mapRecoveryEventRow(
  row: typeof runtimeRecoveryEvents.$inferSelect,
): RuntimeRecoveryEventView {
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

function mapTreasurySummaryRow(row: typeof treasuryRuns.$inferSelect): TreasurySummaryView {
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
): TreasuryVenueCoreView {
  const metadata = asJsonObject(row.metadata);
  const executionSupported = metadata['executionSupported'] === true;
  const supportsAllocation = metadata['supportsAllocation'] === true;
  const supportsReduction = metadata['supportsReduction'] === true;
  const readOnly = metadata['readOnly'] === true;
  const approvedForLiveUse = metadata['approvedForLiveUse'] === true;
  const onboardingState =
    typeof metadata['onboardingState'] === 'string'
      ? (metadata['onboardingState'] as TreasuryVenueView['onboardingState'])
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

function mapTreasuryActionRow(row: typeof treasuryActions.$inferSelect): TreasuryActionView {
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

function mapCarryVenueRow(row: typeof carryVenueSnapshots.$inferSelect): CarryVenueCoreView {
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
    missingPrerequisites: Array.isArray(row.missingPrerequisites)
      ? (row.missingPrerequisites as string[])
      : [],
    metadata: asJsonObject(row.metadata),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapVenueSnapshotRow(
  row: typeof venueConnectorSnapshots.$inferSelect,
): VenueSnapshotCoreView {
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
    executionConfirmationState: snapshotData.executionConfirmationState,
    metadata: asJsonObject(row.metadata),
  };
}

function mapVenueInventoryItem(
  latest: typeof venueConnectorSnapshots.$inferSelect,
  lastSuccessfulSnapshotAt: Date | null,
): VenueInventoryCoreView {
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
    executionConfirmationState: snapshotData.executionConfirmationState,
    metadata: asJsonObject(latest.metadata),
  };
}

function mapCarryActionRow(row: typeof carryActions.$inferSelect): CarryActionView {
  const details = asJsonObject(row.details);
  const executionPlan = asJsonObject(row.executionPlan);
  const strategyProfile =
    asCarryStrategyProfile(executionPlan['strategyProfile']) ??
    buildCarryStrategyProfile({
      projectedApyPct: asDecimalLikeString(
        details['netYieldPct'] ?? details['expectedAnnualYieldPct'],
      ),
    });

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
    details,
    readiness: row.readiness as CarryActionView['readiness'],
    executable: row.executable,
    blockedReasons: asCarryBlockedReasons(row.blockedReasons),
    approvalRequirement: row.approvalRequirement as CarryActionView['approvalRequirement'],
    executionMode: row.executionMode as CarryActionView['executionMode'],
    simulated: row.simulated,
    strategyProfile,
    executionPlan,
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
  const metadata = asJsonObject(row.metadata);
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
    marketIdentity: readCanonicalMarketIdentityFromMetadata(metadata, {
      venueId: row.venueId,
      asset: row.asset,
      marketType: metadata['instrumentType'],
      provenance: 'derived',
      capturedAtStage: 'carry_planned_order',
      source: 'carry_action_order_intents',
      notes: [
        'Carry planned-order market identity falls back to persisted order metadata when venue-native metadata is unavailable.',
      ],
    }),
    metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCarryExecutionRow(row: typeof carryActionExecutions.$inferSelect): CarryExecutionView {
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
  const metadata = asJsonObject(row.metadata);
  const outcome = asJsonObject(row.outcome);
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
    outcome,
    postTradeConfirmation: asCarryExecutionPostTradeConfirmation(outcome['postTradeConfirmation']),
    lastError: row.lastError ?? null,
    marketIdentity: readCanonicalMarketIdentityFromMetadata(metadata, {
      venueId: row.venueId,
      asset: row.asset,
      marketType: metadata['instrumentType'],
      provenance: 'derived',
      capturedAtStage: 'carry_execution_step',
      source: 'carry_execution_steps',
      notes: [
        'Carry execution-step market identity falls back to persisted step metadata when venue-native metadata is unavailable.',
      ],
    }),
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: toIsoString(row.completedAt),
  };
}

function deriveOrderMarketIdentity(
  row: typeof orders.$inferSelect,
  metadata: Record<string, unknown>,
): CanonicalMarketIdentity | null {
  return readCanonicalMarketIdentityFromMetadata(metadata, {
    venueId: row.venueId,
    asset: row.asset,
    marketType: metadata['instrumentType'],
    provenance: 'derived',
    capturedAtStage: 'runtime_order',
    source: 'runtime_orders_table',
    notes: [
      'Runtime order market identity falls back to persisted order metadata when no venue-native market metadata was captured earlier.',
    ],
  });
}

function mapOrderRow(row: typeof orders.$inferSelect): OrderView {
  const metadata = asRecord(row.metadata);
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
    marketIdentity: deriveOrderMarketIdentity(row, metadata),
    metadata,
    submittedAt: toIsoString(row.submittedAt),
    completedAt: toIsoString(row.completedAt),
    createdAt: row.createdAt.toISOString(),
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
    constraints: Array.isArray(row.constraints)
      ? (row.constraints as AllocatorRunView['constraints'])
      : [],
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
    interventionRecommendation:
      row.interventionRecommendation as RebalanceBundleInterventionRecommendation,
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
    approvalRequirement:
      row.approvalRequirement as RebalanceBundleRecoveryActionView['approvalRequirement'],
    status: row.status as RebalanceBundleRecoveryStatus,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    note: row.note ?? null,
    linkedCommandId: row.linkedCommandId ?? null,
    targetCommandType:
      row.targetCommandType as RebalanceBundleRecoveryActionView['targetCommandType'],
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
        comparison =
          new Date(left.latestActivityAt).getTime() - new Date(right.latestActivityAt).getTime();
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

  const summary =
    input.actionCount === 0
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
  action: RebalanceCarryActionNodeView['action'] | RebalanceTreasuryActionNodeView['action'],
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

function deriveRebalanceBundleSnapshot(graph: RebalanceExecutionGraphView): {
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
    deriveBundleChildState(node.action, node.executions),
  );
  const treasuryChildStates = graph.downstream.treasury.actions.map((node) =>
    deriveBundleChildState(node.action, node.executions),
  );
  const childStates = [...carryChildStates, ...treasuryChildStates];

  const totalChildCount = childStates.length;
  const blockedChildCount = childStates.filter((state) => state === 'blocked').length;
  const failedChildCount = childStates.filter((state) => state === 'failed').length;
  const completedChildCount = childStates.filter((state) => state === 'completed').length;
  const pendingChildCount = childStates.filter(
    (state) => state === 'pending' || state === 'executing',
  ).length;
  const hasCompletedChildren = completedChildCount > 0;
  const hasPendingChildren = pendingChildCount > 0;
  const hasFailedChildren = failedChildCount > 0;
  const hasBlockedChildren = blockedChildCount > 0;
  const proposal = graph.detail.proposal;

  let status: RebalanceBundleStatus = 'proposed';
  let completionState: RebalanceBundleCompletionState = 'open';
  let outcomeClassification: RebalanceBundleOutcomeClassification = 'pending';
  let interventionRecommendation: RebalanceBundleInterventionRecommendation =
    'operator_review_required';
  let finalizationReason: string | null = null;

  if (proposal.status === 'rejected') {
    status = 'rejected';
    completionState = 'finalized';
    outcomeClassification = 'rejected';
    interventionRecommendation = 'no_action_needed';
    finalizationReason =
      proposal.rejectionReason ?? 'Proposal was rejected before coordinated execution.';
  } else if (
    proposal.status === 'proposed' ||
    proposal.status === 'approved' ||
    proposal.status === 'queued'
  ) {
    status = proposal.status === 'queued' ? 'queued' : 'proposed';
    completionState = 'open';
    outcomeClassification = 'pending';
    interventionRecommendation =
      proposal.status === 'queued' ? 'wait_for_inflight_children' : 'operator_review_required';
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
    finalizationReason =
      'At least one downstream child completed and at least one remains blocked.';
  } else if (hasFailedChildren) {
    status = 'failed';
    completionState = 'finalized';
    outcomeClassification = 'failed';
    interventionRecommendation = 'inspect_child_failures';
    finalizationReason =
      'At least one downstream child failed and no child completed successfully.';
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
    finalizationReason =
      'The rebalance finished with only a subset of downstream children completed.';
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
    finalizationReason =
      'All downstream work recorded for the rebalance bundle completed successfully.';
  }

  const terminalTimestamp =
    graph.timeline
      .filter(
        (entry) =>
          entry.scope !== 'recovery_action' &&
          (entry.status === 'completed' ||
            entry.status === 'failed' ||
            entry.status === 'rejected'),
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
  const entries: RebalanceExecutionTimelineEntry[] = [
    {
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
    },
  ];

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
      summary:
        execution.outcomeSummary ?? execution.lastError ?? 'Rebalance execution was recorded.',
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
        summary:
          execution.outcomeSummary ?? execution.lastError ?? 'Rebalance execution completed.',
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
        summary:
          execution.outcomeSummary ?? execution.lastError ?? 'Treasury execution was recorded.',
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
    const sleeveId: RebalanceExecutionTimelineEntry['sleeveId'] =
      recoveryAction.targetChildType === 'carry_action'
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
      linkedActionId:
        recoveryAction.targetChildType === 'carry_action' ||
        recoveryAction.targetChildType === 'treasury_action'
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
        linkedActionId:
          recoveryAction.targetChildType === 'carry_action' ||
          recoveryAction.targetChildType === 'treasury_action'
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
      const eventType =
        recoveryAction.status === 'completed'
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
        summary:
          recoveryAction.outcomeSummary ??
          recoveryAction.lastError ??
          `Recovery action ${recoveryAction.status}.`,
        linkedCommandId: recoveryAction.linkedCommandId,
        linkedRebalanceExecutionId: null,
        linkedActionId:
          recoveryAction.targetChildType === 'carry_action' ||
          recoveryAction.targetChildType === 'treasury_action'
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
      eventType:
        resolutionAction.status === 'blocked' ? 'resolution_blocked' : 'resolution_completed',
      at: resolutionAction.completedAt ?? resolutionAction.requestedAt,
      actorId: resolutionAction.completedBy ?? resolutionAction.requestedBy,
      sleeveId: 'allocator',
      scope: 'resolution_action',
      status: resolutionAction.status,
      summary:
        resolutionAction.outcomeSummary ??
        resolutionAction.note ??
        `Bundle resolution recorded as ${resolutionAction.resolutionState}.`,
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
    const eventType =
      escalationEvent.eventType === 'created'
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
      summary:
        escalationEvent.note ?? `Bundle escalation transitioned to ${escalationEvent.toStatus}.`,
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
      summary:
        execution.outcomeSummary ??
        execution.lastError ??
        'Treasury execution attempt was recorded.',
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
        summary:
          execution.outcomeSummary ??
          execution.lastError ??
          (execution.status === 'completed'
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
    summary:
      execution.outcomeSummary ?? execution.lastError ?? 'Carry execution attempt was recorded.',
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
      summary:
        step.outcomeSummary ??
        step.lastError ??
        `Execution step ${step.intentId} recorded with status ${step.status}.`,
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
      summary:
        execution.outcomeSummary ??
        execution.lastError ??
        (execution.status === 'completed'
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
    const persistedMarketIdentity =
      readCanonicalMarketIdentityFromMetadata(record.intent.metadata, {
        venueId: record.intent.venueId,
        asset: record.intent.asset,
        marketType: record.intent.metadata['instrumentType'],
        provenance: 'derived',
        capturedAtStage: 'runtime_order',
        source: 'runtime_order_store_save',
        notes: [
          'Runtime orders persist the best available market identity from intent creation or execution-time promotion.',
        ],
      }) ??
      createCanonicalMarketIdentity({
        venueId: record.intent.venueId,
        asset: record.intent.asset,
        marketType: record.intent.metadata['instrumentType'],
        provenance: 'derived',
        capturedAtStage: 'runtime_order',
        source: 'runtime_order_store_save',
        notes: [
          'Runtime orders derived market identity from asset and instrument type because no richer metadata was present.',
        ],
      });
    const persistedMetadata = attachCanonicalMarketIdentityToMetadata(
      record.intent.metadata,
      persistedMarketIdentity,
    );

    await this.db
      .insert(orders)
      .values({
        clientOrderId: record.intent.intentId,
        strategyRunId:
          typeof persistedMetadata['runId'] === 'string' ? persistedMetadata['runId'] : null,
        sleeveId: extractSleeveId(record.intent),
        opportunityId: record.intent.opportunityId,
        venueId: record.intent.venueId,
        venueOrderId: record.venueOrderId,
        asset: record.intent.asset,
        side: record.intent.side,
        orderType: record.intent.type,
        executionMode:
          typeof persistedMetadata['executionMode'] === 'string'
            ? String(persistedMetadata['executionMode'])
            : 'dry-run',
        reduceOnly: record.intent.reduceOnly,
        requestedSize: record.intent.size,
        requestedPrice: record.intent.limitPrice,
        filledSize: record.filledSize,
        averageFillPrice: record.averageFillPrice,
        status: record.status,
        attemptCount: record.attemptCount,
        lastError: record.lastError,
        metadata: asRecord(persistedMetadata),
        submittedAt: record.submittedAt,
        completedAt: record.completedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: orders.clientOrderId,
        set: {
          strategyRunId:
            typeof persistedMetadata['runId'] === 'string'
              ? String(persistedMetadata['runId'])
              : null,
          sleeveId: extractSleeveId(record.intent),
          opportunityId: record.intent.opportunityId,
          venueId: record.intent.venueId,
          venueOrderId: record.venueOrderId,
          asset: record.intent.asset,
          side: record.intent.side,
          orderType: record.intent.type,
          executionMode:
            typeof persistedMetadata['executionMode'] === 'string'
              ? String(persistedMetadata['executionMode'])
              : 'dry-run',
          reduceOnly: record.intent.reduceOnly,
          requestedSize: record.intent.size,
          requestedPrice: record.intent.limitPrice,
          filledSize: record.filledSize,
          averageFillPrice: record.averageFillPrice,
          status: record.status,
          attemptCount: record.attemptCount,
          lastError: record.lastError,
          metadata: asRecord(persistedMetadata),
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
      fills: fillRows.map(
        (fillRow): OrderFill => ({
          fillId: fillRow.fillId ?? fillRow.id,
          orderId: row.clientOrderId as OrderFill['orderId'],
          filledSize: fillRow.size,
          fillPrice: fillRow.price,
          fee: fillRow.fee,
          feeAsset: fillRow.feeAsset ?? row.asset,
          filledAt: fillRow.filledAt,
        }),
      ),
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

  async getCarryStrategyProfile(): Promise<CarryStrategyProfileView> {
    const [latestActionRow, latestExecutionRow, latestStepRow, apyCurrentRow] = await Promise.all([
      this.db
        .select()
        .from(carryActions)
        .orderBy(desc(carryActions.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select()
        .from(carryActionExecutions)
        .orderBy(desc(carryActionExecutions.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select()
        .from(carryExecutionSteps)
        .orderBy(desc(carryExecutionSteps.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      this.db
        .select()
        .from(apyCurrent)
        .where(eq(apyCurrent.sleeveId, 'carry'))
        .then((rows) => rows[0] ?? null),
    ]);

    const latestAction = latestActionRow === null ? null : mapCarryActionRow(latestActionRow);
    const latestExecution =
      latestExecutionRow === null ? null : mapCarryExecutionRow(latestExecutionRow);
    const latestStep = latestStepRow === null ? null : mapCarryExecutionStepRow(latestStepRow);
    
    // Build profile with realized APY if available
    const profileInput = apyCurrentRow !== null && apyCurrentRow['realizedApyLifetime'] !== null
      ? {
          realizedApyPct: apyCurrentRow['realizedApyLifetime'],
          realizedApySource: 'devnet' as const,
          realizedApyUpdatedAt: apyCurrentRow['updatedAt'].toISOString(),
        }
      : {};
    
    const profile = latestAction?.strategyProfile ?? buildCarryStrategyProfile(profileInput);
    const latestExecutionReference =
      latestStep?.executionReference ?? latestExecution?.venueExecutionReference ?? null;
    const latestConfirmationStatus = latestStep?.postTradeConfirmation?.status ?? null;
    const latestEvidenceSource =
      latestStep !== null && !latestStep.simulated
        ? 'devnet_execution'
        : profile.apy.projectedApyPct === null
          ? 'none'
          : 'projected';

    // Update evidence source if we have realized APY
    const finalEvidenceSource = apyCurrentRow?.['calculationBasis'] === 'live_trades'
      ? 'devnet_execution'
      : latestEvidenceSource;

    return {
      ...profile,
      evidence: {
        ...profile.evidence,
        environment:
          latestStep !== null && !latestStep.simulated ? 'devnet' : profile.evidence.environment,
        latestExecutionId: latestExecution?.id ?? null,
        latestExecutionReference,
        latestConfirmationStatus,
        latestEvidenceSource: finalEvidenceSource,
        summary:
          finalEvidenceSource === 'devnet_execution'
            ? `Latest strategy evidence includes ${apyCurrentRow?.['totalTradesClosed'] ?? 0} closed trades with realized APY ${apyCurrentRow?.['realizedApyLifetime'] ?? 'unavailable'}% plus the current confirmation state for the narrow real execution path.`
            : 'The strategy profile is eligible in principle, but current persisted evidence is limited to projected policy metadata unless a real devnet execution has completed.',
      },
    };
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

    const [plannedOrderRows, executionRows, latestCommand, linkedRebalanceProposal] =
      await Promise.all([
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
              .then((rows) => (rows[0] === undefined ? null : mapRebalanceProposalRow(rows[0]))),
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

  private async getCarryExecutionViewRecord(
    executionId: string,
  ): Promise<CarryExecutionView | null> {
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

    const venueSnapshotsCore =
      action === null || action.strategyRunId === null || venueIds.size === 0
        ? []
        : (
            await this.db
              .select()
              .from(carryVenueSnapshots)
              .where(eq(carryVenueSnapshots.strategyRunId, action.strategyRunId))
          )
            .filter((row) => venueIds.has(row['venueId']))
            .map(mapCarryVenueRow);
    const inventory = await this.listVenueInventoryCore(500);
    const inventoryByVenueId = new Map(inventory.map((venue) => [venue.venueId, venue] as const));
    const promotionSummaryMap = await this.buildPromotionSummaryMap(inventory);
    const venueSnapshots = venueSnapshotsCore.map((venue) => {
      const inventoryView = inventoryByVenueId.get(venue.venueId);
      const promotion =
        inventoryView === undefined
          ? buildDefaultPromotionSummary(
              buildFallbackConnectorReadinessEvidence({
                venueId: venue.venueId,
                venueName: venue.venueId,
                connectorType: 'carry_adapter',
                sleeveApplicability: ['carry'],
                truthMode: venue.venueMode === 'simulated' ? 'simulated' : 'real',
                executionSupport: venue.executionSupported,
                readOnlySupport: venue.readOnly,
                healthy: venue.healthy,
                healthState: venue.healthy ? 'healthy' : 'degraded',
                degradedReason: venue.healthy ? null : 'carry_venue_snapshot_reported_unhealthy',
                lastSnapshotAt: venue.updatedAt,
                missingPrerequisites: venue.missingPrerequisites,
              }),
            )
          : (promotionSummaryMap.get(venue.venueId) ??
            buildDefaultPromotionSummary(buildConnectorReadinessEvidence(inventoryView)));

      return {
        ...venue,
        approvedForLiveUse: promotion.approvedForLiveUse,
        promotion,
      };
    });
    const steps = stepRows
      .map(mapCarryExecutionStepRow)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

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

  private async listVenueInventoryCore(limit = 100): Promise<VenueInventoryCoreView[]> {
    const rows = await this.db
      .select()
      .from(venueConnectorSnapshots)
      .orderBy(desc(venueConnectorSnapshots.capturedAt));

    const latestByVenue = new Map<string, typeof venueConnectorSnapshots.$inferSelect>();
    const lastSuccessfulByVenue = new Map<string, Date>();

    for (const row of rows) {
      if (!latestByVenue.has(row.venueId)) {
        latestByVenue.set(row.venueId, row);
      }
      if (row.snapshotSuccessful && !lastSuccessfulByVenue.has(row.venueId)) {
        lastSuccessfulByVenue.set(row.venueId, row.capturedAt);
      }
    }

    return Array.from(latestByVenue.values())
      .slice(0, limit)
      .map((row) => mapVenueInventoryItem(row, lastSuccessfulByVenue.get(row.venueId) ?? null));
  }

  private async listVenueSnapshotsCore(
    venueId: string,
    limit = 20,
  ): Promise<VenueSnapshotCoreView[]> {
    const rows = await this.db
      .select()
      .from(venueConnectorSnapshots)
      .where(eq(venueConnectorSnapshots.venueId, venueId))
      .orderBy(desc(venueConnectorSnapshots.capturedAt))
      .limit(limit);

    return rows.map(mapVenueSnapshotRow);
  }

  private async getLatestVenuePromotionRows(
    venueIds?: string[],
  ): Promise<Map<string, typeof venueConnectorPromotions.$inferSelect>> {
    const rows =
      venueIds === undefined || venueIds.length === 0
        ? await this.db
            .select()
            .from(venueConnectorPromotions)
            .orderBy(
              desc(venueConnectorPromotions.updatedAt),
              desc(venueConnectorPromotions.requestedAt),
            )
        : await this.db
            .select()
            .from(venueConnectorPromotions)
            .where(inArray(venueConnectorPromotions.venueId, venueIds))
            .orderBy(
              desc(venueConnectorPromotions.updatedAt),
              desc(venueConnectorPromotions.requestedAt),
            );

    const latestByVenue = new Map<string, typeof venueConnectorPromotions.$inferSelect>();
    for (const row of rows) {
      if (!latestByVenue.has(row['venueId'])) {
        latestByVenue.set(row['venueId'], row);
      }
    }

    return latestByVenue;
  }

  private async buildPromotionSummaryMap(
    venues: VenueInventoryCoreView[],
  ): Promise<Map<string, ConnectorPromotionSummaryView>> {
    const latestPromotions = await this.getLatestVenuePromotionRows(
      venues.map((venue) => venue.venueId),
    );
    const summaries = new Map<string, ConnectorPromotionSummaryView>();

    for (const venue of venues) {
      const evidence = buildConnectorReadinessEvidence(venue);
      const latestPromotion = latestPromotions.get(venue.venueId);
      summaries.set(
        venue.venueId,
        latestPromotion === undefined
          ? buildDefaultPromotionSummary(evidence)
          : buildPromotionSummaryFromRow(latestPromotion, evidence),
      );
    }

    return summaries;
  }

  private async buildConnectorPromotionDetailForVenue(
    venue: VenueInventoryCoreView,
  ): Promise<ConnectorPromotionDetailView> {
    const evidence = buildConnectorReadinessEvidence(venue);
    const [latestPromotionRows, historyRows] = await Promise.all([
      this.getLatestVenuePromotionRows([venue.venueId]),
      this.db
        .select()
        .from(venueConnectorPromotionEvents)
        .where(eq(venueConnectorPromotionEvents.venueId, venue.venueId))
        .orderBy(desc(venueConnectorPromotionEvents.occurredAt)),
    ]);
    const latestPromotion = latestPromotionRows.get(venue.venueId);

    return {
      venueId: venue.venueId,
      venueName: venue.venueName,
      connectorType: venue.connectorType,
      sleeveApplicability: venue.sleeveApplicability,
      current:
        latestPromotion === undefined
          ? buildDefaultPromotionSummary(evidence)
          : buildPromotionSummaryFromRow(latestPromotion, evidence),
      evidence,
      history: historyRows.map(mapPromotionEventRow),
    };
  }

  async listCarryVenues(limit = 50): Promise<CarryVenueView[]> {
    const rows = await this.db
      .select()
      .from(carryVenueSnapshots)
      .orderBy(desc(carryVenueSnapshots.updatedAt))
      .limit(limit * 5);

    const venues = Array.from(
      rows.reduce((map, row) => {
        if (!map.has(row.venueId)) {
          map.set(row.venueId, mapCarryVenueRow(row));
        }
        return map;
      }, new Map<string, CarryVenueCoreView>()).values(),
    ).slice(0, limit);
    const inventory = await this.listVenueInventoryCore(500);
    const inventoryByVenueId = new Map(inventory.map((venue) => [venue.venueId, venue] as const));
    const promotionSummaryMap = await this.buildPromotionSummaryMap(inventory);

    return venues.map((venue) => {
      const inventoryView = inventoryByVenueId.get(venue.venueId);
      const promotion =
        inventoryView === undefined
          ? buildDefaultPromotionSummary(
              buildFallbackConnectorReadinessEvidence({
                venueId: venue.venueId,
                venueName: venue.venueId,
                connectorType: 'carry_adapter',
                sleeveApplicability: ['carry'],
                truthMode: venue.venueMode === 'simulated' ? 'simulated' : 'real',
                executionSupport: venue.executionSupported,
                readOnlySupport: venue.readOnly,
                healthy: venue.healthy,
                healthState: venue.healthy ? 'healthy' : 'degraded',
                degradedReason: venue.healthy ? null : 'carry_venue_snapshot_reported_unhealthy',
                lastSnapshotAt: venue.updatedAt,
                missingPrerequisites: venue.missingPrerequisites,
              }),
            )
          : (promotionSummaryMap.get(venue.venueId) ??
            buildDefaultPromotionSummary(buildConnectorReadinessEvidence(inventoryView)));

      return {
        ...venue,
        approvedForLiveUse: promotion.approvedForLiveUse,
        promotion,
      };
    });
  }

  async listVenues(limit = 100): Promise<VenueInventoryItemView[]> {
    const venues = await this.listVenueInventoryCore(limit);
    const promotionSummaryMap = await this.buildPromotionSummaryMap(venues);

    return venues.map((venue) => ({
      ...venue,
      approvedForLiveUse: promotionSummaryMap.get(venue.venueId)?.approvedForLiveUse ?? false,
      promotion:
        promotionSummaryMap.get(venue.venueId) ??
        buildDefaultPromotionSummary(buildConnectorReadinessEvidence(venue)),
    }));
  }

  async getVenueSummary(): Promise<VenueInventorySummaryView> {
    const venues = await this.listVenues(500);

    return {
      totalVenues: venues.length,
      simulatedOnly: venues.filter((venue) => venue.truthMode === 'simulated').length,
      realReadOnly: venues.filter((venue) => venue.truthMode === 'real' && venue.readOnlySupport)
        .length,
      realExecutionCapable: venues.filter(
        (venue) => venue.truthMode === 'real' && venue.executionSupport,
      ).length,
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

      summary.connectorDepth[
        inferVenueTruthSourceDepth({
          connectorType: venue.connectorType,
          truthMode: venue.truthMode,
          executionSupport: venue.executionSupport,
          sourceMetadata: venue.sourceMetadata,
        })
      ] += 1;

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

  async getConnectorPromotionOverview(): Promise<ConnectorPromotionOverviewView> {
    const venues = await this.listVenues(500);
    const promotionRows = venues.map((venue) => ({
      venue,
      promotion:
        venue.promotion ?? buildDefaultPromotionSummary(buildConnectorReadinessEvidence(venue)),
    }));

    return {
      totalVenues: promotionRows.length,
      candidates: promotionRows.filter(
        ({ promotion }) => promotion.capabilityClass === 'execution_capable',
      ).length,
      pendingReview: promotionRows.filter(
        ({ promotion }) => promotion.promotionStatus === 'pending_review',
      ).length,
      approved: promotionRows.filter(({ promotion }) => promotion.promotionStatus === 'approved')
        .length,
      approvedAndEligible: promotionRows.filter(
        ({ promotion }) => promotion.sensitiveExecutionEligible,
      ).length,
      rejected: promotionRows.filter(({ promotion }) => promotion.promotionStatus === 'rejected')
        .length,
      suspended: promotionRows.filter(({ promotion }) => promotion.promotionStatus === 'suspended')
        .length,
      blockedByEvidence: promotionRows.filter(
        ({ promotion }) =>
          promotion.capabilityClass === 'execution_capable' &&
          !promotion.sensitiveExecutionEligible &&
          promotion.blockers.length > 0,
      ).length,
    };
  }

  async getConnectorPromotion(venueId: string): Promise<ConnectorPromotionDetailView | null> {
    const inventory = await this.listVenueInventoryCore(500);
    const venue = inventory.find((item) => item.venueId === venueId) ?? null;
    if (venue === null) {
      return null;
    }

    return this.buildConnectorPromotionDetailForVenue(venue);
  }

  async listConnectorPromotionHistory(venueId: string): Promise<ConnectorPromotionEventView[]> {
    const rows = await this.db
      .select()
      .from(venueConnectorPromotionEvents)
      .where(eq(venueConnectorPromotionEvents.venueId, venueId))
      .orderBy(desc(venueConnectorPromotionEvents.occurredAt));

    return rows.map(mapPromotionEventRow);
  }

  async getConnectorPromotionEligibility(
    venueId: string,
  ): Promise<ConnectorReadinessEvidenceView | null> {
    const inventory = await this.listVenueInventoryCore(500);
    const venue = inventory.find((item) => item.venueId === venueId) ?? null;
    return venue === null ? null : buildConnectorReadinessEvidence(venue);
  }

  private async getLatestVenuePromotionRow(
    venueId: string,
  ): Promise<typeof venueConnectorPromotions.$inferSelect | null> {
    const promotions = await this.getLatestVenuePromotionRows([venueId]);
    return promotions.get(venueId) ?? null;
  }

  private async insertConnectorPromotionEvent(input: {
    promotionId: string;
    venueId: string;
    eventType: ConnectorPromotionEventType;
    fromStatus: ConnectorPromotionStatus | null;
    toStatus: ConnectorPromotionStatus;
    effectivePosture: ConnectorEffectivePosture;
    actorId: string;
    note: string | null;
    evidence: ConnectorReadinessEvidenceView;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(venueConnectorPromotionEvents).values({
      promotionId: input.promotionId,
      venueId: input.venueId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      effectivePosture: input.effectivePosture,
      requestedTargetPosture: CONNECTOR_PROMOTION_TARGET_POSTURE,
      actorId: input.actorId,
      note: input.note,
      readinessEvidence: input.evidence,
      missingPrerequisitesSnapshot: input.evidence.missingPrerequisites,
      blockersSnapshot: input.evidence.blockingReasons,
      metadata: input.metadata ?? {},
      occurredAt: new Date(),
    });
  }

  async requestConnectorPromotion(input: {
    venueId: string;
    actorId: string;
    note?: string | null;
  }): Promise<ConnectorPromotionDetailView | null> {
    const inventory = await this.listVenueInventoryCore(500);
    const venue = inventory.find((item) => item.venueId === input.venueId) ?? null;
    if (venue === null) {
      return null;
    }

    const evidence = buildConnectorReadinessEvidence(venue);
    const now = new Date();
    const effectivePosture = deriveEffectivePosture(evidence.capabilityClass, 'pending_review');
    const [row] = await this.db
      .insert(venueConnectorPromotions)
      .values({
        venueId: venue.venueId,
        venueName: venue.venueName,
        connectorType: venue.connectorType,
        requestedTargetPosture: CONNECTOR_PROMOTION_TARGET_POSTURE,
        capabilityClass: evidence.capabilityClass,
        promotionStatus: 'pending_review',
        effectivePosture,
        approvedForLiveUse: false,
        sensitiveExecutionEligible: false,
        readinessEvidence: evidence,
        missingPrerequisitesSnapshot: evidence.missingPrerequisites,
        blockersSnapshot: evidence.blockingReasons,
        lastTruthSnapshotAt: new Date(venue.lastSnapshotAt),
        lastSuccessfulTruthSnapshotAt:
          venue.lastSuccessfulSnapshotAt === null ? null : new Date(venue.lastSuccessfulSnapshotAt),
        snapshotFreshness: venue.snapshotFreshness,
        snapshotCompleteness: venue.snapshotCompleteness,
        healthState: venue.healthState,
        degradedReason: venue.degradedReason,
        requestedBy: input.actorId,
        requestedAt: now,
        decisionNote: input.note ?? null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (row === undefined) {
      return null;
    }

    await this.insertConnectorPromotionEvent({
      promotionId: row.id,
      venueId: row.venueId,
      eventType: 'requested',
      fromStatus: null,
      toStatus: 'pending_review',
      effectivePosture,
      actorId: input.actorId,
      note: input.note ?? null,
      evidence,
    });

    return this.getConnectorPromotion(input.venueId);
  }

  async approveConnectorPromotion(input: {
    venueId: string;
    actorId: string;
    note?: string | null;
  }): Promise<ConnectorPromotionDetailView | null> {
    const inventory = await this.listVenueInventoryCore(500);
    const venue = inventory.find((item) => item.venueId === input.venueId) ?? null;
    if (venue === null) {
      return null;
    }

    const current = await this.getLatestVenuePromotionRow(input.venueId);
    if (current === null) {
      return null;
    }

    const evidence = buildConnectorReadinessEvidence(venue);
    const now = new Date();
    const effectivePosture = deriveEffectivePosture(evidence.capabilityClass, 'approved');
    await this.db
      .update(venueConnectorPromotions)
      .set({
        venueName: venue.venueName,
        connectorType: venue.connectorType,
        capabilityClass: evidence.capabilityClass,
        promotionStatus: 'approved',
        effectivePosture,
        approvedForLiveUse: true,
        sensitiveExecutionEligible: evidence.eligibleForPromotion,
        readinessEvidence: evidence,
        missingPrerequisitesSnapshot: evidence.missingPrerequisites,
        blockersSnapshot: evidence.blockingReasons,
        lastTruthSnapshotAt: new Date(venue.lastSnapshotAt),
        lastSuccessfulTruthSnapshotAt:
          venue.lastSuccessfulSnapshotAt === null ? null : new Date(venue.lastSuccessfulSnapshotAt),
        snapshotFreshness: venue.snapshotFreshness,
        snapshotCompleteness: venue.snapshotCompleteness,
        healthState: venue.healthState,
        degradedReason: venue.degradedReason,
        reviewedBy: input.actorId,
        reviewedAt: now,
        approvedBy: input.actorId,
        approvedAt: now,
        decisionNote: input.note ?? null,
        updatedAt: now,
      })
      .where(eq(venueConnectorPromotions.id, current.id));

    await this.insertConnectorPromotionEvent({
      promotionId: current.id,
      venueId: input.venueId,
      eventType: 'approved',
      fromStatus: current.promotionStatus as ConnectorPromotionStatus,
      toStatus: 'approved',
      effectivePosture,
      actorId: input.actorId,
      note: input.note ?? null,
      evidence,
    });

    return this.getConnectorPromotion(input.venueId);
  }

  async rejectConnectorPromotion(input: {
    venueId: string;
    actorId: string;
    note: string;
  }): Promise<ConnectorPromotionDetailView | null> {
    const inventory = await this.listVenueInventoryCore(500);
    const venue = inventory.find((item) => item.venueId === input.venueId) ?? null;
    if (venue === null) {
      return null;
    }

    const current = await this.getLatestVenuePromotionRow(input.venueId);
    if (current === null) {
      return null;
    }

    const evidence = buildConnectorReadinessEvidence(venue);
    const now = new Date();
    const effectivePosture = deriveEffectivePosture(evidence.capabilityClass, 'rejected');
    await this.db
      .update(venueConnectorPromotions)
      .set({
        venueName: venue.venueName,
        connectorType: venue.connectorType,
        capabilityClass: evidence.capabilityClass,
        promotionStatus: 'rejected',
        effectivePosture,
        approvedForLiveUse: false,
        sensitiveExecutionEligible: false,
        readinessEvidence: evidence,
        missingPrerequisitesSnapshot: evidence.missingPrerequisites,
        blockersSnapshot: evidence.blockingReasons,
        lastTruthSnapshotAt: new Date(venue.lastSnapshotAt),
        lastSuccessfulTruthSnapshotAt:
          venue.lastSuccessfulSnapshotAt === null ? null : new Date(venue.lastSuccessfulSnapshotAt),
        snapshotFreshness: venue.snapshotFreshness,
        snapshotCompleteness: venue.snapshotCompleteness,
        healthState: venue.healthState,
        degradedReason: venue.degradedReason,
        reviewedBy: input.actorId,
        reviewedAt: now,
        rejectedBy: input.actorId,
        rejectedAt: now,
        decisionNote: input.note,
        updatedAt: now,
      })
      .where(eq(venueConnectorPromotions.id, current.id));

    await this.insertConnectorPromotionEvent({
      promotionId: current.id,
      venueId: input.venueId,
      eventType: 'rejected',
      fromStatus: current.promotionStatus as ConnectorPromotionStatus,
      toStatus: 'rejected',
      effectivePosture,
      actorId: input.actorId,
      note: input.note,
      evidence,
    });

    return this.getConnectorPromotion(input.venueId);
  }

  async suspendConnectorPromotion(input: {
    venueId: string;
    actorId: string;
    note: string;
  }): Promise<ConnectorPromotionDetailView | null> {
    const inventory = await this.listVenueInventoryCore(500);
    const venue = inventory.find((item) => item.venueId === input.venueId) ?? null;
    if (venue === null) {
      return null;
    }

    const current = await this.getLatestVenuePromotionRow(input.venueId);
    if (current === null) {
      return null;
    }

    const evidence = buildConnectorReadinessEvidence(venue);
    const now = new Date();
    const effectivePosture = deriveEffectivePosture(evidence.capabilityClass, 'suspended');
    await this.db
      .update(venueConnectorPromotions)
      .set({
        venueName: venue.venueName,
        connectorType: venue.connectorType,
        capabilityClass: evidence.capabilityClass,
        promotionStatus: 'suspended',
        effectivePosture,
        approvedForLiveUse: false,
        sensitiveExecutionEligible: false,
        readinessEvidence: evidence,
        missingPrerequisitesSnapshot: evidence.missingPrerequisites,
        blockersSnapshot: evidence.blockingReasons,
        lastTruthSnapshotAt: new Date(venue.lastSnapshotAt),
        lastSuccessfulTruthSnapshotAt:
          venue.lastSuccessfulSnapshotAt === null ? null : new Date(venue.lastSuccessfulSnapshotAt),
        snapshotFreshness: venue.snapshotFreshness,
        snapshotCompleteness: venue.snapshotCompleteness,
        healthState: venue.healthState,
        degradedReason: venue.degradedReason,
        suspendedBy: input.actorId,
        suspendedAt: now,
        decisionNote: input.note,
        updatedAt: now,
      })
      .where(eq(venueConnectorPromotions.id, current.id));

    await this.insertConnectorPromotionEvent({
      promotionId: current.id,
      venueId: input.venueId,
      eventType: 'suspended',
      fromStatus: current.promotionStatus as ConnectorPromotionStatus,
      toStatus: 'suspended',
      effectivePosture,
      actorId: input.actorId,
      note: input.note,
      evidence,
    });

    return this.getConnectorPromotion(input.venueId);
  }

  async listVenueSnapshots(venueId: string, limit = 20): Promise<VenueSnapshotView[]> {
    const [snapshots, inventory] = await Promise.all([
      this.listVenueSnapshotsCore(venueId, limit),
      this.listVenueInventoryCore(500),
    ]);
    const venue = inventory.find((item) => item.venueId === venueId);
    const promotion =
      venue === undefined
        ? buildDefaultPromotionSummary(
            buildFallbackConnectorReadinessEvidence({
              venueId,
              venueName: venueId,
              connectorType: 'unknown_connector',
              sleeveApplicability: [],
              truthMode: 'simulated',
              executionSupport: false,
              readOnlySupport: true,
              healthy: false,
              healthState: 'unavailable',
              degradedReason: 'venue_inventory_missing',
              lastSnapshotAt: new Date(0).toISOString(),
              missingPrerequisites: ['Venue inventory is missing for this connector.'],
            }),
          )
        : ((await this.buildPromotionSummaryMap([venue])).get(venueId) ??
          buildDefaultPromotionSummary(buildConnectorReadinessEvidence(venue)));

    return snapshots.map((snapshot) => ({
      ...snapshot,
      approvedForLiveUse: promotion.approvedForLiveUse,
      promotion,
    }));
  }

  async getVenue(venueId: string): Promise<VenueDetailView | null> {
    const [inventory, snapshots, internalState, comparisonDetail] = await Promise.all([
      this.listVenueInventoryCore(500),
      this.listVenueSnapshotsCore(venueId, 20),
      this.getVenueInternalState(venueId),
      this.getVenueComparisonDetail(venueId),
    ]);
    const venue = inventory.find((item) => item.venueId === venueId) ?? null;
    if (venue === null || comparisonDetail === null) {
      return null;
    }

    const promotion = await this.buildConnectorPromotionDetailForVenue(venue);

    return {
      venue: {
        ...venue,
        approvedForLiveUse: promotion.current.approvedForLiveUse,
        promotion: promotion.current,
      },
      snapshots: snapshots.map((snapshot) => ({
        ...snapshot,
        approvedForLiveUse: promotion.current.approvedForLiveUse,
        promotion: promotion.current,
      })),
      internalState,
      comparisonSummary: comparisonDetail.summary,
      comparisonDetail,
      promotion,
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
      .orderBy(
        desc(internalDerivativeSnapshots.capturedAt),
        desc(internalDerivativeSnapshots.createdAt),
      )
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
        .innerJoin(
          treasuryActions,
          eq(treasuryActions.id, treasuryActionExecutions.treasuryActionId),
        )
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

  async listRecentCarryExecutionConfirmationCandidates(
    venueId: string,
    limit = 10,
  ): Promise<CarryExecutionConfirmationCandidateRecord[]> {
    const rows = await this.db
      .select({
        stepId: carryExecutionSteps.id,
        carryExecutionId: carryExecutionSteps.carryExecutionId,
        carryActionId: carryExecutionSteps.carryActionId,
        strategyRunId: carryExecutionSteps.strategyRunId,
        intentId: carryExecutionSteps.intentId,
        venueId: carryExecutionSteps.venueId,
        asset: carryExecutionSteps.asset,
        side: carryExecutionSteps.side,
        requestedSize: carryExecutionSteps.requestedSize,
        reduceOnly: carryExecutionSteps.reduceOnly,
        clientOrderId: carryExecutionSteps.clientOrderId,
        executionReference: carryExecutionSteps.executionReference,
        status: carryExecutionSteps.status,
        simulated: carryExecutionSteps.simulated,
        metadata: carryExecutionSteps.metadata,
        outcome: carryExecutionSteps.outcome,
        createdAt: carryExecutionSteps.createdAt,
        updatedAt: carryExecutionSteps.updatedAt,
        completedAt: carryExecutionSteps.completedAt,
      })
      .from(carryExecutionSteps)
      .where(
        and(
          eq(carryExecutionSteps.venueId, venueId),
          eq(carryExecutionSteps.simulated, false),
          sql`${carryExecutionSteps.executionReference} is not null`,
        ),
      )
      .orderBy(desc(carryExecutionSteps.updatedAt))
      .limit(limit);

    return rows.flatMap((row) =>
      row.executionReference === null
        ? []
        : [
            {
              stepId: row.stepId,
              carryExecutionId: row.carryExecutionId,
              carryActionId: row.carryActionId,
              strategyRunId: row.strategyRunId ?? null,
              intentId: row.intentId,
              venueId: row.venueId,
              asset: row.asset,
              side: row.side as CarryExecutionStepView['side'],
              requestedSize: row.requestedSize,
              reduceOnly: row.reduceOnly,
              clientOrderId: row.clientOrderId ?? null,
              executionReference: row.executionReference,
              status: row.status,
              simulated: row.simulated,
              metadata: asJsonObject(row.metadata),
              outcome: asJsonObject(row.outcome),
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
              completedAt: toIsoString(row.completedAt),
            },
          ],
    );
  }

  async updateRuntimeStatus(patch: {
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
  }): Promise<void> {
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
        ...(patch.projectionStatus !== undefined
          ? { projectionStatus: patch.projectionStatus }
          : {}),
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

  async updateWorkerStatus(patch: {
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
  }): Promise<void> {
    await this.db
      .update(runtimeWorkerState)
      .set({
        ...(patch.workerId !== undefined ? { workerId: patch.workerId } : {}),
        ...(patch.lifecycleState !== undefined ? { lifecycleState: patch.lifecycleState } : {}),
        ...(patch.schedulerState !== undefined ? { schedulerState: patch.schedulerState } : {}),
        ...(patch.currentOperation !== undefined
          ? { currentOperation: patch.currentOperation }
          : {}),
        ...(patch.currentCommandId !== undefined
          ? { currentCommandId: patch.currentCommandId }
          : {}),
        ...(patch.currentRunId !== undefined ? { currentRunId: patch.currentRunId } : {}),
        ...(patch.cycleIntervalMs !== undefined ? { cycleIntervalMs: patch.cycleIntervalMs } : {}),
        ...(patch.processId !== undefined ? { processId: patch.processId } : {}),
        ...(patch.hostname !== undefined ? { hostname: patch.hostname } : {}),
        ...(patch.lastHeartbeatAt !== undefined ? { lastHeartbeatAt: patch.lastHeartbeatAt } : {}),
        ...(patch.lastStartedAt !== undefined ? { lastStartedAt: patch.lastStartedAt } : {}),
        ...(patch.lastStoppedAt !== undefined ? { lastStoppedAt: patch.lastStoppedAt } : {}),
        ...(patch.lastRunStartedAt !== undefined
          ? { lastRunStartedAt: patch.lastRunStartedAt }
          : {}),
        ...(patch.lastRunCompletedAt !== undefined
          ? { lastRunCompletedAt: patch.lastRunCompletedAt }
          : {}),
        ...(patch.lastSuccessAt !== undefined ? { lastSuccessAt: patch.lastSuccessAt } : {}),
        ...(patch.lastFailureAt !== undefined ? { lastFailureAt: patch.lastFailureAt } : {}),
        ...(patch.lastFailureReason !== undefined
          ? { lastFailureReason: patch.lastFailureReason }
          : {}),
        ...(patch.nextScheduledRunAt !== undefined
          ? { nextScheduledRunAt: patch.nextScheduledRunAt }
          : {}),
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

  async failRuntimeCommand(
    commandId: string,
    errorMessage: string,
  ): Promise<RuntimeCommandView | null> {
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
      .orderBy(
        desc(runtimeReconciliationRuns.completedAt),
        desc(runtimeReconciliationRuns.startedAt),
      )
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
      throw new Error(
        `RuntimeStore.recordReconciliationFinding: finding "${input.dedupeKey}" was not persisted`,
      );
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
      input.findingType !== undefined
        ? eq(runtimeReconciliationFindings.findingType, input.findingType)
        : undefined,
      input.severity !== undefined
        ? eq(runtimeReconciliationFindings.severity, input.severity)
        : undefined,
      input.status !== undefined
        ? eq(runtimeReconciliationFindings.status, input.status)
        : undefined,
      input.venueId !== undefined
        ? eq(runtimeReconciliationFindings.venueId, input.venueId)
        : undefined,
      input.mismatchId !== undefined
        ? eq(runtimeReconciliationFindings.mismatchId, input.mismatchId)
        : undefined,
      input.reconciliationRunId !== undefined
        ? eq(runtimeReconciliationFindings.reconciliationRunId, input.reconciliationRunId)
        : undefined,
    ].filter((value): value is NonNullable<typeof value> => value !== undefined);

    const rows =
      predicates.length === 0
        ? await this.db
            .select()
            .from(runtimeReconciliationFindings)
            .orderBy(
              desc(runtimeReconciliationFindings.detectedAt),
              desc(runtimeReconciliationFindings.createdAt),
            )
            .limit(input.limit)
        : await this.db
            .select()
            .from(runtimeReconciliationFindings)
            .where(and(...predicates))
            .orderBy(
              desc(runtimeReconciliationFindings.detectedAt),
              desc(runtimeReconciliationFindings.createdAt),
            )
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
      finding.mismatchId === null
        ? Promise.resolve<RuntimeMismatchView | null>(null)
        : this.getMismatchById(finding.mismatchId),
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
      throw new Error(
        `RuntimeStore.createMismatchRemediation: remediation for mismatch "${input.mismatchId}" was not persisted`,
      );
    }

    return mapRemediationRow(this, inserted);
  }

  async getMismatchRemediationById(
    remediationId: string,
  ): Promise<RuntimeMismatchRemediationView | null> {
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

  async getMismatchRemediationByCommandId(
    commandId: string,
  ): Promise<RuntimeMismatchRemediationView | null> {
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

  async persistOpportunityEvaluation(input: CarryOpportunityEvaluationView): Promise<void> {
    await this.db
      .insert(strategyOpportunityEvaluations)
      .values({
        opportunityId: input.opportunityId,
        runId: input.runId,
        sleeveId: input.sleeveId,
        asset: input.asset,
        approved: input.approved,
        evaluationStage: input.evaluationStage,
        evaluationReason: input.evaluationReason,
        portfolioScore: input.portfolioScore === null ? null : String(input.portfolioScore),
        portfolioScoreBreakdown: input.portfolioScoreBreakdown,
        optimizerRationale: input.optimizerRationale,
        plannedNotionalUsd: input.plannedNotionalUsd,
        createdAt: new Date(input.createdAt),
        updatedAt: new Date(input.updatedAt),
      })
      .onConflictDoUpdate({
        target: strategyOpportunityEvaluations.opportunityId,
        set: {
          runId: input.runId,
          sleeveId: input.sleeveId,
          asset: input.asset,
          approved: input.approved,
          evaluationStage: input.evaluationStage,
          evaluationReason: input.evaluationReason,
          portfolioScore: input.portfolioScore === null ? null : String(input.portfolioScore),
          portfolioScoreBreakdown: input.portfolioScoreBreakdown,
          optimizerRationale: input.optimizerRationale,
          plannedNotionalUsd: input.plannedNotionalUsd,
          updatedAt: new Date(input.updatedAt),
        },
      });
  }

  async persistIntent(input: {
    runId: string;
    intent: OrderIntent;
    approved: boolean;
    riskAssessment: RiskAssessment;
    executionDisposition: string;
  }): Promise<void> {
    const marketIdentity =
      readCanonicalMarketIdentityFromMetadata(input.intent.metadata, {
        venueId: input.intent.venueId,
        asset: input.intent.asset,
        marketType: input.intent.metadata['instrumentType'],
        provenance: 'derived',
        capturedAtStage: 'strategy_intent',
        source: 'runtime_strategy_intent_persistence',
        notes: [
          'Strategy intents persist the best market identity available from opportunity planning time.',
        ],
      }) ??
      createCanonicalMarketIdentity({
        venueId: input.intent.venueId,
        asset: input.intent.asset,
        marketType: input.intent.metadata['instrumentType'],
        provenance: 'derived',
        capturedAtStage: 'strategy_intent',
        source: 'runtime_strategy_intent_persistence',
        notes: [
          'Strategy intents derived market identity because opportunity planning did not supply richer venue-native identifiers.',
        ],
      });
    const metadata = attachCanonicalMarketIdentityToMetadata(input.intent.metadata, marketIdentity);

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
        metadata: asRecord(metadata),
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
        venueId: orders.venueId,
        asset: orders.asset,
        metadata: orders.metadata,
      })
      .from(orders)
      .where(eq(orders.clientOrderId, orderId))
      .limit(1);

    if (orderRow === undefined || orderRow.venueOrderId === null) {
      return;
    }

    const orderMetadata = asRecord(orderRow.metadata);
    const marketIdentity = readCanonicalMarketIdentityFromMetadata(orderMetadata, {
      venueId: orderRow.venueId,
      asset: orderRow.asset,
      marketType: orderMetadata['instrumentType'],
      provenance: 'derived',
      capturedAtStage: 'fill',
      source: 'runtime_fill_persistence',
      notes: ['Persisted fills inherit market identity from their source runtime orders.'],
    });
    const fillMetadata = attachCanonicalMarketIdentityToMetadata(
      {
        fillId: fill.fillId,
        orderId: fill.orderId,
        filledSize: fill.filledSize,
        fillPrice: fill.fillPrice,
        fee: fill.fee,
        feeAsset: fill.feeAsset,
        filledAt: fill.filledAt.toISOString(),
      },
      marketIdentity,
    );

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
        metadata: fillMetadata,
      })
      .onConflictDoNothing({
        target: fills.id,
      });
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryView | null> {
    const [row] = await this.db.select().from(portfolioCurrent).limit(1);

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

  private buildDefaultVaultCurrentRecord(): typeof vaultCurrent.$inferSelect {
    const defaults = buildDefaultVaultConfig();
    const defaultTimestamp = new Date(0);
    return {
      id: defaults.vaultId,
      vaultName: defaults.vaultName,
      strategyId: defaults.strategyId,
      strategyName: defaults.strategyName,
      managerName: defaults.managerName,
      managerWalletAddress: defaults.managerWalletAddress,
      baseAsset: defaults.baseAsset,
      lockPeriodMonths: defaults.lockPeriodMonths,
      rolling: defaults.rolling,
      reassessmentCadenceMonths: defaults.reassessmentCadenceMonths,
      targetApyFloorPct: defaults.targetApyFloorPct,
      metadata: defaults.metadata,
      createdAt: defaultTimestamp,
      updatedAt: defaultTimestamp,
    };
  }

  private buildDefaultSubmissionDossierRecord(
    vaultRecord: typeof vaultCurrent.$inferSelect,
  ): typeof vaultSubmissionProfiles.$inferSelect {
    const defaults = buildDefaultSubmissionConfig();
    const defaultTimestamp = new Date(0);
    return {
      id: defaults.id,
      submissionName: defaults.submissionName,
      track: defaults.track,
      vaultId: vaultRecord.id,
      strategyId: vaultRecord.strategyId,
      buildWindowStart: defaults.buildWindowStart,
      buildWindowEnd: defaults.buildWindowEnd,
      cluster: defaults.cluster,
      walletAddress: defaults.walletAddress,
      vaultAddress: defaults.vaultAddress,
      cexExecutionUsed: defaults.cexExecutionUsed,
      cexVenues: defaults.cexVenues,
      cexTradeHistoryProvided: defaults.cexTradeHistoryProvided,
      cexReadOnlyApiKeyProvided: defaults.cexReadOnlyApiKeyProvided,
      notes: defaults.notes,
      metadata: defaults.metadata,
      createdAt: defaultTimestamp,
      updatedAt: defaultTimestamp,
    };
  }

  private mapSubmissionEvidenceRow(
    row: typeof vaultSubmissionEvidence.$inferSelect,
    cluster: SubmissionCluster,
  ): SubmissionEvidenceRecordView {
    const evidenceType = normalizeSubmissionEvidenceType(row.evidenceType);
    const reference = normalizeOptionalText(row.reference);
    const url = normalizeOptionalText(row.url) ?? (
      evidenceType === 'on_chain_transaction'
        ? buildSolscanUrl('tx', reference, cluster)
        : null
    );

    return {
      evidenceId: row.id,
      submissionId: row.submissionId,
      evidenceType,
      status: normalizeSubmissionEvidenceStatus(row.status),
      source: normalizeSubmissionEvidenceSource(row.source),
      label: row.label,
      summary: normalizeOptionalText(row.summary),
      reference,
      url,
      capturedAt: toIsoString(row.capturedAt),
      withinBuildWindow: row.withinBuildWindow,
      notes: normalizeOptionalText(row.notes),
      metadata: asJsonObject(row.metadata),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async getVaultCurrentRecord(): Promise<typeof vaultCurrent.$inferSelect> {
    const [row] = await this.db.select().from(vaultCurrent).limit(1);

    return row ?? this.buildDefaultVaultCurrentRecord();
  }

  private async getSubmissionDossierRecord(
    vaultRecord: typeof vaultCurrent.$inferSelect,
  ): Promise<typeof vaultSubmissionProfiles.$inferSelect> {
    const [row] = await this.db
      .select()
      .from(vaultSubmissionProfiles)
      .where(eq(vaultSubmissionProfiles.id, DEFAULT_SUBMISSION_DOSSIER_ID))
      .limit(1);

    return row ?? this.buildDefaultSubmissionDossierRecord(vaultRecord);
  }

  private async ensureSubmissionDossierRecord(
    vaultRecord: typeof vaultCurrent.$inferSelect,
  ): Promise<typeof vaultSubmissionProfiles.$inferSelect> {
    const existing = await this.getSubmissionDossierRecord(vaultRecord);
    if (existing.createdAt.getTime() !== 0) {
      return existing;
    }

    const defaults = buildDefaultSubmissionConfig();
    const [row] = await this.db
      .insert(vaultSubmissionProfiles)
      .values({
        id: defaults.id,
        submissionName: defaults.submissionName,
        track: defaults.track,
        vaultId: vaultRecord.id,
        strategyId: vaultRecord.strategyId,
        buildWindowStart: defaults.buildWindowStart,
        buildWindowEnd: defaults.buildWindowEnd,
        cluster: defaults.cluster,
        walletAddress: defaults.walletAddress,
        vaultAddress: defaults.vaultAddress,
        cexExecutionUsed: defaults.cexExecutionUsed,
        cexVenues: defaults.cexVenues,
        cexTradeHistoryProvided: defaults.cexTradeHistoryProvided,
        cexReadOnlyApiKeyProvided: defaults.cexReadOnlyApiKeyProvided,
        notes: defaults.notes,
        metadata: defaults.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vaultSubmissionProfiles.id,
        set: {
          vaultId: vaultRecord.id,
          strategyId: vaultRecord.strategyId,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.ensureSubmissionDossierRecord: submission dossier was not persisted');
    }

    return row;
  }

  private async getSubmissionEvidenceRows(
    submissionId: string,
  ): Promise<Array<typeof vaultSubmissionEvidence.$inferSelect>> {
    return this.db
      .select()
      .from(vaultSubmissionEvidence)
      .where(eq(vaultSubmissionEvidence.submissionId, submissionId))
      .orderBy(desc(vaultSubmissionEvidence.capturedAt), desc(vaultSubmissionEvidence.createdAt));
  }

  private async ensureVaultCurrentRecord(): Promise<typeof vaultCurrent.$inferSelect> {
    const defaults = buildDefaultVaultConfig();
    const [row] = await this.db
      .insert(vaultCurrent)
      .values({
        id: defaults.vaultId,
        vaultName: defaults.vaultName,
        strategyId: defaults.strategyId,
        strategyName: defaults.strategyName,
        managerName: defaults.managerName,
        managerWalletAddress: defaults.managerWalletAddress,
        baseAsset: defaults.baseAsset,
        lockPeriodMonths: defaults.lockPeriodMonths,
        rolling: defaults.rolling,
        reassessmentCadenceMonths: defaults.reassessmentCadenceMonths,
        targetApyFloorPct: defaults.targetApyFloorPct,
        metadata: defaults.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vaultCurrent.id,
        set: {
          vaultName: defaults.vaultName,
          strategyId: defaults.strategyId,
          strategyName: defaults.strategyName,
          baseAsset: defaults.baseAsset,
          lockPeriodMonths: defaults.lockPeriodMonths,
          rolling: defaults.rolling,
          reassessmentCadenceMonths: defaults.reassessmentCadenceMonths,
          targetApyFloorPct: defaults.targetApyFloorPct,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.ensureVaultCurrentRecord: vault state was not persisted');
    }

    return row;
  }

  private async getVaultDepositorRecordsById(
    depositorIds: string[],
  ): Promise<Map<string, typeof vaultDepositors.$inferSelect>> {
    if (depositorIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(vaultDepositors)
      .where(inArray(vaultDepositors.id, depositorIds));

    return new Map(rows.map((row) => [row.id, row]));
  }

  private mapVaultDepositLotRow(
    row: typeof vaultDepositLots.$inferSelect,
    depositor: typeof vaultDepositors.$inferSelect | undefined,
    now: Date,
  ): VaultDepositLotView {
    return {
      depositLotId: row.id,
      vaultId: row.vaultId,
      depositorId: row.depositorId,
      investorId: depositor?.investorId ?? 'unknown',
      displayName: depositor?.displayName ?? 'Unknown depositor',
      walletAddress: depositor?.walletAddress ?? 'unknown',
      asset: row.asset,
      depositedAmount: row.depositedAmount,
      mintedShares: row.mintedShares,
      sharePrice: row.sharePrice,
      depositedAt: row.depositedAt.toISOString(),
      lockExpiresAt: row.lockExpiresAt.toISOString(),
      redeemedAt: toIsoString(row.redeemedAt),
      locked: row.status !== 'redeemed' && row.lockExpiresAt.getTime() > now.getTime(),
      status: row.status as VaultDepositLotStatus,
      note: row.note ?? null,
      metadata: asJsonObject(row.metadata),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapVaultRedemptionRequestRow(
    row: typeof vaultRedemptionRequests.$inferSelect,
    depositor: typeof vaultDepositors.$inferSelect | undefined,
  ): VaultRedemptionRequestView {
    return {
      requestId: row.id,
      vaultId: row.vaultId,
      depositorId: row.depositorId,
      investorId: depositor?.investorId ?? 'unknown',
      displayName: depositor?.displayName ?? 'Unknown depositor',
      walletAddress: depositor?.walletAddress ?? 'unknown',
      requestedShares: row.requestedShares,
      estimatedAssets: row.estimatedAssets,
      sharePrice: row.sharePrice,
      requestedAt: row.requestedAt.toISOString(),
      eligibleAt: row.eligibleAt.toISOString(),
      fulfilledAt: toIsoString(row.fulfilledAt),
      status: row.status as VaultRedemptionRequestStatus,
      note: row.note ?? null,
      metadata: asJsonObject(row.metadata),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getVaultSummary(): Promise<VaultSummaryView> {
    const now = new Date();
    const [vaultRecord, portfolio, strategyProfile, depositRows, redemptionRows, depositorRows] =
      await Promise.all([
        this.getVaultCurrentRecord(),
        this.getPortfolioSummary(),
        this.getCarryStrategyProfile(),
        this.db
          .select()
          .from(vaultDepositLots)
          .where(inArray(vaultDepositLots.status, ['active', 'redeeming'])),
        this.db
          .select()
          .from(vaultRedemptionRequests)
          .where(inArray(vaultRedemptionRequests.status, ['pending_lock', 'queued'])),
        this.db.select().from(vaultDepositors),
      ]);

    const totalSharesOutstanding = depositRows.reduce(
      (sum, row) => sum.plus(row.mintedShares),
      new Decimal(0),
    );
    const lockedShares = depositRows.reduce(
      (sum, row) =>
        row.lockExpiresAt.getTime() > now.getTime() ? sum.plus(row.mintedShares) : sum,
      new Decimal(0),
    );
    const pendingRedemptionShares = redemptionRows.reduce(
      (sum, row) => sum.plus(row.requestedShares),
      new Decimal(0),
    );
    const totalAssetsUsd =
      portfolio === null
        ? depositRows.reduce((sum, row) => sum.plus(row.depositedAmount), new Decimal(0))
        : new Decimal(portfolio.totalNav);
    const availableLiquidityUsd =
      portfolio === null ? new Decimal(0) : new Decimal(portfolio.liquidityReserve);
    const navPerShare = totalSharesOutstanding.gt(0)
      ? totalAssetsUsd.div(totalSharesOutstanding)
      : new Decimal(1);
    const executionEnvironment = mapStrategyEnvironmentToVaultExecutionEnvironment(
      strategyProfile.evidence.environment,
    );

    return {
      vaultId: vaultRecord.id,
      vaultName: vaultRecord.vaultName,
      strategyId: vaultRecord.strategyId,
      strategyName: vaultRecord.strategyName,
      managerName: vaultRecord.managerName ?? null,
      managerWalletAddress: vaultRecord.managerWalletAddress ?? null,
      baseAsset: vaultRecord.baseAsset,
      lockPeriodMonths: vaultRecord.lockPeriodMonths,
      rolling: vaultRecord.rolling,
      reassessmentCadenceMonths: vaultRecord.reassessmentCadenceMonths,
      targetApyFloorPct: vaultRecord.targetApyFloorPct,
      projectedApyPct: strategyProfile.apy.projectedApyPct,
      realizedApyPct: strategyProfile.apy.realizedApyPct,
      navPerShare: formatDecimal(navPerShare),
      totalAssetsUsd: formatMoney(totalAssetsUsd),
      availableLiquidityUsd: formatMoney(availableLiquidityUsd),
      totalSharesOutstanding: formatDecimal(totalSharesOutstanding),
      totalDepositors: depositorRows.length,
      activeDepositLots: depositRows.length,
      lockedShares: formatDecimal(lockedShares),
      unlockedShares: formatDecimal(Decimal.max(totalSharesOutstanding.minus(lockedShares), 0)),
      pendingRedemptionShares: formatDecimal(pendingRedemptionShares),
      executionEnvironment,
      supportedScope: strategyProfile.evidence.supportedScope,
      blockedScope: strategyProfile.evidence.blockedScope,
      updatedAt: vaultRecord.updatedAt.toISOString(),
    };
  }

  async getSubmissionDossier(): Promise<SubmissionDossierView> {
    const vaultRecord = await this.getVaultCurrentRecord();
    const [strategyProfile, dossierRecord] = await Promise.all([
      this.getCarryStrategyProfile(),
      this.getSubmissionDossierRecord(vaultRecord),
    ]);

    const buildWindowStart = dossierRecord.buildWindowStart;
    const buildWindowEnd = dossierRecord.buildWindowEnd;
    const [executionRowsInWindow, evidenceRows] = await Promise.all([
      this.db
        .select()
        .from(carryActionExecutions)
        .where(
          and(
            gte(carryActionExecutions.createdAt, buildWindowStart),
            lte(carryActionExecutions.createdAt, buildWindowEnd),
          ),
        )
        .orderBy(desc(carryActionExecutions.createdAt)),
      this.getSubmissionEvidenceRows(dossierRecord.id),
    ]);

    const realExecutionRowsInWindow = executionRowsInWindow.filter((row) => !row.simulated);
    const latestRealExecutionRow = realExecutionRowsInWindow[0] ?? null;
    const latestRealStepRow = latestRealExecutionRow === null
      ? null
      : await this.db
        .select()
        .from(carryExecutionSteps)
        .where(eq(carryExecutionSteps.carryExecutionId, latestRealExecutionRow.id))
        .orderBy(desc(carryExecutionSteps.createdAt))
        .limit(10)
        .then((rows) =>
          rows.find((row) => normalizeOptionalText(row.executionReference) !== null) ?? rows[0] ?? null,
        );

    const walletAddress = normalizeOptionalText(dossierRecord.walletAddress);
    const vaultAddress = normalizeOptionalText(dossierRecord.vaultAddress);
    const track = normalizeSubmissionTrack(dossierRecord.track);
    const cluster = dossierRecord.cluster === 'unknown'
      ? mapVaultExecutionEnvironmentToSubmissionCluster(
        mapStrategyEnvironmentToVaultExecutionEnvironment(strategyProfile.evidence.environment),
      )
      : normalizeSubmissionCluster(dossierRecord.cluster);
    const evidence = evidenceRows.map((row) => this.mapSubmissionEvidenceRow(row, cluster));
    const onChainEvidence = evidence.filter((item) =>
      item.evidenceType === 'on_chain_transaction' && item.status !== 'rejected' && item.withinBuildWindow
    );
    const latestOnChainEvidence = onChainEvidence[0] ?? null;
    const performanceEvidenceCount = evidence.filter((item) =>
      item.evidenceType === 'performance_snapshot' && item.status !== 'rejected'
    ).length;
    const cexTradeHistoryEvidenceCount = evidence.filter((item) =>
      item.evidenceType === 'cex_trade_history' && item.status !== 'rejected'
    ).length;
    const cexReadOnlyApiEvidenceCount = evidence.filter((item) =>
      item.evidenceType === 'cex_read_only_api' && item.status !== 'rejected'
    ).length;
    const addressScope = resolveSubmissionAddressScope(walletAddress, vaultAddress);
    const cexVenues = [...new Set(asStringArray(dossierRecord.cexVenues))];
    const latestExecutionReference = normalizeOptionalText(
      latestOnChainEvidence?.reference
        ?? latestRealStepRow?.executionReference
        ?? latestRealExecutionRow?.venueExecutionReference
        ?? null,
    );
    const latestExecutionAt = latestOnChainEvidence?.capturedAt
      ?? (
        latestRealExecutionRow === null
          ? null
          : toIsoString(latestRealExecutionRow.completedAt ?? latestRealExecutionRow.createdAt)
      );
    const readiness = buildSubmissionReadiness({
      addressScope,
      cluster,
      baseAsset: vaultRecord.baseAsset,
      lockPeriodMonths: vaultRecord.lockPeriodMonths,
      rolling: vaultRecord.rolling,
      reassessmentCadenceMonths: vaultRecord.reassessmentCadenceMonths,
      targetApyFloorPct: vaultRecord.targetApyFloorPct,
      strategyEligibilityStatus: strategyProfile.eligibility.status,
      strategyBlockedReasons: strategyProfile.eligibility.blockedReasons,
      realizedApyPct: strategyProfile.apy.realizedApyPct,
      realExecutionCountInWindow: realExecutionRowsInWindow.length,
      onChainEvidenceCountInWindow: onChainEvidence.length,
      performanceEvidenceCount,
      cexExecutionUsed: dossierRecord.cexExecutionUsed,
      cexTradeHistoryProvided: dossierRecord.cexTradeHistoryProvided,
      cexReadOnlyApiKeyProvided: dossierRecord.cexReadOnlyApiKeyProvided,
      cexTradeHistoryEvidenceCount,
      cexReadOnlyApiEvidenceCount,
    });

    return {
      submissionId: dossierRecord.id,
      submissionName: dossierRecord.submissionName,
      track,
      strategyId: vaultRecord.strategyId,
      strategyName: vaultRecord.strategyName,
      vaultId: vaultRecord.id,
      vaultName: vaultRecord.vaultName,
      baseAsset: vaultRecord.baseAsset,
      buildWindowStart: buildWindowStart.toISOString(),
      buildWindowEnd: buildWindowEnd.toISOString(),
      cluster,
      addressScope,
      walletAddress,
      walletVerificationUrl: buildSolscanUrl('account', walletAddress, cluster),
      vaultAddress,
      vaultVerificationUrl: buildSolscanUrl('account', vaultAddress, cluster),
      managerWalletAddress: normalizeOptionalText(vaultRecord.managerWalletAddress),
      latestExecutionReference,
      latestExecutionReferenceUrl: buildSolscanUrl('tx', latestExecutionReference, cluster),
      latestExecutionAt,
      realExecutionCountInWindow: realExecutionRowsInWindow.length,
      simulatedExecutionCountInWindow: executionRowsInWindow.filter((row) => row.simulated).length,
      realizedApyPct: strategyProfile.apy.realizedApyPct,
      cexExecutionUsed: dossierRecord.cexExecutionUsed,
      cexVenues,
      cexTradeHistoryProvided: dossierRecord.cexTradeHistoryProvided,
      cexReadOnlyApiKeyProvided: dossierRecord.cexReadOnlyApiKeyProvided,
      supportedScope: strategyProfile.evidence.supportedScope,
      blockedScope: strategyProfile.evidence.blockedScope,
      notes: normalizeOptionalText(dossierRecord.notes),
      metadata: asJsonObject(dossierRecord.metadata),
      readiness,
      createdAt: dossierRecord.createdAt.toISOString(),
      updatedAt: dossierRecord.updatedAt.toISOString(),
    };
  }

  async listSubmissionEvidence(): Promise<SubmissionEvidenceRecordView[]> {
    const vaultRecord = await this.getVaultCurrentRecord();
    const dossierRecord = await this.getSubmissionDossierRecord(vaultRecord);
    const cluster = normalizeSubmissionCluster(dossierRecord.cluster);
    const rows = await this.getSubmissionEvidenceRows(dossierRecord.id);
    return rows.map((row) => this.mapSubmissionEvidenceRow(row, cluster));
  }

  async getSubmissionExportBundle(): Promise<SubmissionExportBundleView> {
    const [dossier, evidence] = await Promise.all([
      this.getSubmissionDossier(),
      this.listSubmissionEvidence(),
    ]);

    return buildSubmissionExportBundle({ dossier, evidence });
  }

  async listVaultDepositors(limit = 100): Promise<VaultDepositorView[]> {
    const now = new Date();
    const [depositorRows, depositRows, redemptionRows] = await Promise.all([
      this.db.select().from(vaultDepositors).orderBy(desc(vaultDepositors.updatedAt)).limit(limit),
      this.db
        .select()
        .from(vaultDepositLots)
        .where(inArray(vaultDepositLots.status, ['active', 'redeeming'])),
      this.db
        .select()
        .from(vaultRedemptionRequests)
        .where(inArray(vaultRedemptionRequests.status, ['pending_lock', 'queued'])),
    ]);

    return depositorRows.map((depositor) => {
      const depositorLots = depositRows.filter((row) => row.depositorId === depositor.id);
      const depositorRedemptions = redemptionRows.filter((row) => row.depositorId === depositor.id);
      const totalDepositedUsdc = depositorLots.reduce(
        (sum, row) => sum.plus(row.depositedAmount),
        new Decimal(0),
      );
      const activeShares = depositorLots.reduce(
        (sum, row) => sum.plus(row.mintedShares),
        new Decimal(0),
      );
      const lockedShares = depositorLots.reduce(
        (sum, row) =>
          row.lockExpiresAt.getTime() > now.getTime() ? sum.plus(row.mintedShares) : sum,
        new Decimal(0),
      );
      const pendingRedemptionShares = depositorRedemptions.reduce(
        (sum, row) => sum.plus(row.requestedShares),
        new Decimal(0),
      );
      const lastDepositAt = depositorLots.reduce<Date | null>(
        (latest, row) =>
          latest === null || row.depositedAt.getTime() > latest.getTime()
            ? row.depositedAt
            : latest,
        null,
      );

      return {
        depositorId: depositor.id,
        investorId: depositor.investorId,
        displayName: depositor.displayName,
        walletAddress: depositor.walletAddress,
        status: depositor.status as VaultDepositorStatus,
        totalDepositedUsdc: formatMoney(totalDepositedUsdc),
        activeShares: formatDecimal(activeShares),
        lockedShares: formatDecimal(lockedShares),
        unlockedShares: formatDecimal(Decimal.max(activeShares.minus(lockedShares), 0)),
        pendingRedemptionShares: formatDecimal(pendingRedemptionShares),
        lastDepositAt: toIsoString(lastDepositAt),
        createdAt: depositor.createdAt.toISOString(),
        updatedAt: depositor.updatedAt.toISOString(),
      };
    });
  }

  async listVaultDepositLots(limit = 100): Promise<VaultDepositLotView[]> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(vaultDepositLots)
      .orderBy(desc(vaultDepositLots.depositedAt))
      .limit(limit);
    const depositorMap = await this.getVaultDepositorRecordsById(
      rows.map((row) => row.depositorId),
    );

    return rows.map((row) =>
      this.mapVaultDepositLotRow(row, depositorMap.get(row.depositorId), now),
    );
  }

  async listVaultRedemptionRequests(limit = 100): Promise<VaultRedemptionRequestView[]> {
    const rows = await this.db
      .select()
      .from(vaultRedemptionRequests)
      .orderBy(desc(vaultRedemptionRequests.requestedAt))
      .limit(limit);
    const depositorMap = await this.getVaultDepositorRecordsById(
      rows.map((row) => row.depositorId),
    );

    return rows.map((row) =>
      this.mapVaultRedemptionRequestRow(row, depositorMap.get(row.depositorId)),
    );
  }

  async recordVaultDeposit(input: RecordVaultDepositInput): Promise<VaultDepositLotView> {
    const depositedAt = input.depositedAt === undefined ? new Date() : new Date(input.depositedAt);
    if (Number.isNaN(depositedAt.getTime())) {
      throw new Error('Vault deposit requires a valid depositedAt timestamp when provided.');
    }

    const amountUsdc = new Decimal(input.amountUsdc);
    if (!amountUsdc.isFinite() || amountUsdc.lte(0)) {
      throw new Error('Vault deposit amount must be greater than zero.');
    }

    const vaultRecord = await this.ensureVaultCurrentRecord();
    const summary = await this.getVaultSummary();
    const navPerShare = decimalOrZero(summary.navPerShare);
    const effectiveSharePrice = navPerShare.gt(0) ? navPerShare : new Decimal(1);
    const mintedShares = amountUsdc.div(effectiveSharePrice);
    const lockExpiresAt = addMonths(depositedAt, vaultRecord.lockPeriodMonths);

    let [depositor] = await this.db
      .select()
      .from(vaultDepositors)
      .where(eq(vaultDepositors.walletAddress, input.walletAddress))
      .limit(1);

    if (depositor === undefined) {
      const [createdDepositor] = await this.db
        .insert(vaultDepositors)
        .values({
          investorId: input.investorId,
          displayName: input.displayName,
          walletAddress: input.walletAddress,
          status: 'active',
          metadata: input.metadata ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (createdDepositor === undefined) {
        throw new Error('RuntimeStore.recordVaultDeposit: depositor was not persisted');
      }

      depositor = createdDepositor;
    } else {
      await this.db
        .update(vaultDepositors)
        .set({
          investorId: input.investorId,
          displayName: input.displayName,
          status: 'active',
          metadata: input.metadata ?? depositor.metadata,
          updatedAt: new Date(),
        })
        .where(eq(vaultDepositors.id, depositor.id));
      depositor = {
        ...depositor,
        investorId: input.investorId,
        displayName: input.displayName,
        status: 'active',
        metadata: input.metadata ?? depositor.metadata,
        updatedAt: new Date(),
      };
    }

    const [depositLot] = await this.db
      .insert(vaultDepositLots)
      .values({
        vaultId: vaultRecord.id,
        depositorId: depositor.id,
        asset: vaultRecord.baseAsset,
        depositedAmount: formatMoney(amountUsdc),
        mintedShares: formatDecimal(mintedShares),
        sharePrice: formatDecimal(effectiveSharePrice),
        depositedAt,
        lockExpiresAt,
        redeemedAt: null,
        status: 'active',
        note: input.note ?? null,
        metadata: input.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (depositLot === undefined) {
      throw new Error('RuntimeStore.recordVaultDeposit: deposit lot was not persisted');
    }

    await this.db
      .update(vaultCurrent)
      .set({ updatedAt: new Date() })
      .where(eq(vaultCurrent.id, vaultRecord.id));

    return this.mapVaultDepositLotRow(depositLot, depositor, new Date());
  }

  async requestVaultRedemption(
    input: RequestVaultRedemptionInput,
  ): Promise<VaultRedemptionRequestView> {
    const requestedAt = input.requestedAt === undefined ? new Date() : new Date(input.requestedAt);
    if (Number.isNaN(requestedAt.getTime())) {
      throw new Error('Vault redemption requires a valid requestedAt timestamp when provided.');
    }

    const requestedShares = new Decimal(input.requestedShares);
    if (!requestedShares.isFinite() || requestedShares.lte(0)) {
      throw new Error('Vault redemption shares must be greater than zero.');
    }

    const vaultRecord = await this.ensureVaultCurrentRecord();
    const [depositor] = await this.db
      .select()
      .from(vaultDepositors)
      .where(eq(vaultDepositors.walletAddress, input.walletAddress))
      .limit(1);

    if (depositor === undefined) {
      throw new Error(`Vault depositor '${input.walletAddress}' was not found.`);
    }

    const [depositRows, existingRequests, summary] = await Promise.all([
      this.db
        .select()
        .from(vaultDepositLots)
        .where(
          and(
            eq(vaultDepositLots.depositorId, depositor.id),
            inArray(vaultDepositLots.status, ['active', 'redeeming']),
          ),
        )
        .orderBy(asc(vaultDepositLots.lockExpiresAt), asc(vaultDepositLots.depositedAt)),
      this.db
        .select()
        .from(vaultRedemptionRequests)
        .where(
          and(
            eq(vaultRedemptionRequests.depositorId, depositor.id),
            inArray(vaultRedemptionRequests.status, ['pending_lock', 'queued']),
          ),
        )
        .orderBy(asc(vaultRedemptionRequests.requestedAt)),
      this.getVaultSummary(),
    ]);

    const lotAvailability = depositRows.map((row) => ({
      row,
      availableShares: new Decimal(row.mintedShares),
    }));

    const reserveShares = (sharesToReserve: Decimal): void => {
      let remaining = sharesToReserve;
      for (const lot of lotAvailability) {
        if (remaining.lte(0)) {
          break;
        }
        if (lot.availableShares.lte(0)) {
          continue;
        }
        const taken = Decimal.min(lot.availableShares, remaining);
        lot.availableShares = lot.availableShares.minus(taken);
        remaining = remaining.minus(taken);
      }
      if (remaining.gt(0)) {
        throw new Error('Requested redemption exceeds available depositor shares.');
      }
    };

    for (const request of existingRequests) {
      reserveShares(new Decimal(request.requestedShares));
    }

    let remaining = requestedShares;
    const allocations: Array<{
      lotId: string;
      allocatedShares: string;
      eligibleAt: string;
    }> = [];
    let eligibleAt = requestedAt;

    for (const lot of lotAvailability) {
      if (remaining.lte(0)) {
        break;
      }
      if (lot.availableShares.lte(0)) {
        continue;
      }
      const taken = Decimal.min(lot.availableShares, remaining);
      const lotEligibleAt =
        lot.row.lockExpiresAt.getTime() > requestedAt.getTime()
          ? lot.row.lockExpiresAt
          : requestedAt;
      allocations.push({
        lotId: lot.row.id,
        allocatedShares: formatDecimal(taken),
        eligibleAt: lotEligibleAt.toISOString(),
      });
      if (lotEligibleAt.getTime() > eligibleAt.getTime()) {
        eligibleAt = lotEligibleAt;
      }
      remaining = remaining.minus(taken);
    }

    if (remaining.gt(0)) {
      throw new Error('Requested redemption exceeds available depositor shares.');
    }

    const sharePrice = decimalOrZero(summary.navPerShare);
    const effectiveSharePrice = sharePrice.gt(0) ? sharePrice : new Decimal(1);
    const estimatedAssets = requestedShares.times(effectiveSharePrice);
    const status: VaultRedemptionRequestStatus =
      eligibleAt.getTime() > requestedAt.getTime() ? 'pending_lock' : 'queued';

    const [requestRow] = await this.db
      .insert(vaultRedemptionRequests)
      .values({
        vaultId: vaultRecord.id,
        depositorId: depositor.id,
        requestedShares: formatDecimal(requestedShares),
        estimatedAssets: formatMoney(estimatedAssets),
        sharePrice: formatDecimal(effectiveSharePrice),
        requestedAt,
        eligibleAt,
        fulfilledAt: null,
        status,
        note: input.note ?? null,
        metadata: {
          ...(input.metadata ?? {}),
          allocations,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (requestRow === undefined) {
      throw new Error('RuntimeStore.requestVaultRedemption: redemption request was not persisted');
    }

    await this.db
      .update(vaultCurrent)
      .set({ updatedAt: new Date() })
      .where(eq(vaultCurrent.id, vaultRecord.id));

    return this.mapVaultRedemptionRequestRow(requestRow, depositor);
  }

  async upsertSubmissionDossier(
    input: UpsertSubmissionDossierInput,
  ): Promise<SubmissionDossierView> {
    const vaultRecord = await this.ensureVaultCurrentRecord();
    const existing = await this.getSubmissionDossierRecord(vaultRecord);
    const nextBuildWindowStart = input.buildWindowStart === undefined
      ? existing.buildWindowStart
      : new Date(input.buildWindowStart);
    const nextBuildWindowEnd = input.buildWindowEnd === undefined
      ? existing.buildWindowEnd
      : new Date(input.buildWindowEnd);

    if (Number.isNaN(nextBuildWindowStart.getTime())) {
      throw new Error('Submission dossier requires a valid buildWindowStart timestamp.');
    }
    if (Number.isNaN(nextBuildWindowEnd.getTime())) {
      throw new Error('Submission dossier requires a valid buildWindowEnd timestamp.');
    }
    if (nextBuildWindowEnd.getTime() < nextBuildWindowStart.getTime()) {
      throw new Error('Submission dossier build window end must be on or after build window start.');
    }

    const cexVenues = input.cexVenues === undefined
      ? asStringArray(existing.cexVenues)
      : [...new Set(asStringArray(input.cexVenues))];
    const track = input.track ?? normalizeSubmissionTrack(existing.track);
    const cluster = input.cluster ?? normalizeSubmissionCluster(existing.cluster);
    const submissionName = normalizeOptionalText(input.submissionName) ?? existing.submissionName;
    const walletAddress = input.walletAddress === undefined
      ? normalizeOptionalText(existing.walletAddress)
      : normalizeOptionalText(input.walletAddress);
    const vaultAddress = input.vaultAddress === undefined
      ? normalizeOptionalText(existing.vaultAddress)
      : normalizeOptionalText(input.vaultAddress);
    const notes = input.notes === undefined
      ? normalizeOptionalText(existing.notes)
      : normalizeOptionalText(input.notes);

    const createdAt = existing.createdAt.getTime() === 0 ? new Date() : existing.createdAt;
    const [row] = await this.db
      .insert(vaultSubmissionProfiles)
      .values({
        id: DEFAULT_SUBMISSION_DOSSIER_ID,
        submissionName,
        track,
        vaultId: vaultRecord.id,
        strategyId: vaultRecord.strategyId,
        buildWindowStart: nextBuildWindowStart,
        buildWindowEnd: nextBuildWindowEnd,
        cluster,
        walletAddress,
        vaultAddress,
        cexExecutionUsed: input.cexExecutionUsed ?? existing.cexExecutionUsed,
        cexVenues,
        cexTradeHistoryProvided:
          input.cexTradeHistoryProvided ?? existing.cexTradeHistoryProvided,
        cexReadOnlyApiKeyProvided:
          input.cexReadOnlyApiKeyProvided ?? existing.cexReadOnlyApiKeyProvided,
        notes,
        metadata: input.metadata ?? asJsonObject(existing.metadata),
        createdAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vaultSubmissionProfiles.id,
        set: {
          submissionName,
          track,
          vaultId: vaultRecord.id,
          strategyId: vaultRecord.strategyId,
          buildWindowStart: nextBuildWindowStart,
          buildWindowEnd: nextBuildWindowEnd,
          cluster,
          walletAddress,
          vaultAddress,
          cexExecutionUsed: input.cexExecutionUsed ?? existing.cexExecutionUsed,
          cexVenues,
          cexTradeHistoryProvided:
            input.cexTradeHistoryProvided ?? existing.cexTradeHistoryProvided,
          cexReadOnlyApiKeyProvided:
            input.cexReadOnlyApiKeyProvided ?? existing.cexReadOnlyApiKeyProvided,
          notes,
          metadata: input.metadata ?? asJsonObject(existing.metadata),
          updatedAt: new Date(),
        },
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.upsertSubmissionDossier: submission dossier was not persisted');
    }

    return this.getSubmissionDossier();
  }

  async recordSubmissionEvidence(
    input: RecordSubmissionEvidenceInput,
  ): Promise<SubmissionEvidenceRecordView> {
    const vaultRecord = await this.ensureVaultCurrentRecord();
    const dossierRecord = await this.ensureSubmissionDossierRecord(vaultRecord);
    const evidenceType = normalizeSubmissionEvidenceType(input.evidenceType);
    const label = normalizeOptionalText(input.label);

    if (label === null) {
      throw new Error('Submission evidence requires a non-empty label.');
    }

    const capturedAt = input.capturedAt === undefined || input.capturedAt === null
      ? null
      : new Date(input.capturedAt);
    if (capturedAt !== null && Number.isNaN(capturedAt.getTime())) {
      throw new Error('Submission evidence requires a valid capturedAt timestamp when provided.');
    }

    const withinBuildWindow = input.withinBuildWindow ?? (
      capturedAt !== null &&
      capturedAt.getTime() >= dossierRecord.buildWindowStart.getTime() &&
      capturedAt.getTime() <= dossierRecord.buildWindowEnd.getTime()
    );
    const cluster = normalizeSubmissionCluster(dossierRecord.cluster);
    const reference = sanitizeSubmissionEvidenceReference(
      evidenceType,
      normalizeOptionalText(input.reference),
    );
    const url = normalizeOptionalText(input.url) ?? (
      evidenceType === 'on_chain_transaction'
        ? buildSolscanUrl('tx', reference, cluster)
        : null
    );

    const [row] = await this.db
      .insert(vaultSubmissionEvidence)
      .values({
        submissionId: dossierRecord.id,
        evidenceType,
        status: normalizeSubmissionEvidenceStatus(input.status),
        source: normalizeSubmissionEvidenceSource(input.source),
        label,
        summary: normalizeOptionalText(input.summary),
        reference,
        url,
        capturedAt,
        withinBuildWindow,
        notes: normalizeOptionalText(input.notes),
        metadata: input.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (row === undefined) {
      throw new Error('RuntimeStore.recordSubmissionEvidence: submission evidence was not persisted');
    }

    return this.mapSubmissionEvidenceRow(row, cluster);
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
    const [row] = await this.db.select().from(riskCurrent).limit(1);

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

  async replaceRiskCurrentFromSnapshot(row: typeof riskSnapshots.$inferSelect): Promise<void> {
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

  async listFillHistory(): Promise<
    Array<{
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
      marketIdentity: CanonicalMarketIdentity | null;
      metadata: Record<string, unknown>;
    }>
  > {
    return this.listFillHistoryForVenues();
  }

  async listFillHistoryForVenues(
    venueIds?: readonly string[],
    limit?: number,
  ): Promise<
    Array<{
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
      marketIdentity: CanonicalMarketIdentity | null;
      metadata: Record<string, unknown>;
    }>
  > {
    const venueFilter = venueIds === undefined || venueIds.length === 0
      ? undefined
      : inArray(orders.venueId, [...venueIds]);

    const baseQuery = this.db
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
        fillMetadata: fills.metadata,
        orderMetadata: orders.metadata,
      })
      .from(fills)
      .innerJoin(orders, eq(fills.clientOrderId, orders.clientOrderId))
      .orderBy(desc(fills.filledAt), desc(fills.createdAt));

    const filteredQuery = venueFilter === undefined
      ? baseQuery
      : baseQuery.where(venueFilter);
    const query = limit !== undefined && limit > 0
      ? filteredQuery.limit(limit)
      : filteredQuery;

    const rows = (await query).reverse();

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
      marketIdentity:
        readCanonicalMarketIdentityFromMetadata(asRecord(row.fillMetadata), {
          venueId: row.venueId,
          asset: row.asset,
          marketType: asRecord(row.orderMetadata)['instrumentType'],
          provenance: 'derived',
          capturedAtStage: 'fill',
          source: 'runtime_fill_history',
          notes: [
            'Fill-history market identity falls back to persisted fill metadata and then source-order metadata.',
          ],
        }) ??
        readCanonicalMarketIdentityFromMetadata(asRecord(row.orderMetadata), {
          venueId: row.venueId,
          asset: row.asset,
          marketType: asRecord(row.orderMetadata)['instrumentType'],
          provenance: 'derived',
          capturedAtStage: 'fill',
          source: 'runtime_fill_history',
          notes: ['Fill-history market identity falls back to source-order metadata.'],
        }),
      metadata: asRecord(row.fillMetadata),
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

    const watermark =
      latestOrder === null
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
    const rows = await this.db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);

    return rows.map(mapOrderRow);
  }

  async listOrdersByVenue(venueId: string): Promise<OrderView[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.venueId, venueId))
      .orderBy(desc(orders.createdAt));

    return rows.map(mapOrderRow);
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

    return mapOrderRow(row);
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
    const [row] = await this.db.select().from(positions).where(eq(positions.id, id)).limit(1);

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
      evaluationStage: readOpportunityEvaluationStage(row.payload),
      evaluationReason: readOpportunityOptimizerValue(row.payload, 'evaluationReason'),
      portfolioScore: readOpportunityOptimizerNumber(row.payload, 'portfolioScore'),
      portfolioScoreBreakdown: readOpportunityOptimizerScoreBreakdown(row.payload),
      optimizerRationale: readOpportunityOptimizerRationale(row.payload),
      plannedNotionalUsd: readOpportunityOptimizerValue(row.payload, 'plannedNotionalUsd'),
      payload: row.payload as Record<string, unknown>,
    }));
  }

  async listCarryOpportunityEvaluations(limit: number): Promise<CarryOpportunityEvaluationView[]> {
    const rows = await this.db
      .select({
        evaluation: strategyOpportunityEvaluations,
        opportunity: strategyOpportunities,
      })
      .from(strategyOpportunityEvaluations)
      .innerJoin(
        strategyOpportunities,
        eq(strategyOpportunityEvaluations.opportunityId, strategyOpportunities.opportunityId),
      )
      .orderBy(desc(strategyOpportunityEvaluations.createdAt))
      .limit(limit);

    return rows.map(({ evaluation, opportunity }) => ({
      evaluationId: evaluation.id,
      opportunityId: evaluation.opportunityId,
      runId: evaluation.runId,
      sleeveId: evaluation.sleeveId,
      asset: evaluation.asset,
      opportunityType: opportunity.opportunityType,
      expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
      netYieldPct: opportunity.netYieldPct,
      confidenceScore: opportunity.confidenceScore,
      detectedAt: opportunity.detectedAt.toISOString(),
      expiresAt: opportunity.expiresAt.toISOString(),
      approved: evaluation.approved,
      evaluationStage:
        evaluation.evaluationStage === 'threshold_filter' ||
        evaluation.evaluationStage === 'portfolio_optimizer'
          ? evaluation.evaluationStage
          : null,
      evaluationReason: evaluation.evaluationReason,
      portfolioScore: evaluation.portfolioScore === null ? null : Number(evaluation.portfolioScore),
      portfolioScoreBreakdown:
        Object.keys(asRecord(evaluation.portfolioScoreBreakdown)).length > 0
          ? Object.fromEntries(
              Object.entries(asRecord(evaluation.portfolioScoreBreakdown))
                .filter((entry): entry is [string, number | string] =>
                  typeof entry[1] === 'number' || typeof entry[1] === 'string',
                )
                .map(([key, value]) => [key, Number(value)]),
            )
          : null,
      optimizerRationale: Array.isArray(evaluation.optimizerRationale)
        ? evaluation.optimizerRationale.filter(
            (value: unknown): value is string => typeof value === 'string',
          )
        : [],
      plannedNotionalUsd: evaluation.plannedNotionalUsd,
      createdAt: evaluation.createdAt.toISOString(),
      updatedAt: evaluation.updatedAt.toISOString(),
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
      evaluationStage: readOpportunityEvaluationStage(row.payload),
      evaluationReason: readOpportunityOptimizerValue(row.payload, 'evaluationReason'),
      portfolioScore: readOpportunityOptimizerNumber(row.payload, 'portfolioScore'),
      portfolioScoreBreakdown: readOpportunityOptimizerScoreBreakdown(row.payload),
      optimizerRationale: readOpportunityOptimizerRationale(row.payload),
      plannedNotionalUsd: readOpportunityOptimizerValue(row.payload, 'plannedNotionalUsd'),
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
        throw new Error(
          `RuntimeStore.upsertMismatch: mismatch "${input.dedupeKey}" was not persisted`,
        );
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
      throw new Error(
        `RuntimeStore.upsertMismatch: mismatch "${input.dedupeKey}" was not persisted`,
      );
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
      filters.sourceKind !== undefined
        ? eq(runtimeMismatches.sourceKind, filters.sourceKind)
        : undefined,
      filters.category !== undefined ? eq(runtimeMismatches.category, filters.category) : undefined,
    ].filter(
      (condition): condition is Exclude<typeof condition, undefined> => condition !== undefined,
    );

    const rows =
      conditions.length === 0
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
    const [inserted] = await this.db
      .insert(runtimeRecoveryEvents)
      .values({
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
      })
      .returning();

    if (inserted === undefined) {
      throw new Error(
        `RuntimeStore.recordRecoveryEvent: event "${input.eventType}" was not persisted`,
      );
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
      .where(
        sql`${runtimeRecoveryEvents.status} in ('recovering', 'resolved', 'verified', 'reopened', 'completed', 'failed')`,
      )
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

    const [linkedCommand, recoveryEvents, remediationHistory, reconciliationFindings] =
      await Promise.all([
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
          opportunityScore:
            target.opportunityScore === null ? null : target.opportunityScore.toFixed(4),
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

  async getAllocatorDecision(allocatorRunId: string): Promise<AllocatorDecisionDetailView | null> {
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
        ? (runRow.constraints as AllocatorDecisionDetailView['constraints'])
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
      interventionRecommendation:
        input.proposal.status === 'proposed'
          ? 'operator_review_required'
          : 'wait_for_inflight_children',
      totalChildCount: 0,
      blockedChildCount:
        input.proposal.blockedReasons.length > 0 || !input.proposal.executable ? 1 : 0,
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
      await Promise.all(
        rows.map(async (row): Promise<RebalanceBundleView | null> => {
          const detail = await this.getRebalanceProposal(row['proposalId']);
          return detail === null ? null : mapRebalanceBundleRow(row, detail.proposal);
        }),
      )
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
    const latestEventByEscalationId = new Map<
      string,
      typeof allocatorRebalanceBundleEscalationEvents.$inferSelect
    >();
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
      const childSleeves = ['carry', 'treasury'].filter(
        (sleeve): sleeve is 'carry' | 'treasury' => {
          const rollup = childRollup[sleeve];
          return typeof rollup === 'object' && rollup !== null;
        },
      );
      const latestEventSummary =
        latestEvent === undefined
          ? (escalationRow.handoffNote ??
            escalationRow.reviewNote ??
            escalationRow.resolutionNote ??
            null)
          : (latestEvent.note ?? `${latestEvent.eventType} -> ${latestEvent.toStatus}`);
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
        acknowledgedAt:
          acknowledgedAtByEscalationId.get(escalationRow.id) ??
          toIsoString(escalationRow.acknowledgedAt),
        inReviewAt: inReviewAtByEscalationId.get(escalationRow.id) ?? null,
        dueAt: toIsoString(escalationRow.dueAt),
        latestActivityAt:
          latestEvent?.createdAt.toISOString() ?? escalationRow.updatedAt.toISOString(),
        latestEventType:
          (latestEvent?.eventType as RebalanceBundleEscalationEventType | null) ?? null,
        latestEventSummary,
        bundleStatus: bundleRow.status as RebalanceBundleStatus,
        interventionRecommendation:
          bundleRow.interventionRecommendation as RebalanceBundleInterventionRecommendation,
        resolutionState: bundleRow.resolutionState as RebalanceBundleResolutionState,
        outcomeClassification:
          bundleRow.outcomeClassification as RebalanceBundleOutcomeClassification,
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

    return items.reduce<RebalanceEscalationQueueSummaryView>(
      (summary, item) => {
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
      },
      {
        total: 0,
        open: 0,
        acknowledged: 0,
        inReview: 0,
        resolved: 0,
        overdue: 0,
        dueSoon: 0,
        unassigned: 0,
        mine: 0,
      },
    );
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
    const resolvedRecommendation =
      existingRow === undefined
        ? null
        : recommendationForResolutionState(
            existingRow.resolutionState as RebalanceBundleResolutionState,
          );
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
    const [recoveryActions, recoveryCandidates, resolutionActions, escalation, escalationHistory] =
      await Promise.all([
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

  async getRebalanceBundleForProposal(
    proposalId: string,
  ): Promise<RebalanceBundleDetailView | null> {
    return this.syncRebalanceBundleForProposal(proposalId);
  }

  private async buildRebalanceBundleRecoveryCandidatesForBundle(
    bundle: RebalanceBundleDetailView,
  ): Promise<RebalanceBundleRecoveryCandidateView[]> {
    const [carryCandidates, treasuryCandidates] = await Promise.all([
      Promise.all(
        bundle.graph.downstream.carry.actions.map(async (node) =>
          this.buildCarryRecoveryCandidate(bundle, node),
        ),
      ),
      Promise.all(
        bundle.graph.downstream.treasury.actions.map(async (node) =>
          this.buildTreasuryRecoveryCandidate(bundle, node),
        ),
      ),
    ]);

    return [...carryCandidates, ...treasuryCandidates, this.buildProposalRecoveryCandidate(bundle)];
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
      .where(
        and(
          eq(allocatorRebalanceBundleRecoveryActions.bundleId, bundleId),
          eq(allocatorRebalanceBundleRecoveryActions.id, recoveryActionId),
        ),
      )
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
      blockedReasons: [
        this.buildBundleRecoveryBlockedReason(
          'proposal_requeue_not_supported',
          'safety',
          'Proposal-level rebalance retry is not safely supported in this pass because it can duplicate downstream child work.',
          'Inspect child actions directly and use child-scoped recovery actions when they are explicitly eligible.',
          {
            proposalId: bundle.bundle.proposalId,
          },
        ),
      ],
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
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'bundle_not_actionable',
          'bundle_state',
          `Bundle status "${bundle.bundle.status}" does not permit recovery mutation requests.`,
          'Wait for the bundle to reach a failed, blocked, partial, or intervention-required state before requesting recovery.',
          {
            bundleStatus: bundle.bundle.status,
          },
        ),
      );
    }

    const runtimeStatus = await this.getRuntimeStatus();
    if (
      runtimeStatus.halted ||
      runtimeStatus.lifecycleState === 'paused' ||
      runtimeStatus.lifecycleState === 'stopped' ||
      runtimeStatus.lifecycleState === 'starting'
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'runtime_not_ready',
          'runtime',
          'Runtime is not in a state that permits child recovery execution.',
          'Return runtime to ready state before requesting bundle recovery.',
          {
            lifecycleState: runtimeStatus.lifecycleState,
            halted: runtimeStatus.halted,
          },
        ),
      );
    }

    if (
      node.executions.some((execution) => execution.status === 'completed') ||
      node.action.status === 'completed'
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_already_completed',
          'target_child',
          'Carry child already completed successfully and should not be retried.',
          'Inspect the completed child execution history instead of requeueing it.',
          {
            carryActionId: node.action.id,
          },
        ),
      );
    }

    if (node.action.status === 'queued' || node.action.status === 'executing') {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_has_inflight_command',
          'target_child',
          'Carry child is already queued or executing.',
          'Wait for the in-flight carry child to settle before requesting another recovery action.',
          {
            carryActionId: node.action.id,
            status: node.action.status,
            linkedCommandId: node.action.linkedCommandId,
          },
        ),
      );
    }

    if (node.action.status === 'cancelled') {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_not_retryable',
          'target_child',
          'Cancelled carry children are inspect-only in this pass.',
          'Create a new allocator or carry evaluation if a replacement action is required.',
          {
            carryActionId: node.action.id,
          },
        ),
      );
    }

    if (!node.action.executable || node.action.blockedReasons.length > 0) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_remains_blocked',
          'safety',
          'Carry child remains operationally blocked and cannot be requeued safely.',
          'Resolve the carry child blocked reasons before requesting recovery.',
          {
            carryActionId: node.action.id,
            blockedReasons: node.action.blockedReasons,
          },
        ),
      );
    }

    const latestFailedExecution =
      node.executions.find((execution) => execution.id === node.action.latestExecutionId) ??
      node.executions.find((execution) => execution.status === 'failed') ??
      null;
    const hasExecutionSideEffects =
      node.executions.some((execution) => execution.venueExecutionReference !== null) ||
      stepRows.some(
        (row) =>
          row.executionReference !== null ||
          row.venueOrderId !== null ||
          !['pending', 'failed'].includes(row.status),
      );
    if (hasExecutionSideEffects) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'carry_execution_partial_progress_detected',
          'safety',
          'Carry child shows partial execution progress, so replaying it could duplicate fills or orders.',
          'Inspect the carry execution detail and resolve the partial application manually before retrying.',
          {
            carryActionId: node.action.id,
            latestExecutionId: latestFailedExecution?.id ?? null,
          },
        ),
      );
    }

    if (
      !['recommended', 'approved', 'failed'].includes(node.action.status) &&
      node.action.status !== 'completed' &&
      node.action.status !== 'cancelled' &&
      node.action.status !== 'queued' &&
      node.action.status !== 'executing'
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_not_retryable',
          'target_child',
          `Carry child status "${node.action.status}" is not supported for bundle recovery.`,
          'Inspect the child action directly before requesting recovery.',
          {
            carryActionId: node.action.id,
            status: node.action.status,
          },
        ),
      );
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
      note:
        latestFailedExecution === null
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
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'bundle_not_actionable',
          'bundle_state',
          `Bundle status "${bundle.bundle.status}" does not permit recovery mutation requests.`,
          'Wait for the bundle to reach a failed, blocked, partial, or intervention-required state before requesting recovery.',
          {
            bundleStatus: bundle.bundle.status,
          },
        ),
      );
    }

    const runtimeStatus = await this.getRuntimeStatus();
    if (
      runtimeStatus.halted ||
      runtimeStatus.lifecycleState === 'paused' ||
      runtimeStatus.lifecycleState === 'stopped' ||
      runtimeStatus.lifecycleState === 'starting'
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'runtime_not_ready',
          'runtime',
          'Runtime is not in a state that permits child recovery execution.',
          'Return runtime to ready state before requesting bundle recovery.',
          {
            lifecycleState: runtimeStatus.lifecycleState,
            halted: runtimeStatus.halted,
          },
        ),
      );
    }

    if (
      node.executions.some((execution) => execution.status === 'completed') ||
      node.action.status === 'completed'
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_already_completed',
          'target_child',
          'Treasury child already completed successfully and should not be retried.',
          'Inspect the completed child execution history instead of requeueing it.',
          {
            treasuryActionId: node.action.id,
          },
        ),
      );
    }

    if (node.action.status === 'queued' || node.action.status === 'executing') {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_has_inflight_command',
          'target_child',
          'Treasury child is already queued or executing.',
          'Wait for the in-flight treasury child to settle before requesting another recovery action.',
          {
            treasuryActionId: node.action.id,
            status: node.action.status,
            linkedCommandId: node.action.linkedCommandId,
          },
        ),
      );
    }

    if (node.action.status === 'cancelled') {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_not_retryable',
          'target_child',
          'Cancelled treasury children are inspect-only in this pass.',
          'Create a new treasury or allocator evaluation if a replacement action is required.',
          {
            treasuryActionId: node.action.id,
          },
        ),
      );
    }

    if (
      !node.action.executable ||
      node.action.readiness === 'blocked' ||
      node.action.blockedReasons.length > 0
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_remains_blocked',
          'safety',
          'Treasury child remains operationally blocked and cannot be requeued safely.',
          'Resolve the treasury child blocked reasons before requesting recovery.',
          {
            treasuryActionId: node.action.id,
            blockedReasons: node.action.blockedReasons,
          },
        ),
      );
    }

    const latestFailedExecution =
      node.executions.find((execution) => execution.id === node.action.latestExecutionId) ??
      node.executions.find((execution) => execution.status === 'failed') ??
      null;
    const hasSideEffects = node.executions.some(
      (execution) => execution.venueExecutionReference !== null,
    );
    if (hasSideEffects) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'treasury_execution_side_effect_detected',
          'safety',
          'Treasury child shows venue-side execution evidence, so replaying it could duplicate external state changes.',
          'Inspect the treasury execution detail before requesting recovery.',
          {
            treasuryActionId: node.action.id,
            latestExecutionId: latestFailedExecution?.id ?? null,
          },
        ),
      );
    }

    if (
      !['recommended', 'approved', 'failed'].includes(node.action.status) &&
      node.action.status !== 'completed' &&
      node.action.status !== 'cancelled' &&
      node.action.status !== 'queued' &&
      node.action.status !== 'executing'
    ) {
      blockedReasons.push(
        this.buildBundleRecoveryBlockedReason(
          'target_child_not_retryable',
          'target_child',
          `Treasury child status "${node.action.status}" is not supported for bundle recovery.`,
          'Inspect the child action directly before requesting recovery.',
          {
            treasuryActionId: node.action.id,
            status: node.action.status,
          },
        ),
      );
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
      note:
        latestFailedExecution === null
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
    const latestExecution =
      node.executions.find((execution) => execution.id === node.action.latestExecutionId) ??
      node.executions.at(-1) ??
      null;
    const completed =
      node.action.status === 'completed' ||
      node.executions.some((execution) => execution.status === 'completed');
    const progressRecorded =
      completed ||
      node.executions.some((execution) => execution.venueExecutionReference !== null) ||
      stepRows.some(
        (row) =>
          row.executionReference !== null ||
          row.venueOrderId !== null ||
          !['pending', 'failed'].includes(row.status),
      );
    const retryability =
      recoveryCandidate?.eligibilityState === 'eligible'
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
      blockedBeforeApplication:
        !progressRecorded &&
        (!node.action.executable ||
          node.action.blockedReasons.length > 0 ||
          node.action.status === 'failed'),
      retryCandidateId: recoveryCandidate?.id ?? null,
      retryBlockedReasons: recoveryCandidate?.blockedReasons ?? [],
      evidence,
    };
  }

  private async buildTreasuryChildInspection(
    node: RebalanceTreasuryActionNodeView,
    recoveryCandidate: RebalanceBundleRecoveryCandidateView | undefined,
  ): Promise<RebalanceBundleChildInspectionView> {
    const latestExecution =
      node.executions.find((execution) => execution.id === node.action.latestExecutionId) ??
      node.executions.at(-1) ??
      null;
    const completed =
      node.action.status === 'completed' ||
      node.executions.some((execution) => execution.status === 'completed');
    const progressRecorded =
      completed || node.executions.some((execution) => execution.venueExecutionReference !== null);
    const retryability =
      recoveryCandidate?.eligibilityState === 'eligible'
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
    } else if (
      !node.action.executable ||
      node.action.readiness === 'blocked' ||
      node.action.blockedReasons.length > 0
    ) {
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
      blockedBeforeApplication:
        !progressRecorded &&
        (!node.action.executable ||
          node.action.readiness === 'blocked' ||
          node.action.blockedReasons.length > 0 ||
          node.action.status === 'failed'),
      retryCandidateId: recoveryCandidate?.id ?? null,
      retryBlockedReasons: recoveryCandidate?.blockedReasons ?? [],
      evidence,
    };
  }

  private async buildBundlePartialProgress(
    bundle: RebalanceBundleDetailView,
    recoveryCandidates: RebalanceBundleRecoveryCandidateView[],
  ): Promise<RebalanceBundlePartialProgressView> {
    const carryChildren = await Promise.all(
      bundle.graph.downstream.carry.actions.map(async (node) =>
        this.buildCarryChildInspection(
          node,
          recoveryCandidates.find(
            (candidate) =>
              candidate.targetChildType === 'carry_action' &&
              candidate.targetChildId === node.action.id,
          ),
        ),
      ),
    );
    const treasuryChildren = await Promise.all(
      bundle.graph.downstream.treasury.actions.map(async (node) =>
        this.buildTreasuryChildInspection(
          node,
          recoveryCandidates.find(
            (candidate) =>
              candidate.targetChildType === 'treasury_action' &&
              candidate.targetChildId === node.action.id,
          ),
        ),
      ),
    );
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
        nonRetryableChildren: items.filter((child) => child.retryability === 'non_retryable')
          .length,
        blockedBeforeApplicationChildren: items.filter((child) => child.blockedBeforeApplication)
          .length,
      };
    };

    return {
      totalChildren: children.length,
      appliedChildren: children.filter((child) => child.applied).length,
      progressRecordedChildren: children.filter((child) => child.progressRecorded).length,
      retryableChildren: children.filter((child) => child.retryability === 'retryable').length,
      nonRetryableChildren: children.filter((child) => child.retryability === 'non_retryable')
        .length,
      blockedBeforeApplicationChildren: children.filter((child) => child.blockedBeforeApplication)
        .length,
      inflightChildren: children.filter((child) => child.progressState === 'inflight').length,
      sleeves: [summariseSleeve('carry'), summariseSleeve('treasury')],
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
        blockedReasons.push(
          this.buildBundleResolutionBlockedReason(
            'bundle_not_actionable',
            'bundle_state',
            `Bundle status "${bundle.bundle.status}" does not permit manual resolution.`,
            'Only request manual resolution for failed, blocked, partial, or intervention-required bundles.',
            { bundleStatus: bundle.bundle.status },
          ),
        );
      }
      if (bundle.bundle.pendingChildCount > 0 || partialProgress.inflightChildren > 0) {
        blockedReasons.push(
          this.buildBundleResolutionBlockedReason(
            'bundle_has_inflight_children',
            'safety',
            'Bundle still has in-flight downstream children and cannot be manually closed yet.',
            'Wait for in-flight children to settle before recording manual resolution.',
            {
              pendingChildCount: bundle.bundle.pendingChildCount,
              inflightChildren: partialProgress.inflightChildren,
            },
          ),
        );
      }
      if (
        resolutionActionType === 'accept_partial_application' &&
        bundle.bundle.outcomeClassification !== 'partial_application'
      ) {
        blockedReasons.push(
          this.buildBundleResolutionBlockedReason(
            'bundle_not_partial_application',
            'bundle_state',
            'Accept-partial resolution is only available when the bundle outcome is partial application.',
            'Use manual resolution or escalation for fully failed or fully blocked bundles.',
            {
              outcomeClassification: bundle.bundle.outcomeClassification,
            },
          ),
        );
      }
      if (bundle.bundle.resolutionState === targetResolutionState) {
        blockedReasons.push(
          this.buildBundleResolutionBlockedReason(
            'resolution_state_already_current',
            'validation',
            `Bundle is already marked as ${targetResolutionState}.`,
            'Inspect the existing manual resolution history instead of repeating the same decision.',
            {
              resolutionState: bundle.bundle.resolutionState,
            },
          ),
        );
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
        blockedReasons.push(
          this.buildBundleEscalationBlockedReason(
            'bundle_not_escalated',
            'bundle_state',
            'Bundle is not currently in an escalated resolution state.',
            'Only use escalation workflow actions on bundles that are explicitly escalated.',
            { resolutionState: bundle.bundle.resolutionState },
          ),
        );
      }
      if (escalation === null) {
        blockedReasons.push(
          this.buildBundleEscalationBlockedReason(
            'escalation_not_found',
            'escalation_state',
            'No escalation record exists for this bundle yet.',
            'Escalate the bundle first or inspect the manual resolution history.',
          ),
        );
      } else {
        if (!escalation.isOpen) {
          blockedReasons.push(
            this.buildBundleEscalationBlockedReason(
              'escalation_already_resolved',
              'escalation_state',
              'This escalation is already resolved.',
              'Inspect the resolved escalation history instead of applying more workflow transitions.',
              { escalationStatus: escalation.status },
            ),
          );
        }
        if (
          (transitionType === 'acknowledge' ||
            transitionType === 'start_review' ||
            transitionType === 'close') &&
          escalation.ownerId === null
        ) {
          blockedReasons.push(
            this.buildBundleEscalationBlockedReason(
              'escalation_owner_required',
              'ownership',
              'Escalation must have an assigned owner before acknowledgement, review, or close.',
              'Assign the escalation to an operator before continuing.',
            ),
          );
        }
        if (transitionType === 'acknowledge' && escalation.status !== 'open') {
          blockedReasons.push(
            this.buildBundleEscalationBlockedReason(
              'invalid_status_transition',
              'escalation_state',
              `Escalation cannot be acknowledged from status "${escalation.status}".`,
              'Only acknowledge newly open escalations.',
              { escalationStatus: escalation.status },
            ),
          );
        }
        if (
          transitionType === 'start_review' &&
          !['open', 'acknowledged'].includes(escalation.status)
        ) {
          blockedReasons.push(
            this.buildBundleEscalationBlockedReason(
              'invalid_status_transition',
              'escalation_state',
              `Escalation cannot enter review from status "${escalation.status}".`,
              'Start review only after the escalation is open or acknowledged.',
              { escalationStatus: escalation.status },
            ),
          );
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
      .where(
        and(
          eq(allocatorRebalanceBundleEscalations.bundleId, bundleId),
          sql`${allocatorRebalanceBundleEscalations.status} <> 'resolved'`,
        ),
      )
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
      throw new Error(
        'RuntimeStore.recordRebalanceBundleEscalationEvent: escalation event was not persisted',
      );
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
      .where(
        and(
          eq(allocatorRebalanceBundleResolutionActions.bundleId, bundleId),
          eq(allocatorRebalanceBundleResolutionActions.id, resolutionActionId),
        ),
      )
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
      throw new Error(
        'RuntimeStore.createRebalanceBundleResolutionAction: resolution action was not persisted',
      );
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
      throw new Error(
        'RuntimeStore.createRebalanceBundleRecoveryAction: recovery action was not persisted',
      );
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
        ...(patch.targetChildStatus !== undefined
          ? { targetChildStatus: patch.targetChildStatus }
          : {}),
        ...(patch.targetChildSummary !== undefined
          ? { targetChildSummary: patch.targetChildSummary }
          : {}),
        ...(patch.eligibilityState !== undefined
          ? { eligibilityState: patch.eligibilityState }
          : {}),
        ...(patch.blockedReasons !== undefined
          ? { blockedReasons: patch.blockedReasons as unknown as Record<string, unknown>[] }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.linkedCommandId !== undefined ? { linkedCommandId: patch.linkedCommandId } : {}),
        ...(patch.targetCommandType !== undefined
          ? { targetCommandType: patch.targetCommandType }
          : {}),
        ...(patch.linkedCarryActionId !== undefined
          ? { linkedCarryActionId: patch.linkedCarryActionId }
          : {}),
        ...(patch.linkedTreasuryActionId !== undefined
          ? { linkedTreasuryActionId: patch.linkedTreasuryActionId }
          : {}),
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

  async getRebalanceExecutionGraph(
    proposalId: string,
  ): Promise<RebalanceExecutionGraphView | null> {
    const detail = await this.getRebalanceProposal(proposalId);
    if (detail === null) {
      return null;
    }

    const [
      allocatorDecision,
      carryActionRows,
      recoveryActionRows,
      resolutionActionRows,
      escalationRow,
      escalationEventRows,
    ] = await Promise.all([
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
      await Promise.all(
        carryActionRows.map(async (row): Promise<RebalanceCarryActionNodeView> => {
          const action = mapCarryActionRow(row);
          const executions = await this.listCarryExecutionsForAction(action.id);
          return { action, executions };
        }),
      )
    ).sort((left, right) => left.action.createdAt.localeCompare(right.action.createdAt));

    const commandIds = Array.from(
      new Set([
        ...(detail.proposal.linkedCommandId === null ? [] : [detail.proposal.linkedCommandId]),
        ...detail.executions.flatMap((execution) =>
          execution.commandId === null ? [] : [execution.commandId],
        ),
      ]),
    );
    const commands = (
      await Promise.all(commandIds.map(async (commandId) => this.getRuntimeCommand(commandId)))
    ).filter((command): command is RuntimeCommandView => command !== null);

    const carryRollup = summariseRebalanceDownstreamRollup({
      actionCount: carryNodes.length,
      executionCount: carryNodes.reduce((sum, node) => sum + node.executions.length, 0),
      blockedCount: carryNodes.filter(
        (node) => node.action.blockedReasons.length > 0 || !node.action.executable,
      ).length,
      failureCount: carryNodes.reduce(
        (sum, node) =>
          sum + node.executions.filter((execution) => execution.status === 'failed').length,
        0,
      ),
      completedCount: carryNodes.reduce(
        (sum, node) =>
          sum + node.executions.filter((execution) => execution.status === 'completed').length,
        0,
      ),
      simulated: carryNodes.some(
        (node) => node.action.simulated || node.executions.some((execution) => execution.simulated),
      ),
      live: carryNodes.some(
        (node) =>
          !node.action.simulated ||
          node.executions.some(
            (execution) => execution.executionMode === 'live' && !execution.simulated,
          ),
      ),
      references: carryNodes.flatMap((node) =>
        node.executions.flatMap((execution) =>
          execution.venueExecutionReference === null ? [] : [execution.venueExecutionReference],
        ),
      ),
    });

    const treasuryActionRows = await this.db
      .select()
      .from(treasuryActions)
      .where(eq(treasuryActions.linkedRebalanceProposalId, proposalId))
      .orderBy(desc(treasuryActions.createdAt));

    const treasuryNodes: RebalanceTreasuryActionNodeView[] = (
      await Promise.all(
        treasuryActionRows.map(async (row): Promise<RebalanceTreasuryActionNodeView> => {
          const action = mapTreasuryActionRow(row);
          const executions = await this.listTreasuryExecutionsForAction(action.id);
          return { action, executions };
        }),
      )
    ).sort((left, right) => left.action.createdAt.localeCompare(right.action.createdAt));
    const treasuryRollup = summariseRebalanceDownstreamRollup({
      actionCount: treasuryNodes.length,
      executionCount: treasuryNodes.reduce((sum, node) => sum + node.executions.length, 0),
      blockedCount: treasuryNodes.filter(
        (node) => node.action.blockedReasons.length > 0 || !node.action.executable,
      ).length,
      failureCount: treasuryNodes.reduce(
        (sum, node) =>
          sum + node.executions.filter((execution) => execution.status === 'failed').length,
        0,
      ),
      completedCount: treasuryNodes.reduce(
        (sum, node) =>
          sum + node.executions.filter((execution) => execution.status === 'completed').length,
        0,
      ),
      simulated: treasuryNodes.some(
        (node) => node.action.simulated || node.executions.some((execution) => execution.simulated),
      ),
      live: treasuryNodes.some(
        (node) =>
          !node.action.simulated ||
          node.executions.some(
            (execution) => execution.executionMode === 'live' && !execution.simulated,
          ),
      ),
      references: treasuryNodes.flatMap((node) =>
        node.executions.flatMap((execution) =>
          execution.venueExecutionReference === null ? [] : [execution.venueExecutionReference],
        ),
      ),
    });
    const recoveryActions = recoveryActionRows.map(mapRebalanceBundleRecoveryActionRow);
    const resolutionActions = resolutionActionRows.map(mapRebalanceBundleResolutionActionRow);
    const escalation =
      escalationRow === undefined ? null : mapRebalanceBundleEscalationRow(escalationRow);
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
            summary:
              treasuryNodes.length > 0
                ? treasuryRollup.summary
                : detail.currentState?.latestProposalId === detail.proposal.id
                  ? 'Treasury participation is represented by the applied approved budget state; no downstream treasury action records are persisted for this proposal.'
                  : 'No downstream treasury actions are persisted for this proposal.',
          },
          note:
            treasuryNodes.length > 0
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

  async persistVenueConnectorSnapshots(input: { snapshots: VenueSnapshotView[] }): Promise<void> {
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
        throw new Error(
          'RuntimeStore.persistInternalDerivativeSnapshots: internal derivative snapshot was not persisted',
        );
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
            strategyProfile:
              intent.strategyProfile ??
              buildCarryStrategyProfile({
                projectedApyPct: asDecimalLikeString(
                  intent.details['netYieldPct'] ?? intent.details['expectedAnnualYieldPct'],
                ),
              }),
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
          intent.plannedOrders.map((order) => {
            const marketIdentity =
              readCanonicalMarketIdentityFromMetadata(order.metadata, {
                venueId: order.venueId,
                asset: order.asset,
                marketType: order.metadata['instrumentType'],
                provenance: 'derived',
                capturedAtStage: 'carry_planned_order',
                source: 'carry_action_creation',
                notes: [
                  'Carry planned orders persist the best market identity already attached to the execution intent.',
                ],
              }) ??
              createCanonicalMarketIdentity({
                venueId: order.venueId,
                asset: order.asset,
                marketType: order.metadata['instrumentType'],
                provenance: 'derived',
                capturedAtStage: 'carry_planned_order',
                source: 'carry_action_creation',
                notes: [
                  'Carry planned orders derived market identity because upstream intent metadata did not carry richer venue-native identifiers.',
                ],
              });

            return {
              carryActionId: row.id,
              intentId: order.intentId,
              venueId: order.venueId,
              asset: order.asset,
              side: order.side,
              orderType: order.type,
              requestedSize: order.size,
              requestedPrice: order.limitPrice,
              reduceOnly: order.reduceOnly,
              metadata: attachCanonicalMarketIdentityToMetadata(order.metadata, marketIdentity),
              createdAt: order.createdAt,
            };
          }),
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
        ...(patch.blockedReasons !== undefined
          ? { blockedReasons: patch.blockedReasons as unknown as Record<string, unknown>[] }
          : {}),
        ...(patch.outcomeSummary !== undefined ? { outcomeSummary: patch.outcomeSummary } : {}),
        ...(patch.outcome !== undefined ? { outcome: patch.outcome } : {}),
        ...(patch.venueExecutionReference !== undefined
          ? { venueExecutionReference: patch.venueExecutionReference }
          : {}),
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
    const marketIdentity =
      readCanonicalMarketIdentityFromMetadata(input.metadata ?? {}, {
        venueId: input.venueId,
        asset: input.asset,
        marketType: input.metadata?.['instrumentType'],
        provenance: 'derived',
        capturedAtStage: 'carry_execution_step',
        source: 'carry_execution_step_creation',
        notes: [
          'Carry execution steps persist the best market identity already attached to the planned order or execution result.',
        ],
      }) ??
      createCanonicalMarketIdentity({
        venueId: input.venueId,
        asset: input.asset,
        marketType: input.metadata?.['instrumentType'],
        provenance: 'derived',
        capturedAtStage: 'carry_execution_step',
        source: 'carry_execution_step_creation',
        notes: [
          'Carry execution steps derived market identity because no richer upstream metadata was available.',
        ],
      });
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
        metadata: attachCanonicalMarketIdentityToMetadata(input.metadata ?? {}, marketIdentity),
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
        ...(patch.executionReference !== undefined
          ? { executionReference: patch.executionReference }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.simulated !== undefined ? { simulated: patch.simulated } : {}),
        ...(patch.filledSize !== undefined ? { filledSize: patch.filledSize } : {}),
        ...(patch.averageFillPrice !== undefined
          ? { averageFillPrice: patch.averageFillPrice }
          : {}),
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
      (input.venueCapabilities ?? []).map(
        (capability) => [capability.venueId, capability] as const,
      ),
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

    const [latestCommand, executionRows, venue, summary, policy, linkedRebalanceProposal] =
      await Promise.all([
        row.linkedCommandId === null
          ? Promise.resolve<RuntimeCommandView | null>(null)
          : this.getRuntimeCommand(row.linkedCommandId),
        this.db
          .select()
          .from(treasuryActionExecutions)
          .where(eq(treasuryActionExecutions.treasuryActionId, row.id))
          .orderBy(desc(treasuryActionExecutions.createdAt)),
        row.venueId === null
          ? Promise.resolve<TreasuryVenueView | null>(null)
          : this.getTreasuryVenueView(row.venueId),
        this.getTreasurySummary(),
        this.getTreasuryPolicy(),
        row.linkedRebalanceProposalId === null
          ? Promise.resolve<RebalanceProposalView | null>(null)
          : this.db
              .select()
              .from(allocatorRebalanceProposals)
              .where(eq(allocatorRebalanceProposals.id, row.linkedRebalanceProposalId))
              .limit(1)
              .then((proposalRows) =>
                proposalRows[0] === undefined ? null : mapRebalanceProposalRow(proposalRows[0]),
              ),
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

  async getTreasuryExecutionDetail(
    executionId: string,
  ): Promise<TreasuryExecutionDetailView | null> {
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
      executionKind:
        action?.actionType === 'rebalance_treasury_budget'
          ? 'budget_state_application'
          : 'venue_execution',
      venue:
        action?.venueId === null || action?.venueId === undefined
          ? null
          : await this.getTreasuryVenueView(action.venueId),
      timeline:
        actionDetail?.timeline.filter(
          (entry) => entry.linkedExecutionId === null || entry.linkedExecutionId === execution.id,
        ) ?? [],
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

    const venues = rows
      .map(mapTreasuryVenueRow)
      .sort((left, right) => left.venueName.localeCompare(right.venueName))
      .slice(0, limit);
    const inventory = await this.listVenueInventoryCore(500);
    const inventoryByVenueId = new Map(inventory.map((venue) => [venue.venueId, venue] as const));
    const promotionSummaryMap = await this.buildPromotionSummaryMap(inventory);

    return venues.map((venue) => {
      const inventoryView = inventoryByVenueId.get(venue.venueId);
      const promotion =
        inventoryView === undefined
          ? buildDefaultPromotionSummary(
              buildFallbackConnectorReadinessEvidence({
                venueId: venue.venueId,
                venueName: venue.venueName,
                connectorType: 'treasury_adapter',
                sleeveApplicability: ['treasury'],
                truthMode: venue.simulationState === 'simulated' ? 'simulated' : 'real',
                executionSupport: venue.executionSupported,
                readOnlySupport: venue.readOnly,
                healthy: venue.healthy,
                healthState: venue.healthy ? 'healthy' : 'degraded',
                degradedReason: venue.healthy ? null : 'treasury_venue_snapshot_reported_unhealthy',
                lastSnapshotAt: venue.lastSnapshotAt,
                missingPrerequisites: venue.missingPrerequisites,
              }),
            )
          : (promotionSummaryMap.get(venue.venueId) ??
            buildDefaultPromotionSummary(buildConnectorReadinessEvidence(inventoryView)));

      return {
        ...venue,
        approvedForLiveUse: promotion.approvedForLiveUse,
        promotion,
      };
    });
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
        .where(
          sql`${treasuryActionExecutions.treasuryActionId} IN (
          SELECT ${treasuryActions.id}
          FROM ${treasuryActions}
          WHERE ${treasuryActions.venueId} = ${venueId}
        )`,
        )
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
      .where(
        and(
          eq(treasuryVenueSnapshots.treasuryRunId, latestRun.treasuryRunId),
          eq(treasuryVenueSnapshots.venueId, venueId),
        ),
      )
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const venue = mapTreasuryVenueRow(row);
    const inventory = await this.listVenueInventoryCore(500);
    const inventoryView = inventory.find((item) => item.venueId === venueId);
    const promotion =
      inventoryView === undefined
        ? buildDefaultPromotionSummary(
            buildFallbackConnectorReadinessEvidence({
              venueId: venue.venueId,
              venueName: venue.venueName,
              connectorType: 'treasury_adapter',
              sleeveApplicability: ['treasury'],
              truthMode: venue.simulationState === 'simulated' ? 'simulated' : 'real',
              executionSupport: venue.executionSupported,
              readOnlySupport: venue.readOnly,
              healthy: venue.healthy,
              healthState: venue.healthy ? 'healthy' : 'degraded',
              degradedReason: venue.healthy ? null : 'treasury_venue_snapshot_reported_unhealthy',
              lastSnapshotAt: venue.lastSnapshotAt,
              missingPrerequisites: venue.missingPrerequisites,
            }),
          )
        : ((await this.buildPromotionSummaryMap([inventoryView])).get(venueId) ??
          buildDefaultPromotionSummary(buildConnectorReadinessEvidence(inventoryView)));

    return {
      ...venue,
      approvedForLiveUse: promotion.approvedForLiveUse,
      promotion,
    };
  }

  async approveTreasuryAction(
    actionId: string,
    actorId: string,
  ): Promise<TreasuryActionView | null> {
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
    const [row] = await this.db.select().from(portfolioCurrent).limit(1);

    return row ?? null;
  }

  async getRiskCurrentRow(): Promise<typeof riskCurrent.$inferSelect | null> {
    const [row] = await this.db.select().from(riskCurrent).limit(1);

    return row ?? null;
  }

  // =============================================================================
  // Realized APY Tracking Methods
  // =============================================================================

  async persistRealizedTradePnl(
    trade: {
      tradeId: string;
      positionId?: string;
      sleeveId: string;
      venueId: string;
      asset: string;
      side: 'long' | 'short';
      instrumentType: 'spot' | 'perpetual';
      entryPrice: string;
      exitPrice: string;
      size: string;
      notionalUsd: string;
      grossPnl: string;
      fundingPnl: string;
      feeCost: string;
      netPnl: string;
      holdingPeriodDays: string;
      openedAt: Date;
      closedAt: Date;
      executionReference?: string;
      confirmed: boolean;
      confirmedAt?: Date;
    },
  ): Promise<void> {
    await this.db.insert(realizedTradePnl).values({
      tradeId: trade.tradeId,
      positionId: trade.positionId ?? null,
      sleeveId: trade.sleeveId,
      venueId: trade.venueId,
      asset: trade.asset,
      side: trade.side,
      instrumentType: trade.instrumentType,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      size: trade.size,
      notionalUsd: trade.notionalUsd,
      grossPnl: trade.grossPnl,
      fundingPnl: trade.fundingPnl,
      feeCost: trade.feeCost,
      netPnl: trade.netPnl,
      holdingPeriodDays: trade.holdingPeriodDays,
      openedAt: trade.openedAt,
      closedAt: trade.closedAt,
      executionReference: trade.executionReference ?? null,
      confirmed: trade.confirmed,
      confirmedAt: trade.confirmedAt ?? null,
      metadata: {},
    });

    // Update APY current after persisting trade
    await this.updateApyCurrent(trade.sleeveId, 'apex-usdc-delta-neutral-carry');
  }

  async updateApyCurrent(sleeveId: string, strategyId: string): Promise<void> {
    // Fetch all confirmed trades for this sleeve
    const trades = await this.db
      .select()
      .from(realizedTradePnl)
      .where(and(
        eq(realizedTradePnl.sleeveId, sleeveId),
        eq(realizedTradePnl.confirmed, true),
      ))
      .orderBy(asc(realizedTradePnl.closedAt));

    if (trades.length === 0) {
      // No trades yet - ensure we have an APY current record with insufficient_data
      const existing = await this.db
        .select()
        .from(apyCurrent)
        .where(eq(apyCurrent.sleeveId, sleeveId))
        .then((rows) => rows[0] ?? null);

      if (existing === null) {
        await this.db.insert(apyCurrent).values({
          id: sleeveId,
          sleeveId,
          strategyId,
          targetApyPct: '10.00',
          calculationBasis: 'insufficient_data',
        });
      }
      return;
    }

    // Calculate metrics
    const totalPnl = trades.reduce((sum, t) => sum['plus'](new Decimal(t['netPnl'] as string)), new Decimal(0));
    const totalFundingPnl = trades.reduce((sum, t) => sum['plus'](new Decimal(t['fundingPnl'] as string)), new Decimal(0));
    const totalFees = trades.reduce((sum, t) => sum['plus'](new Decimal(t['feeCost'] as string)), new Decimal(0));
    
    const winningTrades = trades.filter(t => new Decimal(t['netPnl'] as string).gt(0));
    const winRate = new Decimal(winningTrades.length).div(trades.length).times(100);
    const avgPnl = totalPnl['div'](trades.length);

    // Get capital estimate from portfolio
    const portfolioRow = await this.getPortfolioCurrentRow();
    const totalCapitalUsd = portfolioRow?.totalNav ?? '100000';

    // Calculate APYs
    const firstTrade = trades[0];
    const lastTrade = trades[trades.length - 1];
    const now = new Date();
    
    if (firstTrade === undefined || lastTrade === undefined) {
      return;
    }
    
    const days = Math.max(
      (lastTrade['closedAt'].getTime() - firstTrade['openedAt'].getTime()) / (1_000 * 60 * 60 * 24),
      1,
    );

    const lifetimeApy = totalPnl['div'](totalCapitalUsd).times(365 / days).times(100)['toFixed'](4);

    // Calculate 7d and 30d rolling APYs
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trades7d = trades.filter(t => t['closedAt'] >= sevenDaysAgo);
    const trades30d = trades.filter(t => t['closedAt'] >= thirtyDaysAgo);

    const pnl7d = trades7d.reduce((sum, t) => sum['plus'](new Decimal(t['netPnl'] as string)), new Decimal(0));
    const pnl30d = trades30d.reduce((sum, t) => sum['plus'](new Decimal(t['netPnl'] as string)), new Decimal(0));

    const apy7d = trades7d.length > 0
      ? pnl7d['div'](totalCapitalUsd).times(365 / 7).times(100)['toFixed'](4)
      : null;
    const apy30d = trades30d.length > 0
      ? pnl30d['div'](totalCapitalUsd).times(365 / 30).times(100)['toFixed'](4)
      : null;

    // Determine target status
    const targetApy = new Decimal('10.00');
    const currentApy = apy30d ?? apy7d ?? lifetimeApy;
    const targetMet = new Decimal(currentApy).gte(targetApy);
    const targetGap = new Decimal(currentApy).minus(targetApy)['toFixed'](4);

    // Upsert APY current
    const existing = await this.db
      .select()
      .from(apyCurrent)
      .where(eq(apyCurrent.sleeveId, sleeveId))
      .then((rows) => rows[0] ?? null);

    if (existing !== null) {
      await this.db
        .update(apyCurrent)
        .set({
          realizedApy7d: apy7d,
          realizedApy30d: apy30d,
          realizedApyLifetime: lifetimeApy,
          targetApyPct: '10.00',
          projectedApyPct: currentApy,
          targetMet,
          targetGapPct: targetGap,
          totalTradesClosed: trades.length,
          totalPnlUsd: totalPnl['toFixed'](),
          totalFundingPnlUsd: totalFundingPnl['toFixed'](),
          totalFeesUsd: totalFees['toFixed'](),
          avgTradePnlUsd: avgPnl['toFixed'](),
          winRatePct: winRate['toFixed'](2),
          firstTradeAt: firstTrade['openedAt'],
          calculationBasis: 'live_trades',
          updatedAt: now,
        })
        .where(eq(apyCurrent.sleeveId, sleeveId));
    } else {
      await this.db.insert(apyCurrent).values({
        id: sleeveId,
        sleeveId,
        strategyId,
        realizedApy7d: apy7d,
        realizedApy30d: apy30d,
        realizedApyLifetime: lifetimeApy,
        targetApyPct: '10.00',
        projectedApyPct: currentApy,
        targetMet,
        targetGapPct: targetGap,
        totalTradesClosed: trades.length,
        totalPnlUsd: totalPnl['toFixed'](),
        totalFundingPnlUsd: totalFundingPnl['toFixed'](),
        totalFeesUsd: totalFees['toFixed'](),
        avgTradePnlUsd: avgPnl['toFixed'](),
        winRatePct: winRate['toFixed'](2),
        firstTradeAt: firstTrade['openedAt'],
        calculationBasis: 'live_trades',
      });
    }
  }

  async getApyCurrent(sleeveId: string): Promise<typeof apyCurrent.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(apyCurrent)
      .where(eq(apyCurrent.sleeveId, sleeveId))
      .limit(1);

    return row ?? null;
  }

  async getRealizedTrades(sleeveId: string, limit = 100): Promise<typeof realizedTradePnl.$inferSelect[]> {
    return this.db
      .select()
      .from(realizedTradePnl)
      .where(eq(realizedTradePnl.sleeveId, sleeveId))
      .orderBy(desc(realizedTradePnl.closedAt))
      .limit(limit);
  }

  // =============================================================================
  // CEX Verification Methods (Phase R3 Part 6)
  // =============================================================================

  async listCexVerificationSessions(sleeveId?: string): Promise<Array<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    totalVolumeUsd: string | null;
    realizedPnl: string | null;
    calculatedApy: string | null;
    createdAt: string;
    validatedAt: string | null;
  }>> {
    const query = sleeveId 
      ? eq(cexTradeImports.sleeveId, sleeveId)
      : undefined;
    
    const rows = await this.db
      .select({
        id: cexTradeImports.id,
        sleeveId: cexTradeImports.sleeveId,
        platform: cexTradeImports.platform,
        status: cexTradeImports.status,
        totalTrades: cexTradeImports.validTradesCount,
        totalVolumeUsd: cexTradeImports.totalVolumeUsd,
        realizedPnl: cexTradeImports.realizedPnlUsd,
        createdAt: cexTradeImports.createdAt,
        completedAt: cexTradeImports.completedAt,
      })
      .from(cexTradeImports)
      .where(query ? query : sql`true`)
      .orderBy(desc(cexTradeImports.createdAt));
    
    return rows.map(row => ({
      id: row.id,
      sleeveId: row.sleeveId,
      platform: row.platform,
      status: row.status,
      totalTrades: row.totalTrades ?? 0,
      totalVolumeUsd: row.totalVolumeUsd,
      realizedPnl: row.realizedPnl,
      calculatedApy: null, // Would come from APY calculations
      createdAt: row.createdAt.toISOString(),
      validatedAt: row.completedAt?.toISOString() ?? null,
    }));
  }

  async getCexVerificationSession(sessionId: string): Promise<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    totalVolumeUsd: string | null;
    realizedPnl: string | null;
    calculatedApy: string | null;
    fileHash: string | null;
    createdAt: string;
    validatedAt: string | null;
    trades: Array<{
      id: string;
      tradeId: string;
      asset: string;
      side: string;
      quantity: string;
      price: string;
      fee: string | null;
      realizedPnl: string | null;
      tradeTime: string;
    }>;
  } | null> {
    // Get the import session
    const [session] = await this.db
      .select()
      .from(cexTradeImports)
      .where(eq(cexTradeImports.id, sessionId))
      .limit(1);
    
    if (!session) {
      return null;
    }
    
    // Get the trades
    const trades = await this.db
      .select({
        id: cexImportedTrades.id,
        tradeId: cexImportedTrades.tradeId,
        asset: cexImportedTrades.asset,
        side: cexImportedTrades.side,
        quantity: cexImportedTrades.quantity,
        price: cexImportedTrades.price,
        fee: cexImportedTrades.fee,
        realizedPnl: cexImportedTrades.realizedPnl,
        tradeTime: cexImportedTrades.tradeTime,
      })
      .from(cexImportedTrades)
      .where(eq(cexImportedTrades.importId, sessionId))
      .orderBy(desc(cexImportedTrades.tradeTime));
    
    return {
      id: session.id,
      sleeveId: session.sleeveId,
      platform: session.platform,
      status: session.status,
      totalTrades: session.validTradesCount ?? 0,
      totalVolumeUsd: session.totalVolumeUsd,
      realizedPnl: session.realizedPnlUsd,
      calculatedApy: null,
      fileHash: session.fileHash,
      createdAt: session.createdAt.toISOString(),
      validatedAt: session.completedAt?.toISOString() ?? null,
      trades: trades.map(t => ({
        id: t.id,
        tradeId: t.tradeId,
        asset: t.asset,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        fee: t.fee,
        realizedPnl: t.realizedPnl,
        tradeTime: t.tradeTime.toISOString(),
      })),
    };
  }

  async createCexVerificationSession(input: {
    operatorId: string;
    sleeveId: string;
    platform: 'binance' | 'okx' | 'bybit' | 'coinbase' | undefined;
    csvContent: string;
    fileName: string;
  }): Promise<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    // Import the cex-verification package functions
    const { parseCexCsv, detectPlatform } = await import('@sentinel-apex/cex-verification');
    
    // Auto-detect platform if not specified
    const detectedPlatform = detectPlatform(input.csvContent);
    const platform = input.platform ?? detectedPlatform ?? 'binance';
    
    // Parse the CSV
    const parseResult = parseCexCsv(input.csvContent, { platform: platform as 'binance' | 'okx' | 'bybit' | 'coinbase' });
    
    // Generate session ID
    const sessionId = createId();
    
    // Calculate file hash
    const fileHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.csvContent))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
    
    const now = new Date();
    
    // Insert the import record
    await this.db.insert(cexTradeImports).values({
      id: sessionId,
      sleeveId: input.sleeveId,
      strategyId: 'carry', // Default strategy
      platform,
      importType: 'csv',
      originalFilename: input.fileName,
      fileHash,
      fileSizeBytes: input.csvContent.length,
      status: parseResult.errors.length > 0 ? 'failed' : 'completed',
      statusMessage: parseResult.errors.length > 0 ? `Parsed with ${parseResult.errors.length} errors` : 'Successfully parsed',
      validationPassed: parseResult.errors.length === 0,
      validationErrors: parseResult.errors.map(e => e.message),
      totalRowsParsed: parseResult.trades.length + parseResult.errors.length,
      validTradesCount: parseResult.trades.length,
      invalidTradesCount: parseResult.errors.length,
      totalVolumeUsd: parseResult.trades.reduce((sum, t) => sum + (parseFloat(t.quoteQuantity ?? '0') || parseFloat(t.quantity) * parseFloat(t.price)), 0).toString(),
      firstTradeAt: parseResult.trades.length > 0 ? new Date(Math.min(...parseResult.trades.map(t => t.tradeTime.getTime()))) : null,
      lastTradeAt: parseResult.trades.length > 0 ? new Date(Math.max(...parseResult.trades.map(t => t.tradeTime.getTime()))) : null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      createdBy: input.operatorId,
      metadata: {
        source: 'csv_upload',
        parseVersion: '1.0',
      },
    });
    
    // Insert the trades
    if (parseResult.trades.length > 0) {
      await this.db.insert(cexImportedTrades).values(
        parseResult.trades.map(t => ({
          id: createId(),
          importId: sessionId,
          tradeId: t.tradeId,
          orderId: t.orderId ?? null,
          platform,
          symbol: t.symbol,
          asset: t.asset,
          quoteAsset: t.quoteAsset ?? null,
          side: t.side,
          type: t.type ?? null,
          quantity: t.quantity,
          price: t.price,
          quoteQuantity: t.quoteQuantity ?? null,
          fee: t.fee ?? null,
          feeAsset: t.feeAsset ?? null,
          tradeTime: t.tradeTime,
          isValid: true,
          rawData: t.raw as Record<string, unknown>,
          createdAt: now,
        }))
      );
    }
    
    return {
      id: sessionId,
      sleeveId: input.sleeveId,
      platform,
      status: parseResult.errors.length > 0 ? 'pending_review' : 'completed',
      totalTrades: parseResult.trades.length,
      errors: parseResult.errors.map((e: { row: number; message: string }) => ({ row: e.row, message: e.message })),
    };
  }

  async validateCexCsv(input: {
    csvContent: string;
    platform: 'binance' | 'okx' | 'bybit' | 'coinbase' | undefined;
  }): Promise<{
    valid: boolean;
    detectedPlatform: string | undefined;
    errors: Array<{ row: number; message: string }>;
    preview: Array<{
      tradeId: string;
      symbol: string;
      side: string;
      quantity: string;
      price: string;
      tradeTime: string;
    }> | undefined;
  }> {
    const { parseCexCsv, detectPlatform, validateCsvFormat } = await import('@sentinel-apex/cex-verification');
    
    // Detect platform
    const detectedPlatform = detectPlatform(input.csvContent);
    const platform = input.platform ?? detectedPlatform ?? 'binance';
    
    // Validate format
    const validation = validateCsvFormat(input.csvContent, platform as 'binance' | 'okx' | 'bybit' | 'coinbase');
    
    if (!validation.valid) {
      return {
        valid: false,
        detectedPlatform: detectedPlatform ?? undefined,
        errors: [{ row: 0, message: validation.error ?? 'Invalid CSV format' }],
        preview: undefined,
      };
    }
    
    // Parse for preview
    const parseResult = parseCexCsv(input.csvContent, { platform: platform as 'binance' | 'okx' | 'bybit' | 'coinbase' });
    
    return {
      valid: parseResult.errors.length === 0,
      detectedPlatform: detectedPlatform ?? undefined,
      errors: parseResult.errors.map((e: { row: number; message: string }) => ({ row: e.row, message: e.message })),
      preview: parseResult.trades.slice(0, 5).map((t: { tradeId: string; symbol: string; side: string; quantity: string; price: string; tradeTime: Date }) => ({
        tradeId: t.tradeId,
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        price: t.price,
        tradeTime: t.tradeTime.toISOString(),
      })),
    };
  }

  async calculateCexPnl(sessionId: string, input: {
    method: 'fifo' | 'lifo' | 'avg';
    includeFees: boolean;
  }): Promise<{
    summary: {
      totalTrades: number;
      totalPnl: string;
      totalFees: string;
      netPnl: string;
      profitableTrades: number;
      losingTrades: number;
      winRate: string;
      largestWin: string;
      largestLoss: string;
      averageWin: string;
      averageLoss: string;
      profitFactor: string;
      tradingDays: number;
      firstTradeAt: string | null;
      lastTradeAt: string | null;
    };
    assets: Array<{
      asset: string;
      trades: Array<{
        tradeId: string;
        side: 'buy' | 'sell';
        quantity: string;
        price: string;
        realizedPnl: string;
      }>;
      summary: {
        totalTrades: number;
        realizedPnl: string;
        totalFees: string;
        winningTrades: number;
        losingTrades: number;
        winRate: string;
        largestWin: string;
        largestLoss: string;
      };
    }>;
  }> {
    const { calculateAssetPnl } = await import('@sentinel-apex/cex-verification');
    
    // Fetch trades from database
    const trades = await this.db
      .select()
      .from(cexImportedTrades)
      .where(eq(cexImportedTrades.importId, sessionId))
      .orderBy(asc(cexImportedTrades.tradeTime));
    
    if (trades.length === 0) {
      return {
        summary: {
          totalTrades: 0,
          totalPnl: '0',
          totalFees: '0',
          netPnl: '0',
          profitableTrades: 0,
          losingTrades: 0,
          winRate: '0',
          largestWin: '0',
          largestLoss: '0',
          averageWin: '0',
          averageLoss: '0',
          profitFactor: '0',
          tradingDays: 0,
          firstTradeAt: null,
          lastTradeAt: null,
        },
        assets: [],
      };
    }
    
    // Group trades by asset
    const tradesByAsset = new Map<string, typeof trades>();
    for (const trade of trades) {
      const existing = tradesByAsset.get(trade.asset) ?? [];
      existing.push(trade);
      tradesByAsset.set(trade.asset, existing);
    }
    
    // Calculate PnL for each asset using calculateAssetPnl
    type ParsedTradeInput = {
      asset: string;
      side: 'buy' | 'sell';
      quantity: string;
      price: string;
      fee: string | undefined;
      feeAsset: string | undefined;
      tradeTime: Date;
      tradeId: string;
      orderId: string | undefined;
      symbol: string;
      quoteAsset: string | undefined;
      type: string | undefined;
      quoteQuantity: string | undefined;
      realizedPnl: string | undefined;
      raw: Record<string, string>;
    };
    
    type AssetResult = {
      asset: string;
      summary: {
        totalTrades: number;
        realizedPnl: string;
        totalFees: string;
        winningTrades: number;
        losingTrades: number;
        winRate: string;
        largestWin: string;
        largestLoss: string;
      };
      trades: Array<{
        tradeId: string;
        side: 'buy' | 'sell';
        quantity: string;
        price: string;
        realizedPnl: string;
      }>;
    };
    
    const assetResults: AssetResult[] = [];
    
    for (const [asset, assetTrades] of tradesByAsset) {
      const parsedTrades: ParsedTradeInput[] = assetTrades.map(t => ({
        asset: t.asset,
        side: t.side as 'buy' | 'sell',
        quantity: t.quantity,
        price: t.price,
        fee: t.fee ?? undefined,
        feeAsset: t.feeAsset ?? undefined,
        tradeTime: t.tradeTime,
        tradeId: t.tradeId,
        orderId: t.orderId ?? undefined,
        symbol: t.symbol,
        quoteAsset: t.quoteAsset ?? undefined,
        type: t.type ?? undefined,
        quoteQuantity: t.quoteQuantity ?? undefined,
        realizedPnl: t.realizedPnl ?? undefined,
        raw: {},
      }));
      
      const result = calculateAssetPnl(parsedTrades, {
        method: input.method,
        includeFees: input.includeFees,
      });
      
      assetResults.push({
        asset,
        summary: {
          totalTrades: result.summary.totalTrades,
          realizedPnl: result.summary.realizedPnl,
          totalFees: result.summary.totalFees,
          winningTrades: result.summary.winningTrades,
          losingTrades: result.summary.losingTrades,
          winRate: result.summary.winRatePct,
          largestWin: result.summary.largestWin,
          largestLoss: result.summary.largestLoss,
        },
        trades: result.trades.map(t => ({
          tradeId: t.tradeId,
          side: t.side,
          quantity: t.quantity.toString(),
          price: t.price.toString(),
          realizedPnl: (t.realizedPnl ?? 0).toString(),
        })),
      });
    }
    
    // Aggregate summary
    const totalTrades = trades.length;
    const totalPnl = assetResults.reduce((sum, a) => sum + parseFloat(a.summary.realizedPnl), 0);
    const totalFees = assetResults.reduce((sum, a) => sum + parseFloat(a.summary.totalFees), 0);
    const winningTrades = assetResults.reduce((sum, a) => sum + a.summary.winningTrades, 0);
    const losingTrades = assetResults.reduce((sum, a) => sum + a.summary.losingTrades, 0);
    
    const firstTradeAt = trades[0]?.tradeTime ?? null;
    const lastTradeAt = trades[trades.length - 1]?.tradeTime ?? null;
    const tradingDays = firstTradeAt && lastTradeAt
      ? Math.max(1, Math.ceil((lastTradeAt.getTime() - firstTradeAt.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;
    
    // Calculate win rate
    const closedTrades = winningTrades + losingTrades;
    const winRate = closedTrades > 0 ? ((winningTrades / closedTrades) * 100).toFixed(2) : '0';
    
    return {
      summary: {
        totalTrades,
        totalPnl: totalPnl.toString(),
        totalFees: totalFees.toString(),
        netPnl: totalPnl.toString(),
        profitableTrades: winningTrades,
        losingTrades,
        winRate,
        largestWin: assetResults.length > 0 ? Math.max(...assetResults.map(a => parseFloat(a.summary.largestWin))).toString() : '0',
        largestLoss: assetResults.length > 0 ? Math.min(...assetResults.map(a => parseFloat(a.summary.largestLoss))).toString() : '0',
        averageWin: assetResults.length > 0 ? (assetResults.reduce((sum, a) => sum + (a.summary.winningTrades > 0 ? parseFloat(a.summary.largestWin) : 0), 0) / assetResults.length).toString() : '0',
        averageLoss: assetResults.length > 0 ? (assetResults.reduce((sum, a) => sum + (a.summary.losingTrades > 0 ? parseFloat(a.summary.largestLoss) : 0), 0) / assetResults.length).toString() : '0',
        profitFactor: '0', // Would need more detailed calculation
        tradingDays,
        firstTradeAt: firstTradeAt?.toISOString() ?? null,
        lastTradeAt: lastTradeAt?.toISOString() ?? null,
      },
      assets: assetResults,
    };
  }

  async generateCexSubmissionReport(sessionId: string, input: {
    method: 'fifo' | 'lifo' | 'avg';
    includeFees: boolean;
  }): Promise<{
    sessionId: string;
    generatedAt: string;
    portfolioSummary: {
      totalTrades: number;
      totalPnl: string;
      totalFees: string;
      winRate: string;
      profitableAssets: number;
      losingAssets: number;
    };
    assetReports: Array<{
      asset: string;
      totalTrades: number;
      realizedPnl: string;
      winRate: string;
    }>;
    hackathonEligibility: {
      hasSufficientTrades: boolean;
      hasPositivePnl: boolean;
      meetsMinimumPeriod: boolean;
    };
  }> {
    // Calculate PnL first
    const pnlResult = await this.calculateCexPnl(sessionId, input);
    
    const totalPnl = parseFloat(pnlResult.summary.netPnl);
    const totalTrades = pnlResult.summary.totalTrades;
    const profitableAssets = pnlResult.assets.filter((a: typeof pnlResult.assets[0]) => parseFloat(a.summary.realizedPnl) > 0).length;
    const losingAssets = pnlResult.assets.filter((a: typeof pnlResult.assets[0]) => parseFloat(a.summary.realizedPnl) < 0).length;
    
    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      portfolioSummary: {
        totalTrades,
        totalPnl: pnlResult.summary.totalPnl,
        totalFees: pnlResult.summary.totalFees,
        winRate: pnlResult.summary.winRate,
        profitableAssets,
        losingAssets,
      },
      assetReports: pnlResult.assets.map((a: typeof pnlResult.assets[0]) => ({
        asset: a.asset,
        totalTrades: a.summary.totalTrades,
        realizedPnl: a.summary.realizedPnl,
        winRate: a.summary.winRate,
      })),
      hackathonEligibility: {
        hasSufficientTrades: totalTrades >= 10,
        hasPositivePnl: totalPnl > 0,
        meetsMinimumPeriod: pnlResult.summary.tradingDays >= 7, // Relaxed for hackathon
      },
    };
  }

  async updateCexVerificationStatus(sessionId: string, input: {
    operatorId: string;
    status: 'validated' | 'rejected';
    notes: string | undefined;
  }): Promise<{ id: string; status: string; validatedAt: string | null }> {
    const now = new Date();
    
    await this.db
      .update(cexTradeImports)
      .set({
        status: input.status === 'validated' ? 'completed' : 'rejected',
        statusMessage: input.notes ?? null,
        updatedAt: now,
        completedAt: input.status === 'validated' ? now : null,
      })
      .where(eq(cexTradeImports.id, sessionId));
    
    return {
      id: sessionId,
      status: input.status,
      validatedAt: input.status === 'validated' ? now.toISOString() : null,
    };
  }

  async deleteCexVerificationSession(sessionId: string): Promise<void> {
    // Delete trades first (foreign key constraint)
    await this.db
      .delete(cexImportedTrades)
      .where(eq(cexImportedTrades.importId, sessionId));
    
    // Delete the import record
    await this.db
      .delete(cexTradeImports)
      .where(eq(cexTradeImports.id, sessionId));
  }

  // =============================================================================
  // CEX API Verification Methods (New in Part 6)
  // =============================================================================

  async validateCexApiCredentials(input: {
    platform: 'binance' | 'okx' | 'bybit' | 'coinbase';
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }): Promise<{
    valid: boolean;
    canReadTrades: boolean;
    canReadBalances: boolean;
    isReadOnly: boolean;
    accountId: string | null;
    error: string | null;
  }> {
    // For now, implement OKX validation as the primary exchange
    if (input.platform === 'okx') {
      try {
        const { OkxApiClient } = await import('./exchanges/okx-client.js');
        const client = new OkxApiClient({
          apiKey: input.apiKey,
          apiSecret: input.apiSecret,
          passphrase: input.passphrase ?? '',
        });
        
        const validation = await client.validateCredentials();
        return validation;
      } catch (error) {
        return {
          valid: false,
          canReadTrades: false,
          canReadBalances: false,
          isReadOnly: false,
          accountId: null,
          error: error instanceof Error ? error.message : 'Unknown error validating OKX credentials',
        };
      }
    }
    
    // Other exchanges not yet implemented
    return {
      valid: false,
      canReadTrades: false,
      canReadBalances: false,
      isReadOnly: false,
      accountId: null,
      error: `${input.platform} API verification not yet implemented. Use CSV import instead.`,
    };
  }

  async fetchCexTradesFromApi(input: {
    operatorId: string;
    sleeveId: string;
    platform: 'binance' | 'okx' | 'bybit' | 'coinbase';
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<{
    sessionId: string;
    totalTrades: number;
    fetchedAt: string;
    errors: string[];
  }> {
    // Only OKX is fully implemented
    if (input.platform !== 'okx') {
      throw new Error(`${input.platform} API trade fetching not yet implemented. Use CSV import instead.`);
    }
    
    const { OkxApiClient } = await import('./exchanges/okx-client.js');
    const client = new OkxApiClient({
      apiKey: input.apiKey,
      apiSecret: input.apiSecret,
      passphrase: input.passphrase ?? '',
    });
    
    // Fetch trades from OKX
    const fetchOptions: { startTime?: Date; endTime?: Date } = {};
    if (input.startTime) fetchOptions.startTime = input.startTime;
    if (input.endTime) fetchOptions.endTime = input.endTime;
    const trades = await client.fetchTradeHistory(fetchOptions);
    
    // Create import session
    const sessionId = createId();
    const now = new Date();
    
    await this.db.insert(cexTradeImports).values({
      id: sessionId,
      sleeveId: input.sleeveId,
      strategyId: 'carry',
      platform: input.platform,
      importType: 'api',
      status: trades.length > 0 ? 'completed' : 'completed',
      statusMessage: `Fetched ${trades.length} trades from OKX API`,
      validationPassed: true,
      totalRowsParsed: trades.length,
      validTradesCount: trades.length,
      invalidTradesCount: 0,
      totalVolumeUsd: trades.reduce((sum, t) => sum + (parseFloat(t.quoteQuantity ?? '0') || parseFloat(t.quantity) * parseFloat(t.price)), 0).toString(),
      firstTradeAt: trades.length > 0 ? new Date(Math.min(...trades.map(t => t.tradeTime.getTime()))) : null,
      lastTradeAt: trades.length > 0 ? new Date(Math.max(...trades.map(t => t.tradeTime.getTime()))) : null,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      createdBy: input.operatorId,
      metadata: {
        source: 'api',
        exchange: input.platform,
        fetchedAt: now.toISOString(),
        apiKeyHint: `${input.apiKey.slice(0, 4)}...${input.apiKey.slice(-4)}`,
      },
    });
    
    // Insert trades
    if (trades.length > 0) {
      await this.db.insert(cexImportedTrades).values(
        trades.map(t => ({
          id: createId(),
          importId: sessionId,
          tradeId: t.tradeId,
          orderId: t.orderId,
          platform: input.platform,
          symbol: t.symbol,
          asset: t.asset,
          quoteAsset: t.quoteAsset ?? null,
          side: t.side,
          type: t.type ?? null,
          quantity: t.quantity,
          price: t.price,
          quoteQuantity: t.quoteQuantity ?? null,
          fee: t.fee ?? null,
          feeAsset: t.feeAsset ?? null,
          tradeTime: t.tradeTime,
          isValid: true,
          rawData: t.rawData,
          createdAt: now,
        }))
      );
    }
    
    return {
      sessionId,
      totalTrades: trades.length,
      fetchedAt: now.toISOString(),
      errors: [],
    };
  }

  // ============================================================================
  // Multi-Leg Orchestration Methods (Phase R3)
  // ============================================================================

  async createMultiLegPlan(input: {
    carryActionId: string;
    strategyRunId: string | null;
    asset: string;
    notionalUsd: string;
    legCount: number;
    coordinationConfig: Record<string, unknown>;
    executionOrder: number[];
    requestedBy: string;
  }): Promise<{ id: string; createdAt: Date }> {
    const id = createId();
    const now = new Date();
    
    await this.db.insert(carryMultiLegPlans).values({
      id,
      carryActionId: input.carryActionId,
      strategyRunId: input.strategyRunId,
      asset: input.asset,
      notionalUsd: input.notionalUsd,
      legCount: input.legCount,
      status: 'pending',
      executionOrder: input.executionOrder,
      coordinationConfig: input.coordinationConfig,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      outcomeSummary: null,
      createdAt: now,
      updatedAt: now,
    });
    
    return { id, createdAt: now };
  }

  async createLegExecution(input: {
    planId: string;
    carryActionId: string;
    legSequence: number;
    legType: 'spot' | 'perp' | 'hedge' | 'rebalance' | 'settlement';
    side: 'long' | 'short';
    venueId: string;
    asset: string;
    targetSize: string;
    targetNotionalUsd: string;
    metadata: Record<string, unknown>;
  }): Promise<{ id: string; createdAt: Date }> {
    const id = createId();
    const now = new Date();
    
    await this.db.insert(carryLegExecutions).values({
      id,
      planId: input.planId,
      carryActionId: input.carryActionId,
      legSequence: input.legSequence,
      legType: input.legType,
      side: input.side,
      venueId: input.venueId,
      asset: input.asset,
      targetSize: input.targetSize,
      targetNotionalUsd: input.targetNotionalUsd,
      executedSize: null,
      executedNotionalUsd: null,
      status: 'pending',
      venueExecutionReference: null,
      lastError: null,
      metadata: input.metadata,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    
    return { id, createdAt: now };
  }

  async getLegExecutionsForPlan(planId: string): Promise<Array<{
    id: string;
    planId: string;
    carryActionId: string;
    legSequence: number;
    legType: string;
    side: string;
    venueId: string;
    asset: string;
    targetSize: string;
    targetNotionalUsd: string;
    executedSize: string | null;
    executedNotionalUsd: string | null;
    averageFillPrice: string | null;
    status: string;
    executionMode: string;
    simulated: boolean;
    venueExecutionReference: string | null;
    clientOrderId: string | null;
    venueOrderId: string | null;
    fillCount: number | null;
    startedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    lastError: string | null;
    retryCount: number;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const rows = await this.db
      .select({
        id: carryLegExecutions.id,
        planId: carryLegExecutions.planId,
        carryActionId: carryLegExecutions.carryActionId,
        legSequence: carryLegExecutions.legSequence,
        legType: carryLegExecutions.legType,
        side: carryLegExecutions.side,
        venueId: carryLegExecutions.venueId,
        asset: carryLegExecutions.asset,
        targetSize: carryLegExecutions.targetSize,
        targetNotionalUsd: carryLegExecutions.targetNotionalUsd,
        executedSize: carryLegExecutions.executedSize,
        executedNotionalUsd: carryLegExecutions.executedNotionalUsd,
        averageFillPrice: carryLegExecutions.averageFillPrice,
        status: carryLegExecutions.status,
        executionMode: carryLegExecutions.executionMode,
        simulated: carryLegExecutions.simulated,
        venueExecutionReference: carryLegExecutions.venueExecutionReference,
        clientOrderId: carryLegExecutions.clientOrderId,
        venueOrderId: carryLegExecutions.venueOrderId,
        fillCount: carryLegExecutions.fillCount,
        startedAt: carryLegExecutions.startedAt,
        completedAt: carryLegExecutions.completedAt,
        failedAt: carryLegExecutions.failedAt,
        lastError: carryLegExecutions.lastError,
        retryCount: carryLegExecutions.retryCount,
        metadata: carryLegExecutions.metadata,
        createdAt: carryLegExecutions.createdAt,
        updatedAt: carryLegExecutions.updatedAt,
      })
      .from(carryLegExecutions)
      .where(eq(carryLegExecutions.planId, planId))
      .orderBy(carryLegExecutions.legSequence);
    
    return rows.map((r) => ({
      ...r,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    }));
  }

  async updateLegExecutionStatus(
    legId: string,
    update: {
      status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
      executedSize?: string | null;
      executedNotionalUsd?: string | null;
      averageFillPrice?: string | null;
      venueExecutionReference?: string | null;
      lastError?: string | null;
    }
  ): Promise<void> {
    const setClause: Record<string, unknown> = {
      status: update.status,
      updatedAt: new Date(),
    };
    
    if (update.executedSize !== undefined) setClause['executedSize'] = update.executedSize;
    if (update.executedNotionalUsd !== undefined) setClause['executedNotionalUsd'] = update.executedNotionalUsd;
    if (update.averageFillPrice !== undefined) setClause['averageFillPrice'] = update.averageFillPrice;
    if (update.venueExecutionReference !== undefined) setClause['venueExecutionReference'] = update.venueExecutionReference;
    if (update.lastError !== undefined) setClause['lastError'] = update.lastError;
    
    if (update.status === 'executing') {
      setClause['startedAt'] = new Date();
    } else if (update.status === 'completed') {
      setClause['completedAt'] = new Date();
    } else if (update.status === 'failed') {
      setClause['failedAt'] = new Date();
    }
    
    await this.db
      .update(carryLegExecutions)
      .set(setClause)
      .where(eq(carryLegExecutions.id, legId));
  }

  async updateMultiLegPlanStatus(
    planId: string,
    update: {
      status: 'pending' | 'executing' | 'completed' | 'failed' | 'partial';
      outcomeSummary?: string | null;
    }
  ): Promise<void> {
    const setClause: Record<string, unknown> = {
      status: update.status,
      updatedAt: new Date(),
    };
    
    if (update.status === 'executing') {
      setClause['startedAt'] = new Date();
    } else if (update.status === 'completed') {
      setClause['completedAt'] = new Date();
      setClause['outcomeSummary'] = update.outcomeSummary ?? 'Plan completed';
    } else if (update.status === 'failed') {
      setClause['failedAt'] = new Date();
      setClause['outcomeSummary'] = update.outcomeSummary ?? 'Plan failed';
    }
    
    await this.db
      .update(carryMultiLegPlans)
      .set(setClause)
      .where(eq(carryMultiLegPlans.id, planId));
  }

  async recordHedgeState(input: {
    planId: string;
    carryActionId: string;
    asset: string;
    spotLegId: string | null;
    perpLegId: string | null;
    notionalUsd: string;
    hedgeDeviationPct: number;
    imbalanceDirection: 'spot_heavy' | 'perp_heavy' | 'balanced';
    imbalanceThresholdBreached: boolean;
  }): Promise<{ id: string }> {
    const id = createId();
    const now = new Date();
    
    await this.db.insert(carryHedgeState).values({
      id,
      planId: input.planId,
      carryActionId: input.carryActionId,
      asset: input.asset,
      spotLegId: input.spotLegId,
      perpLegId: input.perpLegId,
      notionalUsd: input.notionalUsd,
      hedgeDeviationPct: String(input.hedgeDeviationPct),
      imbalanceDirection: input.imbalanceDirection,
      imbalanceThresholdBreached: input.imbalanceThresholdBreached,
      status: input.imbalanceThresholdBreached ? 'rebalancing' : 'balanced',
      createdAt: now,
      updatedAt: now,
    });
    
    return { id };
  }

  async getHedgeStateForPlan(planId: string): Promise<Array<{
    id: string;
    planId: string;
    carryActionId: string;
    asset: string;
    pairType: string;
    spotLegId: string | null;
    spotVenueId: string | null;
    spotSide: string | null;
    spotTargetSize: string | null;
    spotExecutedSize: string | null;
    spotAveragePrice: string | null;
    perpLegId: string | null;
    perpVenueId: string | null;
    perpSide: string | null;
    perpTargetSize: string | null;
    perpExecutedSize: string | null;
    perpAveragePrice: string | null;
    notionalUsd: string;
    hedgeDeviationPct: string | null;
    maxAllowedDeviationPct: string;
    status: string;
    imbalanceDirection: string | null;
    imbalanceThresholdBreached: boolean;
    rebalanceTriggeredAt: Date | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const rows = await this.db
      .select({
        id: carryHedgeState.id,
        planId: carryHedgeState.planId,
        carryActionId: carryHedgeState.carryActionId,
        asset: carryHedgeState.asset,
        pairType: carryHedgeState.pairType,
        spotLegId: carryHedgeState.spotLegId,
        spotVenueId: carryHedgeState.spotVenueId,
        spotSide: carryHedgeState.spotSide,
        spotTargetSize: carryHedgeState.spotTargetSize,
        spotExecutedSize: carryHedgeState.spotExecutedSize,
        spotAveragePrice: carryHedgeState.spotAveragePrice,
        perpLegId: carryHedgeState.perpLegId,
        perpVenueId: carryHedgeState.perpVenueId,
        perpSide: carryHedgeState.perpSide,
        perpTargetSize: carryHedgeState.perpTargetSize,
        perpExecutedSize: carryHedgeState.perpExecutedSize,
        perpAveragePrice: carryHedgeState.perpAveragePrice,
        notionalUsd: carryHedgeState.notionalUsd,
        hedgeDeviationPct: carryHedgeState.hedgeDeviationPct,
        maxAllowedDeviationPct: carryHedgeState.maxAllowedDeviationPct,
        status: carryHedgeState.status,
        imbalanceDirection: carryHedgeState.imbalanceDirection,
        imbalanceThresholdBreached: carryHedgeState.imbalanceThresholdBreached,
        rebalanceTriggeredAt: carryHedgeState.rebalanceTriggeredAt,
        metadata: carryHedgeState.metadata,
        createdAt: carryHedgeState.createdAt,
        updatedAt: carryHedgeState.updatedAt,
      })
      .from(carryHedgeState)
      .where(eq(carryHedgeState.planId, planId))
      .orderBy(desc(carryHedgeState.createdAt));
    
    return rows.map((r) => ({
      ...r,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    }));
  }

  async getExecutingActionCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(carryActions)
      .where(eq(carryActions.status, 'executing'));
    
    return result[0]?.count ?? 0;
  }

  // ============================================================================
  // Execution Guardrail Methods (Phase R3)
  // ============================================================================

  async getGuardrailConfig(scopeType: 'global' | 'venue' | 'sleeve' | 'action', scopeId: string): Promise<{
    id: string;
    scopeType: string;
    scopeId: string;
    maxSingleActionNotionalUsd: string | null;
    maxConcurrentExecutions: number | null;
    killSwitchEnabled: boolean;
    killSwitchTriggered: boolean;
    killSwitchTriggeredAt: Date | null;
    killSwitchReason: string | null;
    circuitBreakerEnabled: boolean;
    maxFailuresBeforeBreaker: number | null;
    createdBy: string;
  } | null> {
    const rows = await this.db
      .select({
        id: executionGuardrailsConfig.id,
        scopeType: executionGuardrailsConfig.scopeType,
        scopeId: executionGuardrailsConfig.scopeId,
        maxSingleActionNotionalUsd: executionGuardrailsConfig.maxSingleActionNotionalUsd,
        maxConcurrentExecutions: executionGuardrailsConfig.maxConcurrentExecutions,
        killSwitchEnabled: executionGuardrailsConfig.killSwitchEnabled,
        killSwitchTriggered: executionGuardrailsConfig.killSwitchTriggered,
        killSwitchTriggeredAt: executionGuardrailsConfig.killSwitchTriggeredAt,
        killSwitchReason: executionGuardrailsConfig.killSwitchReason,
        circuitBreakerEnabled: executionGuardrailsConfig.circuitBreakerEnabled,
        maxFailuresBeforeBreaker: executionGuardrailsConfig.maxFailuresBeforeBreaker,
        createdBy: executionGuardrailsConfig.createdBy,
      })
      .from(executionGuardrailsConfig)
      .where(and(
        eq(executionGuardrailsConfig.scopeType, scopeType),
        eq(executionGuardrailsConfig.scopeId, scopeId)
      ))
      .limit(1);
    
    return rows[0] ?? null;
  }

  async recordGuardrailViolation(input: {
    guardrailConfigId: string;
    violationType: string;
    violationMessage: string;
    carryActionId?: string | null;
    planId?: string | null;
    legId?: string | null;
    attemptedNotionalUsd?: string | null;
    limitNotionalUsd?: string | null;
    blocked: boolean;
  }): Promise<{ id: string }> {
    const id = createId();
    
    await this.db.insert(executionGuardrailViolations).values({
      id,
      guardrailConfigId: input.guardrailConfigId,
      violationType: input.violationType,
      violationMessage: input.violationMessage,
      carryActionId: input.carryActionId ?? null,
      planId: input.planId ?? null,
      legId: input.legId ?? null,
      attemptedNotionalUsd: input.attemptedNotionalUsd ?? null,
      limitNotionalUsd: input.limitNotionalUsd ?? null,
      blocked: input.blocked,
      createdAt: new Date(),
    });
    
    return { id };
  }

  async triggerKillSwitch(configId: string, reason: string, triggeredBy: string): Promise<void> {
    await this.db
      .update(executionGuardrailsConfig)
      .set({
        killSwitchTriggered: true,
        killSwitchReason: reason,
        killSwitchTriggeredAt: new Date(),
        killSwitchTriggeredBy: triggeredBy,
        updatedAt: new Date(),
      })
      .where(eq(executionGuardrailsConfig.id, configId));
  }

  async resetKillSwitch(configId: string): Promise<void> {
    await this.db
      .update(executionGuardrailsConfig)
      .set({
        killSwitchTriggered: false,
        killSwitchReason: null,
        killSwitchTriggeredAt: null,
        killSwitchTriggeredBy: null,
        updatedAt: new Date(),
      })
      .where(eq(executionGuardrailsConfig.id, configId));
  }

  // ============================================================================
  // Multi-Leg Read Methods (Phase R3)
  // ============================================================================

  async getMultiLegPlan(planId: string): Promise<{
    id: string;
    carryActionId: string;
    strategyRunId: string | null;
    asset: string;
    notionalUsd: string;
    legCount: number;
    status: string;
    executionOrder: number[];
    coordinationConfig: Record<string, unknown>;
    startedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    outcomeSummary: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const rows = await this.db
      .select({
        id: carryMultiLegPlans.id,
        carryActionId: carryMultiLegPlans.carryActionId,
        strategyRunId: carryMultiLegPlans.strategyRunId,
        asset: carryMultiLegPlans.asset,
        notionalUsd: carryMultiLegPlans.notionalUsd,
        legCount: carryMultiLegPlans.legCount,
        status: carryMultiLegPlans.status,
        executionOrder: carryMultiLegPlans.executionOrder,
        coordinationConfig: carryMultiLegPlans.coordinationConfig,
        startedAt: carryMultiLegPlans.startedAt,
        completedAt: carryMultiLegPlans.completedAt,
        failedAt: carryMultiLegPlans.failedAt,
        outcomeSummary: carryMultiLegPlans.outcomeSummary,
        createdAt: carryMultiLegPlans.createdAt,
        updatedAt: carryMultiLegPlans.updatedAt,
      })
      .from(carryMultiLegPlans)
      .where(eq(carryMultiLegPlans.id, planId))
      .limit(1);
    
    if (!rows[0]) return null;
    
    return {
      ...rows[0],
      executionOrder: rows[0].executionOrder as number[],
      coordinationConfig: (rows[0].coordinationConfig ?? {}) as Record<string, unknown>,
    };
  }

  async listMultiLegPlansForAction(actionId: string): Promise<Array<{
    id: string;
    carryActionId: string;
    asset: string;
    notionalUsd: string;
    legCount: number;
    status: string;
    legsCompleted: number;
    legsFailed: number;
    hedgeDeviationPct: string | null;
    createdAt: Date;
  }>> {
    // Get plans with leg counts
    const plans = await this.db
      .select({
        id: carryMultiLegPlans.id,
        carryActionId: carryMultiLegPlans.carryActionId,
        asset: carryMultiLegPlans.asset,
        notionalUsd: carryMultiLegPlans.notionalUsd,
        legCount: carryMultiLegPlans.legCount,
        status: carryMultiLegPlans.status,
        hedgeDeviationPct: carryMultiLegPlans.hedgeDeviationPct,
        createdAt: carryMultiLegPlans.createdAt,
      })
      .from(carryMultiLegPlans)
      .where(eq(carryMultiLegPlans.carryActionId, actionId))
      .orderBy(desc(carryMultiLegPlans.createdAt));

    // Calculate completed/failed legs for each plan
    const results = await Promise.all(
      plans.map(async (plan) => {
        const legStats = await this.db
          .select({
            status: carryLegExecutions.status,
            count: sql<number>`count(*)::int`,
          })
          .from(carryLegExecutions)
          .where(eq(carryLegExecutions.planId, plan.id))
          .groupBy(carryLegExecutions.status);

        const completed = legStats.find((s) => s.status === 'completed')?.count ?? 0;
        const failed = legStats.find((s) => s.status === 'failed')?.count ?? 0;

        return {
          ...plan,
          legsCompleted: completed,
          legsFailed: failed,
        };
      })
    );

    return results;
  }

  async listGuardrailViolations(limit = 50): Promise<Array<{
    id: string;
    guardrailConfigId: string;
    violationType: string;
    violationMessage: string;
    carryActionId: string | null;
    planId: string | null;
    legId: string | null;
    attemptedNotionalUsd: string | null;
    limitNotionalUsd: string | null;
    violationDetails: Record<string, unknown>;
    blocked: boolean;
    overridden: boolean;
    overriddenBy: string | null;
    overriddenAt: Date | null;
    overrideReason: string | null;
    createdAt: Date;
  }>> {
    const rows = await this.db
      .select({
        id: executionGuardrailViolations.id,
        guardrailConfigId: executionGuardrailViolations.guardrailConfigId,
        violationType: executionGuardrailViolations.violationType,
        violationMessage: executionGuardrailViolations.violationMessage,
        carryActionId: executionGuardrailViolations.carryActionId,
        planId: executionGuardrailViolations.planId,
        legId: executionGuardrailViolations.legId,
        attemptedNotionalUsd: executionGuardrailViolations.attemptedNotionalUsd,
        limitNotionalUsd: executionGuardrailViolations.limitNotionalUsd,
        violationDetails: executionGuardrailViolations.violationDetails,
        blocked: executionGuardrailViolations.blocked,
        overridden: executionGuardrailViolations.overridden,
        overriddenBy: executionGuardrailViolations.overriddenBy,
        overriddenAt: executionGuardrailViolations.overriddenAt,
        overrideReason: executionGuardrailViolations.overrideReason,
        createdAt: executionGuardrailViolations.createdAt,
      })
      .from(executionGuardrailViolations)
      .orderBy(desc(executionGuardrailViolations.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      violationDetails: (r.violationDetails ?? {}) as Record<string, unknown>,
    }));
  }

  // ============================================================================
  // Phase R3 Part 5 - Performance Reports and Multi-Leg Evidence
  // ============================================================================

  async generatePerformanceReport(
    input: GeneratePerformanceReportInput & { generatedBy?: string },
  ): Promise<PerformanceReportView> {
    const id = createId();
    const now = new Date();
    const startDate = new Date(input.dateRangeStart);
    const endDate = new Date(input.dateRangeEnd);

    // Aggregate execution data
    const executionRows = await this.db
      .select()
      .from(carryActionExecutions)
      .where(
        and(
          gte(carryActionExecutions.createdAt, startDate),
          lte(carryActionExecutions.createdAt, endDate),
        ),
      );

    const realExecutions = executionRows.filter((r) => !r.simulated);
    const simulatedExecutions = executionRows.filter((r) => r.simulated);

    // Calculate notional from outcome or default to 0
    const totalNotional = executionRows.reduce(
      (sum, r) => {
        const outcome = r.outcome as Record<string, unknown> | undefined;
        const notional = outcome?.['totalNotionalUsd'] as string | undefined;
        return sum + Number.parseFloat(notional ?? '0');
      },
      0,
    );

    // Get strategy profile for APY
    const strategyProfile = await this.getCarryStrategyProfile();
    const realizedApy = strategyProfile.apy.realizedApyPct;

    // Get multi-leg summary if requested
    let multiLegSummary: PerformanceReportView['multiLegSummary'] = null;
    if (input.includeMultiLegDetail) {
      const planRows = await this.db
        .select()
        .from(carryMultiLegPlans)
        .where(
          and(
            gte(carryMultiLegPlans.createdAt, startDate),
            lte(carryMultiLegPlans.createdAt, endDate),
          ),
        );

      const legRows = await this.db
        .select()
        .from(carryLegExecutions)
        .where(
          and(
            gte(carryLegExecutions.createdAt, startDate),
            lte(carryLegExecutions.createdAt, endDate),
          ),
        );

      const completedLegs = legRows.filter((l) => l.status === 'completed');
      const avgCompletion = legRows.length > 0 ? (completedLegs.length / legRows.length) * 100 : 0;

      multiLegSummary = {
        totalPlans: planRows.length,
        completedPlans: planRows.filter((p) => p.status === 'completed').length,
        partialPlans: planRows.filter((p) => p.status === 'partial').length,
        failedPlans: planRows.filter((p) => p.status === 'failed').length,
        totalLegs: legRows.length,
        completedLegs: completedLegs.length,
        averageLegCompletionPct: avgCompletion.toFixed(2),
      };
    }

    // Get hedge state if requested
    let averageHedgeDeviation: string | null = null;
    if (input.includeHedgeState) {
      const hedgeRows = await this.db
        .select()
        .from(carryHedgeState)
        .where(
          and(
            gte(carryHedgeState.createdAt, startDate),
            lte(carryHedgeState.createdAt, endDate),
          ),
        );

      if (hedgeRows.length > 0) {
        const avgDeviation = hedgeRows.reduce(
          (sum, h) => sum + Number.parseFloat(h.hedgeDeviationPct ?? '0'), 
          0
        ) / hedgeRows.length;
        averageHedgeDeviation = avgDeviation.toFixed(4);
      }
    }

    // Build content based on format
    const content: Record<string, unknown> = {
      executions: executionRows.map((r) => {
        const outcome = r.outcome as Record<string, unknown> | undefined;
        return {
          id: r.id,
          status: r.status,
          simulated: r.simulated,
          totalNotionalUsd: outcome?.['totalNotionalUsd'] as string | undefined,
          createdAt: r.createdAt.toISOString(),
        };
      }),
      summary: {
        totalExecutions: executionRows.length,
        realExecutions: realExecutions.length,
        simulatedExecutions: simulatedExecutions.length,
        totalNotionalUsd: totalNotional.toFixed(2),
      },
    };

    // Determine execution types for metadata
    const executionTypes: Array<'real' | 'devnet' | 'simulated' | 'backtest'> = [];
    if (realExecutions.length > 0) {
      executionTypes.push('devnet'); // Assuming devnet for now
    }
    if (simulatedExecutions.length > 0) {
      executionTypes.push('simulated');
    }

    // Determine data completeness
    const missingData: string[] = [];
    if (realExecutions.length === 0) missingData.push('real-executions');
    if (realizedApy === null) missingData.push('realized-apy');

    const dataCompleteness: PerformanceReportMetadata['dataCompleteness'] =
      missingData.length === 0 ? 'complete' : missingData.length < 3 ? 'partial' : 'minimal';

    const metadata: PerformanceReportMetadata = {
      label: input.reportName,
      description: input.notes ?? `Performance report for ${input.dateRangeStart} to ${input.dateRangeEnd}`,
      executionTypes,
      dataCompleteness,
      missingData,
    };

    const summary = {
      totalExecutions: executionRows.length,
      realExecutions: realExecutions.length,
      simulatedExecutions: simulatedExecutions.length,
      totalNotionalUsd: totalNotional.toFixed(2),
      realizedPnlUsd: null, // Not yet persisted
      realizedApyPct: realizedApy,
      averageHedgeDeviationPct: averageHedgeDeviation,
    };

    // Generate markdown content
    const contentMarkdown = this.buildPerformanceReportMarkdown({
      reportName: input.reportName,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      summary,
      multiLegSummary,
      metadata,
    });

    // Insert report
    await this.db.insert(performanceReports).values({
      id,
      reportName: input.reportName,
      status: 'complete',
      format: input.format,
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
      generatedAt: now,
      generatedBy: input.generatedBy ?? null,
      metadata,
      summary,
      multiLegSummary,
      content,
      contentMarkdown,
      downloadUrl: null,
      expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days
      createdAt: now,
      updatedAt: now,
    });

    return {
      reportId: id,
      reportName: input.reportName,
      status: 'complete',
      format: input.format,
      dateRangeStart: input.dateRangeStart,
      dateRangeEnd: input.dateRangeEnd,
      generatedAt: now.toISOString(),
      generatedBy: input.generatedBy ?? null,
      metadata,
      summary,
      multiLegSummary,
      content: input.format === 'markdown' ? contentMarkdown : content,
      downloadUrl: null,
      expiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
    };
  }

  private buildPerformanceReportMarkdown(params: {
    reportName: string;
    dateRangeStart: string;
    dateRangeEnd: string;
    summary: PerformanceReportView['summary'];
    multiLegSummary: PerformanceReportView['multiLegSummary'];
    metadata: PerformanceReportMetadata;
  }): string {
    const lines: string[] = [
      `# ${params.reportName}`,
      '',
      `**Date Range:** ${params.dateRangeStart} to ${params.dateRangeEnd}`,
      `**Generated:** ${new Date().toISOString()}`,
      '',
      '## Executive Summary',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Total Executions | ${params.summary.totalExecutions} |`,
      `| Real Executions | ${params.summary.realExecutions} |`,
      `| Simulated Executions | ${params.summary.simulatedExecutions} |`,
      `| Total Notional (USD) | $${params.summary.totalNotionalUsd} |`,
      `| Realized APY | ${params.summary.realizedApyPct ?? 'N/A'} |`,
      '',
      '## Execution Types',
      '',
      params.metadata.executionTypes.map((t) => `- ${t}`).join('\n') || '- None recorded',
      '',
    ];

    if (params.multiLegSummary) {
      lines.push(
        '## Multi-Leg Execution Summary',
        '',
        '| Metric | Value |',
        '|--------|-------|',
        `| Total Plans | ${params.multiLegSummary.totalPlans} |`,
        `| Completed Plans | ${params.multiLegSummary.completedPlans} |`,
        `| Partial Plans | ${params.multiLegSummary.partialPlans} |`,
        `| Failed Plans | ${params.multiLegSummary.failedPlans} |`,
        `| Total Legs | ${params.multiLegSummary.totalLegs} |`,
        `| Completed Legs | ${params.multiLegSummary.completedLegs} |`,
        `| Avg Completion % | ${params.multiLegSummary.averageLegCompletionPct}% |`,
        '',
      );
    }

    lines.push(
      '## Data Completeness',
      '',
      `**Status:** ${params.metadata.dataCompleteness}`,
      '',
    );

    if (params.metadata.missingData.length > 0) {
      lines.push(
        '### Missing Data',
        '',
        ...params.metadata.missingData.map((m) => `- ${m}`),
        '',
      );
    }

    lines.push(
      '## Truthfulness Notice',
      '',
      'This report distinguishes between:',
      '- **Real/devnet executions**: Executed against live venues on devnet',
      '- **Simulated executions**: Executed against simulated venues',
      '- **Backtests**: Historical simulations',
      '',
      'Any missing data is explicitly listed above.',
      '',
      '---',
      '*Generated by Sentinel Apex Submission Dossier System*',
    );

    return lines.join('\n');
  }

  async getPerformanceReport(reportId: string): Promise<PerformanceReportView | null> {
    const [row] = await this.db
      .select()
      .from(performanceReports)
      .where(eq(performanceReports.id, reportId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const r = row as typeof performanceReports.$inferSelect;
    return {
      reportId: r.id,
      reportName: r.reportName,
      status: r.status as PerformanceReportStatus,
      format: r.format as PerformanceReportFormat,
      dateRangeStart: r.dateRangeStart.toISOString(),
      dateRangeEnd: r.dateRangeEnd.toISOString(),
      generatedAt: r.generatedAt.toISOString(),
      generatedBy: r.generatedBy,
      metadata: r.metadata as PerformanceReportMetadata,
      summary: r.summary as PerformanceReportView['summary'],
      multiLegSummary: r.multiLegSummary as PerformanceReportView['multiLegSummary'],
      content: r.format === 'markdown' ? (r.contentMarkdown ?? '') : (r.content as Record<string, unknown>),
      downloadUrl: r.downloadUrl,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async listPerformanceReports(limit = 50): Promise<PerformanceReportView[]> {
    const rows = await this.db
      .select()
      .from(performanceReports)
      .orderBy(desc(performanceReports.generatedAt))
      .limit(limit);

    return rows.map((row) => {
      const r = row as typeof performanceReports.$inferSelect;
      return {
        reportId: r.id,
        reportName: r.reportName,
        status: r.status as PerformanceReportStatus,
        format: r.format as PerformanceReportFormat,
        dateRangeStart: r.dateRangeStart.toISOString(),
        dateRangeEnd: r.dateRangeEnd.toISOString(),
        generatedAt: r.generatedAt.toISOString(),
        generatedBy: r.generatedBy,
        metadata: r.metadata as PerformanceReportMetadata,
        summary: r.summary as PerformanceReportView['summary'],
        multiLegSummary: r.multiLegSummary as PerformanceReportView['multiLegSummary'],
        content: r.format === 'markdown' ? (r.contentMarkdown ?? '') : (r.content as Record<string, unknown>),
        downloadUrl: r.downloadUrl,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  async getSubmissionCompleteness(): Promise<SubmissionCompletenessView> {
    const vaultRecord = await this.getVaultCurrentRecord();
    const dossierRecord = await this.getSubmissionDossierRecord(vaultRecord);
    const strategyProfile = await this.getCarryStrategyProfile();

    // Get evidence counts
    const evidenceRows = await this.getSubmissionEvidenceRows(dossierRecord.id);
    const onChainEvidence = evidenceRows.filter((e) => e.evidenceType === 'on_chain_transaction');
    const performanceEvidence = evidenceRows.filter((e) => e.evidenceType === 'performance_snapshot');

    // Get execution counts
    const executionRows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(carryActionExecutions)
      .where(eq(carryActionExecutions.simulated, false));
    const realExecutionCount = executionRows[0]?.count ?? 0;

    // Get multi-leg evidence
    const multiLegEvidence = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(multiLegEvidenceSummary)
      .where(eq(multiLegEvidenceSummary.evidenceStatus, 'confirmed'));
    const multiLegEvidenceCount = multiLegEvidence[0]?.count ?? 0;

    // Build categories
    const categories: SubmissionCompletenessView['categories'] = [
      {
        category: 'Vault Identity',
        required: true,
        status: dossierRecord.walletAddress && dossierRecord.vaultAddress ? 'complete' : 'partial',
        completenessPct: dossierRecord.walletAddress && dossierRecord.vaultAddress ? 100 : 50,
        items: [
          {
            item: 'Vault Address',
            status: dossierRecord.vaultAddress ? 'complete' : 'missing',
            required: true,
            evidenceCount: dossierRecord.vaultAddress ? 1 : 0,
            missingReason: dossierRecord.vaultAddress ? null : 'Vault address not configured',
          },
          {
            item: 'Wallet Address',
            status: dossierRecord.walletAddress ? 'complete' : 'missing',
            required: true,
            evidenceCount: dossierRecord.walletAddress ? 1 : 0,
            missingReason: dossierRecord.walletAddress ? null : 'Wallet address not configured',
          },
        ],
      },
      {
        category: 'Strategy Configuration',
        required: true,
        status: strategyProfile.eligibility.status === 'eligible' ? 'complete' : 'partial',
        completenessPct: strategyProfile.eligibility.status === 'eligible' ? 100 : 50,
        items: [
          {
            item: 'Strategy ID',
            status: vaultRecord.strategyId ? 'complete' : 'missing',
            required: true,
            evidenceCount: vaultRecord.strategyId ? 1 : 0,
            missingReason: null,
          },
          {
            item: 'Eligibility Status',
            status: strategyProfile.eligibility.status === 'eligible' ? 'complete' : 'partial',
            required: true,
            evidenceCount: 1,
            missingReason: strategyProfile.eligibility.status === 'eligible' ? null : strategyProfile.eligibility.blockedReasons.join(', '),
          },
        ],
      },
      {
        category: 'Execution Evidence',
        required: true,
        status: realExecutionCount > 0 ? 'complete' : 'missing',
        completenessPct: Math.min(100, realExecutionCount * 10),
        items: [
          {
            item: 'Real Executions',
            status: realExecutionCount > 0 ? 'complete' : 'missing',
            required: true,
            evidenceCount: realExecutionCount,
            missingReason: realExecutionCount > 0 ? null : 'No real (non-simulated) executions recorded',
          },
          {
            item: 'On-Chain References',
            status: onChainEvidence.length > 0 ? 'complete' : 'partial',
            required: true,
            evidenceCount: onChainEvidence.length,
            missingReason: onChainEvidence.length > 0 ? null : 'No on-chain transaction evidence recorded',
          },
        ],
      },
      {
        category: 'Multi-Leg Evidence',
        required: false,
        status: multiLegEvidenceCount > 0 ? 'complete' : 'partial',
        completenessPct: multiLegEvidenceCount > 0 ? 100 : 0,
        items: [
          {
            item: 'Multi-Leg Plans',
            status: multiLegEvidenceCount > 0 ? 'complete' : 'partial',
            required: false,
            evidenceCount: multiLegEvidenceCount,
            missingReason: multiLegEvidenceCount > 0 ? null : 'No multi-leg execution evidence recorded',
          },
        ],
      },
      {
        category: 'Performance Metrics',
        required: true,
        status: strategyProfile.apy.realizedApyPct !== null ? 'complete' : 'partial',
        completenessPct: strategyProfile.apy.realizedApyPct !== null ? 100 : 50,
        items: [
          {
            item: 'Realized APY',
            status: strategyProfile.apy.realizedApyPct !== null ? 'complete' : 'missing',
            required: true,
            evidenceCount: strategyProfile.apy.realizedApyPct !== null ? 1 : 0,
            missingReason: strategyProfile.apy.realizedApyPct !== null ? null : 'Realized APY not yet calculated',
          },
          {
            item: 'Performance Reports',
            status: performanceEvidence.length > 0 ? 'complete' : 'partial',
            required: false,
            evidenceCount: performanceEvidence.length,
            missingReason: null,
          },
        ],
      },
    ];

    // Calculate overall completeness
    const requiredCategories = categories.filter((c) => c.required);
    const overallCompleteness = Math.round(
      requiredCategories.reduce((sum, c) => sum + c.completenessPct, 0) / requiredCategories.length,
    );

    // Identify blockers
    const blockers: string[] = [];
    if (!dossierRecord.walletAddress) blockers.push('Wallet address not configured');
    if (!dossierRecord.vaultAddress) blockers.push('Vault address not configured');
    if (realExecutionCount === 0) blockers.push('No real executions recorded');
    if (strategyProfile.eligibility.status !== 'eligible') {
      blockers.push(`Strategy not eligible: ${strategyProfile.eligibility.blockedReasons.join(', ')}`);
    }

    // Identify warnings
    const warnings: string[] = [];
    if (onChainEvidence.length === 0) warnings.push('No on-chain transaction evidence');
    if (multiLegEvidenceCount === 0) warnings.push('No multi-leg execution evidence');
    if (strategyProfile.apy.realizedApyPct === null) warnings.push('Realized APY not available');

    // Build missing evidence list
    const missingEvidence: SubmissionCompletenessView['missingEvidence'] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        if (item.status !== 'complete' && item.required) {
          missingEvidence.push({
            type: `${cat.category}: ${item.item}`,
            description: item.missingReason ?? 'Missing required evidence',
            required: item.required,
            blocker: blockers.some((b) => item.missingReason?.includes(b) ?? false),
          });
        }
      }
    }

    return {
      submissionId: dossierRecord.id,
      overallCompletenessPct: overallCompleteness,
      isReadyForSubmission: overallCompleteness >= 80 && blockers.length === 0,
      blockers,
      warnings,
      categories,
      missingEvidence,
      generatedAt: new Date().toISOString(),
    };
  }

  async recordMultiLegEvidence(
    input: RecordMultiLegEvidenceInput,
    _operatorId: string,
  ): Promise<MultiLegExecutionEvidenceView> {
    // Get the plan
    const [plan] = await this.db
      .select()
      .from(carryMultiLegPlans)
      .where(eq(carryMultiLegPlans.id, input.planId))
      .limit(1);

    if (plan === undefined) {
      throw new Error(`Multi-leg plan ${input.planId} not found`);
    }

    // Get legs
    const legs = await this.getLegExecutionsForPlan(input.planId);

    // Get hedge state
    const hedgeState = input.includeHedgeState
      ? await this.getHedgeStateForPlan(input.planId)
      : [];

    const latestHedgeState = hedgeState[0] ?? null;

    // Create evidence summary
    const id = createId();
    const now = new Date();

    await this.db.insert(multiLegEvidenceSummary).values({
      id,
      planId: plan.id,
      carryActionId: plan.carryActionId,
      submissionDossierId: null, // Will be linked when added to dossier
      asset: plan.asset,
      notionalUsd: plan.notionalUsd,
      legCount: legs.length,
      status: plan.status,
      hedgeDeviationPct: latestHedgeState?.hedgeDeviationPct ?? null,
      isWithinTolerance: latestHedgeState?.imbalanceThresholdBreached === false,
      executedAt: plan.startedAt,
      completedAt: plan.completedAt,
      evidenceLabel: input.evidenceLabel,
      evidenceStatus: 'confirmed',
      notes: input.notes ?? null,
      metadata: {
        legs: legs.map((l) => ({
          legSequence: l.legSequence,
          legType: l.legType,
          side: l.side,
          venueId: l.venueId,
          targetSize: l.targetSize,
          executedSize: l.executedSize,
          averageFillPrice: l.averageFillPrice,
          status: l.status,
        })),
        hedgeState: latestHedgeState
          ? {
              notionalUsd: latestHedgeState.notionalUsd,
              hedgeDeviationPct: latestHedgeState.hedgeDeviationPct,
              imbalanceDirection: latestHedgeState.imbalanceDirection,
              imbalanceThresholdBreached: latestHedgeState.imbalanceThresholdBreached,
            }
          : null,
      },
      createdAt: now,
      updatedAt: now,
    });

    return {
      evidenceType: 'multi_leg_execution',
      planId: plan.id,
      carryActionId: plan.carryActionId,
      asset: plan.asset,
      notionalUsd: plan.notionalUsd,
      legCount: legs.length,
      status: plan.status,
      legs: legs.map((l) => ({
        legSequence: l.legSequence,
        legType: l.legType,
        side: l.side,
        venueId: l.venueId,
        targetSize: l.targetSize,
        executedSize: l.executedSize,
        averageFillPrice: l.averageFillPrice,
        status: l.status,
      })),
      hedgeState: latestHedgeState
        ? {
            spotNotionalUsd: latestHedgeState.notionalUsd,
            perpNotionalUsd: latestHedgeState.notionalUsd,
            deviationPct: latestHedgeState.hedgeDeviationPct ?? '0',
            isWithinTolerance: latestHedgeState.imbalanceThresholdBreached === false,
          }
        : null,
      executedAt: plan.startedAt?.toISOString() ?? null,
      completedAt: plan.completedAt?.toISOString() ?? null,
    };
  }
}
