// =============================================================================
// Spot-Perp Coordination for Delta-Neutral Carry Trades
// =============================================================================

import Decimal from 'decimal.js';

import { toOpportunityId, type OrderIntent } from '@sentinel-apex/domain';

/**
 * Leg of a delta-neutral hedge pair
 */
export interface HedgeLeg {
  side: 'long' | 'short';
  marketType: 'spot' | 'perp';
  venueId: string;
  size: string;
  targetSize: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * A delta-neutral hedge pair consisting of spot and perp legs
 */
export interface DeltaNeutralHedgePair {
  pairId: string;
  asset: string;
  spotLeg: HedgeLeg;
  perpLeg: HedgeLeg;
  notionalUsd: string;
  status: 'pending' | 'executing' | 'completed' | 'partial' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuration for spot-perp coordination
 */
export interface SpotPerpCoordinationConfig {
  /** Maximum allowed difference between spot and perp sizes (in pct) */
  maxHedgeDeviationPct: number;
  /** Whether to require perp leg before spot leg */
  perpFirst: boolean;
  /** Timeout for completing both legs (ms) */
  executionTimeoutMs: number;
  /** Minimum size increment for both legs */
  minimumSizeIncrement: string;
}

export const DEFAULT_SPOT_PERP_COORDINATION_CONFIG: SpotPerpCoordinationConfig = {
  maxHedgeDeviationPct: 1, // 1% max deviation
  perpFirst: true, // Execute perp first (usually more liquid)
  executionTimeoutMs: 30000, // 30 seconds
  minimumSizeIncrement: '0.0001',
};

export interface HedgeExecutionPlan {
  pair: DeltaNeutralHedgePair;
  executionOrder: ('spot' | 'perp')[];
  spotOrder: OrderIntent | null;
  perpOrder: OrderIntent | null;
}

export interface CoordinationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Create a delta-neutral hedge pair from opportunity parameters
 */
export function createHedgePair(
  params: {
    asset: string;
    notionalUsd: string;
    spotVenueId: string;
    perpVenueId: string;
    spotPrice: string;
    perpPrice: string;
  },
  config: SpotPerpCoordinationConfig = DEFAULT_SPOT_PERP_COORDINATION_CONFIG,
): DeltaNeutralHedgePair {
  const notionalUsd = new Decimal(params.notionalUsd);
  const spotPrice = new Decimal(params.spotPrice);
  const perpPrice = new Decimal(params.perpPrice);

  // Calculate sizes in base asset units
  const spotSize = notionalUsd.div(spotPrice);
  const perpSize = notionalUsd.div(perpPrice);

  const now = new Date();
  const pairId = `hedge-${params.asset}-${now.getTime()}`;

  return {
    pairId,
    asset: params.asset,
    spotLeg: {
      side: 'long', // Buy spot
      marketType: 'spot',
      venueId: params.spotVenueId,
      size: '0',
      targetSize: spotSize.toFixed(8),
      status: 'pending',
    },
    perpLeg: {
      side: 'short', // Short perp
      marketType: 'perp',
      venueId: params.perpVenueId,
      size: '0',
      targetSize: perpSize.toFixed(8),
      status: 'pending',
    },
    notionalUsd: notionalUsd.toFixed(2),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate that a hedge pair can be executed
 */
export function validateHedgePair(
  pair: DeltaNeutralHedgePair,
  config: SpotPerpCoordinationConfig = DEFAULT_SPOT_PERP_COORDINATION_CONFIG,
): CoordinationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const spotTarget = new Decimal(pair.spotLeg.targetSize);
  const perpTarget = new Decimal(pair.perpLeg.targetSize);

  // Check minimum size
  const minIncrement = new Decimal(config.minimumSizeIncrement);
  if (spotTarget.lt(minIncrement)) {
    errors.push(`Spot size ${spotTarget.toFixed(8)} is below minimum increment ${config.minimumSizeIncrement}`);
  }
  if (perpTarget.lt(minIncrement)) {
    errors.push(`Perp size ${perpTarget.toFixed(8)} is below minimum increment ${config.minimumSizeIncrement}`);
  }

  // Check size deviation
  const sizeDiff = spotTarget.minus(perpTarget).abs();
  const avgSize = spotTarget.plus(perpTarget).div(2);
  const deviationPct = avgSize.isZero() ? new Decimal(0) : sizeDiff.div(avgSize).times(100);

  if (deviationPct.gt(config.maxHedgeDeviationPct)) {
    warnings.push(
      `Size deviation ${deviationPct.toFixed(2)}% exceeds max ${config.maxHedgeDeviationPct}% ` +
      '(prices may have diverged)',
    );
  }

  // Check for same venue (should be different venues for redundancy)
  if (pair.spotLeg.venueId === pair.perpLeg.venueId) {
    warnings.push('Spot and perp legs use the same venue (reduces redundancy)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create execution plan for hedge pair
 */
export function createHedgeExecutionPlan(
  pair: DeltaNeutralHedgePair,
  config: SpotPerpCoordinationConfig = DEFAULT_SPOT_PERP_COORDINATION_CONFIG,
): HedgeExecutionPlan {
  const validation = validateHedgePair(pair, config);
  if (!validation.valid) {
    throw new Error(`Invalid hedge pair: ${validation.errors.join(', ')}`);
  }

  const executionOrder: ('spot' | 'perp')[] = config.perpFirst
    ? ['perp', 'spot']
    : ['spot', 'perp'];

  const spotOrder: OrderIntent = {
    intentId: `${pair.pairId}-spot`,
    venueId: pair.spotLeg.venueId,
    asset: pair.asset,
    side: pair.spotLeg.side === 'long' ? 'buy' : 'sell',
    type: 'market',
    size: pair.spotLeg.targetSize,
    limitPrice: null,
    opportunityId: toOpportunityId(pair.pairId),
    reduceOnly: false,
    createdAt: new Date(),
    metadata: {
      legType: 'spot',
      pairId: pair.pairId,
      targetNotionalUsd: pair.notionalUsd,
    },
  };

  const perpOrder: OrderIntent = {
    intentId: `${pair.pairId}-perp`,
    venueId: pair.perpLeg.venueId,
    asset: pair.asset,
    side: pair.perpLeg.side === 'long' ? 'buy' : 'sell',
    type: 'market',
    size: pair.perpLeg.targetSize,
    limitPrice: null,
    opportunityId: toOpportunityId(pair.pairId),
    reduceOnly: false,
    createdAt: new Date(),
    metadata: {
      legType: 'perp',
      pairId: pair.pairId,
      targetNotionalUsd: pair.notionalUsd,
    },
  };

  return {
    pair,
    executionOrder,
    spotOrder,
    perpOrder,
  };
}

/**
 * Update hedge pair with execution result
 */
export function updateHedgePairWithExecution(
  pair: DeltaNeutralHedgePair,
  legType: 'spot' | 'perp',
  executedSize: string,
  status: 'completed' | 'failed',
): DeltaNeutralHedgePair {
  const updated = { ...pair };
  const now = new Date();

  if (legType === 'spot') {
    updated.spotLeg = {
      ...updated.spotLeg,
      size: executedSize,
      status,
    };
  } else {
    updated.perpLeg = {
      ...updated.perpLeg,
      size: executedSize,
      status,
    };
  }

  // Determine overall status
  const spotDone = updated.spotLeg.status === 'completed' || updated.spotLeg.status === 'failed';
  const perpDone = updated.perpLeg.status === 'completed' || updated.perpLeg.status === 'failed';

  if (updated.spotLeg.status === 'failed' && updated.perpLeg.status === 'failed') {
    updated.status = 'failed';
  } else if (spotDone && perpDone) {
    updated.status = 'completed';
  } else if (spotDone || perpDone) {
    updated.status = 'partial';
  } else {
    updated.status = 'executing';
  }

  updated.updatedAt = now;
  return updated;
}

/**
 * Calculate hedge deviation between spot and perp legs
 */
export function calculateHedgeDeviation(
  spotSize: string,
  perpSize: string,
): { deviationPct: number; isBalanced: boolean } {
  const spot = new Decimal(spotSize);
  const perp = new Decimal(perpSize);

  const diff = spot.minus(perp).abs();
  const avg = spot.plus(perp).div(2);

  if (avg.isZero()) {
    return { deviationPct: 0, isBalanced: true };
  }

  const deviationPct = Number(diff.div(avg).times(100).toFixed(2));
  return {
    deviationPct,
    isBalanced: deviationPct <= 5, // 5% tolerance
  };
}

/**
 * Check if hedge pair is balanced
 */
export function isHedgeBalanced(
  pair: DeltaNeutralHedgePair,
  tolerancePct: number = 5,
): boolean {
  const spotSize = new Decimal(pair.spotLeg.size);
  const perpSize = new Decimal(pair.perpLeg.size);

  if (spotSize.isZero() || perpSize.isZero()) {
    return false;
  }

  const diff = spotSize.minus(perpSize).abs();
  const avg = spotSize.plus(perpSize).div(2);
  const deviationPct = Number(diff.div(avg).times(100));

  return deviationPct <= tolerancePct;
}

/**
 * Create reduction orders for closing a hedge pair
 */
export function createHedgeReductionOrders(
  pair: DeltaNeutralHedgePair,
  reductionPct: number = 100,
): { spotOrder: OrderIntent | null; perpOrder: OrderIntent | null } {
  const pct = new Decimal(reductionPct).div(100);
  const now = new Date();

  const spotReduceSize = new Decimal(pair.spotLeg.size).times(pct);
  const perpReduceSize = new Decimal(pair.perpLeg.size).times(pct);

  const spotOrder: OrderIntent | null = spotReduceSize.gt(0)
    ? {
        intentId: `${pair.pairId}-spot-reduce`,
        venueId: pair.spotLeg.venueId,
        asset: pair.asset,
        side: 'sell', // Sell spot to close long
        type: 'market',
        size: spotReduceSize.toFixed(8),
        limitPrice: null,
        opportunityId: toOpportunityId(pair.pairId),
        reduceOnly: true,
        createdAt: now,
        metadata: {
          legType: 'spot',
          pairId: pair.pairId,
          reductionPct,
          action: 'close_hedge',
        },
      }
    : null;

  const perpOrder: OrderIntent | null = perpReduceSize.gt(0)
    ? {
        intentId: `${pair.pairId}-perp-reduce`,
        venueId: pair.perpLeg.venueId,
        asset: pair.asset,
        side: 'buy', // Buy to close short
        type: 'market',
        size: perpReduceSize.toFixed(8),
        limitPrice: null,
        opportunityId: toOpportunityId(pair.pairId),
        reduceOnly: true,
        createdAt: now,
        metadata: {
          legType: 'perp',
          pairId: pair.pairId,
          reductionPct,
          action: 'close_hedge',
        },
      }
    : null;

  return { spotOrder, perpOrder };
}

/**
 * Calculate the funding capture for a balanced hedge
 */
export function calculateHedgeFundingCapture(
  pair: DeltaNeutralHedgePair,
  fundingRate: string, // 8-hour rate as decimal
  days: number,
): { estimatedCaptureUsd: string; annualizedPct: string } {
  const notional = new Decimal(pair.notionalUsd);
  const rate = new Decimal(fundingRate);
  const periods = new Decimal(days).times(3); // 3 periods per day (8-hour)

  // Perp short receives funding when rate is positive
  // Funding per period = notional * rate
  const fundingPerPeriod = notional.times(rate);
  const totalFunding = fundingPerPeriod.times(periods);

  // Annualized return
  const dailyFunding = fundingPerPeriod.times(3);
  const annualFunding = dailyFunding.times(365);
  const annualizedPct = notional.isZero()
    ? new Decimal(0)
    : annualFunding.div(notional).times(100);

  return {
    estimatedCaptureUsd: totalFunding.toFixed(2),
    annualizedPct: annualizedPct.toFixed(4),
  };
}
