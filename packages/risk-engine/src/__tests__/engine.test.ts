// =============================================================================
// engine.test.ts — integration tests for RiskEngine
// =============================================================================

import { describe, it, expect } from 'vitest';

import type { OrderIntent } from '@sentinel-apex/domain';
import { toOpportunityId } from '@sentinel-apex/domain';

import { CircuitBreakerRegistry } from '../circuit-breakers.js';
import { RiskEngine } from '../engine.js';
import { DEFAULT_RISK_LIMITS } from '../limits.js';

import type { PortfolioState, OrderIntentContext } from '../engine.js';
import type { RiskLimits } from '../limits.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLimits(overrides: Partial<RiskLimits> = {}): RiskLimits {
  return { ...DEFAULT_RISK_LIMITS, ...overrides };
}

function makePortfolioState(overrides: Partial<PortfolioState> = {}): PortfolioState {
  return {
    totalNav: '1000000',           // $1M NAV
    grossExposure: '500000',       // 50 % gross exposure (well under 200 % limit)
    netExposure: '0',              // perfectly hedged
    liquidityReserve: '300000',    // 30 % reserve (well above 10 % minimum)
    currentDailyDrawdownPct: 0,
    currentWeeklyDrawdownPct: 0,
    currentPortfolioDrawdownPct: 0,
    // Context adds $50k BTC on binance.
    // Venue: binance=(100k+50k)/550k=27.3% < 40% ✓
    // Asset: BTC=(80k+50k)/550k=23.6% < 30% ✓
    venueExposures: new Map([['binance', '100000'], ['okx', '200000'], ['kraken', '200000']]),
    assetExposures: new Map([['BTC', '80000'], ['ETH', '200000'], ['SOL', '220000']]),
    sleeveNav: new Map([['sleeve-carry', '600000'], ['sleeve-treasury', '400000']]),
    openPositionCount: 3,
    ...overrides,
  };
}

function makeIntent(overrides: Partial<OrderIntent> = {}): OrderIntent {
  return {
    intentId: 'intent-001',
    venueId: 'binance' as ReturnType<typeof import('@sentinel-apex/domain').toOpportunityId>,
    asset: 'BTC' as ReturnType<typeof import('@sentinel-apex/domain').toOpportunityId>,
    side: 'buy',
    type: 'limit',
    size: '1',
    limitPrice: '50000',
    opportunityId: toOpportunityId('opp-001'),
    reduceOnly: false,
    createdAt: new Date(),
    metadata: { sleeveId: 'sleeve-carry' },
    ...overrides,
  } as unknown as OrderIntent;
}

function makeContext(overrides: Partial<OrderIntentContext> = {}): OrderIntentContext {
  return {
    intent: makeIntent(),
    venueId: 'binance',
    assetSymbol: 'BTC',
    positionSizeUsd: '50000',    // $50K position
    deltaUsd: '50000',           // long
    requiredMarginUsd: '10000',  // 10K margin (5:1 leverage on position)
    lastPriceUpdate: new Date(Date.now() - 5_000), // 5 seconds old
    ...overrides,
  };
}

function makeEngine(
  limitsOverrides: Partial<RiskLimits> = {},
): { engine: RiskEngine; registry: CircuitBreakerRegistry } {
  const limits = makeLimits(limitsOverrides);
  const registry = new CircuitBreakerRegistry(limits);
  const engine = new RiskEngine(limits, registry);
  return { engine, registry };
}

// ---------------------------------------------------------------------------
// assessOrderIntent — passing cases
// ---------------------------------------------------------------------------

