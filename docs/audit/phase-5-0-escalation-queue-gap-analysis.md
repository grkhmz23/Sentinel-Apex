# Phase 5.0 Escalation Queue Gap Analysis

Date: 2026-03-31

## 1. Current Escalation Workflow Surfaces

Before Phase 5.0, escalation workflow existed only at bundle scope:

- bundle detail could show the current escalation owner, status, due-at, and history
- operators could assign, acknowledge, start review, and close from bundle detail
- escalation remained a durable overlay on top of bundle execution and manual-resolution truth

The data model already had enough persisted truth for queueing:

- `allocator_rebalance_bundle_escalations`
- `allocator_rebalance_bundle_escalation_events`
- bundle overlay fields for latest escalation id, status, owner, due-at, and summary

## 2. Current Cross-Bundle Visibility Limitations

What was missing:

- no list of all escalations across bundles
- no ownership overview for open escalations
- no due-soon or overdue visibility without opening bundles one by one
- no queue filters for status, owner, or open vs closed state
- no queue-level quick triage actions
- no "my escalations" or open-summary rollup

This made the workflow durable but not operationally manageable at scale.

## 3. Target Queue / Triage Design

Phase 5.0 adds a backend-native escalation queue read model optimized for operator triage.

Each queue row should expose:

- escalation id
- bundle id
- proposal id
- allocator run id
- escalation status
- queue state derived as `overdue`, `due_soon`, `unassigned`, `on_track`, or `resolved`
- owner, assigned-by, assigned-at
- acknowledged-at and in-review-at
- due-at
- latest activity timestamp
- latest event summary
- bundle status, intervention recommendation, and resolution state
- child failure / blocked / pending counts
- child sleeve involvement

The queue should support:

- filter by status
- filter by owner
- filter by open vs closed
- filter by overdue / due soon / unassigned
- sort by due date, latest activity, created, or updated
- summary counts for open, acknowledged, in-review, overdue, due-soon, unassigned, and mine
- safe queue-level actions for assign, acknowledge, and start review only

## 4. Required Changes

Runtime / read model:

- add queue item and queue summary view types
- add store query support that joins escalation, bundle, proposal, and latest event truth
- derive queue-state and latest-activity fields in the backend

API:

- add `GET /api/v1/allocator/escalations`
- add `GET /api/v1/allocator/escalations/summary`
- add `GET /api/v1/allocator/escalations/mine`

Dashboard:

- add a first-class escalations queue page
- add filter controls and queue summary
- add owner / due-at / latest-activity visibility
- add safe quick actions that reuse the existing escalation mutation rail
- add queue navigation entry

Schema:

- no new schema was required in this phase because the Phase 4.9 persistence model already captured the necessary workflow truth

## 5. Implementation Plan In Priority Order

1. Add queue types and runtime read-api contract.
2. Implement store-side queue query, filtering, sorting, and summary derivation.
3. Expose allocator API queue and summary endpoints.
4. Add dashboard queue page and navigation entry.
5. Add safe queue-level quick actions using the existing escalation workflow endpoints.
6. Add deterministic runtime, API, and dashboard tests.
7. Update audit, architecture, strategy, risk, and README docs.
