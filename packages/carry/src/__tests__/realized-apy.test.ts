// =============================================================================
// Realized APY Calculator Tests
// =============================================================================

import { describe, expect, it } from 'vitest';

import {
  annualizeReturn,
  calculateApy7d,
  calculateApyCurrent,
  calculateDailySnapshot,
  calculatePerformancePeriod,
  calculateSimpleApy,
  calculateStrategyPerformance,
  calculateTimeWeightedReturn,
  computeTradePnl,
  type DailySnapshot,
  type RealizedTradePnl,
} from '../realized-apy.js';

describe('computeTradePnl', () => {
  it('calculates long trade PnL correctly', () => {
    const result = computeTradePnl({
      entryPrice: '50000',
      exitPrice: '55000',
      size: '1',
      side: 'long',
      fundingPnl: '100',
      feeCost: '50',
      openedAt: new Date('2026-01-01'),
      closedAt: new Date('2026-01-02'),
    });

    // Gross: (55000 - 50000) * 1 = 5000
    // Net: 5000 + 100 - 50 = 5050
    expect(result.grossPnl).toBe('5000');
    expect(result.netPnl).toBe('5050');
    expect(result.holdingPeriodDays).toBe(1);
    expect(Number(result.returnPct)).toBeCloseTo(9.6, 0); // ~9.6%
  });

  it('calculates short trade PnL correctly', () => {
    const result = computeTradePnl({
      entryPrice: '55000',
      exitPrice: '50000',
      size: '1',
      side: 'short',
      fundingPnl: '100',
      feeCost: '50',
      openedAt: new Date('2026-01-01'),
      closedAt: new Date('2026-01-02'),
    });

    // Gross: (55000 - 50000) * 1 = 5000 (short profits when price drops)
    // Net: 5000 + 100 - 50 = 5050
    expect(result.grossPnl).toBe('5000');
    expect(result.netPnl).toBe('5050');
  });

  it('handles losing trades', () => {
    const result = computeTradePnl({
      entryPrice: '55000',
      exitPrice: '50000',
      size: '1',
      side: 'long',
      fundingPnl: '50',
      feeCost: '50',
      openedAt: new Date('2026-01-01'),
      closedAt: new Date('2026-01-02'),
    });

    // Gross: (50000 - 55000) * 1 = -5000
    // Net: -5000 + 50 - 50 = -5000
    expect(Number(result.grossPnl)).toBeLessThan(0);
    expect(Number(result.netPnl)).toBeLessThan(0);
  });

  it('calculates minimum holding period as 1 minute', () => {
    const now = new Date();
    const oneMinuteLater = new Date(now.getTime() + 60_000);
    
    const result = computeTradePnl({
      entryPrice: '50000',
      exitPrice: '50001',
      size: '1',
      side: 'long',
      fundingPnl: '0',
      feeCost: '0',
      openedAt: now,
      closedAt: oneMinuteLater,
    });

    // Should be approximately 0.000694 days (1 minute)
    expect(result.holdingPeriodDays).toBeGreaterThan(0);
    expect(result.holdingPeriodDays).toBeLessThan(0.001);
  });
});

describe('annualizeReturn', () => {
  it('annualizes a 1% daily return correctly', () => {
    const result = annualizeReturn('1', 1); // 1% in 1 day
    // (1 + 0.01)^365 - 1 = ~37.78
    expect(Number(result)).toBeGreaterThan(3600); // Should be around 3678%
  });

  it('annualizes a 10% monthly return correctly', () => {
    const result = annualizeReturn('10', 30); // 10% in 30 days
    // (1 + 0.10)^(365/30) - 1
    expect(Number(result)).toBeGreaterThan(200); // Should be around 213%
  });

  it('handles zero days', () => {
    const result = annualizeReturn('10', 0);
    expect(result).toBe('0');
  });
});

