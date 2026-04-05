# Phase R2 — Execution + Multi-Leg Orchestration Gap Analysis

**Date**: 2026-04-05  
**Phase**: R2 — Execution-Capable Connector + Multi-Leg Carry Orchestration  
**Status**: In Progress

## Audit Summary

This document captures the current execution and carry orchestration state, identifies gaps for hackathon submission readiness, and provides the implementation plan for Phase R2.

## Current State Audit

### 1. Execution-Capable Connector State

#### What Exists

**Drift Devnet Carry Adapter** (`packages/venue-adapters/src/real/drift-devnet-carry-adapter.ts`)
- ✅ Real execution-capable for BTC-PERP market orders
- ✅ Solana transaction signatures persisted as execution references
- ✅ Drift SDK integration for order placement
- ✅ Execution event subscriber for fill confirmation
- ✅ Promotion/gating workflow integration
- ✅ Phase 6.0 completed - supports opening, adding, reducing BTC-PERP position

**Execution Scope** (from adapter constants):
```typescript
SUPPORTED_EXECUTION_SCOPE = [
  'devnet only',
  'carry sleeve only', 
  'BTC-PERP market orders that can open, add to, or reduce a single live perp position',
  'real Solana transaction signatures persisted as execution references',
];

UNSUPPORTED_EXECUTION_SCOPE = [
  'mainnet-beta execution',
  'spot orders',
  'limit or post-only orders',
  'non-BTC perp markets',
  'crossing an opposite-side BTC-PERP position with a non-reduce-only order',
  'silent fallback to simulated execution',
];
```

#### Promotion/Gating Workflow

**Connector States** (from database schema):
- `simulated_only`
- `real_readonly`
- `execution_capable_unapproved`
- `promotion_requested`
- `under_review`
- `approved_for_live`
- `rejected`
- `suspended`

**Venue Connector Promotions Table** (`venue_connector_promotions`):
- Tracks promotion lifecycle
- Stores readiness evidence
- Records missing prerequisites
- Durable decision history
- Event log for audit

### 2. Carry Action + Execution Model

#### Current Schema

**Carry Actions** (`carry_actions` table):
- actionType: `increase_carry_exposure` | `reduce_carry_exposure`
- status lifecycle: `recommended` → `approved` → `queued` → `executing` → `completed`/`failed`
- executionPlan: JSONB with planned orders
- blockedReasons: array of blockers

**Carry Action Order Intents** (`carry_action_order_intents`):
- Links actions to order intents
- Single order per intent (current limitation)

**Carry Action Executions** (`carry_action_executions`):
- Execution attempt records
- Outcome tracking
- Venue execution reference

**Carry Execution Steps** (`carry_execution_steps`):
- Step-level execution detail
- Order status tracking
- Fill recording
- Execution reference persistence

#### Current Execution Flow

```
1. Carry action created (increase/reduce exposure)
2. Action approved by operator
3. Runtime worker processes execute_carry_action command
4. Execution steps created for planned orders
5. Orders submitted to venue (Drift devnet for real)
6. Execution references (tx signatures) persisted
7. Fill confirmation via event subscriber
8. Execution outcome recorded
```

### 3. Multi-Leg Orchestration State

#### What Exists

**Spot-Perp Coordination** (`packages/carry/src/spot-perp-coordination.ts`):
- ✅ `DeltaNeutralHedgePair` type definition
- ✅ `HedgeLeg` interface for individual legs
- ✅ `createHedgePair()` function
- ✅ `validateHedgePair()` function
- ✅ `createHedgeExecutionPlan()` function
- ✅ `calculateHedgeDeviation()` function
- ✅ `isHedgeBalanced()` function

**Status**: Types and utilities exist but NOT integrated into execution flow.

#### What's Missing

- ❌ Multi-leg plan persistence (schema only has single order intents)
- ❌ Leg sequencing in execution
- ❌ Partial-failure handling for multi-leg
- ❌ Hedge state tracking in database
- ❌ Rebalance logic integration
- ❌ Cross-venue coordination

### 4. Mainnet Execution State

**Drift Mainnet Carry Adapter** (`drift-mainnet-carry-adapter.ts`):
- ✅ File exists
- ❌ Execution methods NOT implemented (read-only only)
- ❌ No real order placement

**Current Status**: Mainnet execution is a gap.

### 5. Risk Guardrails State

#### What Exists

**Circuit Breakers** (`packages/risk-engine/src/circuit-breakers.ts`):
- Circuit breaker registry
- Open/closed state tracking

**Risk Checks** (`packages/risk-engine/src/checks.ts`):
- Gross exposure check
- Net exposure check
- Venue concentration check
- Asset concentration check
- Leverage check
- Liquidity reserve check
- Drawdown check
- Price staleness check
- Position size check

**Carry Operational Policy** (`controlled-execution.ts`):
- `minimumActionableUsd`: $2,500
- `minimumConfidenceScore`: 0.6
- Strategy policy enforcement

