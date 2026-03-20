# Phase 2.0 Ops Dashboard Gap Analysis

Date: 2026-03-20
Repo: `/workspaces/Sentinel-Apex`

## Current Frontend And App Conventions

- The monorepo already standardizes on `pnpm`, Turborepo, TypeScript, ESLint, and Vitest.
- Existing apps were backend-only services: `apps/api` and `apps/runtime-worker`.
- There was no existing frontend framework, component library, or shared browser-side utility layer.
- The repo already supports app outputs that include `.next/**`, so a Next.js app fits the current build graph cleanly.
- Runtime API authentication uses `X-API-Key`, which means a browser-only SPA would leak the operator secret if it called the API directly.

## Dashboard Requirements

- Internal-only operator surface, not a public product UI.
- Real data from the existing runtime, mismatch, remediation, recovery, and reconciliation endpoints.
- Safe controls for already-supported runtime and mismatch actions.
- Strong handling of empty, degraded, loading, and failed states.
- Thin frontend over existing control-plane logic.

## Target Initial Pages And Panels

- Overview
  - runtime status
  - worker status
  - projection freshness
  - mismatch posture
  - reconciliation freshness
  - recent commands and recovery outcomes
- Mismatches
  - filterable mismatch queue
  - drill-in to mismatch detail
- Mismatch Detail
  - lifecycle state
  - linked findings
  - remediation history
  - linked command and recovery events
  - safe action panel
- Reconciliation
  - recent runs
  - recent findings
  - summary counts
- Operations
  - recent runtime commands
  - recent recovery events
  - recent recovery outcomes

## API Dependencies

- Already sufficient:
  - `GET /api/v1/runtime/status`
  - `GET /api/v1/runtime/worker`
  - `GET /api/v1/runtime/mismatches/:id`
  - `GET /api/v1/runtime/mismatches/:id/findings`
  - `GET /api/v1/runtime/mismatches/:id/remediation-history`
  - `GET /api/v1/runtime/reconciliation/runs`
  - `GET /api/v1/runtime/reconciliation/findings`
  - `GET /api/v1/runtime/reconciliation/summary`
  - `GET /api/v1/runtime/recovery-events`
  - `GET /api/v1/runtime/recovery-outcomes`
  - `POST /api/v1/runtime/cycles/run`
  - `POST /api/v1/runtime/projections/rebuild`
  - mismatch lifecycle and remediation endpoints
- Small cleanups needed for the dashboard skeleton:
  - filtered mismatch listing by `status`, `severity`, `sourceKind`, and `category`
  - list endpoint for recent runtime commands

## Implementation Plan In Priority Order

1. Add the minimal API adjustments the dashboard needs for filtering and command inspection.
2. Create `apps/ops-dashboard` as a Next.js app with a server-side proxy so the runtime API key stays off the client.
3. Build the core operator routes: overview, mismatches, mismatch detail, reconciliation, and operations.
4. Add safe action controls for cycle runs, projection rebuilds, reconciliation runs, and mismatch actions.
5. Add component and page tests with mocked runtime API responses.
6. Update repo docs and validation commands so the new app is part of the default monorepo workflow.
