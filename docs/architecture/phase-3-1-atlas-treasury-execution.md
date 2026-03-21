# Phase 3.1 Atlas Treasury Controlled Execution

Date: 2026-03-21

## Overview

Phase 3.1 moves Atlas Treasury from recommendation persistence to controlled execution semantics.

This pass does not introduce allocator logic and does not claim real live treasury connectors. It adds:

- execution-ready treasury intents
- explicit approval and execution lifecycle
- backend treasury operational rules
- append-only treasury execution history
- runtime-command-backed treasury execution
- dashboard and API visibility into execution state

## Execution Model

### Recommendation Layer

`TreasuryPolicyEngine` still produces deterministic recommendations:

- `deposit`
- `redeem`

These are not directly executable. They are policy outputs.

### Execution Intent Layer

`TreasuryExecutionPlanner` transforms recommendations into execution-ready intents with:

- normalized action type:
  - `allocate_to_venue`
  - `reduce_venue_allocation`
- readiness:
  - `actionable`
  - `blocked`
- explicit blocked reasons
- approval requirement:
  - `operator`
  - `admin`
- execution mode:
  - `dry-run`
  - `live`
- execution effects:
  - post-action idle cash
  - post-action allocated capital
  - reserve shortfall effect
  - post-action concentration effect

### Lifecycle

Treasury action lifecycle:

- `recommended`
- `approved`
- `queued`
- `executing`
- `completed`
- `failed`

### Approval

- simulated treasury actions require operator-level approval
- live treasury actions require admin approval
- blocked actions cannot be approved

### Execution Rail

Treasury execution reuses the existing runtime command rail:

- `run_treasury_evaluation`
- `execute_treasury_action`

The worker remains the only component that performs treasury execution.

## Persistence Model

### `treasury_actions`

Current-state row for each treasury recommendation/action with:

- readiness
- executable flag
- blocked reasons
- approval requirement
- status
- command linkage
- latest execution linkage
- error state

### `treasury_action_executions`

Append-only execution attempts with:

- command linkage
- requested actor
- worker actor
- blocked reasons
- execution outcome
- venue execution reference
- timestamps

### `treasury_current`

Now also stores:

- `cash_balance_usd`

This lets the treasury sleeve keep an internal idle-cash ledger after execution instead of reusing only the portfolio tracker input.

## Runtime Flow

1. Runtime evaluates treasury policy against latest treasury venue snapshots and treasury cash balance.
2. Runtime persists treasury actions enriched with execution readiness and approval metadata.
3. Operator approves an actionable treasury action through the API/dashboard.
4. Operator queues execution.
5. Worker claims `execute_treasury_action`.
6. Runtime revalidates the action against current treasury conditions.
7. If blocked, execution is persisted as failed with durable blocked reasons.
8. If allowed, the treasury venue adapter executes and returns an explicit venue execution reference.
9. Runtime persists execution outcome and re-evaluates treasury using the updated treasury cash balance.

## Honest Boundaries

- Simulated treasury execution is explicitly labeled simulated.
- Dry-run remains the default runtime mode.
- Live treasury execution still requires a live-capable adapter plus runtime live-mode gating.
- This pass does not implement the allocator, treasury optimization, or real production capital routing.
