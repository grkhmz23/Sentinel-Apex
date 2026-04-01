# Phase 4.8 Partial Resolution Gap Analysis

Date: 2026-03-31

## 1. Current Partial-Application Model

Before Phase 4.8, rebalance bundles already exposed:

- bundle status and outcome classification
- intervention recommendations such as `unresolved_partial_application`
- downstream carry and treasury child drill-through
- bundle recovery history for retryable children

This let operators see that a bundle had partially applied, but not record a first-class closure decision.

## 2. Current Non-Retryable State Handling

Before this phase, intentionally non-retryable states remained inspect-only.

Examples:

- carry children with venue-side progress
- treasury children with recorded venue execution references
- bundles with partial budget-state or external progress that could not be honestly retried

Operators could inspect these states, but they could not yet:

- accept the current partial outcome explicitly
- mark the bundle manually resolved with rationale
- escalate the bundle for further review with durable closure state

## 3. Target Inspect-First / Manual-Resolution Design

Phase 4.8 adds:

- a partial-progress inspection model for bundle detail
- a retryable vs non-retryable child breakdown
- durable manual resolution actions tied to the bundle
- explicit closure decisions:
  - `accept_partial_application`
  - `mark_bundle_manually_resolved`
  - `escalate_bundle_for_review`
- durable operator notes, timestamps, actor metadata, and affected-child snapshots

Manual resolution is an overlay on bundle coordination truth.

It does not silently convert bundle execution status to `completed`.

## 4. Required Changes

Schema:

- extend `allocator_rebalance_bundles` with manual-resolution summary fields
- add `allocator_rebalance_bundle_resolution_actions`

Runtime / store / control plane:

- compute inspect-first partial-progress summaries from child state
- compute deterministic manual-resolution options and blocked reasons
- persist blocked and completed manual-resolution actions
- overlay resolution state onto bundle recommendation and detail surfaces
- include manual-resolution actions in bundle graph and timeline

API:

- add resolution options endpoint
- add resolution action list/detail endpoints
- add explicit resolution request mutation

Dashboard:

- add partial-progress inspection panel
- add manual-resolution options panel with required rationale
- add resolution history panel

## 5. Implementation Plan In Priority Order

1. Add bundle-resolution schema and bundle summary fields.
2. Add runtime types for partial-progress inspection and manual resolution.
3. Compute bundle inspection and resolution options in the backend.
4. Persist explicit manual-resolution actions and bundle overlay state.
5. Extend bundle detail, graph, and timeline with resolution history.
6. Add allocator API endpoints for resolution options, history, detail, and request.
7. Extend the dashboard bundle page with inspect-first and manual-resolution tooling.
8. Add deterministic runtime, API, and dashboard tests for partial and non-retryable outcomes.
