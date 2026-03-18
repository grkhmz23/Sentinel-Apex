// =============================================================================
// Circuit breaker state management
// =============================================================================
// Models the classic electrical circuit metaphor:
//   closed    → normal; execution is allowed
//   open      → tripped; all execution is blocked
//   half_open → recovering; a single probe may pass through
//
// The registry owns the canonical state of every circuit breaker.  All state
// mutations go through the registry so there is a single source of truth.
// =============================================================================

import type { CircuitBreakerState } from '@sentinel-apex/domain';

import type { RiskLimits } from './limits.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CircuitBreakerName =
  | 'daily_drawdown'
  | 'weekly_drawdown'
  | 'portfolio_drawdown'
  | 'venue_failure'
  | 'data_staleness'
  | 'execution_failure_rate';

export interface CircuitBreaker {
  readonly name: CircuitBreakerName;
  readonly state: CircuitBreakerState;
  /** Human-readable description of the condition that would trip this breaker. */
  readonly tripCondition: string;
  /** When the breaker was most recently tripped; null if never tripped. */
  readonly trippedAt: Date | null;
  /** When the breaker is scheduled to auto-reset; null if no auto-reset. */
  readonly resetAt: Date | null;
  /**
   * How long after tripping before this breaker auto-transitions to half_open,
   * in milliseconds.  null means the breaker requires a manual reset.
   */
  readonly autoResetAfterMs: number | null;
  /** Cumulative number of times this breaker has been tripped. */
  readonly tripCount: number;
}

// ---------------------------------------------------------------------------
// Default auto-reset windows per breaker
// ---------------------------------------------------------------------------

/**
 * Returns the default auto-reset duration for each circuit breaker.
 * Daily drawdown resets at end of trading day so we use 24 h.
 * Data staleness and execution failures self-heal quickly once the
 * underlying issue is resolved.
 * Drawdown breakers at weekly/portfolio level require manual intervention.
 */
function defaultAutoResetMs(name: CircuitBreakerName): number | null {
  switch (name) {
    case 'daily_drawdown':
      return 24 * 60 * 60 * 1_000; // 24 h
    case 'weekly_drawdown':
      return null; // manual reset
    case 'portfolio_drawdown':
      return null; // manual reset
    case 'venue_failure':
      return 15 * 60 * 1_000; // 15 min
    case 'data_staleness':
      return 5 * 60 * 1_000; // 5 min
    case 'execution_failure_rate':
      return 30 * 60 * 1_000; // 30 min
  }
}