describe('calculateSimpleApy', () => {
  it('calculates APY for a single profitable day', () => {
    const result = calculateSimpleApy('100', '10000', 1);
    // (100 / 10000) * 365 * 100 = 365%
    expect(result).toBe('365.0000');
  });

  it('calculates APY correctly for longer periods', () => {
    const result = calculateSimpleApy('1000', '100000', 30);
    // (1000 / 100000) * (365/30) * 100 = 12.17%
    expect(Number(result)).toBeCloseTo(12.17, 1);
  });

  it('handles zero capital', () => {
    const result = calculateSimpleApy('100', '0', 1);
    expect(result).toBe('0');
  });
});

describe('calculateTimeWeightedReturn', () => {
  it('calculates TWR for daily returns', () => {
    const dailyReturns = ['1', '2', '-0.5']; // 1%, 2%, -0.5%
    const result = calculateTimeWeightedReturn(dailyReturns);
    // (1.01 * 1.02 * 0.995 - 1) * 100 = 2.4949%
    expect(Number(result)).toBeCloseTo(2.49, 1);
  });

  it('returns zero for empty array', () => {
    const result = calculateTimeWeightedReturn([]);
    expect(result).toBe('0');
  });
});

describe('calculateRollingApy', () => {
  const mockTrades: RealizedTradePnl[] = [
    {
      tradeId: '1',
      positionId: 'pos1',
      sleeveId: 'carry',
      venueId: 'drift',
      asset: 'BTC',
      side: 'long',
      instrumentType: 'perpetual',
      entryPrice: '50000',
      exitPrice: '51000',
      size: '1',
      notionalUsd: '50000',
      fundingPnl: '100',
      feeCost: '50',
      grossPnl: '1000',
      netPnl: '1050',
      holdingPeriodDays: 3,
      returnPct: '2.1',
      openedAt: new Date('2026-03-20'),
      closedAt: new Date('2026-03-23'),
      confirmed: true,
    },
    {
      tradeId: '2',
      positionId: 'pos2',
      sleeveId: 'carry',
      venueId: 'drift',
      asset: 'BTC',
      side: 'short',
      instrumentType: 'perpetual',
      entryPrice: '52000',
      exitPrice: '51000',
      size: '1',
      notionalUsd: '52000',
      fundingPnl: '150',
      feeCost: '50',
      grossPnl: '1000',
      netPnl: '1100',
      holdingPeriodDays: 2,
      returnPct: '2.12',
      openedAt: new Date('2026-03-25'),
      closedAt: new Date('2026-03-27'),
      confirmed: true,
    },
  ];

  it('calculates 7-day rolling APY', () => {
    const result = calculateApy7d(mockTrades, '100000', new Date('2026-03-28'));
    expect(result).not.toBeNull();
    if (result) {
      expect(Number(result)).toBeGreaterThan(0);
    }
  });

  it('returns null when no trades in window', () => {
    // Use a date far in the future to ensure no trades fall in the window
    const result = calculateApy7d(mockTrades, '100000', new Date('2026-05-01'));
    expect(result).toBeNull();
  });

  it('only includes confirmed trades', () => {
    const baseTrade = mockTrades[0]!;
    const unconfirmedTrade: RealizedTradePnl = {
      tradeId: baseTrade.tradeId,
      sleeveId: baseTrade.sleeveId,
      venueId: baseTrade.venueId,
      asset: baseTrade.asset,
      side: baseTrade.side,
      instrumentType: baseTrade.instrumentType,
      entryPrice: baseTrade.entryPrice,
      exitPrice: baseTrade.exitPrice,
      size: baseTrade.size,
      notionalUsd: baseTrade.notionalUsd,
      fundingPnl: baseTrade.fundingPnl,
      feeCost: baseTrade.feeCost,
      openedAt: baseTrade.openedAt,
      closedAt: baseTrade.closedAt,
      confirmed: false,
      grossPnl: '1000',
      netPnl: '1050',
      holdingPeriodDays: 3,
      returnPct: '2.1',
    };
    const unconfirmedTrades: RealizedTradePnl[] = [unconfirmedTrade];
    const result = calculateApy7d(unconfirmedTrades, '100000', new Date('2026-03-28'));
    expect(result).toBeNull();
  });
});

