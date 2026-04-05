/**
 * Carry Orchestration Adapter
 *
 * Clean adapter layer between runtime and carry orchestration types.
 * Handles type conversions: Decimal, side mappings, config shapes.
 */

import Decimal from 'decimal.js';

import type {
  LegDefinition,
  MultiLegPlanInput,
  SpotPerpCoordinationConfig,
} from '@sentinel-apex/carry';

import type { CarryActionPlannedOrderView } from '../types.js';

/**
 * Convert planned order side to leg side
 * buy -> long (spot leg)
 * sell -> short (perp leg)
 */
export function toLegSide(
  plannedOrderSide: 'buy' | 'sell',
  legType: 'spot' | 'perp'
): 'long' | 'short' {
  // For delta-neutral carry:
  // - Spot leg (buy side) = long position
  // - Perp leg (sell side) = short position
  if (legType === 'spot') {
    return 'long';
  }
  return 'short';
}

/**
 * Convert runtime planned order to carry LegDefinition
 */
export function toLegDefinition(
  plannedOrder: CarryActionPlannedOrderView,
  legSequence: number,
  legType: 'spot' | 'perp'
): LegDefinition {
  const targetSize = new Decimal(plannedOrder.requestedSize);
  const targetPrice = new Decimal(plannedOrder.requestedPrice ?? '0');
  const targetNotionalUsd = targetSize.mul(targetPrice);

  return {
    legSequence,
    legType,
    side: toLegSide(plannedOrder.side, legType),
    venueId: plannedOrder.venueId,
    asset: plannedOrder.asset,
    marketSymbol: plannedOrder.asset, // Use asset as market symbol
    targetSize,
    targetNotionalUsd,
    // No dependencies for simple 2-leg delta-neutral
  };
}

/**
 * Create default SpotPerpCoordinationConfig
 */
export function createCoordinationConfig(
  overrides?: Partial<SpotPerpCoordinationConfig>
): SpotPerpCoordinationConfig {
  return {
    maxHedgeDeviationPct: 2.0, // 2% max deviation
    perpFirst: true, // Execute perp first (usually more liquid)
    executionTimeoutMs: 30000, // 30 seconds
    minimumSizeIncrement: '0.0001',
    ...overrides,
  };
}

/**
 * Build leg definitions from planned orders
 * For delta-neutral: assumes first order is spot (buy/long),
 * second order is perp (sell/short)
 */
export function buildLegDefinitions(
  plannedOrders: CarryActionPlannedOrderView[]
): LegDefinition[] {
  if (plannedOrders.length < 2) {
    throw new Error(
      `Multi-leg execution requires at least 2 legs, got ${plannedOrders.length}`
    );
  }

  // For delta-neutral carry, we expect:
  // - Leg 0: Spot leg (buy -> long)
  // - Leg 1: Perp leg (sell -> short)
  return plannedOrders.map((order, index) => {
    const legType = index === 0 ? 'spot' : 'perp';
    return toLegDefinition(order, index, legType);
  });
}

/**
 * Calculate total notional from planned orders
 */
export function calculateTotalNotional(
  plannedOrders: CarryActionPlannedOrderView[]
): Decimal {
  return plannedOrders.reduce((sum, order) => {
    const size = new Decimal(order.requestedSize);
    const price = new Decimal(order.requestedPrice ?? '0');
    return sum.plus(size.mul(price));
  }, new Decimal(0));
}

/**
 * Build MultiLegPlanInput from runtime data
 */
export function buildMultiLegPlanInput(
  carryActionId: string,
  strategyRunId: string | null,
  asset: string,
  plannedOrders: CarryActionPlannedOrderView[]
): MultiLegPlanInput {
  const legs = buildLegDefinitions(plannedOrders);
  const notionalUsd = calculateTotalNotional(plannedOrders);

  const result: MultiLegPlanInput = {
    carryActionId,
    asset,
    notionalUsd,
    legs,
    coordinationConfig: createCoordinationConfig(),
    maxHedgeDeviationPct: new Decimal(2.0),
  };
  
  if (strategyRunId !== null) {
    result.strategyRunId = strategyRunId;
  }
  
  return result;
}

/**
 * Calculate execution order based on coordination config
 * Returns leg sequences in execution order
 */
export function calculateExecutionOrder(
  config: SpotPerpCoordinationConfig,
  legCount: number
): number[] {
  const order: number[] = [];

  for (let i = 0; i < legCount; i++) {
    order.push(i);
  }

  // If perpFirst is true, put perp leg (index 1) before spot leg (index 0)
  if (config.perpFirst && legCount >= 2) {
    return [1, 0, ...order.slice(2)];
  }

  return order;
}

/**
 * Calculate hedge deviation between spot and perp legs
 */
export function calculateHedgeDeviation(
  spotExecutedSize: string,
  perpExecutedSize: string
): { deviationPct: number; imbalanceDirection: 'spot_heavy' | 'perp_heavy' | 'balanced' } {
  const spot = new Decimal(spotExecutedSize);
  const perp = new Decimal(perpExecutedSize);

  const avgExecuted = spot.plus(perp).div(2);

  if (avgExecuted.isZero()) {
    return { deviationPct: 0, imbalanceDirection: 'balanced' };
  }

  const diff = spot.minus(perp).abs();
  const deviationPct = diff.div(avgExecuted).mul(100).toNumber();

  let imbalanceDirection: 'spot_heavy' | 'perp_heavy' | 'balanced' = 'balanced';
  if (spot.gt(perp)) {
    imbalanceDirection = 'spot_heavy';
  } else if (perp.gt(spot)) {
    imbalanceDirection = 'perp_heavy';
  }

  return { deviationPct, imbalanceDirection };
}
