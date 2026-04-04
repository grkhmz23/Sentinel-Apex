# Phase 5.9 Connector Promotion Workflow

## Purpose

Phase 5.9 turns connector promotion into a durable operator workflow instead of an adapter hint or config guess.

This phase does not broadly enable live execution. It adds the control-plane truth required to answer:

- what the connector can technically do
- what operators have approved
- whether current evidence still permits sensitive execution

## Core Model

Phase 5.9 separates connector posture into three layers.

### 1. Capability Class

Derived from persisted connector truth and support metadata:

- `simulated_only`
- `real_readonly`
- `execution_capable`

This is a technical classification, not an approval state.

### 2. Promotion Status

Durable operator workflow state:

- `not_requested`
- `pending_review`
- `approved`
- `rejected`
- `suspended`

This is the review and decision layer.

### 3. Effective Posture

Operator-facing rollup:

- `simulated_only`
- `real_readonly`
- `execution_capable_unapproved`
- `promotion_pending`
- `approved_for_live`
- `rejected`
- `suspended`

This is what operators see in list and detail surfaces.

## Evidence Model

Each promotion detail view includes a readiness evidence snapshot derived from persisted truth:

- connector freshness
- health state
- truth coverage
- snapshot completeness
- read-only validation state
- missing prerequisites
- config-readiness markers exposed by snapshot metadata
- current blocking reasons

The runtime only reasons over evidence the repo actually knows.

## Persistence Model

Phase 5.9 adds two durable tables:

- `venue_connector_promotions`
  - current request/decision records
  - request metadata
  - approval, rejection, or suspension actor and timestamps
  - latest note
  - evidence snapshot at the time of the decision
- `venue_connector_promotion_events`
  - append-only history
  - status transitions
  - effective posture at the time of the event
  - evidence snapshot at the time of the event

This makes the workflow auditable without overloading transient connector snapshots.

## Transition Rules

- `not_requested -> pending_review`
  - operator or admin can request promotion
  - connector must be technically execution-capable
- `pending_review -> approved`
  - admin only
  - current evidence must be eligible
- `pending_review -> rejected`
  - admin only
  - rejection note is required
- `approved -> suspended`
  - admin only
  - suspension note is required

Invalid transitions are rejected by backend control-plane logic.

## Gating Model

Sensitive execution now depends on durable promotion truth plus recomputed evidence:

- live execution is blocked when promotion status is:
  - `not_requested`
  - `pending_review`
  - `rejected`
  - `suspended`
- live execution is also blocked when promotion status is `approved` but current evidence is ineligible

This creates an intentional distinction:

- approval is durable
- eligibility is dynamic

An approved connector can become temporarily non-actionable when truth becomes stale, degraded, incomplete, or otherwise blocked.

## Integration Points

Phase 5.9 overlays promotion truth into:

- generic venue inventory
- venue detail and snapshot views
- carry venue readiness views
- treasury venue readiness views
- carry live execution planning and execution pre-flight checks
- treasury live execution planning

Blocked executions now emit explicit posture-driven reasons instead of silently relying on adapter posture.

## Operator Surfaces

API:

- `/api/v1/venues/promotion-summary`
- `/api/v1/venues/:venueId/promotion`
- `/api/v1/venues/:venueId/promotion/history`
- `/api/v1/venues/:venueId/promotion/eligibility`
- request, approve, reject, and suspend mutations

Dashboard:

- promotion summary on `/venues`
- promotion workflow panel on `/venues/:venueId`
- promotion evidence and blockers
- promotion history timeline
- role-gated request, approve, reject, and suspend controls

## Honest Boundary

Phase 5.9 does not claim:

- automatic live approval
- read-only truth as execution approval
- autonomous promotion based on heuristics
- approval permanence regardless of current connector health
- new live-approved connectors in the repo

It adds the workflow and gating required to make future promotion decisions explicit, durable, and truthful.
