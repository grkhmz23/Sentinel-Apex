import Decimal from 'decimal.js';

import { DEFAULT_CARRY_CONFIG, type CarryOpportunityCandidate } from '@sentinel-apex/carry';
import {
  applyMigrations,
  createDatabaseConnection,
  type DatabaseConnection,
} from '@sentinel-apex/db';
import { createId, type OrderFill } from '@sentinel-apex/domain';
import { OrderExecutor, type OrderRecord } from '@sentinel-apex/execution';
import { createLogger, registry, type Logger } from '@sentinel-apex/observability';
import {
  CircuitBreakerRegistry,
  DEFAULT_RISK_LIMITS,
  RiskEngine,
  type RiskLimits,
} from '@sentinel-apex/risk-engine';
import {
  PortfolioStateTracker,
  StrategyPipeline,
  type PipelineConfig,
} from '@sentinel-apex/strategy-engine';
import {
  DEFAULT_TREASURY_POLICY,
  TreasuryExecutionPlanner,
  TreasuryPolicyEngine,
  type TreasuryPolicy,
  type TreasuryRecommendation,
  type TreasuryVenueSnapshot,
} from '@sentinel-apex/treasury';
import {
  SimulatedVenueAdapter,
  SimulatedTreasuryVenueAdapter,
  type SimulatedVenueConfig,
  type SimulatedTreasuryVenueConfig,
  type TreasuryVenueAdapter,
  type TreasuryVenueCapabilities,
  type VenueAdapter,
  type VenuePosition,
} from '@sentinel-apex/venue-adapters';

import { RuntimeHealthMonitor } from './health-monitor.js';
import { RuntimeReconciliationEngine } from './reconciliation-engine.js';
import { DatabaseAuditWriter, RuntimeOrderStore, RuntimeStore } from './store.js';

import type {
  AuditEventView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RiskBreachView,
  RuntimeLifecycleState,
  RuntimeReconciliationRunView,
  RiskSummaryView,
  RuntimeCycleOutcome,
  RuntimeStatusView,
  TreasurySummaryView,
} from './types.js';

function severityForRiskStatus(status: string): string {
  switch (status) {
    case 'failed':
      return 'high';
    case 'warning':
      return 'medium';
    default:
      return 'low';
  }
}

function buildOpportunityId(opportunity: CarryOpportunityCandidate): string {
  return `${opportunity.asset}-${opportunity.type}-${opportunity.detectedAt.getTime()}`;
}

function buildPositionViews(
  sleeveId: string,
  venuePositions: VenuePosition[],
): PositionView[] {
  return venuePositions.map((position) => ({
    id: createId(),
    sleeveId,
    venueId: position.venueId,
    asset: position.asset,
    side: position.side,
    size: position.size,
    entryPrice: position.entryPrice,
    markPrice: position.markPrice,
    unrealizedPnl: position.unrealizedPnl,
    realizedPnl: '0',
    fundingAccrued: '0',
    hedgeState: 'hedged',
    status: 'open',
    openedAt: position.updatedAt.toISOString(),
    closedAt: null,
    updatedAt: position.updatedAt.toISOString(),
  }));
}

export interface DeterministicRuntimeScenario {
  sleeveId?: string;
  executionMode?: 'dry-run' | 'live';
  liveExecutionEnabled?: boolean;
  carryConfig?: Partial<typeof DEFAULT_CARRY_CONFIG>;
  treasuryPolicy?: Partial<TreasuryPolicy>;
  riskLimits?: Partial<RiskLimits>;
  pipelineConfig?: Partial<PipelineConfig>;
  venues?: SimulatedVenueConfig[];
  treasuryVenues?: SimulatedTreasuryVenueConfig[];
}

export interface SentinelRuntimeOptions {
  connection: DatabaseConnection;
  store: RuntimeStore;
  pipeline: StrategyPipeline;
  portfolioTracker: PortfolioStateTracker;
  riskEngine: RiskEngine;
  riskLimits: RiskLimits;
  adapters: Map<string, VenueAdapter>;
  treasuryAdapters: Map<string, TreasuryVenueAdapter>;
  treasuryPolicyEngine: TreasuryPolicyEngine;
  treasuryExecutionPlanner: TreasuryExecutionPlanner;
  treasuryPolicy: TreasuryPolicy;
  executionMode: 'dry-run' | 'live';
  liveExecutionEnabled: boolean;
  sleeveId: string;
  logger: Logger;
}

export class SentinelRuntime {
  private started = false;
  private closed = false;
  private readonly healthMonitor: RuntimeHealthMonitor;
  private readonly reconciliationEngine: RuntimeReconciliationEngine;

