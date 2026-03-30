# Phase 4.2 Carry Controlled Execution Gap Analysis

Date: 2026-03-30

## 1. Current Carry Recommendation And Action Model

Carry currently exists as a signal-and-order pipeline, not as a controlled sleeve workflow.

What already exists:

- `packages/carry` provides:
  - opportunity detection
  - position sizing
  - hedge-state computation
  - carry PnL logic
- `packages/strategy-engine` provides:
  - market-data fetch
  - opportunity evaluation
  - intent generation from approved opportunities
  - risk-check invocation
- `packages/runtime` persists:
  - strategy runs
  - opportunities
  - strategy intents
  - orders
  - fills
  - positions
  - risk snapshots and breaches

Current carry flow:

1. Runtime cycle calls `StrategyPipeline.planCycle(...)`.
2. Approved carry opportunities become `OrderIntent`s.
3. Runtime persists those intents and risk outcomes.
4. Approved intents are submitted through `OrderExecutor`.
5. Orders, fills, and positions are persisted.

What does not yet exist:

- no carry recommendation model comparable to treasury recommendations
- no carry execution-intent model comparable to treasury execution intents
- no carry action lifecycle comparable to treasury actions
- no carry action detail or execution detail read model
- no carry-specific operator approval workflow
- no carry venue capability/readiness visibility
- no carry-specific blocked-reason model

## 2. Current Carry Execution Capabilities And Gaps

### Existing capabilities

- The repo can already paper-execute carry orders through simulated venue adapters.
- `OrderExecutor` and `RuntimeOrderStore` already provide a durable order lifecycle.
- `StrategyPipeline` already provides deterministic opportunity filtering and intent generation.
- `SentinelRuntime` already owns actor-aware audit writing, runtime commands, worker execution, and read-model persistence.
- The dashboard and API already have the auth, role gating, and command-rail patterns needed for carry.
- Treasury already proves the target control-plane pattern:
  - planner-owned blocked reasons
  - explicit approval requirements
  - queue -> execute lifecycle
  - append-only execution history
  - venue readiness drill-through

### Gaps relative to Treasury

- Carry execution is still implicit inside the runtime cycle rather than exposed as an explicit sleeve action.
- Carry has no first-class execution policy layer with structured readiness and blocked reasons.
- Carry has no venue capability abstraction that tells operators whether execution is simulated, unsupported, read-only, or live-capable.
- Carry has no explicit approval requirement model.
- Carry has no action detail surface and no execution detail surface.
- Carry has no durable linkage from allocator rebalance proposal to downstream carry action outcomes.
- Carry has no honest boundary for unsupported live deployment beyond generic runtime mode flags.

## 3. Target Carry Controlled-Execution Design

Phase 4.2 should make carry follow the same control-plane shape as treasury, while reusing the existing carry signal and order infrastructure.

### Target model

- `packages/carry` owns:
  - carry action/recommendation types
  - carry execution planning
  - carry blocked-reason generation
  - carry operational policy evaluation
- `packages/runtime` owns:
  - persistence
  - command queueing
  - approval transitions
  - worker execution
  - rebalance-to-carry linkage
- `packages/venue-adapters` owns:
  - carry venue capability/readiness contracts
  - simulated carry execution support
  - explicit unsupported live boundaries
- `apps/api` and `apps/ops-dashboard` stay thin

### Carry action model

Initial action vocabulary:

- `increase_carry_exposure`
- `reduce_carry_exposure`
- `restore_carry_budget`

Initial lifecycle:

- `recommended`
- `approved`
- `queued`
- `executing`
- `completed`
- `failed`
- `cancelled`

### Carry planning sources

- opportunity-driven carry actions:
  - created from approved carry opportunities
  - execution plan is composed of deterministic order intents
- rebalance-driven carry actions:
  - created from approved rebalance proposals
  - increase path links to carry deployment opportunities
  - reduce path links to controlled reduction of existing carry exposure

### Honest execution boundary

- dry-run mode may still execute against simulated adapters and persist outcomes as simulated
- live-mode carry execution requires:
  - runtime live mode enabled
  - venue capability support
  - explicit live approval semantics
- if live support is absent, the action remains blocked with explicit reasons

## 4. Required Changes

### Domain / Carry package

- add carry action, blocked-reason, readiness, execution-status, and venue-capability types
- add carry execution planner
- add carry operational policy rules
- add deterministic order-plan generation for increase and reduction actions

### Venue adapters

- add carry capability/readiness contract
- expose simulated carry execution support on simulated adapters
- expose explicit unsupported live capability state when live implementation is absent

### Runtime

- add carry evaluation command support
- persist carry actions and carry executions
- add approval and execution control-plane methods
- execute carry actions through the existing runtime command rail
- link rebalance proposal execution to downstream carry actions and outcomes

### Schema

- add carry venue snapshots
- add carry actions
- add carry action order-intent plan rows
- add carry action executions

### API

- add carry list/detail read surfaces
- add carry evaluation queueing
- add carry approval and explicit execution endpoints

### Dashboard

- add carry overview page
- add carry action detail
- add carry execution history visibility
- show carry venue readiness / simulation state
- link rebalance proposal detail to downstream carry actions

## 5. Priority-Ordered Implementation Plan

1. Add Phase 4.2 architecture/risk documentation and carry domain types.
2. Add carry policy and execution planner in `packages/carry`.
3. Add carry venue capability contracts and simulated adapter support.
4. Add carry schema and migrations.
5. Add runtime persistence and read models for carry actions/executions/venues.
6. Add carry evaluation, approval, and execution methods to runtime/control plane/worker.
7. Harden rebalance execution to create and link downstream carry actions.
8. Add API endpoints.
9. Add dashboard views and controls.
10. Add package, runtime, API, and dashboard tests.
