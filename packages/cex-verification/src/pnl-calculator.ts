// =============================================================================
// CEX Trade PnL Calculator
// Calculates realized PnL from imported trades using various methods
// =============================================================================

import type { ParsedTrade } from './csv-parser.js';

export type PnlCalculationMethod = 'fifo' | 'lifo' | 'avg';

export interface PnlCalculationOptions {
  method: PnlCalculationMethod;
  includeFees: boolean;
}

export interface TradeWithPnl extends ParsedTrade {
  costBasis: string | undefined;
  realizedPnl: string | undefined;
  accumulatedPosition: string | undefined;
  averageEntryPrice: string | undefined;
}

export interface AssetPnlResult {
  asset: string;
  trades: TradeWithPnl[];
  summary: AssetPnlSummary;
}

export interface AssetPnlSummary {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalBuyVolume: string;
  totalSellVolume: string;
  totalBuyValue: string;
  totalSellValue: string;
  
  // PnL
  realizedPnl: string;
  totalFees: string;
  netPnl: string;
  
  // Position
  openPosition: string;
  averageEntryPrice: string;
  positionValue: string;
  
  // Stats
  winningTrades: number;
  losingTrades: number;
  winRatePct: string;
  avgWinAmount: string;
  avgLossAmount: string;
  largestWin: string;
  largestLoss: string;
}

export interface PortfolioPnlResult {
  assets: AssetPnlResult[];
  summary: PortfolioPnlSummary;
}

export interface PortfolioPnlSummary {
  totalTrades: number;
  uniqueAssets: number;
  totalRealizedPnl: string;
  totalFees: string;
  netPnl: string;
  
  // Period
  firstTradeAt: Date;
  lastTradeAt: Date;
  tradingDays: number;
  
  // Stats
  winningAssets: number;
  losingAssets: number;
  avgTradesPerAsset: number;
}

// Simple math helpers using native numbers with 8 decimal precision
const toNum = (s: string): number => Number(s) || 0;
const toStr = (n: number): string => n.toFixed(8).replace(/\.?0+$/, '');
const toStr2 = (n: number): string => n.toFixed(2);

// Calculate PnL for a single asset
export function calculateAssetPnl(
  trades: ParsedTrade[],
  options: PnlCalculationOptions = { method: 'fifo', includeFees: true },
): AssetPnlResult {
  if (trades.length === 0) {
    throw new Error('No trades provided');
  }

  const firstTrade = trades[0];
  if (!firstTrade) {
    throw new Error('No trades provided');
  }
  const asset = firstTrade.asset;
  
  // Sort by trade time
  const sortedTrades = [...trades].sort(
    (a, b) => a.tradeTime.getTime() - b.tradeTime.getTime(),
  );

  // Calculate PnL based on method
  let tradesWithPnl: TradeWithPnl[];
  switch (options.method) {
    case 'fifo':
      tradesWithPnl = calculateFifoPnl(sortedTrades);
      break;
    case 'lifo':
      tradesWithPnl = calculateLifoPnl(sortedTrades);
      break;
    case 'avg':
      tradesWithPnl = calculateAveragePnl(sortedTrades);
      break;
    default:
      tradesWithPnl = calculateFifoPnl(sortedTrades);
  }

  // Calculate summary
  const summary = generateAssetSummary(tradesWithPnl, options.includeFees);

  return { asset, trades: tradesWithPnl, summary };
}

interface BuyQueueEntry {
  quantity: number;
  price: number;
  time: Date;
}

