# Render / Vercel Deployment Split

This repo deploys cleanly with a two-target split:

- Render: backend services
- Vercel: frontend dashboard only

This is a demo / staging deployment shape. It keeps the current scope honest:

- Drift devnet only
- carry sleeve only
- BTC-PERP only
- market orders only
- reduce-only only

It does not widen any real execution scope, and it does not replace venue-native fill evidence or post-trade confirmation with simulation shortcuts.

## Deployment map

| Path | Deploy target | Role | Long-running? | Notes |
| --- | --- | --- | --- | --- |
| `apps/ops-dashboard` | Vercel | Next.js operator dashboard | No | Uses Next route handlers for auth + backend proxying. |
| `apps/api` | Render web service | Fastify API / control plane | No | Reads runtime state from the DB and exposes `/health`, `/readyz`, and `/api/v1/*`. |
| `apps/runtime-worker` | Render worker service | Scheduler / command processor | Yes | Runs scheduled cycles and queued runtime commands. |

## Shared packages by target

### Vercel frontend

- `@sentinel-apex/db`
  Used by dashboard operator auth/session storage.
- `@sentinel-apex/shared`
  Used by signed operator headers and deployment-truth UI metadata.
- `@sentinel-apex/runtime`
  Type-only dependency for API response contracts.

### Render API

- `@sentinel-apex/config`
- `@sentinel-apex/runtime`
- `@sentinel-apex/db`
- `@sentinel-apex/shared`
- `@sentinel-apex/observability`
- domain/risk packages pulled transitively by `@sentinel-apex/runtime`

### Render worker

- `@sentinel-apex/config`
- `@sentinel-apex/runtime`
- `@sentinel-apex/observability`

## Env loading model

### Backend

- Parsed via `@sentinel-apex/config` for the main backend/runtime env contract.
- Additional backend-only vars are read directly from `process.env` where the repo already did so:
  - `OPS_AUTH_SHARED_SECRET`
  - `CORS_ORIGIN`
  - `RUNTIME_WORKER_CYCLE_INTERVAL_MS`

### Frontend

- Server-only vars are read via `apps/ops-dashboard/src/lib/env.server.ts`.
- Public deployment-label vars are read via `apps/ops-dashboard/src/lib/deployment.ts`.

## Required env split

### Vercel public

- `NEXT_PUBLIC_API_BASE_URL`
  Public backend base URL. Optional if you prefer the server-only alias below.
- `NEXT_PUBLIC_ENVIRONMENT_LABEL`
  Banner label, for example `staging demo`.
- `NEXT_PUBLIC_EXECUTION_BADGE`
  Banner badge, for example `devnet only`.

### Vercel server-only

- `OPS_DASHBOARD_API_BASE_URL`
  Server-side backend base URL for Next route handlers.
- `OPS_DASHBOARD_API_KEY`
  Must match Render `API_SECRET_KEY`.
- `OPS_AUTH_SHARED_SECRET`
  Must match Render `OPS_AUTH_SHARED_SECRET`.
- `DATABASE_URL`
  Required because the current dashboard stores operator sessions in the shared DB.
- `OPS_DASHBOARD_SESSION_COOKIE_NAME`
  Optional.
- `OPS_DASHBOARD_SESSION_TTL_HOURS`
  Optional.
- `OPS_DASHBOARD_DEFAULT_SIGN_IN_EMAIL`
  Optional.

### Render API

- `DATABASE_URL`
- `API_SECRET_KEY`
- `OPS_AUTH_SHARED_SECRET`
- `NODE_ENV`
- `EXECUTION_MODE`
- `FEATURE_FLAG_LIVE_EXECUTION`
- `SENTINEL_ENVIRONMENT_LABEL`
- `SENTINEL_EXECUTION_BADGE`
- `CORS_ORIGIN`
- `DRIFT_RPC_ENDPOINT`
- `DRIFT_READONLY_ENV`
- `DRIFT_READONLY_ACCOUNT_ADDRESS`
- `DRIFT_READONLY_AUTHORITY_ADDRESS`
- `DRIFT_READONLY_SUBACCOUNT_ID`
- `DRIFT_READONLY_ACCOUNT_LABEL`
- `DRIFT_EXECUTION_ENV`
- `DRIFT_EXECUTION_SUBACCOUNT_ID`
- `DRIFT_EXECUTION_ACCOUNT_LABEL`
- `DRIFT_PRIVATE_KEY`

### Render worker

- Same runtime/execution env as the API except `CORS_ORIGIN`
- `RUNTIME_WORKER_CYCLE_INTERVAL_MS`

## Build and start commands

Each deployable app now builds its workspace dependencies before building itself.

### Vercel

- Root directory: `apps/ops-dashboard`
- Build command: `pnpm build:deploy`
- Start command: Vercel-managed Next.js start

### Render API

- Root directory: `apps/api`
- Build command: `pnpm build:deploy`
- Start command: `pnpm start`
- Health check path: `/health`

### Render worker

- Root directory: `apps/runtime-worker`
- Build command: `pnpm build:deploy`
- Start command: `pnpm start`

## What must not run on Vercel

- `apps/runtime-worker`
- `RuntimeWorker`
- execution loops
- venue event subscribers as a long-running process
- Drift signing keys such as `DRIFT_PRIVATE_KEY`
- any background process that assumes a persistent runtime

## Smoke surfaces

### Backend

- `GET /health`
  Liveness.
- `GET /readyz`
  Runtime/worker readiness with honest environment and execution-scope metadata.

### Frontend

- `GET /api/deployment/status`
  Public deployment/status payload that includes the dashboard banner metadata and backend health/readiness passthrough.
