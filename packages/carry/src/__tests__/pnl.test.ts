// =============================================================================
// Carry PnL calculation tests
// =============================================================================

import { describe, it, expect } from 'vitest';

import { computeCarryPnl } from '../pnl.js';

// Helper: date N days ago
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
}

describe('computeCarryPnl', () => {
  it('produces positive net PnL for a fully hedged position with positive funding', () => {
    // Prices unchanged (delta-neutral), but funding received
    const result = computeCarryPnl({
      longEntryPrice: '100',
      longCurrentPrice: '100',
      longSize: '10',
      shortEntryPrice: '100',
      shortCurrentPrice: '100',
      shortSize: '10',
      fundingReceived: '50', // $50 funding received
      totalFeesPaid: '5',   // $5 fees
      openedAt: daysAgo(30),
      now: new Date(),
    });

    expect(parseFloat(result.netPnl)).toBeGreaterThan(0);
    expect(parseFloat(result.fundingPnl)).toBe(50);
    expect(parseFloat(result.feeCost)).toBe(5);
    // unrealizedPnl should be ~0 (hedged, prices unchanged)
    expect(parseFloat(result.unrealizedPnl)).toBeCloseTo(0, 8);
  });

  it('shows fee drag eating yield when fees exceed funding', () => {
    const result = computeCarryPnl({
      longEntryPrice: '100',
      longCurrentPrice: '100',
      longSize: '10',
      shortEntryPrice: '100',
      shortCurrentPrice: '100',
      shortSize: '10',
      fundingReceived: '2',  // Only $2 funding received
      totalFeesPaid: '20',   // $20 fees
      openedAt: daysAgo(1),
      now: new Date(),
    });

    expect(parseFloat(result.netPnl)).toBeLessThan(0);
    expect(parseFloat(result.feeCost)).toBe(20);
  });

  it('computes correct annualized yield for a 30-day hold', () => {
    // $50 net profit on $1,000 average notional over 30 days
    // Annualized: (50/1000) × (365/30) × 100 ≈ 60.8%
    const result = computeCarryPnl({
      longEntryPrice: '100',
      longCurrentPrice: '100',
      longSize: '10', // notional = $1,000
      shortEntryPrice: '100',
      shortCurrentPrice: '100',
      shortSize: '10',
      fundingReceived: '55',
      totalFeesPaid: '5',
      openedAt: daysAgo(30),
      now: new Date(),
    });

    const annualizedYield = parseFloat(result.netAnnualizedYieldPct);
    expect(annualizedYield).toBeGreaterThan(0);
    // Rough check: 50 net on 1000 average notional over 30 days ≈ 60% annualized
    expect(annualizedYield).toBeCloseTo(60.8, 0);
    expect(result.holdingPeriodDays).toBeCloseTo(30, 0);
  });

  it('handles negative funding (paying funding)', () => {
    const result = computeCarryPnl({
      longEntryPrice: '100',
      longCurrentPrice: '100',
      longSize: '10',
      shortEntryPrice: '100',
      shortCurrentPrice: '100',
      shortSize: '10',
      fundingReceived: '-30', // paying funding
      totalFeesPaid: '5',
      openedAt: daysAgo(10),
      now: new Date(),
    });

    expect(parseFloat(result.fundingPnl)).toBe(-30);
    expect(parseFloat(result.netPnl)).toBeLessThan(0);
  });

  it('captures basis convergence in unrealized PnL', () => {
    // Short perp at 102, current price 100 → unrealized gain on short
    // Long spot at 100, current price 100 → no change
    const result = computeCarryPnl({
      longEntryPrice: '100',
      longCurrentPrice: '100',
      longSize: '10',
      shortEntryPrice: '102',
      shortCurrentPrice: '100', // basis converged
      shortSize: '10',
      fundingReceived: '0',
      totalFeesPaid: '0',
      openedAt: daysAgo(7),
      now: new Date(),
    });

    // Short gain: (102 - 100) × 10 = $20
    expect(parseFloat(result.unrealizedPnl)).toBeCloseTo(20, 4);
    expect(parseFloat(result.netPnl)).toBeCloseTo(20, 4);
  });

  it('annualized yield is negative when net PnL is negative', () => {
    const result = computeCarryPnl({
      longEntryPrice: '100',
      longCurrentPrice: '90', // long position lost value
      longSize: '10',
      shortEntryPrice: '100',
      shortCurrentPrice: '90',
      shortSize: '10',
      fundingReceived: '5',
      totalFeesPaid: '50',
      openedAt: daysAgo(5),
      now: new Date(),
    });

    expect(parseFloat(result.netAnnualizedYieldPct)).toBeLessThan(0);
  });
});
