// =============================================================================
// VenueAdapter interface — all venue integrations must implement this contract
// =============================================================================

import type { CanonicalMarketIdentity } from './market-identity.js';

export type VenueOrderExecutionMode = 'simulated' | 'real';

export const VENUE_EXECUTION_REFERENCE_METADATA_KEY = 'venueExecutionReference';
export const VENUE_EXECUTION_MODE_METADATA_KEY = 'venueExecutionMode';

export type VenueExecutionEventCorrelationStatus =
  | 'event_matched_strong'
  | 'event_matched_probable'
  | 'event_unmatched'
  | 'conflicting_event';

export type VenueExecutionEventDeduplicationStatus = 'unique' | 'duplicate_event';
export type VenueExecutionEventCorrelationConfidence = 'strong' | 'probable' | 'none' | 'conflicting';
export type VenueExecutionEventEvidenceOrigin =
  | 'raw_venue_event'
  | 'derived_correlation'
  | 'raw_and_derived';
export type VenueExecutionEventFillRole = 'maker' | 'taker' | 'unknown';

export interface VenueExecutionEventEvidenceRequest {
  executionReference: string;
  clientOrderId: string | null;
  asset: string;
  side: 'buy' | 'sell';
  requestedSize: string;
  reduceOnly: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface VenueExecutionRawEvent {
  eventId: string;
  venueEventType: string;
  actionType: string | null;
  txSignature: string | null;
  clientOrderId: string | null;
  accountAddress: string | null;
  subaccountId: number | null;
  marketIndex: number | null;
  orderId: string | null;
  userOrderId: number | null;
  slot: string | null;
  timestamp: string | null;
  fillBaseAssetAmount: string | null;
  fillQuoteAssetAmount: string | null;
  fillRole: VenueExecutionEventFillRole | null;
  metadata: Record<string, unknown>;
}

export interface VenueExecutionEventEvidence {
  executionReference: string;
  clientOrderId: string | null;
  correlationStatus: VenueExecutionEventCorrelationStatus;
  deduplicationStatus: VenueExecutionEventDeduplicationStatus;
  correlationConfidence: VenueExecutionEventCorrelationConfidence;
  evidenceOrigin: VenueExecutionEventEvidenceOrigin;
  summary: string;
  blockedReason: string | null;
  observedAt: string | null;
  eventType: string | null;
  actionType: string | null;
  txSignature: string | null;
  accountAddress: string | null;
  subaccountId: number | null;
  marketIndex: number | null;
  orderId: string | null;
  userOrderId: number | null;
  fillBaseAssetAmount: string | null;
  fillQuoteAssetAmount: string | null;
  fillRole: VenueExecutionEventFillRole | null;
  rawEventCount: number;
  duplicateEventCount: number;
  rawEvents: VenueExecutionRawEvent[];
}

export interface MarketData {
  venueId: string;
  asset: string;
  bid: string;
  ask: string;
  mid: string;
  markPrice: string;
  indexPrice: string;
  /** 8-hour funding rate as a decimal string, e.g. "0.0001" */
  fundingRate: string;
  nextFundingTime: Date;
  openInterest: string;
  volume24h: string;
  marketIdentity?: CanonicalMarketIdentity | null;
  updatedAt: Date;
}

export interface AccountBalance {
  venueId: string;
  asset: string;
  /** Available (not locked) balance as a decimal string */
  available: string;
  locked: string;
  total: string;
  updatedAt: Date;
}

export interface VenuePosition {
  venueId: string;
  asset: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  marginUsed: string;
  liquidationPrice: string | null;
  updatedAt: Date;
}

export interface PlaceOrderParams {
  /** Idempotency key — same clientOrderId must never produce a duplicate fill */
  clientOrderId: string;
  asset: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'post_only';
  size: string;
  /** Required for limit / post_only orders */
  price?: string;
  reduceOnly?: boolean;
  postOnly?: boolean;
  marketIdentity?: CanonicalMarketIdentity | null;
}

export interface PlaceOrderResult {
  venueOrderId: string;
  clientOrderId: string;
  status: 'submitted' | 'filled' | 'partially_filled' | 'rejected';
  filledSize: string;
  averageFillPrice: string | null;
  fees: string | null;
  submittedAt: Date;
  executionReference?: string | null;
  executionMode?: VenueOrderExecutionMode;
  marketIdentity?: CanonicalMarketIdentity | null;
}

export interface CancelOrderResult {
  venueOrderId: string;
  cancelled: boolean;
  reason?: string;
}

export interface VenueAdapter {
  readonly venueId: string;
  readonly venueType: 'dex' | 'cex' | 'money_market' | 'lp_pool';

  // Connectivity
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Market data
  getMarketData(asset: string): Promise<MarketData>;
  getFundingRate(asset: string): Promise<{ rate: string; nextFundingTime: Date }>;

  // Account
  getBalances(): Promise<AccountBalance[]>;
  getPositions(): Promise<VenuePosition[]>;

  // Order management
  placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult>;
  cancelOrder(venueOrderId: string): Promise<CancelOrderResult>;
  getOrder(venueOrderId: string): Promise<PlaceOrderResult | null>;

  // Health
  getStatus(): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;

  // Optional carry controlled-execution capabilities
  getCarryCapabilities?(): Promise<import('./carry-venue-adapter.js').CarryVenueCapabilities>;
  getVenueCapabilitySnapshot?(): Promise<import('./venue-truth-adapter.js').VenueCapabilitySnapshot>;
  getVenueTruthSnapshot?(): Promise<import('./venue-truth-adapter.js').VenueTruthSnapshot>;
  getExecutionEventEvidence?(
    requests: VenueExecutionEventEvidenceRequest[],
  ): Promise<VenueExecutionEventEvidence[]>;
}
