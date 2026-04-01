# ADR 0022: Phase 5.6 Internal Derivative Comparison Model

Date: 2026-04-01
Status: Accepted

## Context

Phase 5.5 added richer external Drift-native read-only truth, including:

- account / subaccount identity
- position inventory
- health / margin-like state
- open-order inventory

The runtime still lacked a matching internal derivative model. That meant the repo could expose external truth, but not truth-backed internal-vs-external derivative reconciliation.

The core decision in Phase 5.6 is how to model internal derivative state without overclaiming certainty.

## Decision

Sentinel Apex will persist a dedicated internal derivative snapshot model with explicit section-level provenance.

Chosen model:

- account state is canonical internal data from runtime configuration
- order inventory is canonical internal data from persisted runtime orders
- position inventory is durable derived internal data reconstructed from persisted fills joined to runtime orders
- health state remains explicitly unsupported internally

The runtime will compare this internal model against the latest external venue snapshot only where both sides are genuinely comparable.

Comparison rules:

- account identity comparison is allowed when both internal and external account sections exist
- order inventory comparison is allowed only for internal open orders with a venue order id
- position comparison is allowed at `asset + marketType` granularity
- health comparison is not allowed yet

Durable storage:

- `internal_derivative_snapshots`
- `internal_derivative_current`

## Why This Model

This model matches the real repo state:

- the runtime truly owns order and fill facts
- the runtime can reconstruct position posture from those facts
- the runtime does not yet own a truthful internal Drift health engine

This preserves the most important boundary:

- external Drift-native truth remains external truth
- internal canonical and derived state remain internal runtime truth

## Alternatives Considered

### 1. Treat external Drift snapshots as the internal state source

Rejected.

That would collapse internal and external truth into the same source and make reconciliation meaningless.

### 2. Reuse allocator or risk summaries as internal health state

Rejected.

Allocator budgets and general risk summaries are not venue-native Drift health semantics.

### 3. Delay all derivative mismatch classes until full Drift market-index parity exists

Rejected.

The repo already has enough truthful coverage for:

- account identity comparison
- open-order comparison by venue order id
- inventory comparison by asset and market type

Waiting for perfect parity would hide useful comparison coverage that the runtime can honestly support today.

## Consequences

Positive:

- operators can now inspect internal derivative posture separately from external truth
- reconciliation gains real derivative mismatch classes where valid
- comparison gaps remain explicit instead of silently disappearing
- the model is extendable when internal health or deeper market-index semantics are added later

Negative:

- position comparison remains coarser than full Drift market-index semantics
- internal health remains unsupported
- some internal open orders remain only partially comparable until venue order ids exist

## Follow-up

The next logical step is to add a truthful internal health / margin model and deeper market-aware internal position semantics so reconciliation can expand beyond asset-level inventory parity.
