import { describe, expect, it } from 'vitest';

import {
  buildCarryStrategyProfile,
  DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY,
} from '../index.js';

describe('buildCarryStrategyProfile', () => {
  it('defaults to a USDC 3-month rolling strategy with a 10% APY floor', () => {
    const profile = buildCarryStrategyProfile();

    expect(profile.vaultBaseAsset).toBe('USDC');
    expect(profile.tenor.lockPeriodMonths).toBe(3);
    expect(profile.tenor.rolling).toBe(true);
    expect(profile.tenor.reassessmentCadenceMonths).toBe(3);
    expect(profile.apy.targetFloorPct).toBe(DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY.minimumTargetApyPct);
    expect(profile.apy.targetApyPct).toBe(DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY.minimumTargetApyPct);
    expect(profile.eligibility.status).toBe('eligible');
  });

  it('rejects non-USDC vault base assets', () => {
    const profile = buildCarryStrategyProfile({
      vaultBaseAsset: 'USDT',
    });

    expect(profile.eligibility.status).toBe('ineligible');
    expect(profile.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'base_asset_usdc' && rule.status === 'fail',
    )).toBe(true);
    expect(profile.eligibility.blockedReasons).toContain('vault_base_asset_must_be_usdc');
  });

  it('rejects incompatible tenor settings', () => {
    const profile = buildCarryStrategyProfile({
      lockPeriodMonths: 1,
      reassessmentCadenceMonths: 1,
      rolling: false,
    });

    expect(profile.eligibility.status).toBe('ineligible');
    expect(profile.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'tenor_three_month_rolling' && rule.status === 'fail',
    )).toBe(true);
    expect(profile.eligibility.blockedReasons).toContain('vault_tenor_must_be_three_month_rolling');
  });

  it('rejects disallowed yield source categories', () => {
    const profile = buildCarryStrategyProfile({
      yieldSourceCategory: 'dex_lp',
    });

    expect(profile.eligibility.status).toBe('ineligible');
    expect(profile.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'allowed_yield_source' && rule.status === 'fail',
    )).toBe(true);
    expect(profile.eligibility.blockedReasons).toContain('yield_source_category_disallowed');
  });

  it('fails closed when leverage metadata is missing', () => {
    const profile = buildCarryStrategyProfile({
      leverageModel: 'perp_basis_hedged',
      leverageHealthThreshold: null,
    });

    expect(profile.eligibility.status).toBe('ineligible');
    expect(profile.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'leverage_health_metadata' && rule.status === 'fail',
    )).toBe(true);
    expect(profile.eligibility.blockedReasons).toContain('leverage_health_threshold_required');
  });

  it('rejects unsafe looping leverage on non-hardcoded oracle dependencies', () => {
    const profile = buildCarryStrategyProfile({
      leverageModel: 'looping',
      leverageHealthThreshold: '1.01',
      oracleDependencyClass: 'market_oracle_non_hardcoded',
    });

    expect(profile.eligibility.status).toBe('ineligible');
    expect(profile.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'unsafe_looping_leverage' && rule.status === 'fail',
    )).toBe(true);
    expect(profile.eligibility.blockedReasons).toContain('unsafe_looping_leverage_disallowed');
  });
});

