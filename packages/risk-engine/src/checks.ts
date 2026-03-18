// =============================================================================
// Individual risk check functions
// =============================================================================
// Each function is a pure function that takes relevant state and limits,
// performs all arithmetic with decimal.js, and returns a RiskCheckResult.
// No side effects; no mutation of shared state.
// =============================================================================

import Decimal from 'decimal.js';

import type { RiskCheckResult } from '@sentinel-apex/domain';

import type { RiskLimits } from './limits.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function passed(checkName: string, message: string, limit?: string, actual?: string): RiskCheckResult {
  return { checkName, status: 'passed', message, limit, actual };
}

function failed(checkName: string, message: string, limit?: string, actual?: string): RiskCheckResult {
  return { checkName, status: 'failed', message, limit, actual };
}

function warning(checkName: string, message: string, limit?: string, actual?: string): RiskCheckResult {
  return { checkName, status: 'warning', message, limit, actual };
}

/**
 * Percentage of `part` relative to `whole`, expressed as a number (0–100+).
 * Returns a Decimal to allow the caller to do further comparisons.
 */
function pct(part: Decimal, whole: Decimal): Decimal {
  return part.div(whole).times(100);
}

// ---------------------------------------------------------------------------
// Warning threshold: checks produce a warning at 90 % of the hard limit
// ---------------------------------------------------------------------------
const WARNING_FACTOR = new Decimal('0.90');

// ---------------------------------------------------------------------------
// Check 1: Gross exposure limit
// ---------------------------------------------------------------------------

/**
 * Verifies that adding `newPositionSize` to the existing gross exposure would
 * not breach `limits.maxGrossExposurePct` of portfolio NAV.
 *
 * @param currentGrossExposure - current absolute exposure in USD (decimal string)
 * @param newPositionSize      - additional absolute exposure in USD (decimal string)
 * @param portfolioNav         - total portfolio NAV in USD (decimal string)
 * @param limits               - active risk limits
 */
