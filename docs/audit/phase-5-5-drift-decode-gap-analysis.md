# Phase 5.5 Drift Decode Gap Analysis

Date: 2026-04-01

## 1. Current Real Read-Only Connector Depth

Before Phase 5.5, the repo's real connector path was still operationally useful but structurally shallow:

- venue id:
  - `drift-solana-readonly`
- connector depth:
  - generic Solana RPC read-only
- real capabilities:
  - cluster connectivity via `getVersion`
  - tracked account identity via `getAccountInfo`
  - native SOL balance via `getBalance`
  - SPL token balances via `getTokenAccountsByOwner`
  - balance-derived spot exposure-like summaries
  - recent account signatures via `getSignaturesForAddress`
- derivative-aware boundary:
  - partial derivative-account metadata only
  - no decoded Drift user/subaccount semantics
  - no decoded perp or spot positions
  - no honest health or margin state
  - no canonical venue open-order inventory

That posture answered "is the connector alive" and "is this wallet reachable", but it did not answer the more important operator questions around Drift-native positions, health, or order inventory.

## 2. Current Dependency And Decode Landscape

Audit of the implementation surface showed:

- `packages/venue-adapters`
  - already owned the real read-only connector boundary and canonical truth contract
  - already had a generic Solana JSON-RPC adapter suitable for minimal and generic wallet truth
- `packages/runtime`
  - already persisted append-only venue snapshots and projected them into typed operator-facing views
  - already derived truth-profile and reconciliation-state from snapshot payloads
- `packages/runtime/src/reconciliation-engine.ts`
  - already handled stale, missing, unavailable, partial, and execution-reference truth findings
  - did not yet have a truthful internal model for direct Drift position, health, or open-order comparison
- `packages/carry`
  - consumes runtime and venue-readiness outputs rather than venue-specific SDKs directly
- `packages/config`
  - already had read-only Drift RPC and account-locator env support; it was the right place for any additional locator or environment configuration
- package manifests and lockfile
  - did not yet include a Drift-native decode dependency in the venue adapter package
  - already included the surrounding TypeScript/Solana tooling needed to wire a read-only adapter cleanly

A dedicated dependency was justified because:

- truthful Drift-native decode requires the venue's actual account model and math, not hand-rolled binary parsing guesses
- the adapter boundary already isolates venue-specific SDK use inside `packages/venue-adapters`
- the added dependency is used read-only:
  - no signer management
  - no order submission
  - no live execution path

Phase 5.5 therefore adds:

- `@drift-labs/sdk`
- `@solana/web3.js` in the venue adapter package for the dedicated Drift-native path

## 3. Feasible Vs Unsupported Drift-Native Semantics

### Feasible And Honest

With a configured Drift user locator and the Drift SDK, the repo can now truthfully decode or derive:

- derivative account and subaccount identity
  - user account address
  - authority address
  - subaccount id
  - delegate address
  - margin mode
  - pool id
  - status flags
  - user name when present
- position inventory
  - perp and spot rows from the Drift user account
  - side, base amount, quote amount, entry price, break-even price
  - open-order-related quantities on positions when present
  - market index and symbol where market metadata is resolvable
- health and margin-like state
  - collateral-like totals
  - free collateral
  - leverage
  - initial and maintenance margin requirements
  - health-like status derived through Drift SDK math
- order inventory
  - open orders from the Drift user account
  - order ids, user order ids, market references, side, type, reduce-only flags, size, and price
- source metadata and provenance
  - connector depth
  - commitment
  - observed slot
  - exact vs mixed vs derived annotations
- freshness and completeness
  - complete vs partial vs minimal snapshot semantics
  - explicit unsupported markers where the connector cannot claim more

### Still Unsupported Or Intentionally Out Of Scope

Even after Phase 5.5, the repo still must not claim:

- live execution capability
- signed Drift mutations or order submission
- treasury-style capacity truth
- generic wallet `balanceState` for the Drift-native connector
- direct internal-versus-external Drift position reconciliation
- direct internal-versus-external Drift health reconciliation
- direct internal-versus-external Drift open-order reconciliation
- canonical per-order placement timestamps for every decoded order
- full market, orderbook, or liquidation-engine parity beyond what the read-only user-account path can decode safely
- multi-account portfolio aggregation beyond a single configured locator

## 4. Target Drift Read-Only Design

The target design for Phase 5.5 is:

- a dedicated `DriftReadonlyTruthAdapter`
  - explicit connector depth `drift_native_readonly`
  - still real and read-only
  - no execution support
  - no live approval
- a richer canonical truth contract
  - typed derivative account, position, health, and order sections
  - provenance on decoded and derived fields
  - explicit completeness and coverage posture
  - comparison coverage kept separate from raw venue truth
- runtime projections that expose:
  - connector depth
  - decoded derivative account counts
  - position, health, and order coverage summary
  - comparison coverage that remains honest about what the runtime can and cannot compare directly
- operator surfaces that answer:
  - is this generic wallet truth or Drift-native decode
  - which fields are exact, mixed, or derived
  - which sections are available, partial, or unsupported
  - what reconciliation coverage is actually backed by current runtime models

## 5. Required Runtime, API, Dashboard, And Doc Changes

Required changes identified by the audit:

- contract and adapter layer
  - extend `VenueTruthSnapshot` and related types with provenance and richer Drift-native fields
  - add a dedicated Drift-native read-only adapter
- runtime and persistence
  - keep JSON payload persistence in `venue_connector_snapshots`
  - derive connector depth and comparison coverage from the richer snapshots
  - roll up decoded derivative coverage counts in venue-truth summary views
- reconciliation
  - distinguish unsupported derivative comparison from partial or stale venue truth
  - avoid fake mismatch classes where the runtime lacks a canonical internal comparison model
- API
  - extend existing venue inventory, venue detail, snapshot history, and truth-summary responses
- dashboard
  - add Drift-native truth coverage, account, positions, health, orders, provenance, and comparison-coverage rendering
- docs and runbooks
  - replace Phase 5.4 language that said positions and health were unsupported
  - document the new locator/env requirements and the still-explicit read-only boundary

## 6. Implementation Plan In Priority Order

1. Add the Drift SDK-backed read-only adapter and keep execution posture explicitly disabled.
2. Extend the canonical truth contract with provenance, connector-depth metadata, and richer derivative sections.
3. Route runtime venue refresh through the Drift-native adapter and project connector-depth plus comparison-coverage views.
4. Extend API and dashboard venue surfaces so operators can inspect decoded account, position, health, and order truth directly.
5. Add deterministic tests for adapter honesty, runtime/API/dashboard projections, and unsupported/partial behavior.
6. Update audits, architecture docs, runbooks, ADRs, and README so the repo states the real connector depth truthfully.
