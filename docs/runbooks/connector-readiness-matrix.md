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
| `drift-solana-readonly` | real | carry | yes | no | no | JSON-RPC version, account identity, SOL and SPL balances, balance-derived exposure, recent account signatures |

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
  - account state: available when `DRIFT_READONLY_ACCOUNT_ADDRESS` is configured
  - balance state: available for SOL plus token-program accounts visible through generic RPC
  - capacity state: unsupported
  - exposure state: available as balance-derived spot exposure only
  - execution references: available as recent account signatures only
  - derivative account state: partial when the tracked account is program-owned, because generic RPC can expose owner, data length, and raw discriminator metadata but not decoded venue-native fields
  - derivative position state: unsupported
  - derivative health state: unsupported
  - order/reference state: partial as reference-only recent-signature context rather than canonical open-order inventory

## Operator Interpretation

- `truthMode=simulated` means the snapshot is generated entirely in-repo.
- `truthMode=real` means the snapshot came from an external system.
- `executionSupport=false` means the connector must not be treated as live-execution capable.
- `approvedForLiveUse=false` means operators must not infer production trading readiness.
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

Phase 5.4 does not add derivative position or derivative health mismatch classes because the current real connector still cannot supply those external truth domains honestly.
