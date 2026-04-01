import Decimal from 'decimal.js';

import {
  DEFAULT_ALLOCATOR_POLICY,
  DEFAULT_REBALANCE_POLICY,
  SentinelAllocatorPolicyEngine,
  SentinelRebalancePlanner,
  SentinelSleeveRegistry,
  type AllocatorPolicyInput,
  type AllocatorSleeveSnapshot,
} from '@sentinel-apex/allocator';
import {
  CarryControlledExecutionPlanner,
  DEFAULT_CARRY_CONFIG,
  DEFAULT_CARRY_OPERATIONAL_POLICY,
  buildCarryReductionIntents,
  type CarryExecutionRecommendation,
  type CarryOpportunityCandidate,
  type CarryPositionSnapshot,
} from '@sentinel-apex/carry';
import {
  applyMigrations,
  createDatabaseConnection,
  type DatabaseConnection,
} from '@sentinel-apex/db';
import { createId, type OrderFill, type OrderIntent } from '@sentinel-apex/domain';
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
  DriftReadonlyTruthAdapter,
  SimulatedVenueAdapter,
  SimulatedTreasuryVenueAdapter,
  type SimulatedVenueConfig,
  type SimulatedTreasuryVenueConfig,
  type TreasuryVenueAdapter,
  type TreasuryVenueCapabilities,
  type VenueAdapter,
  type VenueCapabilitySnapshot,
  type VenuePosition,
  type VenueTruthAdapter,
  type VenueTruthSnapshot,
} from '@sentinel-apex/venue-adapters';

import { RuntimeHealthMonitor } from './health-monitor.js';
import {
  buildInternalDerivativeSnapshot,
  type InternalDerivativeTrackedVenueConfig,
} from './internal-derivative-state.js';
import { RuntimeReconciliationEngine } from './reconciliation-engine.js';
import { DatabaseAuditWriter, RuntimeOrderStore, RuntimeStore } from './store.js';