// FIFO (First In, First Out) PnL calculation
function calculateFifoPnl(trades: ParsedTrade[]): TradeWithPnl[] {
  const result: TradeWithPnl[] = [];
  const buyQueue: BuyQueueEntry[] = [];

  for (const trade of trades) {
    const quantity = toNum(trade.quantity);
    const price = toNum(trade.price);
    const tradeWithPnl: TradeWithPnl = { 
      ...trade,
      costBasis: undefined,
      realizedPnl: undefined,
      accumulatedPosition: undefined,
      averageEntryPrice: undefined,
    };

    if (trade.side === 'buy') {
      // Add to buy queue
      buyQueue.push({ quantity, price, time: trade.tradeTime });
      tradeWithPnl.costBasis = toStr(price * quantity);
      tradeWithPnl.accumulatedPosition = toStr(buyQueue.reduce((sum, b) => sum + b.quantity, 0));
    } else {
      // Sell - match with earliest buys (FIFO)
      let remainingQty = quantity;
      let totalCostBasis = 0;

      while (remainingQty > 0.00000001 && buyQueue.length > 0) {
        const buy = buyQueue[0];
        if (!buy) break;
        const matchedQty = Math.min(remainingQty, buy.quantity);
        
        totalCostBasis += matchedQty * buy.price;
        buy.quantity -= matchedQty;
        remainingQty -= matchedQty;

        if (buy.quantity <= 0.00000001) {
          buyQueue.shift();
        }
      }

      const proceeds = quantity * price;
      const pnl = proceeds - totalCostBasis;
      
      tradeWithPnl.costBasis = toStr(totalCostBasis);
      tradeWithPnl.realizedPnl = toStr(pnl);
      tradeWithPnl.accumulatedPosition = toStr(buyQueue.reduce((sum, b) => sum + b.quantity, 0));
    }

    result.push(tradeWithPnl);
  }

  return result;
}

// LIFO (Last In, First Out) PnL calculation
function calculateLifoPnl(trades: ParsedTrade[]): TradeWithPnl[] {
  const result: TradeWithPnl[] = [];
  const buyQueue: BuyQueueEntry[] = [];

  for (const trade of trades) {
    const quantity = toNum(trade.quantity);
    const price = toNum(trade.price);
    const tradeWithPnl: TradeWithPnl = { 
      ...trade,
      costBasis: undefined,
      realizedPnl: undefined,
      accumulatedPosition: undefined,
      averageEntryPrice: undefined,
    };

    if (trade.side === 'buy') {
      buyQueue.push({ quantity, price, time: trade.tradeTime });
      tradeWithPnl.costBasis = toStr(price * quantity);
      tradeWithPnl.accumulatedPosition = toStr(buyQueue.reduce((sum, b) => sum + b.quantity, 0));
    } else {
      // Sell - match with latest buys (LIFO)
      let remainingQty = quantity;
      let totalCostBasis = 0;

      while (remainingQty > 0.00000001 && buyQueue.length > 0) {
        const buy = buyQueue[buyQueue.length - 1];
        if (!buy) break;
        const matchedQty = Math.min(remainingQty, buy.quantity);
        
        totalCostBasis += matchedQty * buy.price;
        buy.quantity -= matchedQty;
        remainingQty -= matchedQty;

        if (buy.quantity <= 0.00000001) {
          buyQueue.pop();
        }
      }

      const proceeds = quantity * price;
      const pnl = proceeds - totalCostBasis;
      
      tradeWithPnl.costBasis = toStr(totalCostBasis);
      tradeWithPnl.realizedPnl = toStr(pnl);
      tradeWithPnl.accumulatedPosition = toStr(buyQueue.reduce((sum, b) => sum + b.quantity, 0));
    }

    result.push(tradeWithPnl);
  }

  return result;
}

// Average cost PnL calculation
function calculateAveragePnl(trades: ParsedTrade[]): TradeWithPnl[] {
  const result: TradeWithPnl[] = [];
  let totalQuantity = 0;
  let totalCost = 0;

  for (const trade of trades) {
    const quantity = toNum(trade.quantity);
    const price = toNum(trade.price);
    const tradeWithPnl: TradeWithPnl = { 
      ...trade,
      costBasis: undefined,
      realizedPnl: undefined,
      accumulatedPosition: undefined,
      averageEntryPrice: undefined,
    };

    if (trade.side === 'buy') {
      // Update average cost
      const newCost = quantity * price;
      totalCost += newCost;
      totalQuantity += quantity;
      
      const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      tradeWithPnl.costBasis = toStr(newCost);
      tradeWithPnl.accumulatedPosition = toStr(totalQuantity);
      tradeWithPnl.averageEntryPrice = toStr(avgPrice);
    } else {
      // Sell at average cost
      const avgPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      const costBasis = quantity * avgPrice;
      const proceeds = quantity * price;
      const pnl = proceeds - costBasis;

      // Reduce position
      totalQuantity -= quantity;
      totalCost -= costBasis;

      tradeWithPnl.costBasis = toStr(costBasis);
      tradeWithPnl.realizedPnl = toStr(pnl);
      tradeWithPnl.averageEntryPrice = toStr(avgPrice);
      tradeWithPnl.accumulatedPosition = toStr(totalQuantity);
    }

    result.push(tradeWithPnl);
  }

  return result;
}

