import type {
  AllocatorBudgetConstraint,
  AllocatorPressureLevel,
  AllocatorRegimeState,
  AllocatorRationale,
  AllocatorSleeveId,
  RebalanceActionType,
  RebalanceApprovalRequirement,
  RebalanceBlockedReason,
  RebalanceExecutionMode,
  RebalanceProposalStatus,
  RebalanceReadiness,
} from '@sentinel-apex/allocator';
import type {
  CarryActionReadiness,
  CarryActionType,
  CarryApprovalRequirement,
  CarryExecutionMode,
  CarryExecutionStatus,
  CarryOperationalBlockedReason,
} from '@sentinel-apex/carry';
import type { RiskAssessment } from '@sentinel-apex/domain';
import type { RiskSummary } from '@sentinel-apex/risk-engine';
import type {
  TreasuryActionBlockedReason,
  TreasuryActionReadiness,
  TreasuryActionType,
  TreasuryApprovalRequirement,
  TreasuryExecutionStatus,
  TreasuryPolicy,
} from '@sentinel-apex/treasury';

export type RuntimeLifecycleState = 'starting' | 'ready' | 'paused' | 'stopped' | 'degraded';
export type ProjectionStatus = 'fresh' | 'rebuilding' | 'stale';
export type WorkerLifecycleState = 'starting' | 'ready' | 'stopping' | 'stopped' | 'degraded';
export type WorkerSchedulerState = 'idle' | 'waiting' | 'running' | 'paused';
export type RuntimeCommandType =
  | 'run_cycle'
  | 'run_carry_evaluation'
  | 'rebuild_projections'
  | 'run_reconciliation'
  | 'run_treasury_evaluation'
  | 'run_allocator_evaluation'
  | 'execute_carry_action'
  | 'execute_treasury_action'
  | 'execute_rebalance_proposal';
export type RuntimeCommandStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RuntimeRemediationActionType = 'run_cycle' | 'rebuild_projections';
export type RuntimeRemediationStatus = 'requested' | 'running' | 'completed' | 'failed';
export type RuntimeMismatchSourceKind = 'workflow' | 'reconciliation';
export type RuntimeMismatchStatus =
  | 'open'
  | 'acknowledged'
  | 'recovering'
  | 'resolved'
  | 'verified'
  | 'reopened';
export type RuntimeVerificationOutcome = 'verified' | 'failed';
export type RuntimeReconciliationRunStatus = 'running' | 'completed' | 'failed';
export type RuntimeReconciliationRunType = 'runtime_reconciliation';
export type RuntimeReconciliationFindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RuntimeReconciliationFindingStatus = 'active' | 'resolved';
export type RuntimeReconciliationFindingType =
  | 'order_state_mismatch'
  | 'position_exposure_mismatch'
  | 'projection_state_mismatch'
  | 'stale_projection_state'
  | 'command_outcome_mismatch';

export interface RuntimeStatusView {
  executionMode: 'dry-run' | 'live';
  liveExecutionEnabled: boolean;
  riskLimits: Record<string, unknown>;
  halted: boolean;
  lifecycleState: RuntimeLifecycleState;
  projectionStatus: ProjectionStatus;
  lastRunId: string | null;
  lastRunStatus: string | null;
  lastSuccessfulRunId: string | null;
  lastCycleStartedAt: string | null;
  lastCycleCompletedAt: string | null;
  lastProjectionRebuildAt: string | null;
  lastProjectionSourceRunId: string | null;
  startedAt: string | null;
  readyAt: string | null;
  stoppedAt: string | null;
  lastError: string | null;
  reason: string | null;
  updatedAt: string;
}

export interface WorkerStatusView {
  workerId: string;
  lifecycleState: WorkerLifecycleState;
  schedulerState: WorkerSchedulerState;
  currentOperation: string | null;
  currentCommandId: string | null;
  currentRunId: string | null;
  cycleIntervalMs: number;
  processId: number | null;
  hostname: string | null;
  lastHeartbeatAt: string | null;
  lastStartedAt: string | null;
  lastStoppedAt: string | null;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  nextScheduledRunAt: string | null;
  updatedAt: string;
}

