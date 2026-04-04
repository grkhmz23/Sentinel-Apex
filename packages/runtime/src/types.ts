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
  CarryStrategyProfile,
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
import type {
  CanonicalMarketIdentity,
  VenueAccountStateSnapshot,
  VenueBalanceStateSnapshot,
  VenueCapacityStateSnapshot,
  VenueDerivativeAccountStateSnapshot,
  VenueDerivativeHealthStateSnapshot,
  VenueDerivativePositionEntrySnapshot,
  VenueDerivativePositionStateSnapshot,
  VenueExecutionEventEvidence,
  VenueExecutionReferenceStateSnapshot,
  VenueExposureStateSnapshot,
  VenueOrderEntrySnapshot,
  VenueOrderStateSnapshot,
  VenueTruthCoverage,
  VenueTruthCoverageStatus,
  VenueTruthSourceDepth,
  VenueTruthSnapshotCompleteness,
  VenueTruthDataProvenance,
  VenueTruthSourceMetadata,
} from '@sentinel-apex/venue-adapters';

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
  | 'command_outcome_mismatch'
  | 'missing_venue_truth_snapshot'
  | 'stale_venue_truth_snapshot'
  | 'venue_truth_unavailable'
  | 'venue_truth_partial_coverage'
  | 'venue_execution_reference_mismatch'
  | 'drift_position_mismatch'
  | 'drift_order_inventory_mismatch'
  | 'drift_subaccount_identity_mismatch'
  | 'drift_health_state_mismatch'
  | 'drift_market_identity_mismatch'
  | 'drift_position_identity_gap'
  | 'drift_partial_health_comparison'
  | 'drift_partial_market_identity_comparison'
  | 'drift_truth_comparison_gap'
  | 'stale_internal_derivative_state';

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

export type RebalanceBundleRecoveryActionType = 'requeue_child_execution';
export type RebalanceBundleRecoveryTargetChildType =
  | 'carry_action'
  | 'treasury_action'
  | 'rebalance_proposal';
export type RebalanceBundleRecoveryEligibilityState = 'eligible' | 'blocked';
export type RebalanceBundleRecoveryStatus =
  | 'requested'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';
export type RebalanceBundleRecoveryBlockedReasonCode =
  | 'bundle_not_actionable'
  | 'runtime_not_ready'
  | 'target_child_not_found'
  | 'target_child_unsupported'
  | 'target_child_not_retryable'
  | 'target_child_not_terminal'
  | 'target_child_already_completed'
  | 'target_child_has_inflight_command'
  | 'target_child_has_safe_execution_gap'
  | 'carry_execution_partial_progress_detected'
  | 'treasury_execution_side_effect_detected'
  | 'target_child_remains_blocked'
  | 'approval_requirement_not_met'
  | 'proposal_requeue_not_supported';
export type RebalanceBundleRecoveryBlockedReasonCategory =
  | 'bundle_state'
  | 'runtime'
  | 'target_child'
  | 'safety'
  | 'approval';

export interface RebalanceBundleRecoveryBlockedReason {
  code: RebalanceBundleRecoveryBlockedReasonCode;
  category: RebalanceBundleRecoveryBlockedReasonCategory;
  message: string;
  operatorAction: string;
  details: Record<string, unknown>;
}