// Generate PnL summary for an asset
function generateAssetSummary(
  trades: TradeWithPnl[],
  includeFees: boolean,
): AssetPnlSummary {
  const buyTrades = trades.filter(t => t.side === 'buy');
  const sellTrades = trades.filter(t => t.side === 'sell');

  // Volume calculations
  const totalBuyVolume = buyTrades.reduce((sum, t) => sum + toNum(t.quantity), 0);
  const totalSellVolume = sellTrades.reduce((sum, t) => sum + toNum(t.quantity), 0);
  const totalBuyValue = buyTrades.reduce((sum, t) => sum + toNum(t.quantity) * toNum(t.price), 0);
  const totalSellValue = sellTrades.reduce((sum, t) => sum + toNum(t.quantity) * toNum(t.price), 0);

  // PnL calculations
  let realizedPnl = sellTrades.reduce((sum, t) => sum + toNum(t.realizedPnl || '0'), 0);
  
  // Fees
  const totalFees = trades.reduce((sum, t) => sum + toNum(t.fee || '0'), 0);

  // If fees should be included in PnL
  if (includeFees) {
    realizedPnl -= totalFees;
  }

  // Trade statistics
  const profitableTrades = sellTrades.filter(t => toNum(t.realizedPnl || '0') > 0);
  const losingTrades = sellTrades.filter(t => toNum(t.realizedPnl || '0') < 0);

  const winRate = sellTrades.length > 0
    ? (profitableTrades.length / sellTrades.length) * 100
    : 0;

  // Calculate average win/loss
  const wins = profitableTrades.map(t => toNum(t.realizedPnl || '0'));
  const losses = losingTrades.map(t => Math.abs(toNum(t.realizedPnl || '0')));
  
  const avgWin = wins.length > 0
    ? wins.reduce((a, b) => a + b, 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? losses.reduce((a, b) => a + b, 0) / losses.length
    : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
  const largestLoss = losses.length > 0 ? Math.max(...losses) : 0;

  // Current position
  const openPosition = totalBuyVolume - totalSellVolume;
  const lastTrade = trades[trades.length - 1];
  const positionValue = openPosition * (lastTrade ? toNum(lastTrade.price) : 0);

  return {
    totalTrades: trades.length,
    buyTrades: buyTrades.length,
    sellTrades: sellTrades.length,
    totalBuyVolume: toStr(totalBuyVolume),
    totalSellVolume: toStr(totalSellVolume),
    totalBuyValue: toStr2(totalBuyValue),
    totalSellValue: toStr2(totalSellValue),
    
    realizedPnl: toStr2(realizedPnl),
    totalFees: toStr2(totalFees),
    netPnl: toStr2(realizedPnl),
    
    openPosition: toStr(openPosition),
    averageEntryPrice: totalBuyVolume > 0
      ? toStr2(totalBuyValue / totalBuyVolume)
      : '0',
    positionValue: toStr2(positionValue),
    
    winningTrades: profitableTrades.length,
    losingTrades: losingTrades.length,
    winRatePct: winRate.toFixed(2),
    avgWinAmount: toStr2(avgWin),
    avgLossAmount: toStr2(avgLoss),
    largestWin: toStr2(largestWin),
    largestLoss: toStr2(-largestLoss),
  };
}

// Calculate PnL for entire portfolio (multiple assets)
export function calculatePortfolioPnl(
  tradesByAsset: Map<string, ParsedTrade[]>,
  options: PnlCalculationOptions = { method: 'fifo', includeFees: true },
): PortfolioPnlResult {
  const assets: AssetPnlResult[] = [];
  let totalPnl = 0;
  let totalFees = 0;
  let totalTrades = 0;
  let firstTradeAt: Date | null = null;
  let lastTradeAt: Date | null = null;
  let winningAssets = 0;
  let losingAssets = 0;

  for (const [, trades] of tradesByAsset) {
    const result = calculateAssetPnl(trades, options);
    assets.push(result);

    const summary = result.summary;
    totalPnl += toNum(summary.realizedPnl);
    totalFees += toNum(summary.totalFees);
    totalTrades += summary.totalTrades;

    // Track date range
    for (const trade of trades) {
      if (!firstTradeAt || trade.tradeTime < firstTradeAt) {
        firstTradeAt = trade.tradeTime;
      }
      if (!lastTradeAt || trade.tradeTime > lastTradeAt) {
        lastTradeAt = trade.tradeTime;
      }
    }

    // Count winning/losing assets
    if (toNum(summary.realizedPnl) > 0) {
      winningAssets++;
    } else if (toNum(summary.realizedPnl) < 0) {
      losingAssets++;
    }
  }

  // Calculate trading days
  let tradingDays = 0;
  if (firstTradeAt && lastTradeAt) {
    const diffTime = lastTradeAt.getTime() - firstTradeAt.getTime();
    tradingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const summary: PortfolioPnlSummary = {
    totalTrades,
    uniqueAssets: assets.length,
    totalRealizedPnl: toStr2(totalPnl),
    totalFees: toStr2(totalFees),
    netPnl: toStr2(totalPnl),
    firstTradeAt: firstTradeAt || new Date(),
    lastTradeAt: lastTradeAt || new Date(),
    tradingDays,
    winningAssets,
    losingAssets,
    avgTradesPerAsset: assets.length > 0 ? Math.round(totalTrades / assets.length) : 0,
  };

  return { assets, summary };
}

// Group trades by asset
export function groupTradesByAsset(trades: ParsedTrade[]): Map<string, ParsedTrade[]> {
  const grouped = new Map<string, ParsedTrade[]>();
  
  for (const trade of trades) {
    const existing = grouped.get(trade.asset) || [];
    existing.push(trade);
    grouped.set(trade.asset, existing);
  }
  
  return grouped;
}

// Calculate annualized return
export function calculateAnnualizedReturn(
  netPnl: string,
  initialCapital: string,
  tradingDays: number,
): string {
  if (tradingDays <= 0 || toNum(initialCapital) <= 0) {
    return '0';
  }

  const totalReturn = toNum(netPnl) / toNum(initialCapital);
  const periods = 365 / tradingDays;
  
  // Simple annualization (not compounded)
  const annualized = totalReturn * periods * 100;
  
  return annualized.toFixed(2);
}

// Export formats for hackathon submission
export interface HackathonSubmissionPnl {
  sleeveId: string;
  strategyId: string;
  period: { from: Date; to: Date };
  assets: Array<{
    asset: string;
    realizedPnlUsd: string;
    tradeCount: number;
  }>;
  summary: {
    totalRealizedPnlUsd: string;
    totalFeesUsd: string;
    netPnlUsd: string;
    annualizedReturnPct: string;
    tradeCount: number;
    winRatePct: string;
  };
  evidence: {
    tradeHistoryHash: string;
    calculationMethod: PnlCalculationMethod;
    verificationStatus: 'self_reported' | 'cex_verified' | 'third_party_audited';
  };
}

export function generateHackathonSubmission(
  result: PortfolioPnlResult,
  sleeveId: string,
  strategyId: string,
  initialCapital: string,
  verificationStatus: HackathonSubmissionPnl['evidence']['verificationStatus'] = 'self_reported',
): HackathonSubmissionPnl {
  const allTrades = result.assets.flatMap(a => a.trades);
  
  // Create hash of trade history (simplified)
  const tradeHistoryHash = allTrades
    .map(t => t.tradeId)
    .sort()
    .join(',')
    .slice(0, 64);

  return {
    sleeveId,
    strategyId,
    period: { from: result.summary.firstTradeAt, to: result.summary.lastTradeAt },
    assets: result.assets.map(a => ({
      asset: a.asset,
      realizedPnlUsd: a.summary.realizedPnl,
      tradeCount: a.summary.totalTrades,
    })),
    summary: {
      totalRealizedPnlUsd: result.summary.totalRealizedPnl,
      totalFeesUsd: result.summary.totalFees,
      netPnlUsd: result.summary.netPnl,
      annualizedReturnPct: calculateAnnualizedReturn(
        result.summary.netPnl,
        initialCapital,
        result.summary.tradingDays,
      ),
      tradeCount: result.summary.totalTrades,
      winRatePct: result.assets.length > 0
        ? (result.assets.reduce((sum, a) => sum + a.summary.winningTrades, 0) /
           Math.max(result.assets.reduce((sum, a) => sum + a.summary.sellTrades, 0), 1) * 100
          ).toFixed(2)
        : '0',
    },
    evidence: {
      tradeHistoryHash,
      calculationMethod: 'fifo',
      verificationStatus,
    },
  };
}
