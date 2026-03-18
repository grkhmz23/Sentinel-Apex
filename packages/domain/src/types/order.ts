// =============================================================================
// Order domain types
// =============================================================================

import type { Brand } from '../branded.js';
import type { AssetSymbol } from './asset.js';
import type { OpportunityId } from './opportunity.js';
import type { PositionId } from './position.js';
import type { VenueId } from './venue.js';

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type OrderId = Brand<string, 'OrderId'>;

// ── Enumerations ─────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'post_only';

/**
 * Lifecycle status of an order.
 *
 * pending → submitted → partially_filled | filled | cancelled | failed | expired
 */
export type OrderStatus =
  | 'pending'
  | 'submitted'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'failed'
  | 'expired';

// ── Order fill ────────────────────────────────────────────────────────────────

/**
 * A single execution report from the venue.
 */
export interface OrderFill {
  /** Venue-assigned fill / trade ID. */
  readonly fillId: string;
  readonly orderId: OrderId;
  /** Filled quantity as a decimal string. */
  readonly filledSize: string;
  /** Execution price as a decimal string. */
  readonly fillPrice: string;
  /** Fee paid for this fill as a decimal string (positive = fee paid). */
  readonly fee: string;
  /** Asset in which the fee is denominated. */
  readonly feeAsset: AssetSymbol;
  readonly filledAt: Date;
}

// ── Submitted order ───────────────────────────────────────────────────────────

/**
 * A live or historical order tracked by the system.
 */
export interface Order {
  readonly id: OrderId;
  /** Venue-assigned order ID (may differ from our internal ID). */
  readonly venueOrderId: string | null;
  readonly venueId: VenueId;
  readonly asset: AssetSymbol;
  readonly side: OrderSide;
  readonly type: OrderType;
  /**
   * Requested order size as a decimal string.
   */
  readonly size: string;
  /**
   * Limit price as a decimal string.  Null for market orders.
   */
  readonly limitPrice: string | null;
  /**
   * Total filled size so far as a decimal string.
   */
  readonly filledSize: string;
  /**
   * Volume-weighted average fill price as a decimal string.
   * Null if nothing has been filled yet.
   */
  readonly avgFillPrice: string | null;
  readonly status: OrderStatus;
  /** The position this order belongs to, if already created. */
  readonly positionId: PositionId | null;
  /** The opportunity that triggered this order. */
  readonly opportunityId: OpportunityId | null;
  /** Individual fills received so far. */
  readonly fills: readonly OrderFill[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Human-readable reason for failure/cancellation if applicable. */
  readonly failureReason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Order intent ─────────────────────────────────────────────────────────────

/**
 * Pre-submission descriptor produced by a strategy.  Not yet submitted to any
 * venue.  Used by the execution layer to decide whether to actually submit.
 */
export interface OrderIntent {
  /** Strategy-generated correlation ID so intents can be matched to results. */
  readonly intentId: string;
  readonly venueId: VenueId;
  readonly asset: AssetSymbol;
  readonly side: OrderSide;
  readonly type: OrderType;
  /** Desired size as a decimal string. */
  readonly size: string;
  /** Desired limit price as a decimal string.  Null for market orders. */
  readonly limitPrice: string | null;
  /** The opportunity this intent was generated for. */
  readonly opportunityId: OpportunityId;
  /** Whether the execution engine should reduce-only (close) a position. */
  readonly reduceOnly: boolean;
  readonly createdAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a raw string to an OrderId at trust boundaries only. */
export function toOrderId(raw: string): OrderId {
  return raw as OrderId;
}