function defaultTripCondition(name: CircuitBreakerName, limits: RiskLimits): string {
  switch (name) {
    case 'daily_drawdown':
      return `Daily drawdown exceeds ${limits.maxDailyDrawdownPct}% of NAV`;
    case 'weekly_drawdown':
      return `Weekly drawdown exceeds ${limits.maxWeeklyDrawdownPct}% of NAV`;
    case 'portfolio_drawdown':
      return `Portfolio peak-to-trough drawdown exceeds ${limits.maxPortfolioDrawdownPct}% of NAV`;
    case 'venue_failure':
      return 'Venue API is returning persistent errors or is unreachable';
    case 'data_staleness':
      return `Market data is stale beyond ${limits.maxPriceAgeSec}s price or ${limits.maxFundingRateAgeSec}s funding-rate threshold`;
    case 'execution_failure_rate':
      return 'Order execution failure rate has exceeded acceptable bounds';
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class CircuitBreakerRegistry {
  private readonly breakers: Map<CircuitBreakerName, CircuitBreaker>;

  constructor(private readonly limits: RiskLimits) {
    this.breakers = new Map();

    const names: CircuitBreakerName[] = [
      'daily_drawdown',
      'weekly_drawdown',
      'portfolio_drawdown',
      'venue_failure',
      'data_staleness',
      'execution_failure_rate',
    ];

    for (const name of names) {
      this.breakers.set(name, {
        name,
        state: 'closed',
        tripCondition: defaultTripCondition(name, limits),
        trippedAt: null,
        resetAt: null,
        autoResetAfterMs: defaultAutoResetMs(name),
        tripCount: 0,
      });
    }
  }

  // ── Read accessors ──────────────────────────────────────────────────────────

  /** Returns a read-only view of all circuit breakers. */
  getAll(): ReadonlyMap<CircuitBreakerName, CircuitBreaker> {
    return this.breakers;
  }

  /**
   * Returns the current state of the named circuit breaker.
   * Throws if the name is not registered (programming error).
   */
  get(name: CircuitBreakerName): CircuitBreaker {
    const breaker = this.breakers.get(name);
    if (breaker === undefined) {
      throw new Error(`CircuitBreaker '${name}' is not registered.`);
    }
    return breaker;
  }

  /**
   * Returns true if any registered circuit breaker is in the 'open' state,
   * meaning all new order execution should be blocked immediately.
   *
   * half_open is intentionally not included: a half_open breaker allows a
   * single probe request through to test whether the underlying condition has
   * resolved.
   */
  isAnyOpen(): boolean {
    for (const breaker of this.breakers.values()) {
      if (breaker.state === 'open') {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns all breakers whose state is 'open'.
   */
  getOpenBreakers(): CircuitBreaker[] {
    return Array.from(this.breakers.values()).filter((b) => b.state === 'open');
  }

  // ── State mutations ─────────────────────────────────────────────────────────

  /**
   * Transitions the named breaker to 'open' and records the trip timestamp.
   * Idempotent: re-tripping an already-open breaker increments tripCount and
   * updates trippedAt but otherwise leaves state as 'open'.
   *
   * @param name   - the breaker to trip
   * @param reason - runtime reason (unused internally but returned in the result
   *                 so callers can log it)
   * @returns the updated CircuitBreaker snapshot
   */
  trip(name: CircuitBreakerName, reason: string): CircuitBreaker {
    const existing = this.get(name);
    const now = new Date();
    const autoResetAfterMs = existing.autoResetAfterMs;
    const resetAt = autoResetAfterMs !== null ? new Date(now.getTime() + autoResetAfterMs) : null;

    // reason is intentionally accepted but not stored on the struct itself
    // (it is the caller's responsibility to emit an event/log entry).
    // We use a void expression to prevent the "unused variable" lint warning.
    void reason;

    const updated: CircuitBreaker = {
      ...existing,
      state: 'open',
      trippedAt: now,
      resetAt,
      tripCount: existing.tripCount + 1,
    };

    this.breakers.set(name, updated);
    return updated;
  }

  /**
   * Manually resets a breaker to 'closed'.
   * Also clears trippedAt and resetAt timestamps.
   *
   * @returns the updated CircuitBreaker snapshot
   */
  reset(name: CircuitBreakerName): CircuitBreaker {
    const existing = this.get(name);

    const updated: CircuitBreaker = {
      ...existing,
      state: 'closed',
      trippedAt: null,
      resetAt: null,
    };

    this.breakers.set(name, updated);
    return updated;
  }

  /**
   * Evaluates auto-reset conditions based on `now`.
   *
   * For each open breaker with a non-null `autoResetAfterMs`:
   *   - If `now >= resetAt`, transition to 'half_open' (probe state).
   *
   * Returns the list of breakers whose state changed during this evaluation.
   */
  evaluateAutoResets(now: Date): CircuitBreaker[] {
    const changed: CircuitBreaker[] = [];

    for (const breaker of this.breakers.values()) {
      if (breaker.state !== 'open') continue;
      if (breaker.resetAt === null) continue;

      if (now.getTime() >= breaker.resetAt.getTime()) {
        const updated: CircuitBreaker = {
          ...breaker,
          state: 'half_open',
        };
        this.breakers.set(breaker.name, updated);
        changed.push(updated);
      }
    }

    return changed;
  }

  /**
   * Transitions a half_open breaker to closed after a successful probe.
   * No-op if the breaker is not in half_open state.
   *
   * @returns the updated CircuitBreaker snapshot
   */
  confirmReset(name: CircuitBreakerName): CircuitBreaker {
    const existing = this.get(name);

    if (existing.state !== 'half_open') {
      return existing;
    }

    const updated: CircuitBreaker = {
      ...existing,
      state: 'closed',
      trippedAt: null,
      resetAt: null,
    };

    this.breakers.set(name, updated);
    return updated;
  }
}
