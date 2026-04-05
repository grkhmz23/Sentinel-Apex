# Phase R2 — Execution Guardrails

**Date**: 2026-04-05  
**Status**: Complete  
**Scope**: Execution safety controls for hackathon/devnet execution

## Overview

Execution guardrails provide backend-enforced safety controls for the real execution-capable connector path. They ensure that:

1. **Kill switch** can halt all execution immediately
2. **Circuit breakers** trip after repeated failures
3. **Notional limits** prevent oversized executions
4. **Partial fill policies** define how to handle incomplete orders
5. **Concurrency limits** prevent overload

## Implementation

### Location
- **Code**: `packages/risk-engine/src/execution-guardrails.ts`
- **Tests**: `packages/risk-engine/src/__tests__/execution-guardrails.test.ts`

### Key Components

#### 1. ExecutionGuardrailEngine

Central engine for checking and enforcing guardrails:

```typescript
const engine = getExecutionGuardrailEngine();

// Check if execution is allowed
const result = engine.check({
  notionalUsd: new Decimal(50000),
  venueId: 'drift-devnet',
  isExecution: true,
});

if (!result.allowed) {
  console.log('Blocked:', result.violations);
}
```

#### 2. Guardrail Configuration

Scoped configurations (global, venue, sleeve, strategy):

```typescript
// Default global limits
const DEFAULT_GLOBAL_GUARDRAIL_CONFIG = {
  maxSingleActionNotionalUsd: new Decimal(100000),  // $100k
  maxDailyNotionalUsd: new Decimal(500000),         // $500k
  minActionNotionalUsd: new Decimal(1000),          // $1k
  maxConcurrentExecutions: 3,
  circuitBreakerEnabled: true,
  maxFailuresBeforeBreaker: 3,
  killSwitchEnabled: true,
  partialFillAction: 'continue',
  minFillPctRequired: new Decimal(95),
};
```

#### 3. Kill Switch

Emergency halt mechanism:

```typescript
// Trigger kill switch
engine.triggerKillSwitch(
  configId,
  'operator_name',
  'Emergency: market volatility spike'
);

// Reset kill switch
engine.resetKillSwitch(configId, 'admin_name');
```

#### 4. Circuit Breaker

Automatic halt after failures:

```typescript
// Record failure
engine.recordFailure(configId);

// Circuit breaker opens after maxFailuresBeforeBreaker
// Resets after circuitBreakerResetMinutes
```

#### 5. Partial Fill Handling

Policies for incomplete fills:

```typescript
const result = engine.checkPartialFill(
  configId,
  targetSize,    // 100
  filledSize     // 96
);

// Returns: { action: 'continue' | 'block' | 'rollback', reason? }
```

## Default Limits

| Limit | Value | Rationale |
|-------|-------|-----------|
| Max single action | $100,000 | Prevents oversized individual trades |
| Max daily | $500,000 | Limits daily exposure |
| Max position | $1,000,000 | Portfolio-level cap |
| Min action | $1,000 | Filters out dust trades |
| Max concurrent | 3 executions | Prevents overload |
| Circuit breaker | 3 failures | Tolerance for transient issues |
| Partial fill min | 95% | Quality threshold |

## Integration Points

### With Runtime
- Runtime checks guardrails before executing carry actions
- Records success/failure for circuit breaker
- Respects kill switch state

### With API
- `/api/v1/control/kill-switch` - Trigger/reset
- `/api/v1/carry/actions` - Guardrail checks before approval

### With Dashboard
- Display current guardrail status
- Show active violations
- Allow authorized kill switch trigger

## Database Schema

New tables:
- `execution_guardrails_config` - Configuration storage
- `execution_guardrail_violations` - Violation log

See migration `0027_multi_leg_orchestration.sql`.

## Usage in Devnet Demo

```bash
# Configure devnet-specific limits
export DRIFT_DEVNET_MAX_NOTIONAL=50000  # Lower limit for devnet

# Kill switch is available via API
POST /api/v1/control/kill-switch
{
  "reason": "Demo complete",
  "triggeredBy": "operator"
}
```

## Safety Principles

1. **Fail closed** - When in doubt, block execution
2. **Explicit override** - Violations can be overridden with audit trail
3. **Scoped limits** - Different limits for different venues/strategies
4. **Audit everything** - All violations and overrides logged
5. **Fast kill** - Kill switch stops execution immediately

## Testing

146 tests covering:
- Notional limit enforcement
- Kill switch trigger/reset
- Circuit breaker behavior
- Partial fill policies
- Daily tracking
- Config scoping

Run tests:
```bash
pnpm --filter @sentinel-apex/risk-engine test
```
