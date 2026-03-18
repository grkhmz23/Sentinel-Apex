// =============================================================================
// Position sizer tests
// =============================================================================

import { describe, it, expect } from 'vitest';

import { DEFAULT_CARRY_CONFIG } from '../config.js';
import { computePositionSize, computeMaxAllowedSize } from '../position-sizer.js';

import type { CarryConfig } from '../config.js';

function makeConfig(overrides: Partial<CarryConfig> = {}): CarryConfig {
  return { ...DEFAULT_CARRY_CONFIG, ...overrides };
}

describe('computePositionSize', () => {
  it('returns smaller size with lower confidence score', () => {
    const config = makeConfig({
      defaultPositionSizePct: '1',
      maxPositionSizePct: '20',
      kellyCriterionFraction: '0.25',
    });

    const highConfidence = computePositionSize({
      sleeveNav: '100000',
      expectedYieldPct: '20',
      confidenceScore: 0.9,
      config,
      currentExposurePct: '0',
    });

    const lowConfidence = computePositionSize({
      sleeveNav: '100000',
      expectedYieldPct: '20',
      confidenceScore: 0.4,
      config,
      currentExposurePct: '0',
    });

    expect(parseFloat(highConfidence)).toBeGreaterThan(parseFloat(lowConfidence));
  });

  it('caps size at maxPositionSizePct of NAV', () => {
    const config = makeConfig({
      maxPositionSizePct: '10',
      kellyCriterionFraction: '1.0', // full Kelly → very high raw size
    });

    const size = computePositionSize({
      sleeveNav: '100000',
      expectedYieldPct: '200', // absurdly high yield
      confidenceScore: 1.0,
      config,
      currentExposurePct: '0',
    });

    // Max 10% of 100,000 = 10,000
    expect(parseFloat(size)).toBeLessThanOrEqual(10_000);
  });

  it('returns zero when already at max exposure', () => {
    const config = makeConfig({ maxPositionSizePct: '20' });

    const size = computePositionSize({
      sleeveNav: '100000',
      expectedYieldPct: '15',
      confidenceScore: 0.8,
      config,
      currentExposurePct: '20', // already at max
    });

    expect(size).toBe('0');
  });

  it('returns zero when exposure exceeds max', () => {
    const config = makeConfig({ maxPositionSizePct: '20' });

    const size = computePositionSize({
      sleeveNav: '100000',
      expectedYieldPct: '15',
      confidenceScore: 0.8,
      config,
      currentExposurePct: '25', // over max
    });

    expect(size).toBe('0');
  });

  it('is proportional to sleeve NAV', () => {
    const config = makeConfig({ defaultPositionSizePct: '5' });
    const commonParams = {
      expectedYieldPct: '10',
      confidenceScore: 0.7,
      config,
      currentExposurePct: '0',
    };

    const sizeSmall = parseFloat(
      computePositionSize({ sleeveNav: '100000', ...commonParams }),
    );
    const sizeLarge = parseFloat(
      computePositionSize({ sleeveNav: '1000000', ...commonParams }),
    );

    expect(sizeLarge).toBeCloseTo(sizeSmall * 10, 0);
  });

  it('returns zero for zero NAV', () => {
    const config = makeConfig();
    const size = computePositionSize({
      sleeveNav: '0',
      expectedYieldPct: '10',
      confidenceScore: 0.8,
      config,
      currentExposurePct: '0',
    });

    expect(size).toBe('0');
  });

  it('floors at defaultPositionSizePct when Kelly suggests smaller size', () => {
    const config = makeConfig({
      defaultPositionSizePct: '5',
      maxPositionSizePct: '20',
      kellyCriterionFraction: '0.01', // tiny Kelly → below default
    });

    const size = computePositionSize({
      sleeveNav: '100000',
      expectedYieldPct: '1',
      confidenceScore: 0.1,
      config,
      currentExposurePct: '0',
    });

    // Should floor at 5% of 100,000 = 5,000
    expect(parseFloat(size)).toBeGreaterThanOrEqual(5_000);
  });
});

describe('computeMaxAllowedSize', () => {
  it('returns zero when at max concurrent opportunities', () => {
    const config = makeConfig({ maxConcurrentOpportunities: 5 });

    const size = computeMaxAllowedSize({
      sleeveNav: '100000',
      currentPositions: 5,
      config,
    });

    expect(size).toBe('0');
  });

  it('returns zero for zero NAV', () => {
    const config = makeConfig();
    const size = computeMaxAllowedSize({
      sleeveNav: '0',
      currentPositions: 0,
      config,
    });

    expect(size).toBe('0');
  });

  it('returns positive size when below position limit', () => {
    const config = makeConfig({
      maxConcurrentOpportunities: 5,
      maxPositionSizePct: '20',
      defaultPositionSizePct: '5',
    });

    const size = computeMaxAllowedSize({
      sleeveNav: '100000',
      currentPositions: 2,
      config,
    });

    expect(parseFloat(size)).toBeGreaterThan(0);
  });

  it('returns smaller per-slot size when more positions are open', () => {
    const config = makeConfig({
      maxConcurrentOpportunities: 5,
      maxPositionSizePct: '20',
      defaultPositionSizePct: '5',
    });

    const sizeWithFewPositions = parseFloat(
      computeMaxAllowedSize({ sleeveNav: '100000', currentPositions: 1, config }),
    );
    const sizeWithManyPositions = parseFloat(
      computeMaxAllowedSize({ sleeveNav: '100000', currentPositions: 4, config }),
    );

    expect(sizeWithFewPositions).toBeGreaterThanOrEqual(sizeWithManyPositions);
  });
});
