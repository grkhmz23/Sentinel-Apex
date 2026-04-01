# ADR 0020: Phase 5.4 Derivative-Aware Read-Only Truth Contract

## Status

Accepted

## Context

Phase 5.3 established typed venue-truth depth for account, balance, capacity, exposure-like, and recent-reference state. That contract was enough for generic wallet truth, but it was still too shallow for the next operator questions:

- do we have any derivative-aware venue truth for this connector
- is that truth decoded venue-native state or only partial account metadata
- do we have positions, health, or order state
- what is unsupported versus merely partial

The repo's real connector remains generic Solana JSON-RPC, and the repo does not currently include Drift SDK, Anchor, or venue-native decode dependencies. That means the contract must be able to represent derivative-aware partial truth without pretending decoded positions, health, or canonical open orders exist.

## Decision

Sentinel Apex extends the canonical venue-truth model with derivative-aware typed sections and coverage domains.

The canonical snapshot now includes optional sections for:

- `derivativeAccountState`
- `derivativePositionState`
- `derivativeHealthState`
- `orderState`

The canonical `truthCoverage` map also includes:

- `derivativeAccountState`
- `derivativePositionState`
- `derivativeHealthState`
- `orderState`

Each derivative-aware domain must report one of:

- `available`
- `partial`
- `unsupported`

with reason and limitations where needed.

Phase 5.4 continues to persist append-only venue snapshots in `venue_connector_snapshots`. The richer derivative-aware truth remains in the existing JSON payload and is projected into typed runtime views instead of introducing new relational tables for partially supported sections.

Runtime also derives a venue-level `truthProfile` so operator surfaces can distinguish:

- `minimal`
- `generic_wallet`
- `capacity_only`
- `derivative_aware`

`derivative_aware` means some derivative-oriented or order/reference semantics are present. It does not imply decoded positions, margin, or open-order parity.

## Consequences

### Positive

- Operators can see whether a connector has only generic wallet truth or some derivative-aware truth depth.
- The real read-only adapter can expose raw program-account metadata and reference-only order context without overstating venue-native decode support.
- Runtime, API, dashboard, and reconciliation code can render unsupported and partial derivative domains explicitly.
- The model remains extendable for future venue-native decode work.

### Tradeoffs

- The contract is more detailed and requires stricter serialization and test coverage.
- Some operator panels now intentionally render explicit `unsupported` states rather than hiding empty data.
- JSON payload persistence keeps the model flexible, but deeper analytics over derivative sections may later justify dedicated derived tables.

## Alternatives Considered

### Keep derivative-aware data only in loose metadata

Rejected because operators and reconciliation code would have to infer derivative posture from ad hoc payload fields.

### Add decoded position and health fields immediately

Rejected because the current real connector cannot honestly provide them from raw JSON-RPC alone.

### Introduce a separate relational model for derivative truth in this phase

Rejected because the existing append-only snapshot history already fits the richer payload and no new relational query shape is required yet.

## Notes

Phase 5.4 still does not authorize live execution for `drift-solana-readonly`. The adapter remains real, read-only, and not approved for live use.
