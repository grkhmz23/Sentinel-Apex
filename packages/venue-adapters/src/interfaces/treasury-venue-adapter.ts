export type TreasuryLiquidityTier = 'instant' | 'same_day' | 'delayed';
export type TreasuryVenueMode = 'simulated' | 'live';

export interface TreasuryVenueState {
  venueId: string;
  venueName: string;
  mode: TreasuryVenueMode;
  liquidityTier: TreasuryLiquidityTier;
  healthy: boolean;
  aprBps: number;
  availableCapacityUsd: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface TreasuryVenuePosition {
  venueId: string;
  currentAllocationUsd: string;
  withdrawalAvailableUsd: string;
  updatedAt: string;
}

export interface TreasuryVenueCapabilities {
  venueId: string;
  venueMode: TreasuryVenueMode;
  supportsAllocation: boolean;
  supportsReduction: boolean;
  executionSupported: boolean;
  healthy: boolean;
  metadata: Record<string, unknown>;
}

export interface TreasuryVenueExecutionRequest {
  actionType: 'allocate_to_venue' | 'reduce_venue_allocation';
  amountUsd: string;
  actorId: string;
  reasonCode: string;
  executionMode: 'dry-run' | 'live';
}

export interface TreasuryVenueExecutionResult {
  venueId: string;
  venueMode: TreasuryVenueMode;
  executionReference: string;
  status: 'completed' | 'failed';
  summary: string;
  simulated: boolean;
  balanceDeltaUsd: string;
  allocationUsd: string;
  withdrawalAvailableUsd: string;
  metadata: Record<string, unknown>;
}

export interface TreasuryVenueAdapter {
  readonly venueId: string;
  readonly venueMode: TreasuryVenueMode;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getVenueState(): Promise<TreasuryVenueState>;
  getPosition(): Promise<TreasuryVenuePosition>;
  getCapabilities(): Promise<TreasuryVenueCapabilities>;
  executeTreasuryAction(
    request: TreasuryVenueExecutionRequest,
  ): Promise<TreasuryVenueExecutionResult>;
}