#### What's Missing

- ❌ Connector-specific max notional limits
- ❌ Execution-level circuit breakers
- ❌ Kill switch integration
- ❌ Partial-fill blocking behavior

## Gap Analysis

| Capability | Current State | Gap | Priority |
|------------|---------------|-----|----------|
| **Real Execution** | Devnet BTC-PERP only | ✅ Working | - |
| **Mainnet Execution** | Read-only only | 🔴 Not implemented | High (post-hackathon) |
| **Multi-Leg Plan** | Types exist | 🟡 Not persisted/executed | High |
| **Leg Sequencing** | Not implemented | 🟡 Needs implementation | High |
| **Partial-Failure Handling** | Not implemented | 🟡 Needs implementation | High |
| **Hedge Rebalance** | Utilities exist | 🟡 Not integrated | Medium |
| **Execution Guardrails** | Basic checks | 🟡 Needs strengthening | High |
| **Kill Switch** | Not implemented | 🟡 Needs implementation | High |

## Chosen First Execution Path

**Selected**: Drift Devnet BTC-PERP (already implemented)

**Why**: 
- Real execution capability exists and is tested
- Fits hackathon demo requirements
- Narrow scope is honest and verifiable
- Promotion/gating workflow is complete

**Scope for Phase R2**:
- Keep devnet as primary demo path
- Enhance with multi-leg orchestration
- Strengthen guardrails
- Add kill switch
- Prepare mainnet structure (gated)

## Implementation Plan

### Step 1: Multi-Leg Orchestration Schema

**New Tables Needed**:
```sql
carry_multi_leg_plans         -- Multi-leg orchestration plans
carry_leg_executions          -- Individual leg execution records
carry_hedge_state             -- Hedge pair state tracking
```

**Modified Tables**:
```sql
carry_actions                 -- Add orchestrationPlanId
carry_execution_steps         -- Add legSequence, parentLegId
```

### Step 2: Multi-Leg Execution Logic

**New Package/Module**: `packages/carry/src/multi-leg-orchestration.ts`

**Responsibilities**:
- Multi-leg plan creation
- Leg sequencing logic
- Partial-failure handling
- Hedge deviation calculation
- Rebalance trigger detection

### Step 3: Execution Guardrails

**New Module**: `packages/risk-engine/src/execution-guardrails.ts`

**Features**:
- Connector max notional limits
- Execution-level circuit breakers
- Kill switch integration
- Partial-fill handling
- Blocked reason persistence

### Step 4: API Extensions

**New Endpoints**:
```
GET  /api/v1/carry/orchestrations
GET  /api/v1/carry/orchestrations/:id
GET  /api/v1/carry/hedge-state
POST /api/v1/carry/orchestrations/:id/approve
POST /api/v1/carry/orchestrations/:id/cancel
POST /api/v1/control/kill-switch  (enhance)
```

### Step 5: Dashboard Updates

**New/Updated Pages**:
- `/carry/orchestrations` - Multi-leg orchestration list
- `/carry/orchestrations/[id]` - Orchestration detail with leg status
- `/carry/hedge-state` - Hedge balance visualization
- Enhanced `/venues/[id]` - Kill switch controls

### Step 6: Mainnet Preparation (Gated)

**Approach**:
- Add mainnet adapter structure
- Keep execution DISABLED by default
- Add heavy gating and warnings
- Document as "preparation only"

## Required Changes Summary

### Code Changes

| File/Package | Change |
|--------------|--------|
| `packages/db/migrations/0027_*.sql` | Multi-leg schema |
| `packages/db/src/schema/runtime.ts` | Add new tables |
| `packages/carry/src/multi-leg-orchestration.ts` | New module |
| `packages/carry/src/index.ts` | Export new types |
| `packages/risk-engine/src/execution-guardrails.ts` | New module |
| `packages/runtime/src/` | Integrate orchestration |
| `apps/api/src/routes/carry.ts` | New endpoints |
| `apps/ops-dashboard/` | New pages |

### Documentation Changes

| Document | Change |
|----------|--------|
| `docs/architecture/phase-r2-execution-and-orchestration.md` | New |
| `docs/risk/phase-r2-execution-guardrails.md` | New |
| `docs/runbooks/devnet-execution-demo.md` | New |
| `docs/runbooks/mainnet-execution-readiness.md` | New |
| `README.md` | Update boundaries |

## Validation Plan

1. **Build**: All packages compile
2. **TypeCheck**: No type errors
3. **Lint**: No lint errors
4. **Tests**: New tests for multi-leg logic
5. **Integration**: End-to-end orchestration test
6. **Demo**: Full devnet execution flow

## Success Criteria

- [ ] Multi-leg plan creation works
- [ ] Leg sequencing executes correctly
- [ ] Partial-failure handling is robust
- [ ] Guardrails block unsafe execution
- [ ] Kill switch halts execution
- [ ] Dashboard shows leg-level detail
- [ ] Devnet demo is reproducible
- [ ] All validation passes
