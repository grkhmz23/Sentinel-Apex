import { describe, expect, it } from 'vitest';

import {
  CarryControlledExecutionPlanner,
  DEFAULT_CARRY_OPERATIONAL_POLICY,
  buildCarryReductionIntents,
} from '../index.js';

import type {
  CarryControlledExecutionPlanningInput,
  CarryExecutionRecommendation,
  CarryPositionSnapshot,
} from '../types.js';

function createIncreaseRecommendation(
  overrides: Partial<CarryExecutionRecommendation> = {},
): CarryExecutionRecommendation {
  return {
    actionType: 'increase_carry_exposure',
    sourceKind: 'opportunity',
    sourceReference: 'opp-1',
    opportunityId: 'opp-1',
    asset: 'BTC',
    summary: 'Deploy carry capital into BTC spread.',
    notionalUsd: '5000',
    details: {
      confidenceScore: 0.8,
      expiresAt: '2026-03-30T01:00:00.000Z',
    },
    plannedOrders: [
      {
        intentId: 'btc-buy-1',
        venueId: 'sim-venue-a',
        asset: 'BTC',
        side: 'buy',
        type: 'market',
        size: '0.02500000',
        limitPrice: null,
        opportunityId: 'opp-1' as never,
        reduceOnly: false,
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        metadata: {},
      },
    ],
    ...overrides,
  };
}

function createInput(
  overrides: Partial<CarryControlledExecutionPlanningInput> = {},
): CarryControlledExecutionPlanningInput {
  return {
    recommendations: [createIncreaseRecommendation()],
    policy: DEFAULT_CARRY_OPERATIONAL_POLICY,
    currentCarryAllocationUsd: '45000',
    approvedCarryBudgetUsd: '60000',
    totalCapitalUsd: '100000',
    runtimeLifecycleState: 'ready',
    runtimeHalted: false,
    criticalMismatchCount: 0,
    carryThrottleState: 'normal',
    executionMode: 'dry-run',
    liveExecutionEnabled: false,
    venueCapabilities: [
      {
        venueId: 'sim-venue-a',
        venueMode: 'simulated',
        executionSupported: true,
        supportsIncreaseExposure: true,
        supportsReduceExposure: true,
        readOnly: false,
        approvedForLiveUse: false,
        sensitiveExecutionEligible: false,
        promotionStatus: 'not_requested',
        promotionBlockedReasons: [],
        healthy: true,
        onboardingState: 'simulated',
        missingPrerequisites: [],
        metadata: {},
      },
    ],
    openPositions: [],
    now: new Date('2026-03-30T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CarryControlledExecutionPlanner', () => {
  it('marks carry execution actionable when policy and venue rules allow it', () => {
    const planner = new CarryControlledExecutionPlanner();
    const [intent] = planner.createExecutionIntents(createInput());

    expect(intent?.readiness).toBe('actionable');
    expect(intent?.executable).toBe(true);
    expect(intent?.blockedReasons).toHaveLength(0);
  });

  it('blocks carry execution when carry budget would be exceeded', () => {
    const planner = new CarryControlledExecutionPlanner();
    const [intent] = planner.createExecutionIntents(createInput({
      currentCarryAllocationUsd: '59000',
      approvedCarryBudgetUsd: '60000',
    }));

    expect(intent?.executable).toBe(false);
    expect(intent?.blockedReasons.some((reason) => reason.code === 'carry_budget_exceeded')).toBe(true);
  });

  it('blocks live execution on simulated-only venues', () => {
    const planner = new CarryControlledExecutionPlanner();
    const [intent] = planner.createExecutionIntents(createInput({
      executionMode: 'live',
      liveExecutionEnabled: true,
    }));

    expect(intent?.executable).toBe(false);
    expect(intent?.blockedReasons.some((reason) => reason.code === 'simulated_execution_only')).toBe(true);
  });

  it('blocks approved live venues when connector readiness evidence currently disqualifies execution', () => {
    const planner = new CarryControlledExecutionPlanner();
    const [intent] = planner.createExecutionIntents(createInput({
      executionMode: 'live',
      liveExecutionEnabled: true,
      venueCapabilities: [{
        venueId: 'sim-venue-a',
        venueMode: 'live',
        executionSupported: true,
        supportsIncreaseExposure: true,
        supportsReduceExposure: true,
        readOnly: false,
        approvedForLiveUse: true,
        sensitiveExecutionEligible: false,
        promotionStatus: 'approved',
        promotionBlockedReasons: ['Latest venue-truth snapshot is stale.'],
        healthy: true,
        onboardingState: 'approved_for_live',
        missingPrerequisites: [],
        metadata: {},
      }],
    }));

    expect(intent?.executable).toBe(false);
    expect(intent?.blockedReasons.some((reason) => reason.code === 'venue_live_ineligible')).toBe(true);
  });
});

describe('buildCarryReductionIntents', () => {
  it('creates reduce-only intents from open positions until reduction target is covered', () => {
    const positions: CarryPositionSnapshot[] = [
      {
        positionId: 'pos-1',
        venueId: 'sim-venue-a',
        asset: 'BTC',
        side: 'long',
        size: '0.10000000',
        markPrice: '100000',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    ];

    const intents = buildCarryReductionIntents(
      positions,
      '5000',
      'rebalance-1',
      new Date('2026-03-30T00:00:00.000Z'),
    );

    expect(intents).toHaveLength(1);
    expect(intents[0]?.reduceOnly).toBe(true);
    expect(intents[0]?.side).toBe('sell');
  });
});
