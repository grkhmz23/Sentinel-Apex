# Connector Readiness Matrix

Date: 2026-04-04

## Purpose

This matrix separates three questions that operators previously had to infer from raw connector snapshots:

- what the connector can technically do
- what operators have approved
- whether the connector is currently eligible for sensitive execution

These are now separate backend concepts.

## Canonical Dimensions

### Capability Class

- `simulated_only`
  - the connector is in-repo simulation only
  - it must never be treated as real venue truth or live-ready execution
- `real_readonly`
  - the connector talks to a real venue and can supply external truth
  - it is not execution-capable
- `execution_capable`
  - the connector can submit execution actions in code
  - this does not imply live approval
  - the concrete execution contract can still be narrower than "generic live trading" and must be read from connector metadata

### Promotion Status

- `not_requested`
- `pending_review`
- `approved`
- `rejected`
- `suspended`

This status is durable and operator-controlled.

### Effective Posture

- `simulated_only`
- `real_readonly`
- `execution_capable_unapproved`
- `promotion_pending`
- `approved_for_live`
- `rejected`
- `suspended`

This is the operator-facing summary shown in API and dashboard read models.

### Sensitive-Execution Eligibility

Sensitive execution is only eligible when all of the following are true:

- capability class is `execution_capable`
- promotion status is `approved`
- latest venue truth is fresh
- latest venue truth is healthy
- snapshot completeness and read-only validation are sufficient
- no required prerequisites remain missing
- recent real executions are `confirmed_full` when post-trade confirmation is required

Approved connectors can still be currently ineligible when evidence becomes stale or degraded.

## Current Connector Matrix

| Venue | Sleeve Scope | Capability Class | Promotion Status | Effective Posture | Sensitive Execution Eligible | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `sim-venue-a` / `sim-venue-b` | carry | `simulated_only` | `not_requested` | `simulated_only` | no | deterministic simulated carry adapters |
| `atlas-t0-sim` / `atlas-t1-sim` | treasury | `simulated_only` | `not_requested` | `simulated_only` | no | deterministic simulated treasury adapters |
| `drift-solana-readonly` | carry | `real_readonly` | `not_requested` | `real_readonly` | no | Drift-native read-only decode path; strong truth, no execution support |
| `drift-solana-devnet-carry` | carry | `execution_capable` | `not_requested` | `execution_capable_unapproved` | no | first real execution-capable connector; devnet-only, BTC-PERP reduce-only market orders only |

## Evidence Interpretation

- `approvedForLiveUse`
  - durable output of the connector promotion workflow
  - this is no longer just an adapter claim
  - for devnet-scoped connectors, approval remains scoped to that connector's declared contract and does not imply mainnet permission
- `promotion.capabilityClass`
  - derived from latest persisted connector truth and connector support
- `promotion.promotionStatus`
  - latest durable operator decision state
- `promotion.effectivePosture`
  - high-level posture badge for operators
- `promotion.sensitiveExecutionEligible`
  - current truth-backed execution gate result
- `promotion.blockers`
  - explicit reasons why current evidence does not permit sensitive execution
- `promotion.latestNote`
  - latest operator note from request, approval, rejection, or suspension workflow

## Truth And Validation Signals

Eligibility uses only repo-known evidence:

- `snapshotFreshness`
- `healthState`
- `snapshotCompleteness`
- truth-coverage rollups
- connector config/readiness markers captured in snapshot metadata
- explicit `missingPrerequisites`
- durable promotion history
- post-trade confirmation entries, including:
  - signature/reference presence
  - venue-native event correlation status and confidence
  - refreshed position-delta confirmation state

The system does not infer completion from external runbooks or tribal knowledge.

## Operator Rules

- simulated connectors are never promotion candidates
- read-only connectors are never execution-eligible
- execution-capable connectors are not actionable for live use until promotion is explicitly approved
- `approved` means the operator decision is durable
- `sensitiveExecutionEligible=false` means current runtime gating still blocks sensitive execution
- `rejected` and `suspended` always block sensitive execution

## Where To Inspect

- `/api/v1/venues`
- `/api/v1/venues/:venueId`
- `/api/v1/venues/promotion-summary`
- `/api/v1/venues/:venueId/promotion`
- `/api/v1/venues/:venueId/promotion/history`
- `/api/v1/venues/:venueId/promotion/eligibility`
- ops dashboard `/venues`
- ops dashboard `/venues/:venueId`
