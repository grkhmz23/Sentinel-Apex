# Phase 1.8 Remediation Gap Analysis

Date: 2026-03-20
Repo: `/workspaces/Sentinel-Apex`

## Current Action Model

- Runtime operator actions already exist as durable `runtime_commands`.
- Supported command types before this pass were `run_cycle` and `rebuild_projections`.
- Mismatches already had a formal lifecycle plus lifecycle metadata on `runtime_mismatches`.
- Recovery history already existed in `runtime_recovery_events`.
- Operators could manually move a mismatch into `recovering` by linking a command ID, but that linkage was one-to-one and last-write-wins.

## Current Gaps

- There was no durable remediation-attempt record scoped to a mismatch.
- A mismatch could point at one linked command, but not a history of remediation attempts.
- Worker command start/completion/failure events were not reflected back into a mismatch-scoped remediation model.
- Operators could not ask “what remediations have been tried for this mismatch?” without reconstructing history manually from commands and recovery events.
- Duplicate in-flight remediations were not prevented.
- Recovery outcomes were durable, but remediation intent and execution state were implicit rather than explicit.

## Target Mismatch-Scoped Remediation Model

- An operator initiates a remediation action against one mismatch.
- The control plane creates:
  - a durable runtime command
  - a durable remediation attempt linked to the mismatch and command
- The worker updates the remediation attempt as the command moves through `requested -> running -> completed|failed`.
- Recovery events remain the append-only event log, but remediation attempts become the stable query model for operator workflow.
- Mismatch detail exposes remediation history, latest remediation outcome, in-flight state, and whether another remediation is currently actionable.

## Required Schema And State Changes

- Add `runtime_mismatch_remediations` with:
  - `mismatch_id`
  - `attempt_sequence`
  - `remediation_type`
  - `command_id`
  - `status`
  - `requested_by`
  - `requested_summary`
  - `outcome_summary`
  - `latest_recovery_event_id`
  - `requested_at`, `started_at`, `completed_at`, `failed_at`, `updated_at`
- Keep `runtime_commands` as the executable command queue.
- Keep `runtime_recovery_events` as the append-only event stream.
- Keep `runtime_mismatches` as the incident record, but update its linked command/event fields from remediation progress.

## Required Control-Plane And API Changes

- Add a mismatch remediation action in `packages/runtime` that:
  - validates lifecycle eligibility
  - rejects duplicate in-flight remediation
  - enqueues the command
  - creates the remediation attempt
  - moves the mismatch to `recovering`
- Add worker-side remediation status propagation on command start/completion/failure.
- Add API routes for:
  - `POST /api/v1/runtime/mismatches/:mismatchId/remediate`
  - `GET /api/v1/runtime/mismatches/:mismatchId/remediation-history`
  - `GET /api/v1/runtime/mismatches/:mismatchId/remediation-latest`
- Extend mismatch detail to expose remediation history, latest remediation, `remediationInFlight`, and `isActionable`.

## Implementation Plan

1. Add the remediation-attempt table and runtime types.
2. Extend the runtime store with remediation create/read/update operations and richer mismatch detail projection.
3. Add control-plane remediation orchestration with lifecycle validation and in-flight guards.
4. Wire worker command execution into remediation attempt status and mismatch linkage updates.
5. Expose remediation API routes.
6. Add integration tests for success, failure, duplicate rejection, and lifecycle-aware detail views.
7. Update architecture and audit docs so the repo reflects the implemented workflow.
