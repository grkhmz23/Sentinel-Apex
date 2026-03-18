// =============================================================================
// Carry opportunity detector — pure function logic
// =============================================================================

import Decimal from 'decimal.js';

import type { MarketData } from '@sentinel-apex/venue-adapters';

import type { CarryConfig } from './config.js';

// ── Snapshot types ────────────────────────────────────────────────────────────

export interface FundingRateSnapshot {
  venueId: string;
  asset: string;
  /** 8-hour funding rate as decimal (e.g. "0.0001" = 0.01%) */
  rate8h: string;
  /** rate8h * 3 * 365 */
  annualizedRate: string;
  markPrice: string;
  nextFundingTime: Date;
  timestamp: Date;
}

export interface BasisSnapshot {
  asset: string;
  spotVenueId: string;
  spotPrice: string;
  perpVenueId: string;
  perpPrice: string;
  /** perp - spot (decimal) */
  basis: string;
  /** (perp - spot) / spot * 100 */
  basisPct: string;
  /** based on time to expiry (for futures) or 8h funding for perps */
  annualizedBasis: string;
  timestamp: Date;
}

export interface CrossVenueSpread {
  asset: string;
  longVenueId: string;
  shortVenueId: string;
  longPrice: string;
  shortPrice: string;
  spread: string;
  spreadPct: string;
  /** after estimated fees */
  estimatedPnlPct: string;
  timestamp: Date;
}

export interface OpportunityLeg {
  venueId: string;
  asset: string;
  side: 'long' | 'short';
  instrumentType: 'spot' | 'perpetual' | 'future';
  /** in base asset */
  estimatedSize: string;
  estimatedPrice: string;
  estimatedFee: string;
}

