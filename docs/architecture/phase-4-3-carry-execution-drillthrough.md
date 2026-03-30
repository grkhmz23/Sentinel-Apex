# Phase 4.3 Carry Execution Drill-Through

Date: 2026-03-30

## Goal

Expose carry execution as a first-class operator read model rather than only as a field embedded under carry action detail.

Operators should be able to inspect:

- what execution attempt happened
- which carry action and rebalance proposal it came from
- which execution steps were attempted
- which venue references exist
- whether the path was dry-run, simulated, blocked, failed, or completed

## Model

Phase 4.3 keeps the existing top-level execution record:

- `carry_action_executions`

and adds a step-level table:

- `carry_execution_steps`

This yields the following read model:

- `CarryExecutionView`: top-level execution summary for lists and action drill-through
- `CarryExecutionDetailView`: operator detail surface containing
  - `execution`
  - `action`
  - `command`
  - `linkedRebalanceProposal`
  - `venueSnapshots`
  - `steps`
  - `timeline`

## Step Semantics

Execution steps are the honest unit for downstream carry execution detail.

Each step captures:

- the originating planned carry order intent
- venue id and venue capability snapshot fields seen at execution time
- requested order parameters
- client and venue references when available
- simulated flag
- step status
- fill summary / average price when available
- outcome summary and error detail

If a connector does not provide venue-native order detail, the step still persists the operator-meaningful fields that actually exist.

## Runtime Recording

`execute_carry_action` now records:

1. top-level execution row creation
2. per-planned-order step creation
3. per-step completion or failure update
4. final top-level execution outcome update
5. durable carry action completion/failure update

Blocked or unsupported paths still produce an explicit top-level execution attempt. Step rows only exist for actual downstream order-like work.

## API Surfaces

Carry execution transparency now relies on:

- `GET /api/v1/carry/executions`
- `GET /api/v1/carry/executions/:executionId`
- `GET /api/v1/carry/actions/:actionId/executions`

The detail endpoint returns the dedicated detail model, not just the flat execution row.

## Dashboard Surfaces

The operator UI now includes:

- `/carry/executions`
- `/carry/executions/[executionId]`

Existing pages also cross-link into execution detail:

- carry overview
- carry action detail
- rebalance proposal detail

## Boundaries

- This is not a full OMS or trading blotter.
- Rebalance execution still does not hide autonomous carry deployment.
- Simulated and live references remain explicitly labeled.
- Unsupported venue-native detail is not invented.
