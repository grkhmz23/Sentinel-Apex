// =============================================================================
// Strategy pipeline — signal → intent → risk → execution
// =============================================================================

import Decimal from 'decimal.js';

import type { CarryConfig, CarryOpportunityCandidate } from '@sentinel-apex/carry';
import {
  detectFundingRateOpportunities,
  detectCrossVenueOpportunities,
  computeMaxAllowedSize,
  computePositionSize,
} from '@sentinel-apex/carry';
import type { RiskAssessment, OrderIntent } from '@sentinel-apex/domain';
import type { Logger, AuditWriter, MetricsRegistry } from '@sentinel-apex/observability';
import type { RiskEngine, PortfolioState } from '@sentinel-apex/risk-engine';
import type { VenueAdapter, MarketData } from '@sentinel-apex/venue-adapters';

import { buildIntentsFromOpportunity } from './intent-builder.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface PipelineConfig {
  /** 'dry-run' logs only; 'live' requires an explicit flag and submits orders. */
  mode: 'dry-run' | 'live';
  /** Belt-and-suspenders safeguard so live mode must be explicitly opted into. */
  allowLiveExecution?: boolean;
  sleeveId: string;
  /** How often to scan for opportunities (ms). */
  scanIntervalMs: number;
  /** For testing/paper-trading: stop after N iterations. */
  maxIterations?: number;
}

export type PipelineStage =
  | 'market_data_fetch'
  | 'opportunity_detection'
  | 'opportunity_evaluation'
  | 'risk_assessment'
  | 'intent_generation'
  | 'execution'
  | 'reconciliation'
  | 'reporting';

export interface PipelineResult {
  stage: PipelineStage;
  success: boolean;
  opportunitiesDetected: number;
  opportunitiesApproved: number;
  intentsGenerated: number;
  intentsExecuted: number;
  errors: string[];
  durationMs: number;
  timestamp: Date;
}

export interface PlannedIntentAssessment {
  intent: OrderIntent;
  approved: boolean;
  assessment: RiskAssessment;
}

export interface PlannedStrategyCycle {
  opportunitiesDetected: CarryOpportunityCandidate[];
  opportunitiesApproved: CarryOpportunityCandidate[];
  intentsGenerated: OrderIntent[];
  riskResults: PlannedIntentAssessment[];
  approvedIntents: OrderIntent[];
  rejectedIntents: OrderIntent[];
  timestamp: Date;
}

// ── StrategyPipeline ──────────────────────────────────────────────────────────

export class StrategyPipeline {
  private readonly cycleCounter: ReturnType<MetricsRegistry['createCounter']>;
  private readonly opportunityCounter: ReturnType<MetricsRegistry['createCounter']>;
  private readonly intentCounter: ReturnType<MetricsRegistry['createCounter']>;
  private readonly executionCounter: ReturnType<MetricsRegistry['createCounter']>;
  private readonly cycleDurationHistogram: ReturnType<MetricsRegistry['createHistogram']>;

  constructor(
    private readonly config: PipelineConfig,
    private readonly adapters: Map<string, VenueAdapter>,
    private readonly riskEngine: RiskEngine,
    private readonly carryConfig: CarryConfig,
    private readonly logger: Logger,
    private readonly auditWriter: AuditWriter,
    private readonly registry: MetricsRegistry,
  ) {
    this.cycleCounter = registry.createCounter('pipeline_cycles_total');
    this.opportunityCounter = registry.createCounter('pipeline_opportunities_total');
    this.intentCounter = registry.createCounter('pipeline_intents_total');
    this.executionCounter = registry.createCounter('pipeline_executions_total');
    this.cycleDurationHistogram = registry.createHistogram('pipeline_cycle_duration_ms');
  }

  // ── Public entry point ────────────────────────────────────────────────────

