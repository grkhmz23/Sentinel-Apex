// =============================================================================
// SimulatedVenueAdapter — unit tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import { SimulatedVenueAdapter } from '../simulation/simulated-venue-adapter.js';

import type { SimulatedVenueConfig } from '../simulation/simulated-venue-adapter.js';

function makeConfig(overrides: Partial<SimulatedVenueConfig> = {}): SimulatedVenueConfig {
  return {
    venueId: 'test-sim',
    venueType: 'cex',
    makerFeePct: '0.001',
    takerFeePct: '0.002',
    slippagePct: '0.001',
    initialBalances: { USDC: '100000', SOL: '0' },
    deterministicPrices: { SOL: '100', BTC: '50000' },
    ...overrides,
  };
}

describe('SimulatedVenueAdapter', () => {
  let adapter: SimulatedVenueAdapter;

  beforeEach(() => {
    adapter = new SimulatedVenueAdapter(makeConfig());
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  it('isConnected() returns false before connect()', () => {
    expect(adapter.isConnected()).toBe(false);
  });

  it('connect/disconnect lifecycle', async () => {
    await adapter.connect();
    expect(adapter.isConnected()).toBe(true);

    await adapter.disconnect();
    expect(adapter.isConnected()).toBe(false);
  });

  // ── Market data ───────────────────────────────────────────────────────────

  it('getMarketData returns correct data for a known asset', async () => {
    await adapter.connect();
    const data = await adapter.getMarketData('SOL');

    expect(data.venueId).toBe('test-sim');
    expect(data.asset).toBe('SOL');
    expect(parseFloat(data.mid)).toBeCloseTo(100, 1);
    expect(parseFloat(data.ask)).toBeGreaterThan(parseFloat(data.mid));
    expect(parseFloat(data.bid)).toBeLessThan(parseFloat(data.mid));
    expect(data.updatedAt).toBeInstanceOf(Date);
  });

  it('getMarketData throws for unknown asset when using StaticPriceFeed', async () => {
    await adapter.connect();
    await expect(adapter.getMarketData('UNKNOWN')).rejects.toThrow();
  });

  // ── Market order fills ────────────────────────────────────────────────────

  it('market buy fills at mid + slippage', async () => {
    await adapter.connect();

    const result = await adapter.placeOrder({
      clientOrderId: 'buy-001',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '1',
    });

    expect(result.status).toBe('filled');
    expect(result.filledSize).toBe('1');

    // Fill price should be above mid (100) due to slippage
    const fillPrice = parseFloat(result.averageFillPrice ?? '0');
    expect(fillPrice).toBeGreaterThan(100);
    expect(fillPrice).toBeLessThanOrEqual(100 * (1 + 0.001 + 0.0001)); // small tolerance
  });

  it('market sell fills at mid - slippage', async () => {
    await adapter.connect();

    // First get some SOL to sell
    await adapter.placeOrder({
      clientOrderId: 'buy-for-sell',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '5',
    });

    const result = await adapter.placeOrder({
      clientOrderId: 'sell-001',
      asset: 'SOL',
      side: 'sell',
      type: 'market',
      size: '1',
    });

    expect(result.status).toBe('filled');
    const fillPrice = parseFloat(result.averageFillPrice ?? '0');
    // Sell fills below mid (100)
    expect(fillPrice).toBeLessThan(100);
    expect(fillPrice).toBeGreaterThan(100 * (1 - 0.001 - 0.0001));
  });

  // ── Balance effects ───────────────────────────────────────────────────────

  it('balance decrements (USDC) after market buy order', async () => {
    await adapter.connect();

    const beforeBalances = await adapter.getBalances();
    const usdcBefore = parseFloat(
      beforeBalances.find((b) => b.asset === 'USDC')?.total ?? '0',
    );

    await adapter.placeOrder({
      clientOrderId: 'buy-balance-test',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '10',
    });

    const afterBalances = await adapter.getBalances();
    const usdcAfter = parseFloat(
      afterBalances.find((b) => b.asset === 'USDC')?.total ?? '0',
    );

    // Buying 10 SOL at ~100 USDC + fee, so USDC should decrease by ~1002
    expect(usdcAfter).toBeLessThan(usdcBefore);
    expect(usdcBefore - usdcAfter).toBeGreaterThan(1000);
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  it('placeOrder is idempotent: same clientOrderId returns identical result', async () => {
    await adapter.connect();

    const first = await adapter.placeOrder({
      clientOrderId: 'idem-001',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '1',
    });

    const second = await adapter.placeOrder({
      clientOrderId: 'idem-001',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '1',
    });

    expect(second.venueOrderId).toBe(first.venueOrderId);
    expect(second.filledSize).toBe(first.filledSize);
    expect(second.averageFillPrice).toBe(first.averageFillPrice);
  });

  // ── Limit order cancellation ──────────────────────────────────────────────

  it('cancelOrder on a pending limit order succeeds', async () => {
    await adapter.connect();

    // Place a limit buy well below market (won't fill)
    const placed = await adapter.placeOrder({
      clientOrderId: 'limit-001',
      asset: 'SOL',
      side: 'buy',
      type: 'limit',
      size: '1',
      price: '50', // far below market
    });

    expect(placed.status).toBe('submitted');

    const cancel = await adapter.cancelOrder(placed.venueOrderId);
    expect(cancel.cancelled).toBe(true);
    expect(cancel.venueOrderId).toBe(placed.venueOrderId);

    // Trying to cancel again should fail gracefully
    const cancelAgain = await adapter.cancelOrder(placed.venueOrderId);
    expect(cancelAgain.cancelled).toBe(false);
  });

  it('cancelOrder returns cancelled:false for unknown order', async () => {
    await adapter.connect();
    const result = await adapter.cancelOrder('nonexistent-order-id');
    expect(result.cancelled).toBe(false);
    expect(result.reason).toBeDefined();
  });

  // ── Position tracking ─────────────────────────────────────────────────────

  it('getPositions reflects open long position after market buy', async () => {
    await adapter.connect();

    await adapter.placeOrder({
      clientOrderId: 'pos-buy-001',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '5',
    });

    const positions = await adapter.getPositions();
    const solPos = positions.find((p) => p.asset === 'SOL');

    expect(solPos).toBeDefined();
    expect(solPos?.side).toBe('long');
    expect(parseFloat(solPos?.size ?? '0')).toBeCloseTo(5, 5);
    expect(parseFloat(solPos?.entryPrice ?? '0')).toBeGreaterThan(100);
  });

  it('position is closed after offsetting sell', async () => {
    await adapter.connect();

    await adapter.placeOrder({
      clientOrderId: 'open-pos',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '5',
    });

    await adapter.placeOrder({
      clientOrderId: 'close-pos',
      asset: 'SOL',
      side: 'sell',
      type: 'market',
      size: '5',
    });

    const positions = await adapter.getPositions();
    const solPos = positions.find((p) => p.asset === 'SOL');
    expect(solPos).toBeUndefined();
  });

  // ── getOrder ──────────────────────────────────────────────────────────────

  it('getOrder returns null for unknown order', async () => {
    await adapter.connect();
    const result = await adapter.getOrder('does-not-exist');
    expect(result).toBeNull();
  });

  it('getOrder returns filled result for a completed market order', async () => {
    await adapter.connect();

    const placed = await adapter.placeOrder({
      clientOrderId: 'get-order-test',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '2',
    });

    const fetched = await adapter.getOrder(placed.venueOrderId);
    expect(fetched).not.toBeNull();
    expect(fetched?.status).toBe('filled');
  });

  // ── getStatus ─────────────────────────────────────────────────────────────

  it('getStatus always returns healthy', async () => {
    const status = await adapter.getStatus();
    expect(status.healthy).toBe(true);
    expect(typeof status.latencyMs).toBe('number');
  });

  // ── Fees ──────────────────────────────────────────────────────────────────

  it('market order result has positive fees', async () => {
    await adapter.connect();
    const result = await adapter.placeOrder({
      clientOrderId: 'fee-test',
      asset: 'SOL',
      side: 'buy',
      type: 'market',
      size: '1',
    });

    expect(parseFloat(result.fees)).toBeGreaterThan(0);
  });

  // ── Factory (dry-run) ─────────────────────────────────────────────────────

  it('throws when trying to placeOrder without connecting', async () => {
    // adapter is not connected in this test (no beforeEach connect())
    const fresh = new SimulatedVenueAdapter(makeConfig());
    await expect(
      fresh.placeOrder({
        clientOrderId: 'no-connect',
        asset: 'SOL',
        side: 'buy',
        type: 'market',
        size: '1',
      }),
    ).rejects.toThrow('not connected');
  });
});
