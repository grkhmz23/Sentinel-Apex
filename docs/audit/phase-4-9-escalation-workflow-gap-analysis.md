# Phase 4.9 Escalation Workflow Gap Analysis

Date: 2026-03-31

## 1. Current Escalation Model

Before Phase 4.9, escalation existed only as a manual-resolution outcome:

- bundle `resolutionState` could become `escalated`
- bundle recommendation could become `escalated_for_review`
- the triggering manual-resolution note was durable

The bundle could truthfully show that further operator review was required, but escalation was not yet a workflow with ownership.

## 2. Current Follow-Up Limitations

Before this phase, the repo did not persist:

- escalation owner or assignee
- acknowledgement state
- active review state
- due-at or follow-up target
- durable handoff history
- explicit escalation closure actor and note

Operators could see that a bundle was escalated, but not who owned it or whether follow-up had progressed.

## 3. Target Escalation Ownership Workflow

Phase 4.9 adds:

- a durable escalation record per escalated bundle workflow
- explicit owner assignment and reassignment
- acknowledgement and in-review transitions
- explicit close / resolution note
- event history for handoff and follow-up actions
- bundle detail overlays for current escalation state

This keeps three layers separate:

- bundle execution truth
- bundle manual-resolution truth
- escalation ownership workflow truth

## 4. Required Changes

Schema:

- extend `allocator_rebalance_bundles` with latest escalation summary fields
- add `allocator_rebalance_bundle_escalations`
- add `allocator_rebalance_bundle_escalation_events`

Runtime / control plane:

- create escalation records when a bundle is escalated for review
- expose escalation detail, history, and transition options
- enforce valid assign / acknowledge / review / close transitions
- preserve bundle execution and manual-resolution history untouched

API:

- add escalation detail and history endpoints
- add assignment, acknowledgement, review, and close mutations

Dashboard:

- add escalation ownership panel
- add escalation workflow controls
- add escalation history table

## 5. Implementation Plan In Priority Order

1. Add escalation schema and bundle overlay fields.
2. Add runtime types for escalation detail, history, and transitions.
3. Create escalation records from escalated manual-resolution outcomes.
4. Add control-plane transitions for assign, acknowledge, start review, and close.
5. Extend bundle detail, graph, and timeline with escalation workflow state.
6. Add allocator API endpoints for escalation inspection and mutation.
7. Extend the dashboard bundle page with escalation ownership and history tooling.
8. Add deterministic runtime, API, and dashboard tests for the escalation lifecycle.
