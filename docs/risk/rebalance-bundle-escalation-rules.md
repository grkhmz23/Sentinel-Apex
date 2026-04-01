# Rebalance Bundle Escalation Rules

Date: 2026-03-31

## Intent

Escalation workflow must be explicit, attributable, and separate from bundle execution truth.

This phase does not allow escalation to silently resolve bundle failures or partial application.

Phase 5.0 extends these rules with queue and triage semantics.

## Global Rules

- Escalation workflow actions are only available when the bundle resolution state is `escalated`.
- Escalation transitions are operator-authored mutations and must be auditable.
- Read-only roles may inspect escalation state and history but may not mutate it.
- Escalation closure requires an explicit resolution note.

## Ownership Rules

- Assignment must name an explicit owner.
- Reassignment must be explicit and durable.
- Acknowledgement, review, and close require an assigned owner.
- Non-admin acknowledgement, review, and close are restricted to the current owner.

## Transition Rules

- `acknowledge` is only valid from `open`.
- `start_review` is only valid from `open` or `acknowledged`.
- `close` is only valid while the escalation is still open.
- Resolved escalations may not be transitioned further.

## Queue Rules

- Queue rows are derived from persisted escalation, bundle, proposal, and escalation-event truth.
- Queue state is a triage overlay only; it does not replace escalation status.
- `overdue` and `due_soon` are derived from `due_at`, not from manual operator labels.
- `mine` is derived from current open escalations owned by the authenticated operator.
- Queue-level quick actions must reuse the existing bundle escalation workflow rules.
- Queue-level quick actions may not bypass owner, role, or note requirements enforced by the backend.
- Queue-level close is intentionally excluded in this phase.

## Truth-Preservation Rules

- Escalation resolution does not erase bundle failure history.
- Escalation resolution does not erase bundle recovery history.
- Escalation resolution does not erase manual-resolution history.
- Bundle execution status, bundle resolution state, and escalation workflow state remain distinct.
- Queue state remains distinct from escalation workflow state and must never be mistaken for execution truth.
