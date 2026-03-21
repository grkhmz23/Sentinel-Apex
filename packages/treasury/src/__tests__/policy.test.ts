import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TREASURY_POLICY,
  TreasuryExecutionPlanner,
  TreasuryPolicyEngine,
} from '../index.js';

describe('TreasuryPolicyEngine', () => {
  const engine = new TreasuryPolicyEngine();
  const planner = new TreasuryExecutionPlanner();

  it('enforces the liquidity reserve floor before deploying surplus capital', () => {
    const evaluation = engine.evaluate({
      totalNavUsd: '100000',
      idleCapitalUsd: '8000',
      policy: DEFAULT_TREASURY_POLICY,
      venueSnapshots: [
        {
          venueId: 'atlas-t1-sim',
          venueName: 'Atlas Same Day Sim',
          mode: 'simulated',
          liquidityTier: 'same_day',
          healthy: true,
          aprBps: 540,
          availableCapacityUsd: '50000',
          currentAllocationUsd: '15000',
          withdrawalAvailableUsd: '15000',
          concentrationPct: '0',
          updatedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(evaluation.reserveStatus.reserveShortfallUsd).toBe('2000.00');
    expect(evaluation.recommendations.some((action) => action.reasonCode === 'reserve_shortfall')).toBe(true);
  });

  it('detects deployable surplus and generates deposit recommendations for eligible venues', () => {
    const evaluation = engine.evaluate({
      totalNavUsd: '100000',
      idleCapitalUsd: '40000',
      policy: DEFAULT_TREASURY_POLICY,
      venueSnapshots: [
        {
          venueId: 'atlas-t0-sim',
          venueName: 'Atlas Instant Sim',
          mode: 'simulated',
          liquidityTier: 'instant',
          healthy: true,
          aprBps: 410,
          availableCapacityUsd: '25000',
          currentAllocationUsd: '5000',
          withdrawalAvailableUsd: '5000',
          concentrationPct: '0',
          updatedAt: new Date().toISOString(),
          metadata: {},
        },
        {
          venueId: 'atlas-t1-sim',
          venueName: 'Atlas Same Day Sim',
          mode: 'simulated',
          liquidityTier: 'same_day',
          healthy: true,
          aprBps: 620,
          availableCapacityUsd: '50000',
          currentAllocationUsd: '10000',
          withdrawalAvailableUsd: '10000',
          concentrationPct: '0',
          updatedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(evaluation.reserveStatus.surplusCapitalUsd).toBe('30000.00');
    expect(evaluation.recommendations[0]?.actionType).toBe('deposit');
    expect(evaluation.recommendations[0]?.venueId).toBe('atlas-t1-sim');
  });

  it('flags concentration breaches and recommends reducing excess exposure', () => {
    const evaluation = engine.evaluate({
      totalNavUsd: '100000',
      idleCapitalUsd: '20000',
      policy: DEFAULT_TREASURY_POLICY,
      venueSnapshots: [
        {
          venueId: 'atlas-t0-sim',
          venueName: 'Atlas Instant Sim',
          mode: 'simulated',
          liquidityTier: 'instant',
          healthy: true,
          aprBps: 410,
          availableCapacityUsd: '25000',
          currentAllocationUsd: '45000',
          withdrawalAvailableUsd: '45000',
          concentrationPct: '0',
          updatedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    expect(evaluation.alerts.some((alert) => alert.includes('concentration'))).toBe(true);
    expect(evaluation.recommendations.some((action) => action.reasonCode === 'venue_concentration')).toBe(true);
  });

  it('creates execution-ready intents only when treasury rules allow them', () => {
    const evaluation = engine.evaluate({
      totalNavUsd: '100000',
      idleCapitalUsd: '40000',
      policy: DEFAULT_TREASURY_POLICY,
      venueSnapshots: [
        {
          venueId: 'atlas-t1-sim',
          venueName: 'Atlas Same Day Sim',
          mode: 'simulated',
          liquidityTier: 'same_day',
          healthy: true,
          aprBps: 620,
          availableCapacityUsd: '50000',
          currentAllocationUsd: '10000',
          withdrawalAvailableUsd: '10000',
          concentrationPct: '0',
          updatedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    const intents = planner.createExecutionIntents({
      evaluation,
      policy: DEFAULT_TREASURY_POLICY,
      executionMode: 'dry-run',
      liveExecutionEnabled: false,
      venueCapabilities: [{
        venueId: 'atlas-t1-sim',
        venueMode: 'simulated',
        supportsAllocation: true,
        supportsReduction: true,
        executionSupported: true,
        healthy: true,
        metadata: {},
      }],
    });

    expect(intents).toHaveLength(1);
    expect(intents[0]?.actionType).toBe('allocate_to_venue');
    expect(intents[0]?.readiness).toBe('actionable');
    expect(intents[0]?.blockedReasons).toHaveLength(0);
  });

  it('blocks unsafe execution when reserve floor or concentration would be breached', () => {
    const evaluation = engine.evaluate({
      totalNavUsd: '100000',
      idleCapitalUsd: '15000',
      policy: DEFAULT_TREASURY_POLICY,
      venueSnapshots: [
        {
          venueId: 'atlas-t0-sim',
          venueName: 'Atlas Instant Sim',
          mode: 'simulated',
          liquidityTier: 'instant',
          healthy: true,
          aprBps: 410,
          availableCapacityUsd: '25000',
          currentAllocationUsd: '45000',
          withdrawalAvailableUsd: '45000',
          concentrationPct: '0',
          updatedAt: new Date().toISOString(),
          metadata: {},
        },
      ],
    });

    const intents = planner.createExecutionIntents({
      evaluation: {
        ...evaluation,
        recommendations: [{
          actionType: 'deposit',
          venueId: 'atlas-t0-sim',
          amountUsd: '6000',
          reasonCode: 'surplus_deployable',
          summary: 'Unsafe deposit for test',
          details: {},
        }],
      },
      policy: DEFAULT_TREASURY_POLICY,
      executionMode: 'dry-run',
      liveExecutionEnabled: false,
      venueCapabilities: [{
        venueId: 'atlas-t0-sim',
        venueMode: 'simulated',
        supportsAllocation: true,
        supportsReduction: true,
        executionSupported: true,
        healthy: true,
        metadata: {},
      }],
    });

    expect(intents[0]?.readiness).toBe('blocked');
    expect(intents[0]?.blockedReasons.some((reason) => reason.code === 'reserve_floor_breach')).toBe(true);
    expect(intents[0]?.blockedReasons.some((reason) => reason.code === 'venue_concentration_breach')).toBe(true);
  });
});
