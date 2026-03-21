# Treasury Live Enable Checklist

Date: 2026-03-21

## Purpose

This checklist defines the minimum operational steps before a treasury connector may be marked `approved_for_live`.

The default state remains:

- dry-run execution
- live mode disabled
- no live treasury connector approved

## Checklist

1. Connector implementation is complete and passes package/integration tests.
2. The connector reports truthful readiness metadata in treasury venue inventory and venue detail views.
3. Read-only snapshot validation has been performed against the real venue.
4. Execution capability has been tested in a non-production or explicitly sandboxed environment where available.
5. Failure paths return explicit, operator-auditable errors.
6. Venue eligibility is configured intentionally in treasury policy.
7. Liquidity reserve, concentration, action-size, and execution-mode blockers still behave correctly with the connector present.
8. Shared secrets, credentials, and operational ownership are documented outside the repo in the appropriate secure system.
9. Operator review confirms the connector is not being misrepresented as live-ready before signoff.
10. Admin review explicitly approves the connector for live use.
11. Global live execution gating is enabled only after the above steps are complete.

## Required Evidence

Before approval, collect:

- successful snapshot validation output
- execution dry-run evidence
- any sandbox/live-sim validation notes
- known limits and missing safeguards
- operator reviewer and admin approver identity

## Do Not Skip

- Do not mark a connector `approved_for_live` just because it exists.
- Do not treat simulated execution as live validation.
- Do not enable live execution globally without connector-specific readiness review.
