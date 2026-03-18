# ADR 0010: Dedicated Runtime Worker Boundary

Date: 2026-03-18
Status: Accepted

## Context

Phase 1.5 left `apps/api` responsible for both control-plane reads and runtime execution. That meant scheduled execution was tied to API process lifetime and recovery issues were visible mostly through logs and status flags rather than explicit durable records.

## Decision

Introduce a dedicated `apps/runtime-worker` process and move recurring cycle execution plus command processing into that worker.

Keep the design intentionally simple:

- no external queue or orchestration platform
- durable command table for one-shot cycle/rebuild requests
- durable worker state row for scheduler metadata
- durable mismatch and recovery-event tables for operator visibility

The API remains the control-plane and read surface.

## Consequences

- Scheduled runtime execution no longer depends on API process uptime.
- Operator-triggered one-shot actions are now durable and inspectable.
- Recovery issues become operator-visible with explicit open/acknowledged/resolved state.
- The architecture remains small enough for Phase 1 while creating a clean seam for future projector or workflow extraction if needed.
