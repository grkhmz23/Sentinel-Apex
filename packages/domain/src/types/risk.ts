// =============================================================================
// Risk domain types
// =============================================================================

import type { OpportunityId } from './opportunity.js';
import type { OrderId } from './order.js';

// ── Risk check result ─────────────────────────────────────────────────────────

export type RiskCheckStatus = 'passed' | 'failed' | 'warning';

/**
 * Result of a single risk check (e.g. notional limit, concentration limit).
 */
export interface RiskCheckResult {
  /** Human-readable name of the check, e.g. "max_notional_per_venue". */
  readonly checkName: string;
  readonly status: RiskCheckStatus;
  /** Explanation of the result, especially for failures/warnings. */
  readonly message: string;
  /**
   * The configured limit value as a decimal string.
   * May be undefined for checks without a numeric threshold.
   */
  readonly limit: string | undefined;
  /**
   * The actual observed value at check time as a decimal string.
   * May be undefined for boolean checks.
   */
  readonly actual: string | undefined;
}

// ── Risk assessment ───────────────────────────────────────────────────────────

/**
 * Aggregate result of running all risk checks for a given event.
 */
export interface RiskAssessment {
  /**
   * The opportunity being assessed, if applicable.  Exactly one of
   * opportunityId / orderId should be set.
   */
  readonly opportunityId: OpportunityId | null;
  readonly orderId: OrderId | null;
  readonly results: readonly RiskCheckResult[];
  /**
   * Rolled-up status: 'failed' if any check failed, 'warning' if any
   * check warned, 'passed' otherwise.
   */
  readonly overallStatus: RiskCheckStatus;
  readonly timestamp: Date;
}

// ── Risk breach ───────────────────────────────────────────────────────────────

export type RiskBreachSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskBreachType =
  | 'max_drawdown_exceeded'
  | 'concentration_limit_exceeded'
  | 'leverage_limit_exceeded'
  | 'liquidity_reserve_below_minimum'
  | 'venue_exposure_limit_exceeded'
  | 'daily_loss_limit_exceeded'
  | 'hedge_ratio_out_of_bounds'
  | 'circuit_breaker_triggered';

/**
 * A risk limit breach.  Persisted so operations can review and resolve.
 */
export interface RiskBreach {
  readonly id: string;
  readonly type: RiskBreachType;
  readonly severity: RiskBreachSeverity;
  readonly triggeredAt: Date;
  /** Populated once the breach is no longer active. */
  readonly resolvedAt: Date | null;
  /** Arbitrary structured detail about what caused the breach. */
  readonly details: Readonly<Record<string, unknown>>;
}

// ── Circuit breaker ───────────────────────────────────────────────────────────

/**
 * Circuit breaker states modelled after the electrical metaphor.
 *
 * closed    → normal; requests pass through
 * open      → tripped; all requests are blocked
 * half_open → recovering; a single probe request is allowed through
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';
