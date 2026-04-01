export type VenueTruthSleeve = 'carry' | 'treasury';
export type VenueTruthMode = 'simulated' | 'real';
export type VenueOnboardingState = 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
export type VenueHealthState = 'healthy' | 'degraded' | 'unavailable';
export type VenueTruthCoverageStatus = 'available' | 'partial' | 'unsupported';
export type VenueTruthSnapshotCompleteness = 'complete' | 'partial' | 'minimal';

export interface VenueTruthCoverageItem {
  status: VenueTruthCoverageStatus;
  reason: string | null;
  limitations: string[];
}

export interface VenueTruthCoverage {
  accountState: VenueTruthCoverageItem;
  balanceState: VenueTruthCoverageItem;
  capacityState: VenueTruthCoverageItem;
  exposureState: VenueTruthCoverageItem;
  derivativeAccountState: VenueTruthCoverageItem;
  derivativePositionState: VenueTruthCoverageItem;
  derivativeHealthState: VenueTruthCoverageItem;
  orderState: VenueTruthCoverageItem;
  executionReferences: VenueTruthCoverageItem;
}

export interface VenueTruthSourceMetadata {
  sourceKind: 'simulation' | 'adapter' | 'json_rpc';
  sourceName: string;
  observedScope: string[];
}

export interface VenueAccountStateSnapshot {
  accountAddress: string | null;
  accountLabel: string | null;
  accountExists: boolean | null;
  ownerProgram: string | null;
  executable: boolean | null;
  lamports: string | null;
  nativeBalanceDisplay: string | null;
  observedSlot: string | null;
  rentEpoch: string | null;
  dataLength: number | null;
}

export interface VenueBalanceEntrySnapshot {
  assetKey: string;
  assetSymbol: string | null;
  assetType: 'native' | 'spl_token' | 'unknown';
  accountAddress: string | null;
  amountAtomic: string;
  amountDisplay: string;
  decimals: number | null;
  observedSlot: string | null;
}

export interface VenueBalanceStateSnapshot {
  balances: VenueBalanceEntrySnapshot[];
  totalTrackedBalances: number;
  observedSlot: string | null;
}

export interface VenueCapacityStateSnapshot {
  availableCapacityUsd: string | null;
  currentAllocationUsd: string | null;
  withdrawalAvailableUsd: string | null;
  liquidityTier: string | null;
  aprBps: number | null;
}

export interface VenueExposureEntrySnapshot {
  exposureKey: string;
  exposureType: 'balance_derived_spot' | 'position' | 'allocation';
  assetKey: string;
  quantity: string;
  quantityDisplay: string;
  accountAddress: string | null;
}

export interface VenueExposureStateSnapshot {
  exposures: VenueExposureEntrySnapshot[];
  methodology: string;
}

export interface VenueExecutionReferenceEntrySnapshot {
  referenceType: 'solana_signature' | 'venue_reference';
  reference: string;
  accountAddress: string | null;
  slot: string | null;
  blockTime: string | null;
  confirmationStatus: string | null;
  errored: boolean;
  memo: string | null;
}

export interface VenueExecutionReferenceStateSnapshot {
  referenceLookbackLimit: number;
  references: VenueExecutionReferenceEntrySnapshot[];
  oldestReferenceAt: string | null;
}

export type VenueDerivativeAccountModel =
  | 'wallet'
  | 'program_account'
  | 'executable_program'
  | 'unknown';

export interface VenueDerivativeAccountStateSnapshot {
  venue: string | null;
  accountAddress: string | null;
  accountLabel: string | null;
  accountExists: boolean | null;
  ownerProgram: string | null;
  accountModel: VenueDerivativeAccountModel;
  venueAccountType: string | null;
  decoded: boolean;
  authorityAddress: string | null;
  subaccountId: number | null;
  observedSlot: string | null;
  rpcVersion: string | null;
  dataLength: number | null;
  rawDiscriminatorHex: string | null;
  notes: string[];
}

export interface VenueDerivativePositionEntrySnapshot {
  marketKey: string | null;
  marketSymbol: string | null;
  positionType: 'perp' | 'spot' | 'unknown';
  side: 'long' | 'short' | 'flat' | 'unknown';
  baseAssetAmount: string | null;
  quoteAssetAmount: string | null;
  entryPrice: string | null;
  breakEvenPrice: string | null;
  unrealizedPnlUsd: string | null;
  liquidationPrice: string | null;
  metadata: Record<string, unknown>;
}

export interface VenueDerivativePositionStateSnapshot {
  positions: VenueDerivativePositionEntrySnapshot[];
  openPositionCount: number;
  methodology: string;
  notes: string[];
}

export type VenueDerivativeHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'liquidation_risk'
  | 'unknown';

export interface VenueDerivativeHealthStateSnapshot {
  healthStatus: VenueDerivativeHealthStatus;
  collateralUsd: string | null;
  marginRatio: string | null;
  leverage: string | null;
  maintenanceMarginRequirementUsd: string | null;
  initialMarginRequirementUsd: string | null;
  freeCollateralUsd: string | null;
  methodology: string;
  notes: string[];
}

export interface VenueOrderEntrySnapshot {
  venueOrderId: string | null;
  reference: string | null;
  marketKey: string | null;
  marketSymbol: string | null;
  side: 'buy' | 'sell' | 'unknown';
  status: string;
  orderType: string | null;
  price: string | null;
  quantity: string | null;
  reduceOnly: boolean | null;
  accountAddress: string | null;
  slot: string | null;
  placedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface VenueOrderStateSnapshot {
  openOrderCount: number | null;
  openOrders: VenueOrderEntrySnapshot[];
  referenceMode: 'none' | 'recent_account_signatures' | 'venue_open_orders';
  methodology: string;
  notes: string[];
}

export interface VenueCapabilitySnapshot {
  venueId: string;
  venueName: string;
  sleeveApplicability: VenueTruthSleeve[];
  connectorType: string;
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
  metadata: Record<string, unknown>;
}

export interface VenueTruthSnapshot {
  venueId: string;
  venueName: string;
  snapshotType: string;
  snapshotSuccessful: boolean;
  healthy: boolean;
  healthState: VenueHealthState;
  summary: string;
  errorMessage: string | null;
  capturedAt: string;
  snapshotCompleteness: VenueTruthSnapshotCompleteness;
  truthCoverage: VenueTruthCoverage;
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
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface VenueTruthAdapter {
  readonly venueId: string;
  readonly venueName: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getVenueCapabilitySnapshot(): Promise<VenueCapabilitySnapshot>;
  getVenueTruthSnapshot(): Promise<VenueTruthSnapshot>;
}
