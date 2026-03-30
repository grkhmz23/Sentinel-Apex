# Sentinel Rebalance Operational Rules

Date: 2026-03-30

Phase 4.1 enforces rebalance approval and execution rules in backend logic before any allocator-derived rebalance proposal can be queued or executed.

## Hard Rules

### 1. Runtime Readiness

Rebalance approval is blocked when runtime is:

- `paused`
- `stopped`
- `starting`
- explicitly halted

Blocked reason:

- `runtime_not_ready`

### 2. Critical Mismatch Pressure

Rebalance approval is blocked when critical mismatches remain open.

Blocked reason:

- `critical_mismatch_pressure`

### 3. Minimum Actionable Size

No rebalance proposal is actionable if the computed capital shift is below:

- `minimumActionableUsd`

Blocked reason:

- `below_minimum_action_size`

### 4. Carry Throttle Protection

Carry budget cannot be increased while carry is:

- degraded
- blocked
- in `de_risk`
- in `blocked` throttle state

Blocked reason:

- `carry_throttle_active`

### 5. Treasury Reserve Protection

Treasury-to-carry rebalance is blocked if treasury reserve is already short.

Blocked reason:

- `treasury_reserve_shortfall`

### 6. Treasury Idle-Capital Requirement

Carry budget cannot be increased from treasury budget unless treasury has enough idle capital to fund the requested move without hidden venue reductions.

Blocked reason:

- `insufficient_treasury_idle_capital`

### 7. Live-Mode Guardrail

If a rebalance proposal is in live mode, runtime must also have live execution enabled.

Blocked reason:

- `live_execution_disabled`

## Approval Rules

- dry-run rebalance proposals require operator approval
- live rebalance proposals require admin approval
- blocked proposals cannot be approved
- rejected proposals cannot be re-approved without a new proposal

## Execution-Time Revalidation

Rebalance proposals are revalidated at execution time against:

- current runtime readiness
- current mismatch pressure
- current treasury reserve shortfall
- current treasury idle capital
- current live-mode gating

This prevents stale proposals from being applied after the operational posture has changed.

## Important Scope Boundary

Phase 4.1 applies only to approved sleeve-budget state.

It does not silently:

- trigger treasury venue redeployments
- trigger carry venue deployment
- bypass treasury operational rules
- bypass operator approval