  constructor(private readonly options: SentinelRuntimeOptions) {
    this.healthMonitor = new RuntimeHealthMonitor(this.options.store);
    this.reconciliationEngine = new RuntimeReconciliationEngine(
      this.options.store,
      this.options.adapters,
      this.options.logger,
    );
  }

  static async createDeterministic(
    connectionString: string,
    overrides: DeterministicRuntimeScenario = {},
  ): Promise<SentinelRuntime> {
    const sleeveId = overrides.sleeveId ?? 'carry';
    const executionMode = overrides.executionMode ?? 'dry-run';
    const liveExecutionEnabled = overrides.liveExecutionEnabled ?? false;
    const logger = createLogger('runtime');

    const defaultVenues: SimulatedVenueConfig[] = overrides.venues ?? [
      {
        venueId: 'sim-venue-a',
        venueType: 'cex',
        makerFeePct: '0.0002',
        takerFeePct: '0.0005',
        slippagePct: '0.0001',
        initialBalances: { USDC: '100000' },
        deterministicPrices: { BTC: '100000', ETH: '3000' },
        deterministicFundingRates: { BTC: '0.00006', ETH: '0.00003' },
      },
      {
        venueId: 'sim-venue-b',
        venueType: 'cex',
        makerFeePct: '0.0002',
        takerFeePct: '0.0005',
        slippagePct: '0.0001',
        initialBalances: { USDC: '100000' },
        deterministicPrices: { BTC: '100180', ETH: '3008' },
        deterministicFundingRates: { BTC: '-0.00002', ETH: '0.00001' },
      },
    ];
    const defaultTreasuryVenues: SimulatedTreasuryVenueConfig[] = overrides.treasuryVenues ?? [
      {
        venueId: 'atlas-t0-sim',
        venueName: 'Atlas Treasury T0',
        liquidityTier: 'instant',
        aprBps: 385,
        availableCapacityUsd: '500000',
        currentAllocationUsd: '15000',
        withdrawalAvailableUsd: '15000',
      },
      {
        venueId: 'atlas-t1-sim',
        venueName: 'Atlas Treasury T1',
        liquidityTier: 'same_day',
        aprBps: 465,
        availableCapacityUsd: '750000',
        currentAllocationUsd: '5000',
        withdrawalAvailableUsd: '5000',
      },
    ];

    const adapters = new Map<string, VenueAdapter>();
    for (const venue of defaultVenues) {
      const adapter = new SimulatedVenueAdapter(venue);
      adapters.set(venue.venueId, adapter);
    }
    const treasuryAdapters = new Map<string, TreasuryVenueAdapter>();
    for (const venue of defaultTreasuryVenues) {
      const adapter = new SimulatedTreasuryVenueAdapter(venue);
      treasuryAdapters.set(venue.venueId, adapter);
    }

    const connection = await createDatabaseConnection(connectionString);
    await applyMigrations(connection);
    const auditWriter = new DatabaseAuditWriter(connection.db);
    const store = new RuntimeStore(connection.db, auditWriter);

    const effectiveRiskLimits = {
      ...DEFAULT_RISK_LIMITS,
      maxSingleVenuePct: 100,
      maxSingleAssetPct: 100,
      ...(overrides.riskLimits ?? {}),
    };

    const riskEngine = new RiskEngine(
      effectiveRiskLimits,
      new CircuitBreakerRegistry(effectiveRiskLimits),
    );

    const carryConfig = {
      ...DEFAULT_CARRY_CONFIG,
      sleeveId,
      approvedVenues: Array.from(adapters.keys()),
      approvedAssets: ['BTC'],
      minAnnualYieldPct: '2.0',
      minFundingRateAnnualized: '4.0',
      minCrossVenueSpreadPct: '0.15',
      ...(overrides.carryConfig ?? {}),
    };

    const pipeline = new StrategyPipeline(
      {
        mode: executionMode,
        allowLiveExecution: liveExecutionEnabled,
        sleeveId,
        scanIntervalMs: 0,
        maxIterations: 1,
        ...(overrides.pipelineConfig ?? {}),
      },
      adapters,
      riskEngine,
      carryConfig,
      logger,
      auditWriter,
      registry,
    );

    const portfolioTracker = new PortfolioStateTracker(adapters, logger, sleeveId);
    const treasuryPolicy = {
      ...DEFAULT_TREASURY_POLICY,
      ...(overrides.treasuryPolicy ?? {}),
      eligibleVenues: overrides.treasuryPolicy?.eligibleVenues ?? Array.from(treasuryAdapters.keys()),
    } satisfies TreasuryPolicy;

    await store.ensureRuntimeState(
      executionMode,
      liveExecutionEnabled,
      effectiveRiskLimits as unknown as Record<string, unknown>,
    );

    const runtime = new SentinelRuntime({
      connection,
      store,
      pipeline,
      portfolioTracker,
      riskEngine,
      riskLimits: effectiveRiskLimits,
      adapters,
      treasuryAdapters,
      treasuryPolicyEngine: new TreasuryPolicyEngine(),
      treasuryExecutionPlanner: new TreasuryExecutionPlanner(),
      treasuryPolicy,
      executionMode,
      liveExecutionEnabled,
      sleeveId,
      logger,
    });

    await runtime.start('runtime-bootstrap');
    return runtime;
  }

