# Phase 1.5 Runtime Replay And Recovery

Date: 2026-03-18

## Goal

Phase 1.5 hardens the Phase 1 control plane so persisted runtime state can be restored and current projections can be rebuilt deterministically in local/dev operation.

## Source Of Truth

For the current architecture, durable source records are:

- `strategy_runs`
- `strategy_opportunities`
- `strategy_intents`
- `orders`
- `fills`
- `execution_events`
- `portfolio_snapshots`
- `risk_snapshots`
- `risk_breaches`
- `audit_events`
- `runtime_state`

Current projections are:

- `positions`
- `portfolio_current`
- `risk_current`

`positions`, `portfolio_current`, and `risk_current` are rebuildable. They are not the durable source of truth.

## Replay Model

Runtime recovery now works in two layers:

1. Restore simulated adapter state from persisted `fills`.
2. Rebuild current projections from durable snapshots and restored adapter state.

That means:

- portfolio current state comes from the latest durable portfolio snapshot
- risk current state comes from the latest durable risk snapshot
- current positions come from replayed execution history as expressed through adapter state

## Lifecycle Interaction

On runtime bootstrap:

1. runtime marks itself `starting`
2. venue adapters connect
3. projections rebuild from durable state
4. runtime becomes `ready` or `paused` depending on persisted halt state

On cycle execution:

1. runtime records cycle start and marks projections `stale`
2. strategy, risk, and execution flow persists new source records
3. snapshots and current projections update
4. runtime marks projections `fresh`

On rebuild:

1. runtime marks projections `rebuilding`
2. adapter state is restored from fills
3. `portfolio_current` and `risk_current` are replaced from latest snapshots
4. `positions` are replaced from restored adapter state
5. runtime records rebuild timestamp and projection source run

## Idempotency

Replay/rebuild is designed to be idempotent:

- fill replay resets simulated adapter state before reapplying persisted fills
- current projection tables are replaced, not incrementally appended
- audit events remain append-only, with deduplication by `eventId`

Repeated rebuilds should produce the same queryable current state from the same durable source records.

## Why This Shape

- It keeps the current runtime package small and testable.
- It avoids premature asynchronous projector infrastructure.
- It provides a real recovery path for local/dev operation.
- It preserves a clean future path to a separate runtime worker and projector.

## Deferred

- projection checkpoints separate from runtime status
- independent projector service
- multi-process concurrency control
- reconciliation mismatch replay
- non-simulated venue recovery
