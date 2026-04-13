import Decimal from 'decimal.js';

export type BuildABearYieldSourceCategory =
  | 'delta_neutral_carry'
  | 'funding_basis'
  | 'yield_bearing_stable_circular'
  | 'junior_tranche'
  | 'insurance_pool'
  | 'dex_lp'
  | 'leverage_looping'
  | 'other';

export type BuildABearLeverageModel =
  | 'unlevered'
  | 'perp_basis_hedged'
  | 'looping'
  | 'other_leveraged';

export type BuildABearOracleDependencyClass =
  | 'hardcoded'
  | 'market_oracle_non_hardcoded'
  | 'external_oracle_non_hardcoded';

export type BuildABearLockReassessmentPolicy = 'rolling_3_month';

export type CarryStrategyApyEvidenceKind =
  | 'projected'
  | 'backtested'
  | 'devnet'
  | 'live_verified'
  | 'unavailable';

export type CarryStrategyEvidenceScope = 'devnet' | 'backtest' | 'live' | 'simulation' | 'unknown';
export type CarryStrategyLatestEvidenceSource =
  | 'none'
  | 'projected'
  | 'backtest'
  | 'devnet_execution'
  | 'live_execution';

export type CarryStrategyEligibilityStatus = 'eligible' | 'ineligible';

export type CarryStrategyRuleKey =
  | 'base_asset_usdc'
  | 'tenor_three_month_rolling'
  | 'target_apy_floor'
  | 'allowed_yield_source'
  | 'leverage_health_metadata'
  | 'unsafe_looping_leverage';

export interface BuildABearStrategyPolicy {
  baseAsset: 'USDC';
  lockPeriodMonths: 3;
  rolling: true;
  reassessmentCadenceMonths: 3;
  minimumTargetApyPct: string;
  minimumLoopHealthRate: string;
}

export interface CarryStrategyRuleResult {
  ruleKey: CarryStrategyRuleKey;
  status: 'pass' | 'fail';
  summary: string;
  blockedReason: string | null;
  details: Record<string, unknown>;
}

export interface CarryStrategyApyModel {
  targetFloorPct: string;
  targetApyPct: string;
  projectedApyPct: string | null;
  projectedApySource: CarryStrategyApyEvidenceKind;
  realizedApyPct: string | null;
  realizedApySource: CarryStrategyApyEvidenceKind;
  realizedApyUpdatedAt: string | null;
  summary: string;
}

export interface CarryStrategyTenorModel {
  lockPeriodMonths: number;
  rolling: boolean;
  reassessmentCadenceMonths: number;
  summary: string;
}

export interface CarryStrategyRiskLimit {
  key: 'max_drawdown_pct' | 'min_health_threshold' | 'max_single_action_notional_usd';
  value: string;
  summary: string;
}

export interface CarryStrategyEvidenceSummary {
  environment: CarryStrategyEvidenceScope;
  supportLabel: string;
  supportedScope: string[];
  blockedScope: string[];
  latestExecutionId: string | null;
  latestExecutionReference: string | null;
  latestConfirmationStatus: string | null;
  latestEvidenceSource: CarryStrategyLatestEvidenceSource;
  summary: string;
}

export interface CarryStrategyEligibility {
  status: CarryStrategyEligibilityStatus;
  summary: string;
  blockedReasons: string[];
  ruleResults: CarryStrategyRuleResult[];
}

export interface CarryStrategyProfile {
  strategyId: 'apex-usdc-delta-neutral-carry';
  strategyName: string;
  sleeveId: 'carry';
  vaultBaseAsset: string;
  strategyFamily: 'delta_neutral_carry';
  yieldSourceCategory: BuildABearYieldSourceCategory;
  leverageModel: BuildABearLeverageModel;
  leverageHealthThreshold: string | null;
  oracleDependencyClass: BuildABearOracleDependencyClass;
  lockReassessmentPolicy: BuildABearLockReassessmentPolicy;
  thesis: string;
  riskProfile: string;
  disallowedYieldSources: BuildABearYieldSourceCategory[];
  apy: CarryStrategyApyModel;
  tenor: CarryStrategyTenorModel;
  riskLimits: CarryStrategyRiskLimit[];
  evidence: CarryStrategyEvidenceSummary;
  eligibility: CarryStrategyEligibility;
}

