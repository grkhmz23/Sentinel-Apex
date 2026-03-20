# Phase 1.7 Recovery Workflow Gap Analysis

Date: 2026-03-20

## Current Mismatch Lifecycle

The current implemented mismatch lifecycle is:

- `open`
- `acknowledged`
- `resolved`

Observed behavior in the current repo:

- New mismatches are created as `open`.
- Operator acknowledgement is explicit through the API and persists:
  - `acknowledged_at`
  - `acknowledged_by`
- Automatic health checks and reconciliation logic can mark mismatches `resolved`.
- Re-detection after `resolved` reopens the same dedupe key back to `open`.
- Recovery history is durable in `runtime_recovery_events`, but mismatch state itself does not distinguish:
  - seen vs being worked
  - fix applied vs fix verified
  - resolved vs reopened

## Gaps In The Current Model

### Missing lifecycle states

The current model cannot explicitly represent:

- recovery work in progress
- resolution applied but awaiting verification
- verified closure
- reopened incidents as a distinct lifecycle state

### Missing durable metadata

The current mismatch row stores only:

- acknowledgement metadata
- resolution metadata

It does not store durable fields for:

- recovery started by / at
- linked recovery command or recovery event
- verification performed by / at
- verification outcome / note
- reopen actor / timestamp / reason
- last status change timestamp

### Recovery workflow is too implicit

Important incident workflow is currently inferable only from recovery events:

- whether someone started working the mismatch
- whether a fix was applied via a rebuild or one-shot command
- whether a fix was later verified
- whether the incident was reopened because verification failed

That is useful audit history, but it is not sufficient as the authoritative current workflow state.

### API surface is incomplete

Current API support covers:

- list mismatches
- acknowledge mismatch
- list recovery events

Missing operator-facing capabilities:

- mismatch detail
- explicit transition to recovering
- explicit resolution
- explicit verification
- explicit reopen
- lifecycle-aware summary counts for future UI work

## Target Lifecycle

Phase 1.7 should move the mismatch lifecycle to:

- `open`
- `acknowledged`
- `recovering`
- `resolved`
- `verified`
- `reopened`

Intent:

- `open`: system has detected an unresolved issue
- `acknowledged`: operator has seen the issue
- `recovering`: a remediation action is underway or has been linked
- `resolved`: the issue appears fixed, but closure is not yet verified
- `verified`: operator has explicitly verified the fix
- `reopened`: a previously resolved or verified mismatch has returned or verification failed

## Required Schema And State Changes

The mismatch record needs to become the source of truth for current lifecycle state.

Required additions:

- expanded `status` lifecycle values
- `recovery_started_at`
- `recovery_started_by`
- `recovery_summary`
- `linked_command_id`
- `linked_recovery_event_id`
- `verified_at`
- `verified_by`
- `verification_summary`
- `verification_outcome`
- `reopened_at`
- `reopened_by`
- `reopen_summary`
- `last_status_change_at`

Required behavioral changes:

- redetection after `resolved` or `verified` should transition to `reopened`
- invalid transitions must be rejected by runtime/control-plane logic
- lifecycle actions must emit linked recovery events

## Required API / Control Changes

Control-plane and API should support:

- get mismatch detail
- list mismatches with full lifecycle metadata
- summarize mismatches by lifecycle status
- mark mismatch `acknowledged`
- mark mismatch `recovering`
- mark mismatch `resolved`
- verify mismatch with explicit outcome
- reopen mismatch explicitly
- inspect recovery history scoped to a mismatch

The route handlers should remain thin. Transition rules should live in `packages/runtime`.

## Implementation Plan

1. Define the formal lifecycle, transitions, and action rules in `packages/runtime`.
2. Extend the DB schema and SQL migration for lifecycle metadata and timestamps.
3. Refactor mismatch persistence so redetection, automatic resolution, and operator transitions are lifecycle-aware.
4. Add control-plane methods for recovering, resolving, verifying, reopening, mismatch detail, and lifecycle summaries.
5. Extend API routes for mismatch detail and explicit lifecycle transitions.
6. Add deterministic runtime and API tests covering the full incident workflow, invalid transitions, and reopen paths.
7. Update architecture and current-state docs so the repo reflects the real workflow.
