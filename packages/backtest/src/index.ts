// =============================================================================
// Sentinel Apex — Backtest Package
// =============================================================================

/**
 * Historical backtesting framework for delta-neutral carry strategies.
 * 
 * IMPORTANT DISCLAIMER:
 * This package provides historical simulation capabilities for strategy validation.
 * Results are labeled as 'historical_simulation' or 'paper_trade' - never as
 * live performance. Backtests use synthesized market data unless configured with
 * real historical data sources.
 * 
 * @example
 * ```typescript
 * import { createBacktestEngine, createDefaultConfig } from '@sentinel-apex/backtest';
 * 
 * const engine = createBacktestEngine({
 *   onProgress: (run) => console.log(`${run.progress.percentComplete}% complete`),
 * });
 * 
 * const config = createDefaultConfig({
 *   backtestId: 'btc-carry-test',
 *   period: { startDate: new Date('2024-01-01'), endDate: new Date('2024-03-01') },
 *   assets: ['BTC'],
 * });
 * 
 * const run = await engine.startBacktest(config);
 * ```
 */

// Core exports
export { createBacktestEngine, BacktestEngine, validateBacktestConfig } from './engine.js';
export { generateReport, generateDossierSummary } from './report-generator.js';
export { generateMarketData, calculateFundingPayment } from './market-data.js';
export { createId, formatDate, formatNumber, formatPercent, formatDuration } from './utils.js';

// Type exports
export type {
  BacktestConfig,
  BacktestResults,
  BacktestRun,
  BacktestStatus,
  BacktestDailySnapshot,
  BacktestPosition,
  BacktestTrade,
  BacktestValidationResult,
  BacktestExportFormat,
  BacktestReport,
  MarketDataPoint,
  FundingRateEntry,
  BasisEntry,
  BacktestExecutionMode,
  BacktestPeriod,
} from './types.js';

// =============================================================================
// Default Configuration Helpers
// =============================================================================

import type { BacktestConfig } from './types.js';

export interface DefaultConfigOptions {
  backtestId: string;
  name?: string;
  period: { startDate: Date; endDate: Date };
  assets: string[];
  initialCapitalUsd?: string;
  createdBy: string;
}

/**
 * Create a default backtest configuration for delta-neutral carry
 */
export function createDefaultConfig(options: DefaultConfigOptions): BacktestConfig {
  return {
    backtestId: options.backtestId,
    name: options.name || `Backtest ${options.backtestId}`,
    description: `Historical simulation for ${options.assets.join(', ')} delta-neutral carry strategy`,
    period: options.period,
    assets: options.assets,
    strategy: {
      type: 'delta_neutral_carry',
      targetLeverage: '1.0',
      maxPositionSizeUsd: '100000',
      minPositionSizeUsd: '1000',
      hedgeDeviationTolerancePct: 1,
      rebalanceThresholdPct: 2,
      entryBasisThresholdPct: 0.1,
      exitBasisThresholdPct: 0.05,
    },
    simulation: {
      executionMode: 'historical_simulation',
      slippageModel: 'fixed',
      slippageBps: 5,
      feeModel: 'realistic',
      takerFeeBps: 5,
      useHistoricalFunding: false,
      useHistoricalBasis: false,
    },
    initialCapitalUsd: options.initialCapitalUsd || '1000000',
    createdBy: options.createdBy,
  };
}

/**
 * Create a backtest configuration with real historical data
 */
export function createHistoricalConfig(options: DefaultConfigOptions): BacktestConfig {
  const config = createDefaultConfig(options);
  config.simulation.useHistoricalFunding = true;
  config.simulation.useHistoricalBasis = true;
  config.simulation.executionMode = 'historical_simulation';
  return config;
}
