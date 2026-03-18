// =============================================================================
// Opportunity domain types
// =============================================================================

import type { Brand } from '../branded.js';
import type { AssetSymbol } from './asset.js';
import type { OrderSide } from './order.js';
import type { VenueId } from './venue.js';

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type OpportunityId = Brand<string, 'OpportunityId'>;

// ── Enumerations ─────────────────────────────────────────────────────────────

export type OpportunityType =
  | 'funding_rate_arb'
  | 'basis_trade'
  | 'cross_venue_spread'
  | 'treasury_yield';

/**
 * Lifecycle of an opportunity from detection through to closure.
 *
 * detected → evaluating → approved → executing → active → closing → closed
 *          ↘ rejected
 *          ↘ expired  (opportunity window closed before execution)
 */
export type OpportunityStatus =
  | 'detected'
  | 'evaluating'
  | 'approved'
  | 'executing'
  | 'active'
  | 'closing'
  | 'closed'
  | 'rejected'
  | 'expired';

// ── Opportunity leg ───────────────────────────────────────────────────────────

/**
 * One side of a multi-leg trade (e.g. spot buy + perp short).
 */
export interface OpportunityLeg {
  /** Human-readable label, e.g. "spot_long", "perp_short". */
  readonly label: string;
  readonly venueId: VenueId;
  readonly asset: AssetSymbol;
  readonly side: OrderSide;
  /**
   * Nominal size of this leg as a decimal string.  May be zero before sizing.
   */
  readonly size: string;
  /**
   * Entry price estimate at detection time as a decimal string.
   */
  readonly estimatedEntryPrice: string;
}

// ── Main opportunity ──────────────────────────────────────────────────────────

/**
 * A carry / yield opportunity the system has identified.
 *
 * All rate/yield fields are expressed as decimal strings representing the
 * annualised percentage (e.g. "0.12" = 12% APR) unless noted otherwise.
 */
export interface CarryOpportunity {
  readonly id: OpportunityId;
  readonly type: OpportunityType;
  readonly status: OpportunityStatus;
  /** Primary asset involved (e.g. 'SOL'). */
  readonly asset: AssetSymbol;

  // ── Yield metrics ──────────────────────────────────────────────────────────

  /**
   * Expected gross annualised yield at detection time, as a decimal string.
   * E.g. "0.25" = 25% APR.
   */
  readonly expectedAnnualYield: string;
  /**
   * Perpetual funding rate (8-hour or annualised depending on venue).
   * Signed decimal string: positive = longs pay shorts.
   */
  readonly fundingRate: string;
  /**
   * Spread between the spot price and the futures/perp price, expressed as a
   * fraction of the spot price.  Signed decimal string.
   */
  readonly basisSpread: string;
  /**
   * Net estimated cost of carry (fees + slippage + borrowing), as a signed
   * decimal string.
   */
  readonly netCostOfCarry: string;

  // ── Trade legs ─────────────────────────────────────────────────────────────

  readonly legs: readonly OpportunityLeg[];

  // ── Sizing ─────────────────────────────────────────────────────────────────

  /**
   * Target notional size of the trade in USD, as a decimal string.
   * Set by the sizing/risk engine after approval.
   */
  readonly targetNotionalUsd: string;

  // ── Confidence & scoring ──────────────────────────────────────────────────

  /**
   * 0–1 confidence score from the signal model.
   */
  readonly confidenceScore: number;

  // ── Rejection ─────────────────────────────────────────────────────────────

  /** Populated when status is 'rejected'. */
  readonly rejectionReason: string | null;

  // ── Timestamps ────────────────────────────────────────────────────────────

  readonly detectedAt: Date;
  readonly updatedAt: Date;
  /** When execution began (status → 'executing'). */
  readonly executionStartedAt: Date | null;
  /** When position was fully closed. */
  readonly closedAt: Date | null;

  readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a raw string to an OpportunityId at trust boundaries only. */
export function toOpportunityId(raw: string): OpportunityId {
  return raw as OpportunityId;
}
