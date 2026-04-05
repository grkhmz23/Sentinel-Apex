// =============================================================================
// Sentinel Apex — Backtesting Types
// =============================================================================

import type { Decimal } from 'decimal.js';

/**
 * Backtest execution mode - truthful labeling
 */
export type BacktestExecutionMode = 'historical_simulation' | 'paper_trade';

/**
 * Time period for backtest
 */
export interface BacktestPeriod {
  startDate: Date;
  endDate: Date;
}

/**
 * Market data point for historical simulation
 */
export interface MarketDataPoint {
  timestamp: Date;
  asset: string;
  spotPrice: string;
  perpPrice: string;
  fundingRate: string; // 8-hour funding rate
  openInterest?: string;
  volume24h?: string;
}

/**
 * Funding rate entry for historical replay
 */
export interface FundingRateEntry {
  timestamp: Date;
  asset: string;
  rate: string; // Funding rate (e.g., "0.0001" for 0.01%)
  annualizedRate: string; // Annualized for APY calculation
}

/**
 * Basis (spread) entry for historical replay
 */
export interface BasisEntry {
  timestamp: Date;
  asset: string;
  spotPrice: string;
  perpPrice: string;
  basis: string; // perp - spot
  basisPct: string; // (perp - spot) / spot * 100
}

/**
 * Simulated trade from backtest
 */
export interface BacktestTrade {
  tradeId: string;
  timestamp: Date;
  asset: string;
  side: 'long' | 'short';
  marketType: 'spot' | 'perp';
  size: string;
  price: string;
  notionalUsd: string;
  fees: string;
  fundingPaid?: string; // Cumulative funding since entry
  realizedPnl?: string; // Realized PnL on exit
}

/**
 * Position state during backtest
 */
export interface BacktestPosition {
  asset: string;
  side: 'long' | 'short';
  marketType: 'spot' | 'perp';
  size: string;
  avgEntryPrice: string;
  notionalUsd: string;
  unrealizedPnl: string;
  realizedPnl: string;
  fundingPaid: string;
  openedAt: Date;
}

/**
 * Backtest configuration
 */
export interface BacktestConfig {
  // Identity
  backtestId: string;
  name: string;
  description?: string;
  
  // Time range
  period: BacktestPeriod;
  
  // Assets to test
  assets: string[];
  
  // Strategy parameters
  strategy: {
    type: 'delta_neutral_carry';
    targetLeverage: string; // e.g., "1.0" for 1x
    maxPositionSizeUsd: string;
    minPositionSizeUsd: string;
    hedgeDeviationTolerancePct: number; // e.g., 1 for 1%
    rebalanceThresholdPct: number; // When to rebalance
    entryBasisThresholdPct: number; // Min basis to enter
    exitBasisThresholdPct: number; // Max basis to exit
  };
  
  // Simulation parameters
  simulation: {
    executionMode: BacktestExecutionMode;
    slippageModel: 'none' | 'fixed' | 'variable';
    slippageBps?: number; // Fixed slippage in basis points
    feeModel: 'none' | 'fixed' | 'realistic';
    makerFeeBps?: number;
    takerFeeBps?: number;
    useHistoricalFunding: boolean;
    useHistoricalBasis: boolean;
  };
  
  // Initial capital
  initialCapitalUsd: string;
  
  // Metadata
  tags?: string[];
  createdBy: string;
}

/**
 * Daily snapshot during backtest
 */
export interface BacktestDailySnapshot {
  date: Date;
  portfolioValue: string;
  cashBalance: string;
  positions: BacktestPosition[];
  unrealizedPnl: string;
  realizedPnl: string;
  fundingPaid: string;
  totalFees: string;
  trades: BacktestTrade[];
  
  // Market conditions
  marketData: Record<string, { // keyed by asset
    spotPrice: string;
    perpPrice: string;
    fundingRate: string;
    basis: string;
  }>;
}

/**
 * Backtest results summary
 */
export interface BacktestResults {
  backtestId: string;
  config: BacktestConfig;
  
  // Time range actually tested
  actualPeriod: BacktestPeriod;
  
  // Performance metrics
  performance: {
    totalReturnPct: string;
    totalReturnUsd: string;
    annualizedReturnPct: string;
    sharpeRatio?: string;
    maxDrawdownPct: string;
    volatilityPct?: string;
  };
  
  // Trade statistics
  trades: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRatePct: string;
    avgWinUsd: string;
    avgLossUsd: string;
    profitFactor: string;
    largestWinUsd: string;
    largestLossUsd: string;
  };
  
  // Position statistics
  positions: {
    totalPositions: number;
    avgPositionSizeUsd: string;
    avgHoldingTimeHours: number;
  };
  
  // Funding capture
  funding: {
    totalFundingPaid: string;
    totalFundingReceived: string;
    netFunding: string;
    avgDailyFundingRate: string;
  };
  
  // Fees
  fees: {
    totalFees: string;
    tradingFees: string;
    fundingFees: string;
  };
  
  // Daily history
  dailySnapshots: BacktestDailySnapshot[];
  
  // Caveats and assumptions
  caveats: string[];
  
  // Metadata
  generatedAt: Date;
  durationMs: number;
}

/**
 * Backtest status
 */
export type BacktestStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Backtest run state
 */
export interface BacktestRun {
  runId: string;
  backtestId: string;
  status: BacktestStatus;
  progress: {
    currentDate: Date;
    totalDays: number;
    processedDays: number;
    percentComplete: number;
  };
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: BacktestResults;
}

/**
 * Export formats for backtest reports
 */
export type BacktestExportFormat = 'json' | 'markdown' | 'csv';

/**
 * Backtest report artifact
 */
export interface BacktestReport {
  backtestId: string;
  runId: string;
  format: BacktestExportFormat;
  content: string;
  filename: string;
  generatedAt: Date;
}

/**
 * Validation result for backtest config
 */
export interface BacktestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
