import Decimal from 'decimal.js';

import type { CarryConfig } from './config.js';
import type { CarryOpportunityCandidate } from './opportunity-detector.js';
import { computeMaxAllowedSize, computePositionSize } from './position-sizer.js';

export interface OpportunityScoreBreakdown {
  yieldScore: number;
  confidenceScore: number;
  venueBreadthScore: number;
  diversificationScore: number;
  totalScore: number;
}

export interface OpportunitySelectionDecision {
  opportunity: CarryOpportunityCandidate;
  score: OpportunityScoreBreakdown;
  rationale: string[];
}

export interface OpportunityRejectionDecision {
  opportunity: CarryOpportunityCandidate;
  reason: string;
}

export interface PortfolioCapitalAllocation {
  opportunity: CarryOpportunityCandidate;
  positionSizeUsd: string;
  score: OpportunityScoreBreakdown;
  rationale: string[];
}

export interface PortfolioOptimizationResult {
  selected: PortfolioCapitalAllocation[];
  rejected: OpportunityRejectionDecision[];
}

export interface PortfolioOptimizationInput {
  opportunities: CarryOpportunityCandidate[];
  sleeveNav: string;
  currentGrossExposureUsd: string;
  currentOpenPositions: number;
  currentAssetExposureUsd?: Map<string, string>;
  currentVenueExposureUsd?: Map<string, string>;
  config: CarryConfig;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(value, max));
}

function decimalMin(values: Decimal[]): Decimal {
  return values.reduce((currentMin, value) => Decimal.min(currentMin, value));
}

function getCandidateVenueIds(opportunity: CarryOpportunityCandidate): string[] {
  return [...new Set(opportunity.legs.map((leg) => leg.venueId))];
}

function buildVenueWeights(opportunity: CarryOpportunityCandidate): Map<string, Decimal> {
  const counts = new Map<string, Decimal>();
  const totalLegs = new Decimal(opportunity.legs.length);

  for (const leg of opportunity.legs) {
    counts.set(leg.venueId, (counts.get(leg.venueId) ?? new Decimal(0)).plus(1));
  }

  const weights = new Map<string, Decimal>();
  for (const [venueId, count] of counts.entries()) {
    weights.set(venueId, count.div(totalLegs));
  }

  return weights;
}

function scoreOpportunity(
  opportunity: CarryOpportunityCandidate,
  selectedAssets: Set<string>,
  selectedVenues: Set<string>,
): OpportunityScoreBreakdown {
  const yieldScore = clamp(Number(opportunity.netYieldPct) / 20);
  const confidenceScore = clamp(opportunity.confidenceScore);
  const venueBreadthScore = clamp(
    getCandidateVenueIds(opportunity).length / Math.max(opportunity.legs.length, 1),
  );

  let diversificationScore = 0;
  if (!selectedAssets.has(opportunity.asset)) {
    diversificationScore += 0.65;
  }

  const newVenueCount = getCandidateVenueIds(opportunity)
    .filter((venueId) => !selectedVenues.has(venueId))
    .length;
  diversificationScore += Math.min(0.35, newVenueCount * 0.15);
  diversificationScore = clamp(diversificationScore);

  const totalScore = Number((
    yieldScore * 0.5 +
    confidenceScore * 0.25 +
    venueBreadthScore * 0.1 +
    diversificationScore * 0.15
  ).toFixed(4));

  return {
    yieldScore: Number(yieldScore.toFixed(4)),
    confidenceScore: Number(confidenceScore.toFixed(4)),
    venueBreadthScore: Number(venueBreadthScore.toFixed(4)),
    diversificationScore: Number(diversificationScore.toFixed(4)),
    totalScore,
  };
}

function canSelectOpportunity(
  opportunity: CarryOpportunityCandidate,
  selectedAssetCounts: Map<string, number>,
  selectedVenueCounts: Map<string, number>,
  config: CarryConfig,
): string | null {
  const currentAssetCount = selectedAssetCounts.get(opportunity.asset) ?? 0;
  if (currentAssetCount >= config.maxOpportunitiesPerAsset) {
    return `asset limit reached for ${opportunity.asset}`;
  }

  for (const venueId of getCandidateVenueIds(opportunity)) {
    const currentVenueCount = selectedVenueCounts.get(venueId) ?? 0;
    if (currentVenueCount >= config.maxOpportunitiesPerVenue) {
      return `venue limit reached for ${venueId}`;
    }
  }

  return null;
}