export interface CarryStrategyProfileInput {
  strategyName?: string;
  vaultBaseAsset?: string;
  yieldSourceCategory?: BuildABearYieldSourceCategory;
  leverageModel?: BuildABearLeverageModel;
  leverageHealthThreshold?: string | null;
  oracleDependencyClass?: BuildABearOracleDependencyClass;
  targetApyPct?: string;
  projectedApyPct?: string | null;
  projectedApySource?: CarryStrategyApyEvidenceKind;
  realizedApyPct?: string | null;
  realizedApySource?: CarryStrategyApyEvidenceKind;
  realizedApyUpdatedAt?: string | null;
  lockPeriodMonths?: number;
  rolling?: boolean;
  reassessmentCadenceMonths?: number;
  thesis?: string;
  riskProfile?: string;
  riskLimits?: CarryStrategyRiskLimit[];
  evidence?: Partial<CarryStrategyEvidenceSummary>;
}

export const DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY: BuildABearStrategyPolicy = {
  baseAsset: 'USDC',
  lockPeriodMonths: 3,
  rolling: true,
  reassessmentCadenceMonths: 3,
  minimumTargetApyPct: '10.00',
  minimumLoopHealthRate: '1.05',
};

export const DISALLOWED_BUILD_A_BEAR_YIELD_SOURCES: BuildABearYieldSourceCategory[] = [
  'yield_bearing_stable_circular',
  'junior_tranche',
  'insurance_pool',
  'dex_lp',
];

function normalizeDecimalString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  try {
    return new Decimal(value).toFixed(2);
  } catch {
    return null;
  }
}

function buildDefaultRiskLimits(healthThreshold: string | null): CarryStrategyRiskLimit[] {
  return [
    {
      key: 'max_drawdown_pct',
      value: '12.00',
      summary: 'Strategy-level drawdown limit for hackathon-facing vault metadata.',
    },
    {
      key: 'min_health_threshold',
      value: healthThreshold ?? 'unknown',
      summary: 'Explicit leverage health threshold metadata is required whenever leverage is present.',
    },
    {
      key: 'max_single_action_notional_usd',
      value: '25000.00',
      summary: 'Carry action notional stays bounded while live execution remains limited to the current approved devnet lane.'
    },
  ];
}

function buildEvidenceSummary(
  input: Partial<CarryStrategyEvidenceSummary> | undefined,
): CarryStrategyEvidenceSummary {
  const supportedScope = input?.supportedScope ?? [
    'USDC-denominated carry strategy metadata and policy enforcement.',
    'Jupiter Perpetuals devnet execution for BTC-PERP, ETH-PERP, SOL-PERP.',
    'Backtesting framework for strategy validation.',
    'Multi-leg carry orchestration framework.',
  ];
  const blockedScope = input?.blockedScope ?? [
    'Mainnet execution remains blocked (devnet only for hackathon).',
    'No legacy execution venue support outside Jupiter Perps.',
    'New markets, non-USDC base assets, and DEX LP / junior tranche / insurance pool / circular-yield strategies remain blocked.',
    'CEX execution adapters not implemented.',
  ];
  const latestEvidenceSource = input?.latestEvidenceSource ?? 'none';
  const environment = input?.environment ?? 'devnet';
  const supportLabel = input?.supportLabel ?? 'jupiter_perps_devnet';

  return {
    environment,
    supportLabel,
    supportedScope,
    blockedScope,
    latestExecutionId: input?.latestExecutionId ?? null,
    latestExecutionReference: input?.latestExecutionReference ?? null,
    latestConfirmationStatus: input?.latestConfirmationStatus ?? null,
    latestEvidenceSource,
    summary: input?.summary ?? (
      latestEvidenceSource === 'devnet_execution'
        ? 'The strategy has Jupiter Perpetuals devnet execution evidence.'
        : 'The strategy policy is configured for Jupiter Perpetuals devnet execution.'
    ),
  };
}

function buildRuleResult(
  ruleKey: CarryStrategyRuleKey,
  status: 'pass' | 'fail',
  summary: string,
  blockedReason: string | null,
  details: Record<string, unknown>,
): CarryStrategyRuleResult {
  return {
    ruleKey,
    status,
    summary,
    blockedReason,
    details,
  };
}

