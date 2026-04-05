# Phase R3 Part 3 Execution Integration Gap Analysis

**Date:** 2026-04-05  
**Scope:** Real Multi-Leg Runtime Execution Integration  
**Status:** Analysis Complete → Implementation Ready

---

## Executive Summary

Parts 1 and 2 established the infrastructure:
- **Part 1:** Store methods for multi-leg persistence
- **Part 2:** API/control-plane query methods

**Part 3 must now integrate multi-leg orchestration into the actual execution path.** This is the critical gap: `executeCarryAction()` currently executes orders sequentially without using the multi-leg plan system.

---

## Current Execution Flow Analysis

### 1. Entry Point: `executeCarryAction()` (runtime.ts:3581)

**Current Flow:**
```typescript
async executeCarryAction(input) {
  // 1. Load carry action
  const detail = await this.options.store.getCarryAction(input.actionId);
  
  // 2. Create execution record
  const execution = await this.options.store.createCarryExecution({...});
  
  // 3. Check venue connector blocks (live mode only)
  const currentConnectorBlocks = detail.action.executionMode === 'live'
    ? detail.plannedOrders.flatMap(...)  // venue checks
    : [];
  
  // 4. If blocks, fail execution
  if (currentConnectorBlocks.length > 0) {
    await this.options.store.updateCarryExecution(execution.id, {status: 'failed', ...});
    await this.options.store.failCarryAction({...});
    throw new Error(errorMessage);
  }
  
  // 5. Execute orders SEQUENTIALLY (NO multi-leg orchestration)
  for (const plannedOrder of detail.plannedOrders) {
    const step = await this.options.store.createCarryExecutionStep({...});
    const orderRecord = await executor.submitIntent({...});
    // If one fails, entire action fails
  }
  
  // 6. Complete execution
  await this.options.store.updateCarryExecution(execution.id, {status: 'completed', ...});
  await this.options.store.completeCarryAction({...});
}
```

**Problems:**
1. No multi-leg plan creation
2. No dependency ordering - orders execute in array order
3. No leg-level tracking (only execution steps)
4. No hedge state calculation
5. No partial failure handling
6. No guardrail enforcement (only connector blocks)

---

## Integration Points Required

### Point 1: Guardrail Enforcement (Before Execution)

**Location:** After line 3698, before the for loop

**Required Checks:**
1. Kill switch (global)
2. Max notional per action
3. Concurrency limits
4. Circuit breaker (recent failure count)
5. Partial fill policy

**Implementation:**
```typescript
// Load guardrail config
const guardrailConfig = await this.options.store.getGuardrailConfig('global', 'carry');

// Check kill switch
if (guardrailConfig?.killSwitchTriggered) {
  await this.recordGuardrailViolation(...);
  throw new Error('Execution blocked: kill switch triggered');
}

// Calculate total notional
const totalNotional = detail.plannedOrders.reduce(
  (sum, o) => sum + parseFloat(o.requestedSize) * parseFloat(o.requestedPrice ?? '0'),
  0
);

// Check notional limits
if (guardrailConfig?.maxSingleActionNotionalUsd && 
    totalNotional > parseFloat(guardrailConfig.maxSingleActionNotionalUsd)) {
  await this.recordGuardrailViolation(...);
  throw new Error('Execution blocked: notional limit exceeded');
}

// Check concurrency
const executingCount = await this.options.store.getExecutingActionCount();
if (guardrailConfig?.maxConcurrentExecutions && 
    executingCount >= guardrailConfig.maxConcurrentExecutions) {
  await this.recordGuardrailViolation(...);
  throw new Error('Execution blocked: concurrency limit exceeded');
}
```

### Point 2: Multi-Leg Plan Creation

**Location:** After successful guardrail checks, before leg execution

**Implementation:**
```typescript
// Import from carry package
const { createMultiLegPlan, calculateHedgeState } = await import('@sentinel-apex/carry');

// Build leg inputs from planned orders
const legInputs = detail.plannedOrders.map((order, index) => ({
  legType: order.side === 'long' ? 'spot' : 'perp',
  venueId: order.venueId,
  targetSize: order.requestedSize,
  targetPrice: order.requestedPrice,
  orderType: order.orderType === 'market' ? 'market' : 'limit',
  dependencies: [], // Calculate from planned order dependencies if any
  reduceOnly: order.reduceOnly,
  metadata: {
    intentId: order.intentId,
    asset: order.asset,
    side: order.side,
    plannedOrderId: order.id,
  },
}));

// Create plan
const planResult = createMultiLegPlan({
  carryActionId: detail.action.id,
  strategyRunId: detail.action.strategyRunId,
  asset: detail.action.asset,
  notionalUsd: String(totalNotional),
  legs: legInputs,
  coordinationConfig: {
    allowPartialExecution: true,
    requireAllLegsForCompletion: false,
    maxHedgeDeviationPct: 2.0,
    autoRebalanceThresholdPct: 1.0,
  },
});

if (!planResult.ok) {
  throw new Error(`Failed to create multi-leg plan: ${planResult.error.message}`);
}

const plan = planResult.value;

// Persist plan to database
const planRecord = await this.options.store.createMultiLegPlan({
  carryActionId: detail.action.id,
  strategyRunId: detail.action.strategyRunId,
  asset: detail.action.asset,
  notionalUsd: String(totalNotional),
  legCount: plan.legs.length,
  coordinationConfig: plan.coordinationConfig,
  executionOrder: plan.executionOrder,
  requestedBy: input.actorId,
});

// Persist legs
for (const leg of plan.legs) {
  await this.options.store.createLegExecution({
    planId: planRecord.id,
    carryActionId: detail.action.id,
    legSequence: leg.legSequence,
    legType: leg.legType,
    side: leg.side,
    venueId: leg.venueId,
    asset: leg.metadata.asset as string,
    targetSize: leg.targetSize,
    targetNotionalUsd: String(parseFloat(leg.targetSize) * parseFloat(leg.targetPrice ?? '0')),
    metadata: leg.metadata,
  });
}

// Update plan status to executing
await this.options.store.updateMultiLegPlanStatus(planRecord.id, { status: 'executing' });
```

