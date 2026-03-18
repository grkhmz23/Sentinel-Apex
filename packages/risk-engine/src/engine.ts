// =============================================================================
// Risk Engine — main entry point for pre-trade and portfolio-level risk checks
// =============================================================================
// All strategy execution must pass through RiskEngine.assessOrderIntent before
// any order is submitted to a venue.  No business logic bypasses this.
// =============================================================================

import Decimal from 'decimal.js';

import type { RiskAssessment, RiskCheckResult, OrderIntent, OrderFill } from '@sentinel-apex/domain';

import {
  checkGrossExposure,
  checkNetExposure,
  checkVenueConcentration,
  checkAssetConcentration,
  checkLeverage,
  checkLiquidityReserve,
  checkDrawdown,
  checkPriceStaleness,
  checkPositionSize,
} from './checks.js';
import { CircuitBreakerRegistry } from './circuit-breakers.js';

import type { CircuitBreakerName } from './circuit-breakers.js';
import type { RiskLimits } from './limits.js';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface PortfolioState {
  /** Total portfolio Net Asset Value in USD (decimal string). */
  totalNav: string;
  /** Sum of absolute position notionals in USD (decimal string). */
  grossExposure: string;
  /** Long notional minus short notional in USD (signed decimal string). */
  netExposure: string;
  /** Undeployed capital in USD (decimal string). */
  liquidityReserve: string;
  /** Current intra-day drawdown as a positive percentage (e.g. 1.5 = 1.5%). */
  currentDailyDrawdownPct: number;
  /** Current rolling 7-day drawdown as a positive percentage. */
  currentWeeklyDrawdownPct: number;
  /** Current peak-to-trough portfolio drawdown as a positive percentage. */
  currentPortfolioDrawdownPct: number;
  /** Per-venue absolute exposure.  venueId → USD decimal string. */
  venueExposures: Map<string, string>;
  /** Per-asset absolute exposure.  assetSymbol → USD decimal string. */
  assetExposures: Map<string, string>;
  /** Per-sleeve NAV.  sleeveId → USD decimal string. */
  sleeveNav: Map<string, string>;
  /** Number of currently open positions / opportunities. */
  openPositionCount: number;
}

export interface OrderIntentContext {
  /** The order intent from the strategy. */
  intent: OrderIntent;
  /** Execution venue ID. */
  venueId: string;
  /** Underlying asset symbol (e.g. 'BTC', 'ETH'). */
  assetSymbol: string;
  /** Absolute position size in USD (decimal string, always positive). */
  positionSizeUsd: string;
  /** Net delta in USD (positive = long, negative = short). */
  deltaUsd: string;
  /** Margin / collateral required for this position in USD (decimal string). */
  requiredMarginUsd: string;
  /** Timestamp of the most recent price tick used for sizing. */
  lastPriceUpdate: Date;
}

export interface RiskSummary {
  grossExposurePct: number;
  netExposurePct: number;
  leverage: number;
  liquidityReservePct: number;
  dailyDrawdownPct: number;
  weeklyDrawdownPct: number;
  portfolioDrawdownPct: number;
  openCircuitBreakers: CircuitBreakerName[];
  /** Rolled-up risk level for dashboards and alerting. */
  riskLevel: 'normal' | 'elevated' | 'high' | 'critical';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Rolls up an array of individual check results into a single overallStatus.
 * Any failed check → 'failed'.  Any warning (with no failures) → 'warning'.
 * All passed → 'passed'.
 */
function rollUpStatus(results: RiskCheckResult[]): 'passed' | 'failed' | 'warning' {
  let hasWarning = false;
  for (const r of results) {
    if (r.status === 'failed') return 'failed';
    if (r.status === 'warning') hasWarning = true;
  }
  return hasWarning ? 'warning' : 'passed';
}

/**
 * Classify portfolio risk level based on the worst metric.
 *
 * critical → any circuit breaker is open, OR drawdown ≥ 90 % of limit
 * high     → leverage > 80 % of max, OR drawdown > 70 % of limit
 * elevated → leverage > 60 % of max, OR drawdown > 50 % of limit
 * normal   → everything else
 */
function classifyRiskLevel(
  summary: Omit<RiskSummary, 'riskLevel'>,
  limits: RiskLimits,
): RiskSummary['riskLevel'] {
  if (summary.openCircuitBreakers.length > 0) return 'critical';

  const dailyRatio = summary.dailyDrawdownPct / limits.maxDailyDrawdownPct;
  const weeklyRatio = summary.weeklyDrawdownPct / limits.maxWeeklyDrawdownPct;
  const portfolioRatio = summary.portfolioDrawdownPct / limits.maxPortfolioDrawdownPct;
  const leverageRatio = summary.leverage / limits.maxLeverage;

  const worstDrawdown = Math.max(dailyRatio, weeklyRatio, portfolioRatio);

  if (worstDrawdown >= 0.9 || leverageRatio >= 0.95) return 'critical';
  if (worstDrawdown >= 0.7 || leverageRatio >= 0.8) return 'high';
  if (worstDrawdown >= 0.5 || leverageRatio >= 0.6) return 'elevated';
  return 'normal';
}

// ---------------------------------------------------------------------------
// RiskEngine
// ---------------------------------------------------------------------------

export class RiskEngine {
  constructor(
    private readonly limits: RiskLimits,
    private readonly circuitBreakers: CircuitBreakerRegistry,
  ) {}

