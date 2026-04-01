# Phase 4.8 Bundle Manual Resolution

Date: 2026-03-31

## Purpose

Phase 4.8 adds explicit operator closure semantics for rebalance bundles that are partially applied, non-retryable, or otherwise still require judgment after retryable recovery paths have been exhausted.

This phase does not add autonomous closure.

## Model

`allocator_rebalance_bundle_resolution_actions` stores one row per explicit operator closure decision.

Each row records:

- bundle id
- proposal id
- resolution action type
- resulting resolution state
- status
- required operator note
- acknowledged partial-application flag
- escalation flag
- affected-child summary snapshot
- linked recovery action ids
- requested and completed actor metadata
- blocked reasons and outcome summary

The parent `allocator_rebalance_bundles` row now also stores the latest resolution overlay:

- `resolution_state`
- `latest_resolution_action_id`
- `resolution_summary`
- `resolved_by`
- `resolved_at`

## Action Set

This phase intentionally keeps the manual-resolution set small:

- `accept_partial_application`
- `mark_bundle_manually_resolved`
- `escalate_bundle_for_review`

Resulting bundle resolution states:

- `accepted_partial`
- `manually_resolved`
- `escalated`

Bundles remain `unresolved` until an operator records one of these actions.

## Eligibility Model

Resolution options are computed in the backend.

A manual-resolution option is `eligible` only when:

- the bundle status is actionable for intervention
- no downstream children are still in flight
- the chosen action matches the current bundle truth
- the operator satisfies the approval requirement
- a non-empty note is provided

Additional rule:

- `accept_partial_application` is only offered when the bundle outcome classification is `partial_application`

## Inspection Model

Bundle detail now includes a partial-progress view that summarizes:

- applied children
- progress-recorded children
- retryable children
- non-retryable children
- blocked-before-application children
- in-flight children
- per-sleeve child counts
- per-child evidence and retryability

This inspect-first model is the decision context for manual closure.

## Timeline Integration

Bundle timelines now include manual-resolution events:

- `resolution_completed`
- `resolution_blocked`

These entries extend the bundle narrative without erasing prior failure or recovery history.

## Interpretation

Manual resolution is an operator-authored closure overlay.

It changes:

- bundle `resolutionState`
- bundle `resolutionSummary`
- intervention recommendation

It does not change:

- the underlying child execution truth
- prior failure history
- prior recovery history
- whether a bundle was partially applied
