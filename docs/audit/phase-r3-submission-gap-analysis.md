# Phase R3 Gap Analysis: Runtime Integration + Submission Dossier

**Date:** 2026-04-05  
**Scope:** Phase R3 - Connect Phase R2 components to runtime, complete submission workflow  
**Status:** Analysis Complete → Implementation Ready

---

## Executive Summary

Phases R1 (Ranger/vault foundation) and R2 (multi-leg orchestration + guardrails) are **functionally complete** in packages. However, they exist as **isolated modules** not yet integrated into the runtime execution flow. Phase R3 must bridge this gap.

**Key Finding:** The runtime's `executeCarryAction` executes orders sequentially without:
- Multi-leg orchestration (dependency management, hedge tracking)
- Execution guardrails (kill switches, circuit breakers, notional limits)
- CEX API verification (currently CSV-only)
- Performance report generation for hackathon submission

---

## Current State Inventory

### ✅ What Exists (Ready for Integration)

| Component | Location | Status | Test Coverage |
|-----------|----------|--------|---------------|
| **Ranger Vault Client** | `packages/ranger/` | Complete (simulated mode) | 19 tests passing |
| **Multi-Leg Orchestration** | `packages/carry/multi-leg-orchestration.ts` | Complete | 82 tests passing |
| **Execution Guardrails** | `packages/risk-engine/execution-guardrails.ts` | Complete | 146 tests passing |
| **Database Schema** | Migration 0027 | Deployed | N/A |
| **CEX CSV Parser** | `packages/cex-verification/` | Complete (CSV only) | Included |
| **Submission API** | `apps/api/src/routes/submission.ts` | CRUD + Evidence | Basic routes |

### ❌ What's Missing (Phase R3 Scope)

| Gap | Impact | Priority |
|-----|--------|----------|
| Multi-leg orchestration NOT wired into runtime | Single-leg execution only; no hedge coordination | **Critical** |
| Execution guardrails NOT enforced in runtime | No kill switch or circuit breaker protection | **Critical** |
| No CEX read-only API verification | Manual CSV upload only | Medium |
| No performance report generation | Can't produce hackathon submission evidence | Medium |
| Dashboard lacks multi-leg execution views | Ops team blind to leg-level execution | Medium |

---

## Detailed Gap Analysis

### Gap 1: Multi-Leg Orchestration → Runtime Integration

**Current Flow (`executeCarryAction` in `runtime.ts:3581`):**
```typescript
for (const plannedOrder of detail.plannedOrders) {
  // Sequential order execution, no dependency management
  const orderRecord = await executor.submitIntent({...});
  // If one fails, action fails - no partial failure handling
}
```

**Required Flow (Phase R2 Integration):**
```typescript
// 1. Create multi-leg plan from action
const planResult = createMultiLegPlan({
  legs: plannedOrders.map(order => ({...})),
  coordinationConfig: { allowPartialExecution: true, ... }
});

// 2. Execute legs in topological order with hedge state monitoring
for (const legId of plan.executionOrder) {
  const leg = plan.legs.find(l => l.id === legId);
  
  // Check guardrails before execution
  const guardrailCheck = guardrailEngine.check(configId, context);
  if (!guardrailCheck.allowed) { /* handle violation */ }
  
  // Execute with hedge tracking
  const result = await executeLegWithTracking(leg);
  
  // Update hedge state
  const hedgeState = calculateHedgeState(plan);
  if (hedgeState.deviationPct > threshold) { /* trigger rebalancing */ }
}
```

**Integration Points Needed:**
1. `RuntimeStore.createMultiLegPlan()` - Persist plan to DB
2. `RuntimeStore.createLegExecution()` - Track individual legs
3. `RuntimeStore.updateHedgeState()` - Monitor hedge deviation
4. `SentinelRuntime.executeMultiLegPlan()` - New execution method

---

### Gap 2: Execution Guardrails → Runtime Integration

**Current State:** Guardrails exist but are NOT checked during execution.

**Required Integration:**

| Guardrail | Current | Required | Hook Point |
|-----------|---------|----------|------------|
| Kill Switch | ❌ Not checked | ✅ Block all execution | `executeCarryAction` start |
| Circuit Breaker | ❌ Not checked | ✅ Block after failures | Before each leg execution |
| Notional Limits | ❌ Not checked | ✅ Block if exceeds limit | During carry evaluation |
| Concurrency Limit | ❌ Not checked | ✅ Block if too many concurrent | `executeCarryAction` start |
| Stale Truth | ❌ Not checked | ✅ Block if market data stale | Before each leg execution |

