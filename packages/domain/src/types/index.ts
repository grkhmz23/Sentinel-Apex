// =============================================================================
// Domain types — barrel
// =============================================================================

export type { AssetSymbol, AssetClass, Asset } from './asset.js';

export type { VenueId, VenueType, VenueStatus, Venue } from './venue.js';

export type {
  PositionId,
  SleeveId,
  PositionSide,
  PositionStatus,
  HedgeState,
  Position,
} from './position.js';
export { toPositionId, toSleeveId } from './position.js';

export type {
  OrderId,
  OrderSide,
  OrderType,
  OrderStatus,
  OrderFill,
  Order,
  OrderIntent,
} from './order.js';
export { toOrderId } from './order.js';

export type {
  OpportunityId,
  OpportunityType,
  OpportunityStatus,
  OpportunityLeg,
  CarryOpportunity,
} from './opportunity.js';
export { toOpportunityId } from './opportunity.js';

export type {
  SleeveKind,
  SleeveStatus,
  Sleeve,
  Portfolio,
} from './portfolio.js';

export type {
  RiskCheckStatus,
  RiskCheckResult,
  RiskAssessment,
  RiskBreachSeverity,
  RiskBreachType,
  RiskBreach,
  CircuitBreakerState,
} from './risk.js';

export type {
  EventId,
  DomainEvent,
  DomainEventType,
  PositionOpenedEvent,
  PositionUpdatedEvent,
  PositionClosedEvent,
  OrderIntentCreatedEvent,
  OrderSubmittedEvent,
  OrderFilledEvent,
  OrderCancelledEvent,
  OrderFailedEvent,
  OpportunityDetectedEvent,
  OpportunityApprovedEvent,
  OpportunityRejectedEvent,
  OpportunityClosedEvent,
  RiskBreachDetectedEvent,
  RiskBreachResolvedEvent,
  CircuitBreakerTrippedEvent,
  CircuitBreakerResetEvent,
  SleeveStatusChangedEvent,
  AllocationChangedEvent,
} from './events.js';

export {
  createPositionOpenedEvent,
  createPositionUpdatedEvent,
  createPositionClosedEvent,
  createOrderIntentCreatedEvent,
  createOrderSubmittedEvent,
  createOrderFilledEvent,
  createOrderCancelledEvent,
  createOrderFailedEvent,
  createOpportunityDetectedEvent,
  createOpportunityApprovedEvent,
  createOpportunityRejectedEvent,
  createOpportunityClosedEvent,
  createRiskBreachDetectedEvent,
  createRiskBreachResolvedEvent,
  createCircuitBreakerTrippedEvent,
  createCircuitBreakerResetEvent,
  createSleeveStatusChangedEvent,
  createAllocationChangedEvent,
} from './events.js';
