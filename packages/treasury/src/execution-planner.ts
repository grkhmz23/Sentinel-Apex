import Decimal from 'decimal.js';

import type {
  TreasuryActionBlockedReason,
  TreasuryActionType,
  TreasuryApprovalRequirement,
  TreasuryEvaluation,
  TreasuryExecutionIntent,
  TreasuryExecutionPlanningInput,
  TreasuryRecommendation,
  TreasuryVenueCapabilities,
  TreasuryVenueSnapshot,
} from './types.js';

function buildBlockedReason(
  code: TreasuryActionBlockedReason['code'],
  message: string,
  details: Record<string, unknown> = {},
): TreasuryActionBlockedReason {
  return {
    code,
    message,
    details,
  };
}

function mapActionType(recommendation: TreasuryRecommendation): TreasuryActionType {
  return recommendation.actionType === 'deposit'
    ? 'allocate_to_venue'
    : 'reduce_venue_allocation';
}

function mapApprovalRequirement(
  venueMode: TreasuryExecutionIntent['venueMode'],
): TreasuryApprovalRequirement {
  return venueMode === 'live' ? 'admin' : 'operator';
}

function findVenueSnapshot(
  evaluation: TreasuryEvaluation,
  venueId: string | null,
): TreasuryVenueSnapshot | null {
  if (venueId === null) {
    return null;
  }

  return evaluation.venueSnapshots.find((snapshot) => snapshot.venueId === venueId) ?? null;
}

function findVenueCapabilities(
  capabilities: TreasuryVenueCapabilities[],
  venueId: string | null,
): TreasuryVenueCapabilities | null {
  if (venueId === null) {
    return null;
  }

  return capabilities.find((item) => item.venueId === venueId) ?? null;
}

export class TreasuryExecutionPlanner {
  createExecutionIntents(input: TreasuryExecutionPlanningInput): TreasuryExecutionIntent[] {
    return input.evaluation.recommendations.map((recommendation) =>
      this.createIntentForRecommendation(recommendation, input),
    );
  }