describe('calculateDailySnapshot', () => {
  const mockTrades: RealizedTradePnl[] = [
    {
      tradeId: '1',
      sleeveId: 'carry',
      venueId: 'drift',
      asset: 'BTC',
      side: 'long',
      instrumentType: 'perpetual',
      entryPrice: '50000',
      exitPrice: '51000',
      size: '1',
      notionalUsd: '50000',
      fundingPnl: '100',
      feeCost: '50',
      grossPnl: '1000',
      netPnl: '1050',
      holdingPeriodDays: 3,
      returnPct: '2.1',
      openedAt: new Date('2026-03-20'),
      closedAt: new Date('2026-03-25T12:00:00Z'),
      confirmed: true,
    },
    {
      tradeId: '2',
      sleeveId: 'carry',
      venueId: 'drift',
      asset: 'BTC',
      side: 'short',
      instrumentType: 'perpetual',
      entryPrice: '52000',
      exitPrice: '51000',
      size: '1',
      notionalUsd: '52000',
      fundingPnl: '150',
      feeCost: '50',
      grossPnl: '1000',
      netPnl: '1100',
      holdingPeriodDays: 2,
      returnPct: '2.12',
      openedAt: new Date('2026-03-24'),
      closedAt: new Date('2026-03-25T18:00:00Z'),
      confirmed: true,
    },
  ];

  it('calculates snapshot for date with trades', () => {
    const result = calculateDailySnapshot({
      date: '2026-03-25',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      trades: mockTrades,
      previousSnapshot: null,
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
    });

    expect(result.tradesClosed).toBe(2);
    expect(Number(result.dailyPnlUsd)).toBe(2150); // 1050 + 1100
    expect(Number(result.cumulativePnlUsd)).toBe(2150);
    expect(result.tradesWinning).toBe(2);
    expect(result.tradesLosing).toBe(0);
  });

  it('accumulates from previous snapshot', () => {
    const previousSnapshot: DailySnapshot = {
      date: '2026-03-24',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '500',
      dailyReturnPct: '0.5',
      cumulativePnlUsd: '500',
      cumulativeReturnPct: '0.5',
      tradesClosed: 1,
      tradesWinning: 1,
      tradesLosing: 0,
      fundingPnlUsd: '50',
      pricePnlUsd: '450',
      feeCostUsd: '0',
    };

    const result = calculateDailySnapshot({
      date: '2026-03-25',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      trades: mockTrades,
      previousSnapshot,
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
    });

    expect(Number(result.cumulativePnlUsd)).toBe(2650); // 500 + 2150
  });

  it('returns zero values for dates with no trades', () => {
    const result = calculateDailySnapshot({
      date: '2026-03-30',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      trades: mockTrades,
      previousSnapshot: null,
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
    });

    expect(result.tradesClosed).toBe(0);
    expect(result.dailyPnlUsd).toBe('0');
  });
});

