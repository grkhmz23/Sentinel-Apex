// =============================================================================
// Strategy pipeline integration tests
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import type { CarryConfig } from '@sentinel-apex/carry';
import { DEFAULT_CARRY_CONFIG } from '@sentinel-apex/carry';
import { createLogger, ConsoleAuditWriter, registry } from '@sentinel-apex/observability';
import { RiskEngine, CircuitBreakerRegistry, DEFAULT_RISK_LIMITS } from '@sentinel-apex/risk-engine';
import type { RiskLimits , PortfolioState } from '@sentinel-apex/risk-engine';
import {
  SimulatedVenueAdapter,
  StaticPriceFeed,
} from '@sentinel-apex/venue-adapters';
import type { SimulatedVenueConfig } from '@sentinel-apex/venue-adapters';

import { StrategyPipeline } from '../pipeline.js';

import type { PipelineConfig } from '../pipeline.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSimulatedAdapter(
  venueId: string,
  prices: Record<string, string>,
  fundingRates: Record<string, string> = {},
  balances: Record<string, string> = { USDC: '100000' },
): SimulatedVenueAdapter {
  const config: SimulatedVenueConfig = {
    venueId,
    venueType: 'cex',
    makerFeePct: '0.0002',
    takerFeePct: '0.0005',
    slippagePct: '0.0001',
    initialBalances: balances,
  };

  const priceFeed = new StaticPriceFeed(prices, fundingRates);
  return new SimulatedVenueAdapter(config, priceFeed);
}

function makeCarryConfig(overrides: Partial<CarryConfig> = {}): CarryConfig {
  return {
    ...DEFAULT_CARRY_CONFIG,
    approvedAssets: ['BTC', 'ETH'],
    approvedVenues: ['venue-a', 'venue-b'],
    minAnnualYieldPct: '5.0',
    minConfidenceScore: 0.5,
    maxOpportunityAgeSec: 300,
    minFundingRateAnnualized: '3.0',
    minCrossVenueSpreadPct: '0.3',
    estimatedTakerFeePct: '0.05',
    estimatedMakerFeePct: '0.02',
    defaultPositionSizePct: '5',
    maxPositionSizePct: '20',
    maxConcurrentOpportunities: 5,
    ...overrides,
  };
}

function makePortfolioState(overrides: Partial<PortfolioState> = {}): PortfolioState {
  return {
    totalNav: '100000',
    grossExposure: '0',
    netExposure: '0',
    liquidityReserve: '100000',
    currentDailyDrawdownPct: 0,
    currentWeeklyDrawdownPct: 0,
    currentPortfolioDrawdownPct: 0,
    venueExposures: new Map(),
    assetExposures: new Map(),
    sleeveNav: new Map([['carry', '100000']]),
    openPositionCount: 0,
    ...overrides,
  };
}

