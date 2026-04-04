# Phase 5.9 Connector Promotion Gap Analysis

Date: 2026-04-02
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Readiness And Approval Model

The repo already exposes connector posture metadata, but it is still adapter-driven rather than operator-controlled.

Current posture fields already exist in three places:

- `packages/venue-adapters`
  - `VenueCapabilitySnapshot`
    - `truthMode`
    - `readOnlySupport`
    - `executionSupport`
    - `approvedForLiveUse`
    - `onboardingState`
    - `missingPrerequisites`
    - `healthy`
    - `healthState`
    - `degradedReason`
  - `CarryVenueCapabilities`
    - `executionSupported`
    - `readOnly`
    - `approvedForLiveUse`
    - `healthy`
    - `onboardingState`
    - `missingPrerequisites`
  - `TreasuryVenueCapabilities`
    - `executionSupported`
    - `readOnly`
    - `approvedForLiveUse`
    - `healthy`
    - `onboardingState`
    - `missingPrerequisites`
- `packages/runtime`
  - runtime venue, carry venue, and treasury venue read models already surface adapter posture to API and dashboard consumers
- `packages/db`
  - `venue_connector_snapshots`
  - `carry_venue_snapshots`
  - `treasury_venue_snapshots`
  - `carry_execution_steps`
  - these persist current capability posture and runtime-observed readiness fields

The honest current state is:

- simulated carry and treasury adapters report simulated posture
- the Drift connector reports real read-only posture with strong derivative-aware truth
- no durable connector promotion request, approval, rejection, or suspension record exists
- no backend-native promotion history exists
- no durable current approval truth exists outside the latest adapter-reported snapshot

## 2. Current Gating Limitations

Execution gating is present, but it still trusts adapter-reported posture directly.

Current sensitive-path behavior:

- carry planning
  - `packages/carry/src/controlled-execution.ts`
  - blocks live venues when `approvedForLiveUse === false`
  - still reads that field from runtime-supplied venue capabilities derived from adapters
- treasury planning
  - `packages/treasury/src/execution-planner.ts`
  - blocks missing execution support and runtime live-mode disablement
  - does not yet enforce a durable operator approval requirement beyond adapter posture
- runtime execution flow
  - `packages/runtime/src/runtime.ts`
  - `collectCarryVenueViews()` and `collectTreasuryVenueCapabilities()` feed planners from live adapter capability snapshots
  - `collectVenueTruthSnapshots()` persists connector posture snapshots, but those are read-only projections, not approval truth

This creates concrete limitations:

- `approvedForLiveUse` is currently an adapter capability field, not an auditable operator decision
- read-only truth does not imply live approval, but no durable workflow exists to capture that distinction
- stale or degraded truth can be seen by operators, but it does not feed a first-class connector promotion eligibility model
- API and dashboard show readiness snapshots, not promotion review state
- no one can answer from durable state:
  - who requested promotion
  - who approved or rejected it
  - what evidence existed at decision time
  - whether approval was later suspended

## 3. Target Connector Promotion Workflow

Phase 5.9 adds a first-class connector promotion workflow with three distinct layers:

1. Technical capability

- `simulated_only`
- `real_readonly`
- `execution_capable`

This answers what the connector can technically do today.

2. Operator promotion status

- `not_requested`
- `pending_review`
- `approved`
- `rejected`
- `suspended`

This answers what operators have decided.

3. Effective operator-facing posture

- `simulated_only`
- `real_readonly`
- `execution_capable_unapproved`
- `promotion_pending`
- `approved_for_live`
- `rejected`
- `suspended`

This answers the current durable posture shown to operators.

Execution eligibility remains a separate computed concept:

- a connector may be `approved_for_live`
- but still be ineligible for sensitive execution if:
  - truth is stale
  - health is degraded or unavailable
  - required truth validation is incomplete
  - required prerequisites remain missing

That separation keeps the model honest:

- approval is durable and auditable
- eligibility is truth-backed and recomputed from current evidence
- read-only truth is never treated as live approval

## 4. Required Schema, Runtime, API, Dashboard, And Doc Changes

Schema and persistence:

- add durable connector promotion request/history storage
- add append-only promotion event history
- persist evidence snapshot and missing-prerequisite snapshot at request and decision time
- persist actor metadata and decision notes

Runtime and store:

- add typed promotion, eligibility, evidence, and history views
- compute capability class from latest connector snapshots
- compute promotion eligibility from real persisted truth:
  - capability class
  - snapshot freshness
  - connector health
  - snapshot completeness
  - existing missing prerequisites
  - optional config-readiness markers when the repo actually exposes them
- overlay current promotion truth onto venue, carry venue, and treasury venue read models
- gate sensitive execution using durable promotion truth plus current eligibility

API:

- add promotion summary/detail/history/eligibility endpoints
- add operator-authenticated request/approve/reject/suspend mutations
- keep route handlers thin and defer business logic to runtime control-plane and store methods

Dashboard:

- add connector promotion status, evidence, prerequisites, and history on venue detail
- add operator controls for request, approve, reject, and suspend where role permits
- optionally add a promotion queue view for candidates and pending reviews

Documentation:

- add Phase 5.9 architecture documentation
- add promotion rules documentation
- update runbooks, README, and current-state audit so the repo tells the truth

## 5. Implementation Plan In Priority Order

1. Add the Phase 5.9 promotion workflow model to docs and runtime types.
2. Add durable DB tables for promotion records and promotion events.
3. Implement store-level eligibility computation from persisted connector truth.
4. Add control-plane methods for request, approve, reject, and suspend transitions with audit writes.
5. Overlay promotion state onto venue, carry, and treasury read models.
6. Update carry and treasury execution planning to rely on durable promotion truth plus current eligibility.
7. Add API promotion surfaces with backend authorization.
8. Extend the ops dashboard with promotion status, evidence, history, and operator controls.
9. Add deterministic tests across runtime, API, and dashboard.
10. Run targeted validation and then `pnpm validate:ci`.