export interface RuntimeCommandView {
  commandId: string;
  commandType: RuntimeCommandType;
  status: RuntimeCommandStatus;
  requestedBy: string;
  claimedBy: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  errorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface RuntimeMismatchView {
  id: string;
  dedupeKey: string;
  category: string;
  severity: string;
  sourceKind: RuntimeMismatchSourceKind;
  sourceComponent: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  details: Record<string, unknown>;
  status: RuntimeMismatchStatus;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrenceCount: number;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  recoveryStartedAt: string | null;
  recoveryStartedBy: string | null;
  recoverySummary: string | null;
  linkedCommandId: string | null;
  linkedRecoveryEventId: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionSummary: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verificationSummary: string | null;
  verificationOutcome: RuntimeVerificationOutcome | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenSummary: string | null;
  lastStatusChangeAt: string;
  updatedAt: string;
}

export interface RuntimeReconciliationRunView {
  id: string;
  runType: RuntimeReconciliationRunType;
  trigger: string;
  triggerReference: string | null;
  sourceComponent: string;
  triggeredBy: string | null;
  status: RuntimeReconciliationRunStatus;
  findingCount: number;
  linkedMismatchCount: number;
  summary: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeReconciliationFindingView {
  id: string;
  reconciliationRunId: string;
  dedupeKey: string;
  findingType: RuntimeReconciliationFindingType;
  severity: RuntimeReconciliationFindingSeverity;
  status: RuntimeReconciliationFindingStatus;
  sourceComponent: string;
  subsystem: string;
  venueId: string | null;
  entityType: string | null;
  entityId: string | null;
  mismatchId: string | null;
  summary: string;
  expectedState: Record<string, unknown>;
  actualState: Record<string, unknown>;
  delta: Record<string, unknown>;
  details: Record<string, unknown>;
  detectedAt: string;
  createdAt: string;
}

export interface RuntimeReconciliationFindingDetailView {
  finding: RuntimeReconciliationFindingView;
  run: RuntimeReconciliationRunView | null;
  mismatch: RuntimeMismatchView | null;
}

export interface RuntimeReconciliationSummaryView {
  latestRun: RuntimeReconciliationRunView | null;
  latestCompletedRun: RuntimeReconciliationRunView | null;
  latestFindingCount: number;
  latestLinkedMismatchCount: number;
  latestStatusCounts: Record<RuntimeReconciliationFindingStatus, number>;
  latestSeverityCounts: Record<RuntimeReconciliationFindingSeverity, number>;
  latestTypeCounts: Record<RuntimeReconciliationFindingType, number>;
}

export interface RuntimeRecoveryEventView {
  id: string;
  mismatchId: string | null;
  commandId: string | null;
  runId: string | null;
  eventType: string;
  status: string;
  sourceComponent: string;
  actorId: string | null;
  message: string;
  details: Record<string, unknown>;
  occurredAt: string;
}

export interface RuntimeMismatchRemediationView {
  id: string;
  mismatchId: string;
  attemptSequence: number;
  remediationType: RuntimeRemediationActionType;
  commandId: string;
  status: RuntimeRemediationStatus;
  requestedBy: string;
  requestedSummary: string | null;
  outcomeSummary: string | null;
  latestRecoveryEventId: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  updatedAt: string;
  command: RuntimeCommandView | null;
  latestRecoveryEvent: RuntimeRecoveryEventView | null;
}

export interface RuntimeOverviewView {
  runtime: RuntimeStatusView;
  worker: WorkerStatusView;
  openMismatchCount: number;
  mismatchStatusCounts: Record<RuntimeMismatchStatus, number>;
  degradedReasons: string[];
  lastRecoveryEvent: RuntimeRecoveryEventView | null;
  latestReconciliationRun: RuntimeReconciliationRunView | null;
  reconciliationSummary: RuntimeReconciliationSummaryView | null;
  treasurySummary: TreasurySummaryView | null;
  allocatorSummary: AllocatorSummaryView | null;
}

export interface AllocatorSummaryView {
  allocatorRunId: string;
  sourceRunId: string | null;
  trigger: string;
  triggeredBy: string | null;
  regimeState: AllocatorRegimeState;
  pressureLevel: AllocatorPressureLevel;
  totalCapitalUsd: string;
  reserveConstrainedCapitalUsd: string;
  allocatableCapitalUsd: string;
  carryTargetPct: number;
  treasuryTargetPct: number;
  recommendationCount: number;
  evaluatedAt: string;
  updatedAt: string;
}

export interface AllocatorSleeveTargetView {
  allocatorRunId: string;
  sleeveId: AllocatorSleeveId;
  sleeveKind: 'carry' | 'treasury';
  sleeveName: string;
  status: string;
  throttleState: string;
  currentAllocationUsd: string;
  currentAllocationPct: number;
  targetAllocationUsd: string;
  targetAllocationPct: number;
  minAllocationPct: number;
  maxAllocationPct: number;
  deltaUsd: string;
  opportunityScore: number | null;
  capacityUsd: string | null;
  rationale: AllocatorRationale[];
  metadata: Record<string, unknown>;
}

export interface AllocatorRecommendationView {
  id: string;
  allocatorRunId: string;
  sleeveId: AllocatorSleeveId;
  recommendationType: string;
  priority: 'low' | 'medium' | 'high';
  summary: string;
  details: Record<string, unknown>;
  rationale: AllocatorRationale[];
  createdAt: string;
}

export interface AllocatorRunView {
  allocatorRunId: string;
  sourceRunId: string | null;
  trigger: string;
  triggeredBy: string | null;
  regimeState: AllocatorRegimeState;
  pressureLevel: AllocatorPressureLevel;
  totalCapitalUsd: string;
  reserveConstrainedCapitalUsd: string;
  allocatableCapitalUsd: string;
  recommendationCount: number;
  rationale: AllocatorRationale[];
  constraints: AllocatorBudgetConstraint[];
  inputSnapshot: Record<string, unknown>;
  policySnapshot: Record<string, unknown>;
  evaluatedAt: string;
  updatedAt: string;
}

export interface AllocatorDecisionDetailView {
  run: AllocatorRunView;
  summary: AllocatorSummaryView | null;
  targets: AllocatorSleeveTargetView[];
  recommendations: AllocatorRecommendationView[];
  rationale: AllocatorRationale[];
  constraints: AllocatorBudgetConstraint[];
}

export interface RebalanceProposalIntentView {
  id: string;
  proposalId: string;
  sleeveId: AllocatorSleeveId;
  sourceSleeveId: AllocatorSleeveId | null;
  targetSleeveId: AllocatorSleeveId | null;
  actionType: Exclude<RebalanceActionType, 'rebalance_between_sleeves'>;
  status: RebalanceProposalStatus;
  readiness: RebalanceReadiness;
  executable: boolean;
  currentAllocationUsd: string;
  currentAllocationPct: number;
  targetAllocationUsd: string;
  targetAllocationPct: number;
  deltaUsd: string;
  rationale: AllocatorRationale[];
  blockedReasons: RebalanceBlockedReason[];
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceProposalView {
  id: string;
  allocatorRunId: string;
  actionType: RebalanceActionType;
  status: RebalanceProposalStatus;
  summary: string;
  executionMode: RebalanceExecutionMode;
  simulated: boolean;
  executable: boolean;
  approvalRequirement: RebalanceApprovalRequirement;
  rationale: AllocatorRationale[];
  blockedReasons: RebalanceBlockedReason[];
  details: Record<string, unknown>;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  linkedCommandId: string | null;
  latestExecutionId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceExecutionView {
  id: string;
  proposalId: string;
  commandId: string | null;
  status: RebalanceProposalStatus;
  executionMode: RebalanceExecutionMode;
  simulated: boolean;
  requestedBy: string;
  startedBy: string | null;
  outcomeSummary: string | null;
  outcome: Record<string, unknown>;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface RebalanceCurrentView {
  allocatorRunId: string;
  latestProposalId: string | null;
  carryTargetAllocationUsd: string;
  carryTargetAllocationPct: number;
  treasuryTargetAllocationUsd: string;
  treasuryTargetAllocationPct: number;
  appliedAt: string;
  updatedAt: string;
}

export interface RebalanceProposalDetailView {
  proposal: RebalanceProposalView;
  intents: RebalanceProposalIntentView[];
  latestCommand: RuntimeCommandView | null;
  executions: RebalanceExecutionView[];
  currentState: RebalanceCurrentView | null;
}

export interface RebalanceDownstreamStatusRollupView {
  status: 'idle' | 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  actionCount: number;
  executionCount: number;
  blockedCount: number;
  failureCount: number;
  completedCount: number;
  simulated: boolean;
  live: boolean;
  references: string[];
  summary: string;
}

export interface RebalanceCarryActionNodeView {
  action: CarryActionView;
  executions: CarryExecutionView[];
}

export interface RebalanceTreasuryActionNodeView {
  action: TreasuryActionView;
  executions: TreasuryExecutionView[];
}

export interface RebalanceExecutionTimelineEntry {
  id: string;
  eventType:
    | 'proposed'
    | 'approved'
    | 'rejected'
    | 'queued'
    | 'command_linked'
    | 'execution_recorded'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'budget_state_applied'
    | 'downstream_action_recorded'
    | 'downstream_execution_recorded';
  at: string;
  actorId: string | null;
  sleeveId: 'allocator' | 'carry' | 'treasury';
  scope: 'proposal' | 'command' | 'rebalance_execution' | 'downstream_action' | 'downstream_execution';
  status: string | null;
  summary: string;
  linkedCommandId: string | null;
  linkedRebalanceExecutionId: string | null;
  linkedActionId: string | null;
  linkedExecutionId: string | null;
  details: Record<string, unknown>;
}

export interface RebalanceExecutionGraphView {
  detail: RebalanceProposalDetailView;
  allocatorDecision: AllocatorDecisionDetailView | null;
  commands: RuntimeCommandView[];
  downstream: {
    carry: {
      actions: RebalanceCarryActionNodeView[];
      rollup: RebalanceDownstreamStatusRollupView;
    };
    treasury: {
      actions: RebalanceTreasuryActionNodeView[];
      rollup: RebalanceDownstreamStatusRollupView;
      note: string | null;
    };
  };
  timeline: RebalanceExecutionTimelineEntry[];
}

export type RebalanceBundleStatus =
  | 'proposed'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'partially_completed'
  | 'blocked'
  | 'failed'
  | 'requires_intervention'
  | 'rejected';
export type RebalanceBundleCompletionState = 'open' | 'finalized';
export type RebalanceBundleInterventionRecommendation =
  | 'no_action_needed'
  | 'wait_for_inflight_children'
  | 'inspect_child_failures'
  | 'operator_review_required'
  | 'unresolved_partial_application';
export type RebalanceBundleOutcomeClassification =
  | 'pending'
  | 'safe_complete'
  | 'partial_application'
  | 'blocked'
  | 'failed'
  | 'rejected';

export interface RebalanceBundleView {
  id: string;
  proposalId: string;
  allocatorRunId: string;
  proposalStatus: RebalanceProposalStatus;
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
  executionMode: RebalanceExecutionMode;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceBundleDetailView {
  bundle: RebalanceBundleView;
  graph: RebalanceExecutionGraphView;
}

export interface CarryVenueView {
  strategyRunId: string | null;
  venueId: string;
  venueMode: 'simulated' | 'live';
  executionSupported: boolean;
  supportsIncreaseExposure: boolean;
  supportsReduceExposure: boolean;
  readOnly: boolean;
  approvedForLiveUse: boolean;
  healthy: boolean;
  onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
  missingPrerequisites: string[];
  metadata: Record<string, unknown>;
  updatedAt: string;
  createdAt: string;
}

export interface CarryActionPlannedOrderView {
  id: string;
  carryActionId: string;
  intentId: string;
  venueId: string;
  asset: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'post_only';
  requestedSize: string;
  requestedPrice: string | null;
  reduceOnly: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CarryActionView {
  id: string;
  strategyRunId: string | null;
  linkedRebalanceProposalId: string | null;
  actionType: CarryActionType;
  status: CarryExecutionStatus;
  sourceKind: 'opportunity' | 'rebalance';
  sourceReference: string | null;
  opportunityId: string | null;
  asset: string | null;
  summary: string;
  notionalUsd: string;
  details: Record<string, unknown>;
  readiness: CarryActionReadiness;
  executable: boolean;
  blockedReasons: CarryOperationalBlockedReason[];
  approvalRequirement: CarryApprovalRequirement;
  executionMode: CarryExecutionMode;
  simulated: boolean;
  executionPlan: Record<string, unknown>;
  approvedBy: string | null;
  approvedAt: string | null;
  executionRequestedBy: string | null;
  executionRequestedAt: string | null;
  queuedAt: string | null;
  executingAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  linkedCommandId: string | null;
  latestExecutionId: string | null;
  lastError: string | null;
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CarryExecutionView {
  id: string;
  carryActionId: string;
  strategyRunId: string | null;
  commandId: string | null;
  status: CarryExecutionStatus;
  executionMode: CarryExecutionMode;
  simulated: boolean;
  requestedBy: string;
  startedBy: string | null;
  blockedReasons: CarryOperationalBlockedReason[];
  outcomeSummary: string | null;
  outcome: Record<string, unknown>;
  venueExecutionReference: string | null;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface CarryExecutionStepView {
  id: string;
  carryExecutionId: string;
  carryActionId: string;
  strategyRunId: string | null;
  plannedOrderId: string | null;
  intentId: string;
  venueId: string;
  venueMode: 'simulated' | 'live';
  executionSupported: boolean;
  readOnly: boolean;
  approvedForLiveUse: boolean;
  onboardingState: CarryVenueView['onboardingState'];
  asset: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'post_only';
  requestedSize: string;
  requestedPrice: string | null;
  reduceOnly: boolean;
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
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CarryExecutionTimelineEntry {
  id: string;
  eventType:
    | 'recommended'
    | 'approved'
    | 'queued'
    | 'executing'
    | 'step_recorded'
    | 'completed'
    | 'failed';
  at: string;
  actorId: string | null;
  status: CarryExecutionStatus | null;
  summary: string;
  linkedCommandId: string | null;
  linkedExecutionId: string | null;
  linkedStepId: string | null;
  details: Record<string, unknown>;
}

export interface CarryExecutionDetailView {
  execution: CarryExecutionView;
  action: CarryActionView | null;
  command: RuntimeCommandView | null;
  linkedRebalanceProposal: RebalanceProposalView | null;
  venueSnapshots: CarryVenueView[];
  steps: CarryExecutionStepView[];
  timeline: CarryExecutionTimelineEntry[];
}

export interface CarryActionDetailView {
  action: CarryActionView;
  plannedOrders: CarryActionPlannedOrderView[];
  latestCommand: RuntimeCommandView | null;
  executions: CarryExecutionView[];
  linkedRebalanceProposal: RebalanceProposalView | null;
}

export interface TreasurySummaryView {
  treasuryRunId: string;
  sourceRunId: string | null;
  sleeveId: string;
  simulated: boolean;
  policy: TreasuryPolicy;
  reserveStatus: {
    totalCapitalUsd: string;
    idleCapitalUsd: string;
    allocatedCapitalUsd: string;
    requiredReserveUsd: string;
    currentReserveUsd: string;
    reserveCoveragePct: string;
    surplusCapitalUsd: string;
    reserveShortfallUsd: string;
  };
  actionCount: number;
  alerts: string[];
  concentrationLimitBreached: boolean;
  evaluatedAt: string;
  updatedAt: string;
}

export interface TreasuryAllocationView {
  treasuryRunId: string;
  venueId: string;
  venueName: string;
  venueMode: 'simulated' | 'live';
  liquidityTier: 'instant' | 'same_day' | 'delayed';
  healthy: boolean;
  aprBps: number;
  currentAllocationUsd: string;
  withdrawalAvailableUsd: string;
  availableCapacityUsd: string;
  concentrationPct: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface TreasuryActionView {
  id: string;
  treasuryRunId: string;
  linkedRebalanceProposalId: string | null;
  actionType: TreasuryActionType;
  status: TreasuryExecutionStatus;
  readiness: TreasuryActionReadiness;
  executable: boolean;
  blockedReasons: TreasuryActionBlockedReason[];
  approvalRequirement: TreasuryApprovalRequirement;
  venueId: string | null;
  venueName: string | null;
  venueMode: 'simulated' | 'live' | 'reserve';
  amountUsd: string;
  reasonCode: string;
  summary: string;
  details: Record<string, unknown>;
  actorId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  executionRequestedBy: string | null;
  executionRequestedAt: string | null;
  linkedCommandId: string | null;
  latestExecutionId: string | null;
  simulated: boolean;
  executionMode: 'dry-run' | 'live';
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryPolicyView {
  treasuryRunId: string;
  policy: TreasuryPolicy;
  updatedAt: string;
}

export interface TreasuryActionDetailView {
  action: TreasuryActionView;
  latestCommand: RuntimeCommandView | null;
  executions: TreasuryExecutionView[];
  timeline: TreasuryActionTimelineEntry[];
  linkedRebalanceProposal: RebalanceProposalView | null;
  venue: TreasuryVenueView | null;
  summary: TreasurySummaryView | null;
  policy: TreasuryPolicyView | null;
}

export interface TreasuryExecutionView {
  id: string;
  treasuryActionId: string;
  treasuryRunId: string;
  commandId: string | null;
  status: TreasuryExecutionStatus;
  executionMode: 'dry-run' | 'live';
  venueMode: 'simulated' | 'live' | 'reserve';
  simulated: boolean;
  requestedBy: string;
  startedBy: string | null;
  blockedReasons: TreasuryActionBlockedReason[];
  outcomeSummary: string | null;
  outcome: Record<string, unknown>;
  venueExecutionReference: string | null;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface TreasuryExecutionDetailView {
  execution: TreasuryExecutionView;
  action: TreasuryActionView | null;
  command: RuntimeCommandView | null;
  linkedRebalanceProposal: RebalanceProposalView | null;
  executionKind: 'venue_execution' | 'budget_state_application';
  venue: TreasuryVenueView | null;
  timeline: TreasuryActionTimelineEntry[];
}

export interface TreasuryActionTimelineEntry {
  id: string;
  eventType:
    | 'recommended'
    | 'approved'
    | 'queued'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'command_linked'
    | 'execution_recorded';
  at: string;
  actorId: string | null;
  status: TreasuryExecutionStatus | null;
  summary: string;
  linkedCommandId: string | null;
  linkedExecutionId: string | null;
  details: Record<string, unknown>;
}

export interface TreasuryVenueView {
  venueId: string;
  venueName: string;
  venueMode: 'simulated' | 'live';
  liquidityTier: 'instant' | 'same_day' | 'delayed';
  healthy: boolean;
  aprBps: number;
  currentAllocationUsd: string;
  withdrawalAvailableUsd: string;
  availableCapacityUsd: string;
  concentrationPct: string;
  executionSupported: boolean;
  supportsAllocation: boolean;
  supportsReduction: boolean;
  readOnly: boolean;
  approvedForLiveUse: boolean;
  onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
  missingPrerequisites: string[];
  readinessLabel: string;
  simulationState: 'simulated' | 'real';
  lastSnapshotAt: string;
  metadata: Record<string, unknown>;
}

export interface TreasuryVenueDetailView {
  venue: TreasuryVenueView;
  policy: TreasuryPolicyView | null;
  latestSummary: TreasurySummaryView | null;
  recentActions: TreasuryActionView[];
  recentExecutions: TreasuryExecutionView[];
}

export interface RuntimeMismatchDetailView {
  mismatch: RuntimeMismatchView;
  linkedCommand: RuntimeCommandView | null;
  recoveryEvents: RuntimeRecoveryEventView[];
  remediationHistory: RuntimeMismatchRemediationView[];
  latestRemediation: RuntimeMismatchRemediationView | null;
  reconciliationFindings: RuntimeReconciliationFindingView[];
  latestReconciliationFinding: RuntimeReconciliationFindingView | null;
  recommendedRemediationTypes: RuntimeRemediationActionType[];
  isActionable: boolean;
  remediationInFlight: boolean;
}

export interface RuntimeMismatchSummaryView {
  activeMismatchCount: number;
  statusCounts: Record<RuntimeMismatchStatus, number>;
}

export interface PortfolioSummaryView {
  totalNav: string;
  grossExposure: string;
  netExposure: string;
  liquidityReserve: string;
  openPositionCount: number;
  dailyPnl: string;
  cumulativePnl: string;
  sleeves: Array<{
    sleeveId: string;
    nav: string;
    allocationPct: number;
  }>;
  venueExposures: Record<string, string>;
  assetExposures: Record<string, string>;
  updatedAt: string;
}

export interface PortfolioSnapshotView extends PortfolioSummaryView {}

export interface PnlSummaryView {
  dailyPnl: string;
  cumulativePnl: string;
  lastSnapshotAt: string | null;
}

export interface RiskSummaryView {
  summary: RiskSummary;
  approvedIntentCount: number;
  rejectedIntentCount: number;
  capturedAt: string;
}

export interface RiskBreachView {
  id: string;
  breachType: string;
  severity: string;
  description: string;
  triggeredAt: string;
  resolvedAt: string | null;
  details: Record<string, unknown>;
}

export interface OrderView {
  clientOrderId: string;
  runId: string | null;
  sleeveId: string;
  opportunityId: string | null;
  venueId: string;
  venueOrderId: string | null;
  asset: string;
  side: string;
  orderType: string;
  executionMode: string;
  requestedSize: string;
  requestedPrice: string | null;
  filledSize: string;
  averageFillPrice: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  reduceOnly: boolean;
  metadata: Record<string, unknown>;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PositionView {
  id: string;
  sleeveId: string;
  venueId: string;
  asset: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
  fundingAccrued: string;
  hedgeState: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  updatedAt: string;
}

export interface OpportunityView {
  opportunityId: string;
  runId: string;
  sleeveId: string;
  asset: string;
  opportunityType: string;
  expectedAnnualYieldPct: string;
  netYieldPct: string;
  confidenceScore: string;
  detectedAt: string;
  expiresAt: string;
  approved: boolean;
  payload: Record<string, unknown>;
}

export interface AuditEventView {
  eventId: string;
  eventType: string;
  occurredAt: string;
  actorType: string;
  actorId: string;
  sleeveId: string | null;
  correlationId: string | null;
  data: Record<string, unknown>;
}

export interface RuntimeCycleOutcome {
  runId: string;
  opportunitiesDetected: number;
  opportunitiesApproved: number;
  intentsGenerated: number;
  intentsApproved: number;
  intentsRejected: number;
  intentsExecuted: number;
}

export interface RuntimeIntentRecord {
  riskAssessment: RiskAssessment;
  approved: boolean;
}

export interface RuntimeReadApi {
  getPortfolioSummary(): Promise<PortfolioSummaryView | null>;
  listPortfolioSnapshots(limit?: number): Promise<PortfolioSnapshotView[]>;
  getPnlSummary(): Promise<PnlSummaryView>;
  getRiskSummary(): Promise<RiskSummaryView | null>;
  listRiskBreaches(limit?: number): Promise<RiskBreachView[]>;
  listOrders(limit?: number): Promise<OrderView[]>;
  getOrder(clientOrderId: string): Promise<OrderView | null>;
  listPositions(limit?: number): Promise<PositionView[]>;
  getPosition(id: string): Promise<PositionView | null>;
  listOpportunities(limit?: number): Promise<OpportunityView[]>;
  listRecentEvents(limit?: number): Promise<AuditEventView[]>;
  getRuntimeStatus(): Promise<RuntimeStatusView>;
  listCarryRecommendations(limit?: number): Promise<CarryActionView[]>;
  listCarryActions(limit?: number): Promise<CarryActionView[]>;
  getCarryAction(actionId: string): Promise<CarryActionDetailView | null>;
  listCarryExecutions(limit?: number): Promise<CarryExecutionView[]>;
  listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]>;
  getCarryExecution(executionId: string): Promise<CarryExecutionDetailView | null>;
  listCarryVenues(limit?: number): Promise<CarryVenueView[]>;
  getAllocatorSummary(): Promise<AllocatorSummaryView | null>;
  listAllocatorTargets(limit?: number): Promise<AllocatorSleeveTargetView[]>;
  listAllocatorRuns(limit?: number): Promise<AllocatorRunView[]>;
  getAllocatorDecision(allocatorRunId: string): Promise<AllocatorDecisionDetailView | null>;
  listRebalanceProposals(limit?: number): Promise<RebalanceProposalView[]>;
  listRebalanceProposalsForDecision(allocatorRunId: string): Promise<RebalanceProposalView[]>;
  listRebalanceBundles(limit?: number): Promise<RebalanceBundleView[]>;
  getRebalanceBundle(bundleId: string): Promise<RebalanceBundleDetailView | null>;
  getRebalanceBundleForProposal(proposalId: string): Promise<RebalanceBundleDetailView | null>;
  getRebalanceProposal(proposalId: string): Promise<RebalanceProposalDetailView | null>;
  getRebalanceExecutionGraph(proposalId: string): Promise<RebalanceExecutionGraphView | null>;
  getRebalanceTimeline(proposalId: string): Promise<RebalanceExecutionTimelineEntry[]>;
  getRebalanceCurrent(): Promise<RebalanceCurrentView | null>;
  getTreasurySummary(): Promise<TreasurySummaryView | null>;
  listTreasuryAllocations(limit?: number): Promise<TreasuryAllocationView[]>;
  getTreasuryPolicy(): Promise<TreasuryPolicyView | null>;
  listTreasuryActions(limit?: number): Promise<TreasuryActionView[]>;
  getTreasuryAction(actionId: string): Promise<TreasuryActionDetailView | null>;
  listTreasuryExecutions(limit?: number): Promise<TreasuryExecutionView[]>;
  listTreasuryExecutionsForAction(actionId: string): Promise<TreasuryExecutionView[]>;
  getTreasuryExecution(executionId: string): Promise<TreasuryExecutionView | null>;
  getTreasuryExecutionDetail(executionId: string): Promise<TreasuryExecutionDetailView | null>;
  listTreasuryVenues(limit?: number): Promise<TreasuryVenueView[]>;
  getTreasuryVenue(venueId: string): Promise<TreasuryVenueDetailView | null>;
}
