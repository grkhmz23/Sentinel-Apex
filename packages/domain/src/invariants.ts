// =============================================================================
// Domain Invariants
// =============================================================================
// Pure functions that assert business rules.  Each function throws an
// InvariantError if the constraint is violated.  These are deliberately simple:
// they accept string decimals and perform lexicographic/numeric checks only
// where safe to do so (comparisons of normalised decimal strings).
// =============================================================================

/**
 * Thrown when a business invariant is violated.  Callers should treat this as
 * a programming error (invalid state was constructed) rather than a user error.
 */
export class InvariantError extends Error {
  constructor(invariant: string, detail: string) {
    super(`Invariant violation [${invariant}]: ${detail}`);
    this.name = 'InvariantError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse a decimal string to a finite JavaScript number purely for comparison
 * purposes.  Financial values are never stored as numbers — only compared.
 */
function parseDecimal(value: string, fieldName: string): number {
  const n = parseFloat(value);
  if (!isFinite(n)) {
    throw new InvariantError(fieldName, `"${value}" is not a finite decimal number`);
  }
  return n;
}

// =============================================================================
// Invariant functions
// =============================================================================

/**
 * Assert that a trade/position size (decimal string) is strictly positive.
 *
 * @param size - decimal string, e.g. "0.5", "100.00"
 */
export function assertPositiveSize(size: string): void {
  const n = parseDecimal(size, 'assertPositiveSize');
  if (n <= 0) {
    throw new InvariantError(
      'assertPositiveSize',
      `Size must be strictly positive, got "${size}"`,
    );
  }
}

/**
 * Assert that an allocation percentage is in the range [0, 100] (inclusive).
 *
 * @param pct - number, 0–100
 */
export function assertValidAllocationPct(pct: number): void {
  if (!isFinite(pct)) {
    throw new InvariantError('assertValidAllocationPct', `Allocation must be finite, got ${pct}`);
  }
  if (pct < 0 || pct > 100) {
    throw new InvariantError(
      'assertValidAllocationPct',
      `Allocation must be between 0 and 100 (inclusive), got ${pct}`,
    );
  }
}

/**
 * Assert that the hedge state is consistent: the absolute difference between
 * the long and short leg sizes does not exceed 0.1% of the larger leg.
 *
 * This is a soft invariant — callers should use it to detect drift, not to
 * prevent state from being recorded.
 *
 * @param longSize  - decimal string, absolute size of the long leg
 * @param shortSize - decimal string, absolute size of the short leg
 */
export function assertHedgeStateConsistent(longSize: string, shortSize: string): void {
  const long = parseDecimal(longSize, 'assertHedgeStateConsistent.longSize');
  const short = parseDecimal(shortSize, 'assertHedgeStateConsistent.shortSize');

  if (long < 0) {
    throw new InvariantError(
      'assertHedgeStateConsistent',
      `Long size must be non-negative, got "${longSize}"`,
    );
  }
  if (short < 0) {
    throw new InvariantError(
      'assertHedgeStateConsistent',
      `Short size must be non-negative, got "${shortSize}"`,
    );
  }

  const larger = Math.max(long, short);

  // Allow perfectly zero legs (e.g., nothing is open yet)
  if (larger === 0) return;

  const diffPct = Math.abs(long - short) / larger;
  if (diffPct > 0.001) {
    throw new InvariantError(
      'assertHedgeStateConsistent',
      `Hedge imbalance of ${(diffPct * 100).toFixed(4)}% exceeds 0.1% threshold ` +
        `(long="${longSize}", short="${shortSize}")`,
    );
  }
}

/**
 * Assert that a Net Asset Value (NAV) is not negative.
 *
 * @param nav - decimal string
 */
export function assertNoNegativeNav(nav: string): void {
  const n = parseDecimal(nav, 'assertNoNegativeNav');
  if (n < 0) {
    throw new InvariantError(
      'assertNoNegativeNav',
      `NAV must be non-negative, got "${nav}"`,
    );
  }
}
