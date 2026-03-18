// =============================================================================
// Carry sleeve configuration
// =============================================================================

export interface CarryConfig {
  sleeveId: string; // 'carry'

  // Opportunity thresholds
  minAnnualYieldPct: string; // default '5.0' (5% annual min)
  minConfidenceScore: number; // default 0.6
  maxOpportunityAgeSec: number; // default 300

  // Sizing
  defaultPositionSizePct: string; // default '5' (5% of sleeve NAV per opportunity)
  maxPositionSizePct: string; // default '20'
  kellyCriterionFraction: string; // default '0.25' (quarter-Kelly)

  // Fee estimates
  estimatedTakerFeePct: string; // default '0.05'
  estimatedMakerFeePct: string; // default '0.02'

  // Venues approved for carry
  approvedVenues: string[];

  // Assets approved for carry
  approvedAssets: string[];

  // Opportunity limits
  maxConcurrentOpportunities: number; // default 5

  // Funding rate thresholds
  minFundingRateAnnualized: string; // default '3.0' (3% annual)
  minBasisPct: string; // default '0.5' (0.5% basis spread)
  minCrossVenueSpreadPct: string; // default '0.3'
}

export const DEFAULT_CARRY_CONFIG: CarryConfig = {
  sleeveId: 'carry',

  minAnnualYieldPct: '5.0',
  minConfidenceScore: 0.6,
  maxOpportunityAgeSec: 300,

  defaultPositionSizePct: '5',
  maxPositionSizePct: '20',
  kellyCriterionFraction: '0.25',

  estimatedTakerFeePct: '0.05',
  estimatedMakerFeePct: '0.02',

  approvedVenues: [],
  approvedAssets: [],

  maxConcurrentOpportunities: 5,

  minFundingRateAnnualized: '3.0',
  minBasisPct: '0.5',
  minCrossVenueSpreadPct: '0.3',
};
