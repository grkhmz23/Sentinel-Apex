// =============================================================================
// @sentinel-apex/venue-adapters — public API
// =============================================================================

export type {
  CarryVenueCapabilities,
  CarryVenueMode,
} from './interfaces/carry-venue-adapter.js';
export type {
  MarketData,
  AccountBalance,
  VenuePosition,
  PlaceOrderParams,
  PlaceOrderResult,
  CancelOrderResult,
  VenueAdapter,
} from './interfaces/venue-adapter.js';
export type {
  TreasuryLiquidityTier,
  TreasuryVenueAdapter,
  TreasuryVenueCapabilities,
  TreasuryVenueExecutionRequest,
  TreasuryVenueExecutionResult,
  TreasuryVenueMode,
  TreasuryVenuePosition,
  TreasuryVenueState,
} from './interfaces/treasury-venue-adapter.js';

export type { PriceFeed } from './simulation/price-feed.js';
export { StaticPriceFeed, VolatilePriceFeed } from './simulation/price-feed.js';

export type { SimulatedVenueConfig } from './simulation/simulated-venue-adapter.js';
export { SimulatedVenueAdapter } from './simulation/simulated-venue-adapter.js';
export type { SimulatedTreasuryVenueConfig } from './simulation/simulated-treasury-venue-adapter.js';
export { SimulatedTreasuryVenueAdapter } from './simulation/simulated-treasury-venue-adapter.js';

export type { VenueAdapterConfig } from './factory.js';
export { createVenueAdapter, registerLiveAdapter } from './factory.js';
