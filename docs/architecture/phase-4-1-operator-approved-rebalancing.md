# Phase 4.1 Operator-Approved Rebalancing

Date: 2026-03-30

## Overview

Phase 4.1 adds the first explicit bridge from Sentinel allocator outputs to sleeve-level rebalance actions.

The workflow is:

- allocator evaluation
- rebalance proposal generation
- operator review
- operator approval or rejection
- explicit runtime command
- worker execution
- persisted execution outcome
- optional application of the approved sleeve-budget state

This remains intentionally non-autonomous.

## Boundary

- `packages/allocator` owns:
  - rebalance proposal domain types
  - deterministic proposal planning from allocator targets
  - rebalance blocked-reason generation
- `packages/runtime` owns:
  - persistence
  - approval transitions
  - command creation
  - worker execution
  - applied current-state projection
- `apps/api` and `apps/ops-dashboard` stay thin over those backend contracts

## State Model

Proposal statuses:

- `proposed`
- `approved`
- `queued`
- `executing`
- `completed`
- `failed`
- `rejected`

Each proposal also persists sleeve-level intents.

Those intents make the proposal auditable without pretending the sleeves are identical internally.

## Sleeve Intent Model

The first action vocabulary is explicit:

- `increase_treasury_allocation`
- `reduce_treasury_allocation`
- `increase_carry_budget`
- `reduce_carry_budget`
- grouped proposal action: `rebalance_between_sleeves`

For now, execution is budget-state oriented:

- carry participates through explicit budget-change intents
- treasury participates through explicit budget-change intents
- no hidden venue routing is triggered from allocator approval

## Execution Semantics

Dry-run:

- proposal executes on the command rail
- execution outcome is persisted
- current approved sleeve-budget state is not changed

Live:

- proposal executes on the command rail
- current approved sleeve-budget state is updated
- this still does not silently route capital into venue adapters

That separation preserves honest product boundaries while still enabling a real operator workflow.

## Persistence

Phase 4.1 adds:

- rebalance proposals
- rebalance proposal intents
- rebalance executions
- current approved rebalance state

This lets operators inspect:

- what allocator recommended
- what proposal was created
- why it was blocked or allowed
- who approved or rejected it
- which command executed it
- what execution outcome was recorded

## Policy Checks

Approval and execution remain blocked when:

- runtime is not ready
- critical mismatch pressure is active
- carry throttle / de-risk posture blocks a carry increase
- treasury reserve shortfall exists
- treasury idle capital cannot fund the requested carry increase
- action size is below the minimum actionable threshold
- live execution is requested while live mode is disabled

## Current Limitation

Phase 4.1 deliberately stops at operator-approved portfolio-budget state.

It does not yet:

- autonomously convert approved rebalance proposals into treasury venue moves
- autonomously deploy newly approved carry budget into carry positions
- perform cross-sleeve optimization beyond allocator targets
