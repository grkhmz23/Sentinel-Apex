// =============================================================================
// Risk limits configuration
// =============================================================================

/**
 * All configurable hard and soft limits for the risk engine.
 * Every field has a documented default so callers can spread over
 * DEFAULT_RISK_LIMITS and override only what they need.
 */
export interface RiskLimits {
  // ── Exposure ──────────────────────────────────────────────────────────────

  /** Maximum gross exposure as % of portfolio NAV.  Default: 200. */
  maxGrossExposurePct: number;

  /** Maximum net exposure (|long − short|) as % of portfolio NAV.  Default: 20. */
  maxNetExposurePct: number;

  /**
   * Maximum single-venue exposure as % of total gross exposure.  Default: 40.
   * Prevents over-concentration on one exchange.
   */
  maxSingleVenuePct: number;

  /**
   * Maximum single-asset exposure as % of total gross exposure.  Default: 30.
   * Prevents over-concentration in one underlying.
   */
  maxSingleAssetPct: number;

  // ── Leverage ──────────────────────────────────────────────────────────────

  /** Maximum portfolio-level leverage (gross exposure / NAV).  Default: 3.0. */
  maxLeverage: number;

  // ── Liquidity ─────────────────────────────────────────────────────────────

  /**
   * Minimum liquidity reserve that must remain undeployed, as % of NAV.
   * Default: 10.
   */
  minLiquidityReservePct: number;

  // ── Drawdown ──────────────────────────────────────────────────────────────

  /** Maximum intra-day drawdown as % of NAV before halting.  Default: 2. */
  maxDailyDrawdownPct: number;

  /** Maximum rolling 7-day drawdown as % of NAV before halting.  Default: 5. */
  maxWeeklyDrawdownPct: number;

  /** Maximum peak-to-trough portfolio drawdown as % of NAV.  Default: 15. */
  maxPortfolioDrawdownPct: number;

  // ── Stale data ────────────────────────────────────────────────────────────

  /** Maximum age of a price tick before it is considered stale, in seconds.  Default: 30. */
  maxPriceAgeSec: number;

  /** Maximum age of a funding-rate update before it is considered stale, in seconds.  Default: 60. */
  maxFundingRateAgeSec: number;

  // ── Per-sleeve sizing ─────────────────────────────────────────────────────

  /** Maximum size of a single position as % of the sleeve's NAV.  Default: 20. */
  maxPositionSizePct: number;

  /** Maximum number of concurrently open opportunities.  Default: 10. */
  maxOpportunityCount: number;
}

// ---------------------------------------------------------------------------

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  // Exposure
  maxGrossExposurePct: 200,
  maxNetExposurePct: 20,
  maxSingleVenuePct: 40,
  maxSingleAssetPct: 30,

  // Leverage
  maxLeverage: 3.0,

  // Liquidity
  minLiquidityReservePct: 10,

  // Drawdown
  maxDailyDrawdownPct: 2,
  maxWeeklyDrawdownPct: 5,
  maxPortfolioDrawdownPct: 15,

  // Stale data
  maxPriceAgeSec: 30,
  maxFundingRateAgeSec: 60,

  // Per-sleeve sizing
  maxPositionSizePct: 20,
  maxOpportunityCount: 10,
};