describe('RiskEngine.assessOrderIntent — healthy portfolio', () => {
  it('returns passed when all checks pass', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState();
    const context = makeContext();

    const assessment = engine.assessOrderIntent(context, state);

    expect(assessment.overallStatus).toBe('passed');
    expect(assessment.results.every((r) => r.status !== 'failed')).toBe(true);
  });

  it('sets opportunityId from the intent', () => {
    const { engine } = makeEngine();
    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    expect(assessment.opportunityId).toBe(toOpportunityId('opp-001'));
  });

  it('sets orderId to null (pre-submission)', () => {
    const { engine } = makeEngine();
    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    expect(assessment.orderId).toBeNull();
  });

  it('includes a timestamp', () => {
    const { engine } = makeEngine();
    const before = new Date();
    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    expect(assessment.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('runs all individual checks (at least 10 results)', () => {
    const { engine } = makeEngine();
    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    expect(assessment.results.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// assessOrderIntent — drawdown limits
// ---------------------------------------------------------------------------

describe('RiskEngine.assessOrderIntent — drawdown limit breaches', () => {
  it('fails when daily drawdown is breached', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ currentDailyDrawdownPct: 2.5 });
    const assessment = engine.assessOrderIntent(makeContext(), state);
    expect(assessment.overallStatus).toBe('failed');
    const ddCheck = assessment.results.find((r) => r.checkName === 'drawdown_daily');
    expect(ddCheck?.status).toBe('failed');
  });

  it('fails when weekly drawdown is breached', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ currentWeeklyDrawdownPct: 6.0 });
    const assessment = engine.assessOrderIntent(makeContext(), state);
    expect(assessment.overallStatus).toBe('failed');
    const ddCheck = assessment.results.find((r) => r.checkName === 'drawdown_weekly');
    expect(ddCheck?.status).toBe('failed');
  });

  it('fails when portfolio drawdown is breached', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ currentPortfolioDrawdownPct: 16.0 });
    const assessment = engine.assessOrderIntent(makeContext(), state);
    expect(assessment.overallStatus).toBe('failed');
    const ddCheck = assessment.results.find((r) => r.checkName === 'drawdown_portfolio');
    expect(ddCheck?.status).toBe('failed');
  });

  it('warns when drawdown is approaching limit', () => {
    const { engine } = makeEngine();
    // 1.9 % → approaching 2 % daily limit
    const state = makePortfolioState({ currentDailyDrawdownPct: 1.9 });
    const assessment = engine.assessOrderIntent(makeContext(), state);
    // Should have a warning for daily drawdown but may still be overall 'warning' not 'failed'
    const ddCheck = assessment.results.find((r) => r.checkName === 'drawdown_daily');
    expect(ddCheck?.status).toBe('warning');
    // overall status is 'warning' if no failures exist
    expect(['warning', 'failed']).toContain(assessment.overallStatus);
  });
});

// ---------------------------------------------------------------------------
// assessOrderIntent — gross exposure limit
// ---------------------------------------------------------------------------

describe('RiskEngine.assessOrderIntent — gross exposure limit', () => {
  it('fails when gross exposure would exceed limit', () => {
    const { engine } = makeEngine();
    // NAV = 1M, limit = 200 % = 2M
    // current gross = 1_950_000, new position = 100_000 → projected = 2_050_000 > 2M ✗
    const state = makePortfolioState({
      totalNav: '1000000',
      grossExposure: '1950000',
      liquidityReserve: '500000', // enough to avoid liquidity check failing first
    });
    const context = makeContext({ positionSizeUsd: '100000' });
    const assessment = engine.assessOrderIntent(context, state);
    expect(assessment.overallStatus).toBe('failed');
    const check = assessment.results.find((r) => r.checkName === 'gross_exposure');
    expect(check?.status).toBe('failed');
  });

  it('passes when position keeps gross exposure under limit', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ grossExposure: '100000' });
    const context = makeContext({ positionSizeUsd: '50000' });
    const assessment = engine.assessOrderIntent(context, state);
    const check = assessment.results.find((r) => r.checkName === 'gross_exposure');
    expect(check?.status).toBe('passed');
  });
});

// ---------------------------------------------------------------------------
// assessOrderIntent — venue concentration
// ---------------------------------------------------------------------------

describe('RiskEngine.assessOrderIntent — venue concentration', () => {
  it('fails when venue concentration would exceed limit', () => {
    const { engine } = makeEngine();
    // limit = 40 % of gross
    // current gross = 100_000, binance exposure = 38_000
    // new position of 10_000 on binance → projected binance = 48_000 / 110_000 = 43.6 % > 40 % ✗
    const venueExposures = new Map([['binance', '38000']]);
    const state = makePortfolioState({
      grossExposure: '100000',
      venueExposures,
      totalNav: '1000000',
    });
    const context = makeContext({
      venueId: 'binance',
      positionSizeUsd: '10000',
    });
    const assessment = engine.assessOrderIntent(context, state);
    const check = assessment.results.find((r) => r.checkName === 'venue_concentration');
    expect(check?.status).toBe('failed');
    expect(assessment.overallStatus).toBe('failed');
  });

  it('passes when venue concentration stays within limit', () => {
    const { engine } = makeEngine();
    const venueExposures = new Map([['binance', '10000']]);
    const state = makePortfolioState({
      grossExposure: '100000',
      venueExposures,
    });
    const context = makeContext({
      venueId: 'binance',
      positionSizeUsd: '5000',
    });
    const assessment = engine.assessOrderIntent(context, state);
    const check = assessment.results.find((r) => r.checkName === 'venue_concentration');
    expect(check?.status).toBe('passed');
  });

  it('uses zero for venue exposure when venue is new', () => {
    const { engine } = makeEngine();
    const venueExposures = new Map<string, string>(); // new venue, no existing exposure
    const state = makePortfolioState({ grossExposure: '100000', venueExposures });
    const context = makeContext({ venueId: 'kraken', positionSizeUsd: '5000' });
    const assessment = engine.assessOrderIntent(context, state);
    const check = assessment.results.find((r) => r.checkName === 'venue_concentration');
    expect(check?.status).toBe('passed');
  });
});

