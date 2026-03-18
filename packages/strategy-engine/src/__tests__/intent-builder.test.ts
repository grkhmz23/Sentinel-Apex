// =============================================================================
// Intent builder tests
// =============================================================================

import { describe, it, expect } from 'vitest';

import type { CarryOpportunityCandidate } from '@sentinel-apex/carry';

import { buildIntentsFromOpportunity } from '../intent-builder.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFundingArbOpportunity(
  overrides: Partial<CarryOpportunityCandidate> = {},
): CarryOpportunityCandidate {
  const now = new Date();
  return {
    type: 'funding_rate_arb',
    asset: 'BTC',
    legs: [
      {
        venueId: 'binance',
        asset: 'BTC',
        side: 'short',
        instrumentType: 'perpetual',
        estimatedSize: '1',
        estimatedPrice: '50000',
        estimatedFee: '0.05',
      },
      {
        venueId: 'binance',
        asset: 'BTC',
        side: 'long',
        instrumentType: 'spot',
        estimatedSize: '1',
        estimatedPrice: '50000',
        estimatedFee: '0.05',
      },
    ],
    expectedAnnualYieldPct: '32.85',
    estimatedFeeCostPct: '0.14',
    netYieldPct: '32.71',
    confidenceScore: 0.9,
    detectedAt: now,
    expiresAt: new Date(now.getTime() + 300_000),
    metadata: { venueId: 'binance' },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildIntentsFromOpportunity', () => {
  it('produces 2 intents for a funding arb opportunity with 2 legs', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');

    expect(intents).toHaveLength(2);
  });

  it('assigns clientOrderId in format ${asset}-${type}-${side}-${timestamp}', () => {
    const opp = makeFundingArbOpportunity();
    const before = Date.now();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');
    const after = Date.now();

    for (const intent of intents) {
      const parts = intent.intentId.split('-');
      // Format: BTC-funding_rate_arb-buy/sell-<timestamp>
      expect(parts[0]).toBe('BTC');
      expect(parts[1]).toBe('funding_rate_arb');
      expect(['buy', 'sell']).toContain(parts[2]);

      // Last part is the timestamp
      const ts = parseInt(parts[parts.length - 1]!, 10);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });

  it('maps leg sides to correct order sides', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');

    const sellIntent = intents.find((i) => i.side === 'sell');
    const buyIntent = intents.find((i) => i.side === 'buy');

    expect(sellIntent).toBeDefined();
    expect(buyIntent).toBeDefined();

    // short leg → sell order
    expect(sellIntent?.metadata['legSide']).toBe('short');
    // long leg → buy order
    expect(buyIntent?.metadata['legSide']).toBe('long');
  });

  it('sets correct asset on each intent', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');

    for (const intent of intents) {
      expect(intent.asset).toBe('BTC');
    }
  });

  it('computes size as half of total notional divided by estimated price', () => {
    const positionSizeUsd = '10000';
    const estimatedPrice = '50000';
    const opp = makeFundingArbOpportunity();
    // Each leg: 5000 / 50000 = 0.1 BTC
    const expectedSize = (5000 / 50000).toFixed(8);

    const intents = buildIntentsFromOpportunity(opp, 'carry', positionSizeUsd);

    for (const intent of intents) {
      expect(parseFloat(intent.size)).toBeCloseTo(parseFloat(expectedSize), 6);
    }

    void estimatedPrice;
  });

  it('includes sleeveId in metadata', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'my-carry-sleeve', '5000');

    for (const intent of intents) {
      expect(intent.metadata['sleeveId']).toBe('my-carry-sleeve');
    }
  });

  it('all intents share the same opportunityId (correlated)', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');

    const opportunityIds = intents.map((i) => i.opportunityId);
    const unique = new Set(opportunityIds);
    expect(unique.size).toBe(1);
  });

  it('sets order type to market', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');

    for (const intent of intents) {
      expect(intent.type).toBe('market');
    }
  });

  it('sets limitPrice to null for market orders', () => {
    const opp = makeFundingArbOpportunity();
    const intents = buildIntentsFromOpportunity(opp, 'carry', '10000');

    for (const intent of intents) {
      expect(intent.limitPrice).toBeNull();
    }
  });
});
