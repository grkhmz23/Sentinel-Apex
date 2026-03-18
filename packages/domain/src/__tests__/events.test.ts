import { describe, it, expect } from 'vitest';

import {
  createAllocationChangedEvent,
  createCircuitBreakerResetEvent,
  createCircuitBreakerTrippedEvent,
  createOpportunityApprovedEvent,
  createOpportunityClosedEvent,
  createOpportunityDetectedEvent,
  createOpportunityRejectedEvent,
  createOrderCancelledEvent,
  createOrderFailedEvent,
  createOrderFilledEvent,
  createPositionOpenedEvent,
  createPositionClosedEvent,
  createOrderIntentCreatedEvent,
  createRiskBreachResolvedEvent,
  createRiskBreachDetectedEvent,
  createOrderSubmittedEvent,
  createPositionUpdatedEvent,
  createSleeveStatusChangedEvent,
  type DomainEvent,
} from '../types/events.js';
import { toOpportunityId } from '../types/opportunity.js';
import { toOrderId } from '../types/order.js';
import { toPositionId, toSleeveId } from '../types/position.js';

import type { CarryOpportunity, Order, OrderFill, OrderIntent, Position } from '../types/index.js';

// =============================================================================
// Fixtures
// =============================================================================

const NOW = new Date('2026-01-15T12:00:00Z');

const POSITION_ID = toPositionId('pos-001');
const SLEEVE_ID = toSleeveId('sleeve-carry');
const ORDER_ID = toOrderId('ord-001');
const OPP_ID = toOpportunityId('opp-001');

const POSITION: Position = {
  id: POSITION_ID,
  sleeveId: SLEEVE_ID,
  venueId: 'drift-v2',
  asset: 'SOL',
  side: 'long',
  size: '100.0',
  entryPrice: '150.00',
  markPrice: '155.00',
  unrealizedPnl: '500.00',
  realizedPnl: '0.00',
  fundingAccrued: '0.00',
  openedAt: NOW,
  updatedAt: NOW,
  status: 'open',
  hedgeState: 'fully_hedged',
  metadata: {},
};

const ORDER_INTENT: OrderIntent = {
  intentId: 'intent-001',
  venueId: 'drift-v2',
  asset: 'SOL',
  side: 'buy',
  type: 'limit',
  size: '100.0',
  limitPrice: '150.00',
  opportunityId: OPP_ID,
  reduceOnly: false,
  createdAt: NOW,
  metadata: {},
};

const ORDER: Order = {
  id: ORDER_ID,
  venueOrderId: 'drift-ord-999',
  venueId: 'drift-v2',
  asset: 'SOL',
  side: 'buy',
  type: 'limit',
  size: '100.0',
  limitPrice: '150.00',
  filledSize: '100.0',
  avgFillPrice: '150.00',
  status: 'filled',
  positionId: POSITION_ID,
  opportunityId: OPP_ID,
  fills: [],
  createdAt: NOW,
  updatedAt: NOW,
  failureReason: null,
  metadata: {},
};

const ORDER_FILL: OrderFill = {
  fillId: 'fill-001',
  orderId: ORDER_ID,
  filledSize: '100.0',
  fillPrice: '150.00',
  fee: '0.075',
  feeAsset: 'USDC',
  filledAt: NOW,
};

const OPPORTUNITY: CarryOpportunity = {
  id: OPP_ID,
  type: 'funding_rate_arb',
  status: 'active',
  asset: 'SOL',
  expectedAnnualYield: '0.35',
  fundingRate: '0.0001',
  basisSpread: '0.002',
  netCostOfCarry: '-0.001',
  legs: [
    {
      label: 'spot_long',
      venueId: 'drift-v2',
      asset: 'SOL',
      side: 'buy',
      size: '100.0',
      estimatedEntryPrice: '150.00',
    },
    {
      label: 'perp_short',
      venueId: 'drift-v2',
      asset: 'SOL',
      side: 'sell',
      size: '100.0',
      estimatedEntryPrice: '150.30',
    },
  ],
  targetNotionalUsd: '15000.00',
  confidenceScore: 0.87,
  rejectionReason: null,
  detectedAt: NOW,
  updatedAt: NOW,
  executionStartedAt: NOW,
  closedAt: null,
  metadata: {},
};

// =============================================================================
// Helper — discriminated union narrowing
// =============================================================================

/**
 * Exercise TypeScript's narrowing via switch on eventType.
 * This function is called by tests to confirm the type narrows correctly.
 */
