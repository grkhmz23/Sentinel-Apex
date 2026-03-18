// =============================================================================
// Sentinel Apex — Common Validation Utilities
// =============================================================================

/** Type guard: returns `true` if `v` is a non-empty string. */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** Type guard: returns `true` if `v` is a finite number greater than zero. */
export function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v > 0;
}

/**
 * Assert that `v` is neither `undefined` nor `null`.
 * Throws a `TypeError` with a descriptive message if the assertion fails.
 *
 * @param v     The value to check.
 * @param name  The name of the variable / parameter (used in the error message).
 * @returns The value, narrowed to `T`.
 */
export function assertDefined<T>(v: T | undefined | null, name: string): T {
  if (v === undefined || v === null) {
    throw new TypeError(`Expected "${name}" to be defined, but got ${String(v)}`);
  }
  return v;
}

/**
 * Clamp `value` to the range `[min, max]`.
 * If `value` is less than `min`, returns `min`.
 * If `value` is greater than `max`, returns `max`.
 * Otherwise returns `value` unchanged.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(
      `clamp: min (${min}) must be less than or equal to max (${max})`,
    );
  }
  return Math.min(Math.max(value, min), max);
}
