# ADR 0016: Phase 4.0 Sentinel Allocator Foundation

Date: 2026-03-30

## Status

Accepted

## Context

The repo already contains:

- Carry as a strategy sleeve
- Treasury as a capital sleeve
- Runtime, worker, control-plane, auth, and operator surfaces

What was missing was a portfolio-level allocator that could reason about both sleeves using a deterministic and inspectable policy model.

## Decision

- Add a dedicated `packages/allocator` package.
- Keep the first pass small and explicit:
  - only two sleeves
  - deterministic rule-based budgeting
  - explicit regime/pressure state
  - persisted targets and recommendations
- Normalize sleeve inputs into a common allocator snapshot rather than forcing internal carry and treasury models to converge.
- Persist allocator outputs in dedicated allocator tables rather than embedding allocator state inside treasury or runtime status blobs.

## Consequences

### Positive

- Clear package boundary for future allocator work.
- Auditable allocator state and rationale.
- Clean runtime/API/dashboard integration path.

### Negative

- First-pass regime logic is intentionally simple and operationally biased.
- Sleeve composition is currently fixed to Carry and Treasury.

## Follow-up

- Add richer sleeve scoring once more stable carry quality and treasury venue quality signals exist.
- Consider budget-to-execution wiring only after operator review flows are mature.
