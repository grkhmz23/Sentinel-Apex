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
export type {
  OpportunityScoreBreakdown,
  OpportunitySelectionDecision,
  OpportunityRejectionDecision,
  PortfolioCapitalAllocation,
  PortfolioOptimizationInput,
  PortfolioOptimizationResult,
} from './portfolio-optimizer.js';
export { optimizeCarryPortfolio } from './portfolio-optimizer.js';

export type { HedgeLegSizes } from './hedge-state.js';
export { computeHedgeState, HEDGE_TOLERANCE_PCT } from './hedge-state.js';

// Spot-perp coordination for delta-neutral execution
export type {
  HedgeLeg,
  DeltaNeutralHedgePair,
  SpotPerpCoordinationConfig,
  HedgeExecutionPlan,
  CoordinationValidationResult,
} from './spot-perp-coordination.js';
export {
  createHedgePair,
  validateHedgePair,
  createHedgeExecutionPlan,
  updateHedgePairWithExecution,
  calculateHedgeDeviation,
  isHedgeBalanced,
  createHedgeReductionOrders,
  calculateHedgeFundingCapture,
  DEFAULT_SPOT_PERP_COORDINATION_CONFIG,
} from './spot-perp-coordination.js';

export type { PositionPnl, ComputeCarryPnlParams } from './pnl.js';
export { computeCarryPnl } from './pnl.js';

// Realized APY tracking
export type {
  RealizedTrade,
  RealizedTradePnl,
  DailySnapshot,
  ApyCurrent,
  PerformancePeriod,
  StrategyPerformance,
  ComputeTradePnlParams,
  CalculateDailySnapshotParams,
  CalculateApyCurrentParams,
  CalculatePerformanceSummaryParams,
  RollingApyParams,
} from './realized-apy.js';
export {
  computeTradePnl,
  calculateRealizedTradePnl,
  calculateTimeWeightedReturn,
  annualizeReturn,
  calculateSimpleApy,
  calculateRollingApy,
  calculateApy7d,
  calculateApy30d,
  calculateApyLifetime,
  calculateDailySnapshot,
  calculateApyCurrent,
  calculatePerformancePeriod,
  calculateStrategyPerformance,
} from './realized-apy.js';

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

// Multi-leg orchestration (Phase R2)
export type {
  LegDefinition,
  LegExecution,
  LegResult,
  LegStatus,
  MultiLegPlan,
  MultiLegPlanInput,
  PartialFailureHandling,
  PlanStatus,
  ExecutionResult,
  HedgeState,
  HedgeStatus,
  ValidationResult,
} from './multi-leg-orchestration.js';
export {
  createMultiLegPlan,
  calculateHedgeState,
  updatePlanStatus,
  buildExecutionResult,
  validateMultiLegPlan,
  determinePartialFailureAction,
} from './multi-leg-orchestration.js';
