# Phase 4.7 Bundle Recovery Actions

Date: 2026-03-31

## Purpose

Phase 4.7 adds explicit operator recovery actions for rebalance bundles.

The goal is not autonomous healing.

The goal is:

- compute which bundle children are safely retryable
- let an authorized operator request that retry explicitly
- link the request to the real command rail and child outcome

## Model

`allocator_rebalance_bundle_recovery_actions` stores one row per explicit recovery request.

Each row records:

- bundle id
- proposal id
- recovery action type
- target child type
- target child id
- target child status and summary snapshot
- eligibility snapshot
- blocked reasons
- approval requirement
- status lifecycle
- linked command id when queued
- linked carry or treasury action id
- outcome summary and failure reason
- mode and simulated truth
- operator note and timestamps

## Action Set

This phase intentionally supports one recovery mutation:

- `requeue_child_execution`

Supported targets:

- `carry_action`
- `treasury_action`

Explicitly unsupported in this pass:

- generic proposal replay
- hidden child recreation
- autonomous retries

## Eligibility Model

Eligibility is computed in the backend and returned as bundle recovery candidates.

A candidate is `eligible` only when:

- the bundle is in an intervention state
- runtime is not paused, stopped, starting, or halted
- the target child exists and is proposal-linked
- the target child is not already completed
- the target child is not already queued or executing
- the target child is not still blocked by its own persisted readiness reasons
- replay would not duplicate recorded external progress

Additional child-specific rules:

- carry child retries are blocked if execution steps show venue order ids, execution references, or any non-failed progress
- treasury child retries are blocked if any execution recorded a venue execution reference
- proposal replay is always blocked in this pass

## Lifecycle

Recovery action statuses used in this pass:

- `requested`
- `queued`
- `executing`
- `completed`
- `failed`
- `blocked`

Flow:

1. Operator requests recovery for a bundle child.
2. Backend computes the candidate and persists the request.
3. If blocked, the row is finalized as `blocked`.
4. If eligible, backend queues the real child command and marks the row `queued`.
5. Worker marks the row `executing` when command work begins.
6. Worker marks the row `completed` or `failed` from the command outcome.

## Timeline Integration

Bundle timelines now include recovery events:

- recovery requested
- recovery queued
- recovery completed
- recovery failed
- recovery blocked

These entries do not overwrite bundle finalization metadata.

They extend the operator narrative while the bundle rollup continues to derive from proposal and child truth.
