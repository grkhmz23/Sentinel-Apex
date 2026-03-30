import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ALLOCATOR_POLICY,
  SentinelAllocatorPolicyEngine,
} from '../index.js';

import type { AllocatorPolicyInput } from '../types.js';

function createInput(
  overrides: Partial<AllocatorPolicyInput> = {},
): AllocatorPolicyInput {
  return {
    policy: DEFAULT_ALLOCATOR_POLICY,
    evaluatedAt: '2026-03-30T00:00:00.000Z',
    sourceReference: 'test-run',
    system: {
      totalCapitalUsd: '1000000',
      reserveConstrainedCapitalUsd: '100000',
      allocatableCapitalUsd: '900000',
      runtimeLifecycleState: 'ready',
      runtimeHalted: false,
      openMismatchCount: 0,
      criticalMismatchCount: 0,
      degradedReasonCount: 0,
      treasuryReserveCoveragePct: 125,
      treasuryReserveShortfallUsd: '0',
      carryOpportunityCount: 4,
      carryApprovedOpportunityCount: 2,
      carryOpportunityScore: 0.8,
      recentReconciliationIssues: 0,
      ...(overrides.system ?? {}),
    },
    sleeves: [
      {
        sleeveId: 'carry',
        kind: 'carry',
        name: 'Apex Carry',
        currentAllocationUsd: '450000',
        currentAllocationPct: 45,
        minAllocationPct: 0,
        maxAllocationPct: 70,
        capacityUsd: '700000',
        status: 'active',
        throttleState: 'normal',
        healthy: true,
        actionability: 'actionable',
        opportunityScore: 0.8,
        metadata: {},
      },
      {
        sleeveId: 'treasury',
        kind: 'treasury',
        name: 'Atlas Treasury',
        currentAllocationUsd: '550000',
        currentAllocationPct: 55,
        minAllocationPct: 30,
        maxAllocationPct: 100,
        capacityUsd: '1000000',
        status: 'active',
        throttleState: 'normal',
        healthy: true,
        actionability: 'actionable',
        opportunityScore: null,
        metadata: {},
      },
    ],
    ...overrides,
  };
}

