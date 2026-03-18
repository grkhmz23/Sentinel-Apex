# Phase 1 Runtime And Read Models

Date: 2026-03-18

## Purpose

Phase 1 needed one truthful internal control-plane foundation. The chosen design keeps strategy, risk, execution, and venue logic in existing packages and adds one small application layer that persists runtime state and exposes query-ready read models to the API.

## Runtime Shape

`packages/runtime` is the Phase 1 application service layer.

Flow:

1. Refresh portfolio state from simulated venue adapters.
2. Plan a strategy cycle through `packages/strategy-engine`.
3. Persist strategy run, opportunities, and intents.
4. Persist risk snapshot and risk breaches.
5. Execute approved intents through `packages/execution` against simulated adapters in dry-run mode.
6. Persist orders, fills, execution events, positions, portfolio snapshots, runtime state, and audit events.
7. Serve API queries from those persisted tables.

## Persistence Pattern

- Write model: append/record operational facts into runtime, order, risk, portfolio, and audit tables.
- Read model: query latest snapshots and denormalized state directly from those tables.
- Control state: singleton `runtime_state` row plus audit events.

This is not a separate projection worker yet. Phase 1 updates projections inline in the runtime process for determinism and simplicity.

## API Boundary

- API handlers are thin.
- Route code does not compute portfolio, risk, or execution state.
- The API depends on `packages/runtime` query methods and control methods.

## Safety Model

- Default mode is dry-run.
- Live execution remains opt-in and separately gated.
- The deterministic runtime uses simulated venues only.
- Manual cycle triggering is disabled in production mode.

## Tradeoffs

Accepted:

- Inline projections instead of a separate projection consumer.
- Deterministic paper runtime bootstrap for local/test use.
- PGlite support for test/dev portability while keeping PostgreSQL-oriented schema and migrations.

Deferred:

- Separate worker/scheduler process
- asynchronous projection fan-out
- continuous reconciliation loop
- live venue execution path
- richer control-plane state machine
