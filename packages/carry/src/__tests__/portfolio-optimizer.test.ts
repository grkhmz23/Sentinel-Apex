import { describe, expect, it } from 'vitest';

import { DEFAULT_CARRY_CONFIG } from '../config.js';
import { optimizeCarryPortfolio } from '../portfolio-optimizer.js';

import type { CarryConfig } from '../config.js';
import type { CarryOpportunityCandidate } from '../opportunity-detector.js';

function makeConfig(overrides: Partial<CarryConfig> = {}): CarryConfig {
  return {
    ...DEFAULT_CARRY_CONFIG,
    defaultPositionSizePct: '5',
    maxPositionSizePct: '20',
    maxConcurrentOpportunities: 3,
    maxOpportunitiesPerAsset: 1,
    maxOpportunitiesPerVenue: 2,
    maxAssetExposurePct: '10',
    maxVenueExposurePct: '15',
    ...overrides,
  };
}

function makeOpportunity(input: {
  asset: string;
  venueId: string;
  netYieldPct: string;
  confidenceScore?: number;
}): CarryOpportunityCandidate {
  return {
    type: 'funding_rate_arb',
    asset: input.asset,
    legs: [
      {
        venueId: input.venueId,
        asset: input.asset,
        side: 'short',
        instrumentType: 'perpetual',
        estimatedSize: '1',
        estimatedPrice: '50000',
        estimatedFee: '0.05',
      },
      {
        venueId: input.venueId,
        asset: input.asset,
        side: 'long',
        instrumentType: 'spot',
        estimatedSize: '1',
        estimatedPrice: '50000',
        estimatedFee: '0.05',
      },
    ],
    expectedAnnualYieldPct: input.netYieldPct,
    estimatedFeeCostPct: '0.14',
    netYieldPct: input.netYieldPct,
    confidenceScore: input.confidenceScore ?? 0.9,
    detectedAt: new Date('2026-04-01T00:00:00.000Z'),
    expiresAt: new Date('2026-04-01T00:05:00.000Z'),
    metadata: {},
  };
}

describe('optimizeCarryPortfolio', () => {
  it('prefers diversified assets when asset opportunity caps are enabled', () => {
    const config = makeConfig();
    const result = optimizeCarryPortfolio({
      opportunities: [
        makeOpportunity({ asset: 'BTC', venueId: 'venue-a', netYieldPct: '14' }),
        makeOpportunity({ asset: 'BTC', venueId: 'venue-b', netYieldPct: '13' }),
        makeOpportunity({ asset: 'ETH', venueId: 'venue-a', netYieldPct: '11' }),
      ],
      sleeveNav: '100000',
      currentGrossExposureUsd: '0',
      currentOpenPositions: 0,
      config,
    });

    expect(result.selected).toHaveLength(2);
    expect(result.selected.map((selection) => selection.opportunity.asset)).toEqual(['BTC', 'ETH']);
    expect(result.rejected.some((decision) => decision.reason.includes('asset limit reached'))).toBe(true);
  });

  it('caps position sizes when existing venue exposure leaves little room', () => {
    const config = makeConfig({
      maxVenueExposurePct: '6',
      maxAssetExposurePct: '20',
      maxOpportunitiesPerAsset: 2,
    });
    const result = optimizeCarryPortfolio({
      opportunities: [makeOpportunity({ asset: 'BTC', venueId: 'venue-a', netYieldPct: '15' })],
      sleeveNav: '100000',
      currentGrossExposureUsd: '0',
      currentOpenPositions: 0,
      currentVenueExposureUsd: new Map([['venue-a', '5000']]),
      config,
    });

    expect(result.selected).toHaveLength(1);
    expect(result.selected[0]?.positionSizeUsd).toBe('1000.00');
  });
});
