import { sleep } from './time.js';

// =============================================================================
// Sentinel Apex — Retry with Exponential Backoff
// =============================================================================

export interface RetryOptions {
  /** Maximum number of total attempts (including the first). */
  maxAttempts: number;
  /** Delay before the second attempt, in milliseconds. */
  initialDelayMs: number;
  /** Upper bound on the inter-attempt delay, in milliseconds. */
  maxDelayMs: number;
  /** Multiplier applied to the delay after each failure. */
  backoffMultiplier: number;
  /**
   * Optional predicate called with the error from each failed attempt.
   * Return `false` to stop retrying immediately and re-throw the error.
   * Defaults to always returning `true` (retry on any error).
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Execute `fn` and retry up to `options.maxAttempts - 1` additional times
 * on failure, using exponential backoff between attempts.
 *
 * If all attempts are exhausted the last error is re-thrown.
 * If `shouldRetry` returns `false` the error is re-thrown immediately without
 * further attempts.
 *
 * @example
 * const result = await retry(
 *   () => fetchMarketData(venue),
 *   { maxAttempts: 5, initialDelayMs: 100, maxDelayMs: 5_000, backoffMultiplier: 2 },
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    shouldRetry = () => true,
  } = options;

  if (maxAttempts < 1) {
    throw new RangeError('retry: maxAttempts must be at least 1');
  }

  let lastError: Error = new Error('retry: no attempts made');
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (thrown: unknown) {
      const error =
        thrown instanceof Error ? thrown : new Error(String(thrown));
      lastError = error;

      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        await sleep(delayMs);
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}
