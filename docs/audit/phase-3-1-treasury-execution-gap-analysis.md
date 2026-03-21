# Phase 3.1 Treasury Execution Gap Analysis

Date: 2026-03-21
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Treasury Recommendation Model

Before Phase 3.1, Atlas Treasury had:

- deterministic policy evaluation in `packages/treasury`
- persisted treasury runs, venue snapshots, and `treasury_actions`
- explicit simulated treasury venue adapters
- runtime evaluation during scheduled cycles and via `run_treasury_evaluation`
- API and dashboard visibility into summary, allocations, policy, and recommendations

Gaps before this pass:

- recommendations were persisted as `recommended` rows only
- no execution-ready treasury intent model
- no treasury approval lifecycle
- no treasury execution history
- no durable linkage from treasury actions to runtime commands and venue execution references
- no treasury-specific backend execution risk gate
- no safe operator path from recommendation to execution

## 2. Target Treasury Execution Model

Phase 3.1 target:

- keep treasury recommendations and treasury execution distinct
- derive execution-ready treasury intents from recommendations in `packages/treasury`
- persist action readiness, blocked reasons, approval requirement, execution mode, and simulated/live boundary
- require explicit approval before execution
- reuse the runtime command queue for actual treasury execution attempts
- persist append-only treasury execution history
- revalidate treasury actions at execution time against current treasury state

Implemented model in this pass:

- recommendation type remains `deposit` / `redeem`
- executable action type is normalized to:
  - `allocate_to_venue`
  - `reduce_venue_allocation`
- treasury action lifecycle:
  - `recommended`
  - `approved`
  - `queued`
  - `executing`
  - `completed`
  - `failed`
- readiness state is explicit:
  - `actionable`
  - `blocked`
- approval requirement is explicit:
  - `operator`
  - `admin`
- execution still routes through runtime commands, now including `execute_treasury_action`

## 3. Required Changes

### Domain / Treasury Package

- extend treasury policy with `minimumRemainingIdleUsd`
- add blocked-reason model and deterministic execution effects
- add `TreasuryExecutionPlanner` to convert recommendations into execution-ready intents

### Runtime

- add treasury action approval and execution control-plane methods
- add worker handling for `execute_treasury_action`
- revalidate treasury actions at execution time against current treasury conditions
- persist action lifecycle and execution history
- track durable treasury cash balance so post-execution evaluations remain internally coherent

### Schema / Persistence

- extend `treasury_actions` with readiness, execution plan, approval, command linkage, and lifecycle fields
- add `treasury_action_executions` for append-only execution history
- extend `treasury_current` with `cash_balance_usd`

### API

- add:
  - `GET /api/v1/treasury/recommendations`
  - `GET /api/v1/treasury/actions/:actionId`
  - `GET /api/v1/treasury/executions`
  - `GET /api/v1/treasury/executions/:executionId`
  - `POST /api/v1/treasury/actions/:actionId/approve`
  - `POST /api/v1/treasury/actions/:actionId/execute`

### Dashboard

- show recommendation readiness and blocked reasons
- show approval/execute controls
- show execution history
- show simulated/live boundary in the treasury action surface

## 4. Implementation Plan In Priority Order

1. Define treasury execution types, blocked reasons, approval requirements, and planning rules in `packages/treasury`.
2. Extend treasury adapter interfaces with capabilities and explicit execution methods.
3. Add schema and migration support for treasury action lifecycle and execution history.
4. Wire runtime evaluation to persist execution-ready treasury actions.
5. Add control-plane approval and queueing, and worker execution handling.
6. Add API routes for treasury recommendation detail, approval, execution, and history.
7. Add dashboard controls and execution visibility.
8. Add deterministic treasury, runtime, API, and dashboard tests.
9. Update strategy, architecture, risk, README, and current-state audit docs.
