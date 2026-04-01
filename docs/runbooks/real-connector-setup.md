# Real Connector Setup

## Scope

Phase 5.4 still supports read-only real connector setup only. The current in-repo real path is:

- `drift-solana-readonly`

## Required Environment

```bash
export DRIFT_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
export DRIFT_READONLY_ACCOUNT_ADDRESS=replace-with-a-public-key
export DRIFT_READONLY_ACCOUNT_LABEL="optional human label"
```

## What This Enables

- connector inventory entry in `/api/v1/venues`
- truth-depth summary in `/api/v1/venues/truth-summary`
- richer venue detail in `/api/v1/venues/:venueId`
- snapshot history in `/api/v1/venues/:venueId/snapshots`
- dashboard visibility on `/venues`
- runtime-ingested JSON-RPC version check
- account identity snapshot via `getAccountInfo`
- native SOL balance snapshot via `getBalance`
- SPL token balance snapshot via `getTokenAccountsByOwner`
- balance-derived exposure-like state
- recent account transaction references via `getSignaturesForAddress`
- derivative-aware truth profile derivation in runtime and operator views
- partial derivative-account metadata when the tracked account is program-owned:
  - owner program
  - data length
  - raw discriminator bytes
  - coarse account-model classification
- reference-only order-like context derived from recent account signatures
- reconciliation findings for missing, stale, unavailable, partial, and execution-reference mismatch states where justified

## What This Does Not Enable

- venue-native liquidity or treasury-style capacity truth
- decoded Drift authority or subaccount semantics
- Drift-native derivative positions
- margin, health, or collateral semantics
- canonical open-order inventory
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
- treat missing `DRIFT_READONLY_ACCOUNT_ADDRESS` as a minimal-connectivity configuration, not a full account-truth setup
- no new Phase 5.4 environment variables are required; derivative-aware read-only truth is derived from the existing RPC endpoint and tracked account address

## Interpreting Snapshot State

- `truthProfile=derivative_aware`
  - the latest snapshot includes some derivative-oriented or order/reference semantics
  - this does not mean decoded positions or health are available
- `truthCoverage.derivativeAccountState.status=partial`
  - the adapter observed program-account metadata but could not decode venue-native fields
- `truthCoverage.orderState.status=partial`
  - the adapter only has reference-only order context from recent signatures
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

## What Operators Should Monitor

- `/api/v1/venues`, `/api/v1/venues/truth-summary`, and `/api/v1/venues/:venueId` for latest truth depth
- `/api/v1/venues/:venueId/snapshots` for snapshot history and degraded sections
- `/api/v1/runtime/reconciliation/findings?findingType=missing_venue_truth_snapshot`
- `/api/v1/runtime/reconciliation/findings?findingType=stale_venue_truth_snapshot`
- `/api/v1/runtime/reconciliation/findings?findingType=venue_truth_unavailable`
- `/api/v1/runtime/reconciliation/findings?findingType=venue_truth_partial_coverage`
- `/api/v1/runtime/reconciliation/findings?findingType=venue_execution_reference_mismatch`

These findings are the runtime-native signal that a real connector has not produced a successful snapshot yet, has stale truth, is currently unavailable, only partially covered its supported depth, or is missing internally persisted execution references from the latest observed recent-reference set.

## Local Validation

Use targeted validation while iterating on connector depth:

```bash
pnpm --filter @sentinel-apex/venue-adapters test
pnpm --filter @sentinel-apex/runtime test
pnpm --filter @sentinel-apex/api test
pnpm --filter @sentinel-apex/ops-dashboard test
```

Use `pnpm validate:ci` before merge when the change spans adapter, runtime, API, and dashboard surfaces.