export function checkGrossExposure(
  currentGrossExposure: string,
  newPositionSize: string,
  portfolioNav: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'gross_exposure';

  const gross = new Decimal(currentGrossExposure);
  const newSize = new Decimal(newPositionSize);
  const nav = new Decimal(portfolioNav);
  const limitPct = new Decimal(limits.maxGrossExposurePct);

  if (nav.isZero()) {
    return failed(CHECK, 'Portfolio NAV is zero; cannot assess gross exposure.', limitPct.toFixed(), undefined);
  }

  const projectedGross = gross.plus(newSize);
  const projectedPct = pct(projectedGross, nav);
  const actualStr = projectedPct.toFixed(4);
  const limitStr = limitPct.toFixed(4);

  if (projectedPct.greaterThan(limitPct)) {
    return failed(
      CHECK,
      `Gross exposure would be ${projectedPct.toFixed(2)}% of NAV, exceeding limit of ${limits.maxGrossExposurePct}%.`,
      limitStr,
      actualStr,
    );
  }

  if (projectedPct.greaterThan(limitPct.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `Gross exposure would be ${projectedPct.toFixed(2)}% of NAV, approaching limit of ${limits.maxGrossExposurePct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Gross exposure would be ${projectedPct.toFixed(2)}% of NAV, within limit of ${limits.maxGrossExposurePct}%.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 2: Net exposure limit
// ---------------------------------------------------------------------------

/**
 * Verifies that applying `newPositionDelta` to the current net exposure would
 * not breach `limits.maxNetExposurePct` of portfolio NAV.
 *
 * @param currentNetExposure - current net (long − short) in USD (signed decimal string)
 * @param newPositionDelta   - the change in net exposure (positive = long, negative = short)
 * @param portfolioNav       - total portfolio NAV in USD (decimal string)
 * @param limits             - active risk limits
 */
export function checkNetExposure(
  currentNetExposure: string,
  newPositionDelta: string,
  portfolioNav: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'net_exposure';

  const net = new Decimal(currentNetExposure);
  const delta = new Decimal(newPositionDelta);
  const nav = new Decimal(portfolioNav);
  const limitPct = new Decimal(limits.maxNetExposurePct);

  if (nav.isZero()) {
    return failed(CHECK, 'Portfolio NAV is zero; cannot assess net exposure.', limitPct.toFixed(), undefined);
  }

  const projectedNet = net.plus(delta);
  const projectedAbsNet = projectedNet.abs();
  const projectedPct = pct(projectedAbsNet, nav);
  const actualStr = projectedPct.toFixed(4);
  const limitStr = limitPct.toFixed(4);

  if (projectedPct.greaterThan(limitPct)) {
    return failed(
      CHECK,
      `Net exposure would be ${projectedPct.toFixed(2)}% of NAV (net = ${projectedNet.toFixed(2)} USD), exceeding limit of ${limits.maxNetExposurePct}%.`,
      limitStr,
      actualStr,
    );
  }

  if (projectedPct.greaterThan(limitPct.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `Net exposure would be ${projectedPct.toFixed(2)}% of NAV, approaching limit of ${limits.maxNetExposurePct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Net exposure would be ${projectedPct.toFixed(2)}% of NAV, within limit of ${limits.maxNetExposurePct}%.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 3: Venue concentration
// ---------------------------------------------------------------------------

/**
 * Verifies that adding `newPositionSize` to a venue's existing exposure would
 * not breach `limits.maxSingleVenuePct` of total gross portfolio exposure.
 *
 * @param venueCurrentExposure    - this venue's current absolute exposure in USD
 * @param newPositionSize         - additional exposure being added to this venue
 * @param portfolioGrossExposure  - current total gross exposure across all venues
 * @param limits                  - active risk limits
 */
export function checkVenueConcentration(
  venueCurrentExposure: string,
  newPositionSize: string,
  portfolioGrossExposure: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'venue_concentration';

  const venueExposure = new Decimal(venueCurrentExposure);
  const newSize = new Decimal(newPositionSize);
  const portfolioGross = new Decimal(portfolioGrossExposure);
  const limitPct = new Decimal(limits.maxSingleVenuePct);

  // Project the total gross exposure after the new position is added
  const projectedPortfolioGross = portfolioGross.plus(newSize);
  const projectedVenueExposure = venueExposure.plus(newSize);

  if (projectedPortfolioGross.isZero()) {
    return failed(CHECK, 'Total gross exposure is zero; cannot compute venue concentration.', limitPct.toFixed(), undefined);
  }

  const projectedPct = pct(projectedVenueExposure, projectedPortfolioGross);
  const actualStr = projectedPct.toFixed(4);
  const limitStr = limitPct.toFixed(4);

  if (projectedPct.greaterThan(limitPct)) {
    return failed(
      CHECK,
      `Venue concentration would be ${projectedPct.toFixed(2)}% of gross exposure, exceeding limit of ${limits.maxSingleVenuePct}%.`,
      limitStr,
      actualStr,
    );
  }

  if (projectedPct.greaterThan(limitPct.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `Venue concentration would be ${projectedPct.toFixed(2)}% of gross exposure, approaching limit of ${limits.maxSingleVenuePct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Venue concentration would be ${projectedPct.toFixed(2)}% of gross exposure, within limit of ${limits.maxSingleVenuePct}%.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 4: Asset concentration
// ---------------------------------------------------------------------------

/**
 * Verifies that adding `newPositionSize` to an asset's existing exposure would
 * not breach `limits.maxSingleAssetPct` of total gross portfolio exposure.
 *
 * @param assetCurrentExposure   - this asset's current absolute exposure in USD
 * @param newPositionSize        - additional exposure being added for this asset
 * @param portfolioGrossExposure - current total gross exposure across all assets
 * @param limits                 - active risk limits
 */
export function checkAssetConcentration(
  assetCurrentExposure: string,
  newPositionSize: string,
  portfolioGrossExposure: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'asset_concentration';

  const assetExposure = new Decimal(assetCurrentExposure);
  const newSize = new Decimal(newPositionSize);
  const portfolioGross = new Decimal(portfolioGrossExposure);
  const limitPct = new Decimal(limits.maxSingleAssetPct);

  const projectedPortfolioGross = portfolioGross.plus(newSize);
  const projectedAssetExposure = assetExposure.plus(newSize);

  if (projectedPortfolioGross.isZero()) {
    return failed(CHECK, 'Total gross exposure is zero; cannot compute asset concentration.', limitPct.toFixed(), undefined);
  }

  const projectedPct = pct(projectedAssetExposure, projectedPortfolioGross);
  const actualStr = projectedPct.toFixed(4);
  const limitStr = limitPct.toFixed(4);

  if (projectedPct.greaterThan(limitPct)) {
    return failed(
      CHECK,
      `Asset concentration would be ${projectedPct.toFixed(2)}% of gross exposure, exceeding limit of ${limits.maxSingleAssetPct}%.`,
      limitStr,
      actualStr,
    );
  }

  if (projectedPct.greaterThan(limitPct.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `Asset concentration would be ${projectedPct.toFixed(2)}% of gross exposure, approaching limit of ${limits.maxSingleAssetPct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Asset concentration would be ${projectedPct.toFixed(2)}% of gross exposure, within limit of ${limits.maxSingleAssetPct}%.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 5: Leverage
// ---------------------------------------------------------------------------

/**
 * Verifies that adding `newPositionSize` to gross exposure would not push
 * leverage (gross / NAV) above `limits.maxLeverage`.
 *
 * @param currentGrossExposure - current absolute gross exposure in USD
 * @param newPositionSize      - additional absolute exposure being added
 * @param portfolioNav         - total portfolio NAV in USD
 * @param limits               - active risk limits
 */
export function checkLeverage(
  currentGrossExposure: string,
  newPositionSize: string,
  portfolioNav: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'leverage';

  const gross = new Decimal(currentGrossExposure);
  const newSize = new Decimal(newPositionSize);
  const nav = new Decimal(portfolioNav);
  const maxLeverage = new Decimal(limits.maxLeverage);

  if (nav.isZero()) {
    return failed(CHECK, 'Portfolio NAV is zero; cannot assess leverage.', maxLeverage.toFixed(), undefined);
  }

  const projectedGross = gross.plus(newSize);
  const projectedLeverage = projectedGross.div(nav);
  const actualStr = projectedLeverage.toFixed(4);
  const limitStr = maxLeverage.toFixed(4);

  if (projectedLeverage.greaterThan(maxLeverage)) {
    return failed(
      CHECK,
      `Leverage would be ${projectedLeverage.toFixed(3)}x, exceeding limit of ${limits.maxLeverage}x.`,
      limitStr,
      actualStr,
    );
  }

  if (projectedLeverage.greaterThan(maxLeverage.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `Leverage would be ${projectedLeverage.toFixed(3)}x, approaching limit of ${limits.maxLeverage}x.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Leverage would be ${projectedLeverage.toFixed(3)}x, within limit of ${limits.maxLeverage}x.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 6: Liquidity reserve
// ---------------------------------------------------------------------------

/**
 * Verifies that deploying `requiredMargin` would not push the liquidity
 * reserve below `limits.minLiquidityReservePct` of portfolio NAV.
 *
 * @param currentLiquidityReserve - current undeployed capital in USD
 * @param requiredMargin          - margin/collateral required for the new position
 * @param portfolioNav            - total portfolio NAV in USD
 * @param limits                  - active risk limits
 */
export function checkLiquidityReserve(
  currentLiquidityReserve: string,
  requiredMargin: string,
  portfolioNav: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'liquidity_reserve';

  const reserve = new Decimal(currentLiquidityReserve);
  const margin = new Decimal(requiredMargin);
  const nav = new Decimal(portfolioNav);
  const minReservePct = new Decimal(limits.minLiquidityReservePct);

  if (nav.isZero()) {
    return failed(CHECK, 'Portfolio NAV is zero; cannot assess liquidity reserve.', minReservePct.toFixed(), undefined);
  }

  const projectedReserve = reserve.minus(margin);
  const projectedReservePct = pct(projectedReserve, nav);
  const actualStr = projectedReservePct.toFixed(4);
  const limitStr = minReservePct.toFixed(4);

  if (projectedReservePct.lessThan(minReservePct)) {
    return failed(
      CHECK,
      `Liquidity reserve would drop to ${projectedReservePct.toFixed(2)}% of NAV (${projectedReserve.toFixed(2)} USD), below minimum of ${limits.minLiquidityReservePct}%.`,
      limitStr,
      actualStr,
    );
  }

  // Warn if reserve would fall within 20 % above the minimum
  // (i.e. reserve is between 100% and 120% of the minimum threshold)
  const warningThreshold = minReservePct.times('1.20');
  if (projectedReservePct.lessThan(warningThreshold)) {
    return warning(
      CHECK,
      `Liquidity reserve would be ${projectedReservePct.toFixed(2)}% of NAV, approaching minimum of ${limits.minLiquidityReservePct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Liquidity reserve would be ${projectedReservePct.toFixed(2)}% of NAV, above minimum of ${limits.minLiquidityReservePct}%.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 7: Drawdown
// ---------------------------------------------------------------------------

/**
 * Verifies that the current drawdown for the given period does not exceed
 * the corresponding limit.  This check is purely a state check — no delta
 * is applied since drawdown is computed continuously from P&L.
 *
 * @param currentDrawdownPct - current drawdown as a positive percentage (e.g. 1.5 = 1.5%)
 * @param period             - which drawdown window to evaluate
 * @param limits             - active risk limits
 */
export function checkDrawdown(
  currentDrawdownPct: number,
  period: 'daily' | 'weekly' | 'portfolio',
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = `drawdown_${period}`;

  const limitPct =
    period === 'daily'
      ? limits.maxDailyDrawdownPct
      : period === 'weekly'
        ? limits.maxWeeklyDrawdownPct
        : limits.maxPortfolioDrawdownPct;

  const current = new Decimal(currentDrawdownPct);
  const limit = new Decimal(limitPct);
  const actualStr = current.toFixed(4);
  const limitStr = limit.toFixed(4);

  if (current.greaterThan(limit)) {
    return failed(
      CHECK,
      `${period} drawdown is ${current.toFixed(2)}%, exceeding limit of ${limitPct}%.`,
      limitStr,
      actualStr,
    );
  }

  if (current.greaterThan(limit.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `${period} drawdown is ${current.toFixed(2)}%, approaching limit of ${limitPct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `${period} drawdown is ${current.toFixed(2)}%, within limit of ${limitPct}%.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 8: Price staleness
// ---------------------------------------------------------------------------

/**
 * Verifies that the most recent price tick is not older than
 * `limits.maxPriceAgeSec` seconds relative to `now`.
 *
 * @param lastPriceUpdate - timestamp of the most recent price update
 * @param now             - reference time (enables deterministic tests)
 * @param limits          - active risk limits
 */
export function checkPriceStaleness(
  lastPriceUpdate: Date,
  now: Date,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'price_staleness';

  const ageMs = now.getTime() - lastPriceUpdate.getTime();
  const ageSec = new Decimal(ageMs).div(1000);
  const maxAgeSec = new Decimal(limits.maxPriceAgeSec);
  const actualStr = ageSec.toFixed(3);
  const limitStr = maxAgeSec.toFixed(3);

  if (ageSec.greaterThan(maxAgeSec)) {
    return failed(
      CHECK,
      `Price data is ${ageSec.toFixed(1)}s old, exceeding stale threshold of ${limits.maxPriceAgeSec}s.`,
      limitStr,
      actualStr,
    );
  }

  // Warn at 80 % of the max age to give time to react
  if (ageSec.greaterThan(maxAgeSec.times('0.80'))) {
    return warning(
      CHECK,
      `Price data is ${ageSec.toFixed(1)}s old, approaching stale threshold of ${limits.maxPriceAgeSec}s.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Price data is ${ageSec.toFixed(1)}s old, within stale threshold of ${limits.maxPriceAgeSec}s.`,
    limitStr,
    actualStr,
  );
}

// ---------------------------------------------------------------------------
// Check 9: Position size
// ---------------------------------------------------------------------------

/**
 * Verifies that `newPositionSize` does not exceed `limits.maxPositionSizePct`
 * of the sleeve's NAV.
 *
 * @param newPositionSize - absolute size of the proposed position in USD
 * @param sleeveNav       - current NAV of the sleeve this position belongs to
 * @param limits          - active risk limits
 */
export function checkPositionSize(
  newPositionSize: string,
  sleeveNav: string,
  limits: RiskLimits,
): RiskCheckResult {
  const CHECK = 'position_size';

  const size = new Decimal(newPositionSize);
  const nav = new Decimal(sleeveNav);
  const limitPct = new Decimal(limits.maxPositionSizePct);

  if (nav.isZero()) {
    return failed(CHECK, 'Sleeve NAV is zero; cannot assess position size.', limitPct.toFixed(), undefined);
  }

  const sizePct = pct(size, nav);
  const actualStr = sizePct.toFixed(4);
  const limitStr = limitPct.toFixed(4);

  if (sizePct.greaterThan(limitPct)) {
    return failed(
      CHECK,
      `Position size is ${sizePct.toFixed(2)}% of sleeve NAV, exceeding limit of ${limits.maxPositionSizePct}%.`,
      limitStr,
      actualStr,
    );
  }

  if (sizePct.greaterThan(limitPct.times(WARNING_FACTOR))) {
    return warning(
      CHECK,
      `Position size is ${sizePct.toFixed(2)}% of sleeve NAV, approaching limit of ${limits.maxPositionSizePct}%.`,
      limitStr,
      actualStr,
    );
  }

  return passed(
    CHECK,
    `Position size is ${sizePct.toFixed(2)}% of sleeve NAV, within limit of ${limits.maxPositionSizePct}%.`,
    limitStr,
    actualStr,
  );
}
