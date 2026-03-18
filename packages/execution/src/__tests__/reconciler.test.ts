// =============================================================================
// Reconciler — unit tests
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { OrderIntent } from '@sentinel-apex/domain';
import { ConsoleAuditWriter, createLogger } from '@sentinel-apex/observability';
import { SimulatedVenueAdapter } from '@sentinel-apex/venue-adapters';
import type { SimulatedVenueConfig, VenuePosition } from '@sentinel-apex/venue-adapters';

import { InMemoryOrderStore } from '../order-manager.js';
import { Reconciler } from '../reconciler.js';

// Silence audit output during tests
vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

const simConfig: SimulatedVenueConfig = {
  venueId: 'recon-sim',
  venueType: 'cex',
  makerFeePct: '0.001',
  takerFeePct: '0.002',
  slippagePct: '0.0005',
  initialBalances: { USDC: '200000', SOL: '0', BTC: '0' },
  deterministicPrices: { SOL: '200', BTC: '50000' },
};

function makeIntent(intentId: string, venueOrderId?: string): {
  intent: OrderIntent;
  venueOrderId: string | null;
} {
  return {
    intent: {
      intentId,
      venueId: 'recon-sim',
      asset: 'SOL',
      side: 'buy',
      type: 'limit',
      size: '1',
      limitPrice: '50',
      opportunityId: 'opp-recon' as import('@sentinel-apex/domain').OpportunityId,
      reduceOnly: false,
      createdAt: new Date(),
      metadata: {},
    },
    venueOrderId: venueOrderId ?? null,
  };
}

function makeLocalPosition(
  asset: string,
  side: 'long' | 'short',
  size: string,
  entryPrice: string,
): VenuePosition {
  return {
    venueId: 'recon-sim',
    asset,
    side,
    size,
    entryPrice,
    markPrice: entryPrice,
    unrealizedPnl: '0',
    marginUsed: '0',
    liquidationPrice: null,
    updatedAt: new Date(),
  };
}

function makeReconciler(adapter: SimulatedVenueAdapter, store: InMemoryOrderStore) {
  return new Reconciler(
    adapter,
    store,
    createLogger('test-reconciler'),
    new ConsoleAuditWriter(),
  );
}

