# Phase 4.9 Escalation Workflow

Date: 2026-03-31

## Purpose

Phase 4.9 turns escalation from a simple bundle resolution outcome into a first-class operator handoff workflow.

This phase is about ownership and follow-through, not execution retries or strategy expansion.

## Model

`allocator_rebalance_bundle_escalations` stores the current escalation workflow record.

Each record includes:

- bundle id
- proposal id
- source resolution action id
- escalation status
- owner id
- assigned by and assigned at
- acknowledged by and acknowledged at
- due-at follow-up target
- handoff note
- review note
- resolution note
- closed by and closed at

`allocator_rebalance_bundle_escalation_events` stores durable workflow history.

Each event records:

- escalation id
- bundle id
- proposal id
- event type
- status transition
- actor id
- owner id
- note
- due-at snapshot

## Status Model

This phase keeps the escalation lifecycle intentionally tight:

- `open`
- `acknowledged`
- `in_review`
- `resolved`

These states distinguish:

- newly escalated and handed off
- owner acknowledgement
- active review
- workflow closure

## Bundle Overlay

The bundle row now stores the latest escalation overlay:

- `latest_escalation_id`
- `escalation_status`
- `escalation_owner_id`
- `escalation_assigned_at`
- `escalation_due_at`
- `escalation_summary`

This is an operator-read convenience view.

It does not replace the underlying escalation record or event history.

## Lifecycle

1. Operator records `escalate_bundle_for_review`.
2. Runtime persists manual resolution and creates an `open` escalation record.
3. The escalator becomes the initial owner unless reassigned later.
4. Operators may explicitly:
   - assign
   - acknowledge
   - start review
   - close
5. Each transition appends a durable escalation event.

## Truth Separation

Escalation workflow does not change:

- downstream child execution truth
- bundle outcome classification
- prior recovery history
- prior manual-resolution history

It adds a third layer of process state over the existing execution and closure models.