  get riskLimits(): RiskLimits {
    return this.options.riskLimits;
  }

  async start(actorId = 'runtime-bootstrap'): Promise<RuntimeStatusView> {
    if (this.closed) {
      throw new Error('SentinelRuntime.start: runtime has already been closed');
    }

    if (this.started) {
      return this.getRuntimeStatus();
    }

    const now = new Date();
    await this.options.store.updateRuntimeStatus({
      lifecycleState: 'starting',
      startedAt: now,
      stoppedAt: null,
      lastError: null,
      lastUpdatedBy: actorId,
    });

    for (const adapter of this.options.adapters.values()) {
      if (!adapter.isConnected()) {
        await adapter.connect();
      }
    }
    for (const adapter of this.options.treasuryAdapters.values()) {
      if (!adapter.isConnected()) {
        await adapter.connect();
      }
    }

    await this.rebuildProjections(actorId, false);

    const currentStatus = await this.options.store.getRuntimeStatus();
    const lifecycleState: RuntimeLifecycleState = currentStatus.halted ? 'paused' : 'ready';
    await this.options.store.updateRuntimeStatus({
      lifecycleState,
      readyAt: new Date(),
      lastUpdatedBy: actorId,
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.started',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId,
      sleeveId: this.options.sleeveId,
      data: { lifecycleState },
    });

    this.started = true;
    return this.getRuntimeStatus();
  }

