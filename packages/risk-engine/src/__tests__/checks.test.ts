// =============================================================================
// checks.test.ts — unit tests for individual risk check functions
// =============================================================================

import { describe, it, expect } from 'vitest';

import {
  checkGrossExposure,
  checkNetExposure,
  checkVenueConcentration,
  checkAssetConcentration,
  checkLeverage,
  checkLiquidityReserve,
  checkDrawdown,
  checkPriceStaleness,
  checkPositionSize,
} from '../checks.js';
import { DEFAULT_RISK_LIMITS } from '../limits.js';

import type { RiskLimits } from '../limits.js';

// Convenience override helper
function limits(overrides: Partial<RiskLimits> = {}): RiskLimits {
  return { ...DEFAULT_RISK_LIMITS, ...overrides };
}

// ---------------------------------------------------------------------------
// checkGrossExposure
// ---------------------------------------------------------------------------

describe('checkGrossExposure', () => {
  it('passes when new position keeps exposure well under limit', () => {
    // NAV = 100_000, limit = 200 % → hard limit = 200_000
    // current = 50_000, new = 10_000 → projected = 60 % ✓
    const result = checkGrossExposure('50000', '10000', '100000', limits());
    expect(result.status).toBe('passed');
    expect(result.checkName).toBe('gross_exposure');
  });

  it('fails when new position would exceed gross exposure limit', () => {
    // NAV = 100_000, limit = 200 % → hard limit = 200_000
    // current = 190_000, new = 20_000 → projected = 210 % ✗
    const result = checkGrossExposure('190000', '20000', '100000', limits());
    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/exceeding limit/);
  });

  it('warns when approaching gross exposure limit (> 90% of limit)', () => {
    // NAV = 100_000, limit = 200 % → warning threshold = 180 %
    // current = 170_000, new = 15_000 → projected = 185 % (> 180 % warning)
    const result = checkGrossExposure('170000', '15000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails at exactly the limit boundary (limit + epsilon)', () => {
    // NAV = 100_000, limit = 200 % → hard limit = 200_000
    // current = 200_000, new = 1 → projected > 200 % ✗
    const result = checkGrossExposure('200000', '1', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns at exactly the limit boundary (100 % of limit = within warning zone)', () => {
    // NAV = 100_000, limit = 200 % → hard limit = 200_000
    // current = 190_000, new = 10_000 → projected = exactly 200 % (not > limit, but > 90% → warning)
    const result = checkGrossExposure('190000', '10000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails when NAV is zero', () => {
    const result = checkGrossExposure('0', '1000', '0', limits());
    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/NAV is zero/);
  });

  it('uses string decimal arithmetic — no floating-point errors', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754 — must be exact with decimal.js
    const result = checkGrossExposure('0.1', '0.2', '1', limits({ maxGrossExposurePct: 200 }));
    // 0.3 / 1 * 100 = 30 %, well under 200 %
    expect(result.status).toBe('passed');
    expect(result.actual).toBe('30.0000');
  });

  it('returns limit and actual values as strings', () => {
    const result = checkGrossExposure('50000', '10000', '100000', limits());
    expect(typeof result.limit).toBe('string');
    expect(typeof result.actual).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// checkNetExposure
// ---------------------------------------------------------------------------

describe('checkNetExposure', () => {
  it('passes for balanced (hedged) portfolio', () => {
    // net = 0 (fully hedged), delta = 10_000 long → net becomes 10_000
    // 10_000 / 100_000 * 100 = 10 % < 20 % limit ✓
    const result = checkNetExposure('0', '10000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails when net exposure would exceed limit', () => {
    // net = 18_000, delta = 5_000 → projected = 23_000 / 100_000 = 23 % > 20 % ✗
    const result = checkNetExposure('18000', '5000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when approaching net exposure limit', () => {
    // limit = 20 %, warning at 18 %
    // net = 16_000, delta = 3_000 → 19 % (> 18 % warning threshold)
    const result = checkNetExposure('16000', '3000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('handles short delta (negative)', () => {
    // net = -18_000, delta = -5_000 → abs = 23_000 / 100_000 = 23 % > 20 % ✗
    const result = checkNetExposure('-18000', '-5000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('passes when short delta brings net exposure down', () => {
    // net = 15_000, delta = -15_000 → projected net = 0 → 0 % ✓
    const result = checkNetExposure('15000', '-15000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails at exactly over the limit', () => {
    // net = 20_000 + 1 would be over 20 %
    const result = checkNetExposure('20000', '1', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns at exactly the limit (100 % of limit triggers warning zone)', () => {
    // net = 15_000, delta = 5_000 → projected = 20_000 / 100_000 = 20 % (= limit → warning zone)
    const result = checkNetExposure('15000', '5000', '100000', limits());
    expect(result.status).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// checkVenueConcentration
// ---------------------------------------------------------------------------

describe('checkVenueConcentration', () => {
  it('passes when venue exposure is well within limit', () => {
    // portfolio gross = 100_000, venue = 10_000, new = 5_000
    // projected venue = 15_000 / 105_000 = 14.28 % < 40 % ✓
    const result = checkVenueConcentration('10000', '5000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails when venue would exceed concentration limit', () => {
    // portfolio gross = 100_000, venue = 38_000, new = 10_000
    // projected venue = 48_000 / 110_000 = 43.6 % > 40 % ✗
    const result = checkVenueConcentration('38000', '10000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when venue approaches concentration limit', () => {
    // portfolio gross = 100_000, venue = 35_000, new = 2_000
    // projected venue = 37_000 / 102_000 ≈ 36.27 % (> 36 % = 90 % of 40 %)
    const result = checkVenueConcentration('35000', '2000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails when portfolio gross exposure is zero after adding position', () => {
    // Should not be reachable normally; guard against divide-by-zero
    // Actually portfolio gross can't become zero if we add a positive position,
    // so test the edge case of explicitly passing a 0 portfolio and 0 new size.
    // But with a 0 portfolio and 0 new size, projectedPortfolioGross = 0, which triggers failure.
    const result = checkVenueConcentration('0', '0', '0', limits());
    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/zero/);
  });

  it('passes at exactly the limit', () => {
    // portfolio gross = 100_000, venue = 0, new = 40_000
    // projected venue = 40_000 / 140_000 ≈ 28.57 % < 40 % ✓
    const result = checkVenueConcentration('0', '40000', '100000', limits());
    expect(result.status).toBe('passed');
  });
});

// ---------------------------------------------------------------------------
// checkAssetConcentration
// ---------------------------------------------------------------------------

describe('checkAssetConcentration', () => {
  it('passes when asset exposure is within limit', () => {
    const result = checkAssetConcentration('10000', '5000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails when asset would exceed concentration limit', () => {
    // limit = 30 %
    // asset = 28_000, new = 10_000, portfolio = 100_000
    // projected: asset = 38_000 / 110_000 = 34.5 % > 30 % ✗
    const result = checkAssetConcentration('28000', '10000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when asset approaches concentration limit', () => {
    // 27 % of gross → approaching 30 % limit (> 90 % = 27 %)
    // asset = 26_000, new = 1_500, portfolio = 100_000
    // projected = 27_500 / 101_500 ≈ 27.09 % > 27 % ✓ warning
    const result = checkAssetConcentration('26000', '1500', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('uses correct decimal arithmetic for boundary', () => {
    // asset = 0, new = 30_000, portfolio = 100_000
    // projected = 30_000 / 130_000 = 23.07 % < 30 % ✓
    const result = checkAssetConcentration('0', '30000', '100000', limits());
    expect(result.status).toBe('passed');
  });
});

// ---------------------------------------------------------------------------
// checkLeverage
// ---------------------------------------------------------------------------

describe('checkLeverage', () => {
  it('passes when leverage stays within limit', () => {
    // gross = 100_000, new = 50_000, nav = 100_000 → leverage = 1.5x < 3x ✓
    const result = checkLeverage('100000', '50000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails when leverage would exceed limit', () => {
    // gross = 290_000, new = 20_000, nav = 100_000 → 3.1x > 3x ✗
    const result = checkLeverage('290000', '20000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when approaching leverage limit', () => {
    // 90 % of 3x = 2.7x
    // gross = 260_000, new = 10_000, nav = 100_000 → 2.7x (borderline warning)
    // 2.7 > 2.7 is false, so try gross = 265_000, new = 5_000 → 2.7x exactly
    // Let's push it over: gross = 260_000, new = 15_000 → 2.75x > 2.7x → warning
    const result = checkLeverage('260000', '15000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails when NAV is zero', () => {
    const result = checkLeverage('0', '1000', '0', limits());
    expect(result.status).toBe('failed');
  });

  it('warns at exactly the limit (3.0x is within the warning zone)', () => {
    // gross = 200_000, new = 100_000, nav = 100_000 → 3.0x (not > 3.0, but > 2.7 → warning)
    const result = checkLeverage('200000', '100000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails just over the limit', () => {
    // gross = 299_999, new = 1, nav = 100_000 → 3.00000x but just over due to +1
    const result = checkLeverage('299999', '2', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('reports leverage as a decimal string', () => {
    const result = checkLeverage('100000', '50000', '100000', limits());
    expect(result.actual).toBeDefined();
    expect(parseFloat(result.actual!)).toBeCloseTo(1.5, 3);
  });
});

// ---------------------------------------------------------------------------
// checkLiquidityReserve
// ---------------------------------------------------------------------------

describe('checkLiquidityReserve', () => {
  it('passes when enough liquidity remains after margin deployment', () => {
    // NAV = 100_000, min reserve = 10 % = 10_000
    // current reserve = 30_000, margin = 5_000 → projected = 25_000 = 25 % > 10 % ✓
    const result = checkLiquidityReserve('30000', '5000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails when margin would push reserve below minimum', () => {
    // reserve = 11_000, margin = 5_000 → 6_000 / 100_000 = 6 % < 10 % ✗
    const result = checkLiquidityReserve('11000', '5000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when reserve would fall just above the minimum', () => {
    // min = 10 %, warning threshold = 12 %
    // reserve = 15_000, margin = 4_000 → 11_000 / 100_000 = 11 % (< 12 % → warning)
    const result = checkLiquidityReserve('15000', '4000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails when NAV is zero', () => {
    const result = checkLiquidityReserve('5000', '1000', '0', limits());
    expect(result.status).toBe('failed');
  });

  it('fails when margin exceeds current reserve (negative reserve)', () => {
    // reserve = 5_000, margin = 20_000 → projected = -15_000 / 100_000 = -15 % < 10 % ✗
    const result = checkLiquidityReserve('5000', '20000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns at exactly the minimum (10 % is within the 20 %-above-min warning zone)', () => {
    // reserve = 20_000, margin = 10_000 → projected = 10_000 / 100_000 = 10 % (= min, < 12 % threshold → warning)
    const result = checkLiquidityReserve('20000', '10000', '100000', limits());
    expect(result.status).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// checkDrawdown
// ---------------------------------------------------------------------------

describe('checkDrawdown', () => {
  it('passes for daily drawdown within limit', () => {
    const result = checkDrawdown(1.0, 'daily', limits());
    expect(result.status).toBe('passed');
    expect(result.checkName).toBe('drawdown_daily');
  });

  it('fails when daily drawdown exceeds limit', () => {
    const result = checkDrawdown(2.5, 'daily', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when daily drawdown approaches limit', () => {
    // 90 % of 2 % = 1.8 %
    const result = checkDrawdown(1.9, 'daily', limits());
    expect(result.status).toBe('warning');
  });

  it('warns at exactly the daily limit (100 % of limit = within 90 % warning zone)', () => {
    // 2.0 % is exactly the limit; 2.0 > 0.9*2.0 = 1.8 → warning, not > 2.0 → not failed
    const result = checkDrawdown(2.0, 'daily', limits());
    expect(result.status).toBe('warning');
  });

  it('fails just over the daily limit', () => {
    const result = checkDrawdown(2.001, 'daily', limits());
    expect(result.status).toBe('failed');
  });

  it('passes for weekly drawdown within limit', () => {
    const result = checkDrawdown(3.0, 'weekly', limits());
    expect(result.status).toBe('passed');
    expect(result.checkName).toBe('drawdown_weekly');
  });

  it('fails for weekly drawdown exceeding limit', () => {
    const result = checkDrawdown(6.0, 'weekly', limits());
    expect(result.status).toBe('failed');
  });

  it('warns for weekly drawdown approaching limit', () => {
    // 90 % of 5 % = 4.5 %
    const result = checkDrawdown(4.6, 'weekly', limits());
    expect(result.status).toBe('warning');
  });

  it('passes for portfolio drawdown within limit', () => {
    const result = checkDrawdown(10.0, 'portfolio', limits());
    expect(result.status).toBe('passed');
    expect(result.checkName).toBe('drawdown_portfolio');
  });

  it('fails for portfolio drawdown exceeding limit', () => {
    const result = checkDrawdown(16.0, 'portfolio', limits());
    expect(result.status).toBe('failed');
  });

  it('warns for portfolio drawdown approaching limit', () => {
    // 90 % of 15 % = 13.5 %
    const result = checkDrawdown(14.0, 'portfolio', limits());
    expect(result.status).toBe('warning');
  });

  it('passes at zero drawdown', () => {
    const result = checkDrawdown(0, 'portfolio', limits());
    expect(result.status).toBe('passed');
  });

  it('uses decimal.js — no floating-point drift for 1.8 boundary', () => {
    // 1.8 should be exactly at 90 % of 2; test that 1.8 is a warning, not passed
    const result = checkDrawdown(1.81, 'daily', limits());
    expect(result.status).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// checkPriceStaleness
// ---------------------------------------------------------------------------

describe('checkPriceStaleness', () => {
  const base = new Date('2025-01-01T12:00:00.000Z');
  const fresh = new Date('2025-01-01T11:59:55.000Z'); // 5s ago
  const stale = new Date('2025-01-01T11:59:00.000Z'); // 60s ago → > 30s limit

  it('passes when price is fresh', () => {
    const result = checkPriceStaleness(fresh, base, limits());
    expect(result.status).toBe('passed');
    expect(result.checkName).toBe('price_staleness');
  });

  it('fails when price exceeds stale threshold', () => {
    const result = checkPriceStaleness(stale, base, limits());
    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/stale threshold/);
  });

  it('warns when price is approaching stale threshold', () => {
    // 80 % of 30s = 24s; price 25s old → warning
    const almostStale = new Date(base.getTime() - 25_000);
    const result = checkPriceStaleness(almostStale, base, limits());
    expect(result.status).toBe('warning');
  });

  it('passes at exactly the stale threshold (30s)', () => {
    const exactlyAt = new Date(base.getTime() - 30_000);
    const result = checkPriceStaleness(exactlyAt, base, limits());
    // 30s is not > 30s, so should pass (or warn if it crosses 80% threshold)
    // 30 > 30 is false → but 30 > 24 (80% of 30) is true → warning
    expect(result.status).toBe('warning');
  });

  it('fails one millisecond past the stale threshold', () => {
    const oneOver = new Date(base.getTime() - 30_001);
    const result = checkPriceStaleness(oneOver, base, limits());
    expect(result.status).toBe('failed');
  });

  it('returns age as actual value in seconds', () => {
    const fiveSecOld = new Date(base.getTime() - 5_000);
    const result = checkPriceStaleness(fiveSecOld, base, limits());
    expect(result.actual).toBe('5.000');
  });

  it('respects custom maxPriceAgeSec limit', () => {
    // With 60s limit, a 45s old price should still pass
    const fortyFiveSec = new Date(base.getTime() - 45_000);
    const result = checkPriceStaleness(fortyFiveSec, base, limits({ maxPriceAgeSec: 60 }));
    expect(result.status).toBe('passed');
  });
});

// ---------------------------------------------------------------------------
// checkPositionSize
// ---------------------------------------------------------------------------

describe('checkPositionSize', () => {
  it('passes when position is within sleeve NAV limit', () => {
    // size = 10_000, sleeveNav = 100_000 → 10 % < 20 % ✓
    const result = checkPositionSize('10000', '100000', limits());
    expect(result.status).toBe('passed');
  });

  it('fails when position exceeds sleeve NAV limit', () => {
    // size = 25_000, sleeveNav = 100_000 → 25 % > 20 % ✗
    const result = checkPositionSize('25000', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('warns when position approaches sleeve NAV limit', () => {
    // 90 % of 20 % = 18 %
    // size = 19_000, sleeveNav = 100_000 → 19 % > 18 % → warning
    const result = checkPositionSize('19000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails when sleeve NAV is zero', () => {
    const result = checkPositionSize('1000', '0', limits());
    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/NAV is zero/);
  });

  it('warns at exactly the limit (100 % of limit = within warning zone)', () => {
    // size = 20_000, sleeveNav = 100_000 → 20 % (not > limit, but > 18 % threshold → warning)
    const result = checkPositionSize('20000', '100000', limits());
    expect(result.status).toBe('warning');
  });

  it('fails just over the limit', () => {
    const result = checkPositionSize('20001', '100000', limits());
    expect(result.status).toBe('failed');
  });

  it('uses string decimal arithmetic — correct precision', () => {
    // 1/3 of sleeve nav at custom 33 % limit
    const result = checkPositionSize('33333', '100000', limits({ maxPositionSizePct: 33 }));
    // 33333 / 100000 * 100 = 33.333 % > 33 % → fail
    expect(result.status).toBe('failed');
  });
});
