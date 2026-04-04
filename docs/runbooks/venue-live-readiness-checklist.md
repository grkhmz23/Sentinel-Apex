# Venue Live Readiness Checklist

Date: 2026-04-03

Phase 6.0 keeps the Phase 5.9 operator workflow and adds one narrow real execution-capable connector on top of it. No connector is approved by default.

## Required Before Approval

The connector must be:

- `execution_capable`
- explicitly requested for promotion
- under operator review

Current approval is blocked unless backend evidence shows:

- fresh latest connector truth
- healthy latest connector truth
- sufficient snapshot completeness
- sufficient read-only validation state
- no remaining missing prerequisites captured by the repo

## Required Before Sensitive Execution

Even after approval, current sensitive execution remains blocked unless:

- promotion status is `approved`
- effective posture resolves to `approved_for_live`
- current sensitive-execution eligibility is true
- no current blockers remain

Approved connectors can become ineligible again when truth becomes stale, degraded, unavailable, or incomplete.

For `drift-solana-devnet-carry`, `approved_for_live` still means approved only for the connector's declared devnet-only scope.

## Operator Checklist

- confirm the connector is technically `execution_capable`
- review `/api/v1/venues/:venueId`
- review `/api/v1/venues/:venueId/promotion/eligibility`
- verify current freshness, health, completeness, and blockers
- verify missing prerequisites are empty or explicitly understood
- for `drift-solana-devnet-carry`, verify the environment is still devnet-scoped and that the target Drift account already has a BTC-PERP position to reduce
- request promotion through the operator workflow
- approve only from `pending_review`
- suspend approval if evidence later degrades

## Current Status

- simulated connectors
  - not live-ready by design
  - never promotion candidates
- `drift-solana-readonly`
  - strong real read-only truth
  - not execution-capable
  - not a live-promotion candidate
- `drift-solana-devnet-carry`
  - first real execution-capable connector
  - devnet only
  - BTC-PERP reduce-only market orders only
  - still blocked until promotion is approved and current evidence is eligible
- current repo state
  - includes the promotion workflow
  - includes truth-backed gating
  - includes one narrow devnet execution connector
  - does not include any pre-approved connector

## Honest Boundary

This checklist does not treat any of the following as approval by themselves:

- real venue truth
- read-only validation
- connector health
- operator familiarity
- out-of-band onboarding work not captured in persisted evidence

Approval remains explicit, durable, and separately auditable.
