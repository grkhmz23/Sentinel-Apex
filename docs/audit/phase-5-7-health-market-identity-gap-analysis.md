# Phase 5.7 Health And Market Identity Gap Analysis

Date: 2026-04-01
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Internal Health And Market Identity Model

Phase 5.6 already added a durable internal derivative snapshot model in:

- `packages/runtime/src/internal-derivative-state.ts`
- `packages/runtime/src/store.ts`
- `packages/db/src/schema/runtime.ts`

Current internal sections:

- `accountState`
  - canonical
  - sourced from runtime operator configuration
  - supports:
    - configured account address when present
    - configured authority address when present
    - configured subaccount id when present
- `orderState`
  - canonical
  - sourced from persisted runtime orders
  - supports:
    - asset
    - `marketType` inferred from `metadata.instrumentType`
    - venue order id when known
    - reduce-only, status, size, timestamps
- `positionState`
  - derived
  - reconstructed from persisted fills joined to runtime orders
  - supports:
    - `positionKey`
    - asset
    - `marketType`
    - side
    - net quantity
    - average entry price
    - fill counts and timing
- `healthState`
  - explicitly unsupported
  - current runtime implementation returns:
    - `healthStatus: "unknown"`
    - `methodology: "unsupported_internal_health_model"`
    - provenance notes explaining that there is no truthful internal Drift health model yet

Current internal market identity is still minimal:

- positions use `positionKey = "${marketType}:${asset}"`
- orders carry:
  - `asset`
  - `marketType`
  - raw `metadata`
- the internal model does not yet persist a typed market identity object with:
  - exact-vs-derived identity provenance
  - normalized market symbol
  - market index
  - normalized comparison key
  - explicit identity confidence

Current external Drift-native truth is richer:

- derivative positions expose:
  - `marketIndex`
  - `marketKey`
  - `marketSymbol`
  - `positionType`
  - quantity/value fields
- open orders expose:
  - `marketIndex`
  - `marketKey`
  - `marketSymbol`
  - `marketType`
  - `venueOrderId`
- derivative health exposes:
  - `healthStatus`
  - `healthScore`
  - `collateralUsd`
  - `freeCollateralUsd`
  - margin requirement fields
  - `marginRatio`
  - `leverage`

## 2. Current Comparison Limitations

Current repo-state comparison limits are:

- health:
  - internal health comparison is still intentionally unsupported
  - reconciliation and dashboard surfaces correctly show that unsupported boundary, but operators still cannot inspect a durable internal margin-like posture
- positions:
  - direct comparison is still keyed at `asset + marketType`
  - external rows may carry exact Drift market identity while the internal model still collapses identity to a coarser key
- orders:
  - comparison already depends on venue order ids where available
  - but internal order identity is not normalized into a typed market identity model
- provenance:
  - operators can see canonical vs derived at a section level
  - they cannot yet see exact-vs-derived-vs-partial identity semantics at the market row level

What is honestly possible now:

- canonical internal account identity comparison
- canonical internal order inventory comparison when venue order ids exist
- derived internal position comparison against external positions
- derived internal risk posture from existing runtime read models

What is still not honestly possible now:

- a canonical internal Drift margin engine
- venue-native internal collateral accounting
- exact internal market-index parity when runtime orders only carry `asset` plus `instrumentType`
- fake mismatch classes for fields that remain non-comparable

## 3. Feasible Canonical Vs Derived Health Approach

The runtime already persists enough internal inputs to support a truthful internal health posture, but not a venue-native Drift margin model.

Available internal inputs:

- `portfolio_current`
  - total NAV
  - gross exposure
  - net exposure
  - liquidity reserve
  - per-venue exposure
  - per-asset exposure
  - open position count
- `risk_current`
  - leverage
  - liquidity reserve percent
  - drawdown state
  - open circuit breakers
  - rolled-up `riskLevel`
- internal derivative current sections
  - open internal positions
  - open internal orders
  - configured tracked venue identity

Feasible Phase 5.7 model:

- internal health state becomes available as a derived internal risk posture
- provenance remains explicit:
  - `canonical`
  - `derived`
  - `unsupported`
- the model must describe itself as:
  - internal
  - derived
  - non-venue-native
  - margin-like rather than exact Drift margin truth

Recommended internal health surface:

- `healthStatus`
  - derived band only
- `riskPosture`
  - directly from internal risk summary
- `collateralLikeUsd`
  - derived from internal portfolio liquidity reserve
- `grossExposureUsd`
- `netExposureUsd`
- `venueExposureUsd`
- `exposureToNavRatio`
- `liquidityReservePct`
- `leverage`
- `openPositionCount`
- `openOrderCount`
- `openCircuitBreakers`
- `comparisonMode`
  - explicit that only a partial health comparison is currently valid