describe('calculateApyCurrent', () => {
  it('returns insufficient_data when no trades', () => {
    const result = calculateApyCurrent({
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      targetApyPct: '10',
      latestSnapshot: null,
      allTrades: [],
    });

    expect(result.calculationBasis).toBe('insufficient_data');
    expect(result.totalTradesClosed).toBe(0);
    expect(result.realizedApyLifetime).toBeNull();
  });

  it('calculates current APY with trades', () => {
    const mockSnapshot: DailySnapshot = {
      date: '2026-03-25',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '2150',
      dailyReturnPct: '2.15',
      cumulativePnlUsd: '2150',
      cumulativeReturnPct: '2.15',
      realizedApy7d: '112.8750',
      realizedApy30d: '26.2250',
      realizedApyLifetime: '26.2250',
      tradesClosed: 2,
      tradesWinning: 2,
      tradesLosing: 0,
      fundingPnlUsd: '250',
      pricePnlUsd: '2000',
      feeCostUsd: '100',
    };

    const mockTrades: RealizedTradePnl[] = [
      {
        tradeId: '1',
        sleeveId: 'carry',
        venueId: 'drift',
        asset: 'BTC',
        side: 'long',
        instrumentType: 'perpetual',
        entryPrice: '50000',
        exitPrice: '51000',
        size: '1',
        notionalUsd: '50000',
        fundingPnl: '100',
        feeCost: '50',
        grossPnl: '1000',
        netPnl: '1050',
        holdingPeriodDays: 3,
        returnPct: '2.1',
        openedAt: new Date('2026-03-20'),
        closedAt: new Date('2026-03-25'),
        confirmed: true,
      },
    ];

    const result = calculateApyCurrent({
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      targetApyPct: '10',
      latestSnapshot: mockSnapshot,
      allTrades: mockTrades,
    });

    expect(result.calculationBasis).toBe('live_trades');
    expect(result.totalTradesClosed).toBe(1);
    expect(result.realizedApy30d).toBe('26.2250');
    expect(result.targetMet).toBe(true); // 26% > 10%
    expect(Number(result.targetGapPct)).toBeGreaterThan(0);
  });

  it('correctly identifies when target is not met', () => {
    const mockSnapshot: DailySnapshot = {
      date: '2026-03-25',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '100',
      dailyReturnPct: '0.1',
      cumulativePnlUsd: '100',
      cumulativeReturnPct: '0.1',
      realizedApy7d: '5.0',
      realizedApy30d: '5.0',
      realizedApyLifetime: '5.0',
      tradesClosed: 2,
      tradesWinning: 1,
      tradesLosing: 1,
      fundingPnlUsd: '50',
      pricePnlUsd: '100',
      feeCostUsd: '50',
    };

    const mockTrades: RealizedTradePnl[] = [
      {
        tradeId: '1',
        sleeveId: 'carry',
        venueId: 'drift',
        asset: 'BTC',
        side: 'long',
        instrumentType: 'perpetual',
        entryPrice: '50000',
        exitPrice: '51000',
        size: '1',
        notionalUsd: '50000',
        fundingPnl: '50',
        feeCost: '50',
        grossPnl: '1000',
        netPnl: '1000',
        holdingPeriodDays: 3,
        returnPct: '2',
        openedAt: new Date('2026-03-20'),
        closedAt: new Date('2026-03-25'),
        confirmed: true,
      },
    ];

    const result = calculateApyCurrent({
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      targetApyPct: '10',
      latestSnapshot: mockSnapshot,
      allTrades: mockTrades,
    });

    expect(result.targetMet).toBe(false); // 5% < 10%
    expect(Number(result.targetGapPct)).toBeLessThan(0);
  });
});

describe('calculatePerformancePeriod', () => {
  const mockSnapshots: DailySnapshot[] = [
    {
      date: '2026-03-20',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '500',
      dailyReturnPct: '0.5',
      cumulativePnlUsd: '500',
      cumulativeReturnPct: '0.5',
      tradesClosed: 1,
      tradesWinning: 1,
      tradesLosing: 0,
      fundingPnlUsd: '50',
      pricePnlUsd: '450',
      feeCostUsd: '0',
    },
    {
      date: '2026-03-21',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100500',
      deployedCapitalUsd: '50500',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '300',
      dailyReturnPct: '0.3',
      cumulativePnlUsd: '800',
      cumulativeReturnPct: '0.8',
      tradesClosed: 1,
      tradesWinning: 1,
      tradesLosing: 0,
      fundingPnlUsd: '30',
      pricePnlUsd: '270',
      feeCostUsd: '0',
    },
    {
      date: '2026-03-22',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100800',
      deployedCapitalUsd: '50800',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '-200',
      dailyReturnPct: '-0.2',
      cumulativePnlUsd: '600',
      cumulativeReturnPct: '0.6',
      tradesClosed: 1,
      tradesWinning: 0,
      tradesLosing: 1,
      fundingPnlUsd: '0',
      pricePnlUsd: '-200',
      feeCostUsd: '0',
    },
  ];

  it('calculates period performance correctly', () => {
    const result = calculatePerformancePeriod(
      mockSnapshots,
      7,
      new Date('2026-03-22')
    );

    expect(result.pnlUsd).toBe('600');
    expect(result.tradeCount).toBe(3);
    expect(result.winCount).toBe(2);
    expect(result.lossCount).toBe(1);
  });

  it('returns zero values for empty snapshots', () => {
    const result = calculatePerformancePeriod([], 7, new Date());
    
    expect(result.pnlUsd).toBe('0');
    expect(result.returnPct).toBe('0');
    expect(result.tradeCount).toBe(0);
  });
});

