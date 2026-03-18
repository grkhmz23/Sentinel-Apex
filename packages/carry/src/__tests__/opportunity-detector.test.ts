// =============================================================================
// Opportunity detector tests
// =============================================================================

import { describe, it, expect } from 'vitest';

import type { MarketData } from '@sentinel-apex/venue-adapters';

import { DEFAULT_CARRY_CONFIG } from '../config.js';
import {
  detectFundingRateOpportunities,
  detectBasisOpportunities,
  detectCrossVenueOpportunities,
} from '../opportunity-detector.js';

import type { CarryConfig } from '../config.js';
import type { FundingRateSnapshot, BasisSnapshot } from '../opportunity-detector.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<CarryConfig> = {}): CarryConfig {
  return {
    ...DEFAULT_CARRY_CONFIG,
    approvedVenues: [],
    approvedAssets: [],
    ...overrides,
  };
}

function makeFundingSnapshot(
  overrides: Partial<FundingRateSnapshot> = {},
): FundingRateSnapshot {
  const now = new Date();
  return {
    venueId: 'binance',
    asset: 'BTC',
    rate8h: '0.0003', // 0.03% per 8h
    annualizedRate: '10.95', // 0.03% × 3 × 365 = 32.85% (use 10.95 for 0.01% × 3 × 365)
    markPrice: '50000',
    nextFundingTime: new Date(now.getTime() + 8 * 60 * 60 * 1_000),
    timestamp: now,
    ...overrides,
  };
}

function makeMarketData(
  venueId: string,
  asset: string,
  mid: string,
  overrides: Partial<MarketData> = {},
): MarketData {
  const now = new Date();
  return {
    venueId,
    asset,
    bid: mid,
    ask: mid,
    mid,
    markPrice: mid,
    indexPrice: mid,
    fundingRate: '0.0001',
    nextFundingTime: new Date(now.getTime() + 8 * 60 * 60 * 1_000),
    openInterest: '1000000',
    volume24h: '5000000',
    updatedAt: now,
    ...overrides,
  };
}

// ── detectFundingRateOpportunities ────────────────────────────────────────────