export interface RebalanceBundleRecoveryCandidateView {
  id: string;
  bundleId: string;
  proposalId: string;
  recoveryActionType: RebalanceBundleRecoveryActionType;
  targetChildType: RebalanceBundleRecoveryTargetChildType;
  targetChildId: string;
  targetChildStatus: string;
  targetChildSummary: string;
  targetCommandType: RuntimeCommandType | null;
  approvalRequirement: 'operator' | 'admin';
  eligibilityState: RebalanceBundleRecoveryEligibilityState;
  blockedReasons: RebalanceBundleRecoveryBlockedReason[];
  executionMode: 'dry-run' | 'live';
  simulated: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceBundleRecoveryActionView {
  id: string;
  bundleId: string;
  proposalId: string;
  recoveryActionType: RebalanceBundleRecoveryActionType;
  targetChildType: RebalanceBundleRecoveryTargetChildType;
  targetChildId: string;
  targetChildStatus: string;
  targetChildSummary: string;
  eligibilityState: RebalanceBundleRecoveryEligibilityState;
  blockedReasons: RebalanceBundleRecoveryBlockedReason[];
  approvalRequirement: 'operator' | 'admin';
  status: RebalanceBundleRecoveryStatus;
  requestedBy: string;
  requestedAt: string;
  note: string | null;
  linkedCommandId: string | null;
  targetCommandType: RuntimeCommandType | null;
  linkedCarryActionId: string | null;
  linkedTreasuryActionId: string | null;
  outcomeSummary: string | null;
  outcome: Record<string, unknown>;
  lastError: string | null;
  executionMode: 'dry-run' | 'live';
  simulated: boolean;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export type RebalanceBundleResolutionActionType =
  | 'accept_partial_application'
  | 'mark_bundle_manually_resolved'
  | 'escalate_bundle_for_review';
export type RebalanceBundleResolutionState =
  | 'unresolved'
  | 'accepted_partial'
  | 'manually_resolved'
  | 'escalated';
export type RebalanceBundleResolutionEligibilityState = 'eligible' | 'blocked';
export type RebalanceBundleResolutionActionStatus = 'completed' | 'blocked' | 'cancelled';
export type RebalanceBundleResolutionBlockedReasonCode =
  | 'bundle_not_actionable'
  | 'bundle_has_inflight_children'
  | 'bundle_not_partial_application'
  | 'note_required'
  | 'approval_requirement_not_met'
  | 'resolution_state_already_current';
export type RebalanceBundleResolutionBlockedReasonCategory =
  | 'bundle_state'
  | 'safety'
  | 'validation'
  | 'approval';

export interface RebalanceBundleResolutionBlockedReason {
  code: RebalanceBundleResolutionBlockedReasonCode;
  category: RebalanceBundleResolutionBlockedReasonCategory;
  message: string;
  operatorAction: string;
  details: Record<string, unknown>;
}

export interface RebalanceBundleResolutionOptionView {
  id: string;
  bundleId: string;
  proposalId: string;
  resolutionActionType: RebalanceBundleResolutionActionType;
  targetResolutionState: RebalanceBundleResolutionState;
  approvalRequirement: 'operator' | 'admin';
  eligibilityState: RebalanceBundleResolutionEligibilityState;
  blockedReasons: RebalanceBundleResolutionBlockedReason[];
  noteRequired: boolean;
  summary: string;
  operatorAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceBundleResolutionActionView {
  id: string;
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
  requestedBy: string;
  requestedAt: string;
  completedBy: string | null;
  completedAt: string | null;
  outcomeSummary: string | null;
  blockedReasons: RebalanceBundleResolutionBlockedReason[];
  updatedAt: string;
}

export type RebalanceBundleEscalationStatus =
  | 'open'
  | 'acknowledged'
  | 'in_review'
  | 'resolved';
export type RebalanceEscalationQueueState = 'overdue' | 'due_soon' | 'unassigned' | 'on_track' | 'resolved';
export type RebalanceBundleEscalationEventType =
  | 'created'
  | 'assigned'
  | 'acknowledged'
  | 'review_started'
  | 'resolved';
export type RebalanceBundleEscalationEligibilityState = 'eligible' | 'blocked';
export type RebalanceBundleEscalationTransitionType =
  | 'assign'
  | 'acknowledge'
  | 'start_review'
  | 'close';
export type RebalanceBundleEscalationBlockedReasonCode =
  | 'bundle_not_escalated'
  | 'escalation_not_found'
  | 'escalation_already_resolved'
  | 'escalation_owner_required'
  | 'actor_not_owner'
  | 'invalid_status_transition'
  | 'note_required'
  | 'assignee_required'
  | 'assignee_already_current';
export type RebalanceBundleEscalationBlockedReasonCategory =
  | 'bundle_state'
  | 'escalation_state'
  | 'ownership'
  | 'validation';

export interface RebalanceBundleEscalationBlockedReason {
  code: RebalanceBundleEscalationBlockedReasonCode;
  category: RebalanceBundleEscalationBlockedReasonCategory;
  message: string;
  operatorAction: string;
  details: Record<string, unknown>;
}

export interface RebalanceBundleEscalationView {
  id: string;
  bundleId: string;
  proposalId: string;
  sourceResolutionActionId: string | null;
  status: RebalanceBundleEscalationStatus;
  isOpen: boolean;
  ownerId: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  dueAt: string | null;
  handoffNote: string | null;
  reviewNote: string | null;
  resolutionNote: string | null;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceBundleEscalationEventView {
  id: string;
  escalationId: string;
  bundleId: string;
  proposalId: string;
  eventType: RebalanceBundleEscalationEventType;
  fromStatus: RebalanceBundleEscalationStatus | null;
  toStatus: RebalanceBundleEscalationStatus;
  actorId: string;
  ownerId: string | null;
  note: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface RebalanceBundleEscalationTransitionView {
  id: string;
  bundleId: string;
  escalationId: string | null;
  transitionType: RebalanceBundleEscalationTransitionType;
  targetStatus: RebalanceBundleEscalationStatus;
  approvalRequirement: 'operator' | 'admin';
  eligibilityState: RebalanceBundleEscalationEligibilityState;
  blockedReasons: RebalanceBundleEscalationBlockedReason[];
  noteRequired: boolean;
  assigneeRequired: boolean;
  summary: string;
  operatorAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceEscalationQueueFilters {
  status?: RebalanceBundleEscalationStatus;
  ownerId?: string;
  openState?: 'open' | 'closed';
  queueState?: 'overdue' | 'due_soon' | 'unassigned';
  limit?: number;
  sortBy?: 'due_at' | 'latest_activity' | 'created_at' | 'updated_at';
  sortDirection?: 'asc' | 'desc';
}

export interface RebalanceEscalationQueueItemView {
  escalationId: string;
  bundleId: string;
  proposalId: string;
  allocatorRunId: string;
  escalationStatus: RebalanceBundleEscalationStatus;
  escalationQueueState: RebalanceEscalationQueueState;
  isOpen: boolean;
  ownerId: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  acknowledgedAt: string | null;
  inReviewAt: string | null;
  dueAt: string | null;
  latestActivityAt: string;
  latestEventType: RebalanceBundleEscalationEventType | null;
  latestEventSummary: string | null;
  bundleStatus: RebalanceBundleStatus;
  interventionRecommendation: RebalanceBundleInterventionRecommendation;
  resolutionState: RebalanceBundleResolutionState;
  outcomeClassification: RebalanceBundleOutcomeClassification;
  failedChildCount: number;
  blockedChildCount: number;
  pendingChildCount: number;
  totalChildCount: number;
  childSleeves: Array<'carry' | 'treasury'>;
  executionMode: RebalanceExecutionMode;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceEscalationQueueSummaryView {
  total: number;
  open: number;
  acknowledged: number;
  inReview: number;
  resolved: number;
  overdue: number;
  dueSoon: number;
  unassigned: number;
  mine: number;
}

export type RebalanceBundleChildInspectionProgressState =
  | 'completed'
  | 'partial_progress'
  | 'retryable_failure'
  | 'failed_without_progress'
  | 'blocked_before_progress'
  | 'non_retryable'
  | 'inflight'
  | 'pending';
export type RebalanceBundleChildRetryability = 'retryable' | 'non_retryable' | 'not_applicable';

export interface RebalanceBundleChildInspectionView {
  childType: 'carry_action' | 'treasury_action';
  sleeveId: 'carry' | 'treasury';
  childId: string;
  summary: string;
  actionStatus: string;
  latestExecutionId: string | null;
  latestExecutionStatus: string | null;
  progressState: RebalanceBundleChildInspectionProgressState;
  retryability: RebalanceBundleChildRetryability;
  applied: boolean;
  progressRecorded: boolean;
  blockedBeforeApplication: boolean;
  retryCandidateId: string | null;
  retryBlockedReasons: RebalanceBundleRecoveryBlockedReason[];
  evidence: string[];
}

export interface RebalanceBundlePartialProgressSleeveView {
  sleeveId: 'carry' | 'treasury';
  totalChildren: number;
  appliedChildren: number;
  progressRecordedChildren: number;
  retryableChildren: number;
  nonRetryableChildren: number;
  blockedBeforeApplicationChildren: number;
}

export interface RebalanceBundlePartialProgressView {
  totalChildren: number;
  appliedChildren: number;
  progressRecordedChildren: number;
  retryableChildren: number;
  nonRetryableChildren: number;
  blockedBeforeApplicationChildren: number;
  inflightChildren: number;
  sleeves: RebalanceBundlePartialProgressSleeveView[];
  children: RebalanceBundleChildInspectionView[];
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
    | 'downstream_execution_recorded'
    | 'recovery_requested'
    | 'recovery_queued'
    | 'recovery_completed'
    | 'recovery_failed'
    | 'recovery_blocked'
    | 'resolution_completed'
    | 'resolution_blocked'
    | 'escalation_created'
    | 'escalation_assigned'
    | 'escalation_acknowledged'
    | 'escalation_review_started'
    | 'escalation_resolved';
  at: string;
  actorId: string | null;
  sleeveId: 'allocator' | 'carry' | 'treasury';
  scope:
    | 'proposal'
    | 'command'
    | 'rebalance_execution'
    | 'downstream_action'
    | 'downstream_execution'
    | 'recovery_action'
    | 'resolution_action'
    | 'escalation';
  status: string | null;
  summary: string;
  linkedCommandId: string | null;
  linkedRebalanceExecutionId: string | null;
  linkedActionId: string | null;
  linkedExecutionId: string | null;
  linkedRecoveryActionId: string | null;
  linkedResolutionActionId: string | null;
  linkedEscalationId: string | null;
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
  recoveryActions: RebalanceBundleRecoveryActionView[];
  resolutionActions: RebalanceBundleResolutionActionView[];
  escalation: RebalanceBundleEscalationView | null;
  escalationHistory: RebalanceBundleEscalationEventView[];
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
  | 'unresolved_partial_application'
  | 'accepted_partial_application'
  | 'manually_resolved'
  | 'escalated_for_review';
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
  resolutionState: RebalanceBundleResolutionState;
  latestResolutionActionId: string | null;
  resolutionSummary: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  latestEscalationId: string | null;
  escalationStatus: RebalanceBundleEscalationStatus | null;
  escalationOwnerId: string | null;
  escalationAssignedAt: string | null;
  escalationDueAt: string | null;
  escalationSummary: string | null;
  executionMode: RebalanceExecutionMode;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RebalanceBundleDetailView {
  bundle: RebalanceBundleView;
  graph: RebalanceExecutionGraphView;
  partialProgress: RebalanceBundlePartialProgressView;
  recoveryCandidates: RebalanceBundleRecoveryCandidateView[];
  recoveryActions: RebalanceBundleRecoveryActionView[];
  resolutionOptions: RebalanceBundleResolutionOptionView[];
  resolutionActions: RebalanceBundleResolutionActionView[];
  escalation: RebalanceBundleEscalationView | null;
  escalationHistory: RebalanceBundleEscalationEventView[];
  escalationTransitions: RebalanceBundleEscalationTransitionView[];
}

export type ConnectorCapabilityClass =
  | 'simulated_only'
  | 'real_readonly'
  | 'execution_capable';

export type ConnectorPromotionStatus =
  | 'not_requested'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type ConnectorEffectivePosture =
  | 'simulated_only'
  | 'real_readonly'
  | 'execution_capable_unapproved'
  | 'promotion_pending'
  | 'approved_for_live'
  | 'rejected'
  | 'suspended';

export type ConnectorPromotionTargetPosture = 'approved_for_live';
export type ConnectorReadOnlyValidationState = 'not_applicable' | 'complete' | 'partial' | 'insufficient';
export type ConnectorPromotionEventType = 'requested' | 'approved' | 'rejected' | 'suspended';
export type ConnectorPostTradeConfirmationStatus = 'not_required' | 'confirmed' | 'blocked';
export type CarryStrategyProfileView = CarryStrategyProfile;
export type CarryStrategyEligibilityView = CarryStrategyProfileView['eligibility'];
export type CarryStrategyRuleResultView = CarryStrategyEligibilityView['ruleResults'][number];

export interface ConnectorConfigReadinessMarkerView {
  key: string;
  ready: boolean;
  summary: string;
}

export type CarryExecutionPostTradeConfirmationStatus =
  | 'confirmed_full'
  | 'confirmed_partial'
  | 'confirmed_partial_event_only'
  | 'confirmed_partial_position_only'
  | 'pending_event'
  | 'pending_position_delta'
  | 'conflicting_event'
  | 'conflicting_event_vs_position'
  | 'missing_reference'
  | 'invalid_position_delta'
  | 'insufficient_context';

export type CarryExecutionPostTradeConfirmationBasis =
  | 'event_and_position'
  | 'event_only'
  | 'position_only'
  | 'signature_only'
  | 'conflicting'
  | 'insufficient';

export interface CarryExecutionPostTradeConfirmationView {
  status: CarryExecutionPostTradeConfirmationStatus;
  evidenceBasis: CarryExecutionPostTradeConfirmationBasis;
  summary: string;
  evaluatedAt: string;
  referenceObserved: boolean;
  referenceObservedAt: string | null;
  marketKey: string | null;
  marketSymbol: string | null;
  requestedSize: string;
  confirmedSize: string | null;
  remainingSize: string | null;
  preTradePositionSide: 'long' | 'short' | 'flat' | null;
  preTradePositionSize: string | null;
  observedPositionSide: 'long' | 'short' | 'flat' | null;
  observedPositionSize: string | null;
  eventEvidence: VenueExecutionEventEvidence | null;
  blockedReason: string | null;
}

export interface ConnectorPostTradeConfirmationEntryView
  extends CarryExecutionPostTradeConfirmationView {
  stepId: string;
  carryExecutionId: string;
  carryActionId: string;
  intentId: string;
  clientOrderId: string | null;
  executionReference: string;
  venueId: string;
}

export interface ConnectorPostTradeConfirmationEvidenceView {
  status: ConnectorPostTradeConfirmationStatus;
  summary: string;
  evaluatedAt: string;
  recentExecutionCount: number;
  confirmedFullCount: number;
  confirmedPartialCount: number;
  confirmedPartialEventOnlyCount: number;
  confirmedPartialPositionOnlyCount: number;
  pendingCount: number;
  pendingEventCount: number;
  pendingPositionDeltaCount: number;
  conflictingEventCount: number;
  conflictingEventVsPositionCount: number;
  missingReferenceCount: number;
  invalidCount: number;
  insufficientContextCount: number;
  latestConfirmedAt: string | null;
  blockingReasons: string[];
  entries: ConnectorPostTradeConfirmationEntryView[];
}

export interface ConnectorReadinessEvidenceView {
  venueId: string;
  venueName: string;
  connectorType: string;
  sleeveApplicability: VenueTruthSleeve[];
  truthMode: VenueTruthMode;
  capabilityClass: ConnectorCapabilityClass;
  executionSupport: boolean;
  readOnlySupport: boolean;
  snapshotFreshness: VenueSnapshotFreshness;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  healthy: boolean;
  healthState: VenueHealthState;
  degradedReason: string | null;
  lastSnapshotAt: string;
  lastSuccessfulSnapshotAt: string | null;
  truthCoverageAvailableCount: number;
  truthCoveragePartialCount: number;
  truthCoverageUnsupportedCount: number;
  readOnlyValidationState: ConnectorReadOnlyValidationState;
  configReadiness: ConnectorConfigReadinessMarkerView[];
  missingPrerequisites: string[];
  blockingReasons: string[];
  eligibleForPromotion: boolean;
  postTradeConfirmation: ConnectorPostTradeConfirmationEvidenceView;
}

export interface ConnectorPromotionSummaryView {
  promotionId: string | null;
  requestedTargetPosture: ConnectorPromotionTargetPosture | null;
  capabilityClass: ConnectorCapabilityClass;
  promotionStatus: ConnectorPromotionStatus;
  effectivePosture: ConnectorEffectivePosture;
  approvedForLiveUse: boolean;
  sensitiveExecutionEligible: boolean;
  requestedBy: string | null;
  requestedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  suspendedBy: string | null;
  suspendedAt: string | null;
  latestNote: string | null;
  blockers: string[];
}

export interface ConnectorPromotionEventView {
  id: string;
  promotionId: string;
  venueId: string;
  eventType: ConnectorPromotionEventType;
  fromStatus: ConnectorPromotionStatus | null;
  toStatus: ConnectorPromotionStatus;
  effectivePosture: ConnectorEffectivePosture;
  requestedTargetPosture: ConnectorPromotionTargetPosture;
  actorId: string;
  note: string | null;
  evidence: ConnectorReadinessEvidenceView;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface ConnectorPromotionDetailView {
  venueId: string;
  venueName: string;
  connectorType: string;
  sleeveApplicability: VenueTruthSleeve[];
  current: ConnectorPromotionSummaryView;
  evidence: ConnectorReadinessEvidenceView;
  history: ConnectorPromotionEventView[];
}

export interface ConnectorPromotionOverviewView {
  totalVenues: number;
  candidates: number;
  pendingReview: number;
  approved: number;
  approvedAndEligible: number;
  rejected: number;
  suspended: number;
  blockedByEvidence: number;
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
  promotion?: ConnectorPromotionSummaryView;
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
  marketIdentity: CanonicalMarketIdentity | null;
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
  strategyProfile: CarryStrategyProfileView;
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
  postTradeConfirmation: CarryExecutionPostTradeConfirmationView | null;
  lastError: string | null;
  marketIdentity: CanonicalMarketIdentity | null;
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
  promotion?: ConnectorPromotionSummaryView;
  metadata: Record<string, unknown>;
}

export interface TreasuryVenueDetailView {
  venue: TreasuryVenueView;
  policy: TreasuryPolicyView | null;
  latestSummary: TreasurySummaryView | null;
  recentActions: TreasuryActionView[];
  recentExecutions: TreasuryExecutionView[];
}

export type VenueTruthMode = 'simulated' | 'real';
export type VenueTruthSleeve = 'carry' | 'treasury';
export type VenueTruthProfile = 'minimal' | 'generic_wallet' | 'capacity_only' | 'derivative_aware';
export type VenueOnboardingState = 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
export type VenueHealthState = 'healthy' | 'degraded' | 'unavailable';
export type VenueSnapshotFreshness = 'fresh' | 'stale' | 'missing';

export type {
  VenueAccountStateSnapshot,
  VenueBalanceStateSnapshot,
  VenueCapacityStateSnapshot,
  VenueDerivativeAccountStateSnapshot,
  VenueDerivativeHealthStateSnapshot,
  VenueDerivativePositionStateSnapshot,
  VenueExecutionReferenceStateSnapshot,
  VenueExposureStateSnapshot,
  VenueOrderStateSnapshot,
  VenueTruthCoverageStatus,
  VenueTruthDataProvenance,
  VenueTruthSourceDepth,
  VenueTruthCoverage,
  VenueTruthSnapshotCompleteness,
  VenueTruthSourceMetadata,
};

export interface VenueTruthCoverageAggregateView {
  available: number;
  partial: number;
  unsupported: number;
}

export interface VenueTruthComparisonCoverageItemView {
  status: VenueTruthCoverageStatus;
  reason: string | null;
}

export interface VenueTruthComparisonCoverageView {
  executionReferences: VenueTruthComparisonCoverageItemView;
  positionInventory: VenueTruthComparisonCoverageItemView;
  healthState: VenueTruthComparisonCoverageItemView;
  orderInventory: VenueTruthComparisonCoverageItemView;
  notes: string[];
}

export type InternalDerivativeDataClassification =
  | 'canonical'
  | 'derived'
  | 'estimated'
  | 'unsupported';
export type InternalDerivativeMarketType = 'perp' | 'spot' | 'unknown';
export type InternalDerivativePositionSide = 'long' | 'short' | 'flat';
export type InternalDerivativeComparisonStatus =
  | 'matched'
  | 'mismatched'
  | 'internal_only'
  | 'external_only'
  | 'not_comparable';
export type InternalDerivativeMarketIdentityConfidence =
  | 'exact'
  | 'derived'
  | 'partial'
  | 'unsupported';
export type InternalDerivativeMarketIdentityKeyType =
  | 'market_index'
  | 'market_key'
  | 'market_symbol'
  | 'asset_market_type'
  | 'unsupported';
export type InternalDerivativeMarketIdentityComparisonMode =
  | 'exact'
  | 'partial'
  | 'unsupported';
export type InternalDerivativeHealthComparisonMode =
  | 'status_band_only'
  | 'unsupported';
export type InternalDerivativeAccountLocatorMode =
  | 'user_account_address'
  | 'authority_subaccount'
  | 'unconfigured';

export interface InternalDerivativeCoverageItemView {
  status: VenueTruthCoverageStatus;
  reason: string | null;
  limitations: string[];
}

export interface InternalDerivativeCoverageView {
  accountState: InternalDerivativeCoverageItemView;
  positionState: InternalDerivativeCoverageItemView;
  healthState: InternalDerivativeCoverageItemView;
  orderState: InternalDerivativeCoverageItemView;
}

export interface InternalDerivativeDataProvenanceView {
  classification: InternalDerivativeDataClassification;
  source: string;
  notes: string[];
}

export interface InternalDerivativeAccountStateView {
  venueId: string;
  venueName: string;
  configured: boolean;
  accountLocatorMode: InternalDerivativeAccountLocatorMode;
  accountAddress: string | null;
  authorityAddress: string | null;
  subaccountId: number | null;
  accountLabel: string | null;
  methodology: string;
  notes: string[];
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativeMarketIdentityView {
  asset: string | null;
  marketType: InternalDerivativeMarketType;
  marketIndex: number | null;
  marketKey: string | null;
  marketSymbol: string | null;
  normalizedKey: string | null;
  normalizedKeyType: InternalDerivativeMarketIdentityKeyType;
  confidence: InternalDerivativeMarketIdentityConfidence;
  notes: string[];
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativePositionEntryView {
  positionKey: string;
  asset: string;
  marketType: InternalDerivativeMarketType;
  side: InternalDerivativePositionSide;
  netQuantity: string;
  averageEntryPrice: string | null;
  executedBuyQuantity: string;
  executedSellQuantity: string;
  fillCount: number;
  sourceOrderCount: number;
  firstFilledAt: string | null;
  lastFilledAt: string | null;
  marketIdentity: InternalDerivativeMarketIdentityView | null;
  metadata: Record<string, unknown>;
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativePositionStateView {
  positions: InternalDerivativePositionEntryView[];
  openPositionCount: number;
  methodology: string;
  notes: string[];
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativeOrderEntryView {
  orderKey: string;
  clientOrderId: string;
  venueOrderId: string | null;
  asset: string;
  marketType: InternalDerivativeMarketType;
  side: 'buy' | 'sell';
  status: string;
  requestedSize: string;
  filledSize: string;
  remainingSize: string;
  requestedPrice: string | null;
  reduceOnly: boolean;
  executionMode: string;
  comparableByVenueOrderId: boolean;
  submittedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  marketIdentity: InternalDerivativeMarketIdentityView | null;
  metadata: Record<string, unknown>;
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativeOrderStateView {
  openOrderCount: number;
  comparableOpenOrderCount: number;
  nonComparableOpenOrderCount: number;
  openOrders: InternalDerivativeOrderEntryView[];
  methodology: string;
  notes: string[];
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativeHealthStateView {
  healthStatus: 'healthy' | 'degraded' | 'liquidation_risk' | 'unknown';
  modelType: 'internal_risk_posture' | 'unsupported';
  comparisonMode: InternalDerivativeHealthComparisonMode;
  riskPosture: RiskSummary['riskLevel'] | null;
  collateralLikeUsd: string | null;
  liquidityReserveUsd: string | null;
  grossExposureUsd: string | null;
  netExposureUsd: string | null;
  venueExposureUsd: string | null;
  exposureToNavRatio: string | null;
  liquidityReservePct: number | null;
  leverage: string | null;
  openPositionCount: number | null;
  openOrderCount: number | null;
  openCircuitBreakers: string[];
  unsupportedReasons: string[];
  methodology: string;
  notes: string[];
  provenance: InternalDerivativeDataProvenanceView;
}

export interface InternalDerivativeSnapshotView {
  id: string;
  venueId: string;
  venueName: string;
  sourceComponent: string;
  sourceRunId: string | null;
  sourceReference: string | null;
  capturedAt: string;
  updatedAt: string;
  coverage: InternalDerivativeCoverageView;
  accountState: InternalDerivativeAccountStateView | null;
  positionState: InternalDerivativePositionStateView | null;
  healthState: InternalDerivativeHealthStateView | null;
  orderState: InternalDerivativeOrderStateView | null;
  metadata: Record<string, unknown>;
}

export interface VenueDerivativeAccountComparisonView {
  comparable: boolean;
  status: InternalDerivativeComparisonStatus;
  internalState: InternalDerivativeAccountStateView | null;
  externalState: VenueDerivativeAccountStateSnapshot | null;
  notes: string[];
}

export interface ExternalDerivativeMarketIdentityView {
  asset: string | null;
  marketType: InternalDerivativeMarketType;
  marketIndex: number | null;
  marketKey: string | null;
  marketSymbol: string | null;
  normalizedKey: string | null;
  normalizedKeyType: InternalDerivativeMarketIdentityKeyType;
  confidence: InternalDerivativeMarketIdentityConfidence;
  notes: string[];
  provenance: VenueTruthDataProvenance | null;
}

export interface DerivativeNormalizedMarketIdentityView {
  key: string | null;
  keyType: InternalDerivativeMarketIdentityKeyType;
  comparisonMode: InternalDerivativeMarketIdentityComparisonMode;
  notes: string[];
}

export interface VenueDerivativeMarketIdentityComparisonView {
  comparable: boolean;
  status: InternalDerivativeComparisonStatus;
  comparisonMode: InternalDerivativeMarketIdentityComparisonMode;
  internalIdentity: InternalDerivativeMarketIdentityView | null;
  externalIdentity: ExternalDerivativeMarketIdentityView | null;
  normalizedIdentity: DerivativeNormalizedMarketIdentityView | null;
  notes: string[];
}

export interface VenueDerivativePositionComparisonView {
  comparisonKey: string;
  asset: string;
  marketType: InternalDerivativeMarketType;
  comparable: boolean;
  status: InternalDerivativeComparisonStatus;
  quantityDelta: string | null;
  internalPosition: InternalDerivativePositionEntryView | null;
  externalPosition: VenueDerivativePositionEntrySnapshot | null;
  marketIdentityComparison: VenueDerivativeMarketIdentityComparisonView;
  notes: string[];
}

export interface VenueDerivativeOrderComparisonView {
  comparisonKey: string;
  comparable: boolean;
  status: InternalDerivativeComparisonStatus;
  remainingSizeDelta: string | null;
  internalOrder: InternalDerivativeOrderEntryView | null;
  externalOrder: VenueOrderEntrySnapshot | null;
  marketIdentityComparison: VenueDerivativeMarketIdentityComparisonView;
  notes: string[];
}

export interface VenueDerivativeHealthFieldComparisonView {
  field:
    | 'healthStatus'
    | 'collateralLikeUsd'
    | 'freeCollateralUsd'
    | 'initialMarginRequirementUsd'
    | 'maintenanceMarginRequirementUsd'
    | 'marginRatio'
    | 'leverage';
  comparable: boolean;
  status: InternalDerivativeComparisonStatus;
  internalValue: string | number | null;
  externalValue: string | number | null;
  reason: string | null;
}

export interface VenueDerivativeHealthComparisonView {
  comparable: boolean;
  status: InternalDerivativeComparisonStatus;
  comparisonMode: InternalDerivativeHealthComparisonMode;
  internalState: InternalDerivativeHealthStateView | null;
  externalState: VenueDerivativeHealthStateSnapshot | null;
  fields: VenueDerivativeHealthFieldComparisonView[];
  notes: string[];
}

export interface VenueDerivativeComparisonSummaryView {
  internalSnapshotAt: string | null;
  externalSnapshotAt: string | null;
  subaccountIdentity: VenueTruthComparisonCoverageItemView;
  positionInventory: VenueTruthComparisonCoverageItemView;
  marketIdentity: VenueTruthComparisonCoverageItemView;
  healthState: VenueTruthComparisonCoverageItemView;
  orderInventory: VenueTruthComparisonCoverageItemView;
  healthComparisonMode: InternalDerivativeHealthComparisonMode;
  exactPositionIdentityCount: number;
  partialPositionIdentityCount: number;
  positionIdentityGapCount: number;
  matchedPositionCount: number;
  mismatchedPositionCount: number;
  matchedOrderCount: number;
  mismatchedOrderCount: number;
  activeFindingCount: number;
  activeMismatchCount: number;
  notes: string[];
}

export interface VenueDerivativeComparisonDetailView {
  venueId: string;
  venueName: string;
  internalState: InternalDerivativeSnapshotView | null;
  externalSnapshot: VenueSnapshotView | null;
  summary: VenueDerivativeComparisonSummaryView;
  accountComparison: VenueDerivativeAccountComparisonView;
  positionComparisons: VenueDerivativePositionComparisonView[];
  orderComparisons: VenueDerivativeOrderComparisonView[];
  healthComparison: VenueDerivativeHealthComparisonView;
  activeFindings: RuntimeReconciliationFindingView[];
}

export interface VenueTruthConnectorDepthSummaryView {
  simulation: number;
  generic_rpc_readonly: number;
  drift_native_readonly: number;
  execution_capable: number;
}

export interface VenueTruthSummaryView {
  totalVenues: number;
  derivativeAwareVenues: number;
  genericWalletVenues: number;
  capacityOnlyVenues: number;
  connectorDepth: VenueTruthConnectorDepthSummaryView;
  completeSnapshots: number;
  partialSnapshots: number;
  minimalSnapshots: number;
  decodedDerivativeAccountVenues: number;
  decodedDerivativePositionVenues: number;
  healthMetricVenues: number;
  venueOpenOrderInventoryVenues: number;
  accountState: VenueTruthCoverageAggregateView;
  balanceState: VenueTruthCoverageAggregateView;
  capacityState: VenueTruthCoverageAggregateView;
  exposureState: VenueTruthCoverageAggregateView;
  derivativeAccountState: VenueTruthCoverageAggregateView;
  derivativePositionState: VenueTruthCoverageAggregateView;
  derivativeHealthState: VenueTruthCoverageAggregateView;
  orderState: VenueTruthCoverageAggregateView;
  executionReferences: VenueTruthCoverageAggregateView;
}

export interface VenueInventoryItemView {
  venueId: string;
  venueName: string;
  connectorType: string;
  sleeveApplicability: VenueTruthSleeve[];
  truthMode: VenueTruthMode;
  readOnlySupport: boolean;
  executionSupport: boolean;
  approvedForLiveUse: boolean;
  onboardingState: VenueOnboardingState;
  missingPrerequisites: string[];
  authRequirementsSummary: string[];
  healthy: boolean;
  healthState: VenueHealthState;
  degradedReason: string | null;
  truthProfile: VenueTruthProfile;
  latestSnapshotType: string;
  latestSnapshotSummary: string;
  latestErrorMessage: string | null;
  snapshotFreshness: VenueSnapshotFreshness;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  lastSnapshotAt: string;
  lastSuccessfulSnapshotAt: string | null;
  truthCoverage: VenueTruthCoverage;
  comparisonCoverage: VenueTruthComparisonCoverageView;
  sourceMetadata: VenueTruthSourceMetadata;
  executionConfirmationState: ConnectorPostTradeConfirmationEvidenceView | null;
  promotion?: ConnectorPromotionSummaryView;
  metadata: Record<string, unknown>;
}

export interface VenueSnapshotView {
  id: string;
  venueId: string;
  venueName: string;
  connectorType: string;
  sleeveApplicability: VenueTruthSleeve[];
  truthMode: VenueTruthMode;
  readOnlySupport: boolean;
  executionSupport: boolean;
  approvedForLiveUse: boolean;
  onboardingState: VenueOnboardingState;
  missingPrerequisites: string[];
  authRequirementsSummary: string[];
  healthy: boolean;
  healthState: VenueHealthState;
  degradedReason: string | null;
  truthProfile: VenueTruthProfile;
  snapshotType: string;
  snapshotSuccessful: boolean;
  snapshotSummary: string;
  snapshotPayload: Record<string, unknown>;
  errorMessage: string | null;
  capturedAt: string;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  truthCoverage: VenueTruthCoverage;
  comparisonCoverage: VenueTruthComparisonCoverageView;
  sourceMetadata: VenueTruthSourceMetadata;
  accountState: VenueAccountStateSnapshot | null;
  balanceState: VenueBalanceStateSnapshot | null;
  capacityState: VenueCapacityStateSnapshot | null;
  exposureState: VenueExposureStateSnapshot | null;
  derivativeAccountState: VenueDerivativeAccountStateSnapshot | null;
  derivativePositionState: VenueDerivativePositionStateSnapshot | null;
  derivativeHealthState: VenueDerivativeHealthStateSnapshot | null;
  orderState: VenueOrderStateSnapshot | null;
  executionReferenceState: VenueExecutionReferenceStateSnapshot | null;
  executionConfirmationState: ConnectorPostTradeConfirmationEvidenceView | null;
  promotion?: ConnectorPromotionSummaryView;
  metadata: Record<string, unknown>;
}

export interface VenueDetailView {
  venue: VenueInventoryItemView;
  snapshots: VenueSnapshotView[];
  internalState: InternalDerivativeSnapshotView | null;
  comparisonSummary: VenueDerivativeComparisonSummaryView;
  comparisonDetail: VenueDerivativeComparisonDetailView;
  promotion: ConnectorPromotionDetailView;
}

export interface VenueInventorySummaryView {
  totalVenues: number;
  simulatedOnly: number;
  realReadOnly: number;
  realExecutionCapable: number;
  derivativeAware: number;
  genericWallet: number;
  capacityOnly: number;
  approvedForLiveUse: number;
  degraded: number;
  unavailable: number;
  stale: number;
  missingPrerequisites: number;
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
  marketIdentity: CanonicalMarketIdentity | null;
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
  getCarryStrategyProfile(): Promise<CarryStrategyProfileView>;
  getCarryAction(actionId: string): Promise<CarryActionDetailView | null>;
  listCarryExecutions(limit?: number): Promise<CarryExecutionView[]>;
  listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]>;
  getCarryExecution(executionId: string): Promise<CarryExecutionDetailView | null>;
  listCarryVenues(limit?: number): Promise<CarryVenueView[]>;
  listVenues(limit?: number): Promise<VenueInventoryItemView[]>;
  getVenue(venueId: string): Promise<VenueDetailView | null>;
  listVenueSnapshots(venueId: string, limit?: number): Promise<VenueSnapshotView[]>;
  getVenueInternalState(venueId: string): Promise<InternalDerivativeSnapshotView | null>;
  getVenueComparisonSummary(venueId: string): Promise<VenueDerivativeComparisonSummaryView | null>;
  getVenueComparisonDetail(venueId: string): Promise<VenueDerivativeComparisonDetailView | null>;
  getVenueSummary(): Promise<VenueInventorySummaryView>;
  getVenueTruthSummary(): Promise<VenueTruthSummaryView>;
  listVenueReadiness(limit?: number): Promise<VenueInventoryItemView[]>;
  getConnectorPromotionOverview(): Promise<ConnectorPromotionOverviewView>;
  getConnectorPromotion(venueId: string): Promise<ConnectorPromotionDetailView | null>;
  listConnectorPromotionHistory(venueId: string): Promise<ConnectorPromotionEventView[]>;
  getConnectorPromotionEligibility(venueId: string): Promise<ConnectorReadinessEvidenceView | null>;
  getAllocatorSummary(): Promise<AllocatorSummaryView | null>;
  listAllocatorTargets(limit?: number): Promise<AllocatorSleeveTargetView[]>;
  listAllocatorRuns(limit?: number): Promise<AllocatorRunView[]>;
  getAllocatorDecision(allocatorRunId: string): Promise<AllocatorDecisionDetailView | null>;
  listRebalanceProposals(limit?: number): Promise<RebalanceProposalView[]>;
  listRebalanceProposalsForDecision(allocatorRunId: string): Promise<RebalanceProposalView[]>;
  listRebalanceBundles(limit?: number): Promise<RebalanceBundleView[]>;
  getRebalanceBundle(bundleId: string): Promise<RebalanceBundleDetailView | null>;
  getRebalanceBundleForProposal(proposalId: string): Promise<RebalanceBundleDetailView | null>;
  listRebalanceBundleRecoveryActions(bundleId: string): Promise<RebalanceBundleRecoveryActionView[]>;
  getRebalanceBundleRecoveryAction(
    bundleId: string,
    recoveryActionId: string,
  ): Promise<RebalanceBundleRecoveryActionView | null>;
  listRebalanceBundleRecoveryCandidates(
    bundleId: string,
  ): Promise<RebalanceBundleRecoveryCandidateView[]>;
  listRebalanceBundleResolutionActions(bundleId: string): Promise<RebalanceBundleResolutionActionView[]>;
  getRebalanceBundleResolutionAction(
    bundleId: string,
    resolutionActionId: string,
  ): Promise<RebalanceBundleResolutionActionView | null>;
  listRebalanceBundleResolutionOptions(
    bundleId: string,
  ): Promise<RebalanceBundleResolutionOptionView[]>;
  getRebalanceBundleEscalation(bundleId: string): Promise<RebalanceBundleEscalationView | null>;
  listRebalanceBundleEscalationHistory(bundleId: string): Promise<RebalanceBundleEscalationEventView[]>;
  listRebalanceBundleEscalationTransitions(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationTransitionView[]>;
  listRebalanceEscalations(filters?: RebalanceEscalationQueueFilters): Promise<RebalanceEscalationQueueItemView[]>;
  getRebalanceEscalationSummary(actorId?: string | null): Promise<RebalanceEscalationQueueSummaryView>;
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