  async runCycle(triggerSource = 'api-dev-trigger'): Promise<RuntimeCycleOutcome> {
    if (!this.started) {
      await this.start('runtime-autostart');
    }

    const runtimeStatus = await this.options.store.getRuntimeStatus();
    if (runtimeStatus.halted || runtimeStatus.lifecycleState === 'paused') {
      throw new Error(`Runtime is paused: ${runtimeStatus.reason ?? 'no reason provided'}`);
    }
    if (runtimeStatus.lifecycleState === 'stopped') {
      throw new Error('Runtime is stopped and cannot process cycles');
    }

    const runId = createId();
    const cycleStartedAt = new Date();
    await this.options.store.createStrategyRun({
      runId,
      sleeveId: this.options.sleeveId,
      executionMode: this.options.executionMode,
      triggerSource,
      metadata: {
        liveExecutionEnabled: this.options.liveExecutionEnabled,
      },
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.cycle_started',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId: 'sentinel-runtime',
      sleeveId: this.options.sleeveId,
      data: { runId, triggerSource },
    });

    await this.options.store.updateRuntimeStatus({
      lifecycleState: 'ready',
      projectionStatus: 'stale',
      lastRunId: runId,
      lastRunStatus: 'running',
      lastCycleStartedAt: cycleStartedAt,
      lastUpdatedBy: 'sentinel-runtime',
    });

    try {
      const portfolioState = await this.options.portfolioTracker.refresh();
      const planned = await this.options.pipeline.planCycle(portfolioState);
      const approvedOpportunityIds = new Set(
        planned.opportunitiesApproved.map((opportunity) => buildOpportunityId(opportunity)),
      );

      for (const opportunity of planned.opportunitiesDetected) {
        const opportunityId = buildOpportunityId(opportunity);
        await this.options.store.persistOpportunity({
          opportunityId,
          runId,
          sleeveId: this.options.sleeveId,
          asset: opportunity.asset,
          opportunityType: opportunity.type,
          expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
          netYieldPct: opportunity.netYieldPct,
          confidenceScore: String(opportunity.confidenceScore),
          detectedAt: opportunity.detectedAt.toISOString(),
          expiresAt: opportunity.expiresAt.toISOString(),
          approved: approvedOpportunityIds.has(opportunityId),
          payload: opportunity as unknown as Record<string, unknown>,
        });
      }

      for (const riskResult of planned.riskResults) {
        const intent = {
          ...riskResult.intent,
          metadata: {
            ...riskResult.intent.metadata,
            runId,
            executionMode: this.options.executionMode,
            sleeveId: this.options.sleeveId,
          },
        };

        await this.options.store.persistIntent({
          runId,
          intent,
          approved: riskResult.approved,
          riskAssessment: riskResult.assessment,
          executionDisposition: riskResult.approved ? 'paper-executed' : 'risk-rejected',
        });

        if (!riskResult.approved) {
          for (const check of riskResult.assessment.results.filter((result) => result.status !== 'passed')) {
            await this.options.store.persistRiskBreach({
              id: createId(),
              breachType: check.checkName,
              severity: severityForRiskStatus(check.status),
              description: check.message,
              triggeredAt: riskResult.assessment.timestamp.toISOString(),
              resolvedAt: null,
              details: {
                intentId: intent.intentId,
                opportunityId: intent.opportunityId,
                limit: check.limit,
                actual: check.actual,
              },
            });
          }
        }
      }

      const riskSummary = this.options.riskEngine.getRiskSummary(portfolioState);
      await this.options.store.persistRiskSnapshot({
        runId,
        sleeveId: this.options.sleeveId,
        summary: riskSummary,
        approvedIntentCount: planned.approvedIntents.length,
        rejectedIntentCount: planned.rejectedIntents.length,
        capturedAt: new Date(),
      });

      let intentsExecuted = 0;

      for (const approvedIntent of planned.approvedIntents) {
        const intent = {
          ...approvedIntent,
          metadata: {
            ...approvedIntent.metadata,
            runId,
            executionMode: this.options.executionMode,
            sleeveId: this.options.sleeveId,
          },
        };
        const adapter = this.options.adapters.get(intent.venueId);
        if (adapter === undefined) {
          continue;
        }

        const orderStore = new RuntimeOrderStore(this.options.store.db);
        const executor = new OrderExecutor(
          adapter,
          orderStore,
          {
            maxRetries: 0,
            retryDelayMs: 0,
            orderTimeoutMs: 1000,
          },
          this.options.logger,
          this.options.store.auditWriter,
        );

        const orderRecord = await executor.submitIntent(intent);
        await this.persistExecutionRecord(runId, orderRecord);
        intentsExecuted += 1;
      }

      const refreshedPortfolio = await this.options.portfolioTracker.refresh();
      await this.runTreasuryEvaluation({
        actorId: 'sentinel-runtime',
        sourceRunId: runId,
        portfolioState: refreshedPortfolio,
      });
      const finalRiskSummary = this.options.riskEngine.getRiskSummary(refreshedPortfolio);
      const cumulativePnl = await this.computeCumulativePnl();
      const dailyPnl = cumulativePnl;

      await this.options.store.persistPortfolioSnapshot({
        sourceRunId: runId,
        snapshotAt: new Date(),
        portfolioState: refreshedPortfolio,
        riskSummary: finalRiskSummary,
        dailyPnl,
        cumulativePnl,
      });

      const latestPositions = await this.collectPositions();
      await this.options.store.syncPositions(latestPositions);

      await this.options.store.completeStrategyRun({
        runId,
        status: 'completed',
        opportunitiesDetected: planned.opportunitiesDetected.length,
        opportunitiesApproved: planned.opportunitiesApproved.length,
        intentsGenerated: planned.intentsGenerated.length,
        intentsApproved: planned.approvedIntents.length,
        intentsRejected: planned.rejectedIntents.length,
        intentsExecuted,
      });

      await this.options.store.updateRuntimeStatus({
        lastRunId: runId,
        lastRunStatus: 'completed',
        lastSuccessfulRunId: runId,
        lastCycleCompletedAt: new Date(),
        lastProjectionSourceRunId: runId,
        projectionStatus: 'fresh',
        lastError: null,
        reason: null,
        lastUpdatedBy: 'sentinel-runtime',
      });

      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.cycle_completed',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: 'sentinel-runtime',
        sleeveId: this.options.sleeveId,
        data: {
          runId,
          opportunitiesDetected: planned.opportunitiesDetected.length,
          opportunitiesApproved: planned.opportunitiesApproved.length,
          intentsGenerated: planned.intentsGenerated.length,
          intentsApproved: planned.approvedIntents.length,
          intentsRejected: planned.rejectedIntents.length,
          intentsExecuted,
        },
      });

      await this.healthMonitor.resolveRuntimeFailure('sentinel-runtime', runId);
      await this.runReconciliation({
        trigger: 'post_cycle',
        sourceComponent: 'sentinel-runtime',
        triggerReference: runId,
      });

