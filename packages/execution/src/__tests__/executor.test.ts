// =============================================================================
// OrderExecutor — integration tests using SimulatedVenueAdapter
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { OrderIntent } from '@sentinel-apex/domain';
import { ConsoleAuditWriter, createLogger } from '@sentinel-apex/observability';
import { SimulatedVenueAdapter } from '@sentinel-apex/venue-adapters';
import type { SimulatedVenueConfig } from '@sentinel-apex/venue-adapters';

import { OrderExecutor } from '../executor.js';
import { InMemoryOrderStore } from '../order-manager.js';

// Silence audit output during tests
vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

const simConfig: SimulatedVenueConfig = {
  venueId: 'exec-sim',
  venueType: 'cex',
  makerFeePct: '0.001',
  takerFeePct: '0.002',
  slippagePct: '0.0005',
  initialBalances: { USDC: '500000', SOL: '0', BTC: '0' },
  deterministicPrices: { SOL: '150', BTC: '40000' },
};

function makeIntent(intentId: string, overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId,
    venueId: 'exec-sim',
    asset: 'SOL',
    side: 'buy',
    type: 'market',
    size: '2',
    limitPrice: null,
    opportunityId: 'opp-exec-001' as import('@sentinel-apex/domain').OpportunityId,
    reduceOnly: false,
    createdAt: new Date(),
    metadata: {},
    ...overrides,
  };
}

function makeExecutor(adapter: SimulatedVenueAdapter, store?: InMemoryOrderStore) {
  const s = store ?? new InMemoryOrderStore();
  const executor = new OrderExecutor(
    adapter,
    s,
    { maxRetries: 2, retryDelayMs: 0, orderTimeoutMs: 5000 },
    createLogger('test-executor'),
    new ConsoleAuditWriter(),
  );
  return { executor, store: s };
}

