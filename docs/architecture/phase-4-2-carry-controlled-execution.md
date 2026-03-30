# Phase 4.2 Carry Controlled Execution

Date: 2026-03-30

## Purpose

Phase 4.2 makes Carry a controlled sleeve with explicit action lifecycle, backend-enforced operational gating, durable execution history, and honest simulated-versus-live visibility.

This pass does not add autonomous routing. Allocator evaluation still does not hide side effects. Carry actions remain explicit operator-visible artifacts that move through the existing runtime command rail.

## Model

Carry controlled execution now introduces these first-class concepts:

- `CarryExecutionRecommendation`
  - execution-ready recommendation produced from approved strategy opportunities or rebalance-driven reduction/restore requirements
- `CarryExecutionIntent`
  - durable action payload with readiness, blocked reasons, approval requirement, execution mode, and deterministic order plan
- `CarryActionView`
  - persisted action record with lifecycle state, linkage, execution plan, actor metadata, and latest execution state
- `CarryExecutionView`
  - append-only execution attempt with blocked reasons, outcome payload, error state, and optional venue execution reference
- `CarryVenueView`
  - persisted capability snapshot exposing simulation/live mode, onboarding state, missing prerequisites, and execution support

## Lifecycle

Carry actions use the following lifecycle:

- `recommended`
- `approved`
- `queued`
- `executing`
- `completed`
- `failed`

Blocked conditions do not create a separate terminal status. They are persisted as `recommended` actions with `readiness = blocked`, `executable = false`, and structured blocked reasons.

## Command Rail Integration

Carry uses the same runtime/control-plane/worker system as Treasury and rebalance execution.

- `run_carry_evaluation`
  - evaluates approved strategy opportunities into explicit carry actions
- `execute_carry_action`
  - executes an approved carry action through the runtime worker

Approval remains backend-enforced. For carry, approval currently queues execution immediately, matching the existing operator-approved rebalance flow.

## Rebalance Linkage

Allocator rebalance execution now links explicitly into carry execution paths:

- positive carry deltas
  - trigger carry evaluation against the source strategy run and persist downstream carry actions linked to the rebalance proposal
- negative carry deltas
  - create deterministic reduce-only carry action intents from current open positions

Rebalance execution outcomes now persist `downstreamCarryActionIds` so operators can move from proposal execution to carry action detail without guessing.

## Simulated Versus Live

The implementation is intentionally honest:

- simulated carry execution is fully modeled and persisted
- live carry execution remains gated behind runtime live mode and venue approval
- venues without real controlled-execution support are marked unsupported or read-only
- simulated-only venues block live carry execution explicitly

## Persistence

Phase 4.2 adds durable storage for:

- `carry_venue_snapshots`
- `carry_actions`
- `carry_action_order_intents`
- `carry_action_executions`

These tables are designed to preserve recommendation lineage, operator approval, command linkage, execution attempts, venue references, and rebalance linkage.

## Operator Surfaces

The API and dashboard now expose:

- carry recommendations/actions
- carry action detail
- carry execution history
- carry venue readiness and simulation state
- carry approval controls
- rebalance proposal linkage into downstream carry actions

## Non-Goals

Still out of scope after Phase 4.2:

- autonomous allocator-to-venue routing
- production-grade live carry OMS behavior
- hidden treasury/carry deployment side effects during allocator evaluation
- unsupported live carry connectors masquerading as production-ready
