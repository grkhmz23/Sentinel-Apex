# Phase 5.4 Derivative Truth Gap Analysis

Date: 2026-04-01

## Current Connector Depth

Phase 5.3 established a canonical venue-truth capability/readiness contract, append-only `venue_connector_snapshots`, and one honest real read-only path:

- `drift-solana-readonly`

Before this pass, the real connector depth was still mostly generic Solana RPC truth:

- cluster connectivity and RPC version
- account identity via `getAccountInfo`
- native SOL balance via `getBalance`
- SPL token balances via `getTokenAccountsByOwner`
- balance-derived spot exposure-like state
- recent account signatures via `getSignaturesForAddress`

That was already useful for freshness, degraded-state detection, and generic wallet truth, but it still left the next operator questions unanswered:

- do we have any venue-native derivative account semantics at all
- can we distinguish generic wallet truth from derivative-aware truth
- do we have decoded positions, health, or open orders
- what derivative depth is unsupported versus merely partial

## Available vs Unsupported Derivative And Account Semantics

The current repo does not include Drift SDK, Anchor, or other venue-native decode dependencies in package manifests or the lockfile. The real connector path is therefore still a raw JSON-RPC reader and must stay honest about what it can and cannot decode.

What the repo can now honestly support from the current dependency and environment posture:

- derivative-account-oriented metadata when a tracked account is configured and the account is program-owned:
  - account owner program
  - data length
  - raw discriminator bytes
  - coarse account model classification
- stronger recent-reference context tied to the tracked account
- reference-only order-like context derived from recent signatures
- explicit distinction between:
  - generic wallet truth
  - derivative-aware partial truth
  - unsupported derivative domains

What remains unsupported from the current repo state:

- decoded Drift authority or subaccount fields
- venue-native derivative positions
- margin, health, or collateral semantics
- canonical open-order inventory
- venue-native market state beyond generic RPC metadata
- live execution capability or live approval

The important boundary is that raw program-account metadata is not equivalent to decoded venue-native account truth. It is useful derivative-aware evidence, but it is still only partial.

## Target Derivative-Aware Read-Only Design

Phase 5.4 should extend `VenueTruthSnapshot` with typed, capability-gated derivative sections instead of hiding them in generic metadata:

- `derivativeAccountState`
- `derivativePositionState`
- `derivativeHealthState`
- `orderState`

The canonical `truthCoverage` contract also needs explicit derivative-aware domains:

- `derivativeAccountState`
- `derivativePositionState`
- `derivativeHealthState`
- `orderState`

The runtime should derive a truthful operator profile from the latest snapshot:

- `minimal`
- `generic_wallet`
- `capacity_only`
- `derivative_aware`

That profile must remain grounded in the latest connector truth:

- `derivative_aware` does not mean decoded positions or health exist
- `partial` does not mean unavailable
- `unsupported` does not mean stale

The real read-only adapter should then expose:

- partial derivative-account metadata where generic RPC can support it
- partial order/reference context where recent signatures can support it
- explicit `unsupported` for decoded positions and health

## Required Changes

- Contract:
  - extend the canonical venue-truth interfaces with typed derivative account, position, health, and order sections
  - keep those sections optional and capability-gated
- Real adapter:
  - deepen `drift-solana-readonly` to expose raw derivative-account metadata and reference-only order context
  - keep execution posture read-only
- Runtime and store:
  - persist the richer payload inside existing `venue_connector_snapshots.snapshot_payload`
  - derive `truthProfile`
  - surface derivative-aware coverage in venue inventory, detail, snapshots, and truth summary
- Reconciliation:
  - distinguish partial derivative-aware truth from unavailable or stale truth
  - avoid adding fake derivative mismatch classes where external truth is unsupported
- API:
  - extend venue inventory/detail/summary/snapshot responses with derivative-aware coverage and sections
- Dashboard:
  - render derivative coverage, derivative-account metadata, explicit unsupported positions/health state, and reference-only order context
- Docs:
  - document the exact partial-vs-unsupported boundary for the real connector

## Implementation Priority

1. Extend the canonical venue-truth contract with derivative-aware typed sections and coverage domains.
2. Deepen the real read-only adapter using only truthful JSON-RPC observations.
3. Persist and project the richer payload without unnecessary schema churn.
4. Extend runtime and reconciliation to expose derivative-aware coverage and truth profile semantics.
5. Extend API and dashboard surfaces for operator inspection.
6. Update audit, architecture, readiness, setup, and live-readiness docs so the repo tells the truth about what is still unsupported.
