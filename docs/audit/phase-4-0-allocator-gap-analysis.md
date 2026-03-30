# Phase 4.0 Allocator Gap Analysis

Date: 2026-03-30

## 1. Current Carry + Treasury Product/Runtime Shape

- Carry already exists as the first strategy sleeve:
  - opportunities are detected in `packages/carry`
  - strategy planning and risk approval happen in `packages/strategy-engine`
  - execution is routed through `packages/execution`
  - persisted opportunity, intent, order, position, risk, and portfolio read models already exist in `packages/runtime` + `packages/db`
- Treasury already exists as the second capital sleeve:
  - policy evaluation and reserve checks live in `packages/treasury`
  - execution planning and blocked reasons already exist
  - runtime persists treasury runs, venue snapshots, actions, executions, and current state
  - API and ops-dashboard already surface treasury state and actions
- Runtime already has the correct orchestration seams:
  - `SentinelRuntime` runs the cycle
  - `RuntimeWorker` executes scheduled and explicit commands
  - `RuntimeControlPlane` provides thin query/enqueue/mutation surfaces
  - `RuntimeStore` persists durable operational state and read models
- What is missing is the portfolio layer above both sleeves:
  - there is no allocator package
  - there is no shared sleeve contract for portfolio budgeting
  - there is no durable allocator run/decision/read model
  - there is no operator surface for portfolio-level budget steering

## 2. Target Allocator Foundation Design

- Add `packages/allocator` as the dedicated Sentinel domain boundary.
- Keep the first pass deterministic and inspectable:
  - two sleeves only: `carry` and `treasury`
  - explicit baseline policy
  - explicit regime/pressure state
  - explicit constraints and rationale
  - recommendation-oriented outputs only
- Use a simple sleeve registry:
  - stable sleeve ids
  - sleeve metadata and budgeting support
  - runtime-owned translation from carry/treasury state into allocator sleeve snapshots
- Persist allocator outputs as portfolio read models:
  - allocator runs
  - per-sleeve target/current comparison
  - allocator recommendations
  - latest allocator summary/current snapshot

## 3. Required Changes

### Domain / Package

- Add allocator domain types for:
  - sleeves
  - budgets
  - targets
  - recommendations
  - rationale
  - constraints
  - regime / pressure state
- Add deterministic Sentinel allocator policy engine.

### Runtime

- Add allocator evaluation method to runtime.
- Add explicit runtime command for allocator evaluation.
- Run allocator evaluation during runtime cycles after treasury evaluation.
- Keep outputs as persisted recommendations; no hidden execution side effects.

### Schema / Persistence

- Add allocator tables for:
  - runs
  - sleeve targets
  - recommendations
  - current summary
- Extend runtime read/store APIs to expose allocator state.

### API

- Add allocator read endpoints and an explicit evaluate endpoint.
- Reuse existing auth and operator-role gates.

### Dashboard

- Add first allocator page with:
  - overview
  - current vs target allocations
  - rationale and system pressure indicators
  - decision history
  - explicit evaluate action

## 4. Implementation Plan

1. Add allocator package and policy engine.
2. Add DB schema + migration for allocator persistence.
3. Extend runtime store/types/control-plane/worker for allocator evaluation and query surfaces.
4. Add allocator API routes.
5. Add ops-dashboard allocator page and mutation wiring.
6. Add runtime/API/dashboard tests for allocator flows.
7. Update audit/architecture/strategy/README docs so the repo reflects the new portfolio layer.