### Point 3: Leg Execution with Dependency Ordering

**Location:** Replace the simple for loop (line 3745)

**Implementation:**
```typescript
// Execute legs in topological order
const legResults: Array<{
  legId: string;
  legSequence: number;
  status: string;
  filledSize: string;
  averageFillPrice: string | null;
}> = [];

let legsCompleted = 0;
let legsFailed = 0;

for (const legIndex of plan.executionOrder) {
  const leg = plan.legs[legIndex];
  const plannedOrder = detail.plannedOrders[legIndex];
  
  // Check dependencies
  if (leg.dependencies.length > 0) {
    const depsSatisfied = leg.dependencies.every((depIndex) => {
      const depResult = legResults.find((r) => r.legSequence === depIndex);
      return depResult?.status === 'completed';
    });
    if (!depsSatisfied) {
      continue; // Skip this leg, dependencies not met
    }
  }
  
  // Update leg status to executing
  const legRows = await this.options.store.getLegExecutionsForPlan(planRecord.id);
  const legRow = legRows.find((l) => l.legSequence === legIndex);
  if (legRow) {
    await this.options.store.updateLegExecutionStatus(legRow.id, { status: 'executing' });
  }
  
  try {
    // Execute the order (existing logic)
    const orderRecord = await executor.submitIntent({...});
    
    // Update leg with results
    if (legRow) {
      await this.options.store.updateLegExecutionStatus(legRow.id, {
        status: orderRecord.status === 'filled' ? 'completed' : 'failed',
        executedSize: orderRecord.filledSize,
        executedNotionalUsd: String(
          parseFloat(orderRecord.filledSize) * parseFloat(orderRecord.averageFillPrice ?? '0')
        ),
        averageFillPrice: orderRecord.averageFillPrice,
        venueExecutionReference: orderRecord.venueOrderId,
      });
    }
    
    legResults.push({
      legId: legRow?.id ?? '',
      legSequence: legIndex,
      status: orderRecord.status === 'filled' ? 'completed' : orderRecord.status,
      filledSize: orderRecord.filledSize,
      averageFillPrice: orderRecord.averageFillPrice,
    });
    
    if (orderRecord.status === 'filled') {
      legsCompleted++;
    } else {
      legsFailed++;
    }
  } catch (error) {
    // Update leg as failed
    if (legRow) {
      await this.options.store.updateLegExecutionStatus(legRow.id, {
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Leg execution failed',
      });
    }
    legsFailed++;
    
    // Handle partial failure
    const { determinePartialFailureAction } = await import('@sentinel-apex/carry');
    const handling = determinePartialFailureAction(plan, leg, legsFailed);
    
    if (handling.action === 'rollback') {
      // Attempt rollback (best effort)
      for (const rollbackLeg of handling.rollbackLegs ?? []) {
        // Execute rollback orders
      }
      break;
    } else if (handling.action === 'wait') {
      // Pause execution
      await this.options.store.updateMultiLegPlanStatus(planRecord.id, {
        status: 'pending',
        outcomeSummary: 'Waiting for operator intervention',
      });
      break;
    }
    // If 'continue', proceed with next leg
  }
  
  // Calculate and record hedge state after each leg
  const updatedLegs = await this.options.store.getLegExecutionsForPlan(planRecord.id);
  const planForHedge = {
    ...plan,
    legs: plan.legs.map((l) => {
      const updated = updatedLegs.find((ul) => ul.legSequence === l.legSequence);
      return {
        ...l,
        status: (updated?.status as LegStatus) ?? l.status,
        executedSize: updated?.executedSize ?? '0',
        executedPrice: updated?.averageFillPrice ?? null,
      };
    }),
  };
  
  const hedgeResult = calculateHedgeState(planForHedge);
  if (hedgeResult.ok) {
    const state = hedgeResult.value;
    await this.options.store.recordHedgeState({
      planId: planRecord.id,
      carryActionId: detail.action.id,
      asset: state.asset,
      spotLegId: state.spotLeg?.id ?? null,
      perpLegId: state.perpLeg?.id ?? null,
      notionalUsd: String(totalNotional),
      hedgeDeviationPct: state.deviationPct,
      imbalanceDirection: state.imbalanceDirection ?? 'balanced',
      imbalanceThresholdBreached: state.deviationPct > 2.0,
    });
  }
}
```

