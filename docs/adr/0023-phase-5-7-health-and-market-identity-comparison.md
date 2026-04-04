# ADR 0023: Phase 5.7 Health And Market Identity Comparison

Date: 2026-04-01
Status: Accepted

## Context

Phase 5.6 added a durable internal derivative snapshot model and truthful internal-vs-external comparison surfaces, but two important gaps remained:

- internal health and margin-like posture was still explicitly unsupported
- position comparison still depended mostly on `asset + marketType`

The repo already had enough internal projection state to improve both areas, but not enough to pretend exact Drift margin parity exists.

## Decision

Sentinel Apex will:

- add a derived internal health posture based on internal portfolio and risk projections
- keep that model explicitly non-venue-native
- allow only band-level health comparison against external Drift health
- add typed market identity normalization for internal positions and orders
- prefer exact identity keys when the internal side truly has them
- fall back to derived identity only when that fallback is explicit and operator-visible

## Why

This matches the real repo state:

- the runtime owns durable portfolio and risk projections
- the runtime owns durable orders and fills
- the runtime does not yet own exact Drift collateral or margin-requirement math for internal state

The decision improves operator clarity without collapsing internal and external truth into the same source.

## Rejected Alternatives

### 1. Keep internal health fully unsupported until exact Drift parity exists

Rejected.

The repo already has enough internal state to provide a truthful derived posture that is useful for operators and auditable in reconciliation.

### 2. Treat internal risk posture as exact venue margin state

Rejected.

That would overclaim certainty and blur the boundary between internal projections and venue-native truth.

### 3. Tighten every comparison to market index immediately

Rejected.

The runtime only owns exact market identity where persisted order metadata actually carries it. Derived symbol or asset/type fallback must remain explicit.

## Consequences

Positive:

- operators can inspect internal health posture as a first-class persisted view
- health comparison becomes partially available instead of fully unsupported
- market identity comparison becomes richer and more auditable
- reconciliation can distinguish exact mismatch from partial comparison and identity gap

Negative:

- health comparison remains intentionally partial
- some market comparisons still rely on derived internal keys
- exact margin mismatch automation still remains future work

## Follow-up

The next logical step is to decide whether Sentinel Apex should own a venue-aligned internal margin model for a narrower exact health comparison surface, or keep health comparison permanently banded and add separate operator guidance on the remaining non-comparable fields.
