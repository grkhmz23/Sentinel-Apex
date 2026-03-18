import Decimal from 'decimal.js';

// =============================================================================
// Sentinel Apex — Decimal Arithmetic Utilities
// =============================================================================
// All public functions accept and return plain strings so that callers never
// have to manage Decimal objects directly. Internally every computation uses
// the decimal.js library to guarantee correct rounding for financial math.
// =============================================================================

/**
 * A branded string representing a finite decimal value.
 * Using a brand prevents accidentally passing arbitrary strings to financial
 * functions without the explicit coercion via `fromNumber`.
 */
export type DecimalValue = string & { readonly __brand: 'DecimalValue' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ZERO: DecimalValue = '0' as DecimalValue;
export const ONE: DecimalValue = '1' as DecimalValue;

// ---------------------------------------------------------------------------
// Core arithmetic
// ---------------------------------------------------------------------------

/** Add two decimal strings and return the result as a decimal string. */
export function add(a: string, b: string): string {
  return new Decimal(a).plus(new Decimal(b)).toFixed();
}

/** Subtract `b` from `a` and return the result as a decimal string. */
export function subtract(a: string, b: string): string {
  return new Decimal(a).minus(new Decimal(b)).toFixed();
}

/** Multiply two decimal strings and return the result as a decimal string. */
export function multiply(a: string, b: string): string {
  return new Decimal(a).times(new Decimal(b)).toFixed();
}

/**
 * Divide `a` by `b` with optional decimal precision (default: 20 significant
 * figures as provided by decimal.js).
 *
 * Throws a `RangeError` if `b` is zero — division by zero has no defined
 * result in financial calculations.
 */
export function divide(a: string, b: string, precision?: number): string {
  const divisor = new Decimal(b);
  if (divisor.isZero()) {
    throw new RangeError('Division by zero is not allowed');
  }
  const result = new Decimal(a).div(divisor);
  return precision !== undefined ? result.toFixed(precision) : result.toFixed();
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare two decimal strings.
 * Returns `-1` if `a < b`, `0` if `a === b`, `1` if `a > b`.
 */
export function compare(a: string, b: string): -1 | 0 | 1 {
  const cmp = new Decimal(a).comparedTo(new Decimal(b));
  if (cmp < 0) return -1;
  if (cmp > 0) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

/** Returns `true` when the decimal value is strictly greater than zero. */
export function isPositive(a: string): boolean {
  return new Decimal(a).greaterThan(0);
}

/** Returns `true` when the decimal value is strictly less than zero. */
export function isNegative(a: string): boolean {
  return new Decimal(a).lessThan(0);
}

/** Returns `true` when the decimal value equals zero. */
export function isZero(a: string): boolean {
  return new Decimal(a).isZero();
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a decimal string to a fixed number of decimal places, rounding
 * using ROUND_HALF_UP (the conventional financial rounding mode).
 */
export function toFixed(a: string, decimals: number): string {
  return new Decimal(a).toFixed(decimals, Decimal.ROUND_HALF_UP);
}

/**
 * Convert a JavaScript `number` to a decimal string.
 *
 * NOTE: IEEE 754 floating-point representation may introduce small errors for
 * certain values (e.g. `0.1 + 0.2`). Prefer passing string literals directly
 * when the value originates from user input or configuration.
 */
export function fromNumber(n: number): string {
  if (process.env['NODE_ENV'] !== 'production') {
    // Warn about potential precision loss in non-production environments so
    // developers catch accidental float paths early.
    const stringified = n.toString();
    if (stringified.includes('e') || stringified.length > 15) {
      process.stderr.write(
        `[decimal] Warning: fromNumber(${n}) may lose precision. ` +
          'Prefer passing a string literal.\n',
      );
    }
  }
  return new Decimal(n).toFixed();
}
