# Atlas Treasury Operational Rules

Date: 2026-03-21

Phase 3.1 enforces treasury execution rules in backend logic before any treasury action is queued or executed.

## Hard Rules

### 1. Reserve Floor Protection

No treasury allocation may execute if post-action idle treasury cash would fall below:

- `requiredReserveUsd`

If this would happen, the action is blocked with `reserve_floor_breach`.

### 2. Minimum Remaining Liquid Balance

No treasury allocation may execute if post-action idle treasury cash would fall below:

- `minimumRemainingIdleUsd`

If this would happen, the action is blocked with `minimum_remaining_liquidity_breach`.

### 3. Venue Concentration Cap

No allocation may execute if it would push a venue above:

- `maxAllocationPctPerVenue`

If this would happen, the action is blocked with `venue_concentration_breach`.

### 4. Venue Eligibility

Deposits may only target venues on `eligibleVenues`.

If a deposit targets an ineligible venue, the action is blocked with `venue_ineligible`.

### 5. Action Size Guardrail

No treasury action may execute if the amount is below:

- `minimumDeployableUsd`

If this happens, the action is blocked with `below_minimum_action_size`.

### 6. Capacity Guardrails

- deposits cannot exceed venue available capacity
- reductions cannot exceed venue withdrawal availability

Blocked reasons:

- `venue_capacity_exceeded`
- `withdrawal_capacity_exceeded`

### 7. Venue Health

Deposits cannot target unhealthy venues.

Blocked reason:

- `venue_unhealthy`

### 8. Simulated vs Real Execution Guardrail

- simulated venues may execute in dry-run mode
- live venues may only execute when runtime mode is `live` and live execution is enabled

Blocked reason:

- `live_execution_disabled`

### 9. Connector Capability Guardrail

If a venue does not explicitly support treasury execution or a specific treasury action type, runtime blocks execution.

Blocked reason:

- `venue_execution_unsupported`

## Approval Rules

- simulated treasury execution requires operator approval
- live treasury execution requires admin approval
- blocked actions cannot be approved or executed

## Execution-Time Revalidation

Treasury actions are revalidated immediately before execution using:

- latest treasury venue snapshots
- current treasury cash balance
- current runtime execution mode and live-mode gating
- current venue capabilities

This prevents stale approved actions from executing after treasury conditions have changed.
