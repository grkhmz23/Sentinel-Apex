# Real Connector Setup

## Scope

Phases 5.5 and 5.6 still support read-only real connector setup only. The current in-repo real path is:

- `drift-solana-readonly`

This venue now uses a dedicated Drift-native read-only decode path. It remains read-only, not execution-capable, and not approved for live use.

## Required Environment

```bash
export DRIFT_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
export DRIFT_READONLY_ENV=mainnet-beta
# Choose one locator mode:
export DRIFT_READONLY_ACCOUNT_ADDRESS=replace-with-a-drift-user-account-public-key
# or
export DRIFT_READONLY_AUTHORITY_ADDRESS=replace-with-a-drift-authority-public-key
export DRIFT_READONLY_SUBACCOUNT_ID=0
export DRIFT_READONLY_ACCOUNT_LABEL="optional human label"
```

Locator rules:

- configure either:
  - `DRIFT_READONLY_ACCOUNT_ADDRESS`
  - or `DRIFT_READONLY_AUTHORITY_ADDRESS` plus `DRIFT_READONLY_SUBACCOUNT_ID`
- if no account locator is configured, the connector still records minimal connectivity truth only
- `DRIFT_READONLY_ENV` must match the target Drift environment for market and oracle metadata lookup

## What This Enables

- connector inventory entry in `/api/v1/venues`
- truth-depth summary in `/api/v1/venues/truth-summary`
- richer venue detail in `/api/v1/venues/:venueId`
- internal derivative state in `/api/v1/venues/:venueId/internal-state`
- derivative comparison summary in `/api/v1/venues/:venueId/comparison-summary`
- derivative comparison detail in `/api/v1/venues/:venueId/comparison-detail`
- snapshot history in `/api/v1/venues/:venueId/snapshots`
- dashboard visibility on `/venues`
- runtime-ingested JSON-RPC version check
- decoded Drift user-account identity and subaccount semantics
- account identity and raw account metadata for the configured user locator
- venue-native perp and spot position inventory
- derived exposure summaries over decoded positions
- Drift SDK-derived health, collateral, free-collateral, leverage, and margin requirement state
- venue-native open-order inventory decoded from the Drift user account
- recent account transaction references via `getSignaturesForAddress`
- connector-depth, provenance, and comparison-coverage detail in runtime and operator views
- canonical internal derivative account state from runtime config
- canonical internal open-order inventory from runtime orders
- durable internal position inventory derived from runtime fills
- reconciliation findings for missing, stale, unavailable, partial, and execution-reference mismatch states where justified
- truthful derivative comparison findings for subaccount identity, position inventory, order inventory, comparison gaps, and stale internal derivative state where justified

## What This Does Not Enable

- venue-native liquidity or treasury-style capacity truth
- generic wallet `balanceState` for this connector
- full Drift market-index reconciliation parity
- direct internal-versus-external Drift health comparison
- canonical per-order placement timestamps for every decoded open order
- order placement
- carry execution
- treasury execution
- live approval

## Local Expectations

- keep `EXECUTION_MODE=dry-run`
- keep `FEATURE_FLAG_LIVE_EXECUTION=false`
- use public read-only addresses only
- do not provide signing keys or execution credentials for this connector path
- treat RPC failures as connector degradation, not execution blockers
- treat missing account locator configuration as a minimal-connectivity setup, not a full account-truth setup
- prefer `DRIFT_READONLY_AUTHORITY_ADDRESS` plus `DRIFT_READONLY_SUBACCOUNT_ID` when operators know the Drift authority but do not want to manage raw user account addresses
- keep `DRIFT_READONLY_ENV` aligned with the target cluster and deployed Drift environment
- this path remains strictly read-only even though it now decodes richer venue-native truth

## Interpreting Snapshot State

- `truthProfile=derivative_aware`
  - the latest snapshot includes some derivative-oriented or order/reference semantics
  - in Phase 5.5 this usually means true Drift-native decode depth exists, not merely generic RPC metadata
- `sourceMetadata.connectorDepth=drift_native_readonly`
  - the snapshot came from the dedicated Drift-native read-only adapter
- `snapshotType=drift_native_user_account`
  - the snapshot captured a locator-backed Drift user-account decode attempt
- `snapshotType=drift_native_error`
  - the adapter failed before a successful read-only snapshot could be produced
- `truthCoverage.derivativeAccountState.status=partial`
  - the locator exists, but the Drift user account was missing or decode prerequisites failed for that snapshot
