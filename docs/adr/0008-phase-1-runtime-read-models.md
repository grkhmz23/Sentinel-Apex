# ADR 0008: Phase 1 Runtime And Inline Read Models

**Status:** Accepted
**Date:** 2026-03-18

## Context

The repo had real strategy, risk, and execution logic, but the API was still serving hard-coded payloads. There was no durable application layer connecting those packages to persistence and no truthful read-model surface for portfolio, risk, orders, or audit state.

## Decision

Introduce `packages/runtime` as the Phase 1 application layer.

Responsibilities:

- orchestrate `strategy-engine`, `risk-engine`, `execution`, and `venue-adapters`
- own durable runtime/control-plane writes
- maintain inline projections into queryable tables
- expose read-model queries and safe control methods for the API

The Phase 1 runtime updates read models inline during the write flow instead of introducing a separate projection worker.

## Why This Decision

- It fixes the immediate trust problem: API endpoints now read persisted state.
- It avoids scattering orchestration logic into `apps/api`.
- It preserves existing package responsibilities.
- It keeps the Phase 1 system small enough to test deterministically.

## Consequences

Positive:

- truthful portfolio/risk/order/event endpoints
- durable strategy/risk/execution audit trail
- deterministic local/test data flow
- clean place to evolve toward a worker/scheduler later

Negative:

- write and projection concerns still share one process
- no separate replayable projector yet
- runtime remains paper-trading oriented
