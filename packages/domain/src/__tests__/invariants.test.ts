import { describe, it, expect } from 'vitest';

import {
  InvariantError,
  assertPositiveSize,
  assertValidAllocationPct,
  assertHedgeStateConsistent,
  assertNoNegativeNav,
} from '../invariants.js';

// =============================================================================
// assertPositiveSize
// =============================================================================

describe('assertPositiveSize', () => {
  it('passes for a positive integer string', () => {
    expect(() => assertPositiveSize('100')).not.toThrow();
  });

  it('passes for a positive decimal string', () => {
    expect(() => assertPositiveSize('0.001')).not.toThrow();
  });

  it('passes for a large value', () => {
    expect(() => assertPositiveSize('9999999.99')).not.toThrow();
  });

  it('throws InvariantError for zero', () => {
    expect(() => assertPositiveSize('0')).toThrow(InvariantError);
  });

  it('throws InvariantError for zero with decimals', () => {
    expect(() => assertPositiveSize('0.000')).toThrow(InvariantError);
  });

  it('throws InvariantError for a negative value', () => {
    expect(() => assertPositiveSize('-1')).toThrow(InvariantError);
  });

  it('throws InvariantError for a non-numeric string', () => {
    expect(() => assertPositiveSize('abc')).toThrow(InvariantError);
  });

  it('throws InvariantError for empty string', () => {
    expect(() => assertPositiveSize('')).toThrow(InvariantError);
  });

  it('error message references the value', () => {
    let err: unknown;
    try { assertPositiveSize('-5'); } catch (e) { err = e; }
    expect((err as InvariantError).message).toMatch(/-5/);
  });
});

// =============================================================================
// assertValidAllocationPct
// =============================================================================

describe('assertValidAllocationPct', () => {
  it('passes for 0', () => {
    expect(() => assertValidAllocationPct(0)).not.toThrow();
  });

  it('passes for 100', () => {
    expect(() => assertValidAllocationPct(100)).not.toThrow();
  });

  it('passes for a mid-range value', () => {
    expect(() => assertValidAllocationPct(42.5)).not.toThrow();
  });

  it('throws InvariantError for a value below 0', () => {
    expect(() => assertValidAllocationPct(-0.1)).toThrow(InvariantError);
  });

  it('throws InvariantError for a value above 100', () => {
    expect(() => assertValidAllocationPct(100.1)).toThrow(InvariantError);
  });

  it('throws InvariantError for NaN', () => {
    expect(() => assertValidAllocationPct(NaN)).toThrow(InvariantError);
  });

  it('throws InvariantError for Infinity', () => {
    expect(() => assertValidAllocationPct(Infinity)).toThrow(InvariantError);
  });

  it('throws InvariantError for -Infinity', () => {
    expect(() => assertValidAllocationPct(-Infinity)).toThrow(InvariantError);
  });

  it('error name is InvariantError', () => {
    let err: unknown;
    try { assertValidAllocationPct(101); } catch (e) { err = e; }
    expect((err as InvariantError).name).toBe('InvariantError');
  });
});

// =============================================================================
// assertHedgeStateConsistent
// =============================================================================

describe('assertHedgeStateConsistent', () => {
  it('passes for exactly matched sizes', () => {
    expect(() => assertHedgeStateConsistent('100', '100')).not.toThrow();
  });

  it('passes for both legs at zero (no position open)', () => {
    expect(() => assertHedgeStateConsistent('0', '0')).not.toThrow();
  });

  it('passes for sizes within 0.1% tolerance', () => {
    // Difference of 0.05 on 100 = 0.05% < 0.1%
    expect(() => assertHedgeStateConsistent('100', '99.95')).not.toThrow();
  });

  it('throws InvariantError for sizes outside 0.1% tolerance', () => {
    // Difference of 5 on 100 = 5% > 0.1%
    expect(() => assertHedgeStateConsistent('100', '95')).toThrow(InvariantError);
  });

  it('throws InvariantError for a negative long size', () => {
    expect(() => assertHedgeStateConsistent('-1', '100')).toThrow(InvariantError);
  });

  it('throws InvariantError for a negative short size', () => {
    expect(() => assertHedgeStateConsistent('100', '-1')).toThrow(InvariantError);
  });

  it('throws InvariantError for non-numeric input', () => {
    expect(() => assertHedgeStateConsistent('abc', '100')).toThrow(InvariantError);
  });

  it('error message mentions hedge imbalance percentage', () => {
    let err: unknown;
    try { assertHedgeStateConsistent('100', '90'); } catch (e) { err = e; }
    expect((err as InvariantError).message).toMatch(/Hedge imbalance/);
  });
});

// =============================================================================
// assertNoNegativeNav
// =============================================================================

describe('assertNoNegativeNav', () => {
  it('passes for zero NAV', () => {
    expect(() => assertNoNegativeNav('0')).not.toThrow();
  });

  it('passes for a positive NAV', () => {
    expect(() => assertNoNegativeNav('1000000.00')).not.toThrow();
  });

  it('throws InvariantError for a negative NAV', () => {
    expect(() => assertNoNegativeNav('-0.01')).toThrow(InvariantError);
  });

  it('throws InvariantError for a large negative NAV', () => {
    expect(() => assertNoNegativeNav('-99999')).toThrow(InvariantError);
  });

  it('throws InvariantError for a non-numeric string', () => {
    expect(() => assertNoNegativeNav('$100')).toThrow(InvariantError);
  });

  it('error message references the bad value', () => {
    let err: unknown;
    try { assertNoNegativeNav('-500'); } catch (e) { err = e; }
    expect((err as InvariantError).message).toMatch(/-500/);
  });
});

// =============================================================================
// InvariantError
// =============================================================================

describe('InvariantError', () => {
  it('is an instance of Error', () => {
    const err = new InvariantError('test', 'something went wrong');
    expect(err).toBeInstanceOf(Error);
  });

  it('name is InvariantError', () => {
    const err = new InvariantError('test', 'something went wrong');
    expect(err.name).toBe('InvariantError');
  });

  it('message includes invariant name and detail', () => {
    const err = new InvariantError('my_invariant', 'the detail');
    expect(err.message).toMatch(/my_invariant/);
    expect(err.message).toMatch(/the detail/);
  });

  it('supports instanceof checks after throw/catch', () => {
    let err: unknown;
    try { assertPositiveSize('0'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(InvariantError);
    expect(err).toBeInstanceOf(Error);
  });
});
