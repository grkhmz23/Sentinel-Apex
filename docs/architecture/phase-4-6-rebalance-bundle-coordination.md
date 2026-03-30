# Phase 4.6 Rebalance Bundle Coordination

Date: 2026-03-30

## Purpose

Phase 4.6 turns one approved rebalance proposal into one coordinated rebalance bundle.

The bundle is the operator-facing answer to:

- is the rebalance still running
- is it safely complete
- is it partially applied
- does it require intervention

## Model

`allocator_rebalance_bundles` stores one durable bundle row per proposal.

The row persists:

- proposal linkage
- bundle status
- completion state
- outcome classification
- intervention recommendation
- child rollup counts
- finalization metadata

The bundle detail response wraps the existing rebalance execution graph rather than replacing it.

## Rollup Rules

Bundle state is derived from persisted proposal and downstream child truth.

- rejected proposal -> `rejected`
- proposal queued or open downstream work -> `queued` or `executing`
- all downstream work complete -> `completed`
- completed child plus blocked child -> `requires_intervention`
- completed child plus failed child -> `requires_intervention`
- blocked child with no successful child -> `blocked`
- failed child with no successful child -> `failed`

Outcome classifications:

- `pending`
- `safe_complete`
- `partial_application`
- `blocked`
- `failed`
- `rejected`

## Recovery Semantics

This phase does not add retry automation.

It adds explicit operator guidance only:

- `no_action_needed`
- `wait_for_inflight_children`
- `inspect_child_failures`
- `operator_review_required`
- `unresolved_partial_application`

## API Shape

Allocator API now exposes:

- `GET /api/v1/allocator/rebalance-bundles`
- `GET /api/v1/allocator/rebalance-bundles/:bundleId`
- `GET /api/v1/allocator/rebalance-bundles/:bundleId/timeline`
- `GET /api/v1/allocator/rebalance-proposals/:proposalId/bundle`

## Honest Boundaries

Phase 4.6 does not:

- auto-retry failed children
- auto-heal partial application
- introduce autonomous routing
- hide simulated or budget-state-only work behind a fake “success”

It only makes the coordinated execution truth explicit and operator-readable.
