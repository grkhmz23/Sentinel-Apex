// =============================================================================
// Sentinel Apex — Market Data Generation for Backtesting
// =============================================================================

import { Decimal } from 'decimal.js';
import type { MarketDataPoint, FundingRateEntry, BasisEntry } from './types.js';

// =============================================================================
// Synthetic Market Data Generation
// =============================================================================

interface MarketDataConfig {
  basePrices: Record<string, { spot: number; perp: number }>;
  volatilityPct: number;
  fundingRateRange: { min: number; max: number };
  basisRange: { min: number; max: number }; // in percent
}

const DEFAULT_CONFIG: MarketDataConfig = {
  basePrices: {
    BTC: { spot: 50000, perp: 50100 },
    ETH: { spot: 3000, perp: 3010 },
    SOL: { spot: 100, perp: 100.5 },
  },
  volatilityPct: 2, // 2% daily volatility
  fundingRateRange: { min: -0.0005, max: 0.001 }, // -0.05% to 0.1% per 8h
  basisRange: { min: 0.05, max: 0.5 }, // 0.05% to 0.5% basis
};

/**
 * Generate synthetic market data for backtesting
 * 
 * IMPORTANT: This is synthesized data for framework testing.
 * Production backtests should use real historical data from:
 * - Drift historical funding rates
 * - Exchange trade history
 * - On-chain oracle data
 */
