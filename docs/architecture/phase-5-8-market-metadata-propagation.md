# Phase 5.8 Market Metadata Propagation

## Purpose

Phase 5.7 added a richer normalized market identity model for internal-vs-external derivative comparison.

Phase 5.8 extends that model earlier in the pipeline so exact identity is captured and preserved on the internal side before reconciliation has to infer it later.

## Canonical Identity Model

The shared model lives in `packages/venue-adapters/src/interfaces/market-identity.ts`.

Each canonical market identity carries:

- raw identity fields:
  - `venueId`
  - `asset`
  - `marketType`
  - `marketIndex`
  - `marketKey`
  - `marketSymbol`
  - `marketName`
  - `aliases`
- normalized comparison fields:
  - `normalizedKey`
  - `normalizedKeyType`
- provenance:
  - `venue_native`
  - `derived`
  - `unsupported`
- confidence:
  - `exact`
  - `partial`
  - `unsupported`
- capture metadata:
  - `capturedAtStage`
  - `source`
  - `notes`

## Capture Stages

Phase 5.8 uses explicit capture stages instead of a generic "metadata present" flag.

Current stages:

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

These stages tell operators where the strongest current identity was first known.

## Propagation Path

The internal propagation path is now:

1. venue market data can attach market identity
2. carry opportunity legs preserve the identity when it exists
3. strategy intents persist the best available identity into intent metadata
4. runtime order submission reads that identity and passes it to the adapter
5. adapter execution results can promote the order identity if they return something richer
6. carry planned orders and carry execution steps persist the same identity with stage-specific capture metadata
7. fills inherit identity from the runtime order
8. internal derivative snapshots prefer fill identity, then order identity, then honest fallback derivation

## Promotion Rules

Phase 5.8 adds an explicit "prefer richer identity" rule.

The runtime promotes identity when:

- the new identity has higher confidence than the prior one
- the new identity has a stronger normalized key type
- the new identity preserves the same truthful semantics but with better venue-native detail

The runtime does not promote identity when:

- the newer identity is weaker than the existing one
- the new identity is only guessed from symbol or asset when the current record already has exact venue-native identity
- provenance would overstate certainty

## Persistence Surfaces

Phase 5.8 reuses existing metadata-backed records instead of adding new tables.

The canonical market identity now persists on:

- strategy intents
- runtime orders
- carry planned orders
- carry execution steps
- execution event payloads
- fills
- internal derivative position and order snapshots

This keeps the design extendable without adding new schema solely for metadata fan-out.

## Comparison Promotion

Internal-vs-external comparison can now move from partial to exact when:

- the internal record carries exact market index or equivalent exact normalized identity
- the external Drift-native row carries the same exact identity
- the comparison is based on the stronger propagated metadata, not a later guess

When that is not true, the model still stays honest:

- `partial` when only derived symbol or asset-plus-type identity is shared
- `unsupported` when the two sides cannot be aligned truthfully

## Operator Surfaces

Operators can now inspect richer market identity provenance on:

- carry action planned orders
- carry execution steps
- venue internal derivative positions
- venue internal derivative open orders
- venue comparison detail

The UI and API should answer:

- whether identity was captured early or inferred later
- whether a comparison is exact because of venue-native metadata or only partial because it was derived
- which execution records are carrying the strongest known internal identity

## Honest Boundary

Phase 5.8 does not claim:

- exact identity for every row in the system
- retroactive venue-native metadata for records that never captured it
- live execution support
- exact comparison when the internal side still only has derived identity

The model improves comparison quality by preserving real metadata earlier, not by weakening the truth boundary.