Important honesty boundary:

- internal health can be operator-useful and durable without claiming exact venue-native margin parity
- numerical fields like `marginRatio`, `initialMarginRequirementUsd`, and `maintenanceMarginRequirementUsd` should remain external-only unless the runtime actually owns equivalent internal math

## 4. Target Richer Market Identity Design

Phase 5.7 should add a typed market identity normalization layer for internal positions and orders plus comparison detail.

Recommended internal market identity model:

- raw identity fields:
  - `asset`
  - `marketType`
  - `marketIndex` when internal metadata truly has it
  - `marketKey` when internal metadata truly has it
  - `marketSymbol` when internal metadata truly has it
- derived identity fields:
  - derived symbol from `asset + marketType` when that is the strongest truthful inference
  - normalized comparison key
- identity provenance markers:
  - exact
  - derived
  - partial
  - unsupported

Recommended external market identity model:

- retain exact Drift-native fields:
  - `marketIndex`
  - `marketKey`
  - `marketSymbol`
  - `positionType` / `marketType`
- add normalized comparable identity alongside exact external identity

Recommended comparison semantics:

- exact comparison:
  - when both sides have the same exact market key or market index
- partial comparison:
  - when the internal side only has derived symbol or asset/type identity
- comparison gap:
  - when neither exact nor partial alignment is truthfully possible

Recommended comparison artifacts:

- internal market identity
- external market identity
- normalized comparable identity
- comparison mode:
  - exact
  - partial
  - unsupported
- explicit notes on why a row is:
  - directly comparable
  - only partially comparable
  - non-comparable

This is richer than the current `asset + marketType` comparison, but still honest about where the repo does not yet own exact market-index semantics internally.

## 5. Required Runtime, Reconciliation, API, Dashboard, And Doc Changes

Runtime and types:

- extend runtime view types for:
  - internal health posture
  - internal market identity
  - market identity comparison detail
  - health comparison coverage and field-level comparability
- extend `buildInternalDerivativeSnapshot(...)` to accept:
  - current portfolio summary
  - current risk summary
- build a derived health state instead of the current hard-coded unsupported placeholder
- normalize internal market identity from persisted order metadata and fill-linked positions

Persistence:

- reuse `internal_derivative_snapshots`
- reuse `internal_derivative_current`
- persist richer `healthState`, `positionState`, and `orderState` JSON payloads
- no new table is required unless a later pass needs standalone query indexing over identity fields

Reconciliation:

- extend derivative comparison detail generation to expose:
  - exact vs partial health comparison mode
  - exact vs partial market identity mode
  - field-level comparison notes
- keep direct mismatch classes only for genuinely valid exact comparisons
- use comparison-gap or partial-comparison findings when exact comparison is not supported

API:

- keep current venue routes thin
- extend existing payloads:
  - `GET /api/v1/venues/:venueId/internal-state`
  - `GET /api/v1/venues/:venueId/comparison-summary`
  - `GET /api/v1/venues/:venueId/comparison-detail`
  - `GET /api/v1/venues/:venueId`

Dashboard:

- extend the existing venue detail page
- add:
  - internal health posture summary
  - external health posture summary
  - explicit health comparison mode and notes
  - typed market identity columns for position comparison
  - partial/exact/unsupported indicators

Docs:

- add internal health model architecture doc
- add market identity normalization architecture doc
- update current-state audit, runbooks, README, and the current Phase 5.6 derivative docs
- add a new ADR for the 5.7 internal-derived-health plus identity-comparison decision

## 6. Implementation Plan In Priority Order

1. Extend runtime types with:
   - richer internal health posture
   - internal market identity
   - market identity comparison detail
   - additional derivative reconciliation finding types
2. Implement derived internal health posture in `packages/runtime/src/internal-derivative-state.ts` using:
   - `portfolio_current`
   - `risk_current`
   - internal open-position and open-order counts
3. Implement market identity normalization for internal positions and orders using:
   - exact persisted metadata when present
   - derived symbol normalization when exact venue-native identity is absent
4. Upgrade comparison generation so positions and orders expose:
   - exact
   - partial
   - unsupported identity semantics
5. Extend reconciliation to emit:
   - exact mismatch findings only when justified
   - gap or partial-comparison findings when exact parity is unavailable
6. Extend API payload assertions and dashboard rendering for the richer health and identity views.
7. Update docs, fixtures, and deterministic tests.
8. Run targeted validations, then `pnpm validate:ci`, and report the real result.