**Implementation:**
```typescript
// In executeCarryAction before execution:
const guardrailEngine = new ExecutionGuardrailEngine(config);
const check = guardrailEngine.check('carry-global', {
  notionalAmount: totalNotional,
  concurrentActionCount: await store.getExecutingActionCount(),
  venueHealthStatuses: await getVenueHealthStatuses(),
  lastTruthTimestamp: await getLastTruthTimestamp(),
});

if (!check.allowed) {
  await recordGuardrailViolation(check.blockedReasons);
  throw new Error(`Execution blocked: ${check.blockedReasons.map(r => r.type).join(', ')}`);
}
```

---

### Gap 3: CEX API Verification Enhancement

**Current:** CSV upload only via `POST /api/v1/cex-verification/sessions`

**Required:** Read-only API integration for real-time verification

```typescript
// New: packages/cex-verification/src/binance-api.ts
export interface CexApiConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string; // https://api.binance.com or testnet
}

export interface TradeHistoryQuery {
  symbol: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export async function fetchBinanceTrades(
  config: CexApiConfig,
  query: TradeHistoryQuery
): Promise<Result<TradeRecord[]>>
```

**API Routes to Add:**
- `POST /api/v1/cex-verification/api-configs` - Store encrypted API credentials
- `POST /api/v1/cex-verification/sessions/:sessionId/sync` - Sync trades via API
- `GET /api/v1/cex-verification/sessions/:sessionId/audit` - Audit trail report

---

### Gap 4: Performance Report Generation

**Current:** Manual CSV analysis + submission dossier CRUD

**Required:** Automated performance reports for hackathon submission

```typescript
// New: packages/submission/src/performance-report.ts
export interface PerformanceReport {
  period: { start: Date; end: Date };
  summary: {
    totalPnL: Decimal;
    sharpeRatio: number;
    maxDrawdown: Decimal;
    winRate: number;
    tradeCount: number;
  };
  cexVerification: {
    platform: string;
    tradeCount: number;
    verifiedPnL: Decimal;
    verificationStatus: 'verified' | 'partial' | 'unverified';
  };
  onChainEvidence: {
    vaultAddress: string;
    transactionHashes: string[];
    positionSnapshots: PositionSnapshot[];
  };
}
```

**Report Types:**
1. **Daily Performance Summary** - PnL, trades, funding rates
2. **Weekly Audit Report** - CEX verification + on-chain evidence
3. **Hackathon Submission Report** - Complete evidence package

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard / API                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Phase R3 Integration Layer                   │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Multi-Leg       │ │ Guardrail       │ │ CEX API         │   │
│  │ Orchestration   │ │ Enforcement     │ │ Verification    │   │
│  │ Service         │ │ Service         │ │ Service         │   │
│  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘   │
└───────────┼───────────────────┼───────────────────┼────────────┘
            │                   │                   │
┌───────────▼───────────────────▼───────────────────▼────────────┐
│                         Runtime Core                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  SentinelRuntime.executeCarryAction() (Enhanced)        │  │
│  │  - Create multi-leg plan                                │  │
│  │  - Check guardrails                                     │  │
│  │  - Execute legs with hedge tracking                     │  │
│  │  - Handle partial failures                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                      Package Layer (Existing)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ carry        │ │ risk-engine  │ │ cex-verification         │
│  │ (Phase R2)   │ │ (Phase R2)   │ │ (Enhanced)   │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase R3.1: Multi-Leg + Guardrail Integration (Critical)
- [ ] Add `SentinelRuntime.executeMultiLegPlan()` method
- [ ] Integrate guardrail checks into `executeCarryAction`
- [ ] Add RuntimeStore methods for multi-leg persistence
- [ ] Add worker command handler for `execute_multi_leg_plan`
- [ ] Wire hedge state monitoring into execution flow

### Phase R3.2: API + Dashboard Surfaces
- [ ] Add `/api/v1/carry/multi-leg-plans` routes
- [ ] Add `/api/v1/risk/guardrails` routes
- [ ] Create dashboard multi-leg execution view
- [ ] Create guardrail status dashboard widget

### Phase R3.3: CEX API Verification
- [ ] Implement Binance read-only API client
- [ ] Add API credential encryption/storage
- [ ] Add `/api/v1/cex-verification/api-configs` routes
- [ ] Add trade sync from API

### Phase R3.4: Performance Reporting
- [ ] Implement `PerformanceReportGenerator`
- [ ] Add `/api/v1/submission/reports` routes
- [ ] Create submission evidence package generator
- [ ] Add automated daily/weekly report generation

---

## Test Coverage Plan

| Component | Unit Tests | Integration Tests | E2E Tests |
|-----------|------------|-------------------|-----------|
| Multi-Leg Runtime Integration | 30 | 10 | 5 |
| Guardrail Enforcement | 25 | 8 | 5 |
| CEX API Verification | 20 | 5 | 3 |
| Performance Reports | 15 | 5 | 2 |
| **Total New Tests** | **90** | **28** | **15** |