  // ── Pre-trade assessment ──────────────────────────────────────────────────

  /**
   * Runs the full suite of pre-trade risk checks for the given order intent.
   *
   * Returns a RiskAssessment; callers MUST check overallStatus === 'passed'
   * before proceeding to submission.  Any 'failed' assessment must not result
   * in an order being sent to a venue.
   */
  assessOrderIntent(
    context: OrderIntentContext,
    portfolioState: PortfolioState,
  ): RiskAssessment {
    const results: RiskCheckResult[] = [];
    const now = new Date();

    // ── 0. Circuit breaker gate ───────────────────────────────────────────
    // If any circuit breaker is open, fail immediately without running other
    // checks.  This is intentionally fast-path — do not restructure as an
    // ordinary check so the failure mode is unmistakably severe.
    if (this.circuitBreakers.isAnyOpen()) {
      const openBreakers = this.circuitBreakers.getOpenBreakers();
      const names = openBreakers.map((b) => b.name).join(', ');
      results.push({
        checkName: 'circuit_breaker_gate',
        status: 'failed',
        message: `Execution blocked: circuit breaker(s) open — ${names}.`,
        limit: undefined,
        actual: undefined,
      });

      return {
        opportunityId: context.intent.opportunityId,
        orderId: null,
        results,
        overallStatus: 'failed',
        timestamp: now,
      };
    }

    // ── 1. Price staleness ────────────────────────────────────────────────
    results.push(checkPriceStaleness(context.lastPriceUpdate, now, this.limits));

    // ── 2. Gross exposure ─────────────────────────────────────────────────
    results.push(
      checkGrossExposure(
        portfolioState.grossExposure,
        context.positionSizeUsd,
        portfolioState.totalNav,
        this.limits,
      ),
    );

    // ── 3. Net exposure ───────────────────────────────────────────────────
    results.push(
      checkNetExposure(
        portfolioState.netExposure,
        context.deltaUsd,
        portfolioState.totalNav,
        this.limits,
      ),
    );

    // ── 4. Venue concentration ────────────────────────────────────────────
    const venueCurrentExposure = portfolioState.venueExposures.get(context.venueId) ?? '0';
    results.push(
      checkVenueConcentration(
        venueCurrentExposure,
        context.positionSizeUsd,
        portfolioState.grossExposure,
        this.limits,
      ),
    );

    // ── 5. Asset concentration ────────────────────────────────────────────
    const assetCurrentExposure = portfolioState.assetExposures.get(context.assetSymbol) ?? '0';
    results.push(
      checkAssetConcentration(
        assetCurrentExposure,
        context.positionSizeUsd,
        portfolioState.grossExposure,
        this.limits,
      ),
    );

    // ── 6. Leverage ───────────────────────────────────────────────────────
    results.push(
      checkLeverage(
        portfolioState.grossExposure,
        context.positionSizeUsd,
        portfolioState.totalNav,
        this.limits,
      ),
    );

    // ── 7. Liquidity reserve ──────────────────────────────────────────────
    results.push(
      checkLiquidityReserve(
        portfolioState.liquidityReserve,
        context.requiredMarginUsd,
        portfolioState.totalNav,
        this.limits,
      ),
    );

    // ── 8. Drawdown checks ────────────────────────────────────────────────
    results.push(checkDrawdown(portfolioState.currentDailyDrawdownPct, 'daily', this.limits));
    results.push(checkDrawdown(portfolioState.currentWeeklyDrawdownPct, 'weekly', this.limits));
    results.push(checkDrawdown(portfolioState.currentPortfolioDrawdownPct, 'portfolio', this.limits));

    // ── 9. Position size (sleeve-level) ───────────────────────────────────
    const sleeveId = String(context.intent.metadata['sleeveId'] ?? '');
    const sleeveNav = portfolioState.sleeveNav.get(sleeveId) ?? portfolioState.totalNav;
    results.push(checkPositionSize(context.positionSizeUsd, sleeveNav, this.limits));

    // ── 10. Open position count ───────────────────────────────────────────
    if (portfolioState.openPositionCount >= this.limits.maxOpportunityCount) {
      results.push({
        checkName: 'max_opportunity_count',
        status: 'failed',
        message: `Open position count (${portfolioState.openPositionCount}) has reached the limit of ${this.limits.maxOpportunityCount}.`,
        limit: String(this.limits.maxOpportunityCount),
        actual: String(portfolioState.openPositionCount),
      });
    } else if (portfolioState.openPositionCount >= Math.floor(this.limits.maxOpportunityCount * 0.9)) {
      results.push({
        checkName: 'max_opportunity_count',
        status: 'warning',
        message: `Open position count (${portfolioState.openPositionCount}) is approaching the limit of ${this.limits.maxOpportunityCount}.`,
        limit: String(this.limits.maxOpportunityCount),
        actual: String(portfolioState.openPositionCount),
      });
    } else {
      results.push({
        checkName: 'max_opportunity_count',
        status: 'passed',
        message: `Open position count (${portfolioState.openPositionCount}) is within the limit of ${this.limits.maxOpportunityCount}.`,
        limit: String(this.limits.maxOpportunityCount),
        actual: String(portfolioState.openPositionCount),
      });
    }

    return {
      opportunityId: context.intent.opportunityId,
      orderId: null,
      results,
      overallStatus: rollUpStatus(results),
      timestamp: now,
    };
  }