  /**
   * Run one full pipeline cycle:
   *   1. Fetch market data from all adapters
   *   2. Detect carry opportunities
   *   3. Evaluate and filter candidates
   *   4. Generate order intents for approved candidates
   *   5. Run risk checks on each intent
   *   6. Execute approved intents (dry-run: log; live: submit)
   */
  async runCycle(portfolioState: PortfolioState): Promise<PipelineResult> {
    const cycleStart = Date.now();
    const errors: string[] = [];
    let opportunitiesDetected = 0;
    let opportunitiesApproved = 0;
    let intentsGenerated = 0;
    let intentsExecuted = 0;
    let currentStage: PipelineStage = 'market_data_fetch';

    try {
      this.logger.info('StrategyPipeline.runCycle: starting cycle', {
        mode: this.config.mode,
        sleeveId: this.config.sleeveId,
      });

      const plannedCycle = await this.planCycle(portfolioState);
      opportunitiesDetected = plannedCycle.opportunitiesDetected.length;
      opportunitiesApproved = plannedCycle.opportunitiesApproved.length;
      intentsGenerated = plannedCycle.intentsGenerated.length;

      const approvedIntents = plannedCycle.approvedIntents;

      await this.auditWriter.write({
        eventId: crypto.randomUUID(),
        eventType: 'pipeline.risk_assessment_complete',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: 'strategy-pipeline',
        sleeveId: this.config.sleeveId,
        data: {
          cycleTimestamp: new Date().toISOString(),
          totalIntents: plannedCycle.intentsGenerated.length,
          approvedIntents: approvedIntents.length,
          rejectedIntents: plannedCycle.intentsGenerated.length - approvedIntents.length,
        },
      });

      // Stage 6: Execute
      currentStage = 'execution';
      await this.executeIntents(approvedIntents);
      intentsExecuted = approvedIntents.length;

      this.executionCounter.increment(
        { sleeve: this.config.sleeveId, mode: this.config.mode },
        intentsExecuted,
      );

      // Stage 7: Reporting
      currentStage = 'reporting';
      const durationMs = Date.now() - cycleStart;

      this.cycleCounter.increment({ sleeve: this.config.sleeveId, status: 'success' });
      this.cycleDurationHistogram.observe(durationMs, { sleeve: this.config.sleeveId });

      this.logger.info('StrategyPipeline.runCycle: cycle complete', {
        durationMs,
        opportunitiesDetected,
        opportunitiesApproved,
        intentsGenerated,
        intentsExecuted,
      });

      return {
        stage: currentStage,
        success: true,
        opportunitiesDetected,
        opportunitiesApproved,
        intentsGenerated,
        intentsExecuted,
        errors,
        durationMs,
        timestamp: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`[${currentStage}] ${message}`);

      this.logger.error('StrategyPipeline.runCycle: cycle failed', {
        stage: currentStage,
        error: message,
      });

      this.cycleCounter.increment({ sleeve: this.config.sleeveId, status: 'error' });

      return {
        stage: currentStage,
        success: false,
        opportunitiesDetected,
        opportunitiesApproved,
        intentsGenerated,
        intentsExecuted,
        errors,
        durationMs: Date.now() - cycleStart,
        timestamp: new Date(),
      };
    }
  }

  async planCycle(portfolioState: PortfolioState): Promise<PlannedStrategyCycle> {
    const marketData = await this.fetchMarketData();
    const candidates = await this.detectOpportunities(marketData);

    this.opportunityCounter.increment(
      { sleeve: this.config.sleeveId },
      candidates.length,
    );

    this.logger.info('StrategyPipeline.planCycle: opportunities detected', {
      count: candidates.length,
    });

    const approved = await this.evaluateOpportunities(candidates);
    const intents = await this.generateIntents(approved, portfolioState);

    this.intentCounter.increment(
      { sleeve: this.config.sleeveId },
      intents.length,
    );

    const riskResults = await this.runRiskChecks(intents, portfolioState);
    const approvedIntents = riskResults.filter((result) => result.approved).map((result) => result.intent);
    const rejectedIntents = riskResults.filter((result) => !result.approved).map((result) => result.intent);

    return {
      opportunitiesDetected: candidates,
      opportunitiesApproved: approved,
      intentsGenerated: intents,
      riskResults,
      approvedIntents,
      rejectedIntents,
      timestamp: new Date(),
    };
  }

  // ── Private pipeline stages ───────────────────────────────────────────────

