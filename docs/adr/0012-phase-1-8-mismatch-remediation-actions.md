# ADR 0012: Phase 1.8 Mismatch Remediation Actions

Date: 2026-03-20
Status: Accepted

## Context

Phase 1.7 added a formal mismatch lifecycle and durable recovery metadata, but remediation remained implicit. Operators could link a mismatch to one command, yet the system had no durable model for repeated remediation attempts, in-flight prevention, or explicit query support.

## Decision

Introduce a dedicated `runtime_mismatch_remediations` table while preserving:

- `runtime_commands` as the executable queue
- `runtime_recovery_events` as the append-only event log
- `runtime_mismatches` as the incident record

Remediation attempts are therefore first-class, but they are not a new executor subsystem.

## Rationale

- A mismatch may require multiple remediations over time.
- Commands alone are too generic to answer incident-scoped questions.
- Recovery events alone are too low-level to serve as the primary operator query model.
- A remediation attempt record is the smallest correct abstraction that keeps command execution, incident state, and outcome history linked without architectural churn.

## Consequences

- Operators can inspect remediation history directly from mismatch detail.
- The worker can update remediation execution state without adding a second command runner.
- Duplicate in-flight remediation can be rejected cleanly.
- Successful remediation remains distinct from operator resolution and verification.
- The schema now has one more runtime table, but the control-plane model is materially clearer and more auditable.
