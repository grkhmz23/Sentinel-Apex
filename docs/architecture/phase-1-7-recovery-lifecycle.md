# Phase 1.7 Recovery Lifecycle

Date: 2026-03-20

## Goal

Phase 1.7 completes the operator incident workflow for runtime mismatches so a mismatch can move from detection through recovery, resolution, verification, and reopen in a durable and auditable way.

## Lifecycle States

- `open`
  - the system detected a mismatch that requires attention
- `acknowledged`
  - an operator has explicitly seen the mismatch
- `recovering`
  - remediation work is in progress or a recovery artifact has been linked
- `resolved`
  - the issue appears fixed, but closure is not yet verified
- `verified`
  - an operator has explicitly verified the fix
- `reopened`
  - a previously resolved or verified mismatch has returned or a verification failed

## Transition Rules

### Automatic transitions

- detection of a new mismatch creates `open`
- repeated detection of an already active mismatch keeps the current active status
- repeated detection of a `resolved` or `verified` mismatch reopens it as `reopened`
- runtime health reconciliation can move an active mismatch to `resolved` when the system observes that the underlying condition has cleared

### Operator-driven transitions

- `open` or `reopened` -> `acknowledged`
- `open`, `acknowledged`, or `reopened` -> `recovering`
- `open`, `acknowledged`, `recovering`, or `reopened` -> `resolved`
- `resolved` -> `verified`
- `resolved` -> `reopened` when verification fails
- `resolved` or `verified` -> `reopened` for explicit manual reopen

### Invalid transitions

Invalid transitions are rejected in `packages/runtime` rather than silently accepted in the API layer.

Examples:

- verify from `open`
- verify from `acknowledged`
- verify from `recovering`
- verify from `reopened`
- manual reopen from `open`
- manual reopen from `acknowledged`
- manual reopen from `recovering`

## Durable Metadata

Each mismatch now stores lifecycle metadata directly on the mismatch record:

- acknowledgement:
  - `acknowledged_at`
  - `acknowledged_by`
- recovery:
  - `recovery_started_at`
  - `recovery_started_by`
  - `recovery_summary`
  - `linked_command_id`
  - `linked_recovery_event_id`
- resolution:
  - `resolved_at`
  - `resolved_by`
  - `resolution_summary`
- verification:
  - `verified_at`
  - `verified_by`
  - `verification_summary`
  - `verification_outcome`
- reopen:
  - `reopened_at`
  - `reopened_by`
  - `reopen_summary`
- lifecycle tracking:
  - `last_status_change_at`

Recovery history remains append-only in `runtime_recovery_events`.

## API Surface

Phase 1.7 extends the operator API with:

- `GET /api/v1/runtime/mismatches`
- `GET /api/v1/runtime/mismatches/summary`
- `GET /api/v1/runtime/mismatches/:mismatchId`
- `POST /api/v1/runtime/mismatches/:mismatchId/acknowledge`
- `POST /api/v1/runtime/mismatches/:mismatchId/recover`
- `POST /api/v1/runtime/mismatches/:mismatchId/resolve`
- `POST /api/v1/runtime/mismatches/:mismatchId/verify`
- `POST /api/v1/runtime/mismatches/:mismatchId/reopen`
- `GET /api/v1/runtime/recovery-events`
- `GET /api/v1/runtime/recovery-outcomes`

## Why This Shape

- It keeps mismatch state explicit instead of inferred from raw events.
- It preserves the worker/API split introduced in Phase 1.6.
- It supports future operator UI work without requiring the UI to reconstruct lifecycle semantics from event logs.
- It keeps live execution concerns out of scope and preserves dry-run as the default mode.
