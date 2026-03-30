import Decimal from 'decimal.js';

import type {
  AllocatorBudgetConstraint,
  AllocatorDecision,
  AllocatorPolicy,
  AllocatorPolicyInput,
  AllocatorPressureLevel,
  AllocatorRecommendation,
  AllocatorRegimeState,
  AllocatorRationale,
  AllocatorTargetAllocation,
} from './types.js';

export const DEFAULT_ALLOCATOR_POLICY: AllocatorPolicy = {
  baselineTargetPct: {
    carry: 55,
    treasury: 45,
  },
  minimumTreasuryPct: 35,
  maximumCarryPct: 65,
  degradedCarryCapPct: 25,
  elevatedMismatchCarryCapPct: 35,
  reserveShortfallCarryCapPct: 15,
  weakCarryCarryCapPct: 20,
  carryOpportunityScoreFloor: 0.35,
  carryOpportunityScoreStrong: 0.7,
};

function clampPct(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toUsd(totalCapitalUsd: Decimal, pct: number): string {
  return totalCapitalUsd.times(pct).div(100).toFixed(2);
}

function buildRationale(
  code: string,
  severity: AllocatorRationale['severity'],
  summary: string,
  details: Record<string, unknown> = {},
): AllocatorRationale {
  return { code, severity, summary, details };
}

function buildConstraint(
  code: string,
  summary: string,
  binding: boolean,
  details: Record<string, unknown> = {},
): AllocatorBudgetConstraint {
  return { code, summary, binding, details };
}

function pressureFromInput(input: AllocatorPolicyInput): AllocatorPressureLevel {
  if (
    input.system.runtimeHalted
    || input.system.runtimeLifecycleState === 'paused'
    || input.system.runtimeLifecycleState === 'stopped'
    || input.system.criticalMismatchCount > 0
    || new Decimal(input.system.treasuryReserveShortfallUsd).greaterThan(0)
  ) {
    return 'high';
  }

  if (
    input.system.runtimeLifecycleState === 'degraded'
    || input.system.openMismatchCount >= 3
    || input.system.recentReconciliationIssues > 0
    || input.system.degradedReasonCount > 0
  ) {
    return 'elevated';
  }

  return 'normal';
}

function regimeFromInput(
  input: AllocatorPolicyInput,
  pressureLevel: AllocatorPressureLevel,
): AllocatorRegimeState {
  if (pressureLevel === 'high') {
    return input.system.runtimeHalted ? 'recovery' : 'defensive';
  }

  if (
    pressureLevel === 'elevated'
    || input.system.carryOpportunityScore < input.policy.carryOpportunityScoreStrong
  ) {
    return 'cautious';
  }

  return 'normal';
}

export class SentinelAllocatorPolicyEngine {
  evaluate(input: AllocatorPolicyInput): AllocatorDecision {
    const carry = input.sleeves.find((sleeve) => sleeve.sleeveId === 'carry');
    const treasury = input.sleeves.find((sleeve) => sleeve.sleeveId === 'treasury');

    if (carry === undefined || treasury === undefined) {
      throw new Error('SentinelAllocatorPolicyEngine requires carry and treasury sleeves.');
    }

    const totalCapitalUsd = new Decimal(input.system.totalCapitalUsd);
    const pressureLevel = pressureFromInput(input);
    const regimeState = regimeFromInput(input, pressureLevel);
    const rationales: AllocatorRationale[] = [];
    const constraints: AllocatorBudgetConstraint[] = [];

    let carryTargetPct = input.policy.baselineTargetPct.carry;
    let treasuryTargetPct = input.policy.baselineTargetPct.treasury;

    const treasuryFloorPct = Math.max(
      input.policy.minimumTreasuryPct,
      Number.isFinite(input.system.treasuryReserveCoveragePct) && input.system.treasuryReserveCoveragePct < 100
        ? input.policy.minimumTreasuryPct + 10
        : input.policy.minimumTreasuryPct,
    );

    constraints.push(
      buildConstraint(
        'treasury_minimum_floor',
        'Treasury receives a minimum portfolio budget so reserve obligations remain inspectable and funded.',
        treasuryTargetPct < treasuryFloorPct,
        { treasuryFloorPct },
      ),
    );

    if (new Decimal(input.system.treasuryReserveShortfallUsd).greaterThan(0)) {
      carryTargetPct = Math.min(carryTargetPct, input.policy.reserveShortfallCarryCapPct);
      rationales.push(
        buildRationale(
          'reserve_shortfall_defense',
          'critical',
          'Treasury reserve is short, so carry is capped defensively until reserve coverage is restored.',
          {
            reserveShortfallUsd: input.system.treasuryReserveShortfallUsd,
            carryCapPct: input.policy.reserveShortfallCarryCapPct,
          },
        ),
      );
      constraints.push(
        buildConstraint(
          'reserve_shortfall_carry_cap',
          'Reserve shortfall constrains carry budget.',
          true,
          {
            carryCapPct: input.policy.reserveShortfallCarryCapPct,
          },
        ),
      );
    }

    if (pressureLevel === 'high') {
      carryTargetPct = Math.min(carryTargetPct, input.policy.degradedCarryCapPct);
      rationales.push(
        buildRationale(
          'system_pressure_high',
          'critical',
          'System pressure is high, so allocator shifts portfolio budget toward Treasury.',
          {
            runtimeLifecycleState: input.system.runtimeLifecycleState,
            criticalMismatchCount: input.system.criticalMismatchCount,
            runtimeHalted: input.system.runtimeHalted,
          },
        ),
      );
      constraints.push(
        buildConstraint(
          'high_pressure_carry_cap',
          'High operational pressure caps carry allocation.',
          true,
          { carryCapPct: input.policy.degradedCarryCapPct },
        ),
      );
    } else if (pressureLevel === 'elevated') {
      carryTargetPct = Math.min(carryTargetPct, input.policy.elevatedMismatchCarryCapPct);
      rationales.push(
        buildRationale(
          'system_pressure_elevated',
          'warning',
          'Operational pressure is elevated, so carry is downweighted relative to the baseline.',
          {
            openMismatchCount: input.system.openMismatchCount,
            recentReconciliationIssues: input.system.recentReconciliationIssues,
          },
        ),
      );
      constraints.push(
        buildConstraint(
          'elevated_pressure_carry_cap',
          'Elevated operational pressure limits carry budget expansion.',
          true,
          { carryCapPct: input.policy.elevatedMismatchCarryCapPct },
        ),
      );
    }

    if (
      carry.status === 'degraded'
      || carry.status === 'blocked'
      || carry.throttleState === 'de_risk'
      || carry.throttleState === 'blocked'
      || carry.healthy === false
    ) {
      carryTargetPct = Math.min(carryTargetPct, input.policy.weakCarryCarryCapPct);
      rationales.push(
        buildRationale(
          'carry_throttled',
          'warning',
          'Carry sleeve health is degraded or throttled, so its capital budget is reduced.',
          {
            status: carry.status,
            throttleState: carry.throttleState,
            healthy: carry.healthy,
          },
        ),
      );
    }

    if (input.system.carryOpportunityScore < input.policy.carryOpportunityScoreFloor) {
      carryTargetPct = Math.min(carryTargetPct, input.policy.weakCarryCarryCapPct);
      rationales.push(
        buildRationale(
          'carry_opportunity_weak',
          'warning',
          'Carry opportunity quality is weak, so idle and reserve capital is steered toward Treasury.',
          {
            carryOpportunityScore: input.system.carryOpportunityScore,
            carryOpportunityScoreFloor: input.policy.carryOpportunityScoreFloor,
          },
        ),
      );
    } else if (input.system.carryOpportunityScore >= input.policy.carryOpportunityScoreStrong && pressureLevel === 'normal') {
      carryTargetPct = Math.min(input.policy.maximumCarryPct, carryTargetPct + 5);
      rationales.push(
        buildRationale(
          'carry_opportunity_strong',
          'info',
          'Carry opportunity quality is strong, so carry receives a moderate budget uplift within portfolio limits.',
          {
            carryOpportunityScore: input.system.carryOpportunityScore,
            carryOpportunityScoreStrong: input.policy.carryOpportunityScoreStrong,
          },
        ),
      );
    }

    carryTargetPct = clampPct(carryTargetPct, carry.minAllocationPct, Math.min(carry.maxAllocationPct, input.policy.maximumCarryPct));
    treasuryTargetPct = clampPct(100 - carryTargetPct, Math.max(treasury.minAllocationPct, treasuryFloorPct), treasury.maxAllocationPct);
    carryTargetPct = clampPct(100 - treasuryTargetPct, carry.minAllocationPct, Math.min(carry.maxAllocationPct, input.policy.maximumCarryPct));

    const carryTargetUsd = toUsd(totalCapitalUsd, carryTargetPct);
    const treasuryTargetUsd = toUsd(totalCapitalUsd, treasuryTargetPct);
    const carryDeltaUsd = new Decimal(carryTargetUsd).minus(carry.currentAllocationUsd).toFixed(2);
    const treasuryDeltaUsd = new Decimal(treasuryTargetUsd).minus(treasury.currentAllocationUsd).toFixed(2);

    const targets: AllocatorTargetAllocation[] = [
      {
        sleeveId: 'carry',
        sleeveName: carry.name,
        sleeveKind: carry.kind,
        currentAllocationUsd: carry.currentAllocationUsd,
        currentAllocationPct: carry.currentAllocationPct,
        targetAllocationUsd: carryTargetUsd,
        targetAllocationPct: carryTargetPct,
        minAllocationPct: carry.minAllocationPct,
        maxAllocationPct: carry.maxAllocationPct,
        deltaUsd: carryDeltaUsd,
        status: carry.status,
        throttleState: carry.throttleState,
        opportunityScore: carry.opportunityScore,
        capacityUsd: carry.capacityUsd,
        rationale: rationales.filter((rationale) => rationale.code.startsWith('carry_') || rationale.code.startsWith('system_') || rationale.code.startsWith('reserve_')),
        metadata: carry.metadata,
      },
      {
        sleeveId: 'treasury',
        sleeveName: treasury.name,
        sleeveKind: treasury.kind,
        currentAllocationUsd: treasury.currentAllocationUsd,
        currentAllocationPct: treasury.currentAllocationPct,
        targetAllocationUsd: treasuryTargetUsd,
        targetAllocationPct: treasuryTargetPct,
        minAllocationPct: treasury.minAllocationPct,
        maxAllocationPct: treasury.maxAllocationPct,
        deltaUsd: treasuryDeltaUsd,
        status: treasury.status,
        throttleState: treasury.throttleState,
        opportunityScore: treasury.opportunityScore,
        capacityUsd: treasury.capacityUsd,
        rationale: [
          buildRationale(
            'treasury_residual_allocator',
            'info',
            'Treasury receives the residual portfolio budget after reserve and carry constraints are applied.',
            {
              treasuryFloorPct,
            },
          ),
          ...rationales.filter((rationale) => rationale.code.startsWith('reserve_') || rationale.code.startsWith('system_')),
        ],
        metadata: treasury.metadata,
      },
    ];

    const recommendations: AllocatorRecommendation[] = [];

    for (const target of targets) {
      const delta = new Decimal(target.deltaUsd);
      if (delta.abs().lt(1)) {
        recommendations.push({
          recommendationType: 'hold_budget',
          sleeveId: target.sleeveId,
          priority: 'low',
          summary: `${target.sleeveName} remains within its current budget band.`,
          details: {
            targetAllocationPct: target.targetAllocationPct,
            currentAllocationPct: target.currentAllocationPct,
          },
          rationale: target.rationale,
        });
        continue;
      }

      if (target.sleeveId === 'carry' && delta.lessThan(0)) {
        recommendations.push({
          recommendationType: target.throttleState === 'de_risk' || pressureLevel !== 'normal'
            ? 'de_risk'
            : 'decrease_budget',
          sleeveId: target.sleeveId,
          priority: pressureLevel === 'high' ? 'high' : 'medium',
          summary: `Reduce carry budget by ${delta.abs().toFixed(2)} USD toward ${target.targetAllocationPct.toFixed(2)}% of portfolio capital.`,
          details: {
            currentAllocationUsd: target.currentAllocationUsd,
            targetAllocationUsd: target.targetAllocationUsd,
            deltaUsd: target.deltaUsd,
          },
          rationale: target.rationale,
        });
        continue;
      }

      recommendations.push({
        recommendationType: target.sleeveId === 'treasury' && pressureLevel !== 'normal'
          ? 'increase_reserve_buffer'
          : delta.greaterThan(0)
            ? 'increase_budget'
            : 'decrease_budget',
        sleeveId: target.sleeveId,
        priority: pressureLevel === 'high' ? 'high' : 'medium',
        summary: `${delta.greaterThan(0) ? 'Increase' : 'Reduce'} ${target.sleeveName} budget by ${delta.abs().toFixed(2)} USD toward ${target.targetAllocationPct.toFixed(2)}% of portfolio capital.`,
        details: {
          currentAllocationUsd: target.currentAllocationUsd,
          targetAllocationUsd: target.targetAllocationUsd,
          deltaUsd: target.deltaUsd,
        },
        rationale: target.rationale,
      });
    }

    if (rationales.length === 0) {
      rationales.push(
        buildRationale(
          'baseline_policy_applied',
          'info',
          'Allocator applied the baseline policy because reserve, risk, and carry-quality inputs were all within normal bands.',
        ),
      );
    }

    return {
      regimeState,
      pressureLevel,
      totalCapitalUsd: totalCapitalUsd.toFixed(2),
      reserveConstrainedCapitalUsd: new Decimal(input.system.reserveConstrainedCapitalUsd).toFixed(2),
      allocatableCapitalUsd: new Decimal(input.system.allocatableCapitalUsd).toFixed(2),
      targets,
      recommendations,
      rationale: rationales,
      constraints,
    };
  }
}