---

## External Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| Ranger SDK | ❌ Still unavailable | Real vault execution blocked |
| Mainnet Drift | ⚠️ Requires 2FA auth | Live trading requires manual step |
| Binance API | ✅ Available | CEX verification ready to implement |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Ranger SDK never available | Medium | High | Vault stays simulated; focus on execution proof |
| Multi-leg integration complexity | Medium | Medium | Incremental rollout; feature flags |
| CEX API rate limits | High | Low | Implement backoff; cache aggressively |
| Performance report accuracy | Low | High | Extensive unit tests; audit trail |

---

## Success Criteria

- [x] Database schema for multi-leg orchestration (migration 0027)
- [x] RuntimeStore methods for multi-leg persistence
- [x] RuntimeStore methods for guardrail violations
- [x] **Part 2:** API routes for multi-leg plans and guardrails
- [x] **Part 2:** Control plane methods for reading multi-leg state
- [x] **Part 3:** Guardrail enforcement in execution paths
- [x] **Part 3:** Worker integration for guardrail violations
- [ ] **Part 4:** Multi-leg execution in runtime (executeCarryAction)
- [ ] **Part 4:** Worker integration for multi-leg commands
- [ ] **Part 4:** Dashboard pages for multi-leg visibility
- [ ] **Part 5:** CEX trades can be verified via API (not just CSV)
- [ ] **Part 6:** Performance reports generate in < 5 seconds

---

## Completed in Phase R3 Part 1 (Store Layer)

| Method | Purpose | Status |
|--------|---------|--------|
| `createMultiLegPlan()` | Persist multi-leg plan to DB | ✅ |
| `createLegExecution()` | Create individual leg records | ✅ |
| `getLegExecutionsForPlan()` | Retrieve legs for a plan | ✅ |
| `updateLegExecutionStatus()` | Update leg execution status | ✅ |
| `updateMultiLegPlanStatus()` | Update plan status | ✅ |
| `recordHedgeState()` | Record hedge deviation state | ✅ |
| `getHedgeStateForPlan()` | Retrieve hedge states | ✅ |
| `getExecutingActionCount()` | For concurrency limits | ✅ |
| `getGuardrailConfig()` | Load guardrail configuration | ✅ |
| `recordGuardrailViolation()` | Audit guardrail violations | ✅ |
| `triggerKillSwitch()` | Emergency halt | ✅ |
| `resetKillSwitch()` | Resume after kill switch | ✅ |

---

## Completed in Phase R3 Part 2 (API/Control Plane)

### New API Routes
- GET `/api/v1/carry/actions/:actionId/multi-leg-plans`
- GET `/api/v1/carry/multi-leg-plans/:planId`
- GET `/api/v1/carry/multi-leg-plans/:planId/legs`
- GET `/api/v1/carry/multi-leg-plans/:planId/hedge-state`
- GET `/api/v1/carry/guardrail-config`
- GET `/api/v1/carry/guardrail-violations`

### New Control Plane Methods
- `getMultiLegPlan()` - Full plan detail with leg counts
- `listMultiLegPlansForAction()` - Summary list
- `getLegExecutionsForPlan()` - Leg execution details
- `getHedgeStateForPlan()` - Hedge deviation history
- `getGuardrailConfigSummary()` - Config + violation summary
- `listGuardrailViolations()` - Paginated violations

### New Runtime Types
- `MultiLegPlanView`, `MultiLegPlanSummaryView`
- `LegExecutionView`, `HedgeStateView`
- `GuardrailConfigSummaryView`, `GuardrailViolationView`

---

## Remaining for Phase R3 Part 3 (Runtime Integration)

### Core Runtime Changes
- Modify `executeCarryAction()` to create multi-leg plans
- Execute legs in topological order with dependency management
- Calculate and record hedge state during execution
- Handle partial failures (continue/rollback/wait)

### Guardrail Enforcement
- Check kill switch before execution
- Enforce notional limits
- Check concurrency limits
- Track circuit breaker state
- Record violations during execution

### Worker Integration
- Extend worker command handling for multi-leg
- Update plan/leg status in worker
- Handle partial failure in command completion

### Dashboard
- Multi-leg plan detail page
- Leg-by-leg execution table
- Hedge deviation visualization
- Guardrail status widget

---

## Next Steps

1. **Phase R3 Part 3:** Complete runtime integration (execution flow)
2. **Phase R3 Part 4:** CEX API verification (Binance)
3. **Phase R3 Part 5:** Performance reports + submission dossier
