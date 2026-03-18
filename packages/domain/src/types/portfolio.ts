// =============================================================================
// Portfolio domain types
// =============================================================================

import type { Position, SleeveId } from './position.js';

// ── Sleeve ─────────────────────────────────────────────────────────────────────

export type { SleeveId } from './position.js';

/**
 * Named sleeves partition the portfolio into logical sub-strategies.
 * Additional sleeves can be added here over time.
 */
export type SleeveKind = 'carry' | 'treasury';

/**
 * Operational status of a sleeve.
 *
 * active      → normal operations
 * paused      → temporarily not opening new positions
 * de_risking  → actively reducing exposure
 * halted      → stopped due to risk event; requires manual intervention
 * closed      → all positions closed; sleeve is inactive
 */
export type SleeveStatus = 'active' | 'paused' | 'de_risking' | 'halted' | 'closed';

export interface Sleeve {
  readonly id: SleeveId;
  readonly kind: SleeveKind;
  readonly status: SleeveStatus;
  /**
   * Target allocation as a fraction of total portfolio NAV, 0–100.
   * E.g. 50 = 50% of portfolio.
   */
  readonly targetAllocationPct: number;
  /**
   * Current allocation as a fraction of total portfolio NAV, 0–100.
   */
  readonly currentAllocationPct: number;
  /**
   * Net Asset Value of this sleeve as a decimal string (USD).
   */
  readonly nav: string;
  /** All open and recently-closed positions in this sleeve. */
  readonly positions: readonly Position[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface Portfolio {
  /** System-level portfolio identifier. */
  readonly id: string;
  /**
   * Total Net Asset Value across all sleeves, as a decimal string (USD).
   */
  readonly totalNav: string;
  readonly sleeves: readonly Sleeve[];
  /**
   * Gross exposure (sum of absolute position notionals) as a decimal string.
   */
  readonly grossExposure: string;
  /**
   * Net exposure (long notional minus short notional) as a signed decimal string.
   */
  readonly netExposure: string;
  /**
   * Undeployed capital held as a liquidity reserve, as a decimal string (USD).
   */
  readonly liquidityReserve: string;
  readonly updatedAt: Date;
}
