// =============================================================================
// circuit-breakers.test.ts — unit tests for CircuitBreakerRegistry
// =============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import { CircuitBreakerRegistry } from '../circuit-breakers.js';
import { DEFAULT_RISK_LIMITS } from '../limits.js';

import type { CircuitBreakerName } from '../circuit-breakers.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRegistry(): CircuitBreakerRegistry {
  return new CircuitBreakerRegistry(DEFAULT_RISK_LIMITS);
}

const ALL_BREAKERS: CircuitBreakerName[] = [
  'daily_drawdown',
  'weekly_drawdown',
  'portfolio_drawdown',
  'venue_failure',
  'data_staleness',
  'execution_failure_rate',
];

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('CircuitBreakerRegistry — initial state', () => {
  it('all breakers start in closed state', () => {
    const registry = makeRegistry();
    for (const name of ALL_BREAKERS) {
      expect(registry.get(name).state).toBe('closed');
    }
  });

  it('all breakers start with tripCount = 0', () => {
    const registry = makeRegistry();
    for (const name of ALL_BREAKERS) {
      expect(registry.get(name).tripCount).toBe(0);
    }
  });

  it('all breakers start with trippedAt = null', () => {
    const registry = makeRegistry();
    for (const name of ALL_BREAKERS) {
      expect(registry.get(name).trippedAt).toBeNull();
    }
  });

  it('isAnyOpen() returns false when all breakers are closed', () => {
    const registry = makeRegistry();
    expect(registry.isAnyOpen()).toBe(false);
  });

  it('getAll() returns a map with all 6 breakers', () => {
    const registry = makeRegistry();
    expect(registry.getAll().size).toBe(6);
  });

  it('each breaker has a non-empty tripCondition', () => {
    const registry = makeRegistry();
    for (const name of ALL_BREAKERS) {
      expect(registry.get(name).tripCondition).toBeTruthy();
      expect(registry.get(name).tripCondition.length).toBeGreaterThan(0);
    }
  });

  it('daily_drawdown has autoResetAfterMs set (auto-reset enabled)', () => {
    const registry = makeRegistry();
    expect(registry.get('daily_drawdown').autoResetAfterMs).not.toBeNull();
  });

  it('portfolio_drawdown has autoResetAfterMs = null (manual reset only)', () => {
    const registry = makeRegistry();
    expect(registry.get('portfolio_drawdown').autoResetAfterMs).toBeNull();
  });

  it('weekly_drawdown has autoResetAfterMs = null (manual reset only)', () => {
    const registry = makeRegistry();
    expect(registry.get('weekly_drawdown').autoResetAfterMs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tripping a breaker
// ---------------------------------------------------------------------------

describe('CircuitBreakerRegistry — trip()', () => {
  let registry: CircuitBreakerRegistry;
  beforeEach(() => {
    registry = makeRegistry();
  });

  it('transitions a closed breaker to open', () => {
    const result = registry.trip('daily_drawdown', 'drawdown exceeded');
    expect(result.state).toBe('open');
    expect(registry.get('daily_drawdown').state).toBe('open');
  });

  it('sets trippedAt to current time', () => {
    const before = new Date();
    registry.trip('daily_drawdown', 'reason');
    const after = new Date();
    const trippedAt = registry.get('daily_drawdown').trippedAt;
    expect(trippedAt).not.toBeNull();
    expect(trippedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(trippedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('increments tripCount from 0 to 1', () => {
    registry.trip('daily_drawdown', 'first trip');
    expect(registry.get('daily_drawdown').tripCount).toBe(1);
  });

  it('increments tripCount on repeated trips', () => {
    registry.trip('daily_drawdown', 'trip 1');
    registry.trip('daily_drawdown', 'trip 2');
    expect(registry.get('daily_drawdown').tripCount).toBe(2);
  });

  it('sets resetAt when autoResetAfterMs is defined', () => {
    registry.trip('daily_drawdown', 'test');
    const breaker = registry.get('daily_drawdown');
    expect(breaker.resetAt).not.toBeNull();
    const expectedWindow = breaker.autoResetAfterMs!;
    const diff = breaker.resetAt!.getTime() - breaker.trippedAt!.getTime();
    expect(diff).toBe(expectedWindow);
  });

  it('leaves resetAt as null for manual-reset-only breakers', () => {
    registry.trip('portfolio_drawdown', 'portfolio blowup');
    expect(registry.get('portfolio_drawdown').resetAt).toBeNull();
  });

  it('isAnyOpen() returns true after tripping any breaker', () => {
    registry.trip('data_staleness', 'feed down');
    expect(registry.isAnyOpen()).toBe(true);
  });

  it('does not affect other breakers', () => {
    registry.trip('venue_failure', 'venue A down');
    for (const name of ALL_BREAKERS) {
      if (name !== 'venue_failure') {
        expect(registry.get(name).state).toBe('closed');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Auto-reset (evaluateAutoResets)
// ---------------------------------------------------------------------------

describe('CircuitBreakerRegistry — evaluateAutoResets()', () => {
  let registry: CircuitBreakerRegistry;
  beforeEach(() => {
    registry = makeRegistry();
  });

  it('returns empty array when no breakers are open', () => {
    const changed = registry.evaluateAutoResets(new Date());
    expect(changed).toHaveLength(0);
  });

  it('does not auto-reset before the reset time', () => {
    registry.trip('data_staleness', 'stale feed');
    const tripTime = registry.get('data_staleness').trippedAt!;
    const tooEarly = new Date(tripTime.getTime() + 60_000); // only 1 min later, reset is 5 min
    const changed = registry.evaluateAutoResets(tooEarly);
    expect(changed).toHaveLength(0);
    expect(registry.get('data_staleness').state).toBe('open');
  });

  it('transitions to half_open at the reset time', () => {
    registry.trip('data_staleness', 'stale feed');
    const resetAt = registry.get('data_staleness').resetAt!;
    const changed = registry.evaluateAutoResets(resetAt);
    expect(changed).toHaveLength(1);
    expect(changed[0]?.name).toBe('data_staleness');
    expect(changed[0]?.state).toBe('half_open');
    expect(registry.get('data_staleness').state).toBe('half_open');
  });

  it('transitions to half_open after the reset time (past resetAt)', () => {
    registry.trip('data_staleness', 'feed dead');
    const resetAt = registry.get('data_staleness').resetAt!;
    const wellAfter = new Date(resetAt.getTime() + 60_000);
    registry.evaluateAutoResets(wellAfter);
    expect(registry.get('data_staleness').state).toBe('half_open');
  });

  it('does NOT auto-reset a manual-only breaker even after a long time', () => {
    registry.trip('portfolio_drawdown', 'catastrophic loss');
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000);
    const changed = registry.evaluateAutoResets(farFuture);
    expect(changed).toHaveLength(0);
    expect(registry.get('portfolio_drawdown').state).toBe('open');
  });

  it('can auto-reset multiple breakers at once', () => {
    registry.trip('data_staleness', 'feed down');
    registry.trip('venue_failure', 'venue unreachable');

    // Both have auto-reset; push time well past both reset windows
    const farFuture = new Date(Date.now() + 60 * 60 * 1_000); // 1 hour later
    const changed = registry.evaluateAutoResets(farFuture);
    expect(changed.length).toBeGreaterThanOrEqual(2);
    expect(registry.get('data_staleness').state).toBe('half_open');
    expect(registry.get('venue_failure').state).toBe('half_open');
  });

  it('isAnyOpen() returns false after both open breakers auto-reset to half_open', () => {
    registry.trip('data_staleness', 'stale');
    const farFuture = new Date(Date.now() + 60 * 60 * 1_000);
    registry.evaluateAutoResets(farFuture);
    // half_open is not 'open', so isAnyOpen should be false
    expect(registry.isAnyOpen()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Manual reset
// ---------------------------------------------------------------------------

describe('CircuitBreakerRegistry — reset()', () => {
  let registry: CircuitBreakerRegistry;
  beforeEach(() => {
    registry = makeRegistry();
  });

  it('resets an open breaker to closed', () => {
    registry.trip('portfolio_drawdown', 'drawdown');
    registry.reset('portfolio_drawdown');
    expect(registry.get('portfolio_drawdown').state).toBe('closed');
  });

  it('clears trippedAt after reset', () => {
    registry.trip('portfolio_drawdown', 'drawdown');
    registry.reset('portfolio_drawdown');
    expect(registry.get('portfolio_drawdown').trippedAt).toBeNull();
  });

  it('clears resetAt after reset', () => {
    registry.trip('daily_drawdown', 'daily loss');
    registry.reset('daily_drawdown');
    expect(registry.get('daily_drawdown').resetAt).toBeNull();
  });

  it('preserves tripCount after reset', () => {
    registry.trip('daily_drawdown', 'trip');
    registry.reset('daily_drawdown');
    // tripCount is a historical count — not cleared on reset
    expect(registry.get('daily_drawdown').tripCount).toBe(1);
  });

  it('isAnyOpen() returns false after all open breakers are reset', () => {
    registry.trip('venue_failure', 'venue down');
    registry.trip('data_staleness', 'feed down');
    registry.reset('venue_failure');
    registry.reset('data_staleness');
    expect(registry.isAnyOpen()).toBe(false);
  });

  it('resetting a closed breaker is a no-op (stays closed)', () => {
    const before = registry.get('daily_drawdown');
    registry.reset('daily_drawdown');
    expect(registry.get('daily_drawdown').state).toBe('closed');
    expect(registry.get('daily_drawdown').tripCount).toBe(before.tripCount);
  });
});

// ---------------------------------------------------------------------------
// confirmReset (half_open → closed)
// ---------------------------------------------------------------------------

describe('CircuitBreakerRegistry — confirmReset()', () => {
  it('transitions a half_open breaker to closed', () => {
    const registry = makeRegistry();
    registry.trip('data_staleness', 'stale');
    const farFuture = new Date(Date.now() + 60 * 60 * 1_000);
    registry.evaluateAutoResets(farFuture); // → half_open
    registry.confirmReset('data_staleness'); // → closed
    expect(registry.get('data_staleness').state).toBe('closed');
  });

  it('is a no-op when breaker is not in half_open state', () => {
    const registry = makeRegistry();
    // closed breaker — should stay closed
    const before = registry.get('daily_drawdown');
    registry.confirmReset('daily_drawdown');
    expect(registry.get('daily_drawdown').state).toBe('closed');
    expect(registry.get('daily_drawdown').tripCount).toBe(before.tripCount);
  });
});

// ---------------------------------------------------------------------------
// Edge: unknown breaker name
// ---------------------------------------------------------------------------

describe('CircuitBreakerRegistry — error handling', () => {
  it('get() throws when breaker name is not registered', () => {
    const registry = makeRegistry();
    expect(() => registry.get('nonexistent' as CircuitBreakerName)).toThrow();
  });
});
