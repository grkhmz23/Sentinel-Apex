/**
 * Multi-Leg Carry Orchestration
 * 
 * Coordinates execution of multiple legs for delta-neutral carry trades.
 * 
 * Phase R2 Implementation:
 * - Multi-leg plan creation and persistence
 * - Leg sequencing with dependency management
 * - Partial-failure handling
 * - Hedge deviation tracking
 * - Rebalance trigger detection
 */

import { Decimal } from 'decimal.js';

import { createLogger } from '@sentinel-apex/observability';
import { Result, Ok, Err } from '@sentinel-apex/shared';

import type {
  SpotPerpCoordinationConfig,
} from './spot-perp-coordination.js';

const logger = createLogger('multi-leg-orchestration');

// =============================================================================
// Types
// =============================================================================

export type LegStatus = 
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type PlanStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type HedgeStatus =
  | 'pending'
  | 'balanced'
  | 'imbalanced'
  | 'rebalancing'
  | 'closed';

export interface LegDefinition {
  legSequence: number;
  legType: 'spot' | 'perp' | 'futures';
  side: 'long' | 'short';
  venueId: string;
  asset: string;
  marketSymbol?: string | undefined;
  targetSize: Decimal;
  targetNotionalUsd: Decimal;
  dependsOn?: number; // legSequence of dependency
}

export interface MultiLegPlanInput {
  carryActionId: string;
  strategyRunId?: string;
  asset: string;
  notionalUsd: Decimal;
  legs: LegDefinition[];
  coordinationConfig: SpotPerpCoordinationConfig;
  maxHedgeDeviationPct: Decimal;
}

