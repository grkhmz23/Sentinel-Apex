# ADR 0025: Phase 5.9 Connector Promotion Workflow

Date: 2026-04-02
Status: Accepted

## Context

Before Phase 5.9, connector readiness and approval posture were still mostly adapter-driven.

The repo already had good visibility into:

- simulated vs real truth
- read-only vs execution-capable support
- snapshot freshness, health, completeness, and missing prerequisites

But it did not have a durable answer for:

- who requested promotion
- who approved or rejected it
- what evidence existed at the time
- whether approval had later been suspended

That made live-readiness gating too dependent on current adapter posture and too weakly auditable for sensitive execution paths.

## Decision

Sentinel Apex will model connector promotion as a first-class durable workflow with:

- capability class
  - `simulated_only`
  - `real_readonly`
  - `execution_capable`
- durable promotion status
  - `not_requested`
  - `pending_review`
  - `approved`
  - `rejected`
  - `suspended`
- effective posture
  - operator-facing summary derived from the two layers above
- append-only promotion event history
- evidence snapshots captured at request and decision time
- current sensitive-execution eligibility computed from live persisted truth instead of historical approval alone

## Why

This keeps three separate questions honest:

- capability: what can the connector technically do
- approval: what have operators decided
- eligibility: can the runtime safely use it right now

That separation is necessary because:

- execution capability is not approval
- read-only truth is not approval
- approval can remain historically valid while current evidence becomes stale or degraded

## Rejected Alternatives

### 1. Keep using adapter `approvedForLiveUse` as the primary truth

Rejected.

That is not durable, not auditable enough, and collapses capability with operator approval.

### 2. Auto-approve when truth is fresh and complete

Rejected.

Phase 5.9 is intentionally operator-driven. Fresh truth is evidence, not authorization.

### 3. Treat approval as permanently execution-eligible

Rejected.

Current connector evidence must still gate sensitive execution after approval.

## Consequences

Positive:

- promotion history becomes durable and auditable
- operators can inspect posture, evidence, blockers, and decision notes in one place
- carry and treasury live gating become explicit and truthful
- approval can be suspended without deleting prior history

Negative:

- the model adds more persistence and read-model surface area
- operator workflow is stricter than a static config toggle
- some connectors may appear approved but currently blocked, which operators must understand correctly

## Follow-up

The next step after Phase 5.9 is not broad live rollout. It is to connect more real execution-capable connectors into the same workflow and keep evidence modeling explicit rather than heuristic.
