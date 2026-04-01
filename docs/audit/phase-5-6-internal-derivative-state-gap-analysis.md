# Phase 5.6 Internal Derivative State Gap Analysis

Date: 2026-04-01
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Internal Derivative State Sources

Sentinel Apex already had several internal sources that matter for derivative posture, but they were split across runtime execution facts rather than persisted as a single canonical comparison model.

Canonical internal sources already present before this pass:

- runtime venue tracking config for a Drift locator:
  - `DRIFT_READONLY_ACCOUNT_ADDRESS`
  - or `DRIFT_READONLY_AUTHORITY_ADDRESS` plus `DRIFT_READONLY_SUBACCOUNT_ID`
- `orders`
  - canonical internal order lifecycle state
  - internal order ids, client order ids, venue order ids when known
  - requested size, filled size, status, reduce-only, execution mode, timestamps
- `fills`
  - canonical internal fill ledger
  - venue order linkage, side, size, price, fee, fill timestamps
- `execution_events`
  - durable execution lifecycle records and references
- existing runtime carry/execution flows
  - the runtime already knows when it created, approved, submitted, and filled order-like work

Derived or partial internal sources before this pass:

- internal derivative positions could be reconstructed from fills, but were not persisted as a durable read model
- internal account identity existed in config, but not in a dedicated venue-facing comparison surface
- internal order inventory existed in the orders table, but not in a venue-native comparison view

Absent before this pass:

- a durable internal derivative snapshot model
- a durable current-state view for internal derivative posture
- internal-vs-external derivative comparison views
- truthful derivative mismatch classes backed by both sides of the comparison
- a canonical internal health or margin model

## 2. Current Comparison Limitations

Before Phase 5.6, Phase 5.5 had already added strong Drift-native external truth:

- derivative account / subaccount identity
- external position inventory
- external health / margin-like state
- external open-order inventory
- exact / mixed / derived provenance markers

The missing side was the internal model. That created these limits:

- account identity:
  - externally visible, but not compared through a dedicated persisted internal model
- positions:
  - externally visible and typed, but the runtime did not persist an internal position inventory for direct comparison
- orders:
  - externally visible and typed, but there was no internal order-inventory comparison layer over canonical runtime orders
- health:
  - external Drift-native health existed, but the runtime still had no truthful internal health model

The meaningful comparison boundaries from the current repo state are:

- directly comparable now:
  - configured internal account identity vs decoded external Drift account identity
  - internal open-order inventory vs external open-order inventory when a venue order id exists on both sides
  - internal position inventory vs external position inventory at `asset + marketType` granularity
- comparable only partially:
  - internal open orders without a venue order id remain canonical internally but not directly comparable
  - positions remain comparison-ready at `asset + marketType`, not full Drift market-index semantics
- still not comparable:
  - health / margin state
  - unsupported or stale external truth
  - unsupported or stale internal state

## 3. Target Canonical Internal State Design

Phase 5.6 should persist a dedicated internal derivative state model that is honest about canonical vs derived sections.

Target model:

- internal derivative account state
  - canonical
  - sourced from runtime operator configuration
  - identity only, not external venue truth
- internal derivative order inventory
  - canonical
  - sourced from persisted runtime orders
  - comparable only when venue order ids are known
- internal derivative position inventory
  - derived, but durable and explicit
  - reconstructed from internal fills joined to canonical runtime orders
  - kept separate from external truth so the provenance boundary stays clear
- internal health state
  - unsupported until the runtime can compute venue-aligned internal health truthfully
- coverage / provenance / confidence
  - required on every section so operators can distinguish:
    - canonical internal
    - derived internal
    - unsupported internal
    - exact / mixed / derived external
    - comparable vs not comparable

Durable storage shape:

- append-only history table:
  - `internal_derivative_snapshots`
- current-state table:
  - `internal_derivative_current`

Comparison surfaces should be built from:

- latest internal derivative current state
- latest external venue snapshot
- explicit comparison logic with section-level coverage and reasons

## 4. Required Changes

Schema and persistence:

- add `internal_derivative_snapshots`
- add `internal_derivative_current`
- store typed account, position, health, and order sections plus coverage/provenance metadata

Runtime:

- derive internal derivative snapshots from real runtime state
- refresh snapshots after cycle runs, projection rebuilds, and carry execution flows
- persist both history and current-state rows

Reconciliation:

- compare internal vs external account identity when both exist
- compare internal vs external positions where both sides are structurally comparable
- compare internal vs external open-order inventory when venue order ids exist
- emit comparison-gap findings instead of fake mismatch classes where coverage is insufficient
- keep health explicitly not comparable until a truthful internal model exists

API and dashboard:

- expose internal derivative state directly
- expose comparison summary and detail by venue
- render mismatch vs comparison-gap vs unsupported clearly for operators

Docs and runbooks:

- update operator docs to explain the new internal/external split
- document that health remains externally visible but internally unsupported
- document how to interpret `matched`, `mismatched`, `internal_only`, `external_only`, and `not_comparable`

## 5. Implementation Plan In Priority Order

1. Define the canonical internal derivative state contract and comparison contract in runtime types.
2. Add durable storage for append-only snapshots plus current-state rows.
3. Build internal derivative snapshots from runtime config, orders, and fills.
4. Refresh those snapshots from real runtime flows and persist them.
5. Add truth-backed derivative reconciliation only for genuinely comparable domains.
6. Expose internal state and comparison views through runtime store, control-plane, and API surfaces.
7. Render the new comparison surfaces in the ops dashboard.
8. Update docs and runbooks so the repo truth matches the implementation.
9. Re-run targeted and root validation, then report the actual lint/validation status.
