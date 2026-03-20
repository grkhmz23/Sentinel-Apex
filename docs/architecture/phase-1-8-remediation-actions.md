# Phase 1.8 Remediation Actions

Date: 2026-03-20

## Goal

Phase 1.8 adds first-class remediation attempts to the runtime incident model. The intent is not to replace `runtime_commands` or `runtime_recovery_events`, but to bind them together around one mismatch so operator remediation is durable and queryable.

## Model

Three records now participate in one remediation workflow:

1. `runtime_mismatches`
   - the incident record and lifecycle state
2. `runtime_commands`
   - the executable unit processed by the worker
3. `runtime_mismatch_remediations`
   - the mismatch-scoped remediation attempt record

Recovery events remain append-only evidence for what happened during and around the remediation.

## Initial Remediation Actions

This phase intentionally supports only real actions that already exist in the runtime:

- `rebuild_projections`
- `run_cycle`

No new executor or fake remediation subsystem was introduced.

## Lifecycle Interaction

- Remediation is allowed from `open`, `acknowledged`, `reopened`, and `recovering`.
- Remediation is rejected from `resolved` and `verified`.
- Creating a remediation attempt moves the mismatch into `recovering`.
- Only one remediation may be in flight per mismatch.
- Successful remediation completion does not auto-resolve the mismatch.
  - The system records the outcome and keeps the mismatch in `recovering` until an operator resolves and verifies it.
- Failed remediation reopens the mismatch and records the failure as both:
  - a remediation attempt outcome
  - a recovery event

## Attempt Status Model

`runtime_mismatch_remediations.status` is execution-oriented:

- `requested`
- `running`
- `completed`
- `failed`

This is intentionally separate from mismatch lifecycle status. The mismatch answers “what is the incident state?” while the remediation attempt answers “what happened with this remediation run?”

## Data Flow

1. Operator calls mismatch remediation API.
2. Control plane validates the mismatch state and checks for in-flight remediation.
3. Control plane creates a runtime command and a remediation attempt linked by `command_id`.
4. Control plane updates the mismatch into `recovering`.
5. Worker claims the command and updates the remediation attempt to `running`.
6. Worker completes or fails the command.
7. Worker updates:
   - the remediation attempt status
   - the mismatch linked command/event references
   - recovery events
   - mismatch status on failure

## Query Surface

Mismatch detail now exposes:

- mismatch lifecycle state
- linked command
- recovery events
- remediation history
- latest remediation
- `remediationInFlight`
- `isActionable`

This gives the future ops dashboard a stable backend contract without reconstructing meaning from raw events.
