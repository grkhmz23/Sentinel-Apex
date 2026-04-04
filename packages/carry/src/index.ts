// =============================================================================
// @sentinel-apex/carry — public API
// =============================================================================

export type { CarryConfig } from './config.js';
export { DEFAULT_CARRY_CONFIG } from './config.js';
export {
  buildCarryStrategyProfile,
  DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY,
  DISALLOWED_BUILD_A_BEAR_YIELD_SOURCES,
} from './strategy-policy.js';
export type {
  BuildABearLeverageModel,
  BuildABearLockReassessmentPolicy,
  BuildABearOracleDependencyClass,
  BuildABearStrategyPolicy,
  BuildABearYieldSourceCategory,
  CarryStrategyApyEvidenceKind,
  CarryStrategyApyModel,
  CarryStrategyEligibility,
  CarryStrategyEligibilityStatus,
  CarryStrategyEvidenceScope,
  CarryStrategyEvidenceSummary,
  CarryStrategyLatestEvidenceSource,
  CarryStrategyProfile,
  CarryStrategyProfileInput,
  CarryStrategyRiskLimit,
  CarryStrategyRuleKey,
  CarryStrategyRuleResult,
  CarryStrategyTenorModel,
} from './strategy-policy.js';

export type {
  FundingRateSnapshot,
  BasisSnapshot,
  CrossVenueSpread,
  OpportunityLeg,
  CarryOpportunityCandidate,
} from './opportunity-detector.js';
export {
  detectFundingRateOpportunities,
  detectBasisOpportunities,
  detectCrossVenueOpportunities,
} from './opportunity-detector.js';

export type {
  ComputePositionSizeParams,
  ComputeMaxAllowedSizeParams,
} from './position-sizer.js';
export { computePositionSize, computeMaxAllowedSize } from './position-sizer.js';

export type { HedgeLegSizes } from './hedge-state.js';
export { computeHedgeState, HEDGE_TOLERANCE_PCT } from './hedge-state.js';

export type { PositionPnl, ComputeCarryPnlParams } from './pnl.js';
export { computeCarryPnl } from './pnl.js';

export {
  CarryControlledExecutionPlanner,
  DEFAULT_CARRY_OPERATIONAL_POLICY,
  buildCarryReductionIntents,
} from './controlled-execution.js';
export type {
  CarryActionReadiness,
  CarryActionType,
  CarryApprovalRequirement,
  CarryControlledExecutionPlanningInput,
  CarryExecutionEffects,
  CarryExecutionIntent,
  CarryExecutionMode,
  CarryExecutionRecommendation,
  CarryExecutionStatus,
  CarryOperationalBlockedReason,
  CarryOperationalBlockedReasonCategory,
  CarryOperationalBlockedReasonCode,
  CarryOperationalPolicy,
  CarryPositionSnapshot,
  CarryRecommendationSourceKind,
} from './types.js';
