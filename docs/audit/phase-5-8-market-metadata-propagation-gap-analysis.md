# Phase 5.8 Market Metadata Propagation Gap Analysis

Date: 2026-04-01
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Metadata Propagation Path

Before Phase 5.8, market identity entered the system in a few places, but it was not propagated consistently:

- `packages/venue-adapters`
  - external Drift-native truth already exposed richer market identity such as market index, market key, and market symbol
  - simulated adapter market data and fills were still mostly asset-level or derived
- `packages/carry`
  - opportunity legs mainly preserved asset, venue, side, and instrument type
  - richer venue-native market identity was not a first-class leg field
- `packages/strategy-engine`
  - intents persisted `instrumentType` plus generic metadata
  - market identity was not normalized into a shared internal model
- `packages/execution`
  - runtime orders persisted metadata, but there was no shared canonical market identity helper for promotion from adapter result back into the order record
- `packages/runtime`
  - carry planned orders, carry execution steps, runtime orders, and fills all had JSON metadata fields available
  - those records did not consistently carry a typed market identity object from the earliest known point
- `packages/runtime/src/internal-derivative-state.ts`
  - internal snapshots could compare exact identity only when legacy metadata happened to include enough Drift-specific fields
  - otherwise the model fell back to symbol or `asset + marketType`

## 2. Current Fidelity Gaps

The main fidelity gaps before this pass were:

- market identity was available externally earlier than it was preserved internally
- strategy intents could know more than the later runtime order or fill record still carried
- carry action detail and carry execution detail did not surface a stable identity/provenance object
- fill history did not preserve the best available canonical market identity for downstream reconstruction
- simulated replay restored fills without preserving richer identity that had already been persisted
- exact comparison promotion depended too heavily on late or legacy metadata instead of an explicit shared propagation model

The practical result was that some comparison rows remained:

- `partial` because only derived symbol identity survived
- `unsupported` because internal rows could no longer be truthfully aligned to the richer external market identity

## 3. Target Exact-Identity Propagation Design

Phase 5.8 promotes a single canonical market identity model across the internal pipeline.

Design goals:

- capture venue-native market identity at the earliest truthful stage
- keep provenance explicit:
  - `venue_native`
  - `derived`
  - `unsupported`
- keep confidence explicit:
  - `exact`
  - `partial`
  - `unsupported`
- preserve capture stage across the pipeline:
  - `market_data`
  - `opportunity_leg`
  - `strategy_intent`
  - `runtime_order`
  - `carry_planned_order`
  - `carry_execution_step`
  - `execution_result`
  - `fill`
  - `internal_snapshot`
  - `external_truth`
- prefer richer identity only when it is truly better than the prior identity
- reuse existing metadata-backed persistence where it already exists cleanly

## 4. Required Runtime, Schema, API, Dashboard, And Doc Changes

Runtime and execution changes:

- add a shared canonical market identity helper in `packages/venue-adapters`
- propagate identity through:
  - market data
  - carry opportunity legs
  - strategy intents
  - runtime orders
  - carry planned orders
  - carry execution steps
  - execution events
  - fills
  - internal derivative snapshots
- prefer exact venue-native identity over weaker derived identity when the adapter returns it
- preserve persisted fill identity during simulated replay

Schema and persistence changes:

- no new table is required for Phase 5.8
- no migration is required for Phase 5.8
- existing JSON metadata fields on:
  - `strategy_intents`
  - `orders`
  - `fills`
  - `carry_action_order_intents`
  - `carry_execution_steps`
  are sufficient for the richer identity/provenance payload

API and dashboard changes:

- extend carry action detail to show planned-order market identity and provenance
- extend carry execution detail to show step-level market identity and provenance
- extend venue comparison views to show why a row is exact, partial, or unsupported

Documentation changes:

- add a Phase 5.8 architecture note for the propagation model
- record the canonical-vs-derived provenance decision in an ADR
- update README, current-state audit, and real-connector runbooks to reflect the earlier-capture model

## 5. Implementation Plan In Priority Order

1. Introduce a shared canonical market identity type and normalization helpers.
2. Propagate market identity from venue market data and carry opportunity legs into strategy intents.
3. Persist the best available identity on runtime orders, carry planned orders, carry execution steps, execution events, and fills.
4. Update internal derivative snapshot construction to prefer earlier exact identity and promote comparisons from partial to exact only when justified.
5. Expose provenance on API and dashboard detail surfaces.
6. Add deterministic tests for propagation, promotion, and operator-visible detail.
