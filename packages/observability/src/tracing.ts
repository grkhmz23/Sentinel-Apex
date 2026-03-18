import { AsyncLocalStorage } from 'async_hooks';

// =============================================================================
// Sentinel Apex — Correlation ID / Tracing Context
// =============================================================================

interface TracingContext {
  correlationId: string;
}

const _storage = new AsyncLocalStorage<TracingContext>();

/**
 * Generate a new random correlation ID using the built-in Web Crypto API
 * available in Node 20+.
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Run `fn` within a tracing context that carries the supplied correlation ID.
 * Any call to `getCurrentCorrelationId()` inside `fn` (or any async code it
 * spawns) will return this ID.
 *
 * @example
 * const id = generateCorrelationId();
 * await withCorrelationId(id, async () => {
 *   // getCurrentCorrelationId() === id here
 *   await processOrder(order);
 * });
 */
export function withCorrelationId<T>(
  id: string,
  fn: () => Promise<T>,
): Promise<T> {
  return _storage.run({ correlationId: id }, fn);
}

/**
 * Return the correlation ID propagated to the current async context, or
 * `undefined` if no tracing context has been established.
 */
export function getCurrentCorrelationId(): string | undefined {
  return _storage.getStore()?.correlationId;
}