### Point 4: Plan Completion

**Location:** After leg execution loop, before execution completion

**Implementation:**
```typescript
// Determine final plan status
const finalStatus: 'completed' | 'failed' | 'partial' =
  legsFailed === 0 ? 'completed' :
  legsCompleted === 0 ? 'failed' : 'partial';

await this.options.store.updateMultiLegPlanStatus(planRecord.id, {
  status: finalStatus,
  outcomeSummary: `Multi-leg execution: ${legsCompleted} completed, ${legsFailed} failed`,
});

// Get final hedge state
const hedgeStates = await this.options.store.getHedgeStateForPlan(planRecord.id);
const finalHedgeDeviation = hedgeStates[0]?.hedgeDeviationPct ?? null;

// Update execution with multi-leg results
await this.options.store.updateCarryExecution(execution.id, {
  status: finalStatus === 'completed' ? 'completed' : 
          finalStatus === 'partial' ? 'partial' : 'failed',
  outcomeSummary: `Multi-leg execution: ${legsCompleted} completed, ${legsFailed} failed`,
  outcome: {
    stepCount: orderResults.length,
    orderResults,
    multiLegPlanId: planRecord.id,
    legsCompleted,
    legsFailed,
    hedgeDeviationPct: finalHedgeDeviation,
  },
});
```

---

## Worker Integration

### Current Worker Command Handling (worker.ts:558)

```typescript
if (command.commandType === 'execute_carry_action') {
  const outcome = await this.runtime.executeCarryAction({...});
  await this.store.completeRuntimeCommand(command.commandId, {
    carryActionId: outcome.actionId,
    carryExecutionId: outcome.executionId,
    orderCount: outcome.orderCount,
  });
}
```

**Required Changes:**

1. Extend outcome handling to include multi-leg fields
2. Update recovery event details

```typescript
await this.store.completeRuntimeCommand(command.commandId, {
  carryActionId: outcome.actionId,
  carryExecutionId: outcome.executionId,
  orderCount: outcome.orderCount,
  // NEW:
  multiLegPlanId: outcome.multiLegPlanId,
  legsCompleted: outcome.legsCompleted,
  legsFailed: outcome.legsFailed,
  hedgeDeviationPct: outcome.hedgeDeviationPct,
  guardrailViolations: outcome.guardrailViolations,
});
```

---

## Return Type Changes

### Current Return Type (runtime.ts:3586-3590)

```typescript
Promise<{
  actionId: string;
  executionId: string;
  orderCount: number;
}>
```

### Extended Return Type

```typescript
Promise<{
  actionId: string;
  executionId: string;
  orderCount: number;
  // Multi-leg fields (optional for backward compatibility)
  multiLegPlanId?: string;
  legsCompleted?: number;
  legsFailed?: number;
  hedgeDeviationPct?: string | null;
  guardrailViolations?: string[];
  finalStatus?: 'completed' | 'partial' | 'failed';
}>
```

---

## Implementation Plan

### Priority 1: Guardrail Enforcement (Step 4)
- Add guardrail checks at start of `executeCarryAction()`
- Record violations via `recordGuardrailViolation()`
- Block execution when guardrails fail

### Priority 2: Multi-Leg Plan Creation (Step 2)
- Create plan before leg execution
- Persist plan and legs to database
- Link plan to carry action

### Priority 3: Leg Execution with Ordering (Step 3)
- Execute legs in topological order
- Update leg status during execution
- Handle dependency checks

### Priority 4: Hedge State Recording (Step 5)
- Calculate hedge state after each leg
- Record via `recordHedgeState()`

### Priority 5: Partial Failure Handling (Step 6)
- Implement continue/rollback/wait policies
- Update plan status truthfully

### Priority 6: Worker Integration (Step 7)
- Extend command outcome handling
- Update recovery events

### Priority 7: Testing & Validation (Steps 11-13)
- Add integration tests
- Update documentation
- Validate full flow

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing execution | High | Keep changes additive; test thoroughly |
| Type mismatches | Medium | Strict typing; cast JSONB carefully |
| Performance degradation | Medium | Batch updates where possible |
| Partial failure complexity | Medium | Start with 'continue' policy only |

---

## Success Criteria

- [ ] Guardrails block execution when triggered
- [ ] Multi-leg plans created before execution
- [ ] Legs execute in dependency order
- [ ] Leg status persisted during execution
- [ ] Hedge state recorded after legs
- [ ] Partial failures handled truthfully
- [ ] Worker updates plan/leg status
- [ ] API returns real execution state
- [ ] All tests pass
- [ ] Documentation truthful about limitations
