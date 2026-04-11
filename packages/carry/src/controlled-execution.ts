import Decimal from 'decimal.js';

import { toOpportunityId } from '@sentinel-apex/domain';
import type { OrderIntent } from '@sentinel-apex/domain';
import type { CarryVenueCapabilities } from '@sentinel-apex/venue-adapters';

import {
  buildCarryStrategyProfile,
  DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY,
} from './strategy-policy.js';

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
  minimumActionableUsd: '250',
  minimumConfidenceScore: 0.6,
};

function normalizeDecimalString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

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

function buildStrategyPolicyBlockedReasons(
  strategyProfile: NonNullable<CarryExecutionIntent['strategyProfile']>,
): CarryOperationalBlockedReason[] {
  return strategyProfile.eligibility.ruleResults.flatMap((rule) => {
    if (rule.status !== 'fail') {
      return [];
    }

    switch (rule.ruleKey) {
      case 'base_asset_usdc':
        return [buildBlockedReason(
          'unsupported_strategy_base_asset',
          'strategy_policy',
          rule.summary,
          'Use a USDC-denominated vault profile before approving or executing this carry action.',
          rule.details,
        )];
      case 'tenor_three_month_rolling':
        return [buildBlockedReason(
          'unsupported_strategy_tenor',
          'strategy_policy',
          rule.summary,
          'Keep the strategy on a 3-month rolling lock with reassessment every 3 months.',
          rule.details,
        )];
      case 'target_apy_floor':
        return [buildBlockedReason(
          'strategy_target_apy_below_floor',
          'strategy_policy',
          rule.summary,
          'Raise the configured target APY floor to at least 10% before using this strategy profile.',
          rule.details,
        )];
      case 'allowed_yield_source':
        return [buildBlockedReason(
          'disallowed_yield_source',
          'strategy_policy',
          rule.summary,
          'Remove disallowed yield sources such as DEX LP, junior tranche, insurance pool, or circular stable yield.',
          rule.details,
        )];
      case 'leverage_health_metadata':
        return [buildBlockedReason(
          'missing_leverage_health_threshold',
          'strategy_policy',
          rule.summary,
          'Attach explicit leverage health-threshold metadata or remove leverage from the strategy profile.',
          rule.details,
        )];
      case 'unsafe_looping_leverage':
        return [buildBlockedReason(
          'unsafe_leverage_looping',
          'strategy_policy',
          rule.summary,
          'Do not use looping leverage below the 1.05 health threshold on non-hardcoded oracle assets.',
          rule.details,
        )];
      default:
        return [];
    }
  });
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
      const projectedApyPct = normalizeDecimalString(
        recommendation.details['netYieldPct'] ?? recommendation.details['expectedAnnualYieldPct'],
      );
      const strategyProfileInput = {
        ...input.strategyProfile,
        projectedApyPct: projectedApyPct ?? input.strategyProfile?.projectedApyPct ?? null,
        ...(projectedApyPct === null
          ? (input.strategyProfile?.projectedApySource === undefined
            ? {}
            : { projectedApySource: input.strategyProfile.projectedApySource })
          : { projectedApySource: 'projected' as const }),
      };
      const strategyProfile = buildCarryStrategyProfile(strategyProfileInput, {
        ...DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY,
        ...input.strategyPolicy,
      });

      blockedReasons.push(...buildStrategyPolicyBlockedReasons(strategyProfile));

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
            {
              venueId,
              promotionStatus: capability.promotionStatus,
            },
          ));
        }

        if (
          capability.venueMode === 'live'
          && capability.approvedForLiveUse
          && !capability.sensitiveExecutionEligible
        ) {
          blockedReasons.push(buildBlockedReason(
            'venue_live_ineligible',
            'venue_capability',
            `Carry venue ${venueId} is approved for live use but currently ineligible for sensitive execution.`,
            'Restore connector truth freshness and health, then re-run carry evaluation before executing.',
            {
              venueId,
              promotionStatus: capability.promotionStatus,
              blockers: capability.promotionBlockedReasons,
            },
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
        strategyProfile,
      };
    });
  }
}
