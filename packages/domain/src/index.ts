// =============================================================================
// @sentinel-apex/domain — public API
// =============================================================================

// Branded type utilities
export { brand, createId } from './branded.js';
export type { Brand } from './branded.js';

// Business invariants
export {
  InvariantError,
  assertPositiveSize,
  assertValidAllocationPct,
  assertHedgeStateConsistent,
  assertNoNegativeNav,
} from './invariants.js';

// All domain types and event factories
export * from './types/index.js';
