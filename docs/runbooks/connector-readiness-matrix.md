# Connector Readiness Matrix

## Canonical States

- `simulated`: in-repo simulated adapter only
- `read_only`: real external truth can be fetched, but execution is not supported
- `ready_for_review`: execution support exists in code but is not approved for live use
- `approved_for_live`: approved for live use

## Current Connectors

| Venue | Truth Mode | Sleeve Scope | Read-only | Execution | Approved Live | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `sim-venue-a` / `sim-venue-b` | simulated | carry | no | yes, simulated only | no | deterministic carry adapter with simulated balance/exposure truth |
| `atlas-t0-sim` / `atlas-t1-sim` | simulated | treasury | no | yes, simulated only | no | deterministic treasury adapter with simulated capacity/allocation truth |
| `drift-solana-readonly` | real | carry | yes | no | no | dedicated Drift-native read-only decode for user/subaccount semantics, positions, health/margin, open orders, and recent signatures |

## Truth Depth By Connector

- `sim-venue-a` / `sim-venue-b`
  - account state: unsupported
  - balance state: available in simulation
  - capacity state: unsupported
  - exposure state: available in simulation
  - execution references: unsupported
  - derivative account state: unsupported
  - derivative position state: unsupported
  - derivative health state: unsupported
  - order/reference state: unsupported
- `atlas-t0-sim` / `atlas-t1-sim`
  - account state: unsupported
  - balance state: unsupported
  - capacity state: available in simulation
  - exposure state: available as allocation state in simulation
  - execution references: unsupported
  - derivative account state: unsupported
  - derivative position state: unsupported
  - derivative health state: unsupported
  - order/reference state: unsupported
- `drift-solana-readonly`
  - account state: available when `DRIFT_READONLY_ACCOUNT_ADDRESS` is configured, or when `DRIFT_READONLY_AUTHORITY_ADDRESS` plus `DRIFT_READONLY_SUBACCOUNT_ID` resolves the user account
  - balance state: unsupported; this connector intentionally models derivative collateral and positions rather than generic wallet balances
  - capacity state: unsupported
  - exposure state: available as a derived convenience view over decoded Drift positions
  - execution references: available as recent account signatures for the tracked Drift user account
  - derivative account state: available when the Drift user account can be decoded; partial when the locator is configured but the account is missing or decode prerequisites fail
  - derivative position state: available when the Drift user account and supporting market context can be decoded; valuation fields may carry mixed provenance
  - derivative health state: available as Drift SDK-derived health, collateral, free-collateral, leverage, and margin metrics when required data is available
  - order/reference state: available as decoded venue open-order inventory from the Drift user account; recent signatures remain a separate execution-reference surface

## Operator Interpretation

- `truthMode=simulated` means the snapshot is generated entirely in-repo.
- `truthMode=real` means the snapshot came from an external system.
- `executionSupport=false` means the connector must not be treated as live-execution capable.
- `approvedForLiveUse=false` means operators must not infer production trading readiness.
- `sourceMetadata.connectorDepth=drift_native_readonly` means the snapshot came from the dedicated Drift-native read-only decode path rather than the generic RPC-only adapter.
- `truthProfile=minimal` means the venue only has minimal connectivity or failure-bounded truth.
- `truthProfile=generic_wallet` means the venue has generic wallet/account/balance truth but no derivative-aware semantics.
- `truthProfile=capacity_only` means the venue has capacity/allocation-style truth but not generic wallet or derivative truth.
- `truthProfile=derivative_aware` means the latest snapshot includes some derivative-oriented or order/reference semantics, even if those domains are only partial.
- `snapshotCompleteness=complete` means the connector captured every truth section it claims to support for that snapshot attempt.
- `snapshotCompleteness=partial` means the connector captured some supported sections but degraded during the same snapshot attempt.
- `snapshotCompleteness=minimal` means only a narrow subset of truth was captured, usually connectivity-only or failure-bounded state.
- `snapshotFreshness=stale` means the latest real venue snapshot is outside the runtime freshness window and should be treated as degraded operator truth.
- `healthState=unavailable` means the latest connector snapshot failed or could not reach the external venue.
- `truthCoverage.*.status=unsupported` means the current connector or source cannot supply that field honestly.
- `truthCoverage.*.status=partial` means the connector can usually support that field, but the latest snapshot only captured it partially.
- `truthCoverage.*.status=available` means the latest snapshot captured that field within the connector's supported depth.
- `provenance.classification=exact` means the field was decoded or observed directly from the venue source.
- `provenance.classification=mixed` means the field combines direct venue decode with market or oracle enrichment.
- `provenance.classification=derived` means the field is calculated from venue-native state rather than copied directly from a single raw venue field.
- `comparisonCoverage.*.status=unsupported` means operator-visible venue truth exists, but the runtime does not yet maintain a matching internal model for direct comparison.
- `comparisonCoverage.*.status=partial` means the runtime has some truthful comparison coverage, but one or more required internal or external keys are still missing.
- `comparisonCoverage.*.status=available` means the runtime can compare that section directly within its current modeled granularity.

## Reconciliation Signals

Phase 5.3 exposes explicit reconciliation findings for real connectors:

- `missing_venue_truth_snapshot`
  - no successful persisted venue snapshot has been recorded yet
- `stale_venue_truth_snapshot`
  - the latest persisted real snapshot is outside the freshness window
- `venue_truth_unavailable`
  - the latest persisted real snapshot reports unavailable connector health
- `venue_truth_partial_coverage`
  - the latest persisted real snapshot did not fully cover the connector's supported truth depth
- `venue_execution_reference_mismatch`
  - persisted internal execution references are missing from the latest observed venue-native recent references, but only for connectors that actually expose recent references

These findings indicate whether the runtime can currently rely on fresh, healthy, sufficiently complete external truth for that connector.

Phase 5.6 adds direct Drift mismatch classes where both sides now exist and are genuinely comparable:

- `drift_subaccount_identity_mismatch`
- `drift_position_mismatch`
- `drift_order_inventory_mismatch`
- `drift_truth_comparison_gap`
- `stale_internal_derivative_state`

Current honest boundary:

- account identity is directly comparable when both internal and external account sections exist
- positions are directly comparable at `asset + marketType` granularity
- open orders are directly comparable only when a venue order id exists internally and externally
- health remains externally visible but internally unsupported, so there is still no direct health mismatch class