  // ── Portfolio-level kill switch ───────────────────────────────────────────

  /**
   * Evaluates whether any portfolio-level kill-switch conditions are met,
   * independent of a specific order intent.
   *
   * This is intended to be called on a heartbeat (e.g. every second) so that
   * drawdown limits cause an immediate halt even between order submissions.
   */
  evaluateKillSwitch(portfolioState: PortfolioState): {
    shouldHalt: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Daily drawdown
    if (portfolioState.currentDailyDrawdownPct > this.limits.maxDailyDrawdownPct) {
      reasons.push(
        `Daily drawdown (${portfolioState.currentDailyDrawdownPct.toFixed(2)}%) exceeds limit (${this.limits.maxDailyDrawdownPct}%).`,
      );
    }

    // Weekly drawdown
    if (portfolioState.currentWeeklyDrawdownPct > this.limits.maxWeeklyDrawdownPct) {
      reasons.push(
        `Weekly drawdown (${portfolioState.currentWeeklyDrawdownPct.toFixed(2)}%) exceeds limit (${this.limits.maxWeeklyDrawdownPct}%).`,
      );
    }

    // Portfolio drawdown
    if (portfolioState.currentPortfolioDrawdownPct > this.limits.maxPortfolioDrawdownPct) {
      reasons.push(
        `Portfolio drawdown (${portfolioState.currentPortfolioDrawdownPct.toFixed(2)}%) exceeds limit (${this.limits.maxPortfolioDrawdownPct}%).`,
      );
    }

    // Open circuit breakers
    const openBreakers = this.circuitBreakers.getOpenBreakers();
    for (const b of openBreakers) {
      reasons.push(`Circuit breaker '${b.name}' is open: ${b.tripCondition}`);
    }

    return {
      shouldHalt: reasons.length > 0,
      reasons,
    };
  }

  // ── Risk summary ──────────────────────────────────────────────────────────

