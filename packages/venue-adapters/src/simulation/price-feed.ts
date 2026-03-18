// =============================================================================
// Price feed abstractions for the simulation adapter
// =============================================================================

import Decimal from 'decimal.js';

export interface PriceFeed {
  getPrice(asset: string): Promise<string>;
  getFundingRate(asset: string): Promise<{ rate: string; nextFundingTime: Date }>;
}

// ---------------------------------------------------------------------------
// StaticPriceFeed — fixed prices, useful for deterministic unit tests
// ---------------------------------------------------------------------------

export class StaticPriceFeed implements PriceFeed {
  constructor(
    private readonly prices: Record<string, string>,
    private readonly fundingRates: Record<string, string> = {},
  ) {}

  async getPrice(asset: string): Promise<string> {
    const price = this.prices[asset];
    if (price === undefined) {
      throw new Error(`StaticPriceFeed: no price for asset "${asset}"`);
    }
    return price;
  }

  async getFundingRate(_asset: string): Promise<{ rate: string; nextFundingTime: Date }> {
    const rate = this.fundingRates[_asset] ?? '0.0001';
    const nextFundingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return { rate, nextFundingTime };
  }
}

// ---------------------------------------------------------------------------
// VolatilePriceFeed — random-walk with drift, for realistic paper trading
// ---------------------------------------------------------------------------

export class VolatilePriceFeed implements PriceFeed {
  private readonly currentPrices: Map<string, Decimal>;
  private readonly volatilityPct: Decimal;

  constructor(
    initialPrices: Record<string, string>,
    volatilityPct: string,
  ) {
    this.currentPrices = new Map(
      Object.entries(initialPrices).map(([asset, price]) => [asset, new Decimal(price)]),
    );
    this.volatilityPct = new Decimal(volatilityPct);
  }

  async getPrice(asset: string): Promise<string> {
    const current = this.currentPrices.get(asset);
    if (current === undefined) {
      throw new Error(`VolatilePriceFeed: no price for asset "${asset}"`);
    }

    // Random walk: apply a normally-distributed shock each call.
    // Using Box-Muller to approximate normal distribution from uniform randoms.
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
    const shock = new Decimal(z).times(this.volatilityPct).dividedBy('100');
    const multiplier = new Decimal('1').plus(shock);
    const next = current.times(multiplier).toDecimalPlaces(8);

    // Clamp to avoid negative prices
    const floored = Decimal.max(next, new Decimal('0.000001'));
    this.currentPrices.set(asset, floored);
    return floored.toFixed();
  }

  async getFundingRate(_asset: string): Promise<{ rate: string; nextFundingTime: Date }> {
    // Mildly random funding rate in range [-0.001, 0.001]
    const rate = new Decimal((Math.random() - 0.5) * 0.002).toFixed(6);
    const nextFundingTime = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return { rate, nextFundingTime };
  }
}