// ---------------------------------------------------------------------------
// assessOrderIntent — circuit breaker gate
// ---------------------------------------------------------------------------

describe('RiskEngine.assessOrderIntent — circuit breaker gate', () => {
  it('fails immediately when a circuit breaker is open', () => {
    const { engine, registry } = makeEngine();
    registry.trip('daily_drawdown', 'test trip');

    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    expect(assessment.overallStatus).toBe('failed');
    const gate = assessment.results.find((r) => r.checkName === 'circuit_breaker_gate');
    expect(gate).toBeDefined();
    expect(gate?.status).toBe('failed');
  });

  it('only includes the gate check when blocked (fast-fail path)', () => {
    const { engine, registry } = makeEngine();
    registry.trip('venue_failure', 'venue down');
    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    // Should have exactly one result: the gate check
    expect(assessment.results).toHaveLength(1);
    expect(assessment.results[0]?.checkName).toBe('circuit_breaker_gate');
  });

  it('passes after the tripped breaker is reset', () => {
    const { engine, registry } = makeEngine();
    registry.trip('venue_failure', 'venue down');
    registry.reset('venue_failure');
    const assessment = engine.assessOrderIntent(makeContext(), makePortfolioState());
    expect(assessment.overallStatus).not.toBe('failed'); // passes or warns
    expect(assessment.results.find((r) => r.checkName === 'circuit_breaker_gate')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateKillSwitch
// ---------------------------------------------------------------------------

describe('RiskEngine.evaluateKillSwitch', () => {
  it('does not halt when portfolio is healthy', () => {
    const { engine } = makeEngine();
    const result = engine.evaluateKillSwitch(makePortfolioState());
    expect(result.shouldHalt).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it('triggers halt when portfolio drawdown limit is breached', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ currentPortfolioDrawdownPct: 16.0 });
    const result = engine.evaluateKillSwitch(state);
    expect(result.shouldHalt).toBe(true);
    expect(result.reasons.some((r) => r.includes('Portfolio drawdown'))).toBe(true);
  });

  it('triggers halt when daily drawdown limit is breached', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ currentDailyDrawdownPct: 2.1 });
    const result = engine.evaluateKillSwitch(state);
    expect(result.shouldHalt).toBe(true);
    expect(result.reasons.some((r) => r.includes('Daily drawdown'))).toBe(true);
  });

  it('triggers halt when weekly drawdown limit is breached', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ currentWeeklyDrawdownPct: 5.1 });
    const result = engine.evaluateKillSwitch(state);
    expect(result.shouldHalt).toBe(true);
  });

  it('includes open circuit breakers in halt reasons', () => {
    const { engine, registry } = makeEngine();
    registry.trip('data_staleness', 'feed down');
    const result = engine.evaluateKillSwitch(makePortfolioState());
    expect(result.shouldHalt).toBe(true);
    expect(result.reasons.some((r) => r.includes('data_staleness'))).toBe(true);
  });

  it('reports multiple simultaneous reasons', () => {
    const { engine, registry } = makeEngine();
    registry.trip('venue_failure', 'venue A down');
    const state = makePortfolioState({
      currentDailyDrawdownPct: 3.0,
      currentPortfolioDrawdownPct: 16.0,
    });
    const result = engine.evaluateKillSwitch(state);
    expect(result.shouldHalt).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// getRiskSummary
// ---------------------------------------------------------------------------

describe('RiskEngine.getRiskSummary', () => {
  it('computes correct grossExposurePct', () => {
    const { engine } = makeEngine();
    // gross = 500_000, nav = 1_000_000 → 50 %
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.grossExposurePct).toBeCloseTo(50, 5);
  });

  it('computes correct leverage', () => {
    const { engine } = makeEngine();
    // gross = 500_000, nav = 1_000_000 → 0.5x
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.leverage).toBeCloseTo(0.5, 5);
  });

  it('computes correct liquidityReservePct', () => {
    const { engine } = makeEngine();
    // reserve = 300_000, nav = 1_000_000 → 30 %
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.liquidityReservePct).toBeCloseTo(30, 5);
  });

  it('riskLevel is normal for a healthy portfolio', () => {
    const { engine } = makeEngine();
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.riskLevel).toBe('normal');
  });

  it('riskLevel is elevated when drawdown is over 50 % of limit', () => {
    const { engine } = makeEngine();
    // daily limit = 2 %, 50 % = 1 %
    const state = makePortfolioState({ currentDailyDrawdownPct: 1.1 });
    const summary = engine.getRiskSummary(state);
    expect(summary.riskLevel).toBe('elevated');
  });

  it('riskLevel is high when drawdown is over 70 % of limit', () => {
    const { engine } = makeEngine();
    // daily limit = 2 %, 70 % = 1.4 %
    const state = makePortfolioState({ currentDailyDrawdownPct: 1.5 });
    const summary = engine.getRiskSummary(state);
    expect(summary.riskLevel).toBe('high');
  });

  it('riskLevel is critical when drawdown is 90 %+ of limit', () => {
    const { engine } = makeEngine();
    // daily limit = 2 %, 90 % = 1.8 %
    const state = makePortfolioState({ currentDailyDrawdownPct: 1.9 });
    const summary = engine.getRiskSummary(state);
    expect(summary.riskLevel).toBe('critical');
  });

  it('riskLevel is critical when any circuit breaker is open', () => {
    const { engine, registry } = makeEngine();
    registry.trip('execution_failure_rate', 'orders failing');
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.riskLevel).toBe('critical');
  });

  it('openCircuitBreakers lists the names of open breakers', () => {
    const { engine, registry } = makeEngine();
    registry.trip('data_staleness', 'feed dead');
    registry.trip('venue_failure', 'venue down');
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.openCircuitBreakers).toContain('data_staleness');
    expect(summary.openCircuitBreakers).toContain('venue_failure');
    expect(summary.openCircuitBreakers).toHaveLength(2);
  });

  it('openCircuitBreakers is empty when all breakers are closed', () => {
    const { engine } = makeEngine();
    const summary = engine.getRiskSummary(makePortfolioState());
    expect(summary.openCircuitBreakers).toHaveLength(0);
  });

  it('returns zero metrics when NAV is zero', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState({ totalNav: '0', grossExposure: '0', liquidityReserve: '0', netExposure: '0' });
    const summary = engine.getRiskSummary(state);
    expect(summary.grossExposurePct).toBe(0);
    expect(summary.leverage).toBe(0);
    expect(summary.liquidityReservePct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeStateAfterFill
// ---------------------------------------------------------------------------

describe('RiskEngine.computeStateAfterFill', () => {
  it('increases gross exposure after a non-closing fill', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState();

    const fill = {
      fillId: 'fill-001',
      orderId: 'order-001' as ReturnType<typeof import('@sentinel-apex/domain').toOrderId>,
      filledSize: '1',       // 1 BTC
      fillPrice: '50000',    // $50k
      fee: '50',
      feeAsset: 'USDT' as ReturnType<typeof import('@sentinel-apex/domain').toOpportunityId>,
      filledAt: new Date(),
      metadata: { side: 'buy', isClosing: false, markPriceUsd: '50000' },
    };

    const delta = engine.computeStateAfterFill(state, fill as unknown as import('@sentinel-apex/domain').OrderFill);
    expect(delta.grossExposure).toBeDefined();
    // gross should increase by fill notional (50_000)
    const newGross = parseFloat(delta.grossExposure!);
    expect(newGross).toBeCloseTo(550_000, 0);
  });

  it('decreases gross exposure after a closing fill', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState();

    const fill = {
      fillId: 'fill-002',
      orderId: 'order-002' as ReturnType<typeof import('@sentinel-apex/domain').toOrderId>,
      filledSize: '1',
      fillPrice: '50000',
      fee: '50',
      feeAsset: 'USDT' as ReturnType<typeof import('@sentinel-apex/domain').toOpportunityId>,
      filledAt: new Date(),
      metadata: { side: 'sell', isClosing: true, markPriceUsd: '50000' },
    };

    const delta = engine.computeStateAfterFill(state, fill as unknown as import('@sentinel-apex/domain').OrderFill);
    const newGross = parseFloat(delta.grossExposure!);
    // gross 500_000 - 50_000 = 450_000
    expect(newGross).toBeCloseTo(450_000, 0);
  });

  it('decreases liquidity reserve after a non-closing fill (margin consumed)', () => {
    const { engine } = makeEngine();
    const state = makePortfolioState();

    const fill = {
      fillId: 'fill-003',
      orderId: 'order-003' as ReturnType<typeof import('@sentinel-apex/domain').toOrderId>,
      filledSize: '1',
      fillPrice: '50000',
      fee: '50',
      feeAsset: 'USDT' as ReturnType<typeof import('@sentinel-apex/domain').toOpportunityId>,
      filledAt: new Date(),
      metadata: { side: 'buy', isClosing: false, markPriceUsd: '50000' },
    };

    const delta = engine.computeStateAfterFill(state, fill as unknown as import('@sentinel-apex/domain').OrderFill);
    const newReserve = parseFloat(delta.liquidityReserve!);
    // Should be less than 300_000
    expect(newReserve).toBeLessThan(300_000);
  });
});
