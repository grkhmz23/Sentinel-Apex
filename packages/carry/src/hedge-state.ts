// =============================================================================
// Hedge state computation
// =============================================================================

import Decimal from 'decimal.js';

import type { HedgeState } from '@sentinel-apex/domain';

// Tolerance band: within 5% size difference → fully hedged
export const HEDGE_TOLERANCE_PCT = '5';

export interface HedgeLegSizes {
  longSizeUsd: string;
  shortSizeUsd: string;
}

/**
 * Determine hedge state from the long and short leg sizes of a position pair.
 *
 * Rules:
 *   - Both sides zero → unhedged (nothing open)
 *   - Sizes within HEDGE_TOLERANCE_PCT of each other → fully_hedged
 *   - Imbalance > 5% → partially_hedged (one side is larger than the other)
 *   - Short > long by more than tolerance → over_hedged
 */
export function computeHedgeState(legs: HedgeLegSizes): HedgeState {
  const longSize = new Decimal(legs.longSizeUsd);
  const shortSize = new Decimal(legs.shortSizeUsd);

  const longIsZero = longSize.isZero();
  const shortIsZero = shortSize.isZero();

  if (longIsZero && shortIsZero) {
    return 'unhedged';
  }

  if (longIsZero || shortIsZero) {
    return 'unhedged';
  }

  // Percentage imbalance relative to the long size
  const imbalancePct = longSize.minus(shortSize).abs().div(longSize).times(100);

  if (imbalancePct.lessThanOrEqualTo(new Decimal(HEDGE_TOLERANCE_PCT))) {
    return 'fully_hedged';
  }

  // Short exceeds long beyond tolerance → over_hedged
  if (shortSize.greaterThan(longSize)) {
    const overHedgePct = shortSize.minus(longSize).div(longSize).times(100);
    if (overHedgePct.greaterThan(new Decimal(HEDGE_TOLERANCE_PCT))) {
      return 'over_hedged';
    }
  }

  return 'partially_hedged';
}
