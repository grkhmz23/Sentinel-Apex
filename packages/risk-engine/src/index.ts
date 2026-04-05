// =============================================================================
// @sentinel-apex/risk-engine — public API
// =============================================================================

export type { RiskLimits } from './limits.js';
export { DEFAULT_RISK_LIMITS } from './limits.js';

export {
  checkGrossExposure,
  checkNetExposure,
  checkVenueConcentration,
  checkAssetConcentration,
  checkLeverage,
  checkLiquidityReserve,
  checkDrawdown,
  checkPriceStaleness,
  checkPositionSize,
} from './checks.js';

export type { CircuitBreakerName, CircuitBreaker } from './circuit-breakers.js';
export { CircuitBreakerRegistry } from './circuit-breakers.js';

export type {
  PortfolioState,
  OrderIntentContext,
  RiskSummary,
} from './engine.js';
export { RiskEngine } from './engine.js';

// Execution Guardrails (Phase R2)
export type {
  GuardrailConfig,
  GuardrailCheckInput,
  GuardrailCheckResult,
  GuardrailViolation,
  GuardrailViolationInput,
  GuardrailScope,
  ViolationType,
  PartialFillAction,
} from './execution-guardrails.js';
export {
  ExecutionGuardrailEngine,
  DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
  getExecutionGuardrailEngine,
  resetExecutionGuardrailEngine,
} from './execution-guardrails.js';