export function buildCarryStrategyProfile(
  input: CarryStrategyProfileInput = {},
  policy: BuildABearStrategyPolicy = DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY,
): CarryStrategyProfile {
  const targetApyPct = normalizeDecimalString(input.targetApyPct) ?? policy.minimumTargetApyPct;
  const projectedApyPct = normalizeDecimalString(input.projectedApyPct);
  const realizedApyPct = normalizeDecimalString(input.realizedApyPct);
  const defaultLeverageHealthThreshold = input.leverageModel === undefined ? '1.10' : null;
  const leverageHealthThreshold = normalizeDecimalString(
    input.leverageHealthThreshold ?? defaultLeverageHealthThreshold,
  );
  const tenor: CarryStrategyTenorModel = {
    lockPeriodMonths: input.lockPeriodMonths ?? policy.lockPeriodMonths,
    rolling: input.rolling ?? policy.rolling,
    reassessmentCadenceMonths: input.reassessmentCadenceMonths ?? policy.reassessmentCadenceMonths,
    summary: `Lock period is ${input.lockPeriodMonths ?? policy.lockPeriodMonths} months and reassessment occurs every ${input.reassessmentCadenceMonths ?? policy.reassessmentCadenceMonths} months on a rolling basis.`,
  };

  const apy: CarryStrategyApyModel = {
    targetFloorPct: policy.minimumTargetApyPct,
    targetApyPct,
    projectedApyPct,
    projectedApySource: input.projectedApySource ?? (projectedApyPct === null ? 'unavailable' : 'projected'),
    realizedApyPct,
    realizedApySource: input.realizedApySource ?? (realizedApyPct === null ? 'unavailable' : 'devnet'),
    realizedApyUpdatedAt: input.realizedApyUpdatedAt ?? null,
    summary: realizedApyPct === null
      ? 'Realized APY is currently unavailable or unverified; only target and projected APY are surfaced.'
      : 'Realized APY is surfaced with explicit evidence labeling and is not conflated with projected APY.',
  };

  const evidence = buildEvidenceSummary(input.evidence);
  const riskLimits = input.riskLimits ?? buildDefaultRiskLimits(leverageHealthThreshold);
  const baseAsset = input.vaultBaseAsset ?? policy.baseAsset;
  const yieldSourceCategory = input.yieldSourceCategory ?? 'delta_neutral_carry';
  const leverageModel = input.leverageModel ?? 'perp_basis_hedged';
  const oracleDependencyClass = input.oracleDependencyClass ?? 'market_oracle_non_hardcoded';
  const ruleResults: CarryStrategyRuleResult[] = [];

  ruleResults.push(
    buildRuleResult(
      'base_asset_usdc',
      baseAsset === policy.baseAsset ? 'pass' : 'fail',
      baseAsset === policy.baseAsset
        ? 'Vault base asset is USDC as required.'
        : `Vault base asset ${baseAsset} is not eligible; Build-A-Bear requires USDC.`,
      baseAsset === policy.baseAsset ? null : 'vault_base_asset_must_be_usdc',
      { expectedBaseAsset: policy.baseAsset, observedBaseAsset: baseAsset },
    ),
  );

  const validTenor = tenor.lockPeriodMonths === policy.lockPeriodMonths
    && tenor.rolling === policy.rolling
    && tenor.reassessmentCadenceMonths === policy.reassessmentCadenceMonths;
  ruleResults.push(
    buildRuleResult(
      'tenor_three_month_rolling',
      validTenor ? 'pass' : 'fail',
      validTenor
        ? 'Tenor is a 3-month rolling lock with 3-month reassessment cadence.'
        : 'Tenor is not the required 3-month rolling lock with 3-month reassessment cadence.',
      validTenor ? null : 'vault_tenor_must_be_three_month_rolling',
      {
        expectedLockPeriodMonths: policy.lockPeriodMonths,
        expectedRolling: policy.rolling,
        expectedReassessmentCadenceMonths: policy.reassessmentCadenceMonths,
        observedLockPeriodMonths: tenor.lockPeriodMonths,
        observedRolling: tenor.rolling,
        observedReassessmentCadenceMonths: tenor.reassessmentCadenceMonths,
      },
    ),
  );

  const targetApyPasses = new Decimal(targetApyPct).gte(policy.minimumTargetApyPct);
  ruleResults.push(
    buildRuleResult(
      'target_apy_floor',
      targetApyPasses ? 'pass' : 'fail',
      targetApyPasses
        ? `Target APY floor is ${targetApyPct}% and meets the ${policy.minimumTargetApyPct}% minimum.`
        : `Target APY floor ${targetApyPct}% is below the ${policy.minimumTargetApyPct}% minimum.`,
      targetApyPasses ? null : 'target_apy_floor_below_minimum',
      {
        minimumTargetApyPct: policy.minimumTargetApyPct,
        observedTargetApyPct: targetApyPct,
      },
    ),
  );

  const yieldSourceAllowed = !DISALLOWED_BUILD_A_BEAR_YIELD_SOURCES.includes(yieldSourceCategory);
  ruleResults.push(
    buildRuleResult(
      'allowed_yield_source',
      yieldSourceAllowed ? 'pass' : 'fail',
      yieldSourceAllowed
        ? `Yield source category ${yieldSourceCategory} is allowed for Build-A-Bear.`
        : `Yield source category ${yieldSourceCategory} is explicitly disallowed for Build-A-Bear.`,
      yieldSourceAllowed ? null : 'yield_source_category_disallowed',
      {
        yieldSourceCategory,
        disallowedYieldSources: DISALLOWED_BUILD_A_BEAR_YIELD_SOURCES,
      },
    ),
  );

  const leverageMetadataRequired = leverageModel !== 'unlevered';
  const leverageMetadataPresent = !leverageMetadataRequired || leverageHealthThreshold !== null;
  ruleResults.push(
    buildRuleResult(
      'leverage_health_metadata',
      leverageMetadataPresent ? 'pass' : 'fail',
      leverageMetadataPresent
        ? 'Leverage metadata is explicit and includes a health threshold.'
        : 'Leverage metadata is incomplete because no health-threshold floor was provided.',
      leverageMetadataPresent ? null : 'leverage_health_threshold_required',
      {
        leverageModel,
        leverageHealthThreshold,
      },
    ),
  );

  const unsafeLooping = leverageModel === 'looping'
    && oracleDependencyClass !== 'hardcoded'
    && (
      leverageHealthThreshold === null
      || new Decimal(leverageHealthThreshold).lt(policy.minimumLoopHealthRate)
    );
  ruleResults.push(
    buildRuleResult(
      'unsafe_looping_leverage',
      unsafeLooping ? 'fail' : 'pass',
      unsafeLooping
        ? `Looping strategy health threshold ${leverageHealthThreshold ?? 'unknown'} is below ${policy.minimumLoopHealthRate} on a non-hardcoded oracle dependency.`
        : 'No disqualifying unsafe looping leverage condition is present.',
      unsafeLooping ? 'unsafe_looping_leverage_disallowed' : null,
      {
        leverageModel,
        leverageHealthThreshold,
        oracleDependencyClass,
        minimumLoopHealthRate: policy.minimumLoopHealthRate,
      },
    ),
  );

  const blockedReasons = ruleResults
    .flatMap((rule) => rule.status === 'fail' && rule.blockedReason !== null ? [rule.blockedReason] : []);

  const eligibility: CarryStrategyEligibility = {
    status: blockedReasons.length === 0 ? 'eligible' : 'ineligible',
    summary: blockedReasons.length === 0
      ? 'Strategy metadata satisfies the Build-A-Bear product-policy rules, but execution scope remains narrow and devnet-only.'
      : 'Strategy metadata does not currently satisfy all Build-A-Bear product-policy rules and remains blocked.',
    blockedReasons,
    ruleResults,
  };

  return {
    strategyId: 'apex-usdc-delta-neutral-carry',
    strategyName: input.strategyName ?? 'Apex USDC Delta-Neutral Carry',
    sleeveId: 'carry',
    vaultBaseAsset: baseAsset,
    strategyFamily: 'delta_neutral_carry',
    yieldSourceCategory,
    leverageModel,
    leverageHealthThreshold,
    oracleDependencyClass,
    lockReassessmentPolicy: 'rolling_3_month',
    thesis: input.thesis ?? 'Capture delta-neutral carry in a USDC-denominated sleeve without DEX LP, junior tranche, insurance-pool, or circular stable yield exposure.',
    riskProfile: input.riskProfile ?? 'Constrained, operator-supervised carry strategy with explicit tenor, APY target floor, and venue-scope gating.',
    disallowedYieldSources: DISALLOWED_BUILD_A_BEAR_YIELD_SOURCES,
    apy,
    tenor,
    riskLimits,
    evidence,
    eligibility,
  };
}
