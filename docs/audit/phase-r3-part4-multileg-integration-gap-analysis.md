# Phase R3 Part 4 Multi-Leg Integration Gap Analysis

**Date:** 2026-04-05  
**Scope:** Complete Multi-Leg Runtime Execution Integration  
**Status:** Analysis Complete → Implementation Ready

---

## Executive Summary

Part 3 deferred multi-leg integration due to type mismatches. This analysis identifies the exact boundaries and proposes a clean adapter layer solution.

**Core Issue:** The `packages/carry` orchestration types use `Decimal` (from decimal.js) and specific shapes that don't align with runtime's string-based inputs.

**Solution:** Create a clean adapter layer that translates runtime inputs to carry orchestration inputs with proper type conversions.

---

## Exact Type Mismatches

### 1. LegDefinition Mismatches

**Carry Package (packages/carry/src/multi-leg-orchestration.ts:54-64):**
```typescript
export interface LegDefinition {
  legSequence: number;
  legType: 'spot' | 'perp' | 'futures';
  side: 'long' | 'short';
  venueId: string;
  asset: string;
  marketSymbol?: string | undefined;
  targetSize: Decimal;          // <-- Decimal, not string
  targetNotionalUsd: Decimal;   // <-- Decimal, not string
  dependsOn?: number;
}
```

**Runtime Has (from planned orders):**
- `requestedSize: string` - needs Decimal conversion
- `requestedPrice: string | null` - needs Decimal conversion for notional
- `side: 'buy' | 'sell'` - needs conversion to 'long' | 'short'

### 2. MultiLegPlanInput Mismatches

**Carry Package:**
```typescript
export interface MultiLegPlanInput {
  carryActionId: string;
  strategyRunId?: string;
  asset: string;
  notionalUsd: Decimal;         // <-- Decimal
  legs: LegDefinition[];
  coordinationConfig: SpotPerpCoordinationConfig;
  maxHedgeDeviationPct: Decimal; // <-- Decimal
}
```

**Runtime Has:**
- `notionalUsd: string` - needs Decimal conversion
- No `maxHedgeDeviationPct` - needs default

### 3. SpotPerpCoordinationConfig Mismatches

**Carry Package:**
```typescript
export interface SpotPerpCoordinationConfig {
  maxHedgeDeviationPct: number;  // <-- number, not Decimal
  perpFirst: boolean;
  executionTimeoutMs: number;
  minimumSizeIncrement: string;
}
```

**Previous Attempt Used:**
```typescript
// WRONG - these properties don't exist on SpotPerpCoordinationConfig
coordinationConfig: {
  allowPartialExecution: true,        // NOT IN INTERFACE
  requireAllLegsForCompletion: false, // NOT IN INTERFACE
  maxHedgeDeviationPct: 2.0,          // OK - matches
  autoRebalanceThresholdPct: 1.0,     // NOT IN INTERFACE
}
```

### 4. Side Conversion Mismatch

**Runtime plannedOrder.side:** `'buy' | 'sell'`
**Carry LegDefinition.side:** `'long' | 'short'`

**Conversion Logic:**
- buy → long (spot leg)
- sell → short (perp leg)
- For delta-neutral: one buy (spot long) + one sell (perp short)

---

## Clean Adapter Strategy

### Adapter Layer Location
`packages/runtime/src/adapters/carry-orchestration-adapter.ts`

### Adapter Functions

```typescript
// Convert runtime planned order to carry leg definition
function toLegDefinition(
  plannedOrder: CarryActionPlannedOrderView,
  legSequence: number,
  legType: 'spot' | 'perp'
): LegDefinition {
  return {
    legSequence,
    legType,
    side: legType === 'spot' ? 'long' : 'short',
    venueId: plannedOrder.venueId,
    asset: plannedOrder.asset,
    targetSize: new Decimal(plannedOrder.requestedSize),
    targetNotionalUsd: new Decimal(
      plannedOrder.requestedSize
    ).mul(
      new Decimal(plannedOrder.requestedPrice ?? '0')
    ),
  };
}

// Create coordination config
function createCoordinationConfig(): SpotPerpCoordinationConfig {
  return {
    maxHedgeDeviationPct: 2.0,
    perpFirst: true,
    executionTimeoutMs: 30000,
    minimumSizeIncrement: '0.0001',
  };
}
```

---

## Integration Point

### Where to Hook in executeCarryAction

**Current Flow:**
1. Guardrail checks (✅ Part 3)
2. Sequential order execution

**New Flow:**
1. Guardrail checks (✅ Part 3)
2. **NEW:** Create multi-leg plan (via adapter)
3. **NEW:** Persist plan and legs
4. **NEW:** Execute legs in order
5. **NEW:** Record hedge state after each leg
6. Complete execution

---

## Minimal Truthful Scope

### Supported: Delta-Neutral Spot+Perp

**Why this scope:**
1. Clean 2-leg structure
2. Well-understood hedge relationship
3. Devnet-safe with simulated venues
4. Uses existing planned order structure

**Not Supported (honest):**
- Complex multi-leg with >2 legs
- True atomic execution (only coordinated sequencing)
- Automatic rollback (only manual retry)

---

## Implementation Plan

### Step 1: Create Adapter Module
- Create `packages/runtime/src/adapters/carry-orchestration-adapter.ts`
- Implement type conversion functions
- Add unit tests

### Step 2: Integrate into executeCarryAction
- Create multi-leg plan via adapter
- Persist plan and legs
- Execute in dependency order
- Record hedge state

### Step 3: Worker Integration
- Update worker to handle multi-leg outcomes
- Persist leg statuses

### Step 4: Testing & Validation
- Unit tests for adapter
- Integration tests for full flow
- Build verification

---

## Files to Modify

1. **NEW:** `packages/runtime/src/adapters/carry-orchestration-adapter.ts`
2. **MODIFY:** `packages/runtime/src/runtime.ts` - integrate adapter
3. **MODIFY:** `packages/runtime/src/worker.ts` - handle outcomes
4. **NEW:** Tests for adapter

---

## Success Criteria

- [ ] Adapter layer cleanly separates runtime/carry types
- [ ] Multi-leg plan created in real execution path
- [ ] Legs execute in dependency order
- [ ] Leg statuses persisted truthfully
- [ ] Hedge state recorded during execution
- [ ] All builds pass
- [ ] Tests added for adapter