export async function generateMarketData(
  period: { startDate: Date; endDate: Date },
  assets: string[],
  useHistoricalFunding: boolean,
  useHistoricalBasis: boolean
): Promise<MarketDataPoint[]> {
  const dataPoints: MarketDataPoint[] = [];
  
  const startTime = period.startDate.getTime();
  const endTime = period.endDate.getTime();
  const eightHours = 8 * 60 * 60 * 1000;
  
  // Generate 8-hour intervals (funding intervals)
  for (let time = startTime; time <= endTime; time += eightHours) {
    const timestamp = new Date(time);
    const dayProgress = (time - startTime) / (endTime - startTime);
    
    for (const asset of assets) {
      const basePrice = DEFAULT_CONFIG.basePrices[asset]?.spot || 1000;
      const basePerp = DEFAULT_CONFIG.basePrices[asset]?.perp || basePrice * 1.002;
      
      // Generate realistic price movement with trend and noise
      const trend = Math.sin(dayProgress * Math.PI * 4) * 0.02; // Cyclical trend
      const noise = (Math.random() - 0.5) * (DEFAULT_CONFIG.volatilityPct / 100);
      const priceMultiplier = 1 + trend + noise;
      
      const spotPrice = basePrice * priceMultiplier;
      
      // Generate basis (perp premium/discount)
      const basisPct = useHistoricalBasis
        ? generateHistoricalBasis(asset, timestamp)
        : DEFAULT_CONFIG.basisRange.min + Math.random() * (DEFAULT_CONFIG.basisRange.max - DEFAULT_CONFIG.basisRange.min);
      
      const perpPrice = spotPrice * (1 + basisPct / 100);
      
      // Generate funding rate
      const fundingRate = useHistoricalFunding
        ? generateHistoricalFunding(asset, timestamp)
        : DEFAULT_CONFIG.fundingRateRange.min + Math.random() * (DEFAULT_CONFIG.fundingRateRange.max - DEFAULT_CONFIG.fundingRateRange.min);
      
      dataPoints.push({
        timestamp,
        asset,
        spotPrice: spotPrice.toFixed(2),
        perpPrice: perpPrice.toFixed(2),
        fundingRate: fundingRate.toFixed(6),
        openInterest: (Math.random() * 1000000).toFixed(0),
        volume24h: (Math.random() * 500000000).toFixed(0),
      });
    }
  }
  
  return dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Generate synthetic historical basis with some autocorrelation
 * (simulates the tendency of basis to persist or mean-revert)
 */
function generateHistoricalBasis(asset: string, timestamp: Date): number {
  // Use date to create deterministic but realistic variation
  const dayOfYear = Math.floor((timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const assetOffset = asset.charCodeAt(0) % 10;
  
  // Create cyclical basis pattern
  const cycle = Math.sin((dayOfYear + assetOffset) / 30 * Math.PI) * 0.15;
  const noise = (Math.random() - 0.5) * 0.1;
  
  const basis = 0.25 + cycle + noise; // Base 0.25% basis
  return Math.max(DEFAULT_CONFIG.basisRange.min, Math.min(DEFAULT_CONFIG.basisRange.max, basis));
}

/**
 * Generate synthetic historical funding rate
 * (simulates positive bias for short funding payments)
 */
function generateHistoricalFunding(asset: string, timestamp: Date): number {
  const dayOfYear = Math.floor((timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  
  // Funding tends to be positive (shorts pay longs) in bull markets
  const bias = 0.0001; // 0.01% positive bias
  const cycle = Math.sin(dayOfYear / 7 * Math.PI) * 0.0002; // Weekly cycle
  const noise = (Math.random() - 0.5) * 0.0003;
  
  const rate = bias + cycle + noise;
  return Math.max(DEFAULT_CONFIG.fundingRateRange.min, Math.min(DEFAULT_CONFIG.fundingRateRange.max, rate));
}

// =============================================================================
// Funding Payment Calculation
// =============================================================================

import type { BacktestPosition } from './types.js';

/**
 * Calculate funding payment for a position
 * 
 * Funding is paid every 8 hours on Drift:
 * - Positive rate: longs pay shorts
 * - Negative rate: shorts pay longs
 * 
 * For delta-neutral carry:
 * - Spot long + Perp short receives funding when rate > 0
 */
export function calculateFundingPayment(
  position: BacktestPosition,
  fundingRate: string
): string {
  const notional = new Decimal(position.notionalUsd);
  const rate = new Decimal(fundingRate);
  
  // For perp shorts: receive payment when rate > 0
  // For perp longs: pay when rate > 0
  if (position.marketType === 'perp') {
    if (position.side === 'short') {
      // Shorts receive funding when rate is positive
      return notional.times(rate).toFixed();
    } else {
      // Longs pay funding when rate is positive
      return notional.times(rate).negated().toFixed();
    }
  }
  
  // Spot positions don't pay funding
  return '0';
}

// =============================================================================
// Historical Data Placeholders
// =============================================================================

/**
 * Load real historical funding rates from Drift
 * 
 * NOTE: This is a placeholder for real data integration.
 * Production implementation should:
 * 1. Connect to Drift historical data API
 * 2. Load funding payment history
 * 3. Cache results for reproducibility
 */
export async function loadHistoricalFundingRates(
  _asset: string,
  _period: { startDate: Date; endDate: Date }
): Promise<FundingRateEntry[]> {
  // TODO: Implement real historical data loading
  // For now, return empty array to trigger synthetic generation
  return [];
}

/**
 * Load real historical basis data from exchanges
 * 
 * NOTE: This is a placeholder for real data integration.
 * Production implementation should:
 * 1. Connect to exchange APIs (Binance, Bybit, etc.)
 * 2. Load historical spot and perp prices
 * 3. Calculate basis
 */
export async function loadHistoricalBasis(
  _asset: string,
  _period: { startDate: Date; endDate: Date }
): Promise<BasisEntry[]> {
  // TODO: Implement real historical data loading
  return [];
}

// =============================================================================
// Data Validation
// =============================================================================

export function validateMarketData(data: MarketDataPoint[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (data.length === 0) {
    errors.push('No market data points');
    return { valid: false, errors };
  }
  
  // Check for required fields
  for (const point of data) {
    if (!point.timestamp) errors.push(`Missing timestamp for ${point.asset}`);
    if (!point.spotPrice || new Decimal(point.spotPrice).lte(0)) {
      errors.push(`Invalid spot price for ${point.asset} at ${point.timestamp}`);
    }
    if (!point.perpPrice || new Decimal(point.perpPrice).lte(0)) {
      errors.push(`Invalid perp price for ${point.asset} at ${point.timestamp}`);
    }
    if (!point.fundingRate) {
      errors.push(`Missing funding rate for ${point.asset} at ${point.timestamp}`);
    }
  }
  
  // Check chronological order
  for (let i = 1; i < data.length; i++) {
    if (data[i]!.timestamp.getTime() < data[i - 1]!.timestamp.getTime()) {
      errors.push(`Data out of order at index ${i}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}