function handleEvent(event: DomainEvent): string {
  switch (event.eventType) {
    case 'PositionOpened':
      return `position:${event.payload.position.id}`;
    case 'PositionUpdated':
      return `position-updated:${event.payload.positionId}`;
    case 'PositionClosed':
      return `position-closed:${event.payload.positionId}`;
    case 'OrderIntentCreated':
      return `intent:${event.payload.intent.intentId}`;
    case 'OrderSubmitted':
      return `order:${event.payload.order.id}`;
    case 'OrderFilled':
      return `order-filled:${event.payload.orderId}`;
    case 'OrderCancelled':
      return `order-cancelled:${event.payload.orderId}`;
    case 'OrderFailed':
      return `order-failed:${event.payload.orderId}`;
    case 'OpportunityDetected':
      return `opp:${event.payload.opportunity.id}`;
    case 'OpportunityApproved':
      return `opp-approved:${event.payload.opportunityId}`;
    case 'OpportunityRejected':
      return `opp-rejected:${event.payload.opportunityId}`;
    case 'OpportunityClosed':
      return `opp-closed:${event.payload.opportunityId}`;
    case 'RiskBreachDetected':
      return `breach:${event.payload.breach.id}`;
    case 'RiskBreachResolved':
      return `breach-resolved:${event.payload.breachId}`;
    case 'CircuitBreakerTripped':
      return `cb-tripped:${event.payload.breakerName}`;
    case 'CircuitBreakerReset':
      return `cb-reset:${event.payload.breakerName}`;
    case 'SleeveStatusChanged':
      return `sleeve:${event.payload.sleeveId}`;
    case 'AllocationChanged':
      return `alloc:${event.payload.sleeveId}`;
  }
}

// =============================================================================
// Tests: structure validation
// =============================================================================

