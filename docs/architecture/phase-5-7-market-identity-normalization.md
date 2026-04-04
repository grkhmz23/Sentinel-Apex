# Phase 5.7 Market Identity Normalization

## Purpose

Phase 5.6 compared internal and external derivative inventory mainly at `asset + marketType` granularity.

Phase 5.7 keeps that fallback, but adds a richer market identity normalization layer so the runtime can distinguish:

- exact market identity
- derived market identity
- partial market identity
- unsupported market identity

## Internal Identity Sources

Internal market identity can now come from:

- exact persisted order metadata when present:
  - `marketIndex`
  - `marketKey`
  - `marketSymbol`
- derived identity from:
  - asset
  - market type inferred from `instrumentType`

The runtime persists normalized identity on:

- internal positions
- internal open orders

## External Identity Sources

External Drift-native identity already exposes:

- `marketIndex`
- `marketKey`
- `marketSymbol`
- `marketType`

These remain external exact truth.

## Normalization Model

The runtime now normalizes market identity through a priority order:

1. `market_index`
2. `market_key`
3. `market_symbol`
4. `asset_market_type`

Every internal/external identity row carries:

- raw identity fields
- normalized key
- normalized key type
- confidence or provenance notes

Phase 5.8 keeps this normalization order, but also propagates the same canonical identity object earlier through:

- market data
- opportunity legs
- strategy intents
- runtime orders
- carry planned orders
- carry execution steps
- fills

That means exact normalization can now survive longer instead of being reconstructed only at snapshot time.

## Comparison Modes

Phase 5.7 market comparison modes are:

- `exact`
  - both sides share an exact normalized identity such as market index or exact market key
- `partial`
  - the runtime can align identity truthfully, but the internal side relies on a derived key such as a symbol derived from asset plus market type
- `unsupported`
  - the runtime cannot truthfully align the internal and external rows

## Position Comparison

Position comparison now:

- prefers exact market identity when the internal side truly has it
- falls back to derived symbol identity when that is the strongest truthful match
- falls back to `asset + marketType` only when exact or symbol-level parity is unavailable
- emits identity-gap semantics instead of pretending an unmatched row is a real quantity mismatch

## Order Comparison

Open-order comparison still matches rows by venue order id where present.

Phase 5.7 adds:

- normalized market identity on the internal order row
- normalized market identity on the external order row
- exact-vs-partial identity comparison detail in the order comparison payload

This preserves the existing safe row-matching rule while improving audit detail.

## Reconciliation Semantics

Phase 5.7 introduces richer findings around identity depth:

- exact market identity mismatch only when exact comparison is genuinely valid
- position identity gap when the runtime cannot truthfully align internal and external rows
- partial market identity comparison when alignment still depends on derived internal keys

## Honest Boundary

Phase 5.7 still does not guarantee:

- exact internal market-index parity for every order or position
- exact identity on rows whose internal metadata only supports asset plus instrument type
- full venue-native instrument semantics outside the fields the repo already persists or derives honestly

Phase 5.8 narrows these limits by persisting richer identity earlier, but it does not remove the honesty boundary. Exact comparison still depends on real captured metadata, not inferred parity.
