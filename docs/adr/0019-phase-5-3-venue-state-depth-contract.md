# ADR 0019: Phase 5.3 Venue State Depth Contract

## Status

Accepted

## Context

Phase 5.2 established a canonical venue-truth capability model and a first honest real read-only connector path. That contract was enough for readiness, freshness, and high-level health, but it was too shallow for the next operator questions:

- what real account state did we ingest
- what real balance state did we ingest
- whether exposure-like truth exists or is unsupported
- whether execution-reference truth exists or is unsupported
- whether reconciliation is comparing internal state against real external observations

The repo already had one genuine read-only source, generic Solana JSON-RPC, but the contract did not make depth and unsupported areas explicit enough.

## Decision

Sentinel Apex extends the canonical venue-truth model with typed state-depth sections and explicit truth-coverage semantics.

The canonical snapshot now includes:

- `snapshotCompleteness`
- `truthCoverage`
- `sourceMetadata`
- `accountState`
- `balanceState`
- `capacityState`
- `exposureState`
- `executionReferenceState`

Each depth domain must report one of:

- `available`
- `partial`
- `unsupported`

with a reason and limitations where needed.

Phase 5.3 continues to persist append-only venue snapshots in `venue_connector_snapshots`. The richer truth depth is stored in the existing JSON payload and projected back into typed runtime views instead of introducing a new relational schema for every depth section.

Reconciliation may only compare internal state against depth domains whose coverage is actually `available`. Unsupported depth must remain explicit and must not generate fake mismatch classes.

## Consequences

### Positive

- Operators can see not just whether a connector is real, but how deep the trustworthy external state currently is.
- API and dashboard surfaces can distinguish complete, partial, minimal, and unsupported truth without inference.
- Reconciliation can safely compare recent execution references where the real adapter actually exposes them.
- The model remains extendable for future venue-native balance, position, or reference depth.

### Tradeoffs

- The generic venue-truth contract is more detailed and requires stricter serialization and test coverage.
- Some state remains intentionally generic because the current real adapter is Solana RPC, not a venue-native Drift execution connector.
- JSON payload persistence preserves flexibility, but deeper analytics over truth sections may later justify additional derived tables.

## Alternatives Considered

### Keep richer depth only in untyped payload metadata

Rejected because operators and reconciliation code would have to infer coverage and unsupported areas from ad hoc blobs.

### Add mismatch classes for all desired venue-native data immediately

Rejected because many deeper fields are still unsupported by the current real adapter.

### Add a new relational table for every truth-depth section

Rejected for this phase because `venue_connector_snapshots` already provides durable append-only history and the richer payload fits cleanly inside the existing JSONB storage.

## Notes

Phase 5.3 still does not authorize live execution for `drift-solana-readonly`. The adapter remains real, read-only, and not approved for live use.
