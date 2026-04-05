# Phase R3 Part 2 Runtime Gap Analysis

**Date:** 2026-04-05  
**Scope:** Post-Part-1 State Audit + Part 2 Implementation Plan  
**Status:** Analysis Complete → Implementation Ready

---

## Executive Summary

Part 1 established the **persistence foundation** for multi-leg orchestration and guardrails. Part 2 must now wire these into the **actual runtime execution flow** so operators can see and control multi-leg execution through the API and dashboard.

**Current State:**
- ✅ Store methods exist for multi-leg plans, leg executions, hedge state, guardrails
- ❌ Runtime executes carry actions as sequential single-leg orders
- ❌ No multi-leg plan visibility in API or dashboard
- ❌ Guardrails exist in store but are NOT enforced in execution paths
- ❌ No worker command type for multi-leg execution
- ❌ No hedge state visibility for operators

---

## Part 1 Verification (What Was Actually Completed)

### 1.1 Database Exports ✅

File: `packages/db/src/index.ts`

```typescript
// Lines 11-16 - Confirmed present
carryHedgeState,
carryLegExecutions,
carryMultiLegPlans,
// ...
executionGuardrailsConfig,
executionGuardrailViolations,
```

### 1.2 Runtime Store Methods ✅

File: `packages/runtime/src/store.ts`

| Method | Line | Status | Notes |
|--------|------|--------|-------|
| `createMultiLegPlan()` | 13063 | ✅ | Persists plan with coordination config |
| `createLegExecution()` | 13097 | ✅ | Creates leg records with metadata |
| `getLegExecutionsForPlan()` | 13138 | ✅ | Retrieves legs by plan ID |
| `updateLegExecutionStatus()` | 13168 | ✅ | Updates status, fills, errors |
| `updateMultiLegPlanStatus()` | 13218 | ✅ | Updates plan status with timestamps |
| `recordHedgeState()` | 13232 | ✅ | Records hedge deviation calculations |
| `getHedgeStateForPlan()` | 13271 | ✅ | Retrieves hedge state history |
| `getExecutingActionCount()` | 13297 | ✅ | For concurrency limit checks |
| `getGuardrailConfig()` | 13304 | ✅ | Loads guardrail configuration |
| `recordGuardrailViolation()` | 13343 | ✅ | Records violations for audit |
| `triggerKillSwitch()` | 13367 | ✅ | Emergency halt with audit |
| `resetKillSwitch()` | 13400 | ✅ | Resume after kill switch |

### 1.3 Multi-Leg Orchestration Package ✅

File: `packages/carry/src/multi-leg-orchestration.ts`

- 82 tests passing
- Functions: `createMultiLegPlan()`, `calculateHedgeState()`, `handlePartialFailure()`, `updatePlanStatus()`
- Types: `MultiLegPlan`, `LegExecution`, `HedgeState`, `PartialFailureHandling`

### 1.4 Execution Guardrails Package ✅

File: `packages/risk-engine/src/execution-guardrails.ts`

- 146 tests passing
- `ExecutionGuardrailEngine` class with `check()`, `triggerKillSwitch()`, `resetKillSwitch()`
- Config scopes: global, venue, sleeve, action

---

## Gap Analysis: What's Missing for Runtime Integration

### Gap 1: No Multi-Leg Execution in Runtime

**Current Flow (Single-Leg Sequential):**
```typescript
// packages/runtime/src/runtime.ts:3745-3913
async executeCarryAction(input) {
  // ... validation ...
  
  for (const plannedOrder of detail.plannedOrders) {
    // Execute each order sequentially
    const orderRecord = await executor.submitIntent({...});
    // If one fails, entire action fails
  }
}
```

**Missing:**
- No multi-leg plan creation before execution
- No dependency ordering/topological sort
- No leg-level execution records
- No hedge state tracking during execution
- No partial failure handling (continue/rollback/wait)

### Gap 2: No Guardrail Enforcement

**Current State:** Guardrails exist in store and package but are NOT checked during execution.

**Missing:**
- No guardrail config lookup at execution start
- No kill-switch check before executing
- No circuit breaker tracking
- No notional limit enforcement
- No concurrency limit checks
- No partial-fill policy enforcement
- No violation recording in execution path

### Gap 3: No Worker Command for Multi-Leg

**Current Worker Commands:**
```typescript
// packages/runtime/src/worker.ts:558-616
if (command.commandType === 'execute_carry_action') {
  const outcome = await this.runtime.executeCarryAction({...});
  // Returns { actionId, executionId, orderCount }
  // No multi-leg plan ID, no leg details
}
```

**Missing:**
- No `execute_multi_leg_carry_action` command type
- No plan status updates during worker execution
- No leg-level status tracking in worker

### Gap 4: No API Routes for Multi-Leg Visibility

**Current Carry API Routes:** `/api/v1/carry/...`
- GET `/strategy-profile`
- GET `/recommendations`
- GET `/actions`
- GET `/actions/:actionId`
- GET `/actions/:actionId/executions`
- GET `/executions`
- GET `/executions/:executionId`
- GET `/venues`
- POST `/evaluate`
- POST `/actions/:actionId/approve`

