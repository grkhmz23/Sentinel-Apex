// =============================================================================
// Sentinel Apex — Shared Package Public API
// =============================================================================

export type { DecimalValue } from './decimal.js';
export {
  ZERO,
  ONE,
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
} from './decimal.js';

export type { Result } from './result.js';
export {
  Ok,
  Err,
  isOk,
  isErr,
  mapResult,
  flatMapResult,
  asyncResult,
} from './result.js';

export {
  nowIso,
  nowMs,
  toIso,
  fromIso,
  addSeconds,
  diffMs,
  isStale,
  sleep,
} from './time.js';

export {
  isNonEmptyString,
  isPositiveNumber,
  assertDefined,
  clamp,
} from './validation.js';

export type { RetryOptions } from './retry.js';
export { retry } from './retry.js';

export type {
  OpsOperatorRole,
  SignedOperatorContext,
  SignedOperatorHeaders,
} from './ops-auth.js';
export {
  canAssumeRole,
  createSignedOperatorHeaders,
  isOpsOperatorRole,
  OpsAuthError,
  OPS_OPERATOR_ROLES,
  verifySignedOperatorHeaders,
} from './ops-auth.js';
