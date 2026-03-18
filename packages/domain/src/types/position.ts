// =============================================================================
// Position domain types
// =============================================================================

import type { Brand } from '../branded.js';
import type { AssetSymbol } from './asset.js';
import type { VenueId } from './venue.js';

// ── Branded IDs ──────────────────────────────────────────────────────────────

export type PositionId = Brand<string, 'PositionId'>;
export type SleeveId = Brand<string, 'SleeveId'>;

// ── Enumerations ─────────────────────────────────────────────────────────────

export type PositionSide = 'long' | 'short';

/**
 * Lifecycle status of a position.
 *
 * Transitions:
 *   opening → open
 *   open → reducing | closing
 *   reducing → open | closing
 *   closing → closed
 *   open | reducing | closing → liquidated | error
 */
export type PositionStatus =
  | 'opening'
  | 'open'
  | 'reducing'
  | 'closing'
  | 'closed'
  | 'liquidated'
  | 'error';

/**
 * Whether the position (or its containing sleeve) is hedged.
 */
export type HedgeState = 'fully_hedged' | 'partially_hedged' | 'unhedged' | 'over_hedged';

// ── Core interface ────────────────────────────────────────────────────────────

export interface Position {
  /** Unique position identifier. */
  readonly id: PositionId;
  /** The sleeve this position belongs to. */
  readonly sleeveId: SleeveId;
  /** The venue where the position is held. */
  readonly venueId: VenueId;
  /** The underlying asset. */
  readonly asset: AssetSymbol;
  readonly side: PositionSide;
  /**
   * Current absolute position size as a decimal string.
   * Always positive; direction is encoded in `side`.
   */
  readonly size: string;
  /** Average entry price as a decimal string. */
  readonly entryPrice: string;
  /** Current mark price as a decimal string. */
  readonly markPrice: string;
  /** Unrealised PnL as a signed decimal string. */
  readonly unrealizedPnl: string;
  /** Realised PnL accumulated since position open, as a signed decimal string. */
  readonly realizedPnl: string;
  /** Total funding fees accrued as a signed decimal string (negative = paid). */
  readonly fundingAccrued: string;
  readonly openedAt: Date;
  readonly updatedAt: Date;
  readonly status: PositionStatus;
  readonly hedgeState: HedgeState;
  /** Arbitrary key/value metadata (venue-specific fields, strategy tags, …). */
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cast a raw string to a PositionId at trust boundaries only. */
export function toPositionId(raw: string): PositionId {
  return raw as PositionId;
}

/** Cast a raw string to a SleeveId at trust boundaries only. */
export function toSleeveId(raw: string): SleeveId {
  return raw as SleeveId;
}
