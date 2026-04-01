# Phase 5.5 Drift-Native Read-Only Decode

## Intent

Phase 5.5 moves Sentinel Apex from generic RPC-level derivative awareness to a dedicated Drift-native read-only decode path. The goal is to expose truthful typed Drift account, position, health, and order truth to operators without changing the repo's execution posture.

## Dedicated Adapter

The real connector in scope remains:

- venue id:
  - `drift-solana-readonly`

Its connector depth is now:

- `drift_native_readonly`

The implementation boundary is:

- `packages/venue-adapters/src/real/drift-readonly-truth-adapter.ts`

This adapter:

- uses Drift SDK account decode and margin math
- stays read-only
- does not manage signers
- does not submit transactions
- does not change live-approval posture

## Truth Contract Additions

Phase 5.5 refines the canonical venue-truth contract with:

- connector-depth metadata on `sourceMetadata`
- data provenance on decoded and derived sections
- richer derivative account fields
- richer position fields
- richer order fields
- explicit comparison-coverage views in runtime projections

Important distinctions:

- `truthCoverage`
  - what the connector captured and how complete that venue truth is
- `provenance`
  - whether a field is exact, mixed, or derived
- `comparisonCoverage`
  - whether the runtime can directly compare its own internal model against that truth

Those are intentionally separate. A decoded section can be operator-visible venue truth while still remaining unsupported for direct reconciliation if the runtime lacks a matching internal canonical model.

## Supported Drift-Native Sections

### Derivative Account State

The adapter can now expose typed Drift user-account semantics including:

- authority address
- subaccount id
- delegate address
- margin mode
- pool id
- open order counts
- open auction counts
- status flags
- user name when present

These fields are marked `available` when the user account can be decoded and `partial` when the locator exists but decode cannot be completed for that snapshot.

### Position Inventory

The adapter can expose decoded perp and spot positions from the Drift user account.

Position rows include:

- market references
- position type
- side
- base and quote amounts
- entry and break-even price
- unrealized PnL
- liquidation price when available
- position value and open-order-related quantities where resolvable

Provenance is:

- exact for values decoded directly from the user account
- mixed when current market or oracle context is used to enrich the row

### Health And Margin

The adapter can expose Drift SDK-derived health and margin-like state:

- health status
- health score
- collateral totals
- free collateral
- leverage
- initial and maintenance margin requirements

These fields are venue-native derived state, not raw on-chain scalar copies, so provenance is marked `derived`.

### Order Inventory

The adapter can expose open-order inventory decoded from the Drift user account.

This includes:

- venue order id
- user order id
- market references
- side
- order type
- price
- quantity
- reduce-only posture

The adapter does not claim canonical placement timestamps for every order. `placedAt` remains null unless the connector can truthfully provide it.

### Execution References

Recent execution references remain based on recent Solana signatures for the tracked account. This is still a useful reconciliation input, but it is not the same thing as canonical live execution support.

## Persistence Model

Phase 5.5 keeps the existing persistence shape:

- append-only `venue_connector_snapshots`

No new schema or migration is required. The richer Drift-native payload is stored in the existing JSON snapshot payload and projected back into runtime read models.

## Runtime And Reconciliation

Runtime now:

- registers the Drift-native read-only adapter for the real Drift venue path
- records connector depth alongside source metadata
- derives comparison coverage for:
  - execution references
  - position inventory
  - health state
  - order inventory
- rolls up venue-truth summary counts for:
  - Drift-native read-only depth
  - decoded derivative accounts
  - decoded derivative positions
  - health metric venues
  - venue open-order inventory

Reconciliation stays honest:

- stale, missing, unavailable, and partial venue-truth findings remain active
- execution-reference comparison remains the only direct real-venue comparison the runtime currently supports
- decoded Drift positions, health, and open orders are operator-visible truth, but still `unsupported` for direct comparison until the runtime persists matching canonical internal models

## API And Dashboard

The existing venue surfaces now expose richer Drift-native truth through:

- `GET /api/v1/venues`
- `GET /api/v1/venues/summary`
- `GET /api/v1/venues/truth-summary`
- `GET /api/v1/venues/:venueId`
- `GET /api/v1/venues/:venueId/snapshots`

The ops dashboard uses those contracts to render:

- connector depth and provenance
- decoded derivative account detail
- position inventory
- health and margin sections
- open-order inventory
- explicit unsupported or partial sections
- comparison-coverage notes that explain what the runtime can actually reconcile

## Configuration

Phase 5.5 adds read-only Drift decode configuration for:

- `DRIFT_READONLY_ENV`
- `DRIFT_READONLY_AUTHORITY_ADDRESS`
- `DRIFT_READONLY_SUBACCOUNT_ID`

The adapter can resolve a user locator either by:

- explicit `DRIFT_READONLY_ACCOUNT_ADDRESS`
- or `DRIFT_READONLY_AUTHORITY_ADDRESS` plus `DRIFT_READONLY_SUBACCOUNT_ID`

## Honest Boundaries

Phase 5.5 does not broaden execution posture. The Drift path remains:

- real
- read-only
- not execution-capable
- not approved for live use

The deeper decode exists to improve truth, visibility, and operator understanding. It is not a claim that Sentinel Apex can already trade or reconcile Drift comprehensively.
