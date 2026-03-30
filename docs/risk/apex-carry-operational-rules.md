# Apex Carry Operational Rules

Date: 2026-03-30

## Objective

These rules define when a Carry action is actionable, blocked, simulated-only, or requires stronger approval. They are enforced in backend planning and execution logic, not only in UI presentation.

## Enforced Rules

### 1. Minimum Action Size

- Carry actions below the configured minimum actionable USD threshold are blocked.
- Current default: `2500 USD`.

Blocked reason:

- `below_minimum_action_size`

### 2. Runtime Readiness

- Carry execution is blocked if runtime is halted or lifecycle state is not execution-safe.
- Blocked lifecycle states:
  - `starting`
  - `paused`
  - `stopped`
  - `degraded`

Blocked reason:

- `runtime_not_ready`

### 3. Critical Mismatch Gating

- Any open critical mismatch pressure blocks carry execution.
- This prevents new carry deployment while system integrity is unresolved.

Blocked reason:

- `critical_mismatch_pressure`

### 4. Carry Throttle Gating

- New or restored carry deployment is blocked when carry throttle state is not normal.
- Applies to:
  - `increase_carry_exposure`
  - `restore_carry_budget`
- Throttle states that block deployment:
  - `throttled`
  - `de_risk`
  - `blocked`

Blocked reason:

- `carry_throttle_active`

### 5. Carry Budget and Exposure Ceiling

- New carry deployment is blocked when the action would exceed the approved carry budget.
- Reductions are allowed even when current exposure already exceeds budget.

Blocked reason:

- `carry_budget_exceeded`

### 6. Opportunity Confidence Threshold

- If recommendation details include a confidence score, it must meet the configured minimum threshold.
- Current default minimum confidence: `0.60`.

Blocked reason:

- `opportunity_confidence_below_threshold`

### 7. Opportunity Freshness

- If a recommendation carries an expiry timestamp and it has expired, execution is blocked.

Blocked reason:

- `opportunity_expired`

### 8. Position Reduction Capacity

- Carry reductions require real open positions to reduce.
- A reduction request is blocked if:
  - there are no open positions
  - planned reducible notional is below requested reduction notional

Blocked reasons:

- `no_open_positions`
- `insufficient_position_reduction_capacity`

### 9. Venue Capability Checks

- Every venue touched by a carry action must explicitly support carry controlled execution.
- Read-only or unsupported venues block execution.
- Action-specific support is enforced separately for increase vs reduce behavior.

Blocked reasons:

- `venue_execution_unsupported`

### 10. Simulated Versus Live Restrictions

- Live carry execution requires:
  - runtime execution mode `live`
  - live execution enabled
  - venue mode `live`
  - venue approved for live use
- Simulated-only venues block live carry execution.

Blocked reasons:

- `live_execution_disabled`
- `simulated_execution_only`
- `venue_live_unapproved`

## Approval Rules

- Simulated carry actions default to `operator` approval.
- Live-capable carry actions escalate to `admin` approval.
- Approval is enforced by backend role checks before queueing execution.

## Operator Interpretation

- `readiness = actionable`
  - rule set passed and action may be approved
- `readiness = blocked`
  - at least one backend rule failed; approval is rejected
- `simulated = true`
  - outcome is durable and audit-grade, but connector path is explicitly non-live

## Current Boundary

Carry controlled execution in Phase 4.2 is operationally safe and auditable, but not yet a full live OMS:

- simulated execution is supported
- unsupported live venues remain explicit
- approval never bypasses missing venue support or runtime safety rules
