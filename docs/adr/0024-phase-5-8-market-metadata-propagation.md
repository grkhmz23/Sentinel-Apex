# ADR 0024: Phase 5.8 Market Metadata Propagation

Date: 2026-04-01
Status: Accepted

## Context

Phase 5.7 introduced a richer internal market identity model and truthful exact-vs-partial comparison semantics.

The remaining gap was not mainly normalization. It was propagation.

The repo could already know richer market identity at opportunity or execution time, but that information was not consistently preserved onto:

- strategy intents
- runtime orders
- carry planned orders
- carry execution steps
- fills

That left some later comparisons unnecessarily partial.

## Decision

Sentinel Apex will:

- use a shared canonical market identity model across internal pipeline stages
- preserve provenance and capture stage on each identity payload
- persist the best available identity on existing metadata-backed records instead of adding dedicated Phase 5.8 tables
- promote comparisons from partial to exact only when earlier persisted internal metadata truly supports exact alignment
- keep derived fallback explicit when venue-native identity is unavailable

## Why

This decision matches the real repo state:

- the system already has durable metadata fields on the records that matter most
- the system already has richer identity available in some upstream adapter and strategy contexts
- operators need to know why a comparison is exact, partial, or unsupported
- adding exactness later from inference is weaker than preserving the exact identity when it first exists

## Rejected Alternatives

### 1. Add a new Phase 5.8 table for market identity history

Rejected.

Current JSON-backed metadata fields are sufficient and avoid schema bloat.

### 2. Keep deriving identity at snapshot time only

Rejected.

That preserves the Phase 5.7 comparison model but leaves avoidable information loss in the execution path.

### 3. Treat promoted identity as exact even when it still came from derived symbol fallback

Rejected.

Phase 5.8 is about fidelity, not convenience. Derived identity remains partial.

## Consequences

Positive:

- more internal rows can now compare exactly with external Drift-native truth
- carry and execution drill-through show explicit identity provenance
- fills and replay paths preserve richer identity instead of collapsing to asset-level fallback
- the runtime comparison layer becomes easier to audit

Negative:

- metadata handling becomes more explicit across more pipeline stages
- some rows still remain partial because the runtime never truly had venue-native identity
- exact comparison is still bounded to the persisted internal metadata quality

## Follow-up

The next logical step is to extend the same provenance discipline to more allocator and rebalance-linked downstream records so operator drill-through can track market identity consistently across the full proposal-to-execution graph.