export interface CarryOpportunityCandidate {
  type: 'funding_rate_arb' | 'basis_trade' | 'cross_venue_spread';
  asset: string;
  legs: OpportunityLeg[];
  expectedAnnualYieldPct: string;
  estimatedFeeCostPct: string;
  netYieldPct: string; // expectedAnnualYieldPct - estimatedFeeCostPct
  confidenceScore: number; // 0-1, based on data recency and liquidity
  detectedAt: Date;
  expiresAt: Date; // opportunity stale after this
  metadata: Record<string, string>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Compute confidence score for an opportunity based on data age.
 * A snapshot taken within 30s of now scores 1.0; linearly degrades to 0.0
 * at maxOpportunityAgeSec.
 */
function computeConfidenceFromAge(timestamp: Date, now: Date, maxAgeSec: number): number {
  const ageSec = (now.getTime() - timestamp.getTime()) / 1_000;
  if (ageSec <= 0) return 1.0;
  if (ageSec >= maxAgeSec) return 0.0;
  return Math.max(0, 1 - ageSec / maxAgeSec);
}

/**
 * Estimate round-trip fee cost in percentage terms.
 * Two legs × taker fee on open + two legs × maker fee on close (conservative).
 */
function estimateRoundTripFeePct(config: CarryConfig): string {
  const takerFee = new Decimal(config.estimatedTakerFeePct);
  const makerFee = new Decimal(config.estimatedMakerFeePct);
  // open legs at taker, close legs at maker
  return takerFee.times(2).plus(makerFee.times(2)).toFixed();
}

// ── Funding rate arbitrage ─────────────────────────────────────────────────────

/**
 * Detect funding rate arbitrage opportunities.
 *
 * Strategy:
 *   - Positive funding rate: shorts receive funding → short perp + long spot
 *   - Negative funding rate: longs receive funding → long perp + short spot
 *
 * Returns opportunities where net annualised yield exceeds minAnnualYieldPct.
 */
export function detectFundingRateOpportunities(
  snapshots: FundingRateSnapshot[],
  config: CarryConfig,
): CarryOpportunityCandidate[] {
  const now = new Date();
  const results: CarryOpportunityCandidate[] = [];
  const minYield = new Decimal(config.minAnnualYieldPct);
  const feeCostPct = estimateRoundTripFeePct(config);

  for (const snap of snapshots) {
    // Skip unapproved venues/assets
    if (
      config.approvedVenues.length > 0 &&
      !config.approvedVenues.includes(snap.venueId)
    ) {
      continue;
    }
    if (
      config.approvedAssets.length > 0 &&
      !config.approvedAssets.includes(snap.asset)
    ) {
      continue;
    }

    const annualizedRate = new Decimal(snap.annualizedRate);
    const absRate = annualizedRate.abs();

    // Net yield = |annualized rate| - fee round trip
    const netYield = absRate.minus(new Decimal(feeCostPct));

    if (absRate.lessThan(new Decimal(config.minFundingRateAnnualized)) || netYield.lessThan(minYield)) {
      continue;
    }

    const confidence = computeConfidenceFromAge(snap.timestamp, now, config.maxOpportunityAgeSec);
    if (confidence < config.minConfidenceScore) {
      continue;
    }

    // Positive funding → perp longs pay shorts → strategy: short perp, long spot
    // Negative funding → perp shorts pay longs → strategy: long perp, short spot
    const perpSide: 'long' | 'short' = annualizedRate.greaterThan(0) ? 'short' : 'long';
    const spotSide: 'long' | 'short' = perpSide === 'short' ? 'long' : 'short';

    const estimatedPrice = snap.markPrice;
    const estimatedSize = '1';
    const estimatedFee = new Decimal(config.estimatedTakerFeePct).toFixed();

    const perpLeg: OpportunityLeg = {
      venueId: snap.venueId,
      asset: snap.asset,
      side: perpSide,
      instrumentType: 'perpetual',
      estimatedSize,
      estimatedPrice,
      estimatedFee,
    };

    // Spot leg on the same venue for simplicity (cross-venue handled by detectCrossVenueOpportunities)
    const spotLeg: OpportunityLeg = {
      venueId: snap.venueId,
      asset: snap.asset,
      side: spotSide,
      instrumentType: 'spot',
      estimatedSize,
      estimatedPrice,
      estimatedFee,
    };

    const expiresAt = new Date(now.getTime() + config.maxOpportunityAgeSec * 1_000);

    results.push({
      type: 'funding_rate_arb',
      asset: snap.asset,
      legs: [perpLeg, spotLeg],
      expectedAnnualYieldPct: absRate.toFixed(),
      estimatedFeeCostPct: feeCostPct,
      netYieldPct: netYield.toFixed(),
      confidenceScore: confidence,
      detectedAt: now,
      expiresAt,
      metadata: {
        venueId: snap.venueId,
        rate8h: snap.rate8h,
        annualizedRate: snap.annualizedRate,
        nextFundingTime: snap.nextFundingTime.toISOString(),
      },
    });
  }

  return results;
}

// ── Basis trading ─────────────────────────────────────────────────────────────

/**
 * Detect basis trading opportunities (perp/spot spread).
 *
 * When the perpetual trades at a premium to spot (positive basis), the strategy
 * shorts the perp and buys spot; the basis converges to zero over time or is
 * captured via funding payments.
 */
export function detectBasisOpportunities(
  bases: BasisSnapshot[],
  config: CarryConfig,
): CarryOpportunityCandidate[] {
  const now = new Date();
  const results: CarryOpportunityCandidate[] = [];
  const minBasisPct = new Decimal(config.minBasisPct);
  const feeCostPct = estimateRoundTripFeePct(config);

  for (const snap of bases) {
    if (
      config.approvedVenues.length > 0 &&
      (!config.approvedVenues.includes(snap.spotVenueId) ||
        !config.approvedVenues.includes(snap.perpVenueId))
    ) {
      continue;
    }
    if (
      config.approvedAssets.length > 0 &&
      !config.approvedAssets.includes(snap.asset)
    ) {
      continue;
    }

    const absBasisPct = new Decimal(snap.basisPct).abs();

    if (absBasisPct.lessThan(minBasisPct)) {
      continue;
    }

    const annualizedBasis = new Decimal(snap.annualizedBasis).abs();
    const netYield = annualizedBasis.minus(new Decimal(feeCostPct));

    if (netYield.lessThan(new Decimal(config.minAnnualYieldPct))) {
      continue;
    }

    const confidence = computeConfidenceFromAge(snap.timestamp, now, config.maxOpportunityAgeSec);
    if (confidence < config.minConfidenceScore) {
      continue;
    }

    // Positive basis = perp at premium → short perp, long spot
    // Negative basis = perp at discount → long perp, short spot
    const basisPositive = new Decimal(snap.basisPct).greaterThan(0);
    const perpSide: 'long' | 'short' = basisPositive ? 'short' : 'long';
    const spotSide: 'long' | 'short' = basisPositive ? 'long' : 'short';

    const estimatedFee = new Decimal(config.estimatedTakerFeePct).toFixed();

    const perpLeg: OpportunityLeg = {
      venueId: snap.perpVenueId,
      asset: snap.asset,
      side: perpSide,
      instrumentType: 'perpetual',
      estimatedSize: '1',
      estimatedPrice: snap.perpPrice,
      estimatedFee,
    };

    const spotLeg: OpportunityLeg = {
      venueId: snap.spotVenueId,
      asset: snap.asset,
      side: spotSide,
      instrumentType: 'spot',
      estimatedSize: '1',
      estimatedPrice: snap.spotPrice,
      estimatedFee,
    };

    const expiresAt = new Date(now.getTime() + config.maxOpportunityAgeSec * 1_000);

    results.push({
      type: 'basis_trade',
      asset: snap.asset,
      legs: [perpLeg, spotLeg],
      expectedAnnualYieldPct: annualizedBasis.toFixed(),
      estimatedFeeCostPct: feeCostPct,
      netYieldPct: netYield.toFixed(),
      confidenceScore: confidence,
      detectedAt: now,
      expiresAt,
      metadata: {
        spotVenueId: snap.spotVenueId,
        perpVenueId: snap.perpVenueId,
        spotPrice: snap.spotPrice,
        perpPrice: snap.perpPrice,
        basisPct: snap.basisPct,
        annualizedBasis: snap.annualizedBasis,
      },
    });
  }

  return results;
}

// ── Cross-venue spread ────────────────────────────────────────────────────────

/**
 * Detect cross-venue spread opportunities.
 *
 * For each pair of venues quoting the same asset, if venue A is cheaper than
 * venue B by more than the round-trip fee cost, we can buy on A and sell on B.
 */
export function detectCrossVenueOpportunities(
  marketData: Map<string, MarketData[]>,
  config: CarryConfig,
): CarryOpportunityCandidate[] {
  const now = new Date();
  const results: CarryOpportunityCandidate[] = [];
  const minSpreadPct = new Decimal(config.minCrossVenueSpreadPct);
  const feeCostPct = estimateRoundTripFeePct(config);

  for (const [asset, venues] of marketData) {
    if (
      config.approvedAssets.length > 0 &&
      !config.approvedAssets.includes(asset)
    ) {
      continue;
    }

    // Filter to approved venues
    const filteredVenues =
      config.approvedVenues.length > 0
        ? venues.filter((v) => config.approvedVenues.includes(v.venueId))
        : venues;

    if (filteredVenues.length < 2) {
      continue;
    }

    // Compare every pair
    for (let i = 0; i < filteredVenues.length; i++) {
      for (let j = i + 1; j < filteredVenues.length; j++) {
        const venueA = filteredVenues[i];
        const venueB = filteredVenues[j];

        if (venueA === undefined || venueB === undefined) continue;

        const midA = new Decimal(venueA.mid);
        const midB = new Decimal(venueB.mid);

        if (midA.isZero() || midB.isZero()) continue;

        // Spread: buy low (A), sell high (B) or vice versa
        let longVenue: MarketData;
        let shortVenue: MarketData;
        let longPrice: Decimal;
        let shortPrice: Decimal;

        if (midA.lessThan(midB)) {
          longVenue = venueA;
          shortVenue = venueB;
          longPrice = midA;
          shortPrice = midB;
        } else {
          longVenue = venueB;
          shortVenue = venueA;
          longPrice = midB;
          shortPrice = midA;
        }

        const spread = shortPrice.minus(longPrice);
        const spreadPct = spread.div(longPrice).times(100);

        if (spreadPct.lessThan(minSpreadPct)) {
          continue;
        }

        // Estimated PnL = spreadPct - fee cost
        const estimatedPnlPct = spreadPct.minus(new Decimal(feeCostPct));

        if (estimatedPnlPct.lessThan(0)) {
          continue;
        }

        // Use the older timestamp for confidence
        const olderTimestamp =
          longVenue.updatedAt.getTime() < shortVenue.updatedAt.getTime()
            ? longVenue.updatedAt
            : shortVenue.updatedAt;

        const confidence = computeConfidenceFromAge(
          olderTimestamp,
          now,
          config.maxOpportunityAgeSec,
        );
        if (confidence < config.minConfidenceScore) {
          continue;
        }

        const estimatedFee = new Decimal(config.estimatedTakerFeePct).toFixed();

        const longLeg: OpportunityLeg = {
          venueId: longVenue.venueId,
          asset,
          side: 'long',
          instrumentType: 'spot',
          estimatedSize: '1',
          estimatedPrice: longPrice.toFixed(),
          estimatedFee,
        };

        const shortLeg: OpportunityLeg = {
          venueId: shortVenue.venueId,
          asset,
          side: 'short',
          instrumentType: 'spot',
          estimatedSize: '1',
          estimatedPrice: shortPrice.toFixed(),
          estimatedFee,
        };

        const expiresAt = new Date(now.getTime() + config.maxOpportunityAgeSec * 1_000);

        // Annualize the spread — cross-venue spreads close quickly so we use
        // a conservative 1-day holding period estimate for annualization.
        const annualizedYieldPct = spreadPct.times(365).toFixed();

        results.push({
          type: 'cross_venue_spread',
          asset,
          legs: [longLeg, shortLeg],
          expectedAnnualYieldPct: annualizedYieldPct,
          estimatedFeeCostPct: feeCostPct,
          netYieldPct: estimatedPnlPct.times(365).toFixed(),
          confidenceScore: confidence,
          detectedAt: now,
          expiresAt,
          metadata: {
            longVenueId: longVenue.venueId,
            shortVenueId: shortVenue.venueId,
            longPrice: longPrice.toFixed(),
            shortPrice: shortPrice.toFixed(),
            spreadPct: spreadPct.toFixed(),
            estimatedPnlPct: estimatedPnlPct.toFixed(),
          },
        });
      }
    }
  }

  return results;
}
