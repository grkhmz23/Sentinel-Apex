# Phase 5.3 Venue State Depth Gap Analysis

Date: 2026-03-31

## Current Venue-Truth Depth

Phase 5.2 established a canonical connector capability/readiness contract, append-only `venue_connector_snapshots`, and one honest real read-only path:

- `drift-solana-readonly`

Before this pass, generic venue truth was still relatively shallow:

- capability/readiness posture
- freshness and health
- optional read-only balance capture
- no typed account-state contract
- no typed exposure-like truth
- no typed execution-reference truth
- no operator-facing truth-depth summary
- reconciliation coverage focused on missing, stale, and unavailable venue truth only

## Available vs Unsupported Deeper Fields

The current real adapter is generic Solana JSON-RPC. From that source, the repo can honestly support:

- cluster connectivity and RPC version
- account identity via `getAccountInfo`
- native SOL balance via `getBalance`
- SPL token balances via `getTokenAccountsByOwner`
- balance-derived spot exposure-like state from those balances
- recent account transaction references via `getSignaturesForAddress`

The repo cannot honestly support from this adapter alone:

- venue-native liquidity or treasury-style capacity state
- Drift-native perp positions or margin-account semantics
- canonical venue-native order history
- execution-capable connector claims
- live approval

Unsupported depth must therefore stay explicit in the contract instead of being silently omitted.

## Target Richer Snapshot Design

Phase 5.3 should extend `VenueTruthSnapshot` with typed, capability-gated depth:

- `snapshotCompleteness`
- `truthCoverage`
- `sourceMetadata`
- `accountState`
- `balanceState`
- `capacityState`
- `exposureState`
- `executionReferenceState`

Each depth area needs explicit `available`, `partial`, or `unsupported` coverage with a reason and limitations. That allows runtime, reconciliation, API, and dashboard code to expose truthful operator semantics without inferring unsupported data.

## Required Changes

- Contract:
  - extend the canonical venue-truth interfaces with typed depth sections and explicit coverage metadata
- Runtime/store:
  - persist the richer truth payload inside the existing `venue_connector_snapshots.snapshot_payload`
  - derive latest venue inventory with completeness, coverage, and source metadata
  - expose truth-depth summary rollups
- Real adapter:
  - deepen the Solana read-only path to capture account, balance, exposure-like, and recent-reference truth where available
- Reconciliation:
  - distinguish missing vs stale vs unavailable vs partial coverage
  - compare internal execution references against venue-native recent references only when that truth is actually available
- API:
  - extend venue detail/snapshot responses
  - add truth-depth summary
- Dashboard:
  - show richer venue detail, completeness, coverage, and recent references
- Docs:
  - update setup/runbooks to explain stale vs unsupported vs unavailable and the exact limits of the current adapter

## Implementation Priority

1. Extend the canonical venue-truth contract with typed depth and explicit coverage semantics.
2. Deepen the real read-only Solana adapter using only genuine JSON-RPC reads.
3. Persist and derive richer truth views without unnecessary schema churn.
4. Add reconciliation for partial truth coverage and execution-reference comparison where supported.
5. Extend API and dashboard surfaces for operator visibility.
6. Update runbooks and audit docs so the repo tells the truth about what remains unsupported.
