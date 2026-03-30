# Phase 4.5 Treasury Execution Drill-Through

## Purpose

Phase 4.5 closes the operator drill-through gap between Carry and Treasury.

The design goal is not to invent a larger treasury engine. It is to expose treasury execution truth in a first-class operator model and to make rebalance drill-through symmetric where the repo now has real persisted linkage.

## Design

### Treasury Action Linkage

- Treasury actions now support optional `linkedRebalanceProposalId`.
- Proposal-linked treasury actions are used for rebalance-originated treasury budget changes.
- This mirrors the existing carry proposal linkage model without pretending treasury always has venue-native execution.

### Treasury Execution Detail

Treasury execution detail is now treated as a dedicated operator read model with:

- execution record
- parent treasury action
- linked runtime command
- optional parent rebalance proposal
- execution kind:
  - `venue_execution`
  - `budget_state_application`
- venue snapshot when a real venue is involved
- ordered timeline filtered to the relevant action/execution context

### Budget-State-Only Treasury Execution

Not every treasury effect is a venue-native allocation change.

For rebalance flows that only move approved treasury sleeve budget state, runtime now persists:

- a treasury action with `actionType = rebalance_treasury_budget`
- a treasury execution with `executionKind = budget_state_application`

This keeps the system honest:

- no fake venue order data is invented
- operators still get durable action/execution records
- the rebalance execution graph can link into treasury downstream detail directly

### Rebalance Graph Symmetry

The rebalance execution graph now queries proposal-linked treasury actions/executions the same way it already queries carry actions/executions.

If no treasury downstream action records exist, the graph still falls back to the explicit budget-state note. If treasury detail exists, the graph returns it directly and the dashboard links operators into treasury action/execution pages.