**Missing:**
- GET `/multi-leg-plans`
- GET `/multi-leg-plans/:planId`
- GET `/multi-leg-plans/:planId/legs`
- GET `/multi-leg-plans/:planId/hedge-state`
- GET `/guardrail-config`
- GET `/guardrail-violations`

### Gap 5: No Dashboard Pages for Multi-Leg

**Current Carry Dashboard:**
- `apps/ops-dashboard/app/carry/page.tsx` - Overview
- `apps/ops-dashboard/app/carry/actions/[actionId]/` - Action detail
- `apps/ops-dashboard/app/carry/executions/[executionId]/` - Execution detail

**Missing:**
- Multi-leg plan detail page
- Leg-by-leg execution table
- Hedge deviation visualization
- Guardrail status widget
- Partial failure/rollback/wait state display

### Gap 6: No Control Plane Methods

**Current Control Plane:** `packages/runtime/src/control-plane.ts`

Carry methods:
- `listCarryActions()`
- `getCarryAction()`
- `listCarryExecutionsForAction()`
- `approveCarryAction()` - enqueues `execute_carry_action`

**Missing:**
- `getMultiLegPlan()`
- `listMultiLegPlansForAction()`
- `getLegExecutionsForPlan()`
- `getHedgeStateForPlan()`
- `getGuardrailConfig()`
- `listGuardrailViolations()`

---

## Implementation Plan: Phase R3 Part 2

### Priority 1: Runtime Integration (Core)

#### 1.1 Modify `executeCarryAction` for Multi-Leg

**File:** `packages/runtime/src/runtime.ts`

**Changes:**
1. Add optional `useMultiLegOrchestration` flag (default true for new actions)
2. Before execution, create multi-leg plan using `createMultiLegPlan()`
3. Create leg execution records using `createLegExecution()`
4. Execute legs in topological order (respecting dependencies)
5. Update leg status after each execution
6. Calculate and record hedge state after each leg
7. Handle partial failures according to coordination config
8. Update plan status on completion/partial/failure

**Return Value Extension:**
```typescript
{
  actionId: string;
  executionId: string;
  orderCount: number;
  // NEW:
  planId?: string;
  legsCompleted?: number;
  legsFailed?: number;
  hedgeDeviationPct?: number;
  partialFailureAction?: 'continue' | 'rollback' | 'wait';
}
```

#### 1.2 Add Guardrail Enforcement

**Integration Point:** At start of `executeCarryAction()`

**Logic:**
1. Load guardrail config via `getGuardrailConfig('global', 'carry')`
2. Check kill switch - fail fast if triggered
3. Calculate total notional from planned orders
4. Check notional limits
5. Check concurrency limits via `getExecutingActionCount()`
6. Check circuit breaker (track recent failures)
7. Record any violations via `recordGuardrailViolation()`
8. Block execution if guardrails reject

### Priority 2: Worker Integration

#### 2.1 Extend Worker Command Handling

**File:** `packages/runtime/src/worker.ts`

**Changes:**
- No new command type needed - extend existing `execute_carry_action`
- Update outcome handling to include multi-leg fields
- Add recovery event details for leg-level failures

#### 2.2 Update Command Completion

**Current:**
```typescript
await this.store.completeRuntimeCommand(command.commandId, {
  carryActionId: outcome.actionId,
  carryExecutionId: outcome.executionId,
  orderCount: outcome.orderCount,
});
```

**Extended:**
```typescript
await this.store.completeRuntimeCommand(command.commandId, {
  carryActionId: outcome.actionId,
  carryExecutionId: outcome.executionId,
  orderCount: outcome.orderCount,
  multiLegPlanId: outcome.planId,
  legsCompleted: outcome.legsCompleted,
  legsFailed: outcome.legsFailed,
  hedgeDeviationPct: outcome.hedgeDeviationPct,
  guardrailViolations: outcome.guardrailViolations,
});
```

### Priority 3: Control Plane Queries

**File:** `packages/runtime/src/control-plane.ts`

**New Methods:**
```typescript
async getMultiLegPlan(planId: string): Promise<MultiLegPlanView | null>
async listMultiLegPlansForAction(actionId: string): Promise<MultiLegPlanSummaryView[]>
async getLegExecutionsForPlan(planId: string): Promise<LegExecutionView[]>
async getHedgeStateForPlan(planId: string): Promise<HedgeStateView[]>
async getGuardrailConfigSummary(): Promise<GuardrailConfigSummaryView>
async listGuardrailViolations(limit: number): Promise<GuardrailViolationView[]>
```

### Priority 4: API Routes

**File:** `apps/api/src/routes/carry.ts`

**New Routes:**
```typescript
// Multi-leg plans
app.get('/api/v1/carry/multi-leg-plans', ...)
app.get('/api/v1/carry/multi-leg-plans/:planId', ...)
app.get('/api/v1/carry/multi-leg-plans/:planId/legs', ...)
app.get('/api/v1/carry/multi-leg-plans/:planId/hedge-state', ...)

// Guardrails
app.get('/api/v1/carry/guardrail-config', ...)
app.get('/api/v1/carry/guardrail-violations', ...)

// Action executions now include multi-leg info
// (extend existing /actions/:actionId/executions)
```