export interface MultiLegPlan {
  id: string;
  carryActionId: string;
  strategyRunId?: string | undefined;
  planType: 'delta_neutral_carry' | 'custom';
  asset: string;
  notionalUsd: Decimal;
  legCount: number;
  legs: LegExecution[];
  executionOrder: number[]; // legSequences in order
  status: PlanStatus;
  coordinationConfig: SpotPerpCoordinationConfig;
  maxHedgeDeviationPct: Decimal;
  hedgeDeviationPct?: Decimal | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegExecution {
  id: string;
  planId: string;
  carryActionId: string;
  legSequence: number;
  parentLegId?: string | undefined;
  legType: 'spot' | 'perp' | 'futures';
  side: 'long' | 'short';
  venueId: string;
  asset: string;
  marketSymbol?: string | undefined;
  targetSize: Decimal;
  targetNotionalUsd: Decimal;
  executedSize?: Decimal | undefined;
  executedNotionalUsd?: Decimal | undefined;
  status: LegStatus;
  executionMode: 'dry-run' | 'live';
  simulated: boolean;
  venueExecutionReference?: string | undefined; // Transaction signature
  filledSize?: Decimal | undefined;
  averageFillPrice?: Decimal | undefined;
  retryCount: number;
  maxRetries: number;
  lastError?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface HedgeState {
  id: string;
  planId: string;
  carryActionId: string;
  asset: string;
  pairType: 'spot_perp' | 'perp_perp';
  spotLeg?: LegExecution | undefined;
  perpLeg?: LegExecution | undefined;
  notionalUsd: Decimal;
  hedgeDeviationPct: Decimal;
  maxAllowedDeviationPct: Decimal;
  status: HedgeStatus;
  imbalanceDirection?: 'spot_heavy' | 'perp_heavy' | undefined;
  imbalanceThresholdBreached: boolean;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionResult {
  planId: string;
  status: PlanStatus;
  completedLegs: number;
  failedLegs: number;
  skippedLegs: number;
  totalLegs: number;
  hedgeDeviationPct?: Decimal | undefined;
  outcomeSummary: string;
  legResults: LegResult[];
}

export interface LegResult {
  legId: string;
  legSequence: number;
  status: LegStatus;
  filledSize?: Decimal | undefined;
  averageFillPrice?: Decimal | undefined;
  venueExecutionReference?: string | undefined;
  error?: string | undefined;
}

export interface PartialFailureHandling {
  action: 'continue' | 'rollback' | 'wait';
  waitTimeoutMs?: number;
  rollbackLegs?: number[];
}

// =============================================================================
// Plan Creation
// =============================================================================

export function createMultiLegPlan(
  input: MultiLegPlanInput
): Result<MultiLegPlan, Error> {
  try {
    // Validate leg count
    if (input.legs.length === 0) {
      return Err(new Error('Multi-leg plan must have at least one leg'));
    }

    // Validate leg sequences are unique and contiguous
    const sequences = input.legs.map(l => l.legSequence).sort((a, b) => a - b);
    for (let i = 0; i < sequences.length; i++) {
      if (sequences[i] !== i + 1) {
        return Err(new Error(`Leg sequences must be contiguous starting from 1. Missing: ${i + 1}`));
      }
    }

    // Build execution order based on dependencies
    const executionOrder = computeExecutionOrder(input.legs);
    if (executionOrder.length !== input.legs.length) {
      return Err(new Error('Circular dependency detected in leg dependencies'));
    }

    const now = new Date();
    const planId = `plan_${Date.now()}`;

    const plan: MultiLegPlan = {
      id: planId,
      carryActionId: input.carryActionId,
      strategyRunId: input.strategyRunId,
      planType: input.legs.length === 2 && 
                input.legs.some(l => l.legType === 'spot') && 
                input.legs.some(l => l.legType === 'perp')
                ? 'delta_neutral_carry' 
                : 'custom',
      asset: input.asset,
      notionalUsd: input.notionalUsd,
      legCount: input.legs.length,
      legs: input.legs.map(leg => ({
        id: `leg_${planId}_${leg.legSequence}`,
        planId,
        carryActionId: input.carryActionId,
        legSequence: leg.legSequence,
        legType: leg.legType,
        side: leg.side,
        venueId: leg.venueId,
        asset: leg.asset,
        marketSymbol: leg.marketSymbol,
        targetSize: leg.targetSize,
        targetNotionalUsd: leg.targetNotionalUsd,
        status: 'pending',
        executionMode: 'dry-run',
        simulated: true,
        retryCount: 0,
        maxRetries: 3,
        createdAt: now,
        updatedAt: now,
      })),
      executionOrder,
      status: 'pending',
      coordinationConfig: input.coordinationConfig,
      maxHedgeDeviationPct: input.maxHedgeDeviationPct,
      createdAt: now,
      updatedAt: now,
    };

    logger.info('Created multi-leg plan', {
      planId: plan.id,
      carryActionId: plan.carryActionId,
      legCount: plan.legCount,
      executionOrder: plan.executionOrder,
      planType: plan.planType,
    });

    return Ok(plan);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

function computeExecutionOrder(legs: LegDefinition[]): number[] {
  // Topological sort based on dependencies
  const visited = new Set<number>();
  const visiting = new Set<number>();
  const order: number[] = [];

  function visit(leg: LegDefinition): boolean {
    if (visited.has(leg.legSequence)) return true;
    if (visiting.has(leg.legSequence)) return false; // Circular

    visiting.add(leg.legSequence);

    // Visit dependency first
    if (leg.dependsOn !== undefined) {
      const dep = legs.find(l => l.legSequence === leg.dependsOn);
      if (dep && !visit(dep)) return false;
    }

    visiting.delete(leg.legSequence);
    visited.add(leg.legSequence);
    order.push(leg.legSequence);
    return true;
  }

  for (const leg of legs) {
    if (!visit(leg)) return []; // Circular dependency
  }

  return order;
}

// =============================================================================
// Hedge State Management
// =============================================================================

export function calculateHedgeState(
  plan: MultiLegPlan
): Result<HedgeState, Error> {
  try {
    // Find spot and perp legs
    const spotLeg = plan.legs.find(l => l.legType === 'spot' && l.status !== 'failed');
    const perpLeg = plan.legs.find(l => l.legType === 'perp' && l.status !== 'failed');

    if (!spotLeg || !perpLeg) {
      return Err(new Error('Cannot calculate hedge state: missing spot or perp leg'));
    }

    // Calculate executed sizes
    const spotSize = spotLeg.executedSize ?? new Decimal(0);
    const perpSize = perpLeg.executedSize ?? new Decimal(0);

    // Calculate deviation
    const targetSize = spotLeg.targetSize;
    const sizeDiff = spotSize.minus(perpSize).abs();
    const hedgeDeviationPct = targetSize.gt(0) 
      ? sizeDiff.div(targetSize).times(100)
      : new Decimal(0);

    // Determine status
    let status: HedgeStatus = 'pending';
    let imbalanceDirection: 'spot_heavy' | 'perp_heavy' | undefined;
    let imbalanceThresholdBreached = false;

    if (spotLeg.status === 'completed' && perpLeg.status === 'completed') {
      status = 'balanced';
    } else if (spotLeg.status === 'executing' || perpLeg.status === 'executing') {
      status = 'pending';
    }

    // Check imbalance
    if (hedgeDeviationPct.gt(plan.maxHedgeDeviationPct)) {
      imbalanceThresholdBreached = true;
      imbalanceDirection = spotSize.gt(perpSize) ? 'spot_heavy' : 'perp_heavy';
      if (status === 'balanced') {
        status = 'imbalanced';
      }
    }

    const now = new Date();
    const hedgeState: HedgeState = {
      id: `hedge_${plan.id}`,
      planId: plan.id,
      carryActionId: plan.carryActionId,
      asset: plan.asset,
      pairType: 'spot_perp',
      spotLeg,
      perpLeg,
      notionalUsd: plan.notionalUsd,
      hedgeDeviationPct,
      maxAllowedDeviationPct: plan.maxHedgeDeviationPct,
      status,
      imbalanceDirection,
      imbalanceThresholdBreached,
      lastCalculatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    return Ok(hedgeState);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

// =============================================================================
// Partial Failure Handling
// =============================================================================

export function determinePartialFailureAction(
  plan: MultiLegPlan,
  failedLegSequence: number,
  config: PartialFailureHandling
): PartialFailureHandling {
  const failedLegIndex = plan.executionOrder.indexOf(failedLegSequence);
  const remainingLegs = plan.executionOrder.slice(failedLegIndex + 1);

  logger.warn('Leg execution failed, determining partial failure action', {
    planId: plan.id,
    failedLegSequence,
    remainingLegs,
    action: config.action,
  });

  switch (config.action) {
    case 'rollback':
      return {
        action: 'rollback',
        rollbackLegs: plan.executionOrder.slice(0, failedLegIndex),
      };
    
    case 'wait':
      return {
        action: 'wait',
        waitTimeoutMs: config.waitTimeoutMs ?? 30000,
      };
    
    case 'continue':
    default:
      // Continue with remaining legs
      return { action: 'continue' };
  }
}

// =============================================================================
// Plan Status Update
// =============================================================================

export function updatePlanStatus(plan: MultiLegPlan): PlanStatus {
  const statuses = plan.legs.map(l => l.status);
  
  if (statuses.every(s => s === 'completed')) {
    return 'completed';
  }
  
  if (statuses.every(s => s === 'failed' || s === 'cancelled')) {
    return 'failed';
  }
  
  if (statuses.some(s => s === 'executing')) {
    return 'executing';
  }
  
  if (statuses.some(s => s === 'completed') && statuses.some(s => s === 'failed')) {
    return 'partial';
  }
  
  if (statuses.some(s => s === 'cancelled')) {
    return 'cancelled';
  }
  
  return 'pending';
}

// =============================================================================
// Execution Result Building
// =============================================================================

export function buildExecutionResult(plan: MultiLegPlan): ExecutionResult {
  const completedLegs = plan.legs.filter(l => l.status === 'completed').length;
  const failedLegs = plan.legs.filter(l => l.status === 'failed').length;
  const skippedLegs = plan.legs.filter(l => l.status === 'skipped').length;
  
  let outcomeSummary: string;
  if (plan.status === 'completed') {
    outcomeSummary = `All ${plan.legCount} legs completed successfully`;
  } else if (plan.status === 'partial') {
    outcomeSummary = `Partial completion: ${completedLegs}/${plan.legCount} legs completed, ${failedLegs} failed`;
  } else if (plan.status === 'failed') {
    outcomeSummary = `Execution failed: ${failedLegs}/${plan.legCount} legs failed`;
  } else {
    outcomeSummary = `Execution ${plan.status}`;
  }

  // Calculate hedge deviation if applicable
  const hedgeResult = calculateHedgeState(plan);
  const hedgeDeviationPct = hedgeResult.ok ? hedgeResult.value.hedgeDeviationPct : undefined;

  return {
    planId: plan.id,
    status: plan.status,
    completedLegs,
    failedLegs,
    skippedLegs,
    totalLegs: plan.legCount,
    hedgeDeviationPct,
    outcomeSummary,
    legResults: plan.legs.map(leg => ({
      legId: leg.id,
      legSequence: leg.legSequence,
      status: leg.status,
      filledSize: leg.filledSize,
      averageFillPrice: leg.averageFillPrice,
      venueExecutionReference: leg.venueExecutionReference,
      error: leg.lastError,
    })),
  };
}

// =============================================================================
// Validation
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMultiLegPlan(plan: MultiLegPlan): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check all legs have valid venues
  const uniqueVenues = new Set(plan.legs.map(l => l.venueId));
  if (uniqueVenues.size !== plan.legs.length) {
    warnings.push('Multiple legs use the same venue; ensure this is intentional');
  }

  // Check sizes add up to notional
  const totalTargetNotional = plan.legs.reduce(
    (sum, l) => sum.plus(l.targetNotionalUsd),
    new Decimal(0)
  );
  
  if (!totalTargetNotional.eq(plan.notionalUsd)) {
    warnings.push(`Target notional (${totalTargetNotional.toFixed()}) does not match plan notional (${new Decimal(plan.notionalUsd).toFixed()})`);
  }

  // Check for reduce-only conflicts
  const hasIncrease = plan.legs.some(l => l.side === 'long');
  const hasDecrease = plan.legs.some(l => l.side === 'short');
  
  if (hasIncrease && hasDecrease) {
    warnings.push('Plan has both long and short legs; verify hedge direction is correct');
  }

  // Validate spot-perp coordination
  if (plan.planType === 'delta_neutral_carry') {
    const spotLeg = plan.legs.find(l => l.legType === 'spot');
    const perpLeg = plan.legs.find(l => l.legType === 'perp');
    
    if (!spotLeg || !perpLeg) {
      errors.push('Delta-neutral plan must have exactly one spot and one perp leg');
    } else if (spotLeg.side === perpLeg.side) {
      errors.push('Delta-neutral plan requires opposite sides for spot and perp legs');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
