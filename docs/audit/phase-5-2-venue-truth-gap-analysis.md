# Phase 5.2 Venue Truth Gap Analysis

Date: 2026-03-31

## Current Connector Landscape

- Carry venue capability state existed only as per-run `carry_venue_snapshots`.
- Treasury venue capability/readiness state existed only as per-run `treasury_venue_snapshots`.
- All built-in adapters were simulated.
- The repo had no generic cross-sleeve venue inventory, no generic venue snapshot history, and no honest operator-facing distinction between:
  - simulated only
  - real read-only
  - real execution-capable

## Simulated vs Real Status Before This Pass

- Simulated:
  - `SimulatedVenueAdapter`
  - `SimulatedTreasuryVenueAdapter`
- Real read-only:
  - none persisted or exposed through a generic operator surface
- Real execution-capable:
  - none implemented in-repo

## Target Design

- Introduce a generic venue truth contract in `packages/venue-adapters`.
- Persist append-only generic connector snapshots in `venue_connector_snapshots`.
- Derive a canonical operator inventory from the latest snapshot per venue.
- Add one honest real read-only connector path:
  - Solana JSON-RPC via `DRIFT_RPC_ENDPOINT`
  - optional `DRIFT_READONLY_ACCOUNT_ADDRESS`
  - explicit `readOnlySupport=true`
  - explicit `executionSupport=false`
  - explicit `approvedForLiveUse=false`

## Required Changes

- Schema:
  - add `venue_connector_snapshots`
- Runtime/store/control-plane:
  - collect generic venue capability + truth snapshots
  - persist snapshot history
  - expose list/detail/summary/readiness queries
- API:
  - add `/api/v1/venues`, `/summary`, `/readiness`, `/:venueId`, `/:venueId/snapshots`
- Dashboard:
  - add `/venues`
  - add `/venues/[venueId]`
- Config/runbooks:
  - document read-only connector env and live-readiness boundaries

## Implementation Priority

1. Add the generic venue truth contract and persistence.
2. Add a real read-only RPC-backed connector path without claiming execution support.
3. Expose runtime/API/dashboard inventory and snapshot history.
4. Document onboarding, readiness, and remaining limits.
