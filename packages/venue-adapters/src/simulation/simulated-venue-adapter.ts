// =============================================================================
// SimulatedVenueAdapter — full in-memory paper-trading implementation
// =============================================================================

import Decimal from 'decimal.js';

import {
  createLogger,
  registry,
  type Logger,
} from '@sentinel-apex/observability';

import { StaticPriceFeed, type PriceFeed } from './price-feed.js';

import type { CarryVenueCapabilities } from '../interfaces/carry-venue-adapter.js';
import type {
  VenueAdapter,
  MarketData,
  AccountBalance,
  VenuePosition,
  PlaceOrderParams,
  PlaceOrderResult,
  CancelOrderResult,
} from '../interfaces/venue-adapter.js';
import type {
  VenueCapabilitySnapshot,
  VenueTruthSnapshot,
} from '../interfaces/venue-truth-adapter.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SimulatedVenueConfig {
  venueId: string;
  venueType: 'dex' | 'cex';
  /** Maker fee as a decimal, e.g. "0.001" = 0.1% */
  makerFeePct: string;
  /** Taker fee as a decimal, e.g. "0.001" = 0.1% */
  takerFeePct: string;
  /** Additional simulated market-impact slippage, e.g. "0.0005" = 0.05% */
  slippagePct: string;
  /** Initial token balances: { USDC: "100000", SOL: "0" } */
  initialBalances: Record<string, string>;
  /** Optional fixed prices for deterministic tests (overrides any PriceFeed) */
  deterministicPrices?: Record<string, string>;
  /** Optional fixed funding rates for deterministic tests. */
  deterministicFundingRates?: Record<string, string>;
}

export interface ReplayFillParams {
  venueOrderId: string;
  clientOrderId: string;
  asset: string;
  side: 'buy' | 'sell';
  size: string;
  fillPrice: string;
  fee: string;
  reduceOnly?: boolean;
  submittedAt: Date;
}

// ---------------------------------------------------------------------------
// Internal state shapes
// ---------------------------------------------------------------------------

interface InternalOrder {
  params: PlaceOrderParams;
  result: PlaceOrderResult;
  /** Whether the order is still open (pending/partially_filled) */
  open: boolean;
}

interface InternalPosition {
  asset: string;
  side: 'long' | 'short';
  size: Decimal;
  entryPrice: Decimal;
  /** Realised PnL accumulated so far */
  realizedPnl: Decimal;
}

// ---------------------------------------------------------------------------
// SimulatedVenueAdapter
// ---------------------------------------------------------------------------

export class SimulatedVenueAdapter implements VenueAdapter {
  readonly venueId: string;
  readonly venueType: 'dex' | 'cex' | 'money_market' | 'lp_pool';

  private readonly config: SimulatedVenueConfig;
  private readonly priceFeed: PriceFeed;
  private readonly logger: Logger;

  private connected = false;
  private orderCounter = 0;

  /** Live order book: venueOrderId → InternalOrder */
  private readonly orders = new Map<string, InternalOrder>();

  /** Idempotency map: clientOrderId → venueOrderId */
  private readonly clientIdIndex = new Map<string, string>();

  /** Quote-currency balances: asset → Decimal */
  private readonly balances = new Map<string, Decimal>();

  /** Open positions: asset → InternalPosition */
  private readonly positions = new Map<string, InternalPosition>();

  // Metrics
  private readonly ordersPlaced = registry.createCounter('sim_orders_placed');
  private readonly ordersCancelled = registry.createCounter('sim_orders_cancelled');
  private readonly tradeVolume = registry.createCounter('sim_trade_volume_notional');

