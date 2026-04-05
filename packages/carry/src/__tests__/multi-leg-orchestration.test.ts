import { Decimal } from 'decimal.js';
import { describe, it, expect } from 'vitest';

import {
  createMultiLegPlan,
  calculateHedgeState,
  updatePlanStatus,
  validateMultiLegPlan,
  determinePartialFailureAction,
  type MultiLegPlanInput,
  type LegDefinition,
  type PartialFailureHandling,
} from '../multi-leg-orchestration.js';

const DEFAULT_CONFIG = {
  maxHedgeDeviationPct: 1,
  perpFirst: true,
  executionTimeoutMs: 30000,
  minimumSizeIncrement: '0.0001',
};

describe('Multi-Leg Orchestration', () => {
  describe('createMultiLegPlan', () => {
    const validLegs: LegDefinition[] = [
      {
        legSequence: 1,
        legType: 'perp',
        side: 'short',
        venueId: 'drift-devnet',
        asset: 'BTC',
        marketSymbol: 'BTC-PERP',
        targetSize: new Decimal(0.1),
        targetNotionalUsd: new Decimal(5000),
      },
      {
        legSequence: 2,
        legType: 'spot',
        side: 'long',
        venueId: 'jupiter',
        asset: 'BTC',
        targetSize: new Decimal(0.1),
        targetNotionalUsd: new Decimal(5000),
        dependsOn: 1, // Depends on perp leg
      },
    ];

    it('should create a valid multi-leg plan', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: validLegs,
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const result = createMultiLegPlan(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.carryActionId).toBe('action_123');
        expect(result.value.asset).toBe('BTC');
        expect(result.value.legCount).toBe(2);
        expect(result.value.planType).toBe('delta_neutral_carry');
        expect(result.value.executionOrder).toEqual([1, 2]);
        expect(result.value.status).toBe('pending');
      }
    });

    it('should detect circular dependencies', () => {
      const circularLegs: LegDefinition[] = [
        {
          legSequence: 1,
          legType: 'perp',
          side: 'short',
          venueId: 'drift-devnet',
          asset: 'BTC',
          targetSize: new Decimal(0.1),
          targetNotionalUsd: new Decimal(5000),
          dependsOn: 2, // Depends on leg 2
        },
        {
          legSequence: 2,
          legType: 'spot',
          side: 'long',
          venueId: 'jupiter',
          asset: 'BTC',
          targetSize: new Decimal(0.1),
          targetNotionalUsd: new Decimal(5000),
          dependsOn: 1, // Depends on leg 1 - circular!
        },
      ];

      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: circularLegs,
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const result = createMultiLegPlan(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Circular dependency');
      }
    });

    it('should reject non-contiguous leg sequences', () => {
      const badLegs: LegDefinition[] = [
        {
          legSequence: 1,
          legType: 'perp',
          side: 'short',
          venueId: 'drift-devnet',
          asset: 'BTC',
          targetSize: new Decimal(0.1),
          targetNotionalUsd: new Decimal(5000),
        },
        {
          legSequence: 3, // Missing sequence 2
          legType: 'spot',
          side: 'long',
          venueId: 'jupiter',
          asset: 'BTC',
          targetSize: new Decimal(0.1),
          targetNotionalUsd: new Decimal(5000),
        },
      ];

      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: badLegs,
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const result = createMultiLegPlan(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('contiguous');
      }
    });

    it('should reject empty legs array', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const result = createMultiLegPlan(input);

      expect(result.ok).toBe(false);
    });
  });

  describe('calculateHedgeState', () => {
    it('should calculate balanced hedge state', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'long',
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      // Simulate completed execution
      if (plan.legs[0]) {
        plan.legs[0].status = 'completed';
        plan.legs[0].executedSize = new Decimal(0.1);
      }
      if (plan.legs[1]) {
        plan.legs[1].status = 'completed';
        plan.legs[1].executedSize = new Decimal(0.1);
      }

      const hedgeResult = calculateHedgeState(plan);

      expect(hedgeResult.ok).toBe(true);
      if (hedgeResult.ok) {
        expect(hedgeResult.value.status).toBe('balanced');
        expect(hedgeResult.value.hedgeDeviationPct.toNumber()).toBe(0);
        expect(hedgeResult.value.imbalanceThresholdBreached).toBe(false);
      }
    });

    it('should detect imbalanced hedge', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'long',
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      // Simulate imbalanced execution (5% deviation)
      if (plan.legs[0]) {
        plan.legs[0].status = 'completed';
        plan.legs[0].executedSize = new Decimal(0.1);
      }
      if (plan.legs[1]) {
        plan.legs[1].status = 'completed';
        plan.legs[1].executedSize = new Decimal(0.095); // 5% less
      }

      const hedgeResult = calculateHedgeState(plan);

      expect(hedgeResult.ok).toBe(true);
      if (hedgeResult.ok) {
        expect(hedgeResult.value.status).toBe('imbalanced');
        expect(hedgeResult.value.hedgeDeviationPct.toNumber()).toBe(5);
        expect(hedgeResult.value.imbalanceThresholdBreached).toBe(true);
        expect(hedgeResult.value.imbalanceDirection).toBe('perp_heavy');
      }
    });
  });

  describe('updatePlanStatus', () => {
    it('should return completed when all legs completed', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      if (plan.legs[0]) plan.legs[0].status = 'completed';

      expect(updatePlanStatus(plan)).toBe('completed');
    });

    it('should return failed when all legs failed', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      if (plan.legs[0]) plan.legs[0].status = 'failed';

      expect(updatePlanStatus(plan)).toBe('failed');
    });

    it('should return partial when some legs completed and some failed', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'long',
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      if (plan.legs[0]) plan.legs[0].status = 'completed';
      if (plan.legs[1]) plan.legs[1].status = 'failed';

      expect(updatePlanStatus(plan)).toBe('partial');
    });
  });

  describe('validateMultiLegPlan', () => {
    it('should validate delta-neutral plan correctly', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'long',
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const validation = validateMultiLegPlan(planResult.value);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should error on same-side delta-neutral legs', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'short', // Same side - wrong!
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const validation = validateMultiLegPlan(planResult.value);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('opposite sides'))).toBe(true);
    });
  });

  describe('determinePartialFailureAction', () => {
    it('should continue with remaining legs on continue action', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'long',
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      if (plan.legs[0]) plan.legs[0].status = 'completed';

      const config: PartialFailureHandling = { action: 'continue' };
      const result = determinePartialFailureAction(plan, 1, config);

      expect(result.action).toBe('continue');
    });

    it('should identify rollback legs on rollback action', () => {
      const input: MultiLegPlanInput = {
        carryActionId: 'action_123',
        asset: 'BTC',
        notionalUsd: new Decimal(10000),
        legs: [
          {
            legSequence: 1,
            legType: 'perp',
            side: 'short',
            venueId: 'drift-devnet',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
          {
            legSequence: 2,
            legType: 'spot',
            side: 'long',
            venueId: 'jupiter',
            asset: 'BTC',
            targetSize: new Decimal(0.1),
            targetNotionalUsd: new Decimal(5000),
          },
        ],
        coordinationConfig: DEFAULT_CONFIG,
        maxHedgeDeviationPct: new Decimal(1),
      };

      const planResult = createMultiLegPlan(input);
      expect(planResult.ok).toBe(true);
      if (!planResult.ok) return;

      const plan = planResult.value;
      if (plan.legs[0]) plan.legs[0].status = 'completed';

      const config: PartialFailureHandling = { action: 'rollback' };
      const result = determinePartialFailureAction(plan, 2, config);

      expect(result.action).toBe('rollback');
      expect(result.rollbackLegs).toContain(1);
    });
  });
});
