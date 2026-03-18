// =============================================================================
// Intent builder — translates approved CarryOpportunityCandidate into OrderIntents
// =============================================================================

import Decimal from 'decimal.js';

import type { CarryOpportunityCandidate, OpportunityLeg } from '@sentinel-apex/carry';
import type { OpportunityId, OrderIntent } from '@sentinel-apex/domain';
import { toOpportunityId } from '@sentinel-apex/domain';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Build an intentId with the format:
 *   `${asset}-${type}-${orderSide}-${timestamp}`
 */
function buildIntentId(
  asset: string,
  opportunityType: string,
  side: 'long' | 'short',
  timestamp: number,
): string {
  const orderSide = side === 'long' ? 'buy' : 'sell';
  return `${asset}-${opportunityType}-${orderSide}-${timestamp}`;
}

/**
 * Divide the total position size equally between the legs.
 * Each leg receives half the total notional; size in base units = notional / price.
 */
function computeLegSizeUnits(leg: OpportunityLeg, totalNotionalUsd: string): string {
  const notionalPerLeg = new Decimal(totalNotionalUsd).div(2);
  const estimatedPrice = new Decimal(leg.estimatedPrice);

  if (estimatedPrice.isZero()) {
    return '0';
  }

  return notionalPerLeg.div(estimatedPrice).toFixed(8);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build OrderIntents from an approved CarryOpportunityCandidate.
 *
 * Each leg of the opportunity becomes one OrderIntent.  The opportunity is
 * expected to have exactly 2 legs (long + short) for a delta-neutral carry.
 *
 * @param opportunity      - the approved carry opportunity
 * @param sleeveId         - the sleeve in whose context this trade is placed
 * @param positionSizeUsd  - total notional to deploy across both legs (USD)
 */
export function buildIntentsFromOpportunity(
  opportunity: CarryOpportunityCandidate,
  sleeveId: string,
  positionSizeUsd: string,
): OrderIntent[] {
  const timestamp = Date.now();

  // Derive a stable opportunity ID from the asset, type, and detection time
  const opportunityId: OpportunityId = toOpportunityId(
    `${opportunity.asset}-${opportunity.type}-${opportunity.detectedAt.getTime()}`,
  );

  const intents: OrderIntent[] = [];

  for (const leg of opportunity.legs) {
    const intentId = buildIntentId(opportunity.asset, opportunity.type, leg.side, timestamp);
    const orderSide = leg.side === 'long' ? ('buy' as const) : ('sell' as const);
    const sizeUnits = computeLegSizeUnits(leg, positionSizeUsd);

    const intent: OrderIntent = {
      intentId,
      venueId: leg.venueId,
      asset: leg.asset,
      side: orderSide,
      type: 'market',
      size: sizeUnits,
      limitPrice: null,
      opportunityId,
      reduceOnly: false,
      createdAt: new Date(timestamp),
      metadata: {
        sleeveId,
        opportunityType: opportunity.type,
        instrumentType: leg.instrumentType,
        legSide: leg.side,
        estimatedPrice: leg.estimatedPrice,
        estimatedFee: leg.estimatedFee,
        expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
        netYieldPct: opportunity.netYieldPct,
        positionSizeUsd,
      },
    };

    intents.push(intent);
  }

  return intents;
}
