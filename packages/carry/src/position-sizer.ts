// =============================================================================
// Carry position sizer — Kelly criterion-adjusted sizing
// =============================================================================

import Decimal from 'decimal.js';

import type { CarryConfig } from './config.js';

// ── Public API ────────────────────────────────────────────────────────────────

export interface ComputePositionSizeParams {
  /** Sleeve Net Asset Value in USD (decimal string). */
  sleeveNav: string;
  /** Expected annualized yield in percentage (e.g. "8.5" = 8.5%). */
  expectedYieldPct: string;
  /** Signal confidence score, 0–1. */
  confidenceScore: number;
  config: CarryConfig;
  /** Current sleeve gross exposure as % of NAV (e.g. "40" = 40%). */
  currentExposurePct: string;
}

export interface ComputeMaxAllowedSizeParams {
  /** Sleeve Net Asset Value in USD (decimal string). */
  sleeveNav: string;
  /** Number of currently open positions in this sleeve. */
  currentPositions: number;
  config: CarryConfig;
}

/**
 * Kelly criterion-adjusted position sizing.
 *
 * Full Kelly formula: f* = (bp - q) / b
 *   where b = odds (expected yield / risk), p = win probability, q = 1 - p.
 *
 * We use a simplified approximation suited to carry trades:
 *   rawKellyFraction = confidence × (expectedYieldPct / 100)
 *   scaledFraction   = rawKellyFraction × kellyCriterionFraction
 *   finalPct         = clamp(scaledFraction × 100, 0, maxPositionSizePct)
 *
 * Returns position size in USD.
 */
export function computePositionSize(params: ComputePositionSizeParams): string {
  const {
    sleeveNav,
    expectedYieldPct,
    confidenceScore,
    config,
    currentExposurePct,
  } = params;

  const navD = new Decimal(sleeveNav);
  if (navD.isZero()) {
    return '0';
  }

  const maxPositionSizePct = new Decimal(config.maxPositionSizePct);
  const kellyCriterionFraction = new Decimal(config.kellyCriterionFraction);
  const defaultSizePct = new Decimal(config.defaultPositionSizePct);

  // How much headroom remains before hitting max exposure?
  const currentExposure = new Decimal(currentExposurePct);
  const remainingCapacityPct = maxPositionSizePct.minus(currentExposure);

  if (remainingCapacityPct.lessThanOrEqualTo(0)) {
    // Already at or above maximum exposure for this sleeve
    return '0';
  }

  // Raw Kelly fraction: expectedYield (as fraction) × confidence
  const expectedYieldFraction = new Decimal(expectedYieldPct).div(100);
  const rawKellyFraction = expectedYieldFraction.times(confidenceScore);

  // Quarter-Kelly scaled to a percentage of NAV
  const scaledSizePct = rawKellyFraction.times(kellyCriterionFraction).times(100);

  // Floor at default, cap at maxPositionSizePct and remaining capacity
  const sizePct = Decimal.min(
    Decimal.max(scaledSizePct, defaultSizePct),
    maxPositionSizePct,
    remainingCapacityPct,
  );

  // Convert from % of NAV to USD amount
  const sizeUsd = navD.times(sizePct).div(100);

  return sizeUsd.toFixed(2);
}

/**
 * Compute the maximum additional position size allowed given current allocations.
 *
 * Returns the remaining capacity in USD, capped per opportunity count limits.
 */
export function computeMaxAllowedSize(params: ComputeMaxAllowedSizeParams): string {
  const { sleeveNav, currentPositions, config } = params;

  const navD = new Decimal(sleeveNav);
  if (navD.isZero()) {
    return '0';
  }

  // Check opportunity count limit
  if (currentPositions >= config.maxConcurrentOpportunities) {
    return '0';
  }

  // Maximum total exposure for the sleeve
  const maxTotalExposureUsd = navD.times(new Decimal(config.maxPositionSizePct)).div(100);

  // Per-position share: distribute remaining capacity equally across remaining slots
  const remainingSlots = config.maxConcurrentOpportunities - currentPositions;
  const perPositionMax = maxTotalExposureUsd.div(remainingSlots);

  // Never exceed defaultPositionSizePct per position
  const defaultSizeUsd = navD.times(new Decimal(config.defaultPositionSizePct)).div(100);
  const allowedSize = Decimal.min(perPositionMax, defaultSizeUsd);

  return allowedSize.toFixed(2);
}
