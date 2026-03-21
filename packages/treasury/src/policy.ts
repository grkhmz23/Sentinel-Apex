import Decimal from 'decimal.js';

import type {
  TreasuryEvaluation,
  TreasuryEvaluationInput,
  TreasuryLiquidityTier,
  TreasuryPolicy,
  TreasuryRecommendation,
  TreasuryVenueSnapshot,
} from './types.js';

const LIQUIDITY_PRIORITY: Record<TreasuryLiquidityTier, number> = {
  instant: 0,
  same_day: 1,
  delayed: 2,
};

export const DEFAULT_TREASURY_POLICY: TreasuryPolicy = {
  sleeveId: 'treasury',
  reserveFloorPct: 10,
  minReserveUsd: '10000',
  minimumRemainingIdleUsd: '10000',
  maxAllocationPctPerVenue: 50,
  minimumDeployableUsd: '2500',
  eligibleVenues: ['atlas-t0-sim', 'atlas-t1-sim'],
};

function decimalMax(a: Decimal, b: Decimal): Decimal {
  return a.greaterThan(b) ? a : b;
}

function byYieldDescending(a: TreasuryVenueSnapshot, b: TreasuryVenueSnapshot): number {
  return b.aprBps - a.aprBps;
}

function byLiquidityAscending(a: TreasuryVenueSnapshot, b: TreasuryVenueSnapshot): number {
  const tierComparison = LIQUIDITY_PRIORITY[a.liquidityTier] - LIQUIDITY_PRIORITY[b.liquidityTier];
  if (tierComparison !== 0) {
    return tierComparison;
  }

  return new Decimal(b.withdrawalAvailableUsd).comparedTo(new Decimal(a.withdrawalAvailableUsd));
}