function selectOpportunityCandidates(
  opportunities: CarryOpportunityCandidate[],
  config: CarryConfig,
): {
  selected: OpportunitySelectionDecision[];
  rejected: OpportunityRejectionDecision[];
} {
  const remaining = [...opportunities];
  const selected: OpportunitySelectionDecision[] = [];
  const rejected: OpportunityRejectionDecision[] = [];
  const selectedAssetCounts = new Map<string, number>();
  const selectedVenueCounts = new Map<string, number>();
  const selectedAssets = new Set<string>();
  const selectedVenues = new Set<string>();

  while (
    remaining.length > 0 &&
    selected.length < config.maxConcurrentOpportunities
  ) {
    remaining.sort((left, right) => {
      const leftScore = scoreOpportunity(left, selectedAssets, selectedVenues);
      const rightScore = scoreOpportunity(right, selectedAssets, selectedVenues);
      return rightScore.totalScore - leftScore.totalScore;
    });

    const next = remaining.shift();
    if (next === undefined) {
      break;
    }

    const limitReason = canSelectOpportunity(
      next,
      selectedAssetCounts,
      selectedVenueCounts,
      config,
    );

    if (limitReason !== null) {
      rejected.push({
        opportunity: next,
        reason: limitReason,
      });
      continue;
    }

    const score = scoreOpportunity(next, selectedAssets, selectedVenues);
    const rationale = [
      `ranked by portfolio score ${score.totalScore.toFixed(4)}`,
      `net yield score ${score.yieldScore.toFixed(4)}`,
      `confidence score ${score.confidenceScore.toFixed(4)}`,
    ];

    if (!selectedAssets.has(next.asset)) {
      rationale.push(`diversifies asset exposure via ${next.asset}`);
    }

    const candidateVenueIds = getCandidateVenueIds(next);
    if (candidateVenueIds.some((venueId) => !selectedVenues.has(venueId))) {
      rationale.push('adds venue diversification');
    }

    selected.push({
      opportunity: next,
      score,
      rationale,
    });

    selectedAssets.add(next.asset);
    selectedAssetCounts.set(next.asset, (selectedAssetCounts.get(next.asset) ?? 0) + 1);

    for (const venueId of candidateVenueIds) {
      selectedVenues.add(venueId);
      selectedVenueCounts.set(venueId, (selectedVenueCounts.get(venueId) ?? 0) + 1);
    }
  }

  for (const opportunity of remaining) {
    rejected.push({
      opportunity,
      reason: 'portfolio selection budget exhausted',
    });
  }

  return { selected, rejected };
}

export function optimizeCarryPortfolio(
  input: PortfolioOptimizationInput,
): PortfolioOptimizationResult {
  const navUsd = new Decimal(input.sleeveNav);
  if (navUsd.lte(0)) {
    return {
      selected: [],
      rejected: input.opportunities.map((opportunity) => ({
        opportunity,
        reason: 'sleeve NAV is zero',
      })),
    };
  }

  const selection = selectOpportunityCandidates(input.opportunities, input.config);
  const selected: PortfolioCapitalAllocation[] = [];
  const rejected = [...selection.rejected];
  const assetExposureUsd = new Map(
    [...(input.currentAssetExposureUsd ?? new Map<string, string>()).entries()]
      .map(([asset, exposure]) => [asset, new Decimal(exposure)]),
  );
  const venueExposureUsd = new Map(
    [...(input.currentVenueExposureUsd ?? new Map<string, string>()).entries()]
      .map(([venueId, exposure]) => [venueId, new Decimal(exposure)]),
  );

  let plannedGrossExposureUsd = new Decimal(input.currentGrossExposureUsd);
  let plannedOpenPositions = input.currentOpenPositions;
  const assetCapUsd = navUsd.times(input.config.maxAssetExposurePct).div(100);
  const venueCapUsd = navUsd.times(input.config.maxVenueExposurePct).div(100);

  for (const decision of selection.selected) {
    const currentExposurePct = plannedGrossExposureUsd.div(navUsd).times(100).toFixed(4);
    const targetSizeUsd = new Decimal(computePositionSize({
      sleeveNav: input.sleeveNav,
      expectedYieldPct: decision.opportunity.expectedAnnualYieldPct,
      confidenceScore: decision.opportunity.confidenceScore,
      config: input.config,
      currentExposurePct,
    }));
    const maxAllowedSizeUsd = new Decimal(computeMaxAllowedSize({
      sleeveNav: input.sleeveNav,
      currentPositions: plannedOpenPositions,
      config: input.config,
    }));
    const assetRemainingUsd = assetCapUsd.minus(
      assetExposureUsd.get(decision.opportunity.asset) ?? new Decimal(0),
    );
    const venueWeights = buildVenueWeights(decision.opportunity);
    const venueRemainingAsOpportunityNotional = [...venueWeights.entries()].map(
      ([venueId, weight]) => {
        const currentVenueExposure = venueExposureUsd.get(venueId) ?? new Decimal(0);
        const remainingVenueCapacity = venueCapUsd.minus(currentVenueExposure);
        return weight.lte(0) ? remainingVenueCapacity : remainingVenueCapacity.div(weight);
      },
    );

    const positionSizeUsd = decimalMin([
      targetSizeUsd,
      maxAllowedSizeUsd,
      assetRemainingUsd,
      ...venueRemainingAsOpportunityNotional,
    ]);

    if (positionSizeUsd.lte(0)) {
      rejected.push({
        opportunity: decision.opportunity,
        reason: 'no portfolio capacity remains after concentration limits',
      });
      continue;
    }

    const normalizedPositionSizeUsd = positionSizeUsd.toDecimalPlaces(2, Decimal.ROUND_DOWN);
    selected.push({
      opportunity: decision.opportunity,
      positionSizeUsd: normalizedPositionSizeUsd.toFixed(2),
      score: decision.score,
      rationale: [
        ...decision.rationale,
        `position sized at ${normalizedPositionSizeUsd.toFixed(2)} USD within asset and venue concentration limits`,
      ],
    });

    plannedGrossExposureUsd = plannedGrossExposureUsd.plus(normalizedPositionSizeUsd);
    plannedOpenPositions += 1;
    assetExposureUsd.set(
      decision.opportunity.asset,
      (assetExposureUsd.get(decision.opportunity.asset) ?? new Decimal(0)).plus(normalizedPositionSizeUsd),
    );

    for (const [venueId, weight] of venueWeights.entries()) {
      const venueIncrement = normalizedPositionSizeUsd.times(weight);
      venueExposureUsd.set(
        venueId,
        (venueExposureUsd.get(venueId) ?? new Decimal(0)).plus(venueIncrement),
      );
    }
  }

  return { selected, rejected };
}
