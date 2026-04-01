# ADR 0018: Phase 5.2 Venue Truth Capability Model

## Status

Accepted

## Context

Phase 5.2 adds the first honest real connector path to Sentinel Apex, but that path is explicitly read-only. Before this pass, venue posture was mostly sleeve-specific and simulation-oriented. Operators could inspect treasury and carry venue readiness independently, but there was no canonical cross-sleeve contract for:

- simulated vs real truth
- read-only vs execution-capable posture
- live-approval state
- onboarding readiness
- freshness and health of the latest external snapshot

That made it too easy for operator surfaces to overstate connector maturity or to hide the difference between in-repo simulation and externally sourced truth.

## Decision

Sentinel Apex adopts a canonical venue-truth capability model centered on:

- `VenueCapabilitySnapshot`
- `VenueTruthSnapshot`
- `VenueTruthAdapter`

This model is the operator-facing source of truth for connector maturity and current venue snapshot health.

The model explicitly separates:

- connector capability and onboarding posture
- latest externally or internally observed venue truth
- execution support and live-approval posture

Phase 5.2 persists append-only snapshots in `venue_connector_snapshots` and derives the latest inventory/readiness view from the most recent snapshot per venue.

The canonical model must always expose:

- venue identity and connector type
- sleeve applicability
- truth mode (`simulated` vs `real`)
- read-only support
- execution support
- approved-for-live-use state
- onboarding readiness state
- missing prerequisites and auth/config summary
- latest snapshot capture time
- snapshot freshness
- health state and degraded reason where applicable

## Consequences

### Positive

- Operators can distinguish simulated connectors from real read-only connectors without inference.
- Runtime, API, and dashboard surfaces share one truthful connector readiness contract.
- New real connectors can be added under the same contract without claiming unsupported execution capability.
- Reconciliation can raise explicit findings when real venue truth is missing, stale, or unavailable.

### Tradeoffs

- The model adds a generic connector inventory layer in addition to sleeve-specific treasury/carry views.
- Some venue-native details remain outside the Phase 5.2 scope until additional real adapters exist.
- Append-only snapshots increase stored history, but they preserve auditability and operator drill-through.

## Alternatives Considered

### Reuse sleeve-specific readiness models only

Rejected because treasury-only or carry-only readiness views do not give operators a canonical cross-sleeve truth model.

### Add real connector support without a canonical maturity contract

Rejected because that would encourage ambiguous UI/API language and risk overstating production readiness.

### Persist only the latest venue state

Rejected because Phase 5.2 is audit-oriented and requires historical snapshot visibility.

## Notes

Phase 5.2 deliberately does not authorize live execution for the real connector path. `drift-solana-readonly` remains read-only and not approved for live use.