describe('OrderExecutor', () => {
  let adapter: SimulatedVenueAdapter;

  beforeEach(async () => {
    adapter = new SimulatedVenueAdapter(simConfig);
    await adapter.connect();
  });

  // ── submitIntent ──────────────────────────────────────────────────────────

  it('submits a market order and it fills successfully', async () => {
    const { executor } = makeExecutor(adapter);
    const intent = makeIntent('exec-market-001');

    const record = await executor.submitIntent(intent);

    expect(record.status).toBe('filled');
    expect(record.venueOrderId).toBeTruthy();
    expect(record.submittedAt).toBeInstanceOf(Date);
    expect(record.completedAt).toBeInstanceOf(Date);
    expect(record.lastError).toBeNull();
  });

  it('submits a limit order that remains submitted (below market)', async () => {
    const { executor } = makeExecutor(adapter);
    const intent = makeIntent('exec-limit-001', {
      type: 'limit',
      limitPrice: '50', // well below market at 150
    });

    const record = await executor.submitIntent(intent);

    expect(record.status).toBe('submitted');
    expect(record.venueOrderId).toBeTruthy();
  });

  it('idempotent submit: same intentId returns same result without re-submitting', async () => {
    const { executor, store } = makeExecutor(adapter);
    const intent = makeIntent('exec-idem-001');

    const first = await executor.submitIntent(intent);
    const second = await executor.submitIntent(intent);

    // Same venueOrderId — no second submission to the adapter
    expect(second.venueOrderId).toBe(first.venueOrderId);
    expect(second.status).toBe(first.status);

    // Should still only have one record
    const allFilled = await store.listByStatus('filled');
    expect(allFilled).toHaveLength(1);
  });

  // ── cancelOrder ──────────────────────────────────────────────────────────

  it('cancels a pending limit order', async () => {
    const { executor } = makeExecutor(adapter);
    const intent = makeIntent('exec-cancel-001', {
      type: 'limit',
      limitPrice: '50',
    });

    const submitted = await executor.submitIntent(intent);
    expect(submitted.status).toBe('submitted');

    const cancelled = await executor.cancelOrder('exec-cancel-001');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).toBeInstanceOf(Date);
  });

  it('cancelOrder throws when order is not found in the store', async () => {
    const { executor } = makeExecutor(adapter);
    await expect(executor.cancelOrder('nonexistent-id')).rejects.toThrow();
  });

  // ── pollOrderStatus ───────────────────────────────────────────────────────

  it('pollOrderStatus returns updated status for a filled order', async () => {
    const { executor } = makeExecutor(adapter);
    const intent = makeIntent('exec-poll-001');

    await executor.submitIntent(intent);
    const polled = await executor.pollOrderStatus('exec-poll-001');

    expect(polled.status).toBe('filled');
  });

  it('pollOrderStatus throws when order is not in the store', async () => {
    const { executor } = makeExecutor(adapter);
    await expect(executor.pollOrderStatus('unknown-id')).rejects.toThrow();
  });

  // ── processFill ───────────────────────────────────────────────────────────

  it('processFill appends fill and transitions to filled when fully filled', async () => {
    const { executor, store } = makeExecutor(adapter);
    const intent = makeIntent('exec-fill-001', { size: '4' });

    // Manually save as submitted
    await store.save({
      intent,
      status: 'submitted',
      venueOrderId: 'v-123',
      fills: [],
      submittedAt: new Date(),
      completedAt: null,
      lastError: null,
      attemptCount: 1,
    });

    const fill = {
      fillId: 'fill-abc',
      orderId: 'exec-fill-001' as import('@sentinel-apex/domain').OrderId,
      filledSize: '4',
      fillPrice: '150',
      fee: '0.12',
      feeAsset: 'USDC' as import('@sentinel-apex/domain').AssetSymbol,
      filledAt: new Date(),
    };

    const record = await executor.processFill('exec-fill-001', fill);

    expect(record.status).toBe('filled');
    expect(record.fills).toHaveLength(1);
    expect(record.completedAt).toBeInstanceOf(Date);
  });

  it('processFill keeps status as partially_filled when not fully filled', async () => {
    const { executor, store } = makeExecutor(adapter);
    const intent = makeIntent('exec-partial-001', { size: '10' });

    await store.save({
      intent,
      status: 'submitted',
      venueOrderId: 'v-456',
      fills: [],
      submittedAt: new Date(),
      completedAt: null,
      lastError: null,
      attemptCount: 1,
    });

    const fill = {
      fillId: 'fill-partial',
      orderId: 'exec-partial-001' as import('@sentinel-apex/domain').OrderId,
      filledSize: '3',
      fillPrice: '150',
      fee: '0.09',
      feeAsset: 'USDC' as import('@sentinel-apex/domain').AssetSymbol,
      filledAt: new Date(),
    };

    const record = await executor.processFill('exec-partial-001', fill);

    expect(record.status).toBe('partially_filled');
    expect(record.fills).toHaveLength(1);
    expect(record.completedAt).toBeNull();
  });

  it('processFill ignores duplicate fill events with the same fillId', async () => {
    const { executor, store } = makeExecutor(adapter);
    const intent = makeIntent('exec-dup-fill-001', { size: '4' });

    await store.save({
      intent,
      status: 'submitted',
      venueOrderId: 'v-dup-1',
      fills: [],
      submittedAt: new Date(),
      completedAt: null,
      lastError: null,
      attemptCount: 1,
    });

    const fill = {
      fillId: 'fill-dup-1',
      orderId: 'exec-dup-fill-001' as import('@sentinel-apex/domain').OrderId,
      filledSize: '2',
      fillPrice: '150',
      fee: '0.06',
      feeAsset: 'USDC' as import('@sentinel-apex/domain').AssetSymbol,
      filledAt: new Date(),
    };

    const first = await executor.processFill('exec-dup-fill-001', fill);
    const second = await executor.processFill('exec-dup-fill-001', fill);

    expect(first.fills).toHaveLength(1);
    expect(second.fills).toHaveLength(1);
    expect(second.status).toBe('partially_filled');
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('retries and ultimately marks as failed when adapter throws', async () => {
    // Disconnect adapter to force errors
    await adapter.disconnect();

    const { executor } = makeExecutor(adapter);
    const intent = makeIntent('exec-error-001');

    const record = await executor.submitIntent(intent);

    expect(record.status).toBe('failed');
    expect(record.lastError).toBeTruthy();
  });
});
