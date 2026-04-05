// =============================================================================
// Sentinel Apex — Backtest Engine
// =============================================================================

import { Decimal } from 'decimal.js';
import { createLogger } from '@sentinel-apex/observability';
import type {
  BacktestConfig,
  BacktestResults,
  BacktestRun,
  BacktestDailySnapshot,
  BacktestPosition,
  BacktestTrade,
  MarketDataPoint,
  BacktestStatus,
  BacktestValidationResult,
} from './types.js';
import { generateMarketData, calculateFundingPayment } from './market-data.js';
import { createId } from './utils.js';

const logger = createLogger('backtest-engine');

// =============================================================================
// Configuration Validation
// =============================================================================

export function validateBacktestConfig(config: BacktestConfig): BacktestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate period
  if (config.period.startDate >= config.period.endDate) {
    errors.push('Start date must be before end date');
  }

  const days = (config.period.endDate.getTime() - config.period.startDate.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 1) {
    errors.push('Backtest period must be at least 1 day');
  }
  if (days > 365) {
    warnings.push('Backtest period exceeds 1 year; simulation may be slow');
  }

  // Validate assets
  if (config.assets.length === 0) {
    errors.push('At least one asset must be specified');
  }

  // Validate capital
  const initialCapital = new Decimal(config.initialCapitalUsd);
  if (initialCapital.lte(0)) {
    errors.push('Initial capital must be positive');
  }

  // Validate strategy parameters
  const minSize = new Decimal(config.strategy.minPositionSizeUsd);
  const maxSize = new Decimal(config.strategy.maxPositionSizeUsd);
  if (minSize.gte(maxSize)) {
    errors.push('Min position size must be less than max position size');
  }
  if (maxSize.gt(initialCapital)) {
    warnings.push('Max position size exceeds initial capital');
  }

  // Validate thresholds
  if (config.strategy.hedgeDeviationTolerancePct <= 0) {
    errors.push('Hedge deviation tolerance must be positive');
  }
  if (config.strategy.entryBasisThresholdPct <= 0) {
    errors.push('Entry basis threshold must be positive');
  }

  // Validate simulation parameters
  if (config.simulation.slippageModel === 'fixed' && !config.simulation.slippageBps) {
    errors.push('Fixed slippage model requires slippageBps');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// Backtest Engine
// =============================================================================

export interface BacktestEngineOptions {
  onProgress?: (run: BacktestRun) => void;
  onComplete?: (results: BacktestResults) => void;
  onError?: (error: Error) => void;
}

export class BacktestEngine {
  private runs = new Map<string, BacktestRun>();
  private abortControllers = new Map<string, AbortController>();

  constructor(private options: BacktestEngineOptions = {}) {}

  /**
   * Start a new backtest run
   */
  async startBacktest(config: BacktestConfig): Promise<BacktestRun> {
    // Validate config
    const validation = validateBacktestConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid backtest config: ${validation.errors.join(', ')}`);
    }

    const runId = createId();
    const run: BacktestRun = {
      runId,
      backtestId: config.backtestId,
      status: 'pending',
      progress: {
        currentDate: config.period.startDate,
        totalDays: 0,
        processedDays: 0,
        percentComplete: 0,
      },
    };

    this.runs.set(runId, run);
    this.abortControllers.set(runId, new AbortController());

    // Start simulation
    this.runSimulation(run, config).catch((error) => {
      logger.error(`Backtest simulation failed for run ${runId}: ${error instanceof Error ? error.message : String(error)}`);
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    });

    return run;
  }

  /**
   * Cancel a running backtest
   */
  cancelBacktest(runId: string): boolean {
    const controller = this.abortControllers.get(runId);
    if (controller) {
      controller.abort();
      const run = this.runs.get(runId);
      if (run) {
        run.status = 'cancelled';
      }
      return true;
    }
    return false;
  }

  /**
   * Get run status
   */
  getRun(runId: string): BacktestRun | undefined {
    return this.runs.get(runId);
  }

  /**
   * Get all runs for a backtest
   */
  getRunsForBacktest(backtestId: string): BacktestRun[] {
    return Array.from(this.runs.values()).filter((r) => r.backtestId === backtestId);
  }

  // =============================================================================
  // Simulation Core
  // =============================================================================

  private async runSimulation(run: BacktestRun, config: BacktestConfig): Promise<void> {
    const startTime = Date.now();
    run.status = 'running';
    run.startedAt = new Date();

    const abortController = this.abortControllers.get(run.runId);
    const signal = abortController?.signal;

    try {
      // Generate market data
      logger.info(`Generating market data for backtest ${config.backtestId}...`);
      const marketData = await generateMarketData(
        config.period,
        config.assets,
        config.simulation.useHistoricalFunding,
        config.simulation.useHistoricalBasis
      );

      const days = Math.ceil(
        (config.period.endDate.getTime() - config.period.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      run.progress.totalDays = days;

      // Initialize simulation state
      let cashBalance = new Decimal(config.initialCapitalUsd);
      const positions: Map<string, BacktestPosition> = new Map();
      const trades: BacktestTrade[] = [];
      const dailySnapshots: BacktestDailySnapshot[] = [];
      
      let totalFees = new Decimal(0);
      let totalFundingPaid = new Decimal(0);
      let totalFundingReceived = new Decimal(0);

      // Group market data by day
      const dataByDay = this.groupDataByDay(marketData);

      // Run simulation day by day
      for (let dayIndex = 0; dayIndex < dataByDay.length; dayIndex++) {
        if (signal?.aborted) {
          throw new Error('Backtest cancelled');
        }

        const { date, dataPoints } = dataByDay[dayIndex]!;
        run.progress.currentDate = date;
        run.progress.processedDays = dayIndex + 1;
        run.progress.percentComplete = Math.round(((dayIndex + 1) / dataByDay.length) * 100);

        // Process each data point (8-hour intervals for funding)
        const dayTrades: BacktestTrade[] = [];

        for (const dataPoint of dataPoints) {
          // Check for entry/exit signals
          const signal = this.generateSignal(dataPoint, config, positions);
          
          if (signal.action === 'enter' && signal.asset) {
            const entryResult = this.executeEntry(
              dataPoint,
              config,
              cashBalance,
              signal.asset
            );
            
            if (entryResult.success && entryResult.trades) {
              for (const trade of entryResult.trades) {
                dayTrades.push(trade);
                trades.push(trade);
                
                // Update position
                this.updatePositionFromTrade(positions, trade);
                
                // Update cash and fees
                const notional = new Decimal(trade.notionalUsd);
                const fees = new Decimal(trade.fees);
                cashBalance = cashBalance.minus(notional).minus(fees);
                totalFees = totalFees.plus(fees);
              }
            }
          } else if (signal.action === 'exit' && signal.positionId) {
            const exitResult = this.executeExit(
              dataPoint,
              config,
              positions.get(signal.positionId)
            );
            
            if (exitResult.success && exitResult.trades) {
              for (const trade of exitResult.trades) {
                dayTrades.push(trade);
                trades.push(trade);
                
                // Update cash and fees
                const notional = new Decimal(trade.notionalUsd);
                const fees = new Decimal(trade.fees);
                const pnl = new Decimal(trade.realizedPnl || '0');
                cashBalance = cashBalance.plus(notional).plus(pnl).minus(fees);
                totalFees = totalFees.plus(fees);
              }
              
              // Remove position
              positions.delete(signal.positionId);
            }
          }

          // Apply funding payments every 8 hours
          const fundingPayments = this.applyFundingPayments(
            dataPoint,
            Array.from(positions.values())
          );
          
          for (const payment of fundingPayments) {
            if (new Decimal(payment.amount).gte(0)) {
              totalFundingReceived = totalFundingReceived.plus(payment.amount);
            } else {
              totalFundingPaid = totalFundingPaid.plus(payment.amount);
            }
            
            // Update position funding tracking
            const position = positions.get(payment.positionId);
            if (position) {
              position.fundingPaid = new Decimal(position.fundingPaid)
                .plus(payment.amount)
                .toFixed();
            }
          }
        }

        // Calculate end-of-day portfolio value
        const currentPrices = this.getLatestPrices(dataPoints);
        const portfolioValue = this.calculatePortfolioValue(
          cashBalance,
          Array.from(positions.values()),
          currentPrices
        );

        // Create daily snapshot
        const snapshot: BacktestDailySnapshot = {
          date,
          portfolioValue: portfolioValue.toFixed(),
          cashBalance: cashBalance.toFixed(),
          positions: Array.from(positions.values()),
          unrealizedPnl: this.calculateUnrealizedPnl(
            Array.from(positions.values()),
            currentPrices
          ).toFixed(),
          realizedPnl: trades
            .reduce((sum, t) => sum.plus(t.realizedPnl || '0'), new Decimal(0))
            .toFixed(),
          fundingPaid: totalFundingPaid.toFixed(),
          totalFees: totalFees.toFixed(),
          trades: dayTrades,
          marketData: currentPrices,
        };
        dailySnapshots.push(snapshot);

        // Report progress
        this.options.onProgress?.(run);

        // Yield to event loop every 10 days
        if (dayIndex % 10 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      // Build results
      const results = this.buildResults(
        config,
        trades,
        Array.from(positions.values()),
        dailySnapshots,
        cashBalance,
        totalFees,
        totalFundingPaid,
        totalFundingReceived,
        Date.now() - startTime
      );

      run.results = results;
      run.status = 'completed';
      run.completedAt = new Date();

      this.options.onComplete?.(results);

      logger.info(`Backtest ${config.backtestId} completed with return ${results.performance.totalReturnPct}%`);
    } catch (error) {
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private groupDataByDay(data: MarketDataPoint[]): Array<{ date: Date; dataPoints: MarketDataPoint[] }> {
    const groups = new Map<string, MarketDataPoint[]>();
    
    for (const point of data) {
      const dateKey = point.timestamp.toISOString().split('T')[0]!;
      const existing = groups.get(dateKey) || [];
      existing.push(point);
      groups.set(dateKey, existing);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, dataPoints]) => ({
        date: new Date(dateStr),
        dataPoints: dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
      }));
  }

  private generateSignal(
    data: MarketDataPoint,
    config: BacktestConfig,
    positions: Map<string, BacktestPosition>
  ): { action: 'enter' | 'exit' | 'hold'; asset?: string; positionId?: string } {
    const basis = new Decimal(data.perpPrice).minus(data.spotPrice);
    const basisPct = basis.div(data.spotPrice).times(100);
    
    // Check if we already have a position for this asset
    const existingPosition = Array.from(positions.values()).find(
      (p) => p.asset === data.asset
    );

    if (existingPosition) {
      // Check exit signal
      if (basisPct.lt(config.strategy.exitBasisThresholdPct)) {
        return { action: 'exit', asset: data.asset, positionId: existingPosition.asset };
      }
      return { action: 'hold' };
    } else {
      // Check entry signal
      if (basisPct.gte(config.strategy.entryBasisThresholdPct)) {
        // Check if we have capital
        return { action: 'enter', asset: data.asset };
      }
      return { action: 'hold' };
    }
  }

  private executeEntry(
    data: MarketDataPoint,
    config: BacktestConfig,
    availableCash: Decimal,
    asset: string
  ): { success: boolean; trades?: BacktestTrade[] } {
    const positionSize = Decimal.min(new Decimal(config.strategy.maxPositionSizeUsd), availableCash.times(0.95));
    
    if (positionSize.lt(config.strategy.minPositionSizeUsd)) {
      return { success: false };
    }

    const spotSize = positionSize.div(data.spotPrice);
    const perpSize = positionSize.div(data.perpPrice);

    const takerFeeBps = config.simulation.takerFeeBps || 5; // Default 5 bps
    const slippageBps = config.simulation.slippageBps || 1; // Default 1 bp

    const spotTrade: BacktestTrade = {
      tradeId: createId(),
      timestamp: data.timestamp,
      asset,
      side: 'long',
      marketType: 'spot',
      size: spotSize.toFixed(),
      price: new Decimal(data.spotPrice).times(1 + slippageBps / 10000).toFixed(),
      notionalUsd: positionSize.toFixed(),
      fees: positionSize.times(takerFeeBps / 10000).toFixed(),
    };

    const perpTrade: BacktestTrade = {
      tradeId: createId(),
      timestamp: data.timestamp,
      asset,
      side: 'short',
      marketType: 'perp',
      size: perpSize.toFixed(),
      price: new Decimal(data.perpPrice).times(1 - slippageBps / 10000).toFixed(),
      notionalUsd: positionSize.toFixed(),
      fees: positionSize.times(takerFeeBps / 10000).toFixed(),
    };

    return { success: true, trades: [spotTrade, perpTrade] };
  }

  private executeExit(
    data: MarketDataPoint,
    config: BacktestConfig,
    position?: BacktestPosition
  ): { success: boolean; trades?: BacktestTrade[] } {
    if (!position) return { success: false };

    const takerFeeBps = config.simulation.takerFeeBps || 5;
    const slippageBps = config.simulation.slippageBps || 1;

    const currentPrice = position.marketType === 'spot' ? data.spotPrice : data.perpPrice;
    const exitPrice = new Decimal(currentPrice).times(
      position.side === 'long' ? 1 - slippageBps / 10000 : 1 + slippageBps / 10000
    );
    
    const entryPrice = new Decimal(position.avgEntryPrice);
    const size = new Decimal(position.size);
    const notional = size.times(exitPrice);
    
    const pnl = position.side === 'long'
      ? exitPrice.minus(entryPrice).times(size)
      : entryPrice.minus(exitPrice).times(size);

    const trade: BacktestTrade = {
      tradeId: createId(),
      timestamp: data.timestamp,
      asset: position.asset,
      side: position.side === 'long' ? 'short' : 'long',
      marketType: position.marketType,
      size: position.size,
      price: exitPrice.toFixed(),
      notionalUsd: notional.toFixed(),
      fees: notional.times(takerFeeBps / 10000).toFixed(),
      fundingPaid: position.fundingPaid,
      realizedPnl: pnl.toFixed(),
    };

    return { success: true, trades: [trade] };
  }

  private updatePositionFromTrade(positions: Map<string, BacktestPosition>, trade: BacktestTrade): void {
    const positionId = `${trade.asset}-${trade.marketType}`;
    const existing = positions.get(positionId);

    if (existing) {
      // Update existing position
      const newSize = new Decimal(existing.size).plus(trade.size);
      const newNotional = new Decimal(existing.notionalUsd).plus(trade.notionalUsd);
      const newAvgPrice = newNotional.div(newSize);
      
      existing.size = newSize.toFixed();
      existing.avgEntryPrice = newAvgPrice.toFixed();
      existing.notionalUsd = newNotional.toFixed();
    } else {
      // Create new position
      const position: BacktestPosition = {
        asset: trade.asset,
        side: trade.side,
        marketType: trade.marketType,
        size: trade.size,
        avgEntryPrice: trade.price,
        notionalUsd: trade.notionalUsd,
        unrealizedPnl: '0',
        realizedPnl: '0',
        fundingPaid: '0',
        openedAt: trade.timestamp,
      };
      positions.set(positionId, position);
    }
  }

  private applyFundingPayments(
    data: MarketDataPoint,
    positions: BacktestPosition[]
  ): Array<{ positionId: string; amount: string }> {
    const payments: Array<{ positionId: string; amount: string }> = [];

    for (const position of positions) {
      if (position.marketType === 'perp' && position.side === 'short') {
        // Shorts receive funding when rate is positive
        const payment = calculateFundingPayment(position, data.fundingRate);
        payments.push({ positionId: position.asset, amount: payment });
      }
    }

    return payments;
  }

  private getLatestPrices(dataPoints: MarketDataPoint[]): Record<string, {
    spotPrice: string;
    perpPrice: string;
    fundingRate: string;
    basis: string;
  }> {
    const prices: Record<string, { spotPrice: string; perpPrice: string; fundingRate: string; basis: string }> = {};
    
    for (const data of dataPoints) {
      prices[data.asset] = {
        spotPrice: data.spotPrice,
        perpPrice: data.perpPrice,
        fundingRate: data.fundingRate,
        basis: new Decimal(data.perpPrice).minus(data.spotPrice).toFixed(),
      };
    }

    return prices;
  }

  private calculatePortfolioValue(
    cash: Decimal,
    positions: BacktestPosition[],
    prices: Record<string, { spotPrice: string; perpPrice: string }>
  ): Decimal {
    let value = cash;

    for (const position of positions) {
      const price = position.marketType === 'spot'
        ? prices[position.asset]?.spotPrice
        : prices[position.asset]?.perpPrice;
      
      if (price) {
        const positionValue = new Decimal(position.size).times(price);
        value = value.plus(positionValue);
      }
    }

    return value;
  }

  private calculateUnrealizedPnl(
    positions: BacktestPosition[],
    prices: Record<string, { spotPrice: string; perpPrice: string }>
  ): Decimal {
    let totalPnl = new Decimal(0);

    for (const position of positions) {
      const currentPrice = position.marketType === 'spot'
        ? prices[position.asset]?.spotPrice
        : prices[position.asset]?.perpPrice;
      
      if (currentPrice) {
        const entryPrice = new Decimal(position.avgEntryPrice);
        const size = new Decimal(position.size);
        const pnl = position.side === 'long'
          ? new Decimal(currentPrice).minus(entryPrice).times(size)
          : entryPrice.minus(currentPrice).times(size);
        totalPnl = totalPnl.plus(pnl);
      }
    }

    return totalPnl;
  }

  private buildResults(
    config: BacktestConfig,
    trades: BacktestTrade[],
    finalPositions: BacktestPosition[],
    dailySnapshots: BacktestDailySnapshot[],
    finalCash: Decimal,
    totalFees: Decimal,
    totalFundingPaid: Decimal,
    totalFundingReceived: Decimal,
    durationMs: number
  ): BacktestResults {
    const initialCapital = new Decimal(config.initialCapitalUsd);
    const finalValue = dailySnapshots.length > 0
      ? new Decimal(dailySnapshots[dailySnapshots.length - 1]!.portfolioValue)
      : initialCapital;
    
    const totalReturnUsd = finalValue.minus(initialCapital);
    const totalReturnPct = initialCapital.gt(0)
      ? totalReturnUsd.div(initialCapital).times(100)
      : new Decimal(0);

    const days = dailySnapshots.length;
    const years = days / 365;
    const annualizedReturn = years > 0
      ? totalReturnUsd.div(initialCapital).plus(1).pow(1 / years).minus(1).times(100)
      : new Decimal(0);

    // Calculate max drawdown
    let maxDrawdownPct = new Decimal(0);
    let peak = new Decimal(0);
    for (const snapshot of dailySnapshots) {
      const value = new Decimal(snapshot.portfolioValue);
      if (value.gt(peak)) {
        peak = value;
      }
      const drawdown = peak.gt(0) ? peak.minus(value).div(peak).times(100) : new Decimal(0);
      if (drawdown.gt(maxDrawdownPct)) {
        maxDrawdownPct = drawdown;
      }
    }

    // Calculate trade stats
    const winningTrades = trades.filter((t) => new Decimal(t.realizedPnl || '0').gt(0));
    const losingTrades = trades.filter((t) => new Decimal(t.realizedPnl || '0').lt(0));
    
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum.plus(t.realizedPnl || '0'), new Decimal(0)).div(winningTrades.length)
      : new Decimal(0);
    
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum.plus(t.realizedPnl || '0'), new Decimal(0)).div(losingTrades.length)
      : new Decimal(0);

    const grossProfit = winningTrades.reduce((sum, t) => sum.plus(t.realizedPnl || '0'), new Decimal(0));
    const grossLoss = losingTrades.reduce((sum, t) => sum.plus(t.realizedPnl || '0'), new Decimal(0)).abs();
    const profitFactor = grossLoss.gt(0) ? grossProfit.div(grossLoss) : new Decimal(0);

    const largestWin = winningTrades.length > 0
      ? winningTrades.reduce((max, t) => Decimal.max(max, new Decimal(t.realizedPnl || '0')), new Decimal(0))
      : new Decimal(0);
    
    const largestLoss = losingTrades.length > 0
      ? losingTrades.reduce((min, t) => Decimal.min(min, new Decimal(t.realizedPnl || '0')), new Decimal(0))
      : new Decimal(0);

    // Average holding time
    const holdingTimes: number[] = [];
    for (const position of finalPositions) {
      const entryTrade = trades.find((t) => 
        t.asset === position.asset && 
        t.marketType === position.marketType &&
        t.side === position.side
      );
      if (entryTrade) {
        const hours = (Date.now() - entryTrade.timestamp.getTime()) / (1000 * 60 * 60);
        holdingTimes.push(hours);
      }
    }
    const avgHoldingTime = holdingTimes.length > 0
      ? holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length
      : 0;

    return {
      backtestId: config.backtestId,
      config,
      actualPeriod: {
        startDate: dailySnapshots[0]?.date || config.period.startDate,
        endDate: dailySnapshots[dailySnapshots.length - 1]?.date || config.period.endDate,
      },
      performance: {
        totalReturnPct: totalReturnPct.toFixed(4),
        totalReturnUsd: totalReturnUsd.toFixed(2),
        annualizedReturnPct: annualizedReturn.toFixed(4),
        maxDrawdownPct: maxDrawdownPct.toFixed(4),
      },
      trades: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRatePct: trades.length > 0
          ? new Decimal(winningTrades.length).div(trades.length).times(100).toFixed(2)
          : '0',
        avgWinUsd: avgWin.toFixed(2),
        avgLossUsd: avgLoss.toFixed(2),
        profitFactor: profitFactor.toFixed(2),
        largestWinUsd: largestWin.toFixed(2),
        largestLossUsd: largestLoss.toFixed(2),
      },
      positions: {
        totalPositions: finalPositions.length,
        avgPositionSizeUsd: finalPositions.length > 0
          ? finalPositions.reduce((sum, p) => sum.plus(p.notionalUsd), new Decimal(0)).div(finalPositions.length).toFixed(2)
          : '0',
        avgHoldingTimeHours: Math.round(avgHoldingTime),
      },
      funding: {
        totalFundingPaid: totalFundingPaid.toFixed(2),
        totalFundingReceived: totalFundingReceived.toFixed(2),
        netFunding: totalFundingReceived.plus(totalFundingPaid).toFixed(2),
        avgDailyFundingRate: days > 0
          ? totalFundingReceived.plus(totalFundingPaid).div(days).toFixed(4)
          : '0',
      },
      fees: {
        totalFees: totalFees.toFixed(2),
        tradingFees: totalFees.toFixed(2),
        fundingFees: '0',
      },
      dailySnapshots,
      caveats: [
        'Historical simulation uses synthesized market data unless external data provider is configured',
        'Slippage model is simplified; real execution may vary significantly',
        'Funding rates are approximated from 8-hour snapshots',
        'Market impact and liquidity constraints not modeled',
        'Results represent theoretical performance, not actual trading results',
      ],
      generatedAt: new Date(),
      durationMs,
    };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBacktestEngine(options?: BacktestEngineOptions): BacktestEngine {
  return new BacktestEngine(options);
}