describe('SentinelAllocatorPolicyEngine', () => {
  it('produces deterministic target allocations from the same input', () => {
    const engine = new SentinelAllocatorPolicyEngine();
    const input = createInput();

    expect(engine.evaluate(input)).toEqual(engine.evaluate(input));
  });

  it('steers capital toward treasury when reserve coverage is short', () => {
    const engine = new SentinelAllocatorPolicyEngine();
    const decision = engine.evaluate(createInput({
      system: {
        totalCapitalUsd: '1000000',
        reserveConstrainedCapitalUsd: '150000',
        allocatableCapitalUsd: '850000',
        runtimeLifecycleState: 'ready',
        runtimeHalted: false,
        openMismatchCount: 0,
        criticalMismatchCount: 0,
        degradedReasonCount: 0,
        treasuryReserveCoveragePct: 80,
        treasuryReserveShortfallUsd: '25000',
        carryOpportunityCount: 2,
        carryApprovedOpportunityCount: 1,
        carryOpportunityScore: 0.72,
        recentReconciliationIssues: 0,
      },
    }));

    const carryTarget = decision.targets.find((target) => target.sleeveId === 'carry');
    const treasuryTarget = decision.targets.find((target) => target.sleeveId === 'treasury');

    expect(carryTarget?.targetAllocationPct).toBeLessThanOrEqual(15);
    expect(treasuryTarget?.targetAllocationPct).toBeGreaterThanOrEqual(85);
    expect(decision.rationale.some((item) => item.code === 'reserve_shortfall_defense')).toBe(true);
  });

  it('downweights carry when the system is degraded and mismatches are active', () => {
    const engine = new SentinelAllocatorPolicyEngine();
    const decision = engine.evaluate(createInput({
      system: {
        totalCapitalUsd: '1000000',
        reserveConstrainedCapitalUsd: '100000',
        allocatableCapitalUsd: '900000',
        runtimeLifecycleState: 'degraded',
        runtimeHalted: false,
        openMismatchCount: 6,
        criticalMismatchCount: 1,
        degradedReasonCount: 2,
        treasuryReserveCoveragePct: 110,
        treasuryReserveShortfallUsd: '0',
        carryOpportunityCount: 3,
        carryApprovedOpportunityCount: 1,
        carryOpportunityScore: 0.65,
        recentReconciliationIssues: 2,
      },
      sleeves: [
        {
          sleeveId: 'carry',
          kind: 'carry',
          name: 'Apex Carry',
          currentAllocationUsd: '500000',
          currentAllocationPct: 50,
          minAllocationPct: 0,
          maxAllocationPct: 70,
          capacityUsd: '700000',
          status: 'degraded',
          throttleState: 'de_risk',
          healthy: false,
          actionability: 'blocked',
          opportunityScore: 0.65,
          metadata: {},
        },
        {
          sleeveId: 'treasury',
          kind: 'treasury',
          name: 'Atlas Treasury',
          currentAllocationUsd: '500000',
          currentAllocationPct: 50,
          minAllocationPct: 30,
          maxAllocationPct: 100,
          capacityUsd: '1000000',
          status: 'active',
          throttleState: 'normal',
          healthy: true,
          actionability: 'actionable',
          opportunityScore: null,
          metadata: {},
        },
      ],
    }));

    const carryTarget = decision.targets.find((target) => target.sleeveId === 'carry');
    expect(decision.pressureLevel).toBe('high');
    expect(decision.regimeState).toBe('defensive');
    expect(carryTarget?.targetAllocationPct).toBeLessThanOrEqual(20);
    expect(decision.recommendations.some((item) => item.recommendationType === 'de_risk')).toBe(true);
  });

  it('explains weak carry-quality rationale explicitly', () => {
    const engine = new SentinelAllocatorPolicyEngine();
    const decision = engine.evaluate(createInput({
      system: {
        totalCapitalUsd: '1000000',
        reserveConstrainedCapitalUsd: '100000',
        allocatableCapitalUsd: '900000',
        runtimeLifecycleState: 'ready',
        runtimeHalted: false,
        openMismatchCount: 0,
        criticalMismatchCount: 0,
        degradedReasonCount: 0,
        treasuryReserveCoveragePct: 130,
        treasuryReserveShortfallUsd: '0',
        carryOpportunityCount: 0,
        carryApprovedOpportunityCount: 0,
        carryOpportunityScore: 0.1,
        recentReconciliationIssues: 0,
      },
      sleeves: [
        {
          sleeveId: 'carry',
          kind: 'carry',
          name: 'Apex Carry',
          currentAllocationUsd: '300000',
          currentAllocationPct: 30,
          minAllocationPct: 0,
          maxAllocationPct: 70,
          capacityUsd: '700000',
          status: 'active',
          throttleState: 'normal',
          healthy: true,
          actionability: 'actionable',
          opportunityScore: 0.1,
          metadata: {},
        },
        {
          sleeveId: 'treasury',
          kind: 'treasury',
          name: 'Atlas Treasury',
          currentAllocationUsd: '700000',
          currentAllocationPct: 70,
          minAllocationPct: 30,
          maxAllocationPct: 100,
          capacityUsd: '1000000',
          status: 'active',
          throttleState: 'normal',
          healthy: true,
          actionability: 'actionable',
          opportunityScore: null,
          metadata: {},
        },
      ],
    }));

    expect(decision.rationale.some((item) => item.code === 'carry_opportunity_weak')).toBe(true);
    expect(decision.targets.find((target) => target.sleeveId === 'carry')?.targetAllocationPct).toBeLessThanOrEqual(20);
  });
});
