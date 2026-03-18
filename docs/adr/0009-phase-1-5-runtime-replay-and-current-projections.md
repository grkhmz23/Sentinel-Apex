# ADR 0009: Runtime Replay And Rebuildable Current Projections

**Status:** Accepted
**Date:** 2026-03-18

## Context

Phase 1 introduced durable runtime facts and inline read models, but the runtime still behaved too much like a fresh in-memory process. Local/dev operation needed explicit lifecycle semantics, a real Postgres-first workflow, and a deterministic way to recover current state if projections were lost or stale.

## Decision

Keep durable operational records as the source of truth and treat current projection tables as rebuildable state.

In practice:

- restore simulated venue state by replaying persisted fills
- rebuild `portfolio_current` from the latest portfolio snapshot
- rebuild `risk_current` from the latest risk snapshot
- rebuild `positions` from restored adapter state
- persist runtime lifecycle and projection freshness in `runtime_state`

## Why This Decision

- It hardens the local/dev control plane without adding a separate projector process too early.
- It preserves deterministic tests and paper-trading workflows.
- It gives operators a safe recovery action for stale or lost current projections.
- It keeps future extraction into a worker/projector architecture straightforward.

## Consequences

Positive:

- explicit runtime lifecycle
- projection replay and rebuild capability
- Postgres-first local/dev workflow
- improved operator control surfaces

Negative:

- replay still depends on in-process adapter restoration
- current projections are still rebuilt inline rather than by a separate service
- concurrency semantics remain single-process oriented