export class TreasuryPolicyEngine {
  evaluate(input: TreasuryEvaluationInput): TreasuryEvaluation {
    const idleCapitalUsd = new Decimal(input.idleCapitalUsd);
    const totalAllocatedUsd = input.venueSnapshots.reduce(
      (sum, venue) => sum.plus(new Decimal(venue.currentAllocationUsd)),
      new Decimal(0),
    );
    const totalCapitalUsd = idleCapitalUsd.plus(totalAllocatedUsd);
    const requiredReserveUsd = decimalMax(
      new Decimal(input.policy.minReserveUsd),
      totalCapitalUsd.times(input.policy.reserveFloorPct).div(100),
    );
    const reserveShortfallUsd = Decimal.max(requiredReserveUsd.minus(idleCapitalUsd), 0);
    const surplusCapitalUsd = Decimal.max(idleCapitalUsd.minus(requiredReserveUsd), 0);
    const reserveCoveragePct = requiredReserveUsd.equals(0)
      ? new Decimal(100)
      : idleCapitalUsd.div(requiredReserveUsd).times(100);

    const venueSnapshots = input.venueSnapshots.map((venue) => {
      const concentrationPct = totalCapitalUsd.equals(0)
        ? new Decimal(0)
        : new Decimal(venue.currentAllocationUsd).div(totalCapitalUsd).times(100);

      return {
        ...venue,
        concentrationPct: concentrationPct.toFixed(2),
      };
    });

    const recommendations: TreasuryRecommendation[] = [];
    const alerts: string[] = [];

    for (const venue of venueSnapshots) {
      const concentrationPct = new Decimal(venue.concentrationPct);
      const allocationUsd = new Decimal(venue.currentAllocationUsd);

      if (!input.policy.eligibleVenues.includes(venue.venueId) && allocationUsd.greaterThan(0)) {
        alerts.push(`Venue ${venue.venueName} is no longer eligible.`);
        recommendations.push({
          actionType: 'redeem',
          venueId: venue.venueId,
          amountUsd: allocationUsd.toFixed(2),
          reasonCode: 'venue_ineligible',
          summary: `Redeem the full ${allocationUsd.toFixed(2)} USD allocation from ineligible venue ${venue.venueName}.`,
          details: {
            concentrationPct: venue.concentrationPct,
          },
        });
      }

      if (concentrationPct.greaterThan(input.policy.maxAllocationPctPerVenue)) {
        const maxVenueAllocationUsd = totalCapitalUsd.times(input.policy.maxAllocationPctPerVenue).div(100);
        const excessUsd = Decimal.max(allocationUsd.minus(maxVenueAllocationUsd), 0);

        if (excessUsd.greaterThan(0)) {
          alerts.push(`Venue ${venue.venueName} exceeds the concentration cap.`);
          recommendations.push({
            actionType: 'redeem',
            venueId: venue.venueId,
            amountUsd: excessUsd.toFixed(2),
            reasonCode: 'venue_concentration',
            summary: `Redeem ${excessUsd.toFixed(2)} USD from ${venue.venueName} to restore concentration limits.`,
            details: {
              concentrationPct: venue.concentrationPct,
              maxAllocationPctPerVenue: input.policy.maxAllocationPctPerVenue,
            },
          });
        }
      }
    }

    if (reserveShortfallUsd.greaterThan(0)) {
      alerts.push(`Liquidity reserve is short by ${reserveShortfallUsd.toFixed(2)} USD.`);

      let remainingShortfall = reserveShortfallUsd;
      const redeemCandidates = [...venueSnapshots]
        .filter((venue) => new Decimal(venue.withdrawalAvailableUsd).greaterThan(0))
        .sort(byLiquidityAscending);

      for (const venue of redeemCandidates) {
        if (remainingShortfall.lte(0)) {
          break;
        }

        const withdrawalUsd = Decimal.min(
          remainingShortfall,
          new Decimal(venue.withdrawalAvailableUsd),
        );
        if (withdrawalUsd.lte(0)) {
          continue;
        }

        recommendations.push({
          actionType: 'redeem',
          venueId: venue.venueId,
          amountUsd: withdrawalUsd.toFixed(2),
          reasonCode: 'reserve_shortfall',
          summary: `Redeem ${withdrawalUsd.toFixed(2)} USD from ${venue.venueName} to restore the treasury reserve floor.`,
          details: {
            liquidityTier: venue.liquidityTier,
            withdrawalAvailableUsd: venue.withdrawalAvailableUsd,
          },
        });
        remainingShortfall = remainingShortfall.minus(withdrawalUsd);
      }
    }

    const minDeployableUsd = new Decimal(input.policy.minimumDeployableUsd);
    if (surplusCapitalUsd.greaterThanOrEqualTo(minDeployableUsd)) {
      let remainingSurplus = surplusCapitalUsd;
      const deployCandidates = [...venueSnapshots]
        .filter((venue) => input.policy.eligibleVenues.includes(venue.venueId) && venue.healthy)
        .sort(byYieldDescending);

      for (const venue of deployCandidates) {
        if (remainingSurplus.lt(minDeployableUsd)) {
          break;
        }

        const maxVenueAllocationUsd = totalCapitalUsd.times(input.policy.maxAllocationPctPerVenue).div(100);
        const currentAllocationUsd = new Decimal(venue.currentAllocationUsd);
        const capRoomUsd = Decimal.max(maxVenueAllocationUsd.minus(currentAllocationUsd), 0);
        const capacityUsd = new Decimal(venue.availableCapacityUsd);
        const deployUsd = Decimal.min(remainingSurplus, capRoomUsd, capacityUsd);

        if (deployUsd.lt(minDeployableUsd)) {
          continue;
        }

        recommendations.push({
          actionType: 'deposit',
          venueId: venue.venueId,
          amountUsd: deployUsd.toFixed(2),
          reasonCode: 'surplus_deployable',
          summary: `Deploy ${deployUsd.toFixed(2)} USD of surplus cash into ${venue.venueName}.`,
          details: {
            aprBps: venue.aprBps,
            liquidityTier: venue.liquidityTier,
            availableCapacityUsd: venue.availableCapacityUsd,
          },
        });
        remainingSurplus = remainingSurplus.minus(deployUsd);
      }
    }

    return {
      policy: input.policy,
      reserveStatus: {
        totalCapitalUsd: totalCapitalUsd.toFixed(2),
        idleCapitalUsd: idleCapitalUsd.toFixed(2),
        allocatedCapitalUsd: totalAllocatedUsd.toFixed(2),
        requiredReserveUsd: requiredReserveUsd.toFixed(2),
        currentReserveUsd: idleCapitalUsd.toFixed(2),
        reserveCoveragePct: reserveCoveragePct.toFixed(2),
        surplusCapitalUsd: surplusCapitalUsd.toFixed(2),
        reserveShortfallUsd: reserveShortfallUsd.toFixed(2),
      },
      venueSnapshots,
      recommendations,
      alerts,
      simulated: venueSnapshots.every((venue) => venue.mode === 'simulated'),
    };
  }
}
