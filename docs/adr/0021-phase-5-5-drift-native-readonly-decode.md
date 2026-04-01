# ADR 0021: Phase 5.5 Drift-Native Read-Only Decode

## Status

Accepted

## Context

ADR 0020 introduced derivative-aware truth sections, but the real connector was still generic Solana JSON-RPC. That was enough to represent partial derivative posture honestly, but it still left the repo unable to answer the core Drift-native questions operators actually care about:

- do we have decoded user or subaccount semantics
- do we have real position inventory
- do we have health or margin-like state
- do we have canonical venue open-order inventory
- which values are exact versus derived

The repo already had the right persistence and projection shape for richer truth in `venue_connector_snapshots`, but it lacked a dedicated venue-native decode layer.

## Decision

Sentinel Apex adds a dedicated Drift-native read-only adapter and extends the truth contract to represent decoded and derived Drift semantics explicitly.

Key decisions:

- implement a dedicated `DriftReadonlyTruthAdapter`
- keep the venue id `drift-solana-readonly`
- record connector depth as `drift_native_readonly`
- use the Drift SDK only inside `packages/venue-adapters`
- keep the path read-only with `executionSupport=false` and `approvedForLiveUse=false`
- annotate richer truth with provenance:
  - `exact`
  - `mixed`
  - `derived`
- keep comparison coverage separate from raw venue truth coverage

The canonical model now supports:

- decoded derivative account state
- decoded position inventory
- derived health and margin state
- decoded open-order inventory
- source depth and provenance metadata
- runtime-level comparison coverage projections

## Consequences

### Positive

- Operators can distinguish generic wallet truth from Drift-native decode.
- The repo can now expose typed Drift account, position, health, and order truth without inventing live execution capability.
- Runtime and dashboard views can explain both what the venue returned and what reconciliation can actually compare.
- The append-only JSON snapshot model remains sufficient, so the phase avoids unnecessary schema churn.

### Tradeoffs

- The venue truth contract is more detailed and requires stricter tests and docs.
- Some important fields are derived through Drift SDK math, so provenance must remain explicit instead of pretending every number is a raw venue field.
- Direct reconciliation for positions, health, and orders is still unavailable until the runtime persists matching internal canonical models.

## Alternatives Considered

### Stay On Generic Solana RPC Only

Rejected because it could not truthfully provide Drift-native account, position, health, or order semantics.

### Decode Drift Accounts Manually Without The Drift SDK

Rejected because it would create a higher-maintenance, lower-confidence decode layer than the venue's own SDK and math helpers.

### Add New Relational Tables For Drift-Native Truth In This Phase

Rejected because existing append-only snapshot JSON already fits the current operator and runtime query needs.

## Notes

Phase 5.5 still does not authorize live execution for the Drift connector. The new adapter improves read-only truth only.
