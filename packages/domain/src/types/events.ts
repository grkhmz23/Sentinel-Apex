// =============================================================================
// Domain events — discriminated union
// =============================================================================
// Every event must be created via the helper functions at the bottom of this
// file so that eventId, occurredAt, and version are always set consistently.
// =============================================================================

import { createId, type Brand } from '../branded.js';

import type { AssetSymbol } from './asset.js';
import type { CarryOpportunity, OpportunityId } from './opportunity.js';
import type { Order, OrderId, OrderFill, OrderIntent } from './order.js';
import type { SleeveStatus } from './portfolio.js';
import type { Position, PositionId, SleeveId } from './position.js';
import type { RiskBreach, CircuitBreakerState } from './risk.js';

// ── Branded event ID ──────────────────────────────────────────────────────────

export type EventId = Brand<string, 'EventId'>;

function newEventId(): EventId {
  return createId() as EventId;
}

// =============================================================================
// Event base — every event carries these fields
// =============================================================================

interface DomainEventBase<TType extends string, TPayload> {
  readonly eventId: EventId;
  readonly eventType: TType;
  readonly occurredAt: Date;
  /** Schema version for forward compatibility.  Start at 1. */
  readonly version: number;
  readonly payload: TPayload;
}

// =============================================================================
// Position events
// =============================================================================

export type PositionOpenedEvent = DomainEventBase<
  'PositionOpened',
  {
    readonly position: Position;
  }
>;

export type PositionUpdatedEvent = DomainEventBase<
  'PositionUpdated',
  {
    readonly positionId: PositionId;
    /** Snapshot of the position after the update. */
    readonly position: Position;
    /** Human-readable reason for the update (e.g. 'mark_price_refresh'). */
    readonly reason: string;
  }
>;

export type PositionClosedEvent = DomainEventBase<
  'PositionClosed',
  {
    readonly positionId: PositionId;
    readonly finalPosition: Position;
    /** Total realised PnL for the lifetime of the position. */
    readonly totalRealizedPnl: string;
    /** Total funding accrued over the lifetime of the position. */
    readonly totalFundingAccrued: string;
  }
>;

// =============================================================================
// Order events
// =============================================================================

export type OrderIntentCreatedEvent = DomainEventBase<
  'OrderIntentCreated',
  {
    readonly intent: OrderIntent;
  }
>;

export type OrderSubmittedEvent = DomainEventBase<
  'OrderSubmitted',
  {
    readonly order: Order;
  }
>;

export type OrderFilledEvent = DomainEventBase<
  'OrderFilled',
  {
    readonly orderId: OrderId;
    readonly fill: OrderFill;
    /** Order snapshot after applying the fill. */
    readonly order: Order;
  }
>;

export type OrderCancelledEvent = DomainEventBase<
  'OrderCancelled',
  {
    readonly orderId: OrderId;
    readonly reason: string;
    readonly order: Order;
  }
>;

export type OrderFailedEvent = DomainEventBase<
  'OrderFailed',
  {
    readonly orderId: OrderId;
    readonly reason: string;
    readonly order: Order;
  }
>;

// =============================================================================
// Opportunity events
// =============================================================================

export type OpportunityDetectedEvent = DomainEventBase<
  'OpportunityDetected',
  {
    readonly opportunity: CarryOpportunity;
  }
>;

export type OpportunityApprovedEvent = DomainEventBase<
  'OpportunityApproved',
  {
    readonly opportunityId: OpportunityId;
    readonly opportunity: CarryOpportunity;
    /** Approved notional size in USD. */
    readonly approvedNotionalUsd: string;
  }
>;

export type OpportunityRejectedEvent = DomainEventBase<
  'OpportunityRejected',
  {
    readonly opportunityId: OpportunityId;
    readonly reason: string;
    readonly opportunity: CarryOpportunity;
  }
>;

export type OpportunityClosedEvent = DomainEventBase<
  'OpportunityClosed',
  {
    readonly opportunityId: OpportunityId;
    readonly opportunity: CarryOpportunity;
    /** Realised PnL for this opportunity. */
    readonly realizedPnl: string;
    /** Holding period in milliseconds. */
    readonly holdingPeriodMs: number;
  }
>;

// =============================================================================
// Risk events
// =============================================================================

export type RiskBreachDetectedEvent = DomainEventBase<
  'RiskBreachDetected',
  {
    readonly breach: RiskBreach;
  }
>;

export type RiskBreachResolvedEvent = DomainEventBase<
  'RiskBreachResolved',
  {
    readonly breachId: string;
    readonly breach: RiskBreach;
    readonly resolvedBy: string;
  }
>;

export type CircuitBreakerTrippedEvent = DomainEventBase<
  'CircuitBreakerTripped',
  {
    readonly breakerName: string;
    readonly previousState: CircuitBreakerState;
    readonly reason: string;
    readonly affectedAsset: AssetSymbol | null;
  }
>;

export type CircuitBreakerResetEvent = DomainEventBase<
  'CircuitBreakerReset',
  {
    readonly breakerName: string;
    readonly newState: CircuitBreakerState;
    readonly resetBy: string;
  }
>;

// =============================================================================
// Portfolio events
// =============================================================================