  /**
   * Fetch market data from all connected adapters.
   * Returns a map of asset → [MarketData per venue].
   */
  private async fetchMarketData(): Promise<Map<string, MarketData[]>> {
    const result = new Map<string, MarketData[]>();

    for (const [venueId, adapter] of this.adapters) {
      if (!adapter.isConnected()) {
        this.logger.warn('StrategyPipeline.fetchMarketData: adapter not connected', { venueId });
        continue;
      }

      for (const asset of this.carryConfig.approvedAssets) {
        try {
          const md = await adapter.getMarketData(asset);
          const existing = result.get(asset) ?? [];
          existing.push(md);
          result.set(asset, existing);
        } catch (error) {
          this.logger.warn('StrategyPipeline.fetchMarketData: failed to fetch market data', {
            venueId,
            asset,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return result;
  }

  /**
   * Detect carry opportunities from fetched market data.
   *
   * Combines:
   *   1. Funding rate arbitrage from each venue's funding rate data
   *   2. Cross-venue spread opportunities from price discrepancies
   */
  private async detectOpportunities(
    marketData: Map<string, MarketData[]>,
  ): Promise<CarryOpportunityCandidate[]> {
    const candidates: CarryOpportunityCandidate[] = [];

    // Build funding rate snapshots from market data
    const fundingSnapshots = [];
    for (const [, venues] of marketData) {
      for (const md of venues) {
        // Annualize: rate8h × 3 × 365
        const rate8h = parseFloat(md.fundingRate);
        const annualizedRate = (rate8h * 3 * 365 * 100).toFixed(4);

        fundingSnapshots.push({
          venueId: md.venueId,
          asset: md.asset,
          rate8h: md.fundingRate,
          annualizedRate,
          markPrice: md.markPrice,
          nextFundingTime: md.nextFundingTime,
          timestamp: md.updatedAt,
          perpMarketIdentity: md.marketIdentity ?? null,
        });
      }
    }

    const fundingOpps = detectFundingRateOpportunities(fundingSnapshots, this.carryConfig);
    candidates.push(...fundingOpps);

    // Cross-venue spread detection
    const spreadOpps = detectCrossVenueOpportunities(marketData, this.carryConfig);
    candidates.push(...spreadOpps);

    return candidates;
  }

  /**
   * Evaluate and filter candidates.
   *
   * Filters out:
   *   - Expired opportunities
   *   - Opportunities below confidence threshold
   *   - Opportunities below net yield threshold
   *
   * Sorts by net yield descending and caps at maxConcurrentOpportunities.
   */
  private async evaluateOpportunities(
    candidates: CarryOpportunityCandidate[],
  ): Promise<CarryOpportunityCandidate[]> {
    const now = new Date();

    const filtered = candidates.filter((c) => {
      if (c.expiresAt <= now) {
        return false;
      }
      if (c.confidenceScore < this.carryConfig.minConfidenceScore) {
        return false;
      }
      if (parseFloat(c.netYieldPct) < parseFloat(this.carryConfig.minAnnualYieldPct)) {
        return false;
      }
      return true;
    });

    // Sort by net yield descending — take the best opportunities first
    filtered.sort((a, b) => parseFloat(b.netYieldPct) - parseFloat(a.netYieldPct));

    // Cap at max concurrent opportunities
    return filtered.slice(0, this.carryConfig.maxConcurrentOpportunities);
  }

  /**
   * Generate OrderIntents for each approved opportunity.
   *
   * Computes position size from the carry config and sleeve NAV.
   */
  private async generateIntents(
    opportunities: CarryOpportunityCandidate[],
    portfolioState: PortfolioState,
  ): Promise<OrderIntent[]> {
    const intents: OrderIntent[] = [];

    const sleeveNav =
      portfolioState.sleeveNav.get(this.config.sleeveId) ?? portfolioState.totalNav;

    const sleeveNavUsd = new Decimal(sleeveNav);
    let plannedGrossExposureUsd = new Decimal(portfolioState.grossExposure);
    let plannedOpenPositions = portfolioState.openPositionCount;

    for (const opp of opportunities) {
      const currentExposurePct = sleeveNavUsd.isZero()
        ? '0'
        : plannedGrossExposureUsd.div(sleeveNavUsd).times(100).toFixed(4);
      const targetSizeUsd = computePositionSize({
        sleeveNav,
        expectedYieldPct: opp.expectedAnnualYieldPct,
        confidenceScore: opp.confidenceScore,
        config: this.carryConfig,
        currentExposurePct,
      });
      const maxAllowedSizeUsd = computeMaxAllowedSize({
        sleeveNav,
        currentPositions: plannedOpenPositions,
        config: this.carryConfig,
      });
      const positionSizeUsd = Decimal.min(
        new Decimal(targetSizeUsd),
        new Decimal(maxAllowedSizeUsd),
      ).toFixed(2);

      if (parseFloat(positionSizeUsd) <= 0) {
        this.logger.debug('StrategyPipeline.generateIntents: zero size, skipping', {
          asset: opp.asset,
          type: opp.type,
        });
        continue;
      }

      const legIntents = buildIntentsFromOpportunity(opp, this.config.sleeveId, positionSizeUsd);
      intents.push(...legIntents);
      plannedGrossExposureUsd = plannedGrossExposureUsd.plus(positionSizeUsd);
      plannedOpenPositions += 1;
    }

    return intents;
  }

  /**
   * Run risk checks on all generated intents.
   *
   * Returns each intent paired with its approval status and risk assessment.
   */
  private async runRiskChecks(
    intents: OrderIntent[],
    portfolioState: PortfolioState,
  ): Promise<Array<{ intent: OrderIntent; approved: boolean; assessment: RiskAssessment }>> {
    const results: Array<{ intent: OrderIntent; approved: boolean; assessment: RiskAssessment }> =
      [];

    for (const intent of intents) {
      const positionSizeUsd = String(intent.metadata['positionSizeUsd'] ?? '1000');

      const context = {
        intent,
        venueId: intent.venueId,
        assetSymbol: intent.asset,
        positionSizeUsd,
        deltaUsd: intent.side === 'buy' ? positionSizeUsd : `-${positionSizeUsd}`,
        requiredMarginUsd: positionSizeUsd, // 1x margin for carry (not leveraged)
        lastPriceUpdate: new Date(),
      };

      const assessment = this.riskEngine.assessOrderIntent(context, portfolioState);
      const approved = assessment.overallStatus !== 'failed';

      if (!approved) {
        this.logger.warn('StrategyPipeline.runRiskChecks: intent rejected by risk engine', {
          intentId: intent.intentId,
          overallStatus: assessment.overallStatus,
          failedChecks: assessment.results
            .filter((r) => r.status === 'failed')
            .map((r) => r.checkName),
        });
      }

      results.push({ intent, approved, assessment });
    }

    return results;
  }

  /**
   * Execute approved intents.
   *
   * In 'dry-run' mode: logs the intent and emits an audit event without
   * submitting any order.
   * In 'live' mode: submits each intent to the appropriate venue adapter.
   */
  private async executeIntents(approved: OrderIntent[]): Promise<void> {
    if (this.config.mode === 'live' && this.config.allowLiveExecution !== true) {
      throw new Error(
        'StrategyPipeline.executeIntents: live execution is disabled. ' +
          'Set allowLiveExecution=true to permit venue order submission.',
      );
    }

    for (const intent of approved) {
      if (this.config.mode === 'dry-run') {
        this.logger.info('StrategyPipeline.executeIntents [dry-run]: would submit order', {
          intentId: intent.intentId,
          venueId: intent.venueId,
          asset: intent.asset,
          side: intent.side,
          size: intent.size,
          opportunityId: intent.opportunityId,
        });

        await this.auditWriter.write({
          eventId: crypto.randomUUID(),
          eventType: 'pipeline.intent_dry_run',
          occurredAt: new Date().toISOString(),
          actorType: 'system',
          actorId: 'strategy-pipeline',
          sleeveId: this.config.sleeveId,
          data: {
            intentId: intent.intentId,
            venueId: intent.venueId,
            asset: intent.asset,
            side: intent.side,
            size: intent.size,
            type: intent.type,
            opportunityId: intent.opportunityId,
          },
        });
      } else {
        // Live mode: submit to the venue adapter
        const adapter = this.adapters.get(intent.venueId);
        if (adapter === undefined) {
          this.logger.error('StrategyPipeline.executeIntents: no adapter for venue', {
            venueId: intent.venueId,
            intentId: intent.intentId,
          });
          continue;
        }

        try {
          const placeOrderParams = {
            clientOrderId: intent.intentId,
            asset: intent.asset,
            side: intent.side,
            type: intent.type,
            size: intent.size,
            reduceOnly: intent.reduceOnly,
            ...(intent.limitPrice !== null ? { price: intent.limitPrice } : {}),
          };

          const orderResult = await adapter.placeOrder(placeOrderParams);

          this.logger.info('StrategyPipeline.executeIntents: order submitted', {
            intentId: intent.intentId,
            venueOrderId: orderResult.venueOrderId,
            status: orderResult.status,
            filledSize: orderResult.filledSize,
          });

          await this.auditWriter.write({
            eventId: crypto.randomUUID(),
            eventType: 'pipeline.order_submitted',
            occurredAt: new Date().toISOString(),
            actorType: 'system',
            actorId: 'strategy-pipeline',
            sleeveId: this.config.sleeveId,
            data: {
              intentId: intent.intentId,
              venueOrderId: orderResult.venueOrderId,
              status: orderResult.status,
              filledSize: orderResult.filledSize,
              averageFillPrice: orderResult.averageFillPrice,
              fees: orderResult.fees,
            },
          });
        } catch (error) {
          this.logger.error('StrategyPipeline.executeIntents: order submission failed', {
            intentId: intent.intentId,
            venueId: intent.venueId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
}
