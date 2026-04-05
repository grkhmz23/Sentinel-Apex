// =============================================================================
// Realized APY Calculator
// Tracks actual performance from closed trades and computes time-weighted APY
// =============================================================================

import Decimal from 'decimal.js';

// =============================================================================
// Types
// =============================================================================

export interface RealizedTrade {
  tradeId: string;
  positionId?: string;
  sleeveId: string;
  venueId: string;
  asset: string;
  side: 'long' | 'short';
  instrumentType: 'spot' | 'perpetual';
  entryPrice: string;
  exitPrice: string;
  size: string;
  notionalUsd: string;
  fundingPnl: string;
  feeCost: string;
  openedAt: Date;
  closedAt: Date;
  executionReference?: string;
  confirmed: boolean;
}

export interface RealizedTradePnl extends RealizedTrade {
  grossPnl: string;
  netPnl: string;
  holdingPeriodDays: number;
  returnPct: string; // netPnl / notional * 100
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type DailySnapshot = {
  date: string; // YYYY-MM-DD
  sleeveId: string;
  strategyId: string;
  totalCapitalUsd: string;
  deployedCapitalUsd: string;
  idleCapitalUsd: string;
  dailyPnlUsd: string;
  dailyReturnPct: string;
  cumulativePnlUsd: string;
  cumulativeReturnPct: string;
  tradesClosed: number;
  tradesWinning: number;
  tradesLosing: number;
  fundingPnlUsd: string;
  pricePnlUsd: string;
  feeCostUsd: string;
} & {
  // Optional fields that can be undefined
  realizedApy7d?: string;
  realizedApy30d?: string;
  realizedApyLifetime?: string;
  avgTradePnlUsd?: string;
  avgHoldingPeriodDays?: string;
}

export interface ApyCurrent {
  sleeveId: string;
  strategyId: string;
  realizedApy7d: string | null;
  realizedApy30d: string | null;
  realizedApyLifetime: string | null;
  targetApyPct: string;
  projectedApyPct: string | null;
  targetMet: boolean | null;
  targetGapPct: string | null;
  totalTradesClosed: number;
  totalPnlUsd: string;
  totalFundingPnlUsd: string;
  totalFeesUsd: string;
  avgTradePnlUsd: string | null;
  winRatePct: string | null;
  firstTradeAt: Date | null;
  calculationBasis: 'live_trades' | 'projected' | 'insufficient_data';
}

export interface PerformancePeriod {
  pnlUsd: string;
  returnPct: string;
  apy: string | null;
  tradeCount: number;
  winCount: number;
  lossCount: number;
}

export interface StrategyPerformance {
  strategyId: string;
  sleeveId: string;
  currentApy: string | null;
  targetApy: string;
  targetStatus: 'met' | 'below' | 'unknown';
  periods: {
    '1d': PerformancePeriod;
    '7d': PerformancePeriod;
    '30d': PerformancePeriod;
    '90d': PerformancePeriod;
    lifetime: PerformancePeriod;
  };
  lastUpdatedAt: Date;
  lastTradeAt: Date | null;
}

// =============================================================================
// Trade PnL Calculation
// =============================================================================

export interface ComputeTradePnlParams {
  entryPrice: string;
  exitPrice: string;
  size: string;
  side: 'long' | 'short';
  fundingPnl: string;
  feeCost: string;
  openedAt: Date;
  closedAt: Date;
}

export function computeTradePnl(params: ComputeTradePnlParams): {
  grossPnl: string;
  netPnl: string;
  holdingPeriodDays: number;
  returnPct: string;
} {
  const entryPrice = new Decimal(params.entryPrice);
  const exitPrice = new Decimal(params.exitPrice);
  const size = new Decimal(params.size);
  const fundingPnl = new Decimal(params.fundingPnl);
  const feeCost = new Decimal(params.feeCost);

  // Calculate price PnL based on side
  // Long: (exit - entry) * size
  // Short: (entry - exit) * size
  const priceDiff = params.side === 'long'
    ? exitPrice.minus(entryPrice)
    : entryPrice.minus(exitPrice);
  
  const grossPnl = priceDiff.times(size);
  const netPnl = grossPnl.plus(fundingPnl).minus(feeCost);

  // Holding period
  const holdingPeriodMs = params.closedAt.getTime() - params.openedAt.getTime();
  const holdingPeriodDays = Math.max(holdingPeriodMs / (1_000 * 60 * 60 * 24), 1 / 1440);

  // Notional value (average of entry/exit * size)
  const avgPrice = entryPrice.plus(exitPrice).div(2);
  const notional = avgPrice.times(size);

  // Return percentage
  const returnPct = notional.isZero() 
    ? new Decimal(0) 
    : netPnl.div(notional).times(100);

  return {
    grossPnl: grossPnl.toFixed(),
    netPnl: netPnl.toFixed(),
    holdingPeriodDays,
    returnPct: returnPct.toFixed(4),
  };
}

export function calculateRealizedTradePnl(trade: RealizedTrade): RealizedTradePnl {
  const pnl = computeTradePnl({
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    size: trade.size,
    side: trade.side,
    fundingPnl: trade.fundingPnl,
    feeCost: trade.feeCost,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
  });

  return {
    ...trade,
    ...pnl,
  };
}

// =============================================================================
// APY Calculations
// =============================================================================

/**
 * Calculate time-weighted return from a series of daily returns
 * Formula: (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
 */
export function calculateTimeWeightedReturn(dailyReturns: string[]): string {
  if (dailyReturns.length === 0) return '0';

  const product = dailyReturns.reduce((acc, dailyReturn) => {
    const dr = new Decimal(dailyReturn).div(100); // Convert from percentage
    return acc.times(new Decimal(1).plus(dr));
  }, new Decimal(1));

  const twr = product.minus(1).times(100); // Convert back to percentage
  return twr.toFixed(4);
}

/**
 * Annualize a return based on holding period
 * Formula: (1 + return)^(365 / days) - 1
 */
export function annualizeReturn(returnPct: string, days: number): string {
  if (days <= 0) return '0';
  
  const ret = new Decimal(returnPct).div(100);
  const annualized = new Decimal(1)
    .plus(ret)
    .pow(365 / days)
    .minus(1)
    .times(100);
  
  return annualized.toFixed(4);
}

/**
 * Calculate simple APY from PnL and capital over a period
 * Formula: (pnl / capital) * (365 / days) * 100
 */
export function calculateSimpleApy(
  pnlUsd: string,
  capitalUsd: string,
  days: number,
): string {
  if (days <= 0 || new Decimal(capitalUsd).isZero()) return '0';

  const pnl = new Decimal(pnlUsd);
  const capital = new Decimal(capitalUsd);

  const apy = pnl
    .div(capital)
    .times(365 / days)
    .times(100);

  return apy.toFixed(4);
}

// =============================================================================
// Rolling APY Calculations
// =============================================================================

export interface RollingApyParams {
  trades: RealizedTradePnl[];
  capitalUsd: string;
  windowDays: number;
  endDate: Date;
}

export function calculateRollingApy(params: RollingApyParams): string | null {
  const { trades, capitalUsd, windowDays, endDate } = params;

  // Filter trades within the window
  const windowStart = new Date(endDate.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const windowTrades = trades.filter(
    t => t.closedAt >= windowStart && t.closedAt <= endDate && t.confirmed
  );

  if (windowTrades.length === 0) return null;

  // Sum net PnL
  const totalPnl = windowTrades.reduce(
    (sum, t) => sum.plus(new Decimal(t.netPnl)),
    new Decimal(0)
  );

  // Calculate APY
  return calculateSimpleApy(totalPnl.toFixed(), capitalUsd, windowDays);
}

export function calculateApy7d(
  trades: RealizedTradePnl[],
  capitalUsd: string,
  endDate: Date,
): string | null {
  return calculateRollingApy({ trades, capitalUsd, windowDays: 7, endDate });
}

export function calculateApy30d(
  trades: RealizedTradePnl[],
  capitalUsd: string,
  endDate: Date,
): string | null {
  return calculateRollingApy({ trades, capitalUsd, windowDays: 30, endDate });
}

export function calculateApyLifetime(
  trades: RealizedTradePnl[],
  capitalUsd: string,
): string | null {
  if (trades.length === 0) return null;

  // Find date range
  const firstTrade = trades.reduce((earliest, t) => 
    t.openedAt < earliest.openedAt ? t : earliest
  );
  const lastTrade = trades.reduce((latest, t) => 
    t.closedAt > latest.closedAt ? t : latest
  );

  const days = Math.max(
    (lastTrade.closedAt.getTime() - firstTrade.openedAt.getTime()) / (1_000 * 60 * 60 * 24),
    1
  );

  const totalPnl = trades.reduce(
    (sum, t) => sum.plus(new Decimal(t.netPnl)),
    new Decimal(0)
  );

  return calculateSimpleApy(totalPnl.toFixed(), capitalUsd, days);
}

// =============================================================================
// Daily Snapshot Calculation
// =============================================================================

export interface CalculateDailySnapshotParams {
  date: string; // YYYY-MM-DD
  sleeveId: string;
  strategyId: string;
  trades: RealizedTradePnl[];
  previousSnapshot: DailySnapshot | null;
  totalCapitalUsd: string;
  deployedCapitalUsd: string;
  idleCapitalUsd: string;
}

export function calculateDailySnapshot(
  params: CalculateDailySnapshotParams,
): DailySnapshot {
  const {
    date,
    sleeveId,
    strategyId,
    trades,
    previousSnapshot,
    totalCapitalUsd,
    deployedCapitalUsd,
    idleCapitalUsd,
  } = params;

  const dateStart = new Date(date);
  const dateEnd = new Date(date);
  dateEnd.setDate(dateEnd.getDate() + 1);

  // Filter trades closed on this date
  const dailyTrades = trades.filter(
    t => t.closedAt >= dateStart && t.closedAt < dateEnd && t.confirmed
  );

  // Calculate daily PnL
  const dailyPnlUsd = dailyTrades.reduce(
    (sum, t) => sum.plus(new Decimal(t.netPnl)),
    new Decimal(0)
  );

  const dailyReturnPct = new Decimal(totalCapitalUsd).isZero()
    ? new Decimal(0)
    : dailyPnlUsd.div(totalCapitalUsd).times(100);

  // Calculate cumulative
  const previousCumulativePnl = previousSnapshot 
    ? new Decimal(previousSnapshot.cumulativePnlUsd)
    : new Decimal(0);
  const cumulativePnlUsd = previousCumulativePnl.plus(dailyPnlUsd);
  const cumulativeReturnPct = new Decimal(totalCapitalUsd).isZero()
    ? new Decimal(0)
    : cumulativePnlUsd.div(totalCapitalUsd).times(100);

  // Trade stats
  const tradesClosed = dailyTrades.length;
  const tradesWinning = dailyTrades.filter(t => new Decimal(t.netPnl).gt(0)).length;
  const tradesLosing = dailyTrades.filter(t => new Decimal(t.netPnl).lt(0)).length;

  const avgTradePnl = tradesClosed > 0
    ? dailyPnlUsd.div(tradesClosed)
    : null;

  const avgHoldingDays = tradesClosed > 0
    ? dailyTrades.reduce((sum, t) => sum + t.holdingPeriodDays, 0) / tradesClosed
    : null;

  // Attribution
  const fundingPnlUsd = dailyTrades.reduce(
    (sum, t) => sum.plus(new Decimal(t.fundingPnl)),
    new Decimal(0)
  );
  const pricePnlUsd = dailyTrades.reduce(
    (sum, t) => sum.plus(new Decimal(t.grossPnl)),
    new Decimal(0)
  );
  const feeCostUsd = dailyTrades.reduce(
    (sum, t) => sum.plus(new Decimal(t.feeCost)),
    new Decimal(0)
  );

  // Calculate rolling APYs (requires full trade history)
  const endDate = new Date(date);
  const apy7d = calculateApy7d(trades, totalCapitalUsd, endDate);
  const apy30d = calculateApy30d(trades, totalCapitalUsd, endDate);
  const apyLifetime = calculateApyLifetime(trades, totalCapitalUsd);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const snapshot = {
    date,
    sleeveId,
    strategyId,
    totalCapitalUsd,
    deployedCapitalUsd,
    idleCapitalUsd,
    dailyPnlUsd: dailyPnlUsd.toFixed(),
    dailyReturnPct: dailyReturnPct.toFixed(4),
    cumulativePnlUsd: cumulativePnlUsd.toFixed(),
    cumulativeReturnPct: cumulativeReturnPct.toFixed(4),
    tradesClosed,
    tradesWinning,
    tradesLosing,
    fundingPnlUsd: fundingPnlUsd.toFixed(),
    pricePnlUsd: pricePnlUsd.toFixed(),
    feeCostUsd: feeCostUsd.toFixed(),
    ...(apy7d !== null && { realizedApy7d: apy7d }),
    ...(apy30d !== null && { realizedApy30d: apy30d }),
    ...(apyLifetime !== null && { realizedApyLifetime: apyLifetime }),
    ...(avgTradePnl !== null && { avgTradePnlUsd: avgTradePnl.toFixed() }),
    ...(avgHoldingDays !== null && { avgHoldingPeriodDays: avgHoldingDays.toFixed(2) }),
  } as DailySnapshot;
  return snapshot;
}

// =============================================================================
// Current APY State
// =============================================================================

export interface CalculateApyCurrentParams {
  sleeveId: string;
  strategyId: string;
  targetApyPct: string;
  latestSnapshot: DailySnapshot | null;
  allTrades: RealizedTradePnl[];
}

export function calculateApyCurrent(
  params: CalculateApyCurrentParams,
): ApyCurrent {
  const { sleeveId, strategyId, targetApyPct, latestSnapshot, allTrades } = params;

  const confirmedTrades = allTrades.filter(t => t.confirmed);
  const totalTradesClosed = confirmedTrades.length;

  if (totalTradesClosed === 0) {
    return {
      sleeveId,
      strategyId,
      realizedApy7d: null,
      realizedApy30d: null,
      realizedApyLifetime: null,
      targetApyPct,
      projectedApyPct: null,
      targetMet: null,
      targetGapPct: null,
      totalTradesClosed: 0,
      totalPnlUsd: '0',
      totalFundingPnlUsd: '0',
      totalFeesUsd: '0',
      avgTradePnlUsd: null,
      winRatePct: null,
      firstTradeAt: null,
      calculationBasis: 'insufficient_data',
    };
  }

  // Aggregate metrics
  const totalPnl = confirmedTrades.reduce((sum, t) => sum.plus(new Decimal(t.netPnl)), new Decimal(0));
  const totalFundingPnl = confirmedTrades.reduce((sum, t) => sum.plus(new Decimal(t.fundingPnl)), new Decimal(0));
  const totalFees = confirmedTrades.reduce((sum, t) => sum.plus(new Decimal(t.feeCost)), new Decimal(0));
  
  const winningTrades = confirmedTrades.filter(t => new Decimal(t.netPnl).gt(0));
  const winRate = new Decimal(winningTrades.length).div(totalTradesClosed).times(100);
  
  const avgPnl = totalPnl.div(totalTradesClosed);

  // Find first trade
  const firstTrade = confirmedTrades.reduce((earliest, t) => 
    t.openedAt < earliest.openedAt ? t : earliest
  );

  // Get APY from snapshot or calculate
  const realizedApy7d = latestSnapshot?.realizedApy7d ?? null;
  const realizedApy30d = latestSnapshot?.realizedApy30d ?? null;
  const realizedApyLifetime = latestSnapshot?.realizedApyLifetime ?? null;

  // Determine current APY (prefer 30d, then 7d, then lifetime)
  const currentApy = realizedApy30d ?? realizedApy7d ?? realizedApyLifetime;
  
  // Target status
  let targetMet: boolean | null = null;
  let targetGapPct: string | null = null;
  
  if (currentApy !== null) {
    const current = new Decimal(currentApy);
    const target = new Decimal(targetApyPct);
    targetMet = current.gte(target);
    targetGapPct = current.minus(target).toFixed(4);
  }

  return {
    sleeveId,
    strategyId,
    realizedApy7d,
    realizedApy30d,
    realizedApyLifetime,
    targetApyPct,
    projectedApyPct: currentApy, // Current realized becomes projection for future
    targetMet,
    targetGapPct,
    totalTradesClosed,
    totalPnlUsd: totalPnl.toFixed(),
    totalFundingPnlUsd: totalFundingPnl.toFixed(),
    totalFeesUsd: totalFees.toFixed(),
    avgTradePnlUsd: avgPnl.toFixed(),
    winRatePct: winRate.toFixed(2),
    firstTradeAt: firstTrade.openedAt,
    calculationBasis: 'live_trades',
  };
}

// =============================================================================
// Performance Summary
// =============================================================================

export interface CalculatePerformanceSummaryParams {
  strategyId: string;
  sleeveId: string;
  targetApy: string;
  dailySnapshots: DailySnapshot[];
  trades: RealizedTradePnl[];
}

export function calculatePerformancePeriod(
  snapshots: DailySnapshot[],
  periodDays: number,
  endDate: Date,
): PerformancePeriod {
  const periodStart = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
  
  const periodSnapshots = snapshots.filter(s => 
    new Date(s.date) >= periodStart && new Date(s.date) <= endDate
  );

  if (periodSnapshots.length === 0) {
    return {
      pnlUsd: '0',
      returnPct: '0',
      apy: null,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
    };
  }

  const pnlUsd = periodSnapshots.reduce(
    (sum, s) => sum.plus(new Decimal(s.dailyPnlUsd)),
    new Decimal(0)
  );

  // Calculate period return from first and last snapshot
  const firstSnapshot = periodSnapshots[0];
  const lastSnapshot = periodSnapshots[periodSnapshots.length - 1];
  
  if (!firstSnapshot || !lastSnapshot) {
    throw new Error('Insufficient snapshots for APY calculation');
  }
  
  const startValue = new Decimal(firstSnapshot.totalCapitalUsd).minus(
    new Decimal(firstSnapshot.cumulativePnlUsd)
  );
  const endValue = new Decimal(lastSnapshot.totalCapitalUsd);
  
  const returnPct = startValue.isZero() 
    ? new Decimal(0)
    : endValue.minus(startValue).div(startValue).times(100);

  // Calculate APY
  const apy = calculateSimpleApy(pnlUsd.toFixed(), startValue.toFixed(), periodDays);

  // Trade counts
  const tradeCount = periodSnapshots.reduce((sum, s) => sum + s.tradesClosed, 0);
  const winCount = periodSnapshots.reduce((sum, s) => sum + s.tradesWinning, 0);
  const lossCount = periodSnapshots.reduce((sum, s) => sum + s.tradesLosing, 0);

  return {
    pnlUsd: pnlUsd.toFixed(),
    returnPct: returnPct.toFixed(4),
    apy,
    tradeCount,
    winCount,
    lossCount,
  };
}

export function calculateStrategyPerformance(
  params: CalculatePerformanceSummaryParams,
): StrategyPerformance {
  const { strategyId, sleeveId, targetApy, dailySnapshots, trades } = params;

  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // Calculate periods
  const period1d = calculatePerformancePeriod(dailySnapshots, 1, endOfToday);
  const period7d = calculatePerformancePeriod(dailySnapshots, 7, endOfToday);
  const period30d = calculatePerformancePeriod(dailySnapshots, 30, endOfToday);
  const period90d = calculatePerformancePeriod(dailySnapshots, 90, endOfToday);
  
  // Lifetime (use all snapshots)
  const lifetimePnl = dailySnapshots.reduce(
    (sum, s) => sum.plus(new Decimal(s.dailyPnlUsd)),
    new Decimal(0)
  );
  const lifetimeTrades = trades.filter(t => t.confirmed);
  const lifetimeWins = lifetimeTrades.filter(t => new Decimal(t.netPnl).gt(0));
  const lifetimeLosses = lifetimeTrades.filter(t => new Decimal(t.netPnl).lt(0));
  
  const firstSnapshot = dailySnapshots[0];
  const lastSnapshot = dailySnapshots[dailySnapshots.length - 1];
  let lifetimeReturn = new Decimal(0);
  let lifetimeApy: string | null = null;
  
  if (firstSnapshot && lastSnapshot) {
    const startValue = new Decimal(firstSnapshot.totalCapitalUsd).minus(
      new Decimal(firstSnapshot.cumulativePnlUsd)
    );
    const endValue = new Decimal(lastSnapshot.totalCapitalUsd);
    
    if (!startValue.isZero()) {
      lifetimeReturn = endValue.minus(startValue).div(startValue).times(100);
      
      const days = Math.max(
        (new Date(lastSnapshot.date).getTime() - new Date(firstSnapshot.date).getTime()) 
          / (1_000 * 60 * 60 * 24),
        1
      );
      lifetimeApy = calculateSimpleApy(lifetimePnl.toFixed(), startValue.toFixed(), days);
    }
  }

  const periodLifetime: PerformancePeriod = {
    pnlUsd: lifetimePnl.toFixed(),
    returnPct: lifetimeReturn.toFixed(4),
    apy: lifetimeApy,
    tradeCount: lifetimeTrades.length,
    winCount: lifetimeWins.length,
    lossCount: lifetimeLosses.length,
  };

  // Current APY (prefer 30d)
  const currentApy = period30d.apy ?? period7d.apy ?? periodLifetime.apy;
  
  // Target status
  let targetStatus: 'met' | 'below' | 'unknown' = 'unknown';
  if (currentApy !== null) {
    targetStatus = new Decimal(currentApy).gte(new Decimal(targetApy)) ? 'met' : 'below';
  }

  // Last trade
  const lastTrade = trades.length > 0 
    ? trades.reduce((latest, t) => t.closedAt > latest.closedAt ? t : latest)
    : null;

  return {
    strategyId,
    sleeveId,
    currentApy,
    targetApy,
    targetStatus,
    periods: {
      '1d': period1d,
      '7d': period7d,
      '30d': period30d,
      '90d': period90d,
      lifetime: periodLifetime,
    },
    lastUpdatedAt: now,
    lastTradeAt: lastTrade?.closedAt ?? null,
  };
}
