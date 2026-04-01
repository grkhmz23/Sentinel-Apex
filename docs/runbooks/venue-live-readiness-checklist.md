# Venue Live Readiness Checklist

Phases 5.5 and 5.6 do not approve any new live connector. This checklist defines what must exist before a connector can move past read-only truth ingestion.

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
- direct reconciliation parity documented for any claimed account, position, health, or order comparison automation
- any claimed internal derivative model documented as canonical or derived section-by-section
- any comparison-gap behavior documented separately from true mismatch classes
- explicit approval decision recorded outside this checklist

## Current Status

- simulated connectors: not live-ready by design
- `drift-solana-readonly`: read-only only, not execution-capable, not approved for live use
- `drift-solana-readonly` now provides Drift-native read-only decode for user/subaccount semantics, position inventory, health and margin-like state, and open-order inventory
- the runtime now also provides internal derivative account, position, and order views for this venue plus truthful comparison detail
- current direct comparison depth is still limited to:
  - account identity
  - position inventory at `asset + marketType`
  - open orders with a venue order id
- internal health remains unsupported and there is still no live execution support or treasury-style capacity truth
