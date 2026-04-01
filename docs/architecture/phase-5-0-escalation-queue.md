# Phase 5.0 Escalation Queue

Date: 2026-03-31

## Purpose

Phase 5.0 adds a cross-bundle escalation queue for operator triage.

This does not replace:

- bundle execution truth
- bundle manual-resolution truth
- per-bundle escalation workflow truth

It is a read-model and workflow surface on top of the Phase 4.9 escalation records.

## Read Model

The queue is derived from:

- `allocator_rebalance_bundle_escalations`
- `allocator_rebalance_bundle_escalation_events`
- `allocator_rebalance_bundles`
- `allocator_rebalance_proposals`

Each queue item includes:

- escalation identifiers and parent bundle / proposal linkage
- current escalation owner and status
- assigned, acknowledged, and in-review timestamps where available
- due-at and derived queue state
- latest activity timestamp and event summary
- bundle status, intervention recommendation, and resolution state
- downstream child-count context
- sleeve involvement
- execution mode and simulated-vs-live visibility

## Derived Queue State

Queue state is backend-derived:

- `resolved`
  - escalation status is `resolved`
- `unassigned`
  - escalation is still open and has no owner
- `overdue`
  - escalation is still open and `due_at` is in the past
- `due_soon`
  - escalation is still open and `due_at` is within the next 24 hours
- `on_track`
  - escalation is open and does not meet the stronger conditions above

This derived state exists for triage only. It does not change escalation workflow truth.

## Query Semantics

The queue supports:

- `status`
- `ownerId`
- `openState`
- `queueState`
- `sortBy`
- `sortDirection`
- `limit`

Current sort keys:

- `due_at`
- `latest_activity`
- `created_at`
- `updated_at`

## Summary Surface

The summary view provides:

- total
- open
- acknowledged
- inReview
- resolved
- overdue
- dueSoon
- unassigned
- mine

`mine` is computed from the authenticated operator id for open escalations owned by that operator.

## Quick Actions

Queue-level quick actions are intentionally narrow:

- assign / reassign
- acknowledge
- start review

The queue does not expose close in this phase.

Reasons:

- closure is higher-risk and benefits from bundle-detail context
- the queue is meant for triage and ownership routing, not incident completion

Quick actions reuse the existing escalation mutation rail. No hidden queue-specific mutation path exists.

## UI Structure

The dashboard adds:

- a dedicated `/allocator/escalations` page
- queue summary counts
- queue filters
- queue table with owner, due-at, bundle state, and latest activity
- quick links back to bundle detail
- operator-gated quick actions

This keeps the queue operator-grade without turning it into a generic ticketing system.