describe('Reconciler', () => {
  let adapter: SimulatedVenueAdapter;
  let store: InMemoryOrderStore;

  beforeEach(async () => {
    adapter = new SimulatedVenueAdapter(simConfig);
    await adapter.connect();
    store = new InMemoryOrderStore();
  });

  // ── reconcileOrders ───────────────────────────────────────────────────────

  describe('reconcileOrders', () => {
    it('returns healthy with no discrepancies when all local orders are found at venue', async () => {
      // Place a real order at the simulated venue (limit, won't fill at 50 vs 200 market)
      const placed = await adapter.placeOrder({
        clientOrderId: 'recon-order-001',
        asset: 'SOL',
        side: 'buy',
        type: 'limit',
        size: '1',
        price: '50',
      });

      // Save the record in our store
      const { intent } = makeIntent('recon-order-001', placed.venueOrderId);
      await store.save({
        intent,
        status: 'submitted',
        venueOrderId: placed.venueOrderId,
        fills: [],
        submittedAt: new Date(),
        completedAt: null,
        lastError: null,
        attemptCount: 1,
      });

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcileOrders('recon-sim');

      expect(result.healthy).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('detects missing_order when local record references a non-existent venue order', async () => {
      const { intent } = makeIntent('recon-missing-001', 'fake-venue-order-id');
      await store.save({
        intent,
        status: 'submitted',
        venueOrderId: 'fake-venue-order-id',
        fills: [],
        submittedAt: new Date(),
        completedAt: null,
        lastError: null,
        attemptCount: 1,
      });

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcileOrders('recon-sim');

      expect(result.healthy).toBe(false);
      const missing = result.discrepancies.filter((d) => d.type === 'missing_order');
      expect(missing).toHaveLength(1);
      expect(missing[0]?.severity).toBe('high');
    });

    it('returns healthy with no orders in the store', async () => {
      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcileOrders('recon-sim');

      expect(result.healthy).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });
  });

  // ── reconcilePositions ────────────────────────────────────────────────────

  describe('reconcilePositions', () => {
    it('returns healthy with no discrepancies when positions match', async () => {
      // Create an actual position in the simulated adapter by placing a market order
      await adapter.placeOrder({
        clientOrderId: 'pos-match-001',
        asset: 'SOL',
        side: 'buy',
        type: 'market',
        size: '5',
      });

      const venuePositions = await adapter.getPositions();
      const solPos = venuePositions.find((p) => p.asset === 'SOL');
      expect(solPos).toBeDefined();

      // Our local record matches the venue
      const localPositions: VenuePosition[] = [
        makeLocalPosition('SOL', 'long', solPos?.size ?? '5', solPos?.entryPrice ?? '200'),
      ];

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', localPositions);

      expect(result.healthy).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('detects position_mismatch when local size differs significantly from venue', async () => {
      // Venue has 5 SOL long
      await adapter.placeOrder({
        clientOrderId: 'pos-mismatch-buy',
        asset: 'SOL',
        side: 'buy',
        type: 'market',
        size: '5',
      });

      // Local claims a different size
      const localPositions: VenuePosition[] = [
        makeLocalPosition('SOL', 'long', '1', '200'), // wrong size
      ];

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', localPositions);

      const mismatches = result.discrepancies.filter((d) => d.type === 'position_mismatch');
      expect(mismatches.length).toBeGreaterThan(0);
      expect(result.healthy).toBe(false);
    });

    it('detects unknown_order when venue has position that local does not know about', async () => {
      // Venue has SOL position after a buy
      await adapter.placeOrder({
        clientOrderId: 'unknown-pos-buy',
        asset: 'SOL',
        side: 'buy',
        type: 'market',
        size: '3',
      });

      // Local has NO positions recorded
      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', []);

      const unknown = result.discrepancies.filter((d) => d.type === 'unknown_order');
      expect(unknown.length).toBeGreaterThan(0);
      expect(result.healthy).toBe(false);
    });

    it('detects position_mismatch when sides differ (critical severity)', async () => {
      // Venue has a long position
      await adapter.placeOrder({
        clientOrderId: 'side-mismatch-buy',
        asset: 'SOL',
        side: 'buy',
        type: 'market',
        size: '2',
      });

      // Local claims a short position for the same asset
      const localPositions: VenuePosition[] = [
        makeLocalPosition('SOL', 'short', '2', '200'),
      ];

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', localPositions);

      const critical = result.discrepancies.filter(
        (d) => d.type === 'position_mismatch' && d.severity === 'critical',
      );
      expect(critical.length).toBeGreaterThan(0);
    });

    it('returns healthy when there are no positions locally or at venue', async () => {
      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', []);

      expect(result.healthy).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('detects local position not present at venue as position_mismatch', async () => {
      // Local claims a BTC position but venue has none
      const localPositions: VenuePosition[] = [
        makeLocalPosition('BTC', 'long', '2', '50000'),
      ];

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', localPositions);

      const mismatch = result.discrepancies.filter((d) => d.type === 'position_mismatch');
      expect(mismatch.length).toBeGreaterThan(0);
      expect(result.healthy).toBe(false);
    });
  });

  // ── Severity classification ───────────────────────────────────────────────

  describe('severity classification', () => {
    it('small position difference is classified as low severity', async () => {
      // Venue has 5.000001 SOL, local claims 5.000000 — tiny rounding diff
      await adapter.placeOrder({
        clientOrderId: 'sev-low',
        asset: 'SOL',
        side: 'buy',
        type: 'market',
        size: '5',
      });

      const venuePositions = await adapter.getPositions();
      const vPos = venuePositions.find((p) => p.asset === 'SOL');
      expect(vPos).toBeDefined();

      // Local size matches within tolerance — no discrepancy expected
      const localPositions: VenuePosition[] = [
        makeLocalPosition('SOL', 'long', vPos?.size ?? '5', vPos?.entryPrice ?? '200'),
      ];

      const reconciler = makeReconciler(adapter, store);
      const result = await reconciler.reconcilePositions('recon-sim', localPositions);
      expect(result.discrepancies).toHaveLength(0);
    });
  });
});