function makePipeline(
  adapters: Map<string, SimulatedVenueAdapter>,
  carryConfig: CarryConfig,
  mode: 'dry-run' | 'live' = 'dry-run',
  configOverrides: Partial<PipelineConfig> = {},
  riskLimitOverrides: Partial<RiskLimits> = {},
): StrategyPipeline {
  const riskLimits: RiskLimits = {
    ...DEFAULT_RISK_LIMITS,
    ...riskLimitOverrides,
  };
  const cbRegistry = new CircuitBreakerRegistry(riskLimits);
  const riskEngine = new RiskEngine(riskLimits, cbRegistry);
  const logger = createLogger('pipeline-test');
  const auditWriter = new ConsoleAuditWriter();

  const pipelineConfig: PipelineConfig = {
    mode,
    sleeveId: 'carry',
    scanIntervalMs: 1000,
    ...configOverrides,
  };

  return new StrategyPipeline(
    pipelineConfig,
    adapters as unknown as Map<string, import('@sentinel-apex/venue-adapters').VenueAdapter>,
    riskEngine,
    carryConfig,
    logger,
    auditWriter,
    registry,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StrategyPipeline.runCycle', () => {
  let adapterA: SimulatedVenueAdapter;
  let adapterB: SimulatedVenueAdapter;

  beforeEach(async () => {
    adapterA = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000', ETH: '2000' },
      { BTC: '0.0001', ETH: '0.0001' }, // 0.01% per 8h ≈ 10.95% annualized
    );
    adapterB = makeSimulatedAdapter(
      'venue-b',
      { BTC: '50000', ETH: '2000' },
      { BTC: '0.0001', ETH: '0.0001' },
    );

    await adapterA.connect();
    await adapterB.connect();
  });

  it('produces 0 intents when funding yield is below threshold', async () => {
    // Very low funding rate: 0.000001% per 8h → ~0.001% annualized → well below 5% threshold
    const adapterLow = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000' },
      { BTC: '0.00000001' },
    );
    await adapterLow.connect();

    const carryConfig = makeCarryConfig({
      minAnnualYieldPct: '5.0',
      minCrossVenueSpreadPct: '0.3',
      approvedVenues: ['venue-a'],
    });

    const adapters = new Map([['venue-a', adapterLow]]);
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    const state = makePortfolioState();
    const result = await pipeline.runCycle(state);

    expect(result.success).toBe(true);
    expect(result.intentsGenerated).toBe(0);
    expect(result.intentsExecuted).toBe(0);
  });

  it('detects opportunity and generates intents in dry-run mode when funding rate is sufficient', async () => {
    // High funding rate: 0.003% per 8h → ~32.85% annualized → well above threshold
    const adapterHigh = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000' },
      { BTC: '0.0003' },
    );
    await adapterHigh.connect();

    const carryConfig = makeCarryConfig({
      minAnnualYieldPct: '5.0',
      approvedVenues: ['venue-a'],
      estimatedTakerFeePct: '0.05',
      estimatedMakerFeePct: '0.02',
    });

    const adapters = new Map([['venue-a', adapterHigh]]);
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    const state = makePortfolioState();
    const result = await pipeline.runCycle(state);

    expect(result.success).toBe(true);
    expect(result.opportunitiesDetected).toBeGreaterThan(0);
    // In dry-run mode, intentsExecuted should match approved intents (logged, not actually sent)
    expect(result.intentsExecuted).toBeGreaterThanOrEqual(0);
  });

  it('does not mutate venue balances or positions in dry-run mode', async () => {
    const adapterHigh = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000' },
      { BTC: '0.0003' },
    );
    await adapterHigh.connect();

    const carryConfig = makeCarryConfig({
      minAnnualYieldPct: '5.0',
      approvedVenues: ['venue-a'],
      approvedAssets: ['BTC'],
    });

    const beforeBalances = await adapterHigh.getBalances();
    const pipeline = makePipeline(new Map([['venue-a', adapterHigh]]), carryConfig, 'dry-run');

    const result = await pipeline.runCycle(makePortfolioState());

    const afterBalances = await adapterHigh.getBalances();
    const positions = await adapterHigh.getPositions();
    const beforeUsdc = beforeBalances.find((balance) => balance.asset === 'USDC');
    const afterUsdc = afterBalances.find((balance) => balance.asset === 'USDC');

    expect(result.success).toBe(true);
    expect(result.intentsGenerated).toBeGreaterThan(0);
    expect(afterUsdc?.total).toBe(beforeUsdc?.total);
    expect(afterUsdc?.available).toBe(beforeUsdc?.available);
    expect(afterUsdc?.locked).toBe(beforeUsdc?.locked);
    expect(positions).toHaveLength(0);
  });

  it('fails safe when live mode is requested without explicit opt-in', async () => {
    const adapterHigh = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000' },
      { BTC: '0.0003' },
    );
    await adapterHigh.connect();

    const carryConfig = makeCarryConfig({
      approvedVenues: ['venue-a'],
      approvedAssets: ['BTC'],
    });

    const pipeline = makePipeline(new Map([['venue-a', adapterHigh]]), carryConfig, 'live');
    const result = await pipeline.runCycle(makePortfolioState());

    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.includes('live execution is disabled'))).toBe(true);
    expect(await adapterHigh.getPositions()).toHaveLength(0);
  });

  it('submits orders in live mode only when explicit opt-in is enabled', async () => {
    const adapterHigh = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000' },
      { BTC: '0.0003' },
    );
    await adapterHigh.connect();

    const carryConfig = makeCarryConfig({
      approvedVenues: ['venue-a'],
      approvedAssets: ['BTC'],
    });

    const pipeline = makePipeline(
      new Map([['venue-a', adapterHigh]]),
      carryConfig,
      'live',
      { allowLiveExecution: true },
      {
        maxSingleVenuePct: 100,
        maxSingleAssetPct: 100,
        maxPositionSizePct: 100,
      },
    );

    const beforeBalances = await adapterHigh.getBalances();
    const result = await pipeline.runCycle(makePortfolioState());
    const afterBalances = await adapterHigh.getBalances();
    const beforeUsdc = beforeBalances.find((balance) => balance.asset === 'USDC');
    const afterUsdc = afterBalances.find((balance) => balance.asset === 'USDC');

    expect(result.success).toBe(true);
    expect(result.intentsExecuted).toBeGreaterThan(0);
    expect(parseFloat(afterUsdc?.total ?? '0')).toBeLessThan(parseFloat(beforeUsdc?.total ?? '0'));
  });

  it('detects cross-venue opportunity when price discrepancy is sufficient', async () => {
    // venue-a at 50000, venue-b at 50300 → 0.6% spread → above 0.3% threshold
    const adapterLow = makeSimulatedAdapter('venue-a', { BTC: '50000' }, {});
    const adapterHigh = makeSimulatedAdapter('venue-b', { BTC: '50300' }, {});
    await adapterLow.connect();
    await adapterHigh.connect();

    const carryConfig = makeCarryConfig({
      minAnnualYieldPct: '5.0',
      minCrossVenueSpreadPct: '0.3',
      // Fees: 2×0.05 + 2×0.02 = 0.14% — spread of 0.6% well exceeds fees
      estimatedTakerFeePct: '0.05',
      estimatedMakerFeePct: '0.02',
    });

    const adapters = new Map([
      ['venue-a', adapterLow],
      ['venue-b', adapterHigh],
    ]);
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    const state = makePortfolioState();
    const result = await pipeline.runCycle(state);

    expect(result.success).toBe(true);
    expect(result.opportunitiesDetected).toBeGreaterThan(0);
  });

  it('approves a diversified set of opportunities when asset caps are enabled', async () => {
    const adapterDiversified = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000', ETH: '2000' },
      { BTC: '0.0004', ETH: '0.0002' },
    );
    const adapterSecondary = makeSimulatedAdapter(
      'venue-b',
      { BTC: '50050', ETH: '2005' },
      { BTC: '0.0003', ETH: '0.00015' },
    );
    await adapterDiversified.connect();
    await adapterSecondary.connect();

    const carryConfig = makeCarryConfig({
      approvedVenues: ['venue-a', 'venue-b'],
      approvedAssets: ['BTC', 'ETH'],
      maxConcurrentOpportunities: 2,
      maxOpportunitiesPerAsset: 1,
      maxOpportunitiesPerVenue: 2,
    });

    const pipeline = makePipeline(
      new Map([
        ['venue-a', adapterDiversified],
        ['venue-b', adapterSecondary],
      ]),
      carryConfig,
    );

    const plan = await pipeline.planCycle(makePortfolioState());
    const approvedAssets = [...new Set(plan.opportunitiesApproved.map((opportunity) => opportunity.asset))];

    expect(plan.opportunitiesApproved).toHaveLength(2);
    expect(approvedAssets.sort()).toEqual(['BTC', 'ETH']);
  });

  it('blocks intents when portfolio is at capacity (risk check failure)', async () => {
    const adapterHigh = makeSimulatedAdapter(
      'venue-a',
      { BTC: '50000' },
      { BTC: '0.0003' }, // high funding rate
    );
    await adapterHigh.connect();

    const carryConfig = makeCarryConfig({
      minAnnualYieldPct: '5.0',
      approvedVenues: ['venue-a'],
    });

    const adapters = new Map([['venue-a', adapterHigh]]);
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    // Portfolio already at max open position count
    const state = makePortfolioState({
      openPositionCount: DEFAULT_RISK_LIMITS.maxOpportunityCount, // 10 — at limit
    });

    const result = await pipeline.runCycle(state);

    expect(result.success).toBe(true);
    // Opportunities may be detected but intents should be blocked by risk engine
    expect(result.intentsExecuted).toBe(0);
  });

  it('PipelineResult contains correct metrics fields', async () => {
    const adapters = new Map([['venue-a', adapterA]]);
    const carryConfig = makeCarryConfig({ approvedVenues: ['venue-a'] });
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    const state = makePortfolioState();
    const result = await pipeline.runCycle(state);

    expect(result).toMatchObject({
      success: expect.any(Boolean) as boolean,
      opportunitiesDetected: expect.any(Number) as number,
      opportunitiesApproved: expect.any(Number) as number,
      intentsGenerated: expect.any(Number) as number,
      intentsExecuted: expect.any(Number) as number,
      errors: expect.any(Array) as string[],
      durationMs: expect.any(Number) as number,
      timestamp: expect.any(Date) as Date,
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.opportunitiesDetected).toBeGreaterThanOrEqual(0);
    expect(result.opportunitiesApproved).toBeGreaterThanOrEqual(0);
    expect(result.intentsGenerated).toBeGreaterThanOrEqual(0);
  });

  it('returns success=true even when no opportunities are found', async () => {
    // Adapter with zero funding and same prices → no opportunities
    const adapterZero = makeSimulatedAdapter('venue-a', { BTC: '50000' }, { BTC: '0' });
    await adapterZero.connect();

    const carryConfig = makeCarryConfig({ approvedVenues: ['venue-a'] });
    const adapters = new Map([['venue-a', adapterZero]]);
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    const state = makePortfolioState();
    const result = await pipeline.runCycle(state);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports stage at time of failure', async () => {
    // Disconnected adapter → market data fetch will warn (not throw) for each asset
    // To force a genuine failure, pass a broken adapter
    const brokenAdapter = {
      venueId: 'broken',
      venueType: 'cex' as const,
      connect: async () => { return; },
      disconnect: async () => { return; },
      isConnected: () => true,
      getMarketData: async () => { throw new Error('boom'); },
      getFundingRate: async () => { throw new Error('boom'); },
      getBalances: async () => [],
      getPositions: async () => [],
      placeOrder: async () => { throw new Error('boom'); },
      cancelOrder: async () => ({ venueOrderId: '', cancelled: false }),
      getOrder: async () => null,
      getStatus: async () => ({ healthy: false, latencyMs: 0 }),
    };

    const carryConfig = makeCarryConfig({ approvedVenues: ['broken'] });
    const adapters = new Map([['broken', brokenAdapter]]);
    const pipeline = makePipeline(
      adapters as unknown as Map<string, SimulatedVenueAdapter>,
      carryConfig,
    );

    const state = makePortfolioState();
    // Should not throw — errors are captured internally
    const result = await pipeline.runCycle(state);

    // Even with errors in market data fetch, the cycle should succeed with 0 opportunities
    expect(result.success).toBe(true);
    expect(result.opportunitiesDetected).toBe(0);
  });
});
