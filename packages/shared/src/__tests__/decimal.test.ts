import { describe, it, expect } from 'vitest';

import {
  add,
  subtract,
  multiply,
  divide,
  compare,
  isPositive,
  isNegative,
  isZero,
  toFixed,
  fromNumber,
  ZERO,
  ONE,
} from '../decimal.js';

// =============================================================================
// Decimal Arithmetic Tests
// =============================================================================

describe('constants', () => {
  it('ZERO equals "0"', () => {
    expect(ZERO).toBe('0');
  });

  it('ONE equals "1"', () => {
    expect(ONE).toBe('1');
  });
});

describe('add', () => {
  it('adds two positive integers', () => {
    expect(add('1', '2')).toBe('3');
  });

  it('adds two decimal values without floating-point error', () => {
    // 0.1 + 0.2 in IEEE 754 would give 0.30000000000000004
    expect(add('0.1', '0.2')).toBe('0.3');
  });

  it('adds a positive and negative number', () => {
    expect(add('10', '-3')).toBe('7');
  });

  it('adds zero', () => {
    expect(add('5.5', '0')).toBe('5.5');
  });

  it('handles large numbers', () => {
    expect(add('999999999999.99', '0.01')).toBe('1000000000000');
  });
});

describe('subtract', () => {
  it('subtracts two positive integers', () => {
    expect(subtract('10', '3')).toBe('7');
  });

  it('produces a negative result', () => {
    expect(subtract('1', '5')).toBe('-4');
  });

  it('subtracts decimals correctly', () => {
    expect(subtract('1.0', '0.1')).toBe('0.9');
  });

  it('subtracting zero returns the original value', () => {
    expect(subtract('42', '0')).toBe('42');
  });
});

describe('multiply', () => {
  it('multiplies two integers', () => {
    expect(multiply('6', '7')).toBe('42');
  });

  it('multiplies decimals', () => {
    expect(multiply('2.5', '4')).toBe('10');
  });

  it('multiplying by zero gives zero', () => {
    expect(multiply('9999', '0')).toBe('0');
  });

  it('multiplying negatives gives a positive', () => {
    expect(multiply('-3', '-4')).toBe('12');
  });

  it('multiplying a positive by a negative gives a negative', () => {
    expect(multiply('5', '-2')).toBe('-10');
  });

  it('handles small fractional multiplication', () => {
    // 0.1 * 0.1 = 0.01 — should not have floating-point error
    expect(multiply('0.1', '0.1')).toBe('0.01');
  });
});

describe('divide', () => {
  it('divides two integers evenly', () => {
    expect(divide('10', '2')).toBe('5');
  });

  it('divides with a fractional result and default precision', () => {
    // 1 / 3 should give many decimal places
    const result = divide('1', '3');
    expect(result.startsWith('0.333')).toBe(true);
  });

  it('respects the precision parameter', () => {
    expect(divide('1', '3', 4)).toBe('0.3333');
  });

  it('divides decimals', () => {
    expect(divide('7.5', '2.5', 1)).toBe('3.0');
  });

  it('throws RangeError on division by zero', () => {
    expect(() => divide('10', '0')).toThrowError(RangeError);
    expect(() => divide('10', '0')).toThrowError('Division by zero');
  });

  it('throws RangeError on division by string zero', () => {
    expect(() => divide('10', '0.0')).toThrowError(RangeError);
  });

  it('handles negative dividend', () => {
    expect(divide('-9', '3', 0)).toBe('-3');
  });
});

describe('compare', () => {
  it('returns -1 when a < b', () => {
    expect(compare('1', '2')).toBe(-1);
  });

  it('returns 0 when a === b', () => {
    expect(compare('3.14', '3.14')).toBe(0);
  });

  it('returns 1 when a > b', () => {
    expect(compare('10', '9.99')).toBe(1);
  });

  it('compares negative numbers correctly', () => {
    expect(compare('-5', '-3')).toBe(-1);
  });

  it('compares zero and negative zero', () => {
    expect(compare('0', '-0')).toBe(0);
  });
});

describe('isPositive', () => {
  it('returns true for positive numbers', () => {
    expect(isPositive('1')).toBe(true);
    expect(isPositive('0.001')).toBe(true);
  });

  it('returns false for zero', () => {
    expect(isPositive('0')).toBe(false);
  });

  it('returns false for negative numbers', () => {
    expect(isPositive('-1')).toBe(false);
  });
});

describe('isNegative', () => {
  it('returns true for negative numbers', () => {
    expect(isNegative('-1')).toBe(true);
    expect(isNegative('-0.001')).toBe(true);
  });

  it('returns false for zero', () => {
    expect(isNegative('0')).toBe(false);
  });

  it('returns false for positive numbers', () => {
    expect(isNegative('1')).toBe(false);
  });
});

describe('isZero', () => {
  it('returns true for zero', () => {
    expect(isZero('0')).toBe(true);
    expect(isZero('0.0')).toBe(true);
  });

  it('returns false for non-zero', () => {
    expect(isZero('0.001')).toBe(false);
    expect(isZero('-1')).toBe(false);
  });
});

describe('toFixed', () => {
  it('formats to the requested decimal places', () => {
    expect(toFixed('3.14159', 2)).toBe('3.14');
  });

  it('rounds up at the midpoint (ROUND_HALF_UP)', () => {
    expect(toFixed('2.5', 0)).toBe('3');
  });

  it('pads with trailing zeros', () => {
    expect(toFixed('1', 3)).toBe('1.000');
  });

  it('formats zero', () => {
    expect(toFixed('0', 2)).toBe('0.00');
  });

  it('formats negative numbers', () => {
    expect(toFixed('-1.5', 0)).toBe('-2');
  });
});

describe('fromNumber', () => {
  it('converts an integer', () => {
    expect(fromNumber(42)).toBe('42');
  });

  it('converts a decimal', () => {
    // JS 0.5 is exactly representable in IEEE 754
    expect(fromNumber(0.5)).toBe('0.5');
  });

  it('converts zero', () => {
    expect(fromNumber(0)).toBe('0');
  });

  it('converts a negative number', () => {
    expect(fromNumber(-100)).toBe('-100');
  });

  it('converts a large round number', () => {
    expect(fromNumber(1_000_000)).toBe('1000000');
  });
});
