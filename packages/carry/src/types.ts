import type { OrderIntent } from '@sentinel-apex/domain';

export type CarryActionType =
  | 'increase_carry_exposure'
  | 'reduce_carry_exposure'
  | 'restore_carry_budget';
export type CarryExecutionMode = 'dry-run' | 'live';
export type CarryApprovalRequirement = 'operator' | 'admin';
export type CarryExecutionStatus =
  | 'recommended'
  | 'approved'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type CarryActionReadiness = 'actionable' | 'blocked';
export type CarryRecommendationSourceKind = 'opportunity' | 'rebalance';
export type CarryOperationalBlockedReasonCode =
  | 'below_minimum_action_size'
  | 'runtime_not_ready'
  | 'critical_mismatch_pressure'
  | 'carry_throttle_active'
  | 'carry_budget_exceeded'
  | 'venue_execution_unsupported'
  | 'venue_live_unapproved'
  | 'live_execution_disabled'
  | 'simulated_execution_only'
  | 'opportunity_confidence_below_threshold'
  | 'opportunity_expired'
  | 'no_open_positions'
  | 'insufficient_position_reduction_capacity';
export type CarryOperationalBlockedReasonCategory =
  | 'action_size'
  | 'runtime'
  | 'risk'
  | 'budget'
  | 'venue_capability'
  | 'execution_mode'
  | 'opportunity'
  | 'exposure';

export interface CarryOperationalPolicy {
  minimumActionableUsd: string;
  minimumConfidenceScore: number;
}

export interface CarryPositionSnapshot {
  positionId: string;
  venueId: string;
  asset: string;
  side: 'long' | 'short';
  size: string;
  markPrice: string;
  updatedAt: string;
}

export interface CarryExecutionRecommendation {
  actionType: CarryActionType;
  sourceKind: CarryRecommendationSourceKind;
  sourceReference: string | null;
  opportunityId: string | null;
  asset: string | null;
  summary: string;
  notionalUsd: string;
  details: Record<string, unknown>;
  plannedOrders: OrderIntent[];
}

export interface CarryOperationalBlockedReason {
  code: CarryOperationalBlockedReasonCode;
  category: CarryOperationalBlockedReasonCategory;
  message: string;
  operatorAction: string;
  details: Record<string, unknown>;
}

export interface CarryExecutionEffects {
  currentCarryAllocationUsd: string;
  projectedCarryAllocationUsd: string;
  projectedCarryAllocationPct: number | null;
  approvedCarryBudgetUsd: string | null;
  projectedRemainingBudgetUsd: string | null;
  openPositionCount: number;
}

export interface CarryExecutionIntent {
  actionType: CarryActionType;
  sourceKind: CarryRecommendationSourceKind;
  sourceReference: string | null;
  opportunityId: string | null;
  asset: string | null;
  summary: string;
  notionalUsd: string;
  details: Record<string, unknown>;
  readiness: CarryActionReadiness;
  blockedReasons: CarryOperationalBlockedReason[];
  executable: boolean;
  approvalRequirement: CarryApprovalRequirement;
  executionMode: CarryExecutionMode;
  simulated: boolean;
  plannedOrders: OrderIntent[];
  effects: CarryExecutionEffects;
}

export interface CarryControlledExecutionPlanningInput {
  recommendations: CarryExecutionRecommendation[];
  policy?: Partial<CarryOperationalPolicy>;
  currentCarryAllocationUsd: string;
  approvedCarryBudgetUsd: string | null;
  totalCapitalUsd: string | null;
  runtimeLifecycleState: 'ready' | 'paused' | 'degraded' | 'stopped' | 'starting';
  runtimeHalted: boolean;
  criticalMismatchCount: number;
  carryThrottleState: 'normal' | 'throttled' | 'de_risk' | 'blocked';
  executionMode: CarryExecutionMode;
  liveExecutionEnabled: boolean;
  venueCapabilities: Array<{
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
  }>;
  openPositions: CarryPositionSnapshot[];
  now: Date;
}