import type {
  AllocatorSummaryView,
  AuditEventView,
  CarryActionDetailView,
  CarryActionView,
  CarryExecutionDetailView,
  CarryExecutionView,
  CarryVenueView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  InternalDerivativeSnapshotView,
  PositionView,
  RiskBreachView,
  RebalanceExecutionGraphView,
  RebalanceExecutionTimelineEntry,
  RuntimeLifecycleState,
  RuntimeReconciliationRunView,
  RiskSummaryView,
  RuntimeCycleOutcome,
  RuntimeStatusView,
  TreasurySummaryView,
  VenueDetailView,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueInventoryItemView,
  VenueInventorySummaryView,
  VenueSnapshotView,
  VenueTruthComparisonCoverageView,
  VenueTruthProfile,
  VenueTruthSummaryView,
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

function toCarryPositionSnapshot(position: PositionView): CarryPositionSnapshot | null {
  if (position.side !== 'long' && position.side !== 'short') {
    return null;
  }

  const updatedAt = new Date(position.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return null;
  }

  return {
    positionId: position.id,
    venueId: position.venueId,
    asset: position.asset,
    side: position.side,
    size: position.size,
    markPrice: position.markPrice,
    updatedAt: updatedAt.toISOString(),
  };
}

function normaliseCarryOpportunityScore(opportunities: OpportunityView[]): number {
  if (opportunities.length === 0) {
    return 0;
  }

  const scored = opportunities.map((opportunity) => {
    const confidence = Number(opportunity.confidenceScore);
    const netYield = Number(opportunity.netYieldPct);
    const yieldScore = Number.isFinite(netYield)
      ? Math.max(0, Math.min(netYield / 10, 1))
      : 0;
    const confidenceScore = Number.isFinite(confidence)
      ? Math.max(0, Math.min(confidence, 1))
      : 0;

    return yieldScore * 0.6 + confidenceScore * 0.4;
  });

  return Number((scored.reduce((sum, value) => sum + value, 0) / scored.length).toFixed(4));
}

function deriveVenueTruthProfile(snapshot: VenueTruthSnapshot): VenueTruthProfile {
  if (
    snapshot.truthCoverage.derivativeAccountState.status !== 'unsupported'
    || snapshot.truthCoverage.derivativePositionState.status !== 'unsupported'
    || snapshot.truthCoverage.derivativeHealthState.status !== 'unsupported'
    || snapshot.truthCoverage.orderState.status !== 'unsupported'
  ) {
    return 'derivative_aware';
  }

  if (snapshot.truthCoverage.capacityState.status === 'available') {
    return 'capacity_only';
  }

  if (
    snapshot.truthCoverage.accountState.status === 'available'
    || snapshot.truthCoverage.balanceState.status === 'available'
    || snapshot.truthCoverage.exposureState.status === 'available'
    || snapshot.truthCoverage.executionReferences.status === 'available'
  ) {
    return 'generic_wallet';
  }

  return 'minimal';
}

function deriveVenueTruthComparisonCoverage(
  capability: VenueCapabilitySnapshot,
  snapshot: VenueTruthSnapshot,
): VenueTruthComparisonCoverageView {
  const connectorDepth = snapshot.sourceMetadata.connectorDepth
    ?? (capability.truthMode === 'simulated'
      ? 'simulation'
      : capability.executionSupport
        ? 'execution_capable'
        : capability.connectorType === 'drift_native_readonly'
          ? 'drift_native_readonly'
          : 'generic_rpc_readonly');
  const isDriftNativeReadonly = connectorDepth === 'drift_native_readonly';

  return {
    executionReferences: {
      status: snapshot.truthCoverage.executionReferences.status,
      reason: snapshot.truthCoverage.executionReferences.reason,
    },
    positionInventory: {
      status: 'unsupported',
      reason: isDriftNativeReadonly && snapshot.truthCoverage.derivativePositionState.status === 'available'
        ? 'Decoded Drift position inventory is visible, but the runtime does not yet persist venue-native Drift position projections for direct comparison.'
        : 'The runtime does not yet maintain a truthful internal position model that can be compared directly against this venue snapshot.',
    },
    healthState: {
      status: 'unsupported',
      reason: isDriftNativeReadonly && snapshot.truthCoverage.derivativeHealthState.status === 'available'
        ? 'Drift health and margin metrics are visible, but the runtime does not yet persist an internal canonical health model for direct comparison.'
        : 'No internal health-state model is available for direct reconciliation against this venue snapshot.',
    },
    orderInventory: {
      status: 'unsupported',
      reason: isDriftNativeReadonly && snapshot.truthCoverage.orderState.status === 'available'
        ? 'Decoded Drift open-order inventory is visible, but the runtime does not yet persist a venue-native open-order model for direct comparison.'
        : 'No venue-native internal open-order inventory is available for direct reconciliation against this venue snapshot.',
    },
    notes: isDriftNativeReadonly
      ? [
        'Decoded Drift account, position, health, and order sections are operator-visible venue truth.',
        'Current reconciliation directly compares internal execution references when they are available.',
      ]
      : connectorDepth === 'generic_rpc_readonly'
        ? [
          'This connector exposes generic read-only truth rather than venue-native Drift decode.',
          'Execution-reference comparison is the only direct real-venue reconciliation path currently available.',
        ]
        : connectorDepth === 'simulation'
          ? [
            'Simulated venue truth is generated internally and is not treated as external reconciliation coverage.',
          ]
          : [
            'This connector depth does not currently expose additional direct reconciliation coverage beyond the recorded truth sections.',
          ],
  };
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
  truthAdapters?: VenueTruthAdapter[];
  internalDerivativeTargets?: InternalDerivativeTrackedVenueConfig[];
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
  truthAdapters: Map<string, VenueTruthAdapter>;
  treasuryPolicyEngine: TreasuryPolicyEngine;
  treasuryExecutionPlanner: TreasuryExecutionPlanner;
  treasuryPolicy: TreasuryPolicy;
  executionMode: 'dry-run' | 'live';
  liveExecutionEnabled: boolean;
  sleeveId: string;
  internalDerivativeTargets: Map<string, InternalDerivativeTrackedVenueConfig>;
  logger: Logger;
}

export class SentinelRuntime {
  private started = false;
  private closed = false;
  private readonly healthMonitor: RuntimeHealthMonitor;
  private readonly reconciliationEngine: RuntimeReconciliationEngine;
  private readonly allocatorRegistry = new SentinelSleeveRegistry();
  private readonly allocatorPolicyEngine = new SentinelAllocatorPolicyEngine();
  private readonly rebalancePlanner = new SentinelRebalancePlanner();
  private readonly carryExecutionPlanner = new CarryControlledExecutionPlanner();

  constructor(private readonly options: SentinelRuntimeOptions) {
    this.healthMonitor = new RuntimeHealthMonitor(this.options.store);
    this.reconciliationEngine = new RuntimeReconciliationEngine(
      this.options.store,
      this.options.adapters,
      this.options.truthAdapters,
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
    const truthAdapters = new Map<string, VenueTruthAdapter>();
    for (const adapter of overrides.truthAdapters ?? []) {
      truthAdapters.set(adapter.venueId, adapter);
    }
    const internalDerivativeTargets = new Map<string, InternalDerivativeTrackedVenueConfig>(
      (overrides.internalDerivativeTargets ?? []).map((target) => [target.venueId, target] as const),
    );
    const driftRpcEndpoint = process.env['DRIFT_RPC_ENDPOINT'];
    if (
      !truthAdapters.has('drift-solana-readonly')
      && driftRpcEndpoint !== undefined
      && driftRpcEndpoint !== ''
    ) {
      const adapter = new DriftReadonlyTruthAdapter({
        venueId: 'drift-solana-readonly',
        venueName: 'Drift Solana Read-Only',
        rpcEndpoint: driftRpcEndpoint,
        ...(process.env['DRIFT_READONLY_ENV'] === undefined
          ? {}
          : { driftEnv: process.env['DRIFT_READONLY_ENV'] as 'devnet' | 'mainnet-beta' }),
        ...(process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] === undefined
          ? {}
          : { accountAddress: process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] === undefined
          ? {}
          : { authorityAddress: process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_READONLY_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_READONLY_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_READONLY_ACCOUNT_LABEL'] }),
      });
      truthAdapters.set(adapter.venueId, adapter);
    }
    if (
      !internalDerivativeTargets.has('drift-solana-readonly')
      && (
        (process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] !== undefined
          && process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] !== '')
        || (process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] !== undefined
          && process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] !== '')
      )
    ) {
      internalDerivativeTargets.set('drift-solana-readonly', {
        venueId: 'drift-solana-readonly',
        venueName: 'Drift Solana Read-Only',
        ...(process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] === undefined
          ? {}
          : { accountAddress: process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] === undefined
          ? {}
          : { authorityAddress: process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_READONLY_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_READONLY_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_READONLY_ACCOUNT_LABEL'] }),
      });
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
      truthAdapters,
      treasuryPolicyEngine: new TreasuryPolicyEngine(),
      treasuryExecutionPlanner: new TreasuryExecutionPlanner(),
      treasuryPolicy,
      executionMode,
      liveExecutionEnabled,
      sleeveId,
      internalDerivativeTargets,
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
    for (const adapter of this.options.truthAdapters.values()) {
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
      const treasurySummary = await this.runTreasuryEvaluation({
        actorId: 'sentinel-runtime',
        sourceRunId: runId,
        portfolioState: refreshedPortfolio,
      });
      await this.runAllocatorEvaluation({
        trigger: 'post_cycle',
        actorId: 'sentinel-runtime',
        sourceRunId: runId,
        carryOpportunities: planned.opportunitiesApproved.map((opportunity) => ({
          opportunityId: buildOpportunityId(opportunity),
          runId,
          sleeveId: this.options.sleeveId,
          asset: opportunity.asset,
          opportunityType: opportunity.type,
          expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
          netYieldPct: opportunity.netYieldPct,
          confidenceScore: String(opportunity.confidenceScore),
          detectedAt: opportunity.detectedAt.toISOString(),
          expiresAt: opportunity.expiresAt.toISOString(),
          approved: true,
          payload: opportunity as unknown as Record<string, unknown>,
        })),
        treasurySummary,
        portfolioSummaryOverride: {
          totalNav: refreshedPortfolio.totalNav,
          grossExposure: refreshedPortfolio.grossExposure,
          netExposure: refreshedPortfolio.netExposure,
          liquidityReserve: refreshedPortfolio.liquidityReserve,
          openPositionCount: refreshedPortfolio.openPositionCount,
          dailyPnl: '0',
          cumulativePnl: '0',
          sleeves: [],
          venueExposures: Object.fromEntries(refreshedPortfolio.venueExposures.entries()),
          assetExposures: Object.fromEntries(refreshedPortfolio.assetExposures.entries()),
          updatedAt: new Date().toISOString(),
        },
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
      await this.refreshInternalDerivativeState({
        sourceComponent: 'sentinel-runtime',
        sourceRunId: runId,
        sourceReference: runId,
      });
      await this.refreshVenueTruthInventory();

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

  async getAllocatorSummary(): Promise<AllocatorSummaryView | null> {
    return this.options.store.getAllocatorSummary();
  }

  async getTreasurySummary(): Promise<TreasurySummaryView | null> {
    return this.options.store.getTreasurySummary();
  }

  async listCarryRecommendations(limit = 50): Promise<CarryActionView[]> {
    return this.options.store.listCarryRecommendations(limit);
  }

  async listCarryActions(limit = 50): Promise<CarryActionView[]> {
    return this.options.store.listCarryActions(limit);
  }

  async getCarryAction(actionId: string): Promise<CarryActionDetailView | null> {
    return this.options.store.getCarryAction(actionId);
  }

  async listCarryExecutions(limit = 50): Promise<CarryExecutionView[]> {
    return this.options.store.listCarryExecutions(limit);
  }

  async listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]> {
    return this.options.store.listCarryExecutionsForAction(actionId);
  }

  async getCarryExecution(executionId: string): Promise<CarryExecutionDetailView | null> {
    return this.options.store.getCarryExecution(executionId);
  }

  async getRebalanceExecutionGraph(proposalId: string): Promise<RebalanceExecutionGraphView | null> {
    return this.options.store.getRebalanceExecutionGraph(proposalId);
  }

  async getRebalanceTimeline(proposalId: string): Promise<RebalanceExecutionTimelineEntry[]> {
    return this.options.store.getRebalanceTimeline(proposalId);
  }

  async listCarryVenues(limit = 50): Promise<CarryVenueView[]> {
    return this.options.store.listCarryVenues(limit);
  }

  async listVenues(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.options.store.listVenues(limit);
  }

  async getVenue(venueId: string): Promise<VenueDetailView | null> {
    return this.options.store.getVenue(venueId);
  }

  async listVenueSnapshots(venueId: string, limit = 20): Promise<VenueSnapshotView[]> {
    return this.options.store.listVenueSnapshots(venueId, limit);
  }

  async getVenueInternalState(venueId: string): Promise<InternalDerivativeSnapshotView | null> {
    return this.options.store.getVenueInternalState(venueId);
  }

  async getVenueComparisonSummary(
    venueId: string,
  ): Promise<VenueDerivativeComparisonSummaryView | null> {
    return this.options.store.getVenueComparisonSummary(venueId);
  }

  async getVenueComparisonDetail(venueId: string): Promise<VenueDerivativeComparisonDetailView | null> {
    return this.options.store.getVenueComparisonDetail(venueId);
  }

  async getVenueSummary(): Promise<VenueInventorySummaryView> {
    return this.options.store.getVenueSummary();
  }

  async getVenueTruthSummary(): Promise<VenueTruthSummaryView> {
    return this.options.store.getVenueTruthSummary();
  }

  async listVenueReadiness(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.options.store.listVenueReadiness(limit);
  }

  private async collectCarryVenueViews(
    strategyRunId: string | null,
  ): Promise<Array<{
    strategyRunId: string | null;
    venueId: string;
    venueMode: 'simulated' | 'live';
    executionSupported: boolean;
    supportsIncreaseExposure: boolean;
    supportsReduceExposure: boolean;
    readOnly: boolean;
    approvedForLiveUse: boolean;
    healthy: boolean;
    onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
    missingPrerequisites: string[];
    metadata: Record<string, unknown>;
    updatedAt: string;
    createdAt: string;
  }>> {
    const now = new Date().toISOString();
    const views = [];

    for (const adapter of this.options.adapters.values()) {
      const capabilities = typeof adapter.getCarryCapabilities === 'function'
        ? await adapter.getCarryCapabilities()
        : {
          venueId: adapter.venueId,
          venueMode: 'simulated' as const,
          executionSupported: false,
          supportsIncreaseExposure: false,
          supportsReduceExposure: false,
          readOnly: true,
          approvedForLiveUse: false,
          healthy: true,
          onboardingState: 'read_only' as const,
          missingPrerequisites: ['carry_controlled_execution_not_implemented'],
          metadata: {
            venueType: adapter.venueType,
          },
        };

      views.push({
        strategyRunId,
        venueId: capabilities.venueId,
        venueMode: capabilities.venueMode,
        executionSupported: capabilities.executionSupported,
        supportsIncreaseExposure: capabilities.supportsIncreaseExposure,
        supportsReduceExposure: capabilities.supportsReduceExposure,
        readOnly: capabilities.readOnly,
        approvedForLiveUse: capabilities.approvedForLiveUse,
        healthy: capabilities.healthy,
        onboardingState: capabilities.onboardingState,
        missingPrerequisites: capabilities.missingPrerequisites,
        metadata: capabilities.metadata,
        updatedAt: now,
        createdAt: now,
      });
    }

    return views;
  }

  private async refreshVenueTruthInventory(): Promise<void> {
    const snapshots = await this.collectVenueTruthSnapshots();
    await this.options.store.persistVenueConnectorSnapshots({ snapshots });
  }

  private trackedInternalDerivativeVenues(): InternalDerivativeTrackedVenueConfig[] {
    const tracked = new Map<string, InternalDerivativeTrackedVenueConfig>(
      Array.from(this.options.internalDerivativeTargets.entries()),
    );

    for (const adapter of this.options.truthAdapters.values()) {
      if (!tracked.has(adapter.venueId)) {
        tracked.set(adapter.venueId, {
          venueId: adapter.venueId,
          venueName: adapter.venueName,
        });
      }
    }

    return Array.from(tracked.values());
  }

  private async refreshInternalDerivativeState(input: {
    sourceComponent: string;
    sourceRunId?: string | null;
    sourceReference?: string | null;
  }): Promise<void> {
    const trackedVenues = this.trackedInternalDerivativeVenues();
    if (trackedVenues.length === 0) {
      return;
    }

    const capturedAt = new Date().toISOString();
    const fillHistory = await this.options.store.listFillHistory();
    const snapshots = await Promise.all(
      trackedVenues.map(async (venue) => {
        const orders = await this.options.store.listOrdersByVenue(venue.venueId);
        return buildInternalDerivativeSnapshot({
          venue,
          orders,
          fills: fillHistory.filter((fill) => fill.venueId === venue.venueId),
          capturedAt,
          sourceComponent: input.sourceComponent,
          sourceRunId: input.sourceRunId ?? null,
          sourceReference: input.sourceReference ?? null,
        });
      }),
    );

    await this.options.store.persistInternalDerivativeSnapshots({ snapshots });
  }

  private async collectVenueTruthSnapshots(): Promise<VenueSnapshotView[]> {
    const snapshots: VenueSnapshotView[] = [];

    for (const adapter of this.options.adapters.values()) {
      const capability = await this.collectVenueCapabilityForCarryAdapter(adapter);
      const snapshot = await this.collectVenueTruthForCarryAdapter(adapter);
      snapshots.push(this.composeVenueSnapshot(capability, snapshot));
    }

    for (const adapter of this.options.treasuryAdapters.values()) {
      const capability = await this.collectVenueCapabilityForTreasuryAdapter(adapter);
      const snapshot = await this.collectVenueTruthForTreasuryAdapter(adapter);
      snapshots.push(this.composeVenueSnapshot(capability, snapshot));
    }

    for (const adapter of this.options.truthAdapters.values()) {
      const [capability, snapshot] = await Promise.all([
        adapter.getVenueCapabilitySnapshot(),
        adapter.getVenueTruthSnapshot(),
      ]);
      snapshots.push(this.composeVenueSnapshot(capability, snapshot));
    }

    return snapshots;
  }

  private composeVenueSnapshot(
    capability: VenueCapabilitySnapshot,
    snapshot: VenueTruthSnapshot,
  ): VenueSnapshotView {
    return {
      id: createId(),
      venueId: capability.venueId,
      venueName: capability.venueName,
      connectorType: capability.connectorType,
      sleeveApplicability: capability.sleeveApplicability,
      truthMode: capability.truthMode,
      readOnlySupport: capability.readOnlySupport,
      executionSupport: capability.executionSupport,
      approvedForLiveUse: capability.approvedForLiveUse,
      onboardingState: capability.onboardingState,
      missingPrerequisites: capability.missingPrerequisites,
      authRequirementsSummary: capability.authRequirementsSummary,
      healthy: snapshot.healthy && capability.healthy,
      healthState: snapshot.healthState,
      degradedReason: snapshot.errorMessage ?? capability.degradedReason,
      truthProfile: deriveVenueTruthProfile(snapshot),
      snapshotType: snapshot.snapshotType,
      snapshotSuccessful: snapshot.snapshotSuccessful,
      snapshotSummary: snapshot.summary,
      snapshotPayload: snapshot.payload,
      errorMessage: snapshot.errorMessage,
      capturedAt: snapshot.capturedAt,
      snapshotCompleteness: snapshot.snapshotCompleteness,
      truthCoverage: snapshot.truthCoverage,
      comparisonCoverage: deriveVenueTruthComparisonCoverage(capability, snapshot),
      sourceMetadata: snapshot.sourceMetadata,
      accountState: snapshot.accountState,
      balanceState: snapshot.balanceState,
      capacityState: snapshot.capacityState,
      exposureState: snapshot.exposureState,
      derivativeAccountState: snapshot.derivativeAccountState,
      derivativePositionState: snapshot.derivativePositionState,
      derivativeHealthState: snapshot.derivativeHealthState,
      orderState: snapshot.orderState,
      executionReferenceState: snapshot.executionReferenceState,
      metadata: {
        ...capability.metadata,
        ...snapshot.metadata,
      },
    };
  }

  private async collectVenueCapabilityForCarryAdapter(adapter: VenueAdapter): Promise<VenueCapabilitySnapshot> {
    if (typeof adapter.getVenueCapabilitySnapshot === 'function') {
      return adapter.getVenueCapabilitySnapshot();
    }

    const capabilities = typeof adapter.getCarryCapabilities === 'function'
      ? await adapter.getCarryCapabilities()
      : {
        venueId: adapter.venueId,
        venueMode: 'simulated' as const,
        executionSupported: false,
        supportsIncreaseExposure: false,
        supportsReduceExposure: false,
        readOnly: true,
        approvedForLiveUse: false,
        healthy: true,
        onboardingState: 'read_only' as const,
        missingPrerequisites: ['carry_controlled_execution_not_implemented'],
        metadata: {
          venueType: adapter.venueType,
        },
      };

    return {
      venueId: capabilities.venueId,
      venueName: capabilities.venueId,
      sleeveApplicability: ['carry'],
      connectorType: 'carry_adapter',
      truthMode: capabilities.venueMode === 'simulated' ? 'simulated' : 'real',
      readOnlySupport: capabilities.readOnly,
      executionSupport: capabilities.executionSupported,
      approvedForLiveUse: capabilities.approvedForLiveUse,
      onboardingState: capabilities.onboardingState,
      missingPrerequisites: capabilities.missingPrerequisites,
      authRequirementsSummary: [],
      healthy: capabilities.healthy,
      healthState: capabilities.healthy ? 'healthy' : 'degraded',
      degradedReason: capabilities.healthy ? null : 'carry_adapter_reported_unhealthy',
      metadata: capabilities.metadata,
    };
  }

  private async collectVenueTruthForCarryAdapter(adapter: VenueAdapter): Promise<VenueTruthSnapshot> {
    if (typeof adapter.getVenueTruthSnapshot === 'function') {
      return adapter.getVenueTruthSnapshot();
    }

    const [balances, positions, status] = await Promise.all([
      adapter.getBalances(),
      adapter.getPositions(),
      adapter.getStatus(),
    ]);
    return {
      venueId: adapter.venueId,
      venueName: adapter.venueId,
      snapshotType: 'carry_adapter_account_state',
      snapshotSuccessful: true,
      healthy: status.healthy,
      healthState: status.healthy ? 'healthy' : 'degraded',
      summary: `${balances.length} balances and ${positions.length} positions observed.`,
      errorMessage: null,
      capturedAt: new Date().toISOString(),
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose a stable venue account identity.',
          limitations: [],
        },
        balanceState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        capacityState: {
          status: 'unsupported',
          reason: 'Carry adapters do not expose treasury-style venue capacity.',
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        derivativeAccountState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not decode venue-native derivative account metadata.',
          limitations: [],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Carry adapter truth exposes generic venue positions, not venue-native derivative state.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose venue-native margin or health semantics.',
          limitations: [],
        },
        orderState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose venue-native open-order state.',
          limitations: [],
        },
        executionReferences: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose external execution references.',
          limitations: [],
        },
      },
      sourceMetadata: {
        sourceKind: 'adapter',
        sourceName: 'carry_adapter',
        observedScope: ['balances', 'positions', 'status'],
      },
      accountState: null,
      balanceState: {
        balances: balances.map((balance) => ({
          assetKey: balance.asset,
          assetSymbol: balance.asset,
          assetType: 'unknown',
          accountAddress: null,
          amountAtomic: balance.total,
          amountDisplay: balance.total,
          decimals: null,
          observedSlot: null,
        })),
        totalTrackedBalances: balances.length,
        observedSlot: null,
      },
      capacityState: null,
      exposureState: {
        exposures: positions.map((position) => ({
          exposureKey: `${position.asset}:${position.side}`,
          exposureType: 'position',
          assetKey: position.asset,
          quantity: position.size,
          quantityDisplay: position.size,
          accountAddress: null,
        })),
        methodology: 'venue_positions',
      },
      derivativeAccountState: null,
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        balances: balances.map((balance) => ({
          asset: balance.asset,
          total: balance.total,
          available: balance.available,
          locked: balance.locked,
          updatedAt: balance.updatedAt.toISOString(),
        })),
        positions: positions.map((position) => ({
          asset: position.asset,
          side: position.side,
          size: position.size,
          updatedAt: position.updatedAt.toISOString(),
        })),
        status,
      },
      metadata: {
        venueType: adapter.venueType,
      },
    };
  }

  private async collectVenueCapabilityForTreasuryAdapter(
    adapter: TreasuryVenueAdapter,
  ): Promise<VenueCapabilitySnapshot> {
    if (typeof adapter.getVenueCapabilitySnapshot === 'function') {
      return adapter.getVenueCapabilitySnapshot();
    }

    const capabilities = await adapter.getCapabilities();
    return {
      venueId: capabilities.venueId,
      venueName: capabilities.venueId,
      sleeveApplicability: ['treasury'],
      connectorType: 'treasury_adapter',
      truthMode: capabilities.venueMode === 'simulated' ? 'simulated' : 'real',
      readOnlySupport: capabilities.readOnly,
      executionSupport: capabilities.executionSupported,
      approvedForLiveUse: capabilities.approvedForLiveUse,
      onboardingState: capabilities.onboardingState,
      missingPrerequisites: capabilities.missingPrerequisites,
      authRequirementsSummary: [],
      healthy: capabilities.healthy,
      healthState: capabilities.healthy ? 'healthy' : 'degraded',
      degradedReason: capabilities.healthy ? null : 'treasury_adapter_reported_unhealthy',
      metadata: capabilities.metadata,
    };
  }

  private async collectVenueTruthForTreasuryAdapter(
    adapter: TreasuryVenueAdapter,
  ): Promise<VenueTruthSnapshot> {
    if (typeof adapter.getVenueTruthSnapshot === 'function') {
      return adapter.getVenueTruthSnapshot();
    }

    const [state, position] = await Promise.all([
      adapter.getVenueState(),
      adapter.getPosition(),
    ]);
    return {
      venueId: state.venueId,
      venueName: state.venueName,
      snapshotType: 'treasury_adapter_state',
      snapshotSuccessful: true,
      healthy: state.healthy,
      healthState: state.healthy ? 'healthy' : 'degraded',
      summary: `Allocation ${position.currentAllocationUsd} USD and available capacity ${state.availableCapacityUsd} USD.`,
      errorMessage: null,
      capturedAt: position.updatedAt,
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose a stable venue account identity.',
          limitations: [],
        },
        balanceState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth is modeled as capacity and allocation, not account balances.',
          limitations: [],
        },
        capacityState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        derivativeAccountState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native derivative account metadata.',
          limitations: [],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native derivative positions.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native margin or health semantics.',
          limitations: [],
        },
        orderState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native open-order state.',
          limitations: [],
        },
        executionReferences: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose external execution references.',
          limitations: [],
        },
      },
      sourceMetadata: {
        sourceKind: 'adapter',
        sourceName: 'treasury_adapter',
        observedScope: ['capacity', 'allocation'],
      },
      accountState: null,
      balanceState: null,
      capacityState: {
        availableCapacityUsd: state.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
        liquidityTier: state.liquidityTier,
        aprBps: state.aprBps,
      },
      exposureState: {
        exposures: [{
          exposureKey: `${state.venueId}:allocation`,
          exposureType: 'allocation',
          assetKey: 'USD',
          quantity: position.currentAllocationUsd,
          quantityDisplay: position.currentAllocationUsd,
          accountAddress: null,
        }],
        methodology: 'treasury_allocation_state',
      },
      derivativeAccountState: null,
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        liquidityTier: state.liquidityTier,
        aprBps: state.aprBps,
        availableCapacityUsd: state.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
      },
      metadata: state.metadata,
    };
  }

  async runCarryEvaluation(input: {
    actorId: string;
    trigger: string;
    sourceRunId?: string | null;
    linkedRebalanceProposalId?: string | null;
    targetCarryNotionalUsd?: string | null;
  }): Promise<{ sourceRunId: string | null; actionCount: number }> {
    const sourceRunId = input.sourceRunId ?? await this.options.store.getLatestStrategyRunId();
    if (sourceRunId === null) {
      return { sourceRunId: null, actionCount: 0 };
    }

    const [opportunities, approvedIntents, runtimeStatus, carryVenues, portfolioSummary] = await Promise.all([
      this.options.store.listApprovedOpportunitiesForRun(sourceRunId),
      this.options.store.listApprovedStrategyIntentsForRun(sourceRunId),
      this.options.store.getRuntimeStatus(),
      this.collectCarryVenueViews(sourceRunId),
      this.options.store.getPortfolioSummary(),
    ]);

    await this.options.store.persistCarryVenueSnapshots({
      strategyRunId: sourceRunId,
      venues: carryVenues,
    });
    await this.refreshVenueTruthInventory();

    const carryCurrentAllocationUsd = portfolioSummary?.sleeves.find((sleeve) => sleeve.sleeveId === 'carry')?.nav ?? '0';
    const approvedCarryBudgetUsd = (await this.options.store.getRebalanceCurrent())?.carryTargetAllocationUsd
      ?? (await this.options.store.getAllocatorSummary())?.totalCapitalUsd
      ?? null;
    const approvedBudgetCapUsd = (await this.options.store.getRebalanceCurrent())?.carryTargetAllocationUsd ?? approvedCarryBudgetUsd;
    const openPositions = (await this.collectPositions())
      .filter((position) => position.sleeveId === this.options.sleeveId && position.status === 'open')
      .flatMap((position) => {
        const snapshot = toCarryPositionSnapshot(position);
        return snapshot === null ? [] : [snapshot];
      });

    const recommendations: CarryExecutionRecommendation[] = [];
    const approvedByOpportunityId = new Map<string, OrderIntent[]>();

    for (const intent of approvedIntents) {
      const existing = approvedByOpportunityId.get(String(intent.opportunityId)) ?? [];
      existing.push(intent);
      approvedByOpportunityId.set(String(intent.opportunityId), existing);
    }

    let remainingTarget = input.targetCarryNotionalUsd === null || input.targetCarryNotionalUsd === undefined
      ? null
      : new Decimal(input.targetCarryNotionalUsd);

    for (const opportunity of opportunities) {
      const plannedOrders = approvedByOpportunityId.get(opportunity.opportunityId) ?? [];
      const notionalUsd = String(plannedOrders[0]?.metadata['positionSizeUsd'] ?? '0');
      const amount = new Decimal(notionalUsd);
      if (remainingTarget !== null && remainingTarget.lte(0)) {
        break;
      }
      if (remainingTarget !== null && amount.gt(remainingTarget)) {
        continue;
      }

      recommendations.push({
        actionType: input.linkedRebalanceProposalId === null || input.linkedRebalanceProposalId === undefined
          ? 'increase_carry_exposure'
          : 'restore_carry_budget',
        sourceKind: input.linkedRebalanceProposalId === null || input.linkedRebalanceProposalId === undefined
          ? 'opportunity'
          : 'rebalance',
        sourceReference: input.linkedRebalanceProposalId ?? opportunity.opportunityId,
        opportunityId: opportunity.opportunityId,
        asset: opportunity.asset,
        summary: `Deploy carry exposure for ${opportunity.asset} opportunity ${opportunity.opportunityId}.`,
        notionalUsd,
        details: {
          confidenceScore: Number(opportunity.confidenceScore),
          expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
          netYieldPct: opportunity.netYieldPct,
          expiresAt: opportunity.expiresAt,
        },
        plannedOrders,
      });

      if (remainingTarget !== null) {
        remainingTarget = remainingTarget.minus(amount);
      }
    }

    const intents = this.carryExecutionPlanner.createExecutionIntents({
      recommendations,
      policy: DEFAULT_CARRY_OPERATIONAL_POLICY,
      currentCarryAllocationUsd: carryCurrentAllocationUsd,
      approvedCarryBudgetUsd: approvedBudgetCapUsd,
      totalCapitalUsd: portfolioSummary?.totalNav ?? null,
      runtimeLifecycleState: runtimeStatus.lifecycleState,
      runtimeHalted: runtimeStatus.halted,
      criticalMismatchCount: await this.options.store.countOpenMismatches(),
      carryThrottleState: runtimeStatus.halted ? 'blocked' : 'normal',
      executionMode: this.options.executionMode,
      liveExecutionEnabled: this.options.liveExecutionEnabled,
      venueCapabilities: carryVenues,
      openPositions,
      now: new Date(),
    });

    const actions = await this.options.store.createCarryActions({
      strategyRunId: sourceRunId,
      linkedRebalanceProposalId: input.linkedRebalanceProposalId ?? null,
      intents,
      actorId: input.actorId,
      createdAt: new Date(),
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'carry.evaluated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'carry',
      data: {
        sourceRunId,
        trigger: input.trigger,
        actionCount: actions.length,
      },
    });

    return {
      sourceRunId,
      actionCount: actions.length,
    };
  }

  async runAllocatorEvaluation(input: {
    trigger: string;
    actorId: string;
    sourceRunId?: string | null;
    carryOpportunities?: OpportunityView[];
    treasurySummary?: TreasurySummaryView | null;
    portfolioSummaryOverride?: Pick<PortfolioSummaryView, 'totalNav' | 'sleeves'>
      | {
        totalNav: string;
        grossExposure: string;
        netExposure: string;
        liquidityReserve: string;
        openPositionCount: number;
        dailyPnl: string;
        cumulativePnl: string;
        sleeves: Array<{ sleeveId: string; nav: string; allocationPct: number }>;
        venueExposures: Record<string, string>;
        assetExposures: Record<string, string>;
        updatedAt: string;
      }
      | null;
  }): Promise<AllocatorSummaryView> {
    const [
      runtimeStatus,
      mismatchSummary,
      criticalMismatches,
      reconciliationSummary,
      persistedPortfolioSummary,
      persistedTreasurySummary,
      persistedOpportunities,
    ] = await Promise.all([
      this.options.store.getRuntimeStatus(),
      this.options.store.summarizeMismatches(),
      this.options.store.listMismatches(20, { severity: 'critical' }),
      this.options.store.summarizeLatestReconciliation(),
      this.options.store.getPortfolioSummary(),
      this.options.store.getTreasurySummary(),
      input.carryOpportunities === undefined
        ? this.options.store.listOpportunities(20)
        : Promise.resolve(input.carryOpportunities),
    ]);

    const treasurySummary = input.treasurySummary ?? persistedTreasurySummary;
    const portfolioSummary = input.portfolioSummaryOverride ?? persistedPortfolioSummary;
    const opportunities = persistedOpportunities.filter((opportunity) => opportunity.approved);

    const totalCapitalUsd = treasurySummary?.reserveStatus.totalCapitalUsd
      ?? portfolioSummary?.totalNav
      ?? '0';
    const totalCapital = new Decimal(totalCapitalUsd);
    const carryCurrentUsd = portfolioSummary?.sleeves.find((sleeve) => sleeve.sleeveId === this.options.sleeveId)?.nav
      ?? '0';
    const treasuryCurrentUsd = Decimal.max(totalCapital.minus(new Decimal(carryCurrentUsd)), 0).toFixed(2);
    const carryCurrentPct = totalCapital.equals(0)
      ? 0
      : Number(new Decimal(carryCurrentUsd).div(totalCapital).times(100).toFixed(4));
    const treasuryCurrentPct = totalCapital.equals(0)
      ? 0
      : Number(new Decimal(treasuryCurrentUsd).div(totalCapital).times(100).toFixed(4));
    const carryOpportunityScore = normaliseCarryOpportunityScore(opportunities);
    const reserveConstrainedCapitalUsd = treasurySummary?.reserveStatus.requiredReserveUsd ?? '0';
    const allocatableCapitalUsd = Decimal.max(
      totalCapital.minus(new Decimal(reserveConstrainedCapitalUsd)),
      0,
    ).toFixed(2);
    const criticalMismatchCount = criticalMismatches.filter(
      (mismatch) => mismatch.status !== 'verified',
    ).length;
    const carryThrottleState: AllocatorSleeveSnapshot['throttleState'] = runtimeStatus.halted
      ? 'blocked'
      : runtimeStatus.lifecycleState === 'degraded' || criticalMismatchCount > 0
        ? 'de_risk'
        : carryOpportunityScore < DEFAULT_ALLOCATOR_POLICY.carryOpportunityScoreFloor
          ? 'throttled'
          : 'normal';
    const carryStatus: AllocatorSleeveSnapshot['status'] = carryThrottleState === 'blocked'
      ? 'blocked'
      : carryThrottleState === 'de_risk'
        ? 'degraded'
        : carryThrottleState === 'throttled'
          ? 'throttled'
          : 'active';
    const treasuryStatus: AllocatorSleeveSnapshot['status'] = treasurySummary === null
      ? 'degraded'
      : new Decimal(treasurySummary.reserveStatus.reserveShortfallUsd).greaterThan(0)
        ? 'degraded'
        : 'active';

    const sleeves: AllocatorSleeveSnapshot[] = [
      {
        sleeveId: 'carry',
        kind: 'carry',
        name: this.allocatorRegistry.get('carry').name,
        currentAllocationUsd: new Decimal(carryCurrentUsd).toFixed(2),
        currentAllocationPct: carryCurrentPct,
        minAllocationPct: 0,
        maxAllocationPct: DEFAULT_ALLOCATOR_POLICY.maximumCarryPct,
        capacityUsd: totalCapital.toFixed(2),
        status: carryStatus,
        throttleState: carryThrottleState,
        healthy: carryStatus === 'active',
        actionability: runtimeStatus.halted ? 'blocked' : 'actionable',
        opportunityScore: carryOpportunityScore,
        metadata: {
          approvedOpportunityCount: opportunities.length,
          runtimeLifecycleState: runtimeStatus.lifecycleState,
        },
      },
      {
        sleeveId: 'treasury',
        kind: 'treasury',
        name: this.allocatorRegistry.get('treasury').name,
        currentAllocationUsd: treasuryCurrentUsd,
        currentAllocationPct: treasuryCurrentPct,
        minAllocationPct: DEFAULT_ALLOCATOR_POLICY.minimumTreasuryPct,
        maxAllocationPct: 100,
        capacityUsd: totalCapital.toFixed(2),
        status: treasuryStatus,
        throttleState: 'normal',
        healthy: treasurySummary !== null,
        actionability: treasurySummary === null ? 'observe_only' : 'actionable',
        opportunityScore: null,
        metadata: {
          reserveCoveragePct: treasurySummary?.reserveStatus.reserveCoveragePct ?? null,
          reserveShortfallUsd: treasurySummary?.reserveStatus.reserveShortfallUsd ?? null,
        },
      },
    ];

    const policyInput: AllocatorPolicyInput = {
      policy: DEFAULT_ALLOCATOR_POLICY,
      sleeves,
      system: {
        totalCapitalUsd: totalCapital.toFixed(2),
        reserveConstrainedCapitalUsd,
        allocatableCapitalUsd,
        runtimeLifecycleState: runtimeStatus.lifecycleState,
        runtimeHalted: runtimeStatus.halted,
        openMismatchCount: mismatchSummary.activeMismatchCount,
        criticalMismatchCount,
        degradedReasonCount: runtimeStatus.reason === null ? 0 : 1,
        treasuryReserveCoveragePct: Number(treasurySummary?.reserveStatus.reserveCoveragePct ?? 0),
        treasuryReserveShortfallUsd: treasurySummary?.reserveStatus.reserveShortfallUsd ?? '0',
        carryOpportunityCount: opportunities.length,
        carryApprovedOpportunityCount: opportunities.length,
        carryOpportunityScore,
        recentReconciliationIssues: reconciliationSummary?.latestStatusCounts.active ?? 0,
      },
      evaluatedAt: new Date().toISOString(),
      sourceReference: input.sourceRunId ?? null,
    };

    const decision = this.allocatorPolicyEngine.evaluate(policyInput);
    const allocatorRunId = createId();
    const evaluatedAt = new Date();

    await this.options.store.persistAllocatorEvaluation({
      allocatorRunId,
      sourceRunId: input.sourceRunId ?? null,
      trigger: input.trigger,
      triggeredBy: input.actorId,
      policy: DEFAULT_ALLOCATOR_POLICY,
      evaluationInput: policyInput as unknown as Record<string, unknown>,
      decision,
      evaluatedAt,
    });

    const rebalanceProposal = this.rebalancePlanner.createProposal({
      allocatorRunId,
      decision,
      system: {
        runtimeLifecycleState: runtimeStatus.lifecycleState,
        runtimeHalted: runtimeStatus.halted,
        criticalMismatchCount,
        executionMode: this.options.executionMode,
        liveExecutionEnabled: this.options.liveExecutionEnabled,
      },
      treasury: {
        idleCapitalUsd: treasurySummary?.reserveStatus.idleCapitalUsd ?? '0',
        reserveShortfallUsd: treasurySummary?.reserveStatus.reserveShortfallUsd ?? '0',
      },
      policy: DEFAULT_REBALANCE_POLICY,
    });

    if (rebalanceProposal !== null) {
      const proposal = await this.options.store.createRebalanceProposal({
        proposal: rebalanceProposal,
        createdAt: evaluatedAt,
      });
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'allocator.rebalance_proposed',
        occurredAt: evaluatedAt.toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'allocator',
        data: {
          proposalId: proposal.id,
          allocatorRunId,
          executable: proposal.executable,
          blockedReasonCount: proposal.blockedReasons.length,
          executionMode: proposal.executionMode,
        },
      });
    }

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.evaluated',
      occurredAt: evaluatedAt.toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'allocator',
      data: {
        allocatorRunId,
        sourceRunId: input.sourceRunId ?? null,
        trigger: input.trigger,
        regimeState: decision.regimeState,
        pressureLevel: decision.pressureLevel,
        recommendationCount: decision.recommendations.length,
      },
    });

    const summary = await this.options.store.getAllocatorSummary();
    if (summary === null) {
      throw new Error(`SentinelRuntime.runAllocatorEvaluation: allocator run "${allocatorRunId}" was not persisted`);
    }

    return summary;
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
    const lastSuccessfulRunId = await this.options.store.getLatestSuccessfulRunId();
    await this.refreshInternalDerivativeState({
      sourceComponent: actorId,
      sourceRunId: lastSuccessfulRunId,
      sourceReference: emitAuditEvent ? actorId : lastSuccessfulRunId,
    });
    await this.refreshVenueTruthInventory();

    const currentStatus = await this.options.store.getRuntimeStatus();
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
    await this.refreshVenueTruthInventory();

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

  async executeRebalanceProposal(input: {
    proposalId: string;
    actorId: string;
    commandId: string | null;
    startedBy: string;
  }): Promise<{
    proposalId: string;
    executionId: string;
    applied: boolean;
    allocatorRunId: string;
    downstreamCarryActionIds: string[];
    downstreamTreasuryActionIds: string[];
  }> {
    const detail = await this.options.store.getRebalanceProposal(input.proposalId);
    if (detail === null) {
      throw new Error(`Rebalance proposal "${input.proposalId}" was not found.`);
    }

    if (detail.proposal.status !== 'queued' && detail.proposal.status !== 'approved') {
      throw new Error(
        `Rebalance proposal "${input.proposalId}" is not executable from status "${detail.proposal.status}".`,
      );
    }

    const syncBundle = async (): Promise<void> => {
      await this.options.store.syncRebalanceBundleForProposal(detail.proposal.id);
    };

    const execution = await this.options.store.createRebalanceExecution({
      proposalId: detail.proposal.id,
      commandId: input.commandId,
      status: detail.proposal.executable ? 'executing' : 'failed',
      executionMode: detail.proposal.executionMode,
      simulated: detail.proposal.simulated,
      requestedBy: input.actorId,
      startedBy: input.startedBy,
      outcome: {
        blockedReasons: detail.proposal.blockedReasons,
      },
      lastError: detail.proposal.executable
        ? null
        : detail.proposal.blockedReasons.map((reason) => reason.message).join('; '),
    });

    if (!detail.proposal.executable) {
      const errorMessage = detail.proposal.blockedReasons.map((reason) => reason.message).join('; ');
      await this.options.store.failRebalanceProposal({
        proposalId: detail.proposal.id,
        latestExecutionId: execution.id,
        errorMessage,
      });
      await syncBundle();
      throw new Error(errorMessage);
    }

    await this.options.store.markRebalanceProposalExecuting(detail.proposal.id);

    const carryIntent = detail.intents.find((intent) => intent.sleeveId === 'carry');
    const treasuryIntent = detail.intents.find((intent) => intent.sleeveId === 'treasury');
    if (carryIntent === undefined || treasuryIntent === undefined) {
      await this.options.store.updateRebalanceExecution(execution.id, {
        status: 'failed',
        lastError: 'Rebalance proposal is missing carry or treasury intent.',
        completedAt: new Date(),
      });
      await this.options.store.failRebalanceProposal({
        proposalId: detail.proposal.id,
        latestExecutionId: execution.id,
        errorMessage: 'Rebalance proposal is missing carry or treasury intent.',
      });
      await syncBundle();
      throw new Error('Rebalance proposal is missing carry or treasury intent.');
    }

    const appliedAt = new Date();
    const applied = detail.proposal.executionMode === 'live';
    const downstreamCarryActionIds: string[] = [];
    const downstreamTreasuryActionIds: string[] = [];
    const runtimeStatus = await this.options.store.getRuntimeStatus();
    const allocatorDecision = await this.options.store.getAllocatorDecision(detail.proposal.allocatorRunId);
    const carrySourceRunId = allocatorDecision?.run.sourceRunId ?? null;

    const carryDeltaUsd = new Decimal(carryIntent.deltaUsd);
    if (!carryDeltaUsd.isZero()) {
      if (carryDeltaUsd.greaterThan(0)) {
        const carryEvaluation = await this.runCarryEvaluation({
          actorId: input.actorId,
          trigger: 'rebalance_proposal_execution',
          sourceRunId: carrySourceRunId,
          linkedRebalanceProposalId: detail.proposal.id,
          targetCarryNotionalUsd: carryDeltaUsd.toFixed(2),
        });
        const carryActions = await this.options.store.listCarryActions(20);
        downstreamCarryActionIds.push(
          ...carryActions
            .filter((action) => action.linkedRebalanceProposalId === detail.proposal.id)
            .map((action) => action.id),
        );
        void carryEvaluation;
      } else {
        const openPositions = (await this.collectPositions())
          .filter((position) => position.sleeveId === this.options.sleeveId && position.status === 'open')
          .flatMap((position) => {
            const snapshot = toCarryPositionSnapshot(position);
            return snapshot === null ? [] : [snapshot];
          });
        const plannedOrders = buildCarryReductionIntents(
          openPositions,
          carryDeltaUsd.abs().toFixed(2),
          detail.proposal.id,
        );
        const carryVenues = await this.collectCarryVenueViews(carrySourceRunId);
        const coveredNotionalUsd = plannedOrders
          .reduce((sum, order) => {
            const plannedReductionUsd = order.metadata['plannedReductionUsd'];
            return typeof plannedReductionUsd === 'string'
              ? sum.plus(plannedReductionUsd)
              : sum;
          }, new Decimal(0))
          .toFixed(2);
        const carryActions = await this.options.store.createCarryActions({
          strategyRunId: null,
          linkedRebalanceProposalId: detail.proposal.id,
          intents: this.carryExecutionPlanner.createExecutionIntents({
            recommendations: [{
              actionType: 'reduce_carry_exposure',
              sourceKind: 'rebalance',
              sourceReference: detail.proposal.id,
              opportunityId: null,
              asset: null,
              summary: `Reduce carry exposure by ${carryDeltaUsd.abs().toFixed(2)} USD for rebalance proposal ${detail.proposal.id}.`,
              notionalUsd: carryDeltaUsd.abs().toFixed(2),
              details: {
                coveredNotionalUsd,
              },
              plannedOrders,
            }],
            policy: DEFAULT_CARRY_OPERATIONAL_POLICY,
            currentCarryAllocationUsd: carryIntent.currentAllocationUsd,
            approvedCarryBudgetUsd: carryIntent.targetAllocationUsd,
            totalCapitalUsd: detail.proposal.details['rebalanceAmountUsd'] === undefined
              ? null
              : new Decimal(carryIntent.currentAllocationUsd).plus(treasuryIntent.currentAllocationUsd).toFixed(2),
            runtimeLifecycleState: runtimeStatus.lifecycleState,
            runtimeHalted: runtimeStatus.halted,
            criticalMismatchCount: await this.options.store.countOpenMismatches(),
            carryThrottleState: 'normal',
            executionMode: this.options.executionMode,
            liveExecutionEnabled: this.options.liveExecutionEnabled,
            venueCapabilities: carryVenues,
            openPositions,
            now: new Date(),
          }),
          actorId: input.actorId,
          createdAt: new Date(),
        });
        downstreamCarryActionIds.push(...carryActions.map((action) => action.id));
      }
    }

    const treasuryDeltaUsd = new Decimal(treasuryIntent.deltaUsd);
    if (!treasuryDeltaUsd.isZero()) {
      const treasurySummary = await this.options.store.getTreasurySummary();
      if (treasurySummary !== null) {
        const treasuryAction = await this.options.store.createTreasuryAction({
          treasuryRunId: treasurySummary.treasuryRunId,
          linkedRebalanceProposalId: detail.proposal.id,
          actionType: 'rebalance_treasury_budget',
          venueId: null,
          venueName: null,
          venueMode: 'reserve',
          amountUsd: treasuryDeltaUsd.abs().toFixed(2),
          reasonCode: 'rebalance_budget_application',
          summary: treasuryDeltaUsd.greaterThan(0)
            ? `Increase treasury budget by ${treasuryDeltaUsd.toFixed(2)} USD for rebalance proposal ${detail.proposal.id}.`
            : `Reduce treasury budget by ${treasuryDeltaUsd.abs().toFixed(2)} USD for rebalance proposal ${detail.proposal.id}.`,
          details: {
            rebalanceProposalId: detail.proposal.id,
            currentAllocationUsd: treasuryIntent.currentAllocationUsd,
            targetAllocationUsd: treasuryIntent.targetAllocationUsd,
            deltaUsd: treasuryIntent.deltaUsd,
            applied,
          },
          readiness: 'actionable',
          executable: true,
          blockedReasons: [],
          approvalRequirement: detail.proposal.approvalRequirement,
          executionMode: detail.proposal.executionMode,
          simulated: detail.proposal.simulated,
          actorId: input.actorId,
          createdAt: appliedAt,
        });
        await this.options.store.approveTreasuryAction(treasuryAction.id, input.actorId);
        if (input.commandId !== null) {
          await this.options.store.queueTreasuryActionExecution({
            actionId: treasuryAction.id,
            commandId: input.commandId,
            actorId: input.actorId,
          });
        }
        await this.options.store.markTreasuryActionExecuting(treasuryAction.id);

        const treasuryExecution = await this.options.store.createTreasuryExecution({
          treasuryActionId: treasuryAction.id,
          treasuryRunId: treasurySummary.treasuryRunId,
          commandId: input.commandId,
          status: 'executing',
          executionMode: detail.proposal.executionMode,
          venueMode: 'reserve',
          simulated: detail.proposal.simulated,
          requestedBy: input.actorId,
          startedBy: input.startedBy,
          blockedReasons: [],
          outcome: {
            executionKind: 'budget_state_application',
            rebalanceProposalId: detail.proposal.id,
            currentAllocationUsd: treasuryIntent.currentAllocationUsd,
            targetAllocationUsd: treasuryIntent.targetAllocationUsd,
            deltaUsd: treasuryIntent.deltaUsd,
          },
        });
        await this.options.store.updateTreasuryExecution(treasuryExecution.id, {
          status: 'completed',
          outcomeSummary: applied
            ? 'Treasury sleeve budget state was applied as part of rebalance execution.'
            : 'Treasury sleeve budget change was recorded as a dry-run rebalance outcome.',
          outcome: {
            executionKind: 'budget_state_application',
            rebalanceProposalId: detail.proposal.id,
            currentAllocationUsd: treasuryIntent.currentAllocationUsd,
            targetAllocationUsd: treasuryIntent.targetAllocationUsd,
            deltaUsd: treasuryIntent.deltaUsd,
            applied,
          },
          lastError: null,
        });
        await this.options.store.completeTreasuryAction({
          actionId: treasuryAction.id,
          latestExecutionId: treasuryExecution.id,
        });
        downstreamTreasuryActionIds.push(treasuryAction.id);
      }
    }

    if (applied) {
      await this.options.store.applyRebalanceCurrent({
        proposalId: detail.proposal.id,
        allocatorRunId: detail.proposal.allocatorRunId,
        carryTargetAllocationUsd: carryIntent.targetAllocationUsd,
        carryTargetAllocationPct: carryIntent.targetAllocationPct,
        treasuryTargetAllocationUsd: treasuryIntent.targetAllocationUsd,
        treasuryTargetAllocationPct: treasuryIntent.targetAllocationPct,
        appliedAt,
      });
    }

    await this.options.store.updateRebalanceExecution(execution.id, {
      status: 'completed',
      outcomeSummary: applied
        ? 'Rebalance proposal was applied to the approved sleeve budget state.'
        : 'Rebalance proposal completed in dry-run mode; no sleeve budget state was changed.',
      outcome: {
        applied,
        downstreamCarryActionIds,
        downstreamTreasuryActionIds,
        carryTargetAllocationUsd: carryIntent.targetAllocationUsd,
        carryTargetAllocationPct: carryIntent.targetAllocationPct,
        treasuryTargetAllocationUsd: treasuryIntent.targetAllocationUsd,
        treasuryTargetAllocationPct: treasuryIntent.targetAllocationPct,
      },
      lastError: null,
      completedAt: appliedAt,
    });
    await this.options.store.completeRebalanceProposal({
      proposalId: detail.proposal.id,
      latestExecutionId: execution.id,
    });
    await syncBundle();
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: applied
        ? 'allocator.rebalance_applied'
        : 'allocator.rebalance_dry_run_completed',
      occurredAt: appliedAt.toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'allocator',
      data: {
        proposalId: detail.proposal.id,
        executionId: execution.id,
        allocatorRunId: detail.proposal.allocatorRunId,
        applied,
      },
    });

    return {
      proposalId: detail.proposal.id,
      executionId: execution.id,
      applied,
      allocatorRunId: detail.proposal.allocatorRunId,
      downstreamCarryActionIds,
      downstreamTreasuryActionIds,
    };
  }

  async executeCarryAction(input: {
    actionId: string;
    actorId: string;
    commandId: string | null;
    startedBy: string;
  }): Promise<{
    actionId: string;
    executionId: string;
    orderCount: number;
  }> {
    const detail = await this.options.store.getCarryAction(input.actionId);
    if (detail === null) {
      throw new Error(`Carry action "${input.actionId}" was not found.`);
    }

    if (detail.action.status !== 'queued' && detail.action.status !== 'approved') {
      throw new Error(`Carry action "${input.actionId}" is not executable from status "${detail.action.status}".`);
    }

    const syncLinkedBundle = async (): Promise<void> => {
      if (detail.action.linkedRebalanceProposalId !== null) {
        await this.options.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
      }
    };

    const execution = await this.options.store.createCarryExecution({
      carryActionId: detail.action.id,
      strategyRunId: detail.action.strategyRunId,
      commandId: input.commandId,
      status: detail.action.executable ? 'executing' : 'failed',
      executionMode: detail.action.executionMode,
      simulated: detail.action.simulated,
      requestedBy: input.actorId,
      startedBy: input.startedBy,
      blockedReasons: detail.action.blockedReasons,
      lastError: detail.action.executable
        ? null
        : detail.action.blockedReasons.map((reason) => reason.message).join('; '),
      outcome: {
        blockedReasons: detail.action.blockedReasons,
      },
    });

    if (!detail.action.executable) {
      const errorMessage = detail.action.blockedReasons.map((reason) => reason.message).join('; ');
      await this.options.store.failCarryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage,
      });
      await syncLinkedBundle();
      throw new Error(errorMessage);
    }

    await this.options.store.markCarryActionExecuting(detail.action.id);

    const orderStore = new RuntimeOrderStore(this.options.store.db);
    const carryVenues = await this.collectCarryVenueViews(detail.action.strategyRunId);
    const carryVenueById = new Map(carryVenues.map((venue) => [venue.venueId, venue] as const));
    const orderResults: Array<{
      stepId: string;
      intentId: string;
      clientOrderId: string;
      venueOrderId: string | null;
      status: string;
      filledSize: string;
      averageFillPrice: string | null;
      executionReference: string | null;
    }> = [];

    for (const plannedOrder of detail.plannedOrders) {
      const venueSnapshot = carryVenueById.get(plannedOrder.venueId) ?? {
        venueId: plannedOrder.venueId,
        venueMode: detail.action.simulated ? 'simulated' as const : 'live' as const,
        executionSupported: false,
        readOnly: true,
        approvedForLiveUse: false,
        onboardingState: 'read_only' as const,
      };
      const step = await this.options.store.createCarryExecutionStep({
        carryExecutionId: execution.id,
        carryActionId: detail.action.id,
        strategyRunId: detail.action.strategyRunId,
        plannedOrderId: plannedOrder.id,
        intentId: plannedOrder.intentId,
        venueId: plannedOrder.venueId,
        venueMode: venueSnapshot.venueMode,
        executionSupported: venueSnapshot.executionSupported,
        readOnly: venueSnapshot.readOnly,
        approvedForLiveUse: venueSnapshot.approvedForLiveUse,
        onboardingState: venueSnapshot.onboardingState,
        asset: plannedOrder.asset,
        side: plannedOrder.side,
        orderType: plannedOrder.orderType,
        requestedSize: plannedOrder.requestedSize,
        requestedPrice: plannedOrder.requestedPrice,
        reduceOnly: plannedOrder.reduceOnly,
        clientOrderId: plannedOrder.intentId,
        status: 'pending',
        simulated: detail.action.simulated,
        metadata: plannedOrder.metadata,
      });
      const adapter = this.options.adapters.get(plannedOrder.venueId);
      if (adapter === undefined) {
        await this.options.store.updateCarryExecutionStep(step.id, {
          status: 'failed',
          outcomeSummary: `Carry venue "${plannedOrder.venueId}" is not registered.`,
          lastError: `Carry venue "${plannedOrder.venueId}" is not registered.`,
          outcome: {
            attempted: false,
          },
          completedAt: new Date(),
        });
        await this.options.store.updateCarryExecution(execution.id, {
          status: 'failed',
          lastError: `Carry venue "${plannedOrder.venueId}" is not registered.`,
          completedAt: new Date(),
        });
        await this.options.store.failCarryAction({
          actionId: detail.action.id,
          latestExecutionId: execution.id,
          errorMessage: `Carry venue "${plannedOrder.venueId}" is not registered.`,
        });
        await syncLinkedBundle();
        throw new Error(`Carry venue "${plannedOrder.venueId}" is not registered.`);
      }

      try {
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

        const orderRecord = await executor.submitIntent({
          intentId: plannedOrder.intentId,
          venueId: plannedOrder.venueId as never,
          asset: plannedOrder.asset as never,
          side: plannedOrder.side,
          type: plannedOrder.orderType,
          size: plannedOrder.requestedSize,
          limitPrice: plannedOrder.requestedPrice,
          opportunityId: (detail.action.opportunityId ?? createId()) as never,
          reduceOnly: plannedOrder.reduceOnly,
          createdAt: new Date(plannedOrder.createdAt),
          metadata: plannedOrder.metadata,
        });
        if (detail.action.strategyRunId !== null) {
          await this.persistExecutionRecord(detail.action.strategyRunId, orderRecord);
        }
        const executionReference = orderRecord.venueOrderId ?? plannedOrder.intentId;
        await this.options.store.updateCarryExecutionStep(step.id, {
          clientOrderId: plannedOrder.intentId,
          venueOrderId: orderRecord.venueOrderId,
          executionReference,
          status: orderRecord.status,
          simulated: detail.action.simulated,
          filledSize: orderRecord.filledSize,
          averageFillPrice: orderRecord.averageFillPrice,
          outcomeSummary: orderRecord.lastError === null
            ? `Execution step completed with status ${orderRecord.status}.`
            : orderRecord.lastError,
          outcome: {
            attemptCount: orderRecord.attemptCount,
            feesPaid: orderRecord.feesPaid,
            fillCount: orderRecord.fills.length,
            submittedAt: orderRecord.submittedAt?.toISOString() ?? null,
          },
          lastError: orderRecord.lastError,
          completedAt: orderRecord.completedAt ?? new Date(),
        });
        orderResults.push({
          stepId: step.id,
          intentId: plannedOrder.intentId,
          clientOrderId: plannedOrder.intentId,
          venueOrderId: orderRecord.venueOrderId,
          status: orderRecord.status,
          filledSize: orderRecord.filledSize,
          averageFillPrice: orderRecord.averageFillPrice,
          executionReference,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Carry order execution failed.';
        await this.options.store.updateCarryExecutionStep(step.id, {
          status: 'failed',
          simulated: detail.action.simulated,
          outcomeSummary: message,
          outcome: {
            attempted: true,
          },
          lastError: message,
          completedAt: new Date(),
        });
        await this.options.store.updateCarryExecution(execution.id, {
          status: 'failed',
          lastError: message,
          outcomeSummary: message,
          outcome: {
            orderResults,
          },
          completedAt: new Date(),
        });
        await this.options.store.failCarryAction({
          actionId: detail.action.id,
          latestExecutionId: execution.id,
          errorMessage: message,
        });
        await syncLinkedBundle();
        throw error;
      }
    }

    await this.options.store.updateCarryExecution(execution.id, {
      status: 'completed',
      outcomeSummary: detail.action.simulated
        ? 'Carry action completed against simulated venues.'
        : 'Carry action completed against live venues.',
      outcome: {
        stepCount: orderResults.length,
        orderResults,
      },
      venueExecutionReference: orderResults
        .map((result) => result.executionReference)
        .filter((value): value is string => value !== null && value.length > 0)
        .join(','),
      completedAt: new Date(),
    });
    await this.options.store.completeCarryAction({
      actionId: detail.action.id,
      latestExecutionId: execution.id,
    });
    await this.refreshInternalDerivativeState({
      sourceComponent: 'carry-execution',
      sourceRunId: detail.action.strategyRunId,
      sourceReference: execution.id,
    });
    await syncLinkedBundle();
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'carry.executed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'carry',
      data: {
        carryActionId: detail.action.id,
        executionId: execution.id,
        orderCount: orderResults.length,
        simulated: detail.action.simulated,
      },
    });

    return {
      actionId: detail.action.id,
      executionId: execution.id,
      orderCount: orderResults.length,
    };
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

    const syncLinkedBundle = async (): Promise<void> => {
      if (detail.action.linkedRebalanceProposalId !== null) {
        await this.options.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
      }
    };

    if (detail.action.actionType === 'rebalance_treasury_budget') {
      const execution = await this.options.store.createTreasuryExecution({
        treasuryActionId: detail.action.id,
        treasuryRunId: detail.action.treasuryRunId,
        commandId: input.commandId,
        status: 'executing',
        executionMode: detail.action.executionMode,
        venueMode: 'reserve',
        simulated: detail.action.simulated,
        requestedBy: input.actorId,
        startedBy: input.startedBy,
        blockedReasons: [],
        outcome: {
          executionKind: 'budget_state_application',
          ...detail.action.details,
        },
      });

      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'completed',
        outcomeSummary: 'Treasury budget-state action completed without venue-native execution.',
        outcome: {
          executionKind: 'budget_state_application',
          ...detail.action.details,
        },
        lastError: null,
      });
      await this.options.store.completeTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
      });
      await syncLinkedBundle();

      return {
        actionId: detail.action.id,
        executionId: execution.id,
        treasuryRunId: detail.action.treasuryRunId,
        venueExecutionReference: null,
        simulated: detail.action.simulated,
      };
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
      await syncLinkedBundle();
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
      await syncLinkedBundle();
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
      await syncLinkedBundle();
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
      await syncLinkedBundle();
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
      await syncLinkedBundle();
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
    for (const adapter of this.options.truthAdapters.values()) {
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
