# Phase 5.2 Venue Truth Integration

## Intent

Phase 5.2 adds a generic venue-truth layer without pretending broad live execution exists. The system now exposes a canonical connector inventory and append-only venue snapshot history across simulated adapters and explicitly read-only real adapters.

## Canonical Contract

`packages/venue-adapters/src/interfaces/venue-truth-adapter.ts` defines:

- `VenueCapabilitySnapshot`
- `VenueTruthSnapshot`
- `VenueTruthAdapter`

The contract separates:

- capability/readiness truth
- latest observed venue truth
- execution support truth

## Persistence Model

`venue_connector_snapshots` is append-only and stores both:

- capability metadata at capture time
- truth snapshot payload at capture time

The operator inventory is derived from the latest snapshot per `venue_id`. Snapshot history remains available for drill-through.

## Real Connector Scope

This phase adds one honest real read-only adapter:

- `SolanaRpcReadonlyTruthAdapter`

It uses JSON-RPC only for:

- `getVersion`
- optional `getBalance`

It does not claim:

- order placement
- venue-native execution
- live approval

## Runtime Integration

The runtime refreshes generic venue truth during:

- startup / projection rebuild
- carry venue snapshot refresh
- treasury evaluation persistence
- completed runtime cycles

This keeps the generic venue inventory aligned with the runtime’s existing sleeve-specific snapshot paths.

## Reconciliation Integration

Reconciliation now consumes the generic venue-truth layer for configured real connectors.

This phase adds explicit findings for:

- `missing_venue_truth_snapshot`
  - a configured real connector has not produced a successful persisted generic snapshot yet
- `stale_venue_truth_snapshot`
  - the latest persisted real snapshot is older than the freshness window
- `venue_truth_unavailable`
  - the latest persisted real snapshot reports unavailable health

These findings use the existing reconciliation run, finding, and mismatch rails. They do not claim full venue-native parity across every external state shape yet.

## Operator Surfaces

Operators now get:

- cross-sleeve venue inventory
- real vs simulated visibility
- read-only vs execution-capable visibility
- snapshot freshness and health
- recent snapshot history per venue

This layer is read-oriented. No new live-execution mutation surface is introduced in Phase 5.2.
