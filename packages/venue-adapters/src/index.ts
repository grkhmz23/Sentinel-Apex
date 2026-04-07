// =============================================================================
// @sentinel-apex/venue-adapters — public API
// =============================================================================

export type {
  CarryVenueCapabilities,
  CarryVenueMode,
} from './interfaces/carry-venue-adapter.js';
export type {
  CanonicalMarketIdentity,
  CanonicalMarketIdentityCaptureStage,
  CanonicalMarketIdentityConfidence,
  CanonicalMarketIdentityInput,
  CanonicalMarketIdentityKeyType,
  CanonicalMarketIdentityMetadataDefaults,
  CanonicalMarketIdentityProvenance,
  CanonicalMarketType,
} from './interfaces/market-identity.js';
export {
  MARKET_IDENTITY_METADATA_KEY,
  attachCanonicalMarketIdentityToMetadata,
  canonicalAssetTypeKey,
  canonicalMarketIndexKey,
  canonicalMarketSymbolKey,
  captureCanonicalMarketIdentity,
  createCanonicalMarketIdentity,
  deriveMarketSymbol,
  normalizeCanonicalMarketType,
  parseMarketIndexFromKey,
  preferCanonicalMarketIdentity,
  readCanonicalMarketIdentityFromMetadata,
} from './interfaces/market-identity.js';
export type {
  MarketData,
  AccountBalance,
  VenuePosition,
  PlaceOrderParams,
  PlaceOrderResult,
  CancelOrderResult,
  VenueExecutionEventCorrelationConfidence,
  VenueExecutionEventCorrelationStatus,
  VenueExecutionEventDeduplicationStatus,
  VenueExecutionEventEvidence,
  VenueExecutionEventEvidenceOrigin,
  VenueExecutionEventEvidenceRequest,
  VenueExecutionEventFillRole,
  VenueExecutionRawEvent,
  VenueOrderExecutionMode,
  VenueAdapter,
} from './interfaces/venue-adapter.js';
export {
  VENUE_EXECUTION_MODE_METADATA_KEY,
  VENUE_EXECUTION_REFERENCE_METADATA_KEY,
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
export type {
  VenueAccountStateSnapshot,
  VenueBalanceEntrySnapshot,
  VenueBalanceStateSnapshot,
  VenueCapabilitySnapshot,
  VenueCapacityStateSnapshot,
  VenueDerivativeAccountModel,
  VenueDerivativeAccountStateSnapshot,
  VenueDerivativeHealthStateSnapshot,
  VenueDerivativeHealthStatus,
  VenueDerivativePositionEntrySnapshot,
  VenueDerivativePositionStateSnapshot,
  VenueExecutionReferenceEntrySnapshot,
  VenueExecutionReferenceStateSnapshot,
  VenueTruthDataClassification,
  VenueTruthDataProvenance,
  VenueExposureEntrySnapshot,
  VenueExposureStateSnapshot,
  VenueHealthState,
  VenueOnboardingState,
  VenueTruthCoverage,
  VenueTruthCoverageItem,
  VenueTruthCoverageStatus,
  VenueTruthAdapter,
  VenueTruthMode,
  VenueTruthSnapshotCompleteness,
  VenueTruthSourceDepth,
  VenueTruthSourceMetadata,
  VenueTruthSleeve,
  VenueTruthSnapshot,
  VenueOrderEntrySnapshot,
  VenueOrderStateSnapshot,
} from './interfaces/venue-truth-adapter.js';

export type { PriceFeed } from './simulation/price-feed.js';
export { StaticPriceFeed, VolatilePriceFeed } from './simulation/price-feed.js';

export type { SimulatedVenueConfig } from './simulation/simulated-venue-adapter.js';
export { SimulatedVenueAdapter } from './simulation/simulated-venue-adapter.js';
export type { SimulatedTreasuryVenueConfig } from './simulation/simulated-treasury-venue-adapter.js';
export { SimulatedTreasuryVenueAdapter } from './simulation/simulated-treasury-venue-adapter.js';
// Note: Drift adapters removed due to hackathon eligibility requirements (Drift protocol compromised)
export type { JupiterPerpsAdapterConfig } from './real/jupiter-perps-adapter.js';
export { JupiterPerpsAdapter } from './real/jupiter-perps-adapter.js';
export type { SolanaRpcReadonlyTruthAdapterConfig } from './real/solana-rpc-readonly-truth-adapter.js';
export { SolanaRpcReadonlyTruthAdapter } from './real/solana-rpc-readonly-truth-adapter.js';

export type { VenueAdapterConfig } from './factory.js';
export { createVenueAdapter, registerLiveAdapter } from './factory.js';