describe('Domain events — common structure', () => {
  it('every factory sets eventId as a non-empty string', () => {
    const event = createPositionOpenedEvent({ position: POSITION });
    expect(typeof event.eventId).toBe('string');
    expect(event.eventId.length).toBeGreaterThan(0);
  });

  it('every factory sets occurredAt as a Date', () => {
    const event = createPositionOpenedEvent({ position: POSITION });
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  it('every factory sets version to 1', () => {
    const event = createPositionOpenedEvent({ position: POSITION });
    expect(event.version).toBe(1);
  });

  it('two events created in quick succession have distinct eventIds', () => {
    const a = createPositionOpenedEvent({ position: POSITION });
    const b = createPositionOpenedEvent({ position: POSITION });
    expect(a.eventId).not.toBe(b.eventId);
  });
});

// =============================================================================
// Tests: discriminated union narrowing
// =============================================================================

describe('Domain events — discriminated union narrowing', () => {
  it('PositionOpened narrows correctly', () => {
    const event = createPositionOpenedEvent({ position: POSITION });
    expect(handleEvent(event)).toBe(`position:${POSITION_ID}`);
  });

  it('PositionUpdated narrows correctly', () => {
    const event = createPositionUpdatedEvent({
      positionId: POSITION_ID,
      position: POSITION,
      reason: 'mark_price_refresh',
    });
    expect(handleEvent(event)).toBe(`position-updated:${POSITION_ID}`);
  });

  it('PositionClosed narrows correctly', () => {
    const event = createPositionClosedEvent({
      positionId: POSITION_ID,
      finalPosition: POSITION,
      totalRealizedPnl: '250.00',
      totalFundingAccrued: '12.50',
    });
    expect(handleEvent(event)).toBe(`position-closed:${POSITION_ID}`);
  });

  it('OrderIntentCreated narrows correctly', () => {
    const event = createOrderIntentCreatedEvent({ intent: ORDER_INTENT });
    expect(handleEvent(event)).toBe(`intent:${ORDER_INTENT.intentId}`);
  });

  it('OrderSubmitted narrows correctly', () => {
    const event = createOrderSubmittedEvent({ order: ORDER });
    expect(handleEvent(event)).toBe(`order:${ORDER_ID}`);
  });

  it('OrderFilled narrows correctly', () => {
    const event = createOrderFilledEvent({ orderId: ORDER_ID, fill: ORDER_FILL, order: ORDER });
    expect(handleEvent(event)).toBe(`order-filled:${ORDER_ID}`);
  });

  it('OrderCancelled narrows correctly', () => {
    const event = createOrderCancelledEvent({ orderId: ORDER_ID, reason: 'user_cancel', order: ORDER });
    expect(handleEvent(event)).toBe(`order-cancelled:${ORDER_ID}`);
  });

  it('OrderFailed narrows correctly', () => {
    const event = createOrderFailedEvent({ orderId: ORDER_ID, reason: 'venue_reject', order: ORDER });
    expect(handleEvent(event)).toBe(`order-failed:${ORDER_ID}`);
  });

  it('OpportunityDetected narrows correctly', () => {
    const event = createOpportunityDetectedEvent({ opportunity: OPPORTUNITY });
    expect(handleEvent(event)).toBe(`opp:${OPP_ID}`);
  });

  it('OpportunityApproved narrows correctly', () => {
    const event = createOpportunityApprovedEvent({
      opportunityId: OPP_ID,
      opportunity: OPPORTUNITY,
      approvedNotionalUsd: '15000.00',
    });
    expect(handleEvent(event)).toBe(`opp-approved:${OPP_ID}`);
  });

  it('OpportunityRejected narrows correctly', () => {
    const event = createOpportunityRejectedEvent({
      opportunityId: OPP_ID,
      reason: 'low_confidence',
      opportunity: OPPORTUNITY,
    });
    expect(handleEvent(event)).toBe(`opp-rejected:${OPP_ID}`);
  });

  it('OpportunityClosed narrows correctly', () => {
    const event = createOpportunityClosedEvent({
      opportunityId: OPP_ID,
      opportunity: OPPORTUNITY,
      realizedPnl: '500.00',
      holdingPeriodMs: 86_400_000,
    });
    expect(handleEvent(event)).toBe(`opp-closed:${OPP_ID}`);
  });

  it('RiskBreachDetected narrows correctly', () => {
    const breach = {
      id: 'breach-001',
      type: 'max_drawdown_exceeded' as const,
      severity: 'high' as const,
      triggeredAt: NOW,
      resolvedAt: null,
      details: { drawdown: '-0.12' },
    };
    const event = createRiskBreachDetectedEvent({ breach });
    expect(handleEvent(event)).toBe('breach:breach-001');
  });

  it('RiskBreachResolved narrows correctly', () => {
    const breach = {
      id: 'breach-001',
      type: 'max_drawdown_exceeded' as const,
      severity: 'high' as const,
      triggeredAt: NOW,
      resolvedAt: NOW,
      details: {},
    };
    const event = createRiskBreachResolvedEvent({
      breachId: 'breach-001',
      breach,
      resolvedBy: 'ops@example.com',
    });
    expect(handleEvent(event)).toBe('breach-resolved:breach-001');
  });

  it('CircuitBreakerTripped narrows correctly', () => {
    const event = createCircuitBreakerTrippedEvent({
      breakerName: 'sol_drawdown',
      previousState: 'closed',
      reason: 'daily_loss_exceeded',
      affectedAsset: 'SOL',
    });
    expect(handleEvent(event)).toBe('cb-tripped:sol_drawdown');
    expect(event.payload.previousState).toBe('closed');
  });

  it('CircuitBreakerReset narrows correctly', () => {
    const event = createCircuitBreakerResetEvent({
      breakerName: 'sol_drawdown',
      newState: 'closed',
      resetBy: 'ops@example.com',
    });
    expect(handleEvent(event)).toBe('cb-reset:sol_drawdown');
  });

  it('SleeveStatusChanged narrows correctly', () => {
    const event = createSleeveStatusChangedEvent({
      sleeveId: SLEEVE_ID,
      previousStatus: 'active',
      newStatus: 'paused',
      reason: 'manual_pause',
    });
    expect(handleEvent(event)).toBe(`sleeve:${SLEEVE_ID}`);
    expect(event.payload.newStatus).toBe('paused');
  });

  it('AllocationChanged narrows correctly', () => {
    const event = createAllocationChangedEvent({
      sleeveId: SLEEVE_ID,
      previousTargetPct: 50,
      newTargetPct: 40,
      changedBy: 'rebalancer',
    });
    expect(handleEvent(event)).toBe(`alloc:${SLEEVE_ID}`);
    expect(event.payload.newTargetPct).toBe(40);
  });
});

// =============================================================================
// Tests: eventType literals
// =============================================================================

describe('Domain events — eventType literals', () => {
  it('PositionOpened has correct eventType', () => {
    const event = createPositionOpenedEvent({ position: POSITION });
    expect(event.eventType).toBe('PositionOpened');
  });

  it('OrderSubmitted has correct eventType', () => {
    const event = createOrderSubmittedEvent({ order: ORDER });
    expect(event.eventType).toBe('OrderSubmitted');
  });

  it('OpportunityDetected has correct eventType', () => {
    const event = createOpportunityDetectedEvent({ opportunity: OPPORTUNITY });
    expect(event.eventType).toBe('OpportunityDetected');
  });

  it('CircuitBreakerTripped has correct eventType', () => {
    const event = createCircuitBreakerTrippedEvent({
      breakerName: 'main',
      previousState: 'closed',
      reason: 'test',
      affectedAsset: null,
    });
    expect(event.eventType).toBe('CircuitBreakerTripped');
  });
});
