// =============================================================================
// Carry position PnL calculation
// =============================================================================

import Decimal from 'decimal.js';

export interface PositionPnl {
  realizedPnl: string;
  unrealizedPnl: string;
  /** Funding payments received (positive) or paid (negative). */
  fundingPnl: string;
  /** Total fees paid (always positive). */
  feeCost: string;
  /** realizedPnl + unrealizedPnl + fundingPnl - feeCost */
  netPnl: string;
  /** Annualized yield based on average position size and days held. */
  netAnnualizedYieldPct: string;
  holdingPeriodDays: number;
}

export interface ComputeCarryPnlParams {
  longEntryPrice: string;
  longCurrentPrice: string;
  /** Long leg size in base asset units */
  longSize: string;
  shortEntryPrice: string;
  shortCurrentPrice: string;
  /** Short leg size in base asset units */
  shortSize: string;
  /** Net funding received (positive = received, negative = paid) */
  fundingReceived: string;
  /** Total fees paid across all legs */
  totalFeesPaid: string;
  openedAt: Date;
  now: Date;
}

/**
 * Calculate PnL for a delta-neutral carry position (long + short legs).
 *
 * Unrealized PnL:
 *   long_unrealized  = (currentPrice - entryPrice) * longSize
 *   short_unrealized = (entryPrice - currentPrice) * shortSize
 *   total            = long_unrealized + short_unrealized
 *
 * For a perfectly hedged carry trade the unrealizedPnl should be near zero
 * (leg price movements cancel out); the net gain comes from funding.
 */
export function computeCarryPnl(params: ComputeCarryPnlParams): PositionPnl {
  const {
    longEntryPrice,
    longCurrentPrice,
    longSize,
    shortEntryPrice,
    shortCurrentPrice,
    shortSize,
    fundingReceived,
    totalFeesPaid,
    openedAt,
    now,
  } = params;

  const longEntry = new Decimal(longEntryPrice);
  const longCurrent = new Decimal(longCurrentPrice);
  const longSizeD = new Decimal(longSize);

  const shortEntry = new Decimal(shortEntryPrice);
  const shortCurrent = new Decimal(shortCurrentPrice);
  const shortSizeD = new Decimal(shortSize);

  const fundingD = new Decimal(fundingReceived);
  const feesD = new Decimal(totalFeesPaid);

  // Unrealized PnL per leg
  const longUnrealized = longCurrent.minus(longEntry).times(longSizeD);
  const shortUnrealized = shortEntry.minus(shortCurrent).times(shortSizeD);
  const unrealizedPnl = longUnrealized.plus(shortUnrealized);

  // For this calculation, positions are assumed to still be open so realized = 0
  const realizedPnl = new Decimal(0);

  const netPnl = realizedPnl.plus(unrealizedPnl).plus(fundingD).minus(feesD);

  // Holding period in days
  const holdingPeriodMs = now.getTime() - openedAt.getTime();
  const holdingPeriodDays = Math.max(holdingPeriodMs / (1_000 * 60 * 60 * 24), 1 / 1440); // at least 1 minute

  // Average position size (notional) in USD to normalize the yield
  const avgLongNotional = longEntry.plus(longCurrent).div(2).times(longSizeD);
  const avgShortNotional = shortEntry.plus(shortCurrent).div(2).times(shortSizeD);
  const avgNotional = avgLongNotional.plus(avgShortNotional).div(2);

  let netAnnualizedYieldPct: string;
  if (avgNotional.isZero()) {
    netAnnualizedYieldPct = '0';
  } else {
    // Annualize: (netPnl / avgNotional) × (365 / holdingPeriodDays) × 100
    const annualizedYield = netPnl
      .div(avgNotional)
      .times(365 / holdingPeriodDays)
      .times(100);
    netAnnualizedYieldPct = annualizedYield.toFixed(4);
  }

  return {
    realizedPnl: realizedPnl.toFixed(),
    unrealizedPnl: unrealizedPnl.toFixed(),
    fundingPnl: fundingD.toFixed(),
    feeCost: feesD.toFixed(),
    netPnl: netPnl.toFixed(),
    netAnnualizedYieldPct,
    holdingPeriodDays,
  };
}