### Priority 5: Dashboard Pages

**New Files:**
- `apps/ops-dashboard/app/carry/multi-leg-plans/[planId]/page.tsx`
- `apps/ops-dashboard/src/components/carry/LegExecutionsTable.tsx`
- `apps/ops-dashboard/src/components/carry/HedgeStatePanel.tsx`
- `apps/ops-dashboard/src/components/carry/GuardrailStatus.tsx`

**Modified Files:**
- `apps/ops-dashboard/app/carry/actions/[actionId]/page.tsx` - Add link to multi-leg plan
- `apps/ops-dashboard/app/carry/executions/[executionId]/page.tsx` - Show leg breakdown

### Priority 6: Types and Views

**File:** `packages/runtime/src/types.ts`

**New Types:**
```typescript
export interface MultiLegPlanView {
  id: string;
  carryActionId: string;
  asset: string;
  notionalUsd: string;
  legCount: number;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'partial';
  executionOrder: number[];
  coordinationConfig: {
    allowPartialExecution: boolean;
    requireAllLegsForCompletion: boolean;
    maxHedgeDeviationPct: number;
  };
  startedAt: string | null;
  completedAt: string | null;
  legsCompleted: number;
  legsFailed: number;
  hedgeDeviationPct: string | null;
}

export interface LegExecutionView {
  id: string;
  planId: string;
  legSequence: number;
  legType: 'spot' | 'perp' | 'hedge' | 'rebalance' | 'settlement';
  venueId: string;
  asset: string;
  side: 'long' | 'short';
  targetSize: string;
  targetNotionalUsd: string;
  executedSize: string | null;
  executedNotionalUsd: string | null;
  averageFillPrice: string | null;
  status: string;
  dependencies: number[];
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface HedgeStateView {
  id: string;
  planId: string;
  asset: string;
  hedgeDeviationPct: string;
  imbalanceDirection: 'spot_heavy' | 'perp_heavy' | 'balanced';
  imbalanceThresholdBreached: boolean;
  status: string;
  createdAt: string;
}

export interface GuardrailConfigSummaryView {
  global: {
    killSwitchEnabled: boolean;
    killSwitchTriggered: boolean;
    maxSingleActionNotionalUsd: string | null;
    maxConcurrentExecutions: number | null;
  };
  totalViolations24h: number;
  lastViolationAt: string | null;
}

export interface GuardrailViolationView {
  id: string;
  violationType: string;
  violationMessage: string;
  carryActionId: string | null;
  planId: string | null;
  attemptedNotionalUsd: string | null;
  limitNotionalUsd: string | null;
  blocked: boolean;
  createdAt: string;
}
```

---

## Critical Design Decisions

### 1. Backward Compatibility

- New multi-leg fields in return types are optional
- Existing `execute_carry_action` command continues to work
- Dashboard gracefully handles missing multi-leg data

### 2. Atomicity vs Coordinated Sequencing

**Truth:** Multi-leg execution is **coordinated sequencing**, not atomic.
- Each leg executes independently
- Partial fills are handled per-leg
- Rollback is best-effort (may not fully unwind)

**Documentation:** Must be explicit about this in runbooks.

### 3. Guardrail Enforcement Points

1. **Before execution:** Kill switch, notional limits, concurrency
2. **During execution:** Circuit breaker (between legs)
3. **Per-leg:** Partial-fill policy

### 4. Failure Handling

**Continue:** Execute remaining legs despite failure
**Rollback:** Attempt to unwind completed legs (best effort)
**Wait:** Pause execution pending operator intervention

---

## Testing Strategy

### Unit Tests
- Guardrail enforcement logic
- Multi-leg plan creation
- Leg status transitions
- Hedge state calculations

### Integration Tests
- End-to-end multi-leg execution
- Guardrail blocking scenarios
- Partial failure handling
- Worker command flow

### Manual Verification
- Dashboard drill-through
- API response formats
- Error message clarity

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complex type alignment | High | Incremental implementation, strict typing |
| Performance degradation | Medium | Batch leg updates, efficient queries |
| Operator confusion | Medium | Clear docs, explicit status messages |
| Rollback failures | Medium | Document best-effort nature |

---

## Success Criteria

- [ ] `executeCarryAction` creates and persists multi-leg plans
- [ ] Legs execute in dependency order
- [ ] Hedge state tracked and visible
- [ ] Guardrails block execution when triggered
- [ ] Partial failures handled according to policy
- [ ] API exposes multi-leg plans and legs
- [ ] Dashboard shows leg-by-leg execution
- [ ] All changes have test coverage
- [ ] Build passes with no TypeScript errors
- [ ] Documentation is truthful about limitations

---

## Part 2 Completion Definition

**Done When:**
1. Multi-leg orchestration is executed through real runtime/worker flow
2. Guardrails are enforced in execution paths
3. Leg-level execution is operator-visible through API and dashboard
4. Partial failure states are truthful and durable
5. Docs explain what's wired vs what remains blocked
