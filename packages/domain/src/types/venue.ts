// =============================================================================
// Venue domain types
// =============================================================================

import type { AssetSymbol } from './asset.js';

export type VenueId = string; // e.g. 'jupiter-perps', 'binance', 'marginfi'

export type VenueType = 'dex' | 'cex' | 'money_market' | 'lp_pool';

export type VenueStatus = 'active' | 'degraded' | 'paused' | 'offline';

export interface Venue {
  /** Unique identifier, e.g. 'jupiter-perps-devnet'. */
  readonly id: VenueId;
  readonly name: string;
  readonly type: VenueType;
  readonly status: VenueStatus;
  /** List of asset symbols this venue can trade/lend. */
  readonly supportedAssets: readonly AssetSymbol[];
  readonly supportsSpot: boolean;
  readonly supportsPerp: boolean;
  /**
   * Maker fee as a decimal string, e.g. "-0.0002" (negative = rebate).
   */
  readonly makerFee: string;
  /**
   * Taker fee as a decimal string, e.g. "0.0005".
   */
  readonly takerFee: string;
}
