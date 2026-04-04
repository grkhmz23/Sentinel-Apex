# Phase 5.7 Internal Health Model

## Purpose

Phase 5.7 extends the Phase 5.6 internal derivative model with a truthful internal health and margin-like posture.

The runtime still does not claim to own a canonical Drift margin engine. The goal is narrower:

- give operators a durable internal health posture
- keep canonical vs derived vs unsupported explicit
- allow partial internal-vs-external health comparison where it is actually valid

## Design Principles

- internal health is not external health copied back into the runtime
- internal health must say whether it is canonical, derived, or unsupported
- exact Drift collateral and margin fields remain external-only unless the runtime owns equivalent math
- comparison can expand without pretending exact venue parity exists today

## Input Sources

Phase 5.7 derives internal health posture from existing internal runtime projections:

- `portfolio_current`
  - total NAV
  - gross exposure
  - net exposure
  - liquidity reserve
  - per-venue exposure
- `risk_current`
  - leverage
  - liquidity reserve percent
  - rolled-up `riskLevel`
  - open circuit breakers
- internal derivative current state
  - open internal positions
  - open internal orders

These are internal runtime views. They are not treated as venue-native Drift health truth.

## Internal Health Fields

Phase 5.7 internal health state supports:

- `healthStatus`
  - derived band only
- `modelType`
  - `internal_risk_posture`
  - `unsupported`
- `comparisonMode`
  - `status_band_only`
  - `unsupported`
- `riskPosture`
- `collateralLikeUsd`
- `liquidityReserveUsd`
- `grossExposureUsd`
- `netExposureUsd`
- `venueExposureUsd`
- `exposureToNavRatio`
- `liquidityReservePct`
- `leverage`
- `openPositionCount`
- `openOrderCount`
- `openCircuitBreakers`
- `unsupportedReasons`
- `methodology`
- provenance and notes

## Provenance Semantics

Health state now follows the same honesty rules as the rest of the internal derivative model:

- `canonical`
  - reserved for sections the runtime owns directly as canonical internal truth
- `derived`
  - used for the Phase 5.7 internal health posture
- `unsupported`
  - used when required internal portfolio or risk projections are absent

## Current Comparison Boundary

Phase 5.7 allows:

- band-level internal-vs-external health-status comparison

Phase 5.7 still does not allow direct comparison for:

- `collateralUsd`
- `freeCollateralUsd`
- `initialMarginRequirementUsd`
- `maintenanceMarginRequirementUsd`
- `marginRatio`
- exact venue leverage

Reason:

- the runtime does not yet maintain equivalent internal venue-native margin math

## Operator Meaning

Operators can now answer:

- what Sentinel Apex believes the current internal risk posture is
- whether that posture is derived or unsupported
- what external Drift-native health says at the same time
- which health fields are directly comparable
- which fields remain intentionally non-comparable

## Honest Boundary

Phase 5.7 improves operator clarity and partial reconciliation coverage.

It still does not provide:

- canonical internal Drift margin state
- exact internal collateral accounting
- exact internal margin-requirement accounting
- exact internal-to-external health mismatch automation beyond the supported band-level comparison boundary
