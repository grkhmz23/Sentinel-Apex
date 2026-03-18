import type { RiskAssessment } from '@sentinel-apex/domain';
import type { RiskSummary } from '@sentinel-apex/risk-engine';

export type RuntimeLifecycleState = 'starting' | 'ready' | 'paused' | 'stopped' | 'degraded';
export type ProjectionStatus = 'fresh' | 'rebuilding' | 'stale';
export type WorkerLifecycleState = 'starting' | 'ready' | 'stopping' | 'stopped' | 'degraded';
export type WorkerSchedulerState = 'idle' | 'waiting' | 'running' | 'paused';
export type RuntimeCommandType = 'run_cycle' | 'rebuild_projections';
export type RuntimeCommandStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RuntimeMismatchStatus = 'open' | 'acknowledged' | 'resolved';

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
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionSummary: string | null;
  updatedAt: string;
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

export interface RuntimeOverviewView {
  runtime: RuntimeStatusView;
  worker: WorkerStatusView;
  openMismatchCount: number;
  degradedReasons: string[];
  lastRecoveryEvent: RuntimeRecoveryEventView | null;
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
}
