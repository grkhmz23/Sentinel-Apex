# Phase 1.6 Worker Extraction Gap Analysis

Date: 2026-03-18

## Current Boundary

- `apps/api` currently exposes the read and operator surface.
- Before this pass, the API process also instantiated `SentinelRuntime` and executed cycles/rebuilds inline.
- Runtime state, strategy runs, projections, and audit history were already durable, but worker lifecycle and recovery mismatches were not.
- Recovery visibility was mostly implicit in runtime status and audit events rather than explicit durable operator records.

## Target Boundary

- `apps/api` stays the control-plane and read surface.
- `apps/runtime-worker` owns scheduled cycle execution, runtime bootstrap, durable command processing, and worker heartbeat/scheduler metadata.
- `packages/runtime` owns the shared runtime engine, control-plane facade, worker scheduler, mismatch persistence, and recovery history.
- Operator commands that need execution work become durable `runtime_commands` processed by the worker instead of inline API execution.

## Mismatch And Recovery Data Requirements

- Durable worker state:
  - lifecycle, scheduler state, heartbeat, current operation, last success/failure, next scheduled run
- Durable command state:
  - one-shot cycle requests and projection rebuild requests with pending/running/completed/failed status
- Durable mismatch state:
  - category, severity, entity references, summary/details, open/acknowledged/resolved lifecycle, timestamps, dedupe key
- Durable recovery history:
  - command requested/started/completed/failed
  - mismatch detected/resolved/acknowledged
  - worker started/stopped

## Implementation Plan

1. Add worker state, runtime command, mismatch, and recovery-event schema with a real migration.
2. Extract a `RuntimeControlPlane` facade so the API reads and writes durable control state without owning execution.
3. Add a `RuntimeWorker` scheduler that boots the runtime, enforces single-operation execution, processes commands, and persists heartbeat/next-run metadata.
4. Persist meaningful recovery issues:
   - projection mismatch
   - execution state mismatch
   - recovery action failure
   - runtime failure
5. Expose runtime overview, worker state, mismatch history, recovery events, and command status through the API.
6. Cover worker lifecycle, command processing, mismatch persistence, and API visibility with integration tests.
