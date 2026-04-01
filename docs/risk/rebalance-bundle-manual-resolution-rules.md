# Rebalance Bundle Manual Resolution Rules

Date: 2026-03-31

## Intent

Manual bundle resolution must be explicit, restricted, and auditable.

This phase does not allow silent closure or automatic conversion of partial application into successful completion.

## Global Rules

- Manual resolution is only available for bundles in intervention-oriented states such as `failed`, `blocked`, `requires_intervention`, or `partially_completed`.
- Read-only roles may inspect bundle resolution options and history but may not request manual resolution.
- Every manual-resolution request requires a non-empty operator note.
- Blocked manual-resolution requests are still persisted so the attempted decision remains auditable.
- Manual resolution does not queue commands, child actions, or hidden retries.

## Accept Partial Application

`accept_partial_application` is only allowed when:

- the bundle outcome classification is `partial_application`
- no downstream child is still in flight
- the operator explicitly acknowledges the partial state through the recorded note

This decision means:

- the operator accepts the current partial application as the correct current closure state
- the bundle remains visibly partial in history
- prior failure and recovery context stays visible

## Manual Resolution

`mark_bundle_manually_resolved` is only allowed when:

- the bundle is actionable for intervention
- no downstream child is still in flight
- the operator has inspected the persisted downstream state and recorded rationale

This decision means:

- the operator is closing the bundle without claiming that all child execution succeeded
- the closure is explicit and attributable

## Escalation

`escalate_bundle_for_review` is only allowed when:

- the bundle is actionable for intervention
- no downstream child is still in flight
- the operator records why the bundle remains open for further review

This decision means:

- the bundle remains visibly escalated
- the system does not pretend the bundle is resolved

## Truth-Preservation Rules

- Manual resolution must not erase failure history.
- Manual resolution must not erase recovery history.
- Bundle execution status and bundle resolution state are distinct concepts.
- Operator closure overlays the recommendation and decision context, but not the underlying child outcome truth.