describe('detectFundingRateOpportunities', () => {
  it('detects an opportunity when positive funding rate exceeds threshold', () => {
    const config = makeConfig({ minAnnualYieldPct: '5.0' });
    // 0.03% per 8h → 32.85% annualized → well above 5% threshold
    const snap = makeFundingSnapshot({
      rate8h: '0.0003',
      annualizedRate: '32.85',
    });

    const results = detectFundingRateOpportunities([snap], config);

    expect(results).toHaveLength(1);
    const opp = results[0]!;
    expect(opp.type).toBe('funding_rate_arb');
    expect(opp.asset).toBe('BTC');
    // Positive funding → short perp (longs pay shorts), long spot
    expect(opp.legs[0]?.side).toBe('short');
    expect(opp.legs[0]?.instrumentType).toBe('perpetual');
    expect(opp.legs[0]?.estimatedPrice).toBe('50000');
    expect(opp.legs[1]?.side).toBe('long');
    expect(opp.legs[1]?.instrumentType).toBe('spot');
    expect(parseFloat(opp.netYieldPct)).toBeGreaterThan(5);
  });

  it('returns no opportunity when funding rate is below threshold', () => {
    const config = makeConfig({ minAnnualYieldPct: '5.0' });
    // 0.001% per 8h → ~1.09% annualized → below 5% threshold
    const snap = makeFundingSnapshot({
      rate8h: '0.00001',
      annualizedRate: '1.09',
    });

    const results = detectFundingRateOpportunities([snap], config);
    expect(results).toHaveLength(0);
  });

  it('returns no opportunity when annualized funding is below minFundingRateAnnualized', () => {
    const config = makeConfig({
      minAnnualYieldPct: '1.0',
      minFundingRateAnnualized: '8.0',
    });
    const snap = makeFundingSnapshot({
      rate8h: '0.00006',
      annualizedRate: '6.57',
    });

    const results = detectFundingRateOpportunities([snap], config);
    expect(results).toHaveLength(0);
  });

  it('detects opportunity for negative funding rate (short perp earns funding)', () => {
    const config = makeConfig({ minAnnualYieldPct: '5.0' });
    // Negative funding: longs receive funding → long perp, short spot
    const snap = makeFundingSnapshot({
      rate8h: '-0.0003',
      annualizedRate: '-32.85',
    });

    const results = detectFundingRateOpportunities([snap], config);

    expect(results).toHaveLength(1);
    const opp = results[0]!;
    // Negative funding → long perp (shorts pay longs)
    expect(opp.legs[0]?.side).toBe('long');
    expect(opp.legs[0]?.instrumentType).toBe('perpetual');
    expect(opp.legs[1]?.side).toBe('short');
  });

  it('computes higher confidence score for recent data', () => {
    const config = makeConfig({ minConfidenceScore: 0.4 });
    const recentSnap = makeFundingSnapshot({
      annualizedRate: '20.0',
      timestamp: new Date(), // just now
    });
    const oldTimestamp = new Date(Date.now() - (config.maxOpportunityAgeSec / 2) * 1_000);
    const olderSnap = makeFundingSnapshot({
      venueId: 'okx',
      annualizedRate: '20.0',
      timestamp: oldTimestamp,
    });

    const results = detectFundingRateOpportunities([recentSnap, olderSnap], config);
    const recent = results.find((r) => r.metadata['venueId'] === 'binance');
    const older = results.find((r) => r.metadata['venueId'] === 'okx');

    expect(recent).toBeDefined();
    expect(older).toBeDefined();
    expect(recent!.confidenceScore).toBeGreaterThan(older!.confidenceScore);
  });

  it('sets expiresAt to now + maxOpportunityAgeSec', () => {
    const config = makeConfig({ maxOpportunityAgeSec: 300 });
    const snap = makeFundingSnapshot({ annualizedRate: '20.0' });

    const before = Date.now();
    const results = detectFundingRateOpportunities([snap], config);
    const after = Date.now();

    expect(results).toHaveLength(1);
    const opp = results[0]!;
    const expiryMs = opp.expiresAt.getTime();
    expect(expiryMs).toBeGreaterThanOrEqual(before + 300_000);
    expect(expiryMs).toBeLessThanOrEqual(after + 300_000 + 50);
  });

  it('filters out unapproved venues when approvedVenues is set', () => {
    const config = makeConfig({ approvedVenues: ['okx'] });
    const snap = makeFundingSnapshot({ venueId: 'binance', annualizedRate: '30.0' });

    const results = detectFundingRateOpportunities([snap], config);
    expect(results).toHaveLength(0);
  });

  it('filters out unapproved assets when approvedAssets is set', () => {
    const config = makeConfig({ approvedAssets: ['ETH'] });
    const snap = makeFundingSnapshot({ asset: 'BTC', annualizedRate: '30.0' });

    const results = detectFundingRateOpportunities([snap], config);
    expect(results).toHaveLength(0);
  });
});

// ── detectBasisOpportunities ──────────────────────────────────────────────────

describe('detectBasisOpportunities', () => {
  it('detects basis opportunity when spread is sufficient', () => {
    const config = makeConfig({ minBasisPct: '0.5', minAnnualYieldPct: '5.0' });
    const now = new Date();

    const snap: BasisSnapshot = {
      asset: 'ETH',
      spotVenueId: 'coinbase',
      spotPrice: '2000',
      perpVenueId: 'binance',
      perpPrice: '2015', // 0.75% basis
      basis: '15',
      basisPct: '0.75',
      annualizedBasis: '27.375', // 0.75% × 3 × 365 (8h funding cycles)
      timestamp: now,
    };

    const results = detectBasisOpportunities([snap], config);

    expect(results).toHaveLength(1);
    const opp = results[0]!;
    expect(opp.type).toBe('basis_trade');
    expect(opp.asset).toBe('ETH');
    // Positive basis → short perp, long spot
    const perpLeg = opp.legs.find((l) => l.instrumentType === 'perpetual');
    const spotLeg = opp.legs.find((l) => l.instrumentType === 'spot');
    expect(perpLeg?.side).toBe('short');
    expect(spotLeg?.side).toBe('long');
  });

  it('returns no opportunity when basis is below threshold', () => {
    const config = makeConfig({ minBasisPct: '0.5' });
    const now = new Date();

    const snap: BasisSnapshot = {
      asset: 'ETH',
      spotVenueId: 'coinbase',
      spotPrice: '2000',
      perpVenueId: 'binance',
      perpPrice: '2003', // 0.15% — below 0.5% threshold
      basis: '3',
      basisPct: '0.15',
      annualizedBasis: '5.475',
      timestamp: now,
    };

    const results = detectBasisOpportunities([snap], config);
    expect(results).toHaveLength(0);
  });

  it('detects negative basis opportunity', () => {
    const config = makeConfig({ minBasisPct: '0.5', minAnnualYieldPct: '5.0' });
    const now = new Date();

    const snap: BasisSnapshot = {
      asset: 'BTC',
      spotVenueId: 'coinbase',
      spotPrice: '50000',
      perpVenueId: 'binance',
      perpPrice: '49600', // -0.8% basis
      basis: '-400',
      basisPct: '-0.8',
      annualizedBasis: '-29.2', // signed
      timestamp: now,
    };

    const results = detectBasisOpportunities([snap], config);
    expect(results).toHaveLength(1);
    const opp = results[0]!;
    // Negative basis → long perp, short spot
    const perpLeg = opp.legs.find((l) => l.instrumentType === 'perpetual');
    expect(perpLeg?.side).toBe('long');
  });
});

