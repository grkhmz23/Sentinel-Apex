# Venue Live Readiness Checklist

Phase 5.4 does not approve any new live connector. This checklist defines what must exist before a connector can move past read-only truth ingestion.

## Required Before `approved_for_live`

- venue-native auth and secret handling documented and validated
- explicit execution adapter implementation in-repo
- deterministic dry-run coverage
- read-only snapshot parity validated against expected external state
- deeper truth coverage documented with explicit `available`, `partial`, and `unsupported` semantics
- venue-native derivative decode path documented and validated if positions, health, or open orders are claimed
- order/reference parity validated against a canonical venue-native order source if open-order claims are made
- unsupported depth areas documented instead of implied
- failure and degraded-state handling documented
- operator-facing readiness metadata populated
- runtime/reconciliation behavior reviewed for stale, missing, unavailable, and partial venue truth
- any execution-reference reconciliation behavior reviewed against real connector depth
- explicit approval decision recorded outside this checklist

## Current Status

- simulated connectors: not live-ready by design
- `drift-solana-readonly`: read-only only, not execution-capable, not approved for live use
- `drift-solana-readonly` now provides derivative-aware read-only truth in the form of partial program-account metadata and reference-only order context, but it still does not provide decoded positions, health, canonical open orders, venue-native liquidity, or live execution support
