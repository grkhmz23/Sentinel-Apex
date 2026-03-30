# Sentinel Allocator

Date: 2026-03-30

## Phase 4.4 Addendum: Operator Execution Graph

Sentinel still does not route capital autonomously.

Phase 4.4 changes operator visibility, not allocator autonomy:

- rebalance proposal detail now has a backend-native execution graph
- operators can inspect proposal -> command -> downstream carry action/execution linkage directly
- treasury participation remains explicit when it is only represented as approved budget-state application rather than proposal-linked treasury actions

## Phase 4.5 Addendum: Treasury Graph Symmetry

Phase 4.5 improves downstream treasury visibility, not allocator autonomy.

- rebalance proposals can now link to proposal-scoped treasury actions and treasury executions when runtime persists them
- treasury budget-state-only applications remain explicit rather than being disguised as venue-native treasury execution
- proposal drill-through is now more symmetric across carry and treasury, while preserving the real execution boundary of each sleeve

This keeps allocator semantics institutional and honest: proposal approval still drives explicit execution, and drill-through now reflects that workflow end to end.

## Phase 4.6 Addendum: Rebalance Bundle Coordination

Phase 4.6 adds coordinated execution semantics, not allocator autonomy.

- one rebalance proposal now maps to one coordinated rebalance bundle
- bundle status is derived from persisted proposal, carry, and treasury child truth
- operators can now see whether a rebalance is complete, partially applied, blocked, failed, or awaiting intervention
- bundle recommendations tell the operator whether to wait, inspect failures, or review an unresolved partial application

Sentinel still does not auto-retry, auto-heal, or autonomously route capital.

## Product Role

Sentinel is the portfolio allocator for Sentinel Apex.

Its job in this phase is not to trade. Its job is to:

- understand the current Carry and Treasury sleeve posture
- compute explicit portfolio budgets for those sleeves
- factor reserve pressure and operational degradation into those budgets
- produce inspectable recommendations and rationale for operators

## What Exists In Phase 4.0

The first Sentinel allocator foundation is intentionally narrow and deterministic:

- two sleeves only:
  - `carry`
  - `treasury`
- policy-driven budgeting
- explicit regime / pressure interpretation
- current-vs-target sleeve budgets
- persisted rebalance recommendations
- explicit rationale and constraints
- dry-run-first evaluation with no hidden execution side effects

## Current Inputs

Sentinel currently reasons over:

- runtime lifecycle and halted state
- mismatch pressure and critical mismatch count
- recent reconciliation issue count
- treasury reserve coverage and reserve shortfall
- carry opportunity count and normalized opportunity quality
- sleeve health / throttle state

This is enough to steer portfolio budgets safely without pretending a complete market-regime engine already exists.

## Current Policy Shape

The first policy starts from a baseline Carry/Treasury split and then applies explicit caps or downweights when:

- treasury reserve coverage is weak
- runtime is degraded or halted
- critical mismatches exist
- reconciliation pressure is active
- the carry sleeve is throttled or degraded
- carry opportunity quality is weak

Carry can receive a modest uplift only when:

- operational pressure is normal
- reserve posture is healthy
- carry opportunity quality is strong

Every decision emits structured rationale and constraint records so operators can inspect why the budget moved.

## Outputs

Each allocator evaluation persists:

- allocator run metadata
- regime and pressure state
- current-vs-target sleeve allocations
- sleeve-level delta and throttle interpretation
- rebalance recommendations
- rationale and binding constraints

These outputs are visible in:

- API allocator endpoints
- the ops dashboard allocator page
- allocator decision detail views

## Phase 4.1 Rebalance Workflow

Allocator outputs now also feed an explicit operator-approved rebalance layer.

That layer adds:

- durable rebalance proposals
- sleeve-specific rebalance intents
- blocked-reason visibility
- operator approval / rejection
- explicit runtime command linkage
- persisted execution outcomes
- current approved sleeve-budget state

This still does not introduce autonomous routing.

It is a controlled bridge from:

- allocator recommendation
- to approved portfolio-budget action

The first implementation is intentionally budget-first:

- carry participates through explicit budget adjustment intents
- treasury participates through explicit budget adjustment intents
- dry-run execution records outcomes without changing current approved budget state
- live execution applies the approved current sleeve-budget state but still does not silently route venue actions

## Deliberate Non-Goals In This Phase

This phase does not include:

- autonomous cross-sleeve execution
- ML or predictive allocation logic
- advanced portfolio optimization
- final production portfolio automation
- hidden carry or treasury venue routing from allocator approval

Those are later decisions. In this phase Sentinel is a deterministic, auditable portfolio steering layer.
