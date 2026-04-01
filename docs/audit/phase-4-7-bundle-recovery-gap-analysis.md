# Phase 4.7 Bundle Recovery Gap Analysis

Date: 2026-03-31

## 1. Current Bundle Intervention Model

Before Phase 4.7, Phase 4.6 already provided:

- durable rebalance bundle rows
- bundle status, completion state, outcome classification, and intervention recommendation
- proposal-scoped bundle detail and timeline
- downstream carry and treasury child rollups

The operator could inspect:

- whether the bundle failed
- whether it was blocked
- whether it partially applied
- which child action or execution caused intervention pressure

The operator could not yet trigger a first-class bundle-scoped recovery mutation.

## 2. Current Retry / Requeue Capabilities And Hard Limits

What the repo could already do honestly:

- queue `execute_carry_action` for an explicit carry action
- queue `execute_treasury_action` for an explicit treasury action
- queue `execute_rebalance_proposal` for an approved proposal
- persist child action and execution history with command linkage

Hard limits before this phase:

- no bundle recovery action model
- no bundle-to-recovery-to-command linkage
- no backend-computed recovery candidates
- no operator-readable retry eligibility rules
- no bundle recovery history in API or dashboard

Important retry boundaries from the existing rails:

- failed carry children are only safely requeueable when no venue-side progress was recorded
- failed treasury venue children are only safely requeueable when no venue execution reference was recorded
- proposal-level rebalance replay is not safely generic because it can duplicate downstream child work
- blocked children remain inspect-only until their persisted blocked reasons are no longer binding

## 3. Target Bundle Recovery Action Design

Phase 4.7 adds a first-class bundle recovery action model with:

- one durable row per explicit operator recovery request
- parent bundle id and proposal id
- target child type and target child id
- recovery action type
- eligibility snapshot and blocked reasons at request time
- approval requirement
- linked runtime command id when queued
- linked target child action ids
- outcome summary, failure reason, and timestamps

This phase intentionally keeps the action set narrow:

- `requeue_child_execution`

Supported target children in this pass:

- proposal-linked carry actions
- proposal-linked treasury actions

Proposal-level retry is exposed as blocked / unsupported rather than faked.

## 4. Required Changes

Schema:

- add `allocator_rebalance_bundle_recovery_actions`

Runtime / store / worker:

- add recovery action read models and candidate models
- compute bundle recovery candidates from persisted bundle and child truth
- persist blocked and queued recovery requests
- link queued recovery actions to explicit runtime commands
- mark recovery actions executing / completed / failed from worker command outcomes
- keep bundle rollup and timeline truthful after recovery attempts

API:

- add bundle recovery candidates endpoint
- add bundle recovery action list/detail endpoints
- add explicit bundle recovery request mutation

Dashboard:

- add recovery candidates section to bundle detail
- add recovery history section to bundle detail
- add operator trigger UI for eligible recovery actions

## 5. Implementation Plan In Priority Order

1. Add durable recovery-action schema and runtime types.
2. Add backend eligibility computation for child-scoped bundle recovery.
3. Persist blocked and queued bundle recovery requests with command linkage.
4. Update worker flow to finalize recovery actions from command outcomes.
5. Extend bundle detail and timeline with recovery history.
6. Expose allocator API endpoints for candidates, history, detail, and request.
7. Extend the dashboard bundle page with candidate and history views.
8. Add deterministic runtime / API / dashboard tests for safe retryability and blocked cases.