export type SleeveStatusChangedEvent = DomainEventBase<
  'SleeveStatusChanged',
  {
    readonly sleeveId: SleeveId;
    readonly previousStatus: SleeveStatus;
    readonly newStatus: SleeveStatus;
    readonly reason: string;
  }
>;

export type AllocationChangedEvent = DomainEventBase<
  'AllocationChanged',
  {
    readonly sleeveId: SleeveId;
    readonly previousTargetPct: number;
    readonly newTargetPct: number;
    readonly changedBy: string;
  }
>;

// =============================================================================
// Discriminated union
// =============================================================================

export type DomainEvent =
  // Position
  | PositionOpenedEvent
  | PositionUpdatedEvent
  | PositionClosedEvent
  // Order
  | OrderIntentCreatedEvent
  | OrderSubmittedEvent
  | OrderFilledEvent
  | OrderCancelledEvent
  | OrderFailedEvent
  // Opportunity
  | OpportunityDetectedEvent
  | OpportunityApprovedEvent
  | OpportunityRejectedEvent
  | OpportunityClosedEvent
  // Risk
  | RiskBreachDetectedEvent
  | RiskBreachResolvedEvent
  | CircuitBreakerTrippedEvent
  | CircuitBreakerResetEvent
  // Portfolio
  | SleeveStatusChangedEvent
  | AllocationChangedEvent;

export type DomainEventType = DomainEvent['eventType'];

// =============================================================================
// Factory helpers
// =============================================================================
// These ensure boilerplate fields (eventId, occurredAt, version) are always
// populated, and that the eventType discriminant matches the payload type.
// =============================================================================

const EVENT_VERSION = 1;

export function createPositionOpenedEvent(
  payload: PositionOpenedEvent['payload'],
): PositionOpenedEvent {
  return { eventId: newEventId(), eventType: 'PositionOpened', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createPositionUpdatedEvent(
  payload: PositionUpdatedEvent['payload'],
): PositionUpdatedEvent {
  return { eventId: newEventId(), eventType: 'PositionUpdated', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createPositionClosedEvent(
  payload: PositionClosedEvent['payload'],
): PositionClosedEvent {
  return { eventId: newEventId(), eventType: 'PositionClosed', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOrderIntentCreatedEvent(
  payload: OrderIntentCreatedEvent['payload'],
): OrderIntentCreatedEvent {
  return { eventId: newEventId(), eventType: 'OrderIntentCreated', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOrderSubmittedEvent(
  payload: OrderSubmittedEvent['payload'],
): OrderSubmittedEvent {
  return { eventId: newEventId(), eventType: 'OrderSubmitted', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOrderFilledEvent(
  payload: OrderFilledEvent['payload'],
): OrderFilledEvent {
  return { eventId: newEventId(), eventType: 'OrderFilled', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOrderCancelledEvent(
  payload: OrderCancelledEvent['payload'],
): OrderCancelledEvent {
  return { eventId: newEventId(), eventType: 'OrderCancelled', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOrderFailedEvent(
  payload: OrderFailedEvent['payload'],
): OrderFailedEvent {
  return { eventId: newEventId(), eventType: 'OrderFailed', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOpportunityDetectedEvent(
  payload: OpportunityDetectedEvent['payload'],
): OpportunityDetectedEvent {
  return { eventId: newEventId(), eventType: 'OpportunityDetected', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOpportunityApprovedEvent(
  payload: OpportunityApprovedEvent['payload'],
): OpportunityApprovedEvent {
  return { eventId: newEventId(), eventType: 'OpportunityApproved', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOpportunityRejectedEvent(
  payload: OpportunityRejectedEvent['payload'],
): OpportunityRejectedEvent {
  return { eventId: newEventId(), eventType: 'OpportunityRejected', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createOpportunityClosedEvent(
  payload: OpportunityClosedEvent['payload'],
): OpportunityClosedEvent {
  return { eventId: newEventId(), eventType: 'OpportunityClosed', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createRiskBreachDetectedEvent(
  payload: RiskBreachDetectedEvent['payload'],
): RiskBreachDetectedEvent {
  return { eventId: newEventId(), eventType: 'RiskBreachDetected', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createRiskBreachResolvedEvent(
  payload: RiskBreachResolvedEvent['payload'],
): RiskBreachResolvedEvent {
  return { eventId: newEventId(), eventType: 'RiskBreachResolved', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createCircuitBreakerTrippedEvent(
  payload: CircuitBreakerTrippedEvent['payload'],
): CircuitBreakerTrippedEvent {
  return { eventId: newEventId(), eventType: 'CircuitBreakerTripped', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createCircuitBreakerResetEvent(
  payload: CircuitBreakerResetEvent['payload'],
): CircuitBreakerResetEvent {
  return { eventId: newEventId(), eventType: 'CircuitBreakerReset', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createSleeveStatusChangedEvent(
  payload: SleeveStatusChangedEvent['payload'],
): SleeveStatusChangedEvent {
  return { eventId: newEventId(), eventType: 'SleeveStatusChanged', occurredAt: new Date(), version: EVENT_VERSION, payload };
}

export function createAllocationChangedEvent(
  payload: AllocationChangedEvent['payload'],
): AllocationChangedEvent {
  return { eventId: newEventId(), eventType: 'AllocationChanged', occurredAt: new Date(), version: EVENT_VERSION, payload };
}
