import Decimal from 'decimal.js';

import { toOpportunityId, type OrderIntent } from '@sentinel-apex/domain';
import type { CarryVenueCapabilities } from '@sentinel-apex/venue-adapters';

import type {
  CarryControlledExecutionPlanningInput,
  CarryExecutionEffects,
  CarryExecutionIntent,
  CarryExecutionRecommendation,
  CarryOperationalBlockedReason,
  CarryOperationalPolicy,
  CarryPositionSnapshot,
} from './types.js';

export const DEFAULT_CARRY_OPERATIONAL_POLICY: CarryOperationalPolicy = {
  minimumActionableUsd: '2500',
  minimumConfidenceScore: 0.6,
};

function buildBlockedReason(
  code: CarryOperationalBlockedReason['code'],
  category: CarryOperationalBlockedReason['category'],
  message: string,
  operatorAction: string,
  details: Record<string, unknown> = {},
): CarryOperationalBlockedReason {
  return {
    code,
    category,
    message,
    operatorAction,
    details,
  };
}

function buildEffects(
  recommendation: CarryExecutionRecommendation,
  input: CarryControlledExecutionPlanningInput,
): CarryExecutionEffects {
  const currentCarryAllocationUsd = new Decimal(input.currentCarryAllocationUsd);
  const recommendedNotionalUsd = new Decimal(recommendation.notionalUsd);
  const projectedCarryAllocationUsd = recommendation.actionType === 'reduce_carry_exposure'
    ? Decimal.max(currentCarryAllocationUsd.minus(recommendedNotionalUsd), 0)
    : currentCarryAllocationUsd.plus(recommendedNotionalUsd);
  const totalCapitalUsd = input.totalCapitalUsd === null
    ? null
    : new Decimal(input.totalCapitalUsd);
  const projectedCarryAllocationPct = totalCapitalUsd === null || totalCapitalUsd.lte(0)
    ? null
    : Number(projectedCarryAllocationUsd.div(totalCapitalUsd).times(100).toFixed(4));
  const approvedCarryBudgetUsd = input.approvedCarryBudgetUsd === null
    ? null
    : new Decimal(input.approvedCarryBudgetUsd);
  const projectedRemainingBudgetUsd = approvedCarryBudgetUsd === null
    ? null
    : Decimal.max(approvedCarryBudgetUsd.minus(projectedCarryAllocationUsd), 0);

  return {
    currentCarryAllocationUsd: currentCarryAllocationUsd.toFixed(2),
    projectedCarryAllocationUsd: projectedCarryAllocationUsd.toFixed(2),
    projectedCarryAllocationPct,
    approvedCarryBudgetUsd: approvedCarryBudgetUsd?.toFixed(2) ?? null,
    projectedRemainingBudgetUsd: projectedRemainingBudgetUsd?.toFixed(2) ?? null,
    openPositionCount: input.openPositions.length,
  };
}

function findCarryVenueCapabilities(
  capabilities: CarryVenueCapabilities[],
  venueId: string,
): CarryVenueCapabilities | null {
  return capabilities.find((item) => item.venueId === venueId) ?? null;
}

function notionalOfPosition(position: CarryPositionSnapshot): Decimal {
  return new Decimal(position.size).times(position.markPrice);
}

export function buildCarryReductionIntents(
  positions: CarryPositionSnapshot[],
  notionalReductionUsd: string,
  sourceReference: string,
  createdAt: Date = new Date(),
): OrderIntent[] {
  const sorted = [...positions].sort((left, right) =>
    notionalOfPosition(right).comparedTo(notionalOfPosition(left)),
  );
  const opportunityId = toOpportunityId(`carry-reduction-${sourceReference}-${createdAt.getTime()}`);
  let remaining = new Decimal(notionalReductionUsd);
  const intents: OrderIntent[] = [];

  for (const position of sorted) {
    if (remaining.lte(0)) {
      break;
    }

    const markPrice = new Decimal(position.markPrice);
    if (markPrice.lte(0)) {
      continue;
    }

    const maxReducibleUsd = notionalOfPosition(position);
    const reducingUsd = Decimal.min(maxReducibleUsd, remaining);
    const reducingUnits = reducingUsd.div(markPrice);
    const side = position.side === 'long' ? 'sell' : 'buy';

    intents.push({
      intentId: `${position.asset}-carry-reduce-${side}-${createdAt.getTime()}-${intents.length + 1}`,
      venueId: position.venueId,
      asset: position.asset,
      side,
      type: 'market',
      size: reducingUnits.toFixed(8),
      limitPrice: null,
      opportunityId,
      reduceOnly: true,
      createdAt,
      metadata: {
        actionType: 'reduce_carry_exposure',
        sourceReference,
        positionId: position.positionId,
        plannedReductionUsd: reducingUsd.toFixed(2),
      },
    });

    remaining = remaining.minus(reducingUsd);
  }

  return intents;
}