  /**
   * Computes a snapshot of the current portfolio risk metrics.
   * Safe to call at any time; does not mutate state.
   */
  getRiskSummary(portfolioState: PortfolioState): RiskSummary {
    const nav = new Decimal(portfolioState.totalNav);
    const zero = new Decimal(0);

    const grossExposurePct = nav.isZero()
      ? 0
      : new Decimal(portfolioState.grossExposure).div(nav).times(100).toNumber();

    const netExposurePct = nav.isZero()
      ? 0
      : new Decimal(portfolioState.netExposure).abs().div(nav).times(100).toNumber();

    const leverage = nav.isZero()
      ? 0
      : new Decimal(portfolioState.grossExposure).div(nav).toNumber();

    const liquidityReservePct = nav.isZero()
      ? 0
      : new Decimal(portfolioState.liquidityReserve).div(nav).times(100).toNumber();

    void zero; // Decimal imported for potential future use; suppress lint

    const openCircuitBreakers = Array.from(this.circuitBreakers.getAll().values())
      .filter((b) => b.state === 'open')
      .map((b) => b.name);

    const partial: Omit<RiskSummary, 'riskLevel'> = {
      grossExposurePct,
      netExposurePct,
      leverage,
      liquidityReservePct,
      dailyDrawdownPct: portfolioState.currentDailyDrawdownPct,
      weeklyDrawdownPct: portfolioState.currentWeeklyDrawdownPct,
      portfolioDrawdownPct: portfolioState.currentPortfolioDrawdownPct,
      openCircuitBreakers,
    };

    return {
      ...partial,
      riskLevel: classifyRiskLevel(partial, this.limits),
    };
  }

  // ── Post-fill state delta ─────────────────────────────────────────────────

  /**
   * Computes the incremental changes to PortfolioState resulting from a fill.
   *
   * Returns a Partial<PortfolioState> with only the fields that change.
   * The caller is responsible for merging this delta into their authoritative
   * state store.
   *
   * Assumptions:
   *   - fill.filledSize is a positive decimal string (quantity of asset units)
   *   - The caller provides a USD mark price via fill metadata under 'markPriceUsd'
   *   - Positive delta = long fill, negative delta = short fill
   *   - The caller has already verified this fill is for an existing tracked position
   */
  computeStateAfterFill(
    current: PortfolioState,
    fill: OrderFill,
  ): Partial<PortfolioState> {
    // Resolve USD notional of the fill
    const markPriceUsd = String(fill['metadata' as keyof typeof fill] !== undefined
      ? (fill as unknown as { metadata: Record<string, unknown> }).metadata['markPriceUsd'] ?? fill.fillPrice
      : fill.fillPrice);

    const filledSize = new Decimal(fill.filledSize);
    const price = new Decimal(markPriceUsd);
    const fillNotionalUsd = filledSize.times(price);

    // Determine direction from fill metadata; default to long if absent
    const side = (fill as unknown as { metadata?: Record<string, unknown> }).metadata?.['side'];
    const isShort = side === 'sell' || side === 'short';
    const deltaUsd = isShort ? fillNotionalUsd.neg() : fillNotionalUsd;

    // Update gross exposure (always increases on open, decreases on close)
    // Here we assume every fill expands exposure.  The caller should negate
    // fillNotionalUsd if this is a closing fill.
    const isClosing = (fill as unknown as { metadata?: Record<string, unknown> }).metadata?.['isClosing'] === true;
    const grossDelta = isClosing ? fillNotionalUsd.neg() : fillNotionalUsd;

    const newGrossExposure = new Decimal(current.grossExposure).plus(grossDelta);
    const newNetExposure = new Decimal(current.netExposure).plus(isClosing ? deltaUsd.neg() : deltaUsd);

    // Liquidity reserve decreases by the margin consumed by the fill
    // (fee is subtracted from reserve as well)
    const fee = new Decimal(fill.fee);
    // Margin approximated as fill notional / max leverage for perps
    const marginConsumed = isClosing
      ? new Decimal(0)
      : fillNotionalUsd.div(new Decimal(this.limits.maxLeverage));
    const newLiquidityReserve = new Decimal(current.liquidityReserve)
      .minus(marginConsumed)
      .minus(fee);

    // Partial state update (Maps are returned as new instances)
    const delta: Partial<PortfolioState> = {
      grossExposure: newGrossExposure.toFixed(),
      netExposure: newNetExposure.toFixed(),
      liquidityReserve: newLiquidityReserve.toFixed(),
    };

    return delta;
  }
}
