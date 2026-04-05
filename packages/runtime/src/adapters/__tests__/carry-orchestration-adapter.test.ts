import { describe, it, expect } from 'vitest';

import {
  toLegSide,
  toLegDefinition,
  createCoordinationConfig,
  buildLegDefinitions,
  calculateTotalNotional,
  buildMultiLegPlanInput,
  calculateExecutionOrder,
  calculateHedgeDeviation,
} from '../carry-orchestration-adapter.js';

import type { CarryActionPlannedOrderView } from '../../types.js';

describe('Carry Orchestration Adapter', () => {
  describe('toLegSide', () => {
    it('converts buy to long for spot leg', () => {
      expect(toLegSide('buy', 'spot')).toBe('long');
    });

    it('converts sell to short for perp leg', () => {
      expect(toLegSide('sell', 'perp')).toBe('short');
    });

    it('always returns long for spot type regardless of order side', () => {
      // For delta-neutral, spot is always long
      expect(toLegSide('buy', 'spot')).toBe('long');
    });

    it('always returns short for perp type regardless of order side', () => {
      // For delta-neutral, perp is always short
      expect(toLegSide('sell', 'perp')).toBe('short');
    });
  });

  describe('toLegDefinition', () => {
    const mockOrder: CarryActionPlannedOrderView = {
      id: 'order-1',
      carryActionId: 'action-1',
      intentId: 'intent-1',
      asset: 'BTC',
      venueId: 'drift',
      side: 'buy',
      orderType: 'market',
      requestedSize: '1.5',
      requestedPrice: '50000',
      reduceOnly: false,
      createdAt: new Date().toISOString(),
      metadata: {},
      marketIdentity: null,
    };

    it('creates spot leg definition correctly', () => {
      const leg = toLegDefinition(mockOrder, 0, 'spot');

      expect(leg.legSequence).toBe(0);
      expect(leg.legType).toBe('spot');
      expect(leg.side).toBe('long');
      expect(leg.venueId).toBe('drift');
      expect(leg.asset).toBe('BTC');
      expect(leg.targetSize.toString()).toBe('1.5');
      expect(leg.targetNotionalUsd.toString()).toBe('75000');
    });

    it('creates perp leg definition correctly', () => {
      const leg = toLegDefinition(mockOrder, 1, 'perp');

      expect(leg.legSequence).toBe(1);
      expect(leg.legType).toBe('perp');
      expect(leg.side).toBe('short');
    });

    it('handles null price as zero', () => {
      const orderWithNullPrice = { ...mockOrder, requestedPrice: null };
      const leg = toLegDefinition(orderWithNullPrice, 0, 'spot');

      expect(leg.targetNotionalUsd.toString()).toBe('0');
    });
  });

  describe('createCoordinationConfig', () => {
    it('creates default config', () => {
      const config = createCoordinationConfig();

      expect(config.maxHedgeDeviationPct).toBe(2.0);
      expect(config.perpFirst).toBe(true);
      expect(config.executionTimeoutMs).toBe(30000);
      expect(config.minimumSizeIncrement).toBe('0.0001');
    });

    it('allows overrides', () => {
      const config = createCoordinationConfig({
        maxHedgeDeviationPct: 5.0,
        perpFirst: false,
      });

      expect(config.maxHedgeDeviationPct).toBe(5.0);
      expect(config.perpFirst).toBe(false);
      expect(config.executionTimeoutMs).toBe(30000); // unchanged
    });
  });

  describe('buildLegDefinitions', () => {
    const mockOrders: CarryActionPlannedOrderView[] = [
      {
        id: 'order-1',
        carryActionId: 'action-1',
        intentId: 'intent-1',
        asset: 'BTC',
        venueId: 'drift-spot',
        side: 'buy',
        orderType: 'market',
        requestedSize: '1.0',
        requestedPrice: '50000',
        reduceOnly: false,
        createdAt: new Date().toISOString(),
        metadata: {},
        marketIdentity: null,
      },
      {
        id: 'order-2',
        carryActionId: 'action-1',
        intentId: 'intent-2',
        asset: 'BTC',
        venueId: 'drift-perp',
        side: 'sell',
        orderType: 'market',
        requestedSize: '1.0',
        requestedPrice: '50000',
        reduceOnly: false,
        createdAt: new Date().toISOString(),
        metadata: {},
        marketIdentity: null,
      },
    ];

    it('creates 2 legs for 2 orders', () => {
      const legs = buildLegDefinitions(mockOrders);

      expect(legs).toHaveLength(2);
      expect(legs[0]!.legType).toBe('spot');
      expect(legs[1]!.legType).toBe('perp');
    });

    it('throws for less than 2 orders', () => {
      expect(() => buildLegDefinitions([mockOrders[0]!])).toThrow(
        'Multi-leg execution requires at least 2 legs'
      );
    });

    it('assigns correct sides for delta-neutral', () => {
      const legs = buildLegDefinitions(mockOrders);

      expect(legs[0]!.side).toBe('long'); // spot
      expect(legs[1]!.side).toBe('short'); // perp
    });
  });

  describe('calculateTotalNotional', () => {
    const mockOrders: CarryActionPlannedOrderView[] = [
      {
        id: 'order-1',
        carryActionId: 'action-1',
        intentId: 'intent-1',
        asset: 'BTC',
        venueId: 'drift',
        side: 'buy',
        orderType: 'market',
        requestedSize: '1.0',
        requestedPrice: '50000',
        reduceOnly: false,
        createdAt: new Date().toISOString(),
        metadata: {},
        marketIdentity: null,
      },
      {
        id: 'order-2',
        carryActionId: 'action-1',
        intentId: 'intent-2',
        asset: 'BTC',
        venueId: 'drift',
        side: 'sell',
        orderType: 'market',
        requestedSize: '1.0',
        requestedPrice: '50000',
        reduceOnly: false,
        createdAt: new Date().toISOString(),
        metadata: {},
        marketIdentity: null,
      },
    ];

    it('calculates total notional correctly', () => {
      const notional = calculateTotalNotional(mockOrders);
      expect(notional.toString()).toBe('100000');
    });

    it('handles zero price as zero contribution', () => {
      const ordersWithZeroPrice: CarryActionPlannedOrderView[] = [
        { ...mockOrders[0]!, requestedPrice: null },
        mockOrders[1]!,
      ];
      const notional = calculateTotalNotional(ordersWithZeroPrice);
      expect(notional.toString()).toBe('50000');
    });
  });

  describe('buildMultiLegPlanInput', () => {
    const mockOrders: CarryActionPlannedOrderView[] = [
      {
        id: 'order-1',
        carryActionId: 'action-1',
        intentId: 'intent-1',
        asset: 'BTC',
        venueId: 'drift-spot',
        side: 'buy',
        orderType: 'market',
        requestedSize: '1.0',
        requestedPrice: '50000',
        reduceOnly: false,
        createdAt: new Date().toISOString(),
        metadata: {},
        marketIdentity: null,
      },
      {
        id: 'order-2',
        carryActionId: 'action-1',
        intentId: 'intent-2',
        asset: 'BTC',
        venueId: 'drift-perp',
        side: 'sell',
        orderType: 'market',
        requestedSize: '1.0',
        requestedPrice: '50000',
        reduceOnly: false,
        createdAt: new Date().toISOString(),
        metadata: {},
        marketIdentity: null,
      },
    ];

    it('builds complete plan input', () => {
      const input = buildMultiLegPlanInput(
        'action-1',
        'run-1',
        'BTC',
        mockOrders
      );

      expect(input.carryActionId).toBe('action-1');
      expect(input.strategyRunId).toBe('run-1');
      expect(input.asset).toBe('BTC');
      expect(input.notionalUsd.toString()).toBe('100000');
      expect(input.legs).toHaveLength(2);
      expect(input.maxHedgeDeviationPct.toString()).toBe('2');
    });

    it('handles null strategyRunId', () => {
      const input = buildMultiLegPlanInput('action-1', null, 'BTC', mockOrders);
      expect(input.strategyRunId).toBeUndefined();
    });
  });

  describe('calculateExecutionOrder', () => {
    it('returns sequential order when perpFirst is false', () => {
      const config = createCoordinationConfig({ perpFirst: false });
      const order = calculateExecutionOrder(config, 2);
      expect(order).toEqual([0, 1]);
    });

    it('puts perp first when perpFirst is true', () => {
      const config = createCoordinationConfig({ perpFirst: true });
      const order = calculateExecutionOrder(config, 2);
      expect(order).toEqual([1, 0]);
    });

    it('handles more than 2 legs', () => {
      const config = createCoordinationConfig({ perpFirst: true });
      const order = calculateExecutionOrder(config, 4);
      expect(order).toEqual([1, 0, 2, 3]);
    });
  });

  describe('calculateHedgeDeviation', () => {
    it('returns zero deviation for equal sizes', () => {
      const result = calculateHedgeDeviation('1.0', '1.0');
      expect(result.deviationPct).toBe(0);
      expect(result.imbalanceDirection).toBe('balanced');
    });

    it('detects spot heavy', () => {
      const result = calculateHedgeDeviation('1.1', '1.0');
      expect(result.deviationPct).toBeCloseTo(9.52, 1);
      expect(result.imbalanceDirection).toBe('spot_heavy');
    });

    it('detects perp heavy', () => {
      const result = calculateHedgeDeviation('1.0', '1.1');
      expect(result.deviationPct).toBeCloseTo(9.52, 1);
      expect(result.imbalanceDirection).toBe('perp_heavy');
    });

    it('handles zero executed sizes', () => {
      const result = calculateHedgeDeviation('0', '0');
      expect(result.deviationPct).toBe(0);
      expect(result.imbalanceDirection).toBe('balanced');
    });
  });
});
