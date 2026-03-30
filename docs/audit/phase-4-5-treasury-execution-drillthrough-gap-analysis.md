# Phase 4.5 Treasury Execution Drill-Through Gap Analysis

Date: 2026-03-30

## 1. Current Treasury Execution Data Model

- Treasury already persists:
  - `treasury_actions`
  - `treasury_action_executions`
  - `treasury_venue_snapshots`
  - `treasury_runs`
- Runtime already exposes treasury action detail and treasury execution detail.
- Treasury execution detail currently includes:
  - execution summary row
  - linked action
  - linked command
  - linked venue snapshot
  - action-centric timeline

## 2. Current Operator Drill-Through Limitations

- Treasury actions did not carry explicit `linkedRebalanceProposalId`, unlike carry actions.
- Rebalance proposal drill-through could not return real downstream treasury action/execution nodes for proposal-originated treasury work.
- Treasury had execution detail pages but no dedicated treasury execution list page.
- Treasury action detail did not surface parent rebalance linkage.
- Treasury execution detail did not distinguish venue execution from budget-state-only treasury application.
- API lacked action-scoped treasury execution listing.

## 3. Target Treasury Execution Detail / Read-Model Design

- Add explicit proposal linkage on treasury actions.
- Treat treasury execution detail as a dedicated operator read model with:
  - execution record
  - parent action
  - optional parent rebalance proposal
  - execution kind:
    - `venue_execution`
    - `budget_state_application`
  - command linkage
  - venue capability snapshot where applicable
  - execution timeline filtered to the relevant action/execution context
- Make rebalance-created treasury budget applications durable as treasury action + execution records instead of leaving them implicit.

## 4. Required Changes

- Schema:
  - add `treasury_actions.linked_rebalance_proposal_id`
- Runtime/store:
  - map treasury proposal linkage into views
  - add treasury action creation helper for rebalance-originated budget actions
  - add action-scoped treasury execution listing
  - enrich treasury execution detail with linked proposal and execution kind
  - have rebalance execution create treasury action/execution records for budget-state-only treasury changes
  - have rebalance graph query treasury actions by proposal id
- API:
  - add `GET /api/v1/treasury/actions/:actionId/executions`
- Dashboard:
  - add treasury executions list page
  - show parent rebalance links on treasury action/execution detail
  - let rebalance proposal detail consume real treasury downstream nodes when present

## 5. Priority Implementation Plan

1. Add treasury proposal linkage to schema and runtime view types.
2. Persist rebalance-originated treasury budget application as treasury action + execution.
3. Extend treasury execution detail and action detail with linked proposal context.
4. Add action-scoped treasury executions endpoint and treasury execution list page.
5. Update rebalance graph tests, API tests, dashboard tests, and docs.
