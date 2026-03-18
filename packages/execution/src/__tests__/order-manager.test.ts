// =============================================================================
// InMemoryOrderStore — unit tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import type { OrderIntent } from '@sentinel-apex/domain';

import { InMemoryOrderStore } from '../order-manager.js';

import type { OrderRecord } from '../order-manager.js';

function makeIntent(intentId: string): OrderIntent {
  return {
    intentId,
    venueId: 'test-venue',
    asset: 'SOL',
    side: 'buy',
    type: 'market',
    size: '10',
    limitPrice: null,
    opportunityId: 'opp-001' as import('@sentinel-apex/domain').OpportunityId,
    reduceOnly: false,
    createdAt: new Date(),
    metadata: {},
  };
}

function makeRecord(intentId: string, overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    intent: makeIntent(intentId),
    status: 'pending',
    venueOrderId: null,
    fills: [],
    submittedAt: null,
    completedAt: null,
    lastError: null,
    attemptCount: 0,
    ...overrides,
  };
}

describe('InMemoryOrderStore', () => {
  let store: InMemoryOrderStore;

  beforeEach(() => {
    store = new InMemoryOrderStore();
  });

  // ── save / getByClientId ─────────────────────────────────────────────────

  it('save and retrieve an order record by clientId', async () => {
    const record = makeRecord('intent-001');
    await store.save(record);

    const retrieved = await store.getByClientId('intent-001');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.intent.intentId).toBe('intent-001');
    expect(retrieved?.status).toBe('pending');
  });

  it('returns null for unknown clientOrderId', async () => {
    const result = await store.getByClientId('does-not-exist');
    expect(result).toBeNull();
  });

  it('save overwrites an existing record', async () => {
    const record = makeRecord('intent-002');
    await store.save(record);

    const updated = { ...record, status: 'submitted' as const };
    await store.save(updated);

    const retrieved = await store.getByClientId('intent-002');
    expect(retrieved?.status).toBe('submitted');
  });

  it('returned record has a defensive copy of fills', async () => {
    const record = makeRecord('intent-fills', {
      fills: [
        {
          fillId: 'fill-1',
          orderId: 'order-1' as import('@sentinel-apex/domain').OrderId,
          filledSize: '5',
          fillPrice: '100',
          fee: '0.1',
          feeAsset: 'USDC',
          filledAt: new Date(),
        },
      ],
    });
    await store.save(record);

    const retrieved = await store.getByClientId('intent-fills');
    // Mutating the returned fills should not affect the stored record
    retrieved?.fills.push({
      fillId: 'fill-2',
      orderId: 'order-1' as import('@sentinel-apex/domain').OrderId,
      filledSize: '5',
      fillPrice: '101',
      fee: '0.1',
      feeAsset: 'USDC',
      filledAt: new Date(),
    });

    const again = await store.getByClientId('intent-fills');
    expect(again?.fills).toHaveLength(1);
  });

  // ── updateStatus ─────────────────────────────────────────────────────────

  it('updateStatus changes status correctly', async () => {
    await store.save(makeRecord('intent-003'));
    await store.updateStatus('intent-003', 'submitted');

    const retrieved = await store.getByClientId('intent-003');
    expect(retrieved?.status).toBe('submitted');
  });

  it('updateStatus merges partial updates', async () => {
    await store.save(makeRecord('intent-004'));
    const now = new Date();
    await store.updateStatus('intent-004', 'submitted', {
      venueOrderId: 'v-order-99',
      submittedAt: now,
      attemptCount: 1,
    });

    const retrieved = await store.getByClientId('intent-004');
    expect(retrieved?.venueOrderId).toBe('v-order-99');
    expect(retrieved?.submittedAt).toEqual(now);
    expect(retrieved?.attemptCount).toBe(1);
    expect(retrieved?.status).toBe('submitted');
  });

  it('updateStatus throws for unknown clientOrderId', async () => {
    await expect(store.updateStatus('no-such-id', 'filled')).rejects.toThrow();
  });

  it('prevents invalid backward transitions from submitted to pending', async () => {
    await store.save(makeRecord('intent-invalid-backward', { status: 'submitted' }));

    await expect(
      store.updateStatus('intent-invalid-backward', 'pending'),
    ).rejects.toThrow(/invalid order status transition/i);
  });

  it('prevents mutating a terminal filled order', async () => {
    await store.save(makeRecord('intent-filled', { status: 'filled', completedAt: new Date() }));

    await expect(
      store.updateStatus('intent-filled', 'submitted'),
    ).rejects.toThrow(/invalid order status transition/i);
  });

  it('allows retrying a failed order back to submitted', async () => {
    await store.save(makeRecord('intent-retryable', { status: 'failed', lastError: 'temporary venue error' }));

    await store.updateStatus('intent-retryable', 'submitted', {
      attemptCount: 2,
      lastError: null,
    });

    const retrieved = await store.getByClientId('intent-retryable');
    expect(retrieved?.status).toBe('submitted');
    expect(retrieved?.attemptCount).toBe(2);
    expect(retrieved?.lastError).toBeNull();
  });

  // ── listByStatus ─────────────────────────────────────────────────────────

  it('listByStatus returns only matching records', async () => {
    await store.save(makeRecord('r1', { status: 'pending' }));
    await store.save(makeRecord('r2', { status: 'submitted' }));
    await store.save(makeRecord('r3', { status: 'filled' }));
    await store.save(makeRecord('r4', { status: 'pending' }));

    const pending = await store.listByStatus('pending');
    expect(pending).toHaveLength(2);
    expect(pending.every((r) => r.status === 'pending')).toBe(true);

    const filled = await store.listByStatus('filled');
    expect(filled).toHaveLength(1);
  });

  it('listByStatus returns empty array when no matches', async () => {
    await store.save(makeRecord('r-only', { status: 'pending' }));
    const cancelled = await store.listByStatus('cancelled');
    expect(cancelled).toHaveLength(0);
  });
});
