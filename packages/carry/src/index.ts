// =============================================================================
// @sentinel-apex/carry — public API
// =============================================================================

export type { CarryConfig } from './config.js';
export { DEFAULT_CARRY_CONFIG } from './config.js';

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
