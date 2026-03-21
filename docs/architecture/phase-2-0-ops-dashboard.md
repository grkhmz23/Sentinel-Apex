# Phase 2.0 Ops Dashboard Architecture

Date: 2026-03-20

## Chosen App Framework

- `apps/ops-dashboard` uses Next.js App Router with React and TypeScript.
- The choice is deliberate:
  - the repo had no browser-app precedent
  - the runtime API is authenticated with a server-side secret
  - Next lets the dashboard keep a thin server boundary without building a second backend service

## Server Boundary

- The browser never calls the runtime API directly.
- The dashboard proxies requests through `app/api/runtime/[...path]/route.ts`.
- The proxy injects:
  - `OPS_DASHBOARD_API_BASE_URL`
  - `OPS_DASHBOARD_API_KEY`
- This keeps the runtime API key out of the client bundle while preserving the existing backend contract.

## Client Structure

- Server-side data loaders live in `src/lib/runtime-api.server.ts`.
- Client-side mutations live in `src/lib/runtime-api.client.ts`.
- Shared response and page-state types live in `src/lib/types.ts`.
- Pages stay thin and mostly compose:
  - status panels
  - tables
  - action panels
  - empty/error states

## Operator Identity

- This document reflects the original Phase 2.0 dashboard skeleton.
- Phase 2.1 supersedes the client-side operator identity approach with:
  - server-side dashboard authentication
  - durable sessions
  - signed operator propagation to the API
  - backend role enforcement

## Route Skeleton

- `/`
  - overview, quick actions, recent mismatches, commands, reconciliation, and recovery outcomes
- `/mismatches`
  - filterable mismatch queue
- `/mismatches/[mismatchId]`
  - mismatch detail and action surface
- `/reconciliation`
  - recent runs, findings, and summary posture
- `/operations`
  - recent runtime commands, recovery events, and recovery outcomes

## Testing Approach

- Page rendering tests mock the server-side API loader layer.
- Action tests target client components directly and assert the correct mutation calls.
- The test scope is intentionally component and integration oriented, not full end-to-end browser automation.
