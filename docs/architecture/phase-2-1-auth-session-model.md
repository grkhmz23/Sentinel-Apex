# Phase 2.1 Auth And Session Model

Date: 2026-03-21

## Scope

- This model secures the internal ops dashboard and the existing operator mutation surfaces.
- It is intentionally not a public auth system, not SSO, and not tenant or org management.
- The goal is the smallest maintainable internal model that provides:
  - authenticated dashboard access
  - durable sessions
  - role-aware authorization
  - auditable operator identity on backend actions

## Chosen Model

- Authentication is credentials-based for internal operators.
- Operator identities are stored in Postgres in `ops_operators`.
- Dashboard sessions are stored durably in `ops_operator_sessions`.
- The dashboard uses an HttpOnly signed-cookie session token.
- The browser never receives the runtime API key or the operator-signing secret.
- The Next.js dashboard server resolves the session, then signs operator identity onto proxy requests sent to `apps/api`.
- The API verifies the signed operator headers and enforces route-level role requirements.

## Operator Data Model

- `ops_operators`
  - `operator_id`
  - `email`
  - `display_name`
  - `role`
  - `password_hash`
  - `active`
  - `last_authenticated_at`
  - timestamps
- `ops_operator_sessions`
  - `session_id`
  - `operator_id`
  - `token_hash`
  - `expires_at`
  - `last_seen_at`
  - `revoked_at`
  - timestamps

## Password And Session Handling

- Passwords are hashed with Node `scrypt` using explicit cost parameters in `auth.server.ts`.
- Session cookies store a random opaque token, not the database token hash.
- Only the SHA-256 token hash is persisted.
- Session expiry defaults to 12 hours and is configurable through `OPS_DASHBOARD_SESSION_TTL_HOURS`.
- Session cookies are:
  - `HttpOnly`
  - `SameSite=Lax`
  - `Secure` in production
- Session revocation is durable through `revoked_at`.
- Session last-seen timestamps are touched periodically instead of on every request.

## Authorization Model

- Roles are ordered:
  - `viewer`
  - `operator`
  - `admin`
- `viewer` is read-only.
- `operator` can perform routine runtime and mismatch actions.
- `admin` inherits operator permissions and can perform higher-risk control-plane actions.
- Authorization is enforced in `apps/api/src/middleware/operator-auth.ts`, not in route handlers or client code alone.

## Signed Operator Propagation

- The dashboard proxy signs these headers for each API mutation request:
  - `x-sentinel-operator-id`
  - `x-sentinel-operator-role`
  - `x-sentinel-operator-session-id`
  - `x-sentinel-operator-issued-at`
  - `x-sentinel-operator-signature`
- Signatures are HMAC-SHA256 over method, path, issued-at timestamp, and operator context.
- The API verifies:
  - role validity
  - timestamp skew
  - signature integrity
- This keeps authorization bound to a real dashboard session instead of mutable client payload fields.

## Dashboard Protection

- Server-rendered dashboard routes call `requireDashboardSession(...)`.
- Unauthenticated users are redirected to `/sign-in`.
- Login and logout run through server routes.
- Role-aware UI disabling is provided as an operator UX layer, but backend enforcement remains authoritative.

## Audit Propagation

- Existing runtime control-plane methods already persist actor fields on commands, mismatch lifecycle actions, remediation attempts, recovery events, and runtime status transitions.
- This phase changes the source of truth for those fields:
  - from caller-supplied actor strings
  - to authenticated operator IDs from the session-backed authorization layer
- Historical records remain intact because the runtime schema already modeled actor persistence.

## Local Development Bootstrap

- Local operator creation is explicit through:
  - `pnpm --filter @sentinel-apex/ops-dashboard bootstrap:operator -- ...`
- Required environment:
  - `DATABASE_URL`
  - `OPS_AUTH_SHARED_SECRET`
- Recommended local flow:
  - migrate DB
  - bootstrap an operator
  - run API
  - run dashboard
  - sign in through `/sign-in`

## Deferred Work

- External SSO or IdP integration
- Multi-factor authentication
- Fine-grained per-action policy beyond the three current roles
- Admin UI for managing operators