// ── detectCrossVenueOpportunities ─────────────────────────────────────────────

describe('detectCrossVenueOpportunities', () => {
  it('detects cross-venue spread when spread after fees is profitable', () => {
    const config = makeConfig({ minCrossVenueSpreadPct: '0.3', minAnnualYieldPct: '5.0' });

    // Venue A quotes 1000, venue B quotes 1005 → 0.5% spread
    const marketDataMap = new Map<string, MarketData[]>([
      [
        'SOL',
        [
          makeMarketData('venue-a', 'SOL', '1000'),
          makeMarketData('venue-b', 'SOL', '1005'),
        ],
      ],
    ]);

    const results = detectCrossVenueOpportunities(marketDataMap, config);

    expect(results).toHaveLength(1);
    const opp = results[0]!;
    expect(opp.type).toBe('cross_venue_spread');
    expect(opp.asset).toBe('SOL');
    const longLeg = opp.legs.find((l) => l.side === 'long');
    const shortLeg = opp.legs.find((l) => l.side === 'short');
    expect(longLeg?.venueId).toBe('venue-a'); // cheaper venue
    expect(shortLeg?.venueId).toBe('venue-b'); // more expensive venue
    expect(parseFloat(opp.metadata['estimatedPnlPct'] ?? '0')).toBeGreaterThan(0);
  });

  it('returns no opportunity when spread is below threshold', () => {
    const config = makeConfig({ minCrossVenueSpreadPct: '0.3' });

    // Only 0.05% spread → below threshold
    const marketDataMap = new Map<string, MarketData[]>([
      [
        'ETH',
        [
          makeMarketData('venue-a', 'ETH', '2000'),
          makeMarketData('venue-b', 'ETH', '2001'),
        ],
      ],
    ]);

    const results = detectCrossVenueOpportunities(marketDataMap, config);
    expect(results).toHaveLength(0);
  });

  it('returns no opportunity when spread is consumed by fees', () => {
    // Round-trip fee = 2 × taker + 2 × maker = 0.14%
    // Set spread just below fee threshold
    const config = makeConfig({
      minCrossVenueSpreadPct: '0.1',
      estimatedTakerFeePct: '0.05',
      estimatedMakerFeePct: '0.02',
    });

    // 0.12% spread but fees are ~0.14% → negative PnL
    const marketDataMap = new Map<string, MarketData[]>([
      [
        'BTC',
        [
          makeMarketData('venue-a', 'BTC', '50000'),
          makeMarketData('venue-b', 'BTC', '50060'), // 0.12% spread
        ],
      ],
    ]);

    const results = detectCrossVenueOpportunities(marketDataMap, config);
    expect(results).toHaveLength(0);
  });

  it('skips assets with only one venue', () => {
    const config = makeConfig();
    const marketDataMap = new Map<string, MarketData[]>([
      ['ETH', [makeMarketData('venue-a', 'ETH', '2000')]],
    ]);

    const results = detectCrossVenueOpportunities(marketDataMap, config);
    expect(results).toHaveLength(0);
  });
});