- `truthCoverage.derivativePositionState.status=available`
  - decoded position inventory exists for the snapshot
- `truthCoverage.derivativeHealthState.status=available`
  - Drift SDK health and margin calculations completed for the snapshot
- `truthCoverage.orderState.status=available`
  - the snapshot contains decoded open-order inventory from the Drift user account
- `snapshotCompleteness=complete`
  - every truth section the connector claims to support was captured for that snapshot
- `snapshotCompleteness=partial`
  - some supported truth sections were only partially captured or degraded during capture
- `snapshotCompleteness=minimal`
  - only connectivity-level truth or failure-bounded state was captured
- `truthCoverage.*.status=unsupported`
  - the current adapter cannot supply that domain honestly
- `healthState=unavailable`
  - the connector could not complete the snapshot attempt at all
- `snapshotFreshness=stale`
  - the latest successful persisted snapshot is older than the runtime freshness window
- `provenance.classification=exact`
  - the field was decoded directly from the Drift user account or observed directly from RPC
- `provenance.classification=mixed`
  - the field combines raw Drift decode with market or oracle enrichment
- `provenance.classification=derived`
  - the field is computed from venue-native state through Drift SDK math
- `comparisonCoverage.executionReferences.status=available`
  - the runtime can directly compare persisted execution references against recent venue signatures
- `comparisonCoverage.positionInventory.status=available`
  - the runtime can directly compare internal and external inventory at `asset + marketType` granularity
- `comparisonCoverage.orderInventory.status=partial`
  - internal open-order inventory exists, but direct comparison is limited to orders that already have a venue order id
- `comparisonCoverage.healthState.status=unsupported`
  - external Drift health is visible, but the runtime still does not maintain a truthful internal health model

## What Operators Should Monitor

- `/api/v1/venues`, `/api/v1/venues/truth-summary`, and `/api/v1/venues/:venueId` for latest truth depth
- `/api/v1/venues/:venueId/internal-state` for canonical internal derivative posture
- `/api/v1/venues/:venueId/comparison-summary` for section-level comparison coverage and status
- `/api/v1/venues/:venueId/comparison-detail` for account, position, order, and health comparison details
- `/api/v1/venues/:venueId/snapshots` for snapshot history and degraded sections
- `/api/v1/runtime/reconciliation/findings?findingType=missing_venue_truth_snapshot`
- `/api/v1/runtime/reconciliation/findings?findingType=stale_venue_truth_snapshot`
- `/api/v1/runtime/reconciliation/findings?findingType=venue_truth_unavailable`
- `/api/v1/runtime/reconciliation/findings?findingType=venue_truth_partial_coverage`
- `/api/v1/runtime/reconciliation/findings?findingType=venue_execution_reference_mismatch`
- `/api/v1/runtime/reconciliation/findings?findingType=stale_internal_derivative_state`
- `/api/v1/runtime/reconciliation/findings?findingType=drift_truth_comparison_gap`
- `/api/v1/runtime/reconciliation/findings?findingType=drift_subaccount_identity_mismatch`
- `/api/v1/runtime/reconciliation/findings?findingType=drift_position_mismatch`
- `/api/v1/runtime/reconciliation/findings?findingType=drift_order_inventory_mismatch`

These findings are the runtime-native signal that a real connector has not produced a successful snapshot yet, has stale truth, is currently unavailable, only partially covered its supported depth, is missing internally persisted execution references from the latest observed recent-reference set, has stale internal derivative state, or has a truth-backed derivative mismatch/comparison gap.

## Local Validation

Use targeted validation while iterating on connector depth:

```bash
pnpm --filter @sentinel-apex/config typecheck
pnpm --filter @sentinel-apex/venue-adapters typecheck
pnpm --filter @sentinel-apex/venue-adapters build
pnpm --filter @sentinel-apex/venue-adapters test
pnpm --filter @sentinel-apex/runtime typecheck
pnpm --filter @sentinel-apex/runtime build
pnpm --filter @sentinel-apex/runtime test
pnpm --filter @sentinel-apex/api typecheck
pnpm --filter @sentinel-apex/api test -- src/__tests__/runtime-api.test.ts
pnpm --filter @sentinel-apex/ops-dashboard typecheck
pnpm --filter @sentinel-apex/ops-dashboard test -- src/app-pages.test.tsx
```

Use `pnpm validate:ci` before merge when the change spans adapter, runtime, API, dashboard, and internal comparison surfaces.
