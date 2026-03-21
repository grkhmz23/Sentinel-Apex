# ADR 0014: Phase 2.1 Ops Dashboard Auth And Authorization

Date: 2026-03-21

## Status

Accepted

## Context

The ops dashboard introduced in Phase 2.0 was intentionally thin, but it still relied on a weak trust model:

- dashboard access itself was unauthenticated
- actor identity was supplied from the client
- runtime mutation routes depended on API-key possession and trusted caller-provided operator fields

That was sufficient for a local internal skeleton, but not for real internal operational use.

## Decision

Adopt a minimal internal auth model with:

- Postgres-backed internal operator accounts
- Postgres-backed durable dashboard sessions
- credentials-based login for the dashboard
- HMAC-signed operator headers between the dashboard proxy and the API
- route-level role checks in the API

Use three roles:

- `viewer`
- `operator`
- `admin`

Keep the existing API key requirement and layer operator authorization on top of it for sensitive mutations.

## Consequences

Positive:

- dashboard access is explicitly authenticated
- sensitive runtime actions are enforced server-side
- actor identity is durable and auditable
- the browser still never receives the API key or signing secret
- the model is small enough to maintain without introducing a separate auth service

Negative:

- local setup now requires operator bootstrap in addition to DB migration
- the API has an additional authorization contract for mutation routes
- this is still an internal credentials-based model, not enterprise SSO

## Alternatives Considered

- frontend-only action hiding
  - rejected because it provides no real authorization
- reusing only the API key with no operator identity
  - rejected because actions would remain unauditable and roleless
- introducing NextAuth or a larger external auth stack immediately
  - rejected as too heavy for the repo’s current internal scope