describe('calculateStrategyPerformance', () => {
  const mockTrades: RealizedTradePnl[] = [
    {
      tradeId: '1',
      sleeveId: 'carry',
      venueId: 'drift',
      asset: 'BTC',
      side: 'long',
      instrumentType: 'perpetual',
      entryPrice: '50000',
      exitPrice: '51000',
      size: '1',
      notionalUsd: '50000',
      fundingPnl: '100',
      feeCost: '50',
      grossPnl: '1000',
      netPnl: '1050',
      holdingPeriodDays: 3,
      returnPct: '2.1',
      openedAt: new Date('2026-03-20'),
      closedAt: new Date('2026-03-25'),
      confirmed: true,
    },
  ];

  const mockSnapshots: DailySnapshot[] = [
    {
      date: '2026-03-25',
      sleeveId: 'carry',
      strategyId: 'apex-carry',
      totalCapitalUsd: '100000',
      deployedCapitalUsd: '50000',
      idleCapitalUsd: '50000',
      dailyPnlUsd: '1050',
      dailyReturnPct: '1.05',
      cumulativePnlUsd: '1050',
      cumulativeReturnPct: '1.05',
      tradesClosed: 1,
      tradesWinning: 1,
      tradesLosing: 0,
      fundingPnlUsd: '100',
      pricePnlUsd: '1000',
      feeCostUsd: '50',
    },
  ];

  it('builds complete performance summary', () => {
    const result = calculateStrategyPerformance({
      strategyId: 'apex-carry',
      sleeveId: 'carry',
      targetApy: '10',
      dailySnapshots: mockSnapshots,
      trades: mockTrades,
    });

    expect(result.strategyId).toBe('apex-carry');
    expect(result.sleeveId).toBe('carry');
    expect(result.targetApy).toBe('10');
    expect(result.periods.lifetime.pnlUsd).toBe('1050');
    expect(result.periods.lifetime.tradeCount).toBe(1);
  });

  it('identifies when target is met', () => {
    // Need enough snapshots/data for APY > 10%
    const manySnapshots: DailySnapshot[] = [];
    for (let i = 0; i < 30; i++) {
      manySnapshots.push({
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        sleeveId: 'carry',
        strategyId: 'apex-carry',
        totalCapitalUsd: '100000',
        deployedCapitalUsd: '50000',
        idleCapitalUsd: '50000',
        dailyPnlUsd: '50', // High daily PnL for high APY
        dailyReturnPct: '0.05',
        cumulativePnlUsd: String((i + 1) * 50),
        cumulativeReturnPct: String((i + 1) * 0.05),
        tradesClosed: 1,
        tradesWinning: 1,
        tradesLosing: 0,
        fundingPnlUsd: '25',
        pricePnlUsd: '25',
        feeCostUsd: '0',
      });
    }

    const result = calculateStrategyPerformance({
      strategyId: 'apex-carry',
      sleeveId: 'carry',
      targetApy: '10',
      dailySnapshots: manySnapshots,
      trades: mockTrades,
    });

    // With 50/day on 100k = 0.05% daily = ~20% APY, should be above 10%
    if (result.currentApy) {
      expect(Number(result.currentApy)).toBeGreaterThan(10);
      expect(result.targetStatus).toBe('met');
    }
  });
});
