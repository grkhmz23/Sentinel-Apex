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
  | 'rebuild_projections'
  | 'run_reconciliation'
  | 'run_treasury_evaluation'
  | 'execute_treasury_action';
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
  getTreasurySummary(): Promise<TreasurySummaryView | null>;
  listTreasuryAllocations(limit?: number): Promise<TreasuryAllocationView[]>;
  getTreasuryPolicy(): Promise<TreasuryPolicyView | null>;
  listTreasuryActions(limit?: number): Promise<TreasuryActionView[]>;
  getTreasuryAction(actionId: string): Promise<TreasuryActionDetailView | null>;
  listTreasuryExecutions(limit?: number): Promise<TreasuryExecutionView[]>;
  getTreasuryExecution(executionId: string): Promise<TreasuryExecutionView | null>;
  getTreasuryExecutionDetail(executionId: string): Promise<TreasuryExecutionDetailView | null>;
  listTreasuryVenues(limit?: number): Promise<TreasuryVenueView[]>;
  getTreasuryVenue(venueId: string): Promise<TreasuryVenueDetailView | null>;
}
