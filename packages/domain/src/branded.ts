// =============================================================================
// Branded types — zero-cost nominal typing in TypeScript
// =============================================================================
// Use Brand<T, B> to create a distinct subtype of T that cannot be mixed with
// plain T at compile time, preventing ID confusion (e.g., passing an OrderId
// where a PositionId is expected).
// =============================================================================

declare const brandSymbol: unique symbol;

/**
 * Create a nominally-typed alias of T.
 *
 * @example
 * type UserId = Brand<string, 'UserId'>;
 * const id: UserId = brand<UserId>('abc-123');
 */
export type Brand<T, B> = T & { readonly [brandSymbol]: B };

/**
 * Cast a raw value to its branded type.
 * Only use at trust boundaries (e.g., parsing from DB or external API).
 */
export function brand<T extends Brand<unknown, unknown>>(
  value: T extends Brand<infer V, unknown> ? V : never,
): T {
  return value as T;
}

// =============================================================================
// ID factory
// =============================================================================

/**
 * Generate a new random UUID.  The return type is `string` at runtime; callers
 * should immediately cast to the appropriate branded ID type.
 *
 * @example
 * const id = createId() as PositionId;
 */
export function createId(): string {
  return crypto.randomUUID();
}