      return {
        runId,
        opportunitiesDetected: planned.opportunitiesDetected.length,
        opportunitiesApproved: planned.opportunitiesApproved.length,
        intentsGenerated: planned.intentsGenerated.length,
        intentsApproved: planned.approvedIntents.length,
        intentsRejected: planned.rejectedIntents.length,
        intentsExecuted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.options.store.completeStrategyRun({
        runId,
        status: 'failed',
        opportunitiesDetected: 0,
        opportunitiesApproved: 0,
        intentsGenerated: 0,
        intentsApproved: 0,
        intentsRejected: 0,
        intentsExecuted: 0,
        errorMessage: message,
      });

      await this.options.store.updateRuntimeStatus({
        lastRunId: runId,
        lastRunStatus: 'failed',
        lastCycleCompletedAt: new Date(),
        lifecycleState: 'degraded',
        projectionStatus: 'stale',
        lastError: message,
        reason: message,
        lastUpdatedBy: 'sentinel-runtime',
      });

      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.cycle_failed',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: 'sentinel-runtime',
        sleeveId: this.options.sleeveId,
        data: { runId, error: message },
      });

      await this.healthMonitor.recordRuntimeFailure('sentinel-runtime', runId, message);

      throw error;
    }
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryView | null> {
    return this.options.store.getPortfolioSummary();
  }

  async listPortfolioSnapshots(limit = 20): Promise<PortfolioSnapshotView[]> {
    return this.options.store.listPortfolioSnapshots(limit);
  }

  async getPnlSummary(): Promise<PnlSummaryView> {
    return this.options.store.getPnlSummary();
  }

  async getRiskSummary(): Promise<RiskSummaryView | null> {
    return this.options.store.getRiskSummary();
  }

  async listRiskBreaches(limit = 50): Promise<RiskBreachView[]> {
    return this.options.store.listRiskBreaches(limit);
  }

  async listOrders(limit = 100): Promise<OrderView[]> {
    return this.options.store.listOrders(limit);
  }

  async getOrder(clientOrderId: string): Promise<OrderView | null> {
    return this.options.store.getOrder(clientOrderId);
  }

  async listPositions(limit = 100): Promise<PositionView[]> {
    return this.options.store.listPositions(limit);
  }

  async getPosition(id: string): Promise<PositionView | null> {
    return this.options.store.getPosition(id);
  }

  async listOpportunities(limit = 100): Promise<OpportunityView[]> {
    return this.options.store.listOpportunities(limit);
  }

  async listRecentEvents(limit = 100): Promise<AuditEventView[]> {
    return this.options.store.listRecentEvents(limit);
  }

  async getRuntimeStatus(): Promise<RuntimeStatusView> {
    return this.options.store.getRuntimeStatus();
  }

  async getTreasurySummary(): Promise<TreasurySummaryView | null> {
    return this.options.store.getTreasurySummary();
  }

  async rebuildProjections(
    actorId = 'runtime-rebuild',
    emitAuditEvent = true,
  ): Promise<RuntimeStatusView> {
    const now = new Date();
    await this.options.store.updateRuntimeStatus({
      projectionStatus: 'rebuilding',
      lifecycleState: this.started ? 'starting' : 'starting',
      lastUpdatedBy: actorId,
    });

    await this.restoreAdaptersFromPersistence();

    const latestPortfolioSnapshot = await this.options.store.getLatestPortfolioSnapshotRow();
    if (latestPortfolioSnapshot !== null) {
      await this.options.store.replacePortfolioCurrentFromSnapshot(latestPortfolioSnapshot);
    }

    const latestRiskSnapshot = await this.options.store.getLatestRiskSnapshotRow();
    if (latestRiskSnapshot !== null) {
      await this.options.store.replaceRiskCurrentFromSnapshot(latestRiskSnapshot);
    }

    const latestPositions = await this.collectPositions();
    await this.options.store.syncPositions(latestPositions);

    const currentStatus = await this.options.store.getRuntimeStatus();
    const lastSuccessfulRunId = await this.options.store.getLatestSuccessfulRunId();
    const lifecycleState: RuntimeLifecycleState = currentStatus.halted ? 'paused' : 'ready';
    await this.options.store.updateRuntimeStatus({
      lifecycleState,
      projectionStatus: 'fresh',
      lastProjectionRebuildAt: now,
      lastProjectionSourceRunId: lastSuccessfulRunId,
      lastUpdatedBy: actorId,
    });

    if (emitAuditEvent) {
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.projections_rebuilt',
        occurredAt: now.toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: this.options.sleeveId,
        data: {
          lastProjectionSourceRunId: lastSuccessfulRunId,
          positionCount: latestPositions.length,
        },
      });
    }

    await this.runReconciliation({
      trigger: emitAuditEvent ? 'projection_rebuild' : 'runtime_startup',
      sourceComponent: 'sentinel-runtime',
      triggerReference: lastSuccessfulRunId,
    });

    return this.getRuntimeStatus();
  }

  async runReconciliation(input: {
    trigger: string;
    sourceComponent: string;
    triggerReference?: string | null;
    triggeredBy?: string | null;
  }): Promise<RuntimeReconciliationRunView> {
    const result = await this.reconciliationEngine.run({
      trigger: input.trigger,
      sourceComponent: input.sourceComponent,
      triggerReference: input.triggerReference ?? null,
      triggeredBy: input.triggeredBy ?? null,
    });
    return result.run;
  }

  async runTreasuryEvaluation(input: {
    actorId: string;
    sourceRunId?: string | null;
    portfolioState?: Awaited<ReturnType<PortfolioStateTracker['refresh']>>;
    idleCapitalUsdOverride?: string | null;
  }): Promise<TreasurySummaryView> {
    const portfolioState = input.portfolioState ?? await this.options.portfolioTracker.refresh();
    const venueSnapshots = await this.collectTreasuryVenueSnapshots();
    const venueCapabilities = await this.collectTreasuryVenueCapabilities();
    const persistedCashBalanceUsd = await this.options.store.getTreasuryCashBalanceUsd();
    const evaluation = this.options.treasuryPolicyEngine.evaluate({
      totalNavUsd: portfolioState.totalNav,
      idleCapitalUsd: input.idleCapitalUsdOverride
        ?? persistedCashBalanceUsd
        ?? portfolioState.liquidityReserve,
      venueSnapshots,
      policy: this.options.treasuryPolicy,
    });
    const executionIntents = this.options.treasuryExecutionPlanner.createExecutionIntents({
      evaluation,
      policy: this.options.treasuryPolicy,
      executionMode: this.options.executionMode,
      liveExecutionEnabled: this.options.liveExecutionEnabled,
      venueCapabilities,
    });
    const treasuryRunId = createId();

    await this.options.store.persistTreasuryEvaluation({
      treasuryRunId,
      sourceRunId: input.sourceRunId ?? null,
      sleeveId: 'treasury',
      policy: this.options.treasuryPolicy,
      evaluation,
      executionIntents,
      venueCapabilities,
      actorId: input.actorId,
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'treasury.evaluated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'treasury',
      data: {
        treasuryRunId,
        sourceRunId: input.sourceRunId ?? null,
        actionCount: evaluation.recommendations.length,
        reserveShortfallUsd: evaluation.reserveStatus.reserveShortfallUsd,
        surplusCapitalUsd: evaluation.reserveStatus.surplusCapitalUsd,
      },
    });

    const summary = await this.options.store.getTreasurySummary();
    if (summary === null) {
      throw new Error(`SentinelRuntime.runTreasuryEvaluation: treasury run "${treasuryRunId}" was not persisted`);
    }

    return summary;
  }

  async executeTreasuryAction(input: {
    actionId: string;
    actorId: string;
    commandId: string | null;
    startedBy: string;
  }): Promise<{
    actionId: string;
    executionId: string;
    treasuryRunId: string | null;
    venueExecutionReference: string | null;
    simulated: boolean;
  }> {
    const detail = await this.options.store.getTreasuryAction(input.actionId);
    if (detail === null) {
      throw new Error(`Treasury action "${input.actionId}" was not found.`);
    }

    if (detail.action.status !== 'queued' && detail.action.status !== 'approved') {
      throw new Error(
        `Treasury action "${input.actionId}" is not executable from status "${detail.action.status}".`,
      );
    }

    const portfolioState = await this.options.portfolioTracker.refresh();
    const venueSnapshots = await this.collectTreasuryVenueSnapshots();
    const venueCapabilities = await this.collectTreasuryVenueCapabilities();
    const evaluation = this.options.treasuryPolicyEngine.evaluate({
      totalNavUsd: portfolioState.totalNav,
      idleCapitalUsd: portfolioState.liquidityReserve,
      venueSnapshots,
      policy: this.options.treasuryPolicy,
    });
    const recommendation: TreasuryRecommendation = {
      actionType: detail.action.actionType === 'allocate_to_venue' ? 'deposit' : 'redeem',
      venueId: detail.action.venueId,
      amountUsd: detail.action.amountUsd,
      reasonCode: detail.action.reasonCode as TreasuryRecommendation['reasonCode'],
      summary: detail.action.summary,
      details: detail.action.details,
    };
    const executionIntent = this.options.treasuryExecutionPlanner.createExecutionIntents({
      evaluation: {
        ...evaluation,
        recommendations: [recommendation],
      },
      policy: this.options.treasuryPolicy,
      executionMode: this.options.executionMode,
      liveExecutionEnabled: this.options.liveExecutionEnabled,
      venueCapabilities,
    })[0];

    if (executionIntent === undefined) {
      throw new Error(`Treasury action "${input.actionId}" could not be planned for execution.`);
    }

    const execution = await this.options.store.createTreasuryExecution({
      treasuryActionId: detail.action.id,
      treasuryRunId: detail.action.treasuryRunId,
      commandId: input.commandId,
      status: executionIntent.executable ? 'executing' : 'failed',
      executionMode: executionIntent.executionMode,
      venueMode: executionIntent.venueMode,
      simulated: executionIntent.simulated,
      requestedBy: input.actorId,
      startedBy: input.startedBy,
      blockedReasons: executionIntent.blockedReasons,
      outcome: {
        executionPlan: executionIntent.effects,
      },
      lastError: executionIntent.executable
        ? null
        : executionIntent.blockedReasons.map((reason) => reason.message).join('; '),
    });

    if (!executionIntent.executable) {
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: executionIntent.blockedReasons.map((reason) => reason.message).join('; '),
      });
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'treasury.execution_blocked',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'treasury',
        data: {
          treasuryActionId: detail.action.id,
          executionId: execution.id,
          blockedReasons: executionIntent.blockedReasons,
        },
      });
      throw new Error(executionIntent.blockedReasons.map((reason) => reason.message).join('; '));
    }

    await this.options.store.markTreasuryActionExecuting(detail.action.id);

    if (detail.action.venueId === null) {
      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'failed',
        lastError: 'Treasury action did not target a venue.',
      });
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: 'Treasury action did not target a venue.',
      });
      throw new Error('Treasury action did not target a venue.');
    }

    const adapter = this.options.treasuryAdapters.get(detail.action.venueId);
    if (adapter === undefined) {
      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'failed',
        lastError: `Treasury venue "${detail.action.venueId}" is not registered.`,
      });
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: `Treasury venue "${detail.action.venueId}" is not registered.`,
      });
      throw new Error(`Treasury venue "${detail.action.venueId}" is not registered.`);
    }

    try {
      const result = await adapter.executeTreasuryAction({
        actionType: detail.action.actionType,
        amountUsd: detail.action.amountUsd,
        actorId: input.actorId,
        reasonCode: detail.action.reasonCode,
        executionMode: detail.action.executionMode,
      });

      await this.options.store.setTreasuryCashBalanceUsd(executionIntent.effects.idleCapitalUsd);

      const followUpSummary = await this.runTreasuryEvaluation({
        actorId: input.actorId,
        sourceRunId: null,
        portfolioState,
        idleCapitalUsdOverride: executionIntent.effects.idleCapitalUsd,
      });

      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'completed',
        outcomeSummary: result.summary,
        outcome: {
          balanceDeltaUsd: result.balanceDeltaUsd,
          allocationUsd: result.allocationUsd,
          withdrawalAvailableUsd: result.withdrawalAvailableUsd,
          followUpTreasuryRunId: followUpSummary.treasuryRunId,
          metadata: result.metadata,
        },
        venueExecutionReference: result.executionReference,
        lastError: null,
      });
      await this.options.store.completeTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
      });
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'treasury.executed',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'treasury',
        data: {
          treasuryActionId: detail.action.id,
          executionId: execution.id,
          venueExecutionReference: result.executionReference,
          followUpTreasuryRunId: followUpSummary.treasuryRunId,
          simulated: result.simulated,
        },
      });

      return {
        actionId: detail.action.id,
        executionId: execution.id,
        treasuryRunId: followUpSummary.treasuryRunId,
        venueExecutionReference: result.executionReference,
        simulated: result.simulated,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'failed',
        lastError: message,
      });
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: message,
      });
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'treasury.execution_failed',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'treasury',
        data: {
          treasuryActionId: detail.action.id,
          executionId: execution.id,
          error: message,
        },
      });
      throw error;
    }
  }

  async activateKillSwitch(reason: string, actorId: string): Promise<RuntimeStatusView> {
    await this.options.store.updateRuntimeStatus({
      halted: true,
      lifecycleState: 'paused',
      reason,
      lastUpdatedBy: actorId,
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.kill_switch_activated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: this.options.sleeveId,
      data: { reason },
    });
    return this.getRuntimeStatus();
  }

  async resume(reason: string, actorId: string): Promise<RuntimeStatusView> {
    await this.options.store.updateRuntimeStatus({
      halted: false,
      lifecycleState: 'ready',
      reason,
      lastUpdatedBy: actorId,
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.resumed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: this.options.sleeveId,
      data: { reason },
    });
    return this.getRuntimeStatus();
  }

  async setExecutionMode(mode: 'dry-run'): Promise<RuntimeStatusView> {
    await this.options.store.updateRuntimeStatus({
      executionMode: mode,
      reason: null,
      lastUpdatedBy: 'api-control',
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.execution_mode_changed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: 'api-control',
      sleeveId: this.options.sleeveId,
      data: { mode },
    });
    return this.getRuntimeStatus();
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    await this.options.store.updateRuntimeStatus({
      lifecycleState: 'stopped',
      stoppedAt: new Date(),
      lastUpdatedBy: 'sentinel-runtime',
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.stopped',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId: 'sentinel-runtime',
      sleeveId: this.options.sleeveId,
      data: {},
    });
    for (const adapter of this.options.adapters.values()) {
      await adapter.disconnect();
    }
    for (const adapter of this.options.treasuryAdapters.values()) {
      await adapter.disconnect();
    }
    await this.options.connection.close();
    this.started = false;
    this.closed = true;
  }

  private async computeCumulativePnl(): Promise<string> {
    const positions = await this.collectPositions();
    const total = positions.reduce(
      (running, position) => running.plus(position.unrealizedPnl).plus(position.realizedPnl),
      new Decimal(0),
    );
    return total.toFixed(8);
  }

  private async collectPositions(): Promise<PositionView[]> {
    const positions: PositionView[] = [];
    for (const adapter of this.options.adapters.values()) {
      const venuePositions = await adapter.getPositions();
      positions.push(...buildPositionViews(this.options.sleeveId, venuePositions));
    }
    return positions;
  }

  private async restoreAdaptersFromPersistence(): Promise<void> {
    const fillHistory = await this.options.store.listFillHistory();
    const simulatedAdapters = Array.from(this.options.adapters.values()).filter(
      (adapter): adapter is SimulatedVenueAdapter => adapter instanceof SimulatedVenueAdapter,
    );

    for (const adapter of simulatedAdapters) {
      adapter.resetSimulationState();
    }

    for (const fill of fillHistory) {
      const adapter = this.options.adapters.get(fill.venueId);
      if (!(adapter instanceof SimulatedVenueAdapter)) {
        continue;
      }

      adapter.replayFilledOrder({
        venueOrderId: fill.venueOrderId,
        clientOrderId: fill.clientOrderId,
        asset: fill.asset,
        side: fill.side,
        size: fill.size,
        fillPrice: fill.price,
        fee: fill.fee,
        reduceOnly: fill.reduceOnly,
        submittedAt: fill.filledAt,
      });
    }
  }

  private async collectTreasuryVenueSnapshots(): Promise<TreasuryVenueSnapshot[]> {
    const snapshots: TreasuryVenueSnapshot[] = [];

    for (const adapter of this.options.treasuryAdapters.values()) {
      const [venueState, position] = await Promise.all([
        adapter.getVenueState(),
        adapter.getPosition(),
      ]);
      snapshots.push({
        venueId: venueState.venueId,
        venueName: venueState.venueName,
        mode: venueState.mode,
        liquidityTier: venueState.liquidityTier,
        healthy: venueState.healthy,
        aprBps: venueState.aprBps,
        availableCapacityUsd: venueState.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
        concentrationPct: '0.00',
        updatedAt: position.updatedAt,
        metadata: venueState.metadata,
      });
    }

    return snapshots;
  }

  private async collectTreasuryVenueCapabilities(): Promise<TreasuryVenueCapabilities[]> {
    const capabilities: TreasuryVenueCapabilities[] = [];

    for (const adapter of this.options.treasuryAdapters.values()) {
      capabilities.push(await adapter.getCapabilities());
    }

    return capabilities;
  }

  private async persistExecutionRecord(runId: string, record: OrderRecord): Promise<void> {
    await this.options.store.persistExecutionEvent({
      eventId: createId(),
      runId,
      intentId: record.intent.intentId,
      clientOrderId: record.intent.intentId,
      venueOrderId: record.venueOrderId,
      eventType: 'order.execution_recorded',
      status: record.status,
      payload: {
        filledSize: record.filledSize,
        averageFillPrice: record.averageFillPrice,
        feesPaid: record.feesPaid,
      },
      occurredAt: new Date(),
    });

    if (record.averageFillPrice === null || record.filledSize === '0') {
      return;
    }

    const fill: OrderFill = {
      fillId: `${record.intent.intentId}-fill-1`,
      orderId: record.intent.intentId as OrderFill['orderId'],
      filledSize: record.filledSize,
      fillPrice: record.averageFillPrice,
      fee: record.feesPaid ?? '0',
      feeAsset: record.intent.asset,
      filledAt: record.completedAt ?? record.submittedAt ?? new Date(),
    };

    await this.options.store.persistFill(record.intent.intentId, fill);
  }
}
