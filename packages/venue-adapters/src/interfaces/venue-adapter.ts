// =============================================================================
// VenueAdapter interface — all venue integrations must implement this contract
// =============================================================================

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
}

export interface PlaceOrderResult {
  venueOrderId: string;
  clientOrderId: string;
  status: 'submitted' | 'filled' | 'partially_filled' | 'rejected';
  filledSize: string;
  averageFillPrice: string | null;
  fees: string;
  submittedAt: Date;
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
}
