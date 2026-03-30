export type TreasuryLiquidityTier = 'instant' | 'same_day' | 'delayed';
export type TreasuryVenueMode = 'simulated' | 'live';
export type TreasuryRecommendationType = 'deposit' | 'redeem';
export type TreasuryActionType =
  | 'allocate_to_venue'
  | 'reduce_venue_allocation'
  | 'rebalance_treasury_budget';
export type TreasuryExecutionMode = 'dry-run' | 'live';
export type TreasuryApprovalRequirement = 'operator' | 'admin';
export type TreasuryExecutionStatus =
  | 'recommended'
  | 'approved'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type TreasuryRecommendationReasonCode =
  | 'reserve_shortfall'
  | 'surplus_deployable'
  | 'venue_concentration'
  | 'venue_ineligible'
  | 'rebalance_budget_application';
export type TreasuryActionBlockedReasonCode =
  | 'below_minimum_action_size'
  | 'insufficient_idle_capital'
  | 'live_execution_disabled'
  | 'minimum_remaining_liquidity_breach'
  | 'reserve_floor_breach'
  | 'venue_capacity_exceeded'
  | 'venue_concentration_breach'
  | 'venue_execution_unsupported'
  | 'venue_ineligible'
  | 'venue_not_found'
  | 'venue_unhealthy'
  | 'withdrawal_capacity_exceeded';
export type TreasuryBlockedReasonCategory =
  | 'action_size'
  | 'liquidity'
  | 'reserve'
  | 'concentration'
  | 'venue_eligibility'
  | 'venue_health'
  | 'venue_capability'
  | 'capacity'
  | 'execution_mode';
export type TreasuryActionReadiness = 'actionable' | 'blocked';

export interface TreasuryPolicy {
  sleeveId: 'treasury';
  reserveFloorPct: number;
  minReserveUsd: string;
  minimumRemainingIdleUsd: string;
  maxAllocationPctPerVenue: number;
  minimumDeployableUsd: string;
  eligibleVenues: string[];
}

export interface TreasuryVenueSnapshot {
  venueId: string;
  venueName: string;
  mode: TreasuryVenueMode;
  liquidityTier: TreasuryLiquidityTier;
  healthy: boolean;
  aprBps: number;
  availableCapacityUsd: string;
  currentAllocationUsd: string;
  withdrawalAvailableUsd: string;
  concentrationPct: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface TreasuryReserveStatus {
  totalCapitalUsd: string;
  idleCapitalUsd: string;
  allocatedCapitalUsd: string;
  requiredReserveUsd: string;
  currentReserveUsd: string;
  reserveCoveragePct: string;
  surplusCapitalUsd: string;
  reserveShortfallUsd: string;
}

export interface TreasuryRecommendation {
  actionType: TreasuryRecommendationType;
  venueId: string | null;
  amountUsd: string;
  reasonCode: TreasuryRecommendationReasonCode;
  summary: string;
  details: Record<string, unknown>;
}

export interface TreasuryEvaluation {
  policy: TreasuryPolicy;
  reserveStatus: TreasuryReserveStatus;
  venueSnapshots: TreasuryVenueSnapshot[];
  recommendations: TreasuryRecommendation[];
  alerts: string[];
  simulated: boolean;
}

export interface TreasuryEvaluationInput {
  totalNavUsd: string;
  idleCapitalUsd: string;
  venueSnapshots: TreasuryVenueSnapshot[];
  policy: TreasuryPolicy;
}

export interface TreasuryVenueCapabilities {
  venueId: string;
  venueMode: TreasuryVenueMode;
  supportsAllocation: boolean;
  supportsReduction: boolean;
  executionSupported: boolean;
  readOnly: boolean;
  approvedForLiveUse: boolean;
  onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
  missingPrerequisites: string[];
  healthy: boolean;
  metadata: Record<string, unknown>;
}

export interface TreasuryActionBlockedReason {
  code: TreasuryActionBlockedReasonCode;
  category: TreasuryBlockedReasonCategory;
  message: string;
  operatorAction: string;
  details: Record<string, unknown>;
}

export interface TreasuryExecutionEffects {
  totalCapitalUsd: string;
  idleCapitalUsd: string;
  allocatedCapitalUsd: string;
  requiredReserveUsd: string;
  minimumRemainingIdleUsd: string;
  reserveShortfallUsd: string;
  targetVenueAllocationUsd: string | null;
  targetVenueConcentrationPct: string | null;
}

export interface TreasuryExecutionIntent {
  actionType: TreasuryActionType;
  recommendationType: TreasuryRecommendationType;
  venueId: string | null;
  venueName: string | null;
  venueMode: TreasuryVenueMode | 'reserve';
  amountUsd: string;
  reasonCode: TreasuryRecommendationReasonCode;
  summary: string;
  details: Record<string, unknown>;
  readiness: TreasuryActionReadiness;
  blockedReasons: TreasuryActionBlockedReason[];
  executable: boolean;
  approvalRequirement: TreasuryApprovalRequirement;
  executionMode: TreasuryExecutionMode;
  simulated: boolean;
  effects: TreasuryExecutionEffects;
}

export interface TreasuryExecutionPlanningInput {
  evaluation: TreasuryEvaluation;
  policy: TreasuryPolicy;
  executionMode: TreasuryExecutionMode;
  liveExecutionEnabled: boolean;
  venueCapabilities: TreasuryVenueCapabilities[];
}
