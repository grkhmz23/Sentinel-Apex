# Phase 5.3 Venue State Depth

## Intent

Phase 5.3 deepens the generic venue-truth layer from capability/freshness posture into typed read-only venue state. The goal is to make runtime, reconciliation, and operator surfaces more useful without overstating live-execution maturity.

## Contract Additions

`packages/venue-adapters/src/interfaces/venue-truth-adapter.ts` now extends `VenueTruthSnapshot` with:

- `snapshotCompleteness`
  - `complete`
  - `partial`
  - `minimal`
- `truthCoverage`
  - per-domain `available`, `partial`, or `unsupported` status
  - explicit reason and limitations
- `sourceMetadata`
  - source kind, source name, and observed scope
- typed depth sections:
  - `accountState`
  - `balanceState`
  - `capacityState`
  - `exposureState`
  - `executionReferenceState`

This keeps the snapshot contract structured and capability-gated instead of collapsing depth into an untyped payload blob.

## Real Read-Only Scope

The real adapter in scope remains:

- `SolanaRpcReadonlyTruthAdapter`

It now uses generic Solana JSON-RPC for:

- `getVersion`
- `getAccountInfo`
- `getBalance`
- `getTokenAccountsByOwner`
- `getSignaturesForAddress`

That adapter can truthfully provide:

- account identity and ownership state
- native SOL balance
- SPL token balances visible through the token program
- balance-derived spot exposure-like state
- recent account signatures as execution or transaction references

It still cannot truthfully provide:

- treasury-style venue capacity or liquidity
- Drift-native derivative positions
- venue-native execution details beyond recent account signatures
- execution-capable or live-approved posture

## Persistence Model

Phase 5.3 keeps the Phase 5.2 persistence shape:

- append-only `venue_connector_snapshots`

No new table or migration is required. The richer truth depth is stored inside the existing `snapshot_payload` JSONB field and projected back into typed runtime views. This keeps history durable while avoiding unnecessary schema churn.

## Runtime And Read Models

`packages/runtime` now:

- persists richer venue-truth payloads
- derives latest per-venue completeness and coverage state
- exposes `getVenueTruthSummary()` for operator rollups
- keeps inventory, detail, and snapshot history aligned with the richer typed contract

The derived truth summary counts:

- complete / partial / minimal snapshots
- available / partial / unsupported status for:
  - account state
  - balance state
  - capacity state
  - exposure state
  - execution references

## Reconciliation

Reconciliation now consumes the richer venue-truth depth in two additional ways:

- `venue_truth_partial_coverage`
  - raised when a real venue snapshot is not `complete`
- `venue_execution_reference_mismatch`
  - raised only when the connector truth says execution references are available
  - compares persisted internal execution references against the latest observed venue references

Missing, stale, and unavailable real venue truth findings from Phase 5.2 remain in place.

This phase still does not invent balance, position, or execution mismatch classes where the connector truth is unsupported.

## API And Dashboard

The API now exposes richer venue detail and summary through:

- `GET /api/v1/venues`
- `GET /api/v1/venues/summary`
- `GET /api/v1/venues/truth-summary`
- `GET /api/v1/venues/readiness`
- `GET /api/v1/venues/:venueId`
- `GET /api/v1/venues/:venueId/snapshots`

The ops dashboard uses those backend contracts to show:

- venue truth-depth summary
- per-venue completeness and coverage
- account state
- balance state
- exposure-like state
- recent execution references
- freshness and degraded-state context

## Honest Boundaries

Phase 5.3 is still read-only truth expansion, not broad live-execution enablement. The richer venue-truth contract exists to make unsupported areas explicit and to give operators more reliable external grounding where the repo can actually fetch it.
