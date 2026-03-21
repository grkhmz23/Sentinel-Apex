# Phase 2.1 Auth And Role-Gating Gap Analysis

Date: 2026-03-21
Repo: `/workspaces/Sentinel-Apex`

## Current Trust Model

- The runtime API already enforced `X-API-Key` authentication for all protected routes.
- The Phase 2.0 dashboard kept that API key on the server through a Next.js proxy, but dashboard access itself was unauthenticated.
- Operator-triggered actions in the dashboard relied on client-supplied actor IDs rather than a durable authenticated session.
- Runtime mutation routes trusted any caller that had the API key and knew the route contract.
- Control-plane and recovery history already persisted actor fields, but those values were only as trustworthy as the caller that supplied them.

## Target Auth And Session Model

- Add explicit internal operator accounts persisted in Postgres.
- Protect the dashboard with server-side sign-in and signed, HttpOnly session cookies.
- Resolve the authenticated operator on the server for dashboard pages, loaders, and proxy requests.
- Keep the browser isolated from the runtime API key and from any operator-signing secret.
- Propagate operator identity from the dashboard proxy to the API through short-lived HMAC-signed operator headers.
- Keep the existing API key requirement in place so API callers still need both service authentication and operator authorization for sensitive mutations.

## Target Role Model

- `viewer`
  - read-only access to dashboard and runtime inspection endpoints
  - cannot trigger runtime or mismatch mutations
- `operator`
  - can perform routine operational actions:
  - run cycle
  - rebuild projections
  - run reconciliation
  - acknowledge, recover, resolve, verify, reopen mismatches
  - trigger supported remediations
- `admin`
  - inherits operator permissions
  - can execute higher-risk control-plane actions such as kill-switch, resume, and execution-mode changes

## Required Backend Enforcement Points

- Dashboard route access must require a valid server-side session.
- Dashboard proxy requests for runtime data must require a valid session before forwarding.
- Runtime mutation endpoints in `apps/api` must require both:
  - API key authentication
  - signed operator authorization headers with at least `operator` role
- Control endpoints in `apps/api` must require both:
  - API key authentication
  - signed operator authorization headers with `admin` role
- Read routes continue to require only API key authentication.
- Runtime control-plane mutation calls must record the authenticated operator ID instead of caller-supplied placeholders.

## Required Schema And State Changes

- Add `ops_operators` for internal operator identities, role, password hash, and active state.
- Add `ops_operator_sessions` for durable session tracking, revocation, expiry, and last-seen timestamps.
- Reuse existing runtime actor and audit fields rather than introducing a separate operator-action log in this pass.
- Add a shared signed-operator contract so the dashboard proxy and API verify the same authorization payload.

## Implementation Plan In Priority Order

1. Add durable operator and operator-session tables with migrations.
2. Implement Postgres-backed dashboard authentication with secure cookie sessions and sign-out.
3. Add a bootstrap path for local operator creation.
4. Add signed operator header generation in the dashboard proxy and verification middleware in the API.
5. Enforce `viewer` vs `operator` vs `admin` roles on runtime and control mutations.
6. Replace client-supplied actor IDs with authenticated operator propagation.
7. Add dashboard UX gating so viewer sessions remain clearly read-only.
8. Add integration and component tests for session handling, authorization failures, and actor audit propagation.
