# Phase 5.4 Derivative-Aware Read-Only Connector Truth

## Intent

Phase 5.4 deepens venue truth from generic wallet-level RPC observations into derivative-aware read-only semantics where the repo can honestly support them. The goal is to improve runtime, reconciliation, and operator visibility without overstating venue-native decode depth or live-execution maturity.

## Contract Additions

`packages/venue-adapters/src/interfaces/venue-truth-adapter.ts` now extends `VenueTruthSnapshot` with derivative-aware sections:

- `derivativeAccountState`
- `derivativePositionState`
- `derivativeHealthState`
- `orderState`

The canonical `truthCoverage` contract now also includes:

- `derivativeAccountState`
- `derivativePositionState`
- `derivativeHealthState`
- `orderState`

These sections remain typed, optional, and capability-gated. Unsupported fields stay explicit instead of being silently omitted or collapsed into an untyped blob.

## Real Read-Only Scope

The real adapter in scope remains:

- `SolanaRpcReadonlyTruthAdapter`

It still uses generic Solana JSON-RPC only:

- `getVersion`
- `getAccountInfo`
- `getBalance`
- `getTokenAccountsByOwner`
- `getSignaturesForAddress`

From that source, the adapter can now truthfully provide:

- derivative-account-oriented metadata for a tracked account when the account is program-owned:
  - owner program
  - data length
  - raw discriminator bytes
  - coarse account-model classification
- reference-only order context derived from recent account signatures

It still cannot truthfully provide:

- decoded Drift authority or subaccount semantics
- venue-native derivative positions
- margin, health, or collateral semantics
- canonical open-order inventory
- execution-capable or live-approved posture

That boundary is intentional. Phase 5.4 is derivative-aware read-only truth, not venue-native live integration.

## Persistence Model

Phase 5.4 keeps the existing persistence shape:

- append-only `venue_connector_snapshots`

No new table or migration is required. The richer derivative-aware payload is stored in the existing `snapshot_payload` JSONB field and projected back into typed runtime views. This keeps history durable while avoiding schema churn for partially supported depth.

## Runtime And Read Models

`packages/runtime` now:

- persists derivative-aware snapshot payloads
- derives a `truthProfile` for venue inventory and detail views:
  - `minimal`
  - `generic_wallet`
  - `capacity_only`
  - `derivative_aware`
- exposes derivative-aware coverage counts in venue summary and truth-summary rollups
- carries typed derivative account, position, health, and order sections through venue detail and snapshot history

The important operator distinction is:

- `generic_wallet`
  - generic wallet and balance truth exists
- `derivative_aware`
  - some derivative-oriented or order/reference semantics exist, even if only partially

## Reconciliation

Reconciliation continues to consume only truth domains the connector actually supports.

Phase 5.4 extends operator-facing reconciliation semantics by:

- surfacing derivative-aware coverage posture inside venue-truth partial findings
- carrying `truthProfile` into stale, unavailable, partial, and execution-reference mismatch findings
- exposing whether order-reference comparison is backed only by recent-signature context

This phase still does not add fake mismatch classes for:

- derivative positions
- derivative health
- canonical open orders

Those comparisons remain out of scope until the external truth is actually available.

## API And Dashboard

The existing venue surfaces now expose richer derivative-aware truth:

- `GET /api/v1/venues`
- `GET /api/v1/venues/summary`
- `GET /api/v1/venues/truth-summary`
- `GET /api/v1/venues/:venueId`
- `GET /api/v1/venues/:venueId/snapshots`

The ops dashboard uses those backend contracts to show:

- truth profile badges
- derivative truth coverage summary
- derivative-account metadata panels
- explicit unsupported positions and health state
- order/reference methodology and reference-only limits
- freshness and source metadata

## Honest Boundaries

Phase 5.4 does not broaden execution posture. The in-repo real connector remains:

- real
- read-only
- not execution-capable
- not approved for live use

The richer derivative-aware contract exists to make partial venue-native visibility explicit. It is not a claim that the repo can already decode or trade venue-native derivative state comprehensively.
