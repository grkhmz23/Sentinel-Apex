# Rebalance Bundle Recovery Rules

Date: 2026-03-31

## Intent

Bundle recovery actions must be explicit, operator-triggered, and safe.

This phase does not allow hidden retries or speculative healing.

## Global Rules

- Recovery actions are only available for bundles in operator-intervention states.
- Recovery requests are blocked while runtime is paused, stopped, starting, or halted.
- Read-only roles may inspect candidates and history but may not request recovery.
- Approval requirements are enforced using the target child action's approval requirement.
- A blocked request is still persisted as a blocked recovery action so the attempt is auditable.

## Carry Child Rules

A carry child may be requeued only when:

- it is proposal-linked
- it is not already completed
- it is not already queued or executing
- it remains executable and has no active blocked reasons
- no execution step shows venue-side progress

Carry retry is blocked when:

- a completed execution already exists
- a venue order id or execution reference was recorded
- any execution step shows non-failed progress
- the child remains operationally blocked

## Treasury Child Rules

A treasury child may be requeued only when:

- it is proposal-linked
- it is not already completed
- it is not already queued or executing
- it remains executable and not blocked
- no venue execution reference was recorded

Treasury retry is blocked when:

- a completed execution already exists
- any execution recorded a venue execution reference
- the child remains blocked by current treasury readiness rules

Budget-state-only treasury children may still be requeued when they failed without a completed execution, because they do not represent venue-native side effects.

## Proposal Replay Rule

Generic proposal replay is blocked in this phase.

Reason:

- proposal execution can create downstream child work
- replay can duplicate carry or treasury child outcomes
- the current repo does not yet have a safe deduping / superseding orchestration layer for proposal replay

Operators must recover eligible carry or treasury children directly instead.
