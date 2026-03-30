# Phase 4.3 Carry Execution Drill-Through Gap Analysis

Date: 2026-03-30
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Carry Execution Data Model

Before this pass, carry execution persistence already included:

- `carry_actions` for operator-visible carry action lifecycle
- `carry_action_order_intents` for deterministic planned orders attached to a carry action
- `carry_action_executions` for top-level execution attempts, mode, summary outcome, blocked reasons, and aggregate venue execution reference

Runtime already linked allocator rebalance execution to downstream carry actions through rebalance execution outcome payloads and `carry_actions.linked_rebalance_proposal_id`.

## 2. Current Operator Drill-Through Limitations

The main execution truth existed, but operator drill-through was still weak:

- carry execution detail was only a flat `CarryExecutionView`
- per-order/per-step results were only implicit in top-level execution outcome JSON
- action detail exposed execution attempts, but not dedicated execution drill-through pages
- API had `/api/v1/carry/executions/:executionId`, but it returned only the flat execution row
- rebalance proposal detail linked to downstream carry actions, but not directly to downstream carry execution attempts

## 3. Target Carry Execution Detail / Read-Model Design

Phase 4.3 adds a dedicated execution-detail model built around:

- one top-level carry execution record per command-backed execution attempt
- durable execution steps for each downstream order-like unit
- explicit venue capability snapshot fields captured at step-recording time
- direct linkage from execution -> carry action -> rebalance proposal
- operator timeline entries derived from action lifecycle and execution-step recording

The design remains honest:

- carry execution steps are called execution steps, not venue-native orders, unless the adapter actually returned a venue order id/reference
- simulated and live paths remain explicit at both the execution and step level
- no unsupported live venue detail is fabricated

## 4. Required Changes

Schema:

- add `carry_execution_steps`

Runtime / worker:

- persist step rows during `execute_carry_action`
- capture per-step status, references, fill summary, and errors
- expose a dedicated `CarryExecutionDetailView`

API:

- keep execution list
- add action-scoped execution list
- upgrade execution detail endpoint to return the richer detail shape

Dashboard:

- add carry execution list page
- add carry execution detail page
- link carry overview, carry action detail, and rebalance proposal detail into execution drill-through

## 5. Implementation Plan Priority

1. Add durable execution-step persistence and runtime detail query shape.
2. Upgrade API carry execution detail and add action-scoped execution listing.
3. Add dashboard carry execution list/detail pages and wire direct links.
4. Harden rebalance proposal drill-through to downstream carry execution attempts.
5. Add targeted runtime, API, and dashboard coverage for execution drill-through.