  constructor(config: SimulatedVenueConfig, priceFeed?: PriceFeed) {
    this.config = config;
    this.venueId = config.venueId;
    this.venueType = config.venueType;
    this.logger = createLogger('simulated-venue-adapter', { venueId: config.venueId });

    if (config.deterministicPrices !== undefined) {
      this.priceFeed = new StaticPriceFeed(
        config.deterministicPrices,
        config.deterministicFundingRates,
      );
    } else if (priceFeed !== undefined) {
      this.priceFeed = priceFeed;
    } else {
      throw new Error(
        'SimulatedVenueAdapter: provide either deterministicPrices or a PriceFeed instance',
      );
    }

    // Seed balances from config
    for (const [asset, amount] of Object.entries(config.initialBalances)) {
      this.balances.set(asset, new Decimal(amount));
    }
  }

  // ── Connectivity ──────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.connected = true;
    this.logger.info('SimulatedVenueAdapter connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.logger.info('SimulatedVenueAdapter disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  resetSimulationState(): void {
    this.orderCounter = 0;
    this.orders.clear();
    this.clientIdIndex.clear();
    this.positions.clear();
    this.balances.clear();

    for (const [asset, amount] of Object.entries(this.config.initialBalances)) {
      this.balances.set(asset, new Decimal(amount));
    }
  }

  replayFilledOrder(params: ReplayFillParams): void {
    const fillPrice = new Decimal(params.fillPrice);
    const size = new Decimal(params.size);
    const fee = new Decimal(params.fee);
    const orderParams: PlaceOrderParams = {
      clientOrderId: params.clientOrderId,
      asset: params.asset,
      side: params.side,
      type: 'market',
      size: params.size,
      ...(params.reduceOnly !== undefined ? { reduceOnly: params.reduceOnly } : {}),
    };

    this._applyFill(
      orderParams,
      fillPrice,
      size,
      fee,
    );

    this.orders.set(params.venueOrderId, {
      params: orderParams,
      result: {
        venueOrderId: params.venueOrderId,
        clientOrderId: params.clientOrderId,
        status: 'filled',
        filledSize: params.size,
        averageFillPrice: fillPrice.toFixed(8),
        fees: fee.toFixed(8),
        submittedAt: params.submittedAt,
      },
      open: false,
    });
    this.clientIdIndex.set(params.clientOrderId, params.venueOrderId);
    this.orderCounter = Math.max(this.orderCounter, this._extractSequence(params.venueOrderId));
  }

  // ── Market data ───────────────────────────────────────────────────────────

  async getMarketData(asset: string): Promise<MarketData> {
    const mid = await this.priceFeed.getPrice(asset);
    const midD = new Decimal(mid);

    // Simulate a small spread around mid
    const halfSpread = midD.times('0.0002');
    const bid = midD.minus(halfSpread).toFixed(8);
    const ask = midD.plus(halfSpread).toFixed(8);

    const { rate: fundingRate, nextFundingTime } =
      await this.priceFeed.getFundingRate(asset);

    return {
      venueId: this.venueId,
      asset,
      bid,
      ask,
      mid,
      markPrice: mid,
      indexPrice: mid,
      fundingRate,
      nextFundingTime,
      openInterest: '0',
      volume24h: '0',
      updatedAt: new Date(),
    };
  }

  async getFundingRate(
    asset: string,
  ): Promise<{ rate: string; nextFundingTime: Date }> {
    return this.priceFeed.getFundingRate(asset);
  }

  async getCarryCapabilities(): Promise<CarryVenueCapabilities> {
    return {
      venueId: this.venueId,
      venueMode: 'simulated',
      executionSupported: true,
      supportsIncreaseExposure: true,
      supportsReduceExposure: true,
      readOnly: false,
      approvedForLiveUse: false,
      healthy: true,
      onboardingState: 'simulated',
      missingPrerequisites: [],
      metadata: {
        venueType: this.venueType,
      },
    };
  }

  async getVenueCapabilitySnapshot(): Promise<VenueCapabilitySnapshot> {
    return {
      venueId: this.venueId,
      venueName: this.venueId,
      sleeveApplicability: ['carry'],
      connectorType: 'simulated_market_adapter',
      truthMode: 'simulated',
      readOnlySupport: false,
      executionSupport: true,
      approvedForLiveUse: false,
      onboardingState: 'simulated',
      missingPrerequisites: [],
      authRequirementsSummary: [],
      healthy: true,
      healthState: 'healthy',
      degradedReason: null,
      metadata: {
        venueType: this.venueType,
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    const [balances, positions, status] = await Promise.all([
      this.getBalances(),
      this.getPositions(),
      this.getStatus(),
    ]);

    return {
      venueId: this.venueId,
      venueName: this.venueId,
      snapshotType: 'simulated_account_state',
      snapshotSuccessful: true,
      healthy: status.healthy,
      healthState: status.healthy ? 'healthy' : 'degraded',
      summary: `${balances.length} balance rows and ${positions.length} open positions in simulated state.`,
      errorMessage: null,
      capturedAt: new Date().toISOString(),
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: {
          status: 'unsupported',
          reason: 'Simulated carry connectors do not expose a stable venue account identity.',
          limitations: [],
        },
        balanceState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        capacityState: {
          status: 'unsupported',
          reason: 'Carry market adapters do not expose treasury-style liquidity capacity.',
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        derivativeAccountState: {
          status: 'unsupported',
          reason: 'Simulated carry connectors do not expose venue-native derivative account metadata.',
          limitations: [],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Simulated carry connectors do not expose venue-native derivative position state.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Simulated carry connectors do not expose venue-native derivative margin or health state.',
          limitations: [],
        },
        orderState: {
          status: 'unsupported',
          reason: 'Simulated carry connectors do not expose venue-native open order state.',
          limitations: [],
        },
        executionReferences: {
          status: 'unsupported',
          reason: 'Simulated venue truth does not include external execution references.',
          limitations: [],
        },
      },
      sourceMetadata: {
        sourceKind: 'simulation',
        sourceName: 'simulated_market_adapter',
        connectorDepth: 'simulation',
        observedScope: ['balances', 'positions', 'status'],
      },
      accountState: null,
      balanceState: {
        balances: balances.map((balance) => ({
          assetKey: balance.asset,
          assetSymbol: balance.asset,
          assetType: 'unknown',
          accountAddress: null,
          amountAtomic: balance.total,
          amountDisplay: balance.total,
          decimals: null,
          observedSlot: null,
        })),
        totalTrackedBalances: balances.length,
        observedSlot: null,
      },
      capacityState: null,
      exposureState: {
        exposures: positions.map((position) => ({
          exposureKey: `${position.asset}:${position.side}`,
          exposureType: 'position',
          assetKey: position.asset,
          quantity: position.size,
          quantityDisplay: position.size,
          accountAddress: null,
        })),
        methodology: 'venue_positions',
      },
      derivativeAccountState: null,
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        balances: balances.map((balance) => ({
          asset: balance.asset,
          available: balance.available,
          locked: balance.locked,
          total: balance.total,
          updatedAt: balance.updatedAt.toISOString(),
        })),
        positions: positions.map((position) => ({
          asset: position.asset,
          side: position.side,
          size: position.size,
          entryPrice: position.entryPrice,
          markPrice: position.markPrice,
          unrealizedPnl: position.unrealizedPnl,
          updatedAt: position.updatedAt.toISOString(),
        })),
        status: {
          healthy: status.healthy,
          latencyMs: status.latencyMs,
          message: status.message ?? null,
        },
      },
      metadata: {
        venueType: this.venueType,
        simulated: true,
      },
    };
  }

  // ── Account ───────────────────────────────────────────────────────────────

  async getBalances(): Promise<AccountBalance[]> {
    const now = new Date();
    const result: AccountBalance[] = [];

    for (const [asset, total] of this.balances) {
      // Calculate locked balance from open limit orders
      let locked = new Decimal('0');
      for (const order of this.orders.values()) {
        if (order.open && order.params.asset === asset) {
          if (order.params.side === 'buy' && order.params.price !== undefined) {
            locked = locked.plus(
              new Decimal(order.params.size).times(new Decimal(order.params.price)),
            );
          } else if (order.params.side === 'sell') {
            locked = locked.plus(new Decimal(order.params.size));
          }
        }
      }
      const available = Decimal.max(total.minus(locked), new Decimal('0'));
      result.push({
        venueId: this.venueId,
        asset,
        available: available.toFixed(),
        locked: locked.toFixed(),
        total: total.toFixed(),
        updatedAt: now,
      });
    }

    return result;
  }

  async getPositions(): Promise<VenuePosition[]> {
    const now = new Date();
    const result: VenuePosition[] = [];

    for (const [asset, pos] of this.positions) {
      if (pos.size.isZero()) {
        continue;
      }

      let currentPrice: string;
      try {
        currentPrice = await this.priceFeed.getPrice(asset);
      } catch {
        currentPrice = pos.entryPrice.toFixed();
      }

      const markPriceD = new Decimal(currentPrice);
      let unrealizedPnl: Decimal;
      if (pos.side === 'long') {
        unrealizedPnl = markPriceD.minus(pos.entryPrice).times(pos.size);
      } else {
        unrealizedPnl = pos.entryPrice.minus(markPriceD).times(pos.size);
      }

      const marginUsed = pos.entryPrice.times(pos.size).times('0.1'); // 10x leverage assumption
      const liquidationPrice =
        pos.side === 'long'
          ? pos.entryPrice.times('0.9').toFixed()
          : pos.entryPrice.times('1.1').toFixed();

      result.push({
        venueId: this.venueId,
        asset,
        side: pos.side,
        size: pos.size.toFixed(),
        entryPrice: pos.entryPrice.toFixed(),
        markPrice: currentPrice,
        unrealizedPnl: unrealizedPnl.toFixed(),
        marginUsed: marginUsed.toFixed(),
        liquidationPrice,
        updatedAt: now,
      });
    }

    return result;
  }

  // ── Order management ──────────────────────────────────────────────────────

  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    // Idempotency check
    const existingVenueId = this.clientIdIndex.get(params.clientOrderId);
    if (existingVenueId !== undefined) {
      const existing = this.orders.get(existingVenueId);
      if (existing !== undefined) {
        this.logger.debug('placeOrder: returning cached result (idempotent)', {
          clientOrderId: params.clientOrderId,
          venueOrderId: existingVenueId,
        });
        return existing.result;
      }
    }

    if (!this.connected) {
      throw new Error('SimulatedVenueAdapter: not connected');
    }

    const venueOrderId = this._nextOrderId();
    const submittedAt = new Date();

    if (params.type === 'market') {
      const result = await this._fillMarketOrder(params, venueOrderId, submittedAt);
      this.orders.set(venueOrderId, { params, result, open: false });
      this.clientIdIndex.set(params.clientOrderId, venueOrderId);
      this.ordersPlaced.increment({ venue: this.venueId, type: 'market', side: params.side });
      this.logger.info('placeOrder: market order filled', {
        venueOrderId,
        asset: params.asset,
        side: params.side,
        size: params.size,
        averageFillPrice: result.averageFillPrice ?? 'null',
      });
      return result;
    }

    // Limit or post_only
    if (params.price === undefined) {
      throw new Error(`placeOrder: price is required for ${params.type} orders`);
    }

    const result: PlaceOrderResult = {
      venueOrderId,
      clientOrderId: params.clientOrderId,
      status: 'submitted',
      filledSize: '0',
      averageFillPrice: null,
      fees: '0',
      submittedAt,
    };

    this.orders.set(venueOrderId, { params, result, open: true });
    this.clientIdIndex.set(params.clientOrderId, venueOrderId);
    this.ordersPlaced.increment({
      venue: this.venueId,
      type: params.type,
      side: params.side,
    });
    this.logger.info('placeOrder: limit order submitted (open)', {
      venueOrderId,
      asset: params.asset,
      side: params.side,
      size: params.size,
      price: params.price,
    });
    return result;
  }

  async cancelOrder(venueOrderId: string): Promise<CancelOrderResult> {
    const order = this.orders.get(venueOrderId);

    if (order === undefined) {
      this.logger.warn('cancelOrder: order not found', { venueOrderId });
      return { venueOrderId, cancelled: false, reason: 'order not found' };
    }

    if (!order.open) {
      return {
        venueOrderId,
        cancelled: false,
        reason: `order is already in status "${order.result.status}"`,
      };
    }

    order.open = false;
    order.result = { ...order.result, status: 'rejected' };
    this.ordersCancelled.increment({ venue: this.venueId });
    this.logger.info('cancelOrder: order cancelled', { venueOrderId });
    return { venueOrderId, cancelled: true };
  }

  async getOrder(venueOrderId: string): Promise<PlaceOrderResult | null> {
    const order = this.orders.get(venueOrderId);
    if (order === undefined) {
      return null;
    }

    // Attempt to fill open limit orders on query (simulates market crossing)
    if (order.open && order.params.price !== undefined) {
      await this._tryFillLimitOrder(venueOrderId, order);
    }

    return order.result;
  }

  async getStatus(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    return { healthy: true, latencyMs: 1 };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _nextOrderId(): string {
    this.orderCounter += 1;
    return `${this.venueId}-sim-${this.orderCounter}`;
  }

  private _extractSequence(venueOrderId: string): number {
    const suffix = venueOrderId.split('-').pop();
    const parsed = Number.parseInt(suffix ?? '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async _fillMarketOrder(
    params: PlaceOrderParams,
    venueOrderId: string,
    submittedAt: Date,
  ): Promise<PlaceOrderResult> {
    const mid = await this.priceFeed.getPrice(params.asset);
    const midD = new Decimal(mid);
    const slippage = new Decimal(this.config.slippagePct);

    let fillPrice: Decimal;
    if (params.side === 'buy') {
      // Buy at mid + slippage
      fillPrice = midD.times(new Decimal('1').plus(slippage));
    } else {
      // Sell at mid - slippage
      fillPrice = midD.times(new Decimal('1').minus(slippage));
    }

    const sizeD = new Decimal(params.size);
    const notional = fillPrice.times(sizeD);
    const fee = notional.times(new Decimal(this.config.takerFeePct));

    // Update balances and positions
    this._applyFill(params, fillPrice, sizeD, fee);

    this.tradeVolume.increment({ venue: this.venueId }, notional.toNumber());

    return {
      venueOrderId,
      clientOrderId: params.clientOrderId,
      status: 'filled',
      filledSize: params.size,
      averageFillPrice: fillPrice.toFixed(8),
      fees: fee.toFixed(8),
      submittedAt,
    };
  }

  private async _tryFillLimitOrder(
    venueOrderId: string,
    order: InternalOrder,
  ): Promise<void> {
    if (order.params.price === undefined) return;

    let currentPrice: string;
    try {
      currentPrice = await this.priceFeed.getPrice(order.params.asset);
    } catch {
      return;
    }

    const marketPriceD = new Decimal(currentPrice);
    const limitPriceD = new Decimal(order.params.price);

    const shouldFill =
      (order.params.side === 'buy' && marketPriceD.lte(limitPriceD)) ||
      (order.params.side === 'sell' && marketPriceD.gte(limitPriceD));

    if (!shouldFill) return;

    const sizeD = new Decimal(order.params.size);
    const notional = limitPriceD.times(sizeD);
    const fee = notional.times(new Decimal(this.config.makerFeePct));

    this._applyFill(order.params, limitPriceD, sizeD, fee);

    order.open = false;
    order.result = {
      ...order.result,
      status: 'filled',
      filledSize: order.params.size,
      averageFillPrice: limitPriceD.toFixed(8),
      fees: fee.toFixed(8),
    };

    this.logger.info('limit order filled on getOrder poll', {
      venueOrderId,
      fillPrice: limitPriceD.toFixed(),
    });
  }

  private _applyFill(
    params: PlaceOrderParams,
    fillPrice: Decimal,
    size: Decimal,
    fee: Decimal,
  ): void {
    const quoteAsset = this._resolveQuoteAsset(params.asset);

    if (params.side === 'buy') {
      // Deduct quote cost + fee
      const cost = fillPrice.times(size).plus(fee);
      this._adjustBalance(quoteAsset, cost.negated());
      // Add base asset
      this._adjustBalance(params.asset, size);
      // Update long position
      this._updatePosition(params.asset, 'long', size, fillPrice, params.reduceOnly ?? false);
    } else {
      // Sell: remove base asset, receive quote minus fee
      this._adjustBalance(params.asset, size.negated());
      const proceeds = fillPrice.times(size).minus(fee);
      this._adjustBalance(quoteAsset, proceeds);
      // Update short position (or close long)
      this._updatePosition(params.asset, 'short', size, fillPrice, params.reduceOnly ?? false);
    }
  }

  /** Resolve the quote currency for a given base asset (simplified: always USDC) */
  private _resolveQuoteAsset(_baseAsset: string): string {
    // In a real system this would consult a market config.
    // For simulation purposes we always settle in USDC.
    return 'USDC';
  }

  private _adjustBalance(asset: string, delta: Decimal): void {
    const current = this.balances.get(asset) ?? new Decimal('0');
    this.balances.set(asset, current.plus(delta));
  }

  private _updatePosition(
    asset: string,
    incomingSide: 'long' | 'short',
    size: Decimal,
    fillPrice: Decimal,
    reduceOnly: boolean,
  ): void {
    const existing = this.positions.get(asset);

    if (existing === undefined) {
      if (reduceOnly) return; // nothing to reduce
      this.positions.set(asset, {
        asset,
        side: incomingSide,
        size,
        entryPrice: fillPrice,
        realizedPnl: new Decimal('0'),
      });
      return;
    }

    if (existing.side === incomingSide) {
      // Adding to position: update VWAP entry price
      const totalSize = existing.size.plus(size);
      const newEntryPrice = existing.entryPrice
        .times(existing.size)
        .plus(fillPrice.times(size))
        .div(totalSize);
      existing.size = totalSize;
      existing.entryPrice = newEntryPrice;
    } else {
      // Reducing or flipping position
      if (size.lte(existing.size)) {
        // Partial or full close
        let realizedPnl: Decimal;
        if (existing.side === 'long') {
          realizedPnl = fillPrice.minus(existing.entryPrice).times(size);
        } else {
          realizedPnl = existing.entryPrice.minus(fillPrice).times(size);
        }
        existing.realizedPnl = existing.realizedPnl.plus(realizedPnl);
        existing.size = existing.size.minus(size);
        if (existing.size.isZero()) {
          this.positions.delete(asset);
        }
      } else if (!reduceOnly) {
        // Flip position
        const closingSize = existing.size;
        let realizedPnl: Decimal;
        if (existing.side === 'long') {
          realizedPnl = fillPrice.minus(existing.entryPrice).times(closingSize);
        } else {
          realizedPnl = existing.entryPrice.minus(fillPrice).times(closingSize);
        }
        const remainingSize = size.minus(closingSize);
        this.positions.set(asset, {
          asset,
          side: incomingSide,
          size: remainingSize,
          entryPrice: fillPrice,
          realizedPnl,
        });
      } else {
        // reduceOnly but size > existing: cap to existing
        const cappedSize = existing.size;
        let realizedPnl: Decimal;
        if (existing.side === 'long') {
          realizedPnl = fillPrice.minus(existing.entryPrice).times(cappedSize);
        } else {
          realizedPnl = existing.entryPrice.minus(fillPrice).times(cappedSize);
        }
        existing.realizedPnl = existing.realizedPnl.plus(realizedPnl);
        this.positions.delete(asset);
      }
    }
  }
}