  private createIntentForRecommendation(
    recommendation: TreasuryRecommendation,
    input: TreasuryExecutionPlanningInput,
  ): TreasuryExecutionIntent {
    const actionType = mapActionType(recommendation);
    const venueSnapshot = findVenueSnapshot(input.evaluation, recommendation.venueId);
    const venueCapabilities = findVenueCapabilities(input.venueCapabilities, recommendation.venueId);
    const amountUsd = new Decimal(recommendation.amountUsd);
    const idleCapitalUsd = new Decimal(input.evaluation.reserveStatus.idleCapitalUsd);
    const allocatedCapitalUsd = new Decimal(input.evaluation.reserveStatus.allocatedCapitalUsd);
    const totalCapitalUsd = new Decimal(input.evaluation.reserveStatus.totalCapitalUsd);
    const requiredReserveUsd = new Decimal(input.evaluation.reserveStatus.requiredReserveUsd);
    const minimumRemainingIdleUsd = new Decimal(input.policy.minimumRemainingIdleUsd);
    const currentVenueAllocationUsd = new Decimal(venueSnapshot?.currentAllocationUsd ?? '0');
    const postIdleCapitalUsd = recommendation.actionType === 'deposit'
      ? idleCapitalUsd.minus(amountUsd)
      : idleCapitalUsd.plus(amountUsd);
    const postAllocatedCapitalUsd = recommendation.actionType === 'deposit'
      ? allocatedCapitalUsd.plus(amountUsd)
      : Decimal.max(allocatedCapitalUsd.minus(amountUsd), 0);
    const targetVenueAllocationUsd = venueSnapshot === null
      ? null
      : recommendation.actionType === 'deposit'
        ? currentVenueAllocationUsd.plus(amountUsd)
        : Decimal.max(currentVenueAllocationUsd.minus(amountUsd), 0);
    const targetVenueConcentrationPct = targetVenueAllocationUsd === null || totalCapitalUsd.lte(0)
      ? null
      : targetVenueAllocationUsd.div(totalCapitalUsd).times(100);
    const blockedReasons: TreasuryActionBlockedReason[] = [];

    if (amountUsd.lt(new Decimal(input.policy.minimumDeployableUsd))) {
      blockedReasons.push(buildBlockedReason(
        'below_minimum_action_size',
        `Action amount ${amountUsd.toFixed(2)} USD is below the minimum action size.`,
        {
          amountUsd: amountUsd.toFixed(2),
          minimumDeployableUsd: input.policy.minimumDeployableUsd,
        },
      ));
    }

    if (recommendation.venueId !== null && venueSnapshot === null) {
      blockedReasons.push(buildBlockedReason(
        'venue_not_found',
        `Venue ${recommendation.venueId} was not present in the latest treasury snapshot.`,
        { venueId: recommendation.venueId },
      ));
    }

    if (recommendation.actionType === 'deposit') {
      if (venueSnapshot !== null && !input.policy.eligibleVenues.includes(venueSnapshot.venueId)) {
        blockedReasons.push(buildBlockedReason(
          'venue_ineligible',
          `Venue ${venueSnapshot.venueName} is not on the treasury eligibility list.`,
          { venueId: venueSnapshot.venueId },
        ));
      }

      if (venueSnapshot !== null && !venueSnapshot.healthy) {
        blockedReasons.push(buildBlockedReason(
          'venue_unhealthy',
          `Venue ${venueSnapshot.venueName} is unhealthy and cannot receive new capital.`,
          { venueId: venueSnapshot.venueId },
        ));
      }

      if (postIdleCapitalUsd.lt(requiredReserveUsd)) {
        blockedReasons.push(buildBlockedReason(
          'reserve_floor_breach',
          'Action would breach the hard treasury reserve floor.',
          {
            postIdleCapitalUsd: postIdleCapitalUsd.toFixed(2),
            requiredReserveUsd: requiredReserveUsd.toFixed(2),
          },
        ));
      }

      if (postIdleCapitalUsd.lt(minimumRemainingIdleUsd)) {
        blockedReasons.push(buildBlockedReason(
          'minimum_remaining_liquidity_breach',
          'Action would leave treasury below the minimum remaining idle balance.',
          {
            postIdleCapitalUsd: postIdleCapitalUsd.toFixed(2),
            minimumRemainingIdleUsd: minimumRemainingIdleUsd.toFixed(2),
          },
        ));
      }

      if (amountUsd.gt(idleCapitalUsd)) {
        blockedReasons.push(buildBlockedReason(
          'insufficient_idle_capital',
          'Action exceeds currently available idle capital.',
          {
            amountUsd: amountUsd.toFixed(2),
            idleCapitalUsd: idleCapitalUsd.toFixed(2),
          },
        ));
      }

      if (venueSnapshot !== null && amountUsd.gt(new Decimal(venueSnapshot.availableCapacityUsd))) {
        blockedReasons.push(buildBlockedReason(
          'venue_capacity_exceeded',
          `Action exceeds available capacity at ${venueSnapshot.venueName}.`,
          {
            amountUsd: amountUsd.toFixed(2),
            availableCapacityUsd: venueSnapshot.availableCapacityUsd,
          },
        ));
      }

      if (
        targetVenueConcentrationPct !== null
        && targetVenueConcentrationPct.gt(input.policy.maxAllocationPctPerVenue)
      ) {
        blockedReasons.push(buildBlockedReason(
          'venue_concentration_breach',
          'Action would breach the venue concentration limit.',
          {
            targetVenueConcentrationPct: targetVenueConcentrationPct.toFixed(2),
            maxAllocationPctPerVenue: input.policy.maxAllocationPctPerVenue,
          },
        ));
      }
    } else if (venueSnapshot !== null && amountUsd.gt(new Decimal(venueSnapshot.withdrawalAvailableUsd))) {
      blockedReasons.push(buildBlockedReason(
        'withdrawal_capacity_exceeded',
        `Action exceeds withdrawal capacity at ${venueSnapshot.venueName}.`,
        {
          amountUsd: amountUsd.toFixed(2),
          withdrawalAvailableUsd: venueSnapshot.withdrawalAvailableUsd,
        },
      ));
    }

    if (recommendation.venueId !== null) {
      if (venueCapabilities === null || !venueCapabilities.executionSupported) {
        blockedReasons.push(buildBlockedReason(
          'venue_execution_unsupported',
          `Venue ${recommendation.venueId} does not support treasury execution yet.`,
          { venueId: recommendation.venueId },
        ));
      } else if (
        (recommendation.actionType === 'deposit' && !venueCapabilities.supportsAllocation)
        || (recommendation.actionType === 'redeem' && !venueCapabilities.supportsReduction)
      ) {
        blockedReasons.push(buildBlockedReason(
          'venue_execution_unsupported',
          `Venue ${recommendation.venueId} does not support ${recommendation.actionType} execution.`,
          {
            venueId: recommendation.venueId,
            actionType: recommendation.actionType,
          },
        ));
      }

      if (
        venueCapabilities?.venueMode === 'live'
        && (input.executionMode !== 'live' || !input.liveExecutionEnabled)
      ) {
        blockedReasons.push(buildBlockedReason(
          'live_execution_disabled',
          'Live treasury execution is disabled for this runtime.',
          {
            executionMode: input.executionMode,
            liveExecutionEnabled: input.liveExecutionEnabled,
          },
        ));
      }
    }

    const venueMode = recommendation.venueId === null
      ? 'reserve'
      : venueSnapshot?.mode ?? venueCapabilities?.venueMode ?? 'simulated';

    return {
      actionType,
      recommendationType: recommendation.actionType,
      venueId: recommendation.venueId,
      venueName: venueSnapshot?.venueName ?? null,
      venueMode,
      amountUsd: amountUsd.toFixed(2),
      reasonCode: recommendation.reasonCode,
      summary: recommendation.summary,
      details: recommendation.details,
      readiness: blockedReasons.length === 0 ? 'actionable' : 'blocked',
      blockedReasons,
      executable: blockedReasons.length === 0,
      approvalRequirement: mapApprovalRequirement(venueMode),
      executionMode: input.executionMode,
      simulated: venueMode !== 'live',
      effects: {
        totalCapitalUsd: totalCapitalUsd.toFixed(2),
        idleCapitalUsd: postIdleCapitalUsd.toFixed(2),
        allocatedCapitalUsd: postAllocatedCapitalUsd.toFixed(2),
        requiredReserveUsd: requiredReserveUsd.toFixed(2),
        minimumRemainingIdleUsd: minimumRemainingIdleUsd.toFixed(2),
        reserveShortfallUsd: Decimal.max(requiredReserveUsd.minus(postIdleCapitalUsd), 0).toFixed(2),
        targetVenueAllocationUsd: targetVenueAllocationUsd?.toFixed(2) ?? null,
        targetVenueConcentrationPct: targetVenueConcentrationPct?.toFixed(2) ?? null,
      },
    };
  }
}
