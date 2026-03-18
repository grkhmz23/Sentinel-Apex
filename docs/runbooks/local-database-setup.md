# Local Database Setup

Date: 2026-03-18

## Local/Dev Default

Phase 1.5 local development is now Postgres-first.

Default local connection:

```bash
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
```

PGlite still exists for deterministic tests and isolated local scripts, but it is no longer the primary local/dev workflow.

## Required Environment

Minimum API/runtime environment:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
export API_SECRET_KEY=replace-with-at-least-32-characters
export EXECUTION_MODE=dry-run
export FEATURE_FLAG_LIVE_EXECUTION=false
```

## Start Local Postgres

```bash
pnpm db:start
```

This starts `infra/docker/docker-compose.local-db.yml` and waits for readiness.

## Check Health

```bash
pnpm db:health
```

This runs `pg_isready` inside the local Postgres container.

## Apply Migrations

```bash
pnpm db:migrate
```

This applies committed SQL migrations from `packages/db/migrations/`.

## Reset Local Database

```bash
pnpm db:reset
```

This destroys the local Postgres volume, starts a fresh container, and reapplies migrations.

## Stop Local Postgres

```bash
pnpm db:stop
```

This stops the local Postgres container without deleting the volume.

## Start The API Against Postgres

```bash
pnpm --filter @sentinel-apex/api dev
```

The API bootstraps the in-process runtime, restores projections from persisted records on startup, and serves runtime-backed state from the configured `DATABASE_URL`.

## Run One Deterministic Runtime Cycle

```bash
pnpm --filter @sentinel-apex/runtime dev:run-cycle
```

This:

1. applies migrations
2. boots the deterministic runtime
3. restores persisted state if present
4. runs one dry-run strategy cycle
5. persists strategy, risk, execution, portfolio, and audit records

## Rebuild Current Projections

```bash
pnpm --filter @sentinel-apex/runtime dev:rebuild-projections
```

This rebuilds current projections from persisted source records without creating a new strategy run.

## Notes

- Dry-run remains the default and supported operating mode.
- Live execution is still separately gated and opt-in only.
- Projection rebuild is deterministic and idempotent.
- Tests may still use file-backed or in-memory PGlite for isolation and speed.