export class CarryControlledExecutionPlanner {
  createExecutionIntents(
    input: CarryControlledExecutionPlanningInput,
  ): CarryExecutionIntent[] {
    const policy: CarryOperationalPolicy = {
      ...DEFAULT_CARRY_OPERATIONAL_POLICY,
      ...input.policy,
    };

    return input.recommendations.map((recommendation) => {
      const amountUsd = new Decimal(recommendation.notionalUsd);
      const blockedReasons: CarryOperationalBlockedReason[] = [];
      const effects = buildEffects(recommendation, input);

      if (amountUsd.lt(policy.minimumActionableUsd)) {
        blockedReasons.push(buildBlockedReason(
          'below_minimum_action_size',
          'action_size',
          `Carry action ${amountUsd.toFixed(2)} USD is below the minimum actionable threshold.`,
          'Increase the target notional or wait for a larger budget/exposure change.',
          {
            amountUsd: amountUsd.toFixed(2),
            minimumActionableUsd: policy.minimumActionableUsd,
          },
        ));
      }

      if (
        input.runtimeHalted
        || input.runtimeLifecycleState === 'paused'
        || input.runtimeLifecycleState === 'stopped'
        || input.runtimeLifecycleState === 'starting'
        || input.runtimeLifecycleState === 'degraded'
      ) {
        blockedReasons.push(buildBlockedReason(
          'runtime_not_ready',
          'runtime',
          'Runtime is not in a state that permits carry execution.',
          'Return runtime to ready state before approving or executing carry actions.',
          {
            runtimeLifecycleState: input.runtimeLifecycleState,
            runtimeHalted: input.runtimeHalted,
          },
        ));
      }

      if (input.criticalMismatchCount > 0) {
        blockedReasons.push(buildBlockedReason(
          'critical_mismatch_pressure',
          'risk',
          'Critical mismatch pressure blocks carry execution.',
          'Resolve or verify critical mismatches before executing carry actions.',
          { criticalMismatchCount: input.criticalMismatchCount },
        ));
      }

      if (
        recommendation.actionType !== 'reduce_carry_exposure'
        && (
          input.carryThrottleState === 'throttled'
          || input.carryThrottleState === 'de_risk'
          || input.carryThrottleState === 'blocked'
        )
      ) {
        blockedReasons.push(buildBlockedReason(
          'carry_throttle_active',
          'risk',
          'Carry sleeve throttle state blocks new carry deployment.',
          'Wait for carry throttle state to return to normal before increasing exposure.',
          { carryThrottleState: input.carryThrottleState },
        ));
      }

      if (
        recommendation.actionType !== 'reduce_carry_exposure'
        && input.approvedCarryBudgetUsd !== null
        && new Decimal(input.currentCarryAllocationUsd).plus(amountUsd).gt(input.approvedCarryBudgetUsd)
      ) {
        blockedReasons.push(buildBlockedReason(
          'carry_budget_exceeded',
          'budget',
          'Carry action would exceed the currently approved carry budget.',
          'Approve more carry budget or reduce the planned carry action size.',
          {
            currentCarryAllocationUsd: input.currentCarryAllocationUsd,
            approvedCarryBudgetUsd: input.approvedCarryBudgetUsd,
            actionNotionalUsd: amountUsd.toFixed(2),
          },
        ));
      }

      if (typeof recommendation.details['confidenceScore'] === 'number' && Number(recommendation.details['confidenceScore']) < policy.minimumConfidenceScore) {
        blockedReasons.push(buildBlockedReason(
          'opportunity_confidence_below_threshold',
          'opportunity',
          'Carry opportunity confidence is below the execution threshold.',
          'Wait for stronger carry conditions before executing this action.',
          {
            confidenceScore: recommendation.details['confidenceScore'],
            minimumConfidenceScore: policy.minimumConfidenceScore,
          },
        ));
      }

      if (typeof recommendation.details['expiresAt'] === 'string') {
        const expiresAt = new Date(String(recommendation.details['expiresAt']));
        if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= input.now.getTime()) {
          blockedReasons.push(buildBlockedReason(
            'opportunity_expired',
            'opportunity',
            'Carry opportunity has expired and should not be executed.',
            'Re-run carry evaluation and use a currently actionable opportunity.',
            { expiresAt: expiresAt.toISOString() },
          ));
        }
      }

      if (recommendation.actionType === 'reduce_carry_exposure' && recommendation.plannedOrders.length === 0) {
        blockedReasons.push(buildBlockedReason(
          'no_open_positions',
          'exposure',
          'No open carry positions were available to reduce.',
          'Refresh carry positions before attempting a reduction action.',
        ));
      }

      if (
        recommendation.actionType === 'reduce_carry_exposure'
        && typeof recommendation.details['coveredNotionalUsd'] === 'string'
        && new Decimal(String(recommendation.details['coveredNotionalUsd'])).lt(amountUsd)
      ) {
        blockedReasons.push(buildBlockedReason(
          'insufficient_position_reduction_capacity',
          'exposure',
          'Planned reduction exceeds currently reducible carry exposure.',
          'Lower the reduction amount or wait for more carry exposure to become reducible.',
          {
            coveredNotionalUsd: recommendation.details['coveredNotionalUsd'],
            requestedNotionalUsd: amountUsd.toFixed(2),
          },
        ));
      }

      const touchedVenues = new Set(recommendation.plannedOrders.map((order) => order.venueId));
      let simulated = true;
      let approvalRequirement: CarryExecutionIntent['approvalRequirement'] = 'operator';

      for (const venueId of touchedVenues) {
        const capability = findCarryVenueCapabilities(input.venueCapabilities, venueId);
        if (capability === null || !capability.executionSupported) {
          blockedReasons.push(buildBlockedReason(
            'venue_execution_unsupported',
            'venue_capability',
            `Carry venue ${venueId} does not support controlled carry execution.`,
            'Keep the action in simulated/read-only mode until connector support is implemented.',
            { venueId },
          ));
          continue;
        }

        simulated = simulated && capability.venueMode !== 'live';
        if (capability.venueMode === 'live') {
          approvalRequirement = 'admin';
        }

        if (capability.readOnly) {
          blockedReasons.push(buildBlockedReason(
            'venue_execution_unsupported',
            'venue_capability',
            `Carry venue ${venueId} is read-only for execution.`,
            'Promote the connector out of read-only mode before executing carry actions.',
            { venueId },
          ));
        }

        if (
          recommendation.actionType === 'reduce_carry_exposure'
            ? !capability.supportsReduceExposure
            : !capability.supportsIncreaseExposure
        ) {
          blockedReasons.push(buildBlockedReason(
            'venue_execution_unsupported',
            'venue_capability',
            `Carry venue ${venueId} does not support ${recommendation.actionType}.`,
            'Use a venue with explicit support for this carry action type.',
            {
              venueId,
              actionType: recommendation.actionType,
            },
          ));
        }

        if (capability.venueMode === 'live' && !capability.approvedForLiveUse) {
          blockedReasons.push(buildBlockedReason(
            'venue_live_unapproved',
            'venue_capability',
            `Carry venue ${venueId} is not approved for live use.`,
            'Complete onboarding and live-enable review before using live carry execution.',
            { venueId },
          ));
        }

        if (capability.venueMode === 'live' && (!input.liveExecutionEnabled || input.executionMode !== 'live')) {
          blockedReasons.push(buildBlockedReason(
            'live_execution_disabled',
            'execution_mode',
            'Live carry execution is disabled for this runtime.',
            'Keep carry execution simulated or explicitly enable live mode after approval.',
            {
              executionMode: input.executionMode,
              liveExecutionEnabled: input.liveExecutionEnabled,
            },
          ));
        }

        if (capability.venueMode === 'simulated' && input.executionMode === 'live') {
          blockedReasons.push(buildBlockedReason(
            'simulated_execution_only',
            'execution_mode',
            `Carry venue ${venueId} only supports simulated execution.`,
            'Use dry-run/simulated carry execution until a real live connector is available and approved.',
            { venueId },
          ));
        }
      }

      return {
        actionType: recommendation.actionType,
        sourceKind: recommendation.sourceKind,
        sourceReference: recommendation.sourceReference,
        opportunityId: recommendation.opportunityId,
        asset: recommendation.asset,
        summary: recommendation.summary,
        notionalUsd: amountUsd.toFixed(2),
        details: recommendation.details,
        readiness: blockedReasons.length === 0 ? 'actionable' : 'blocked',
        blockedReasons,
        executable: blockedReasons.length === 0,
        approvalRequirement,
        executionMode: input.executionMode,
        simulated,
        plannedOrders: recommendation.plannedOrders,
        effects,
      };
    });
  }
}
