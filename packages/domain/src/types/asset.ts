// =============================================================================
// Asset domain types
// =============================================================================

export type AssetSymbol = string; // e.g. 'SOL', 'BTC', 'USDC'

export type AssetClass = 'spot' | 'perpetual' | 'stable' | 'lp_token';

export interface Asset {
  /** Ticker symbol, e.g. 'SOL', 'BTC'. */
  readonly symbol: AssetSymbol;
  /** Classification of the asset. */
  readonly class: AssetClass;
  /** Number of decimal places for on-chain representation. */
  readonly decimals: number;
  /** True if this asset is used as the quote currency in pairs. */
  readonly isQuote: boolean;
  /**
   * Minimum tradable size, expressed as a decimal string to avoid float
   * precision loss.  E.g. "0.001".
   */
  readonly minTradeSize: string;
  /** Number of decimal places for price quoting. */
  readonly pricePrecision: number;
}
