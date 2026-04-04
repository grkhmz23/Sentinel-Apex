# Render / Vercel Demo Deploy Runbook

Use this runbook for the hackathon / demo / staging deployment split:

- Render hosts the backend API and runtime worker
- Vercel hosts the ops dashboard only

This deployment remains intentionally limited:

- no mainnet claim
- no silent simulation fallback
- no widening beyond the existing Drift devnet carry path
- no weakening of venue-native fill evidence or post-trade confirmation

## 1. Deploy order

1. Provision the shared Postgres database and collect the `DATABASE_URL`.
2. Deploy the Render API service from `apps/api`.
3. Deploy the Render worker service from `apps/runtime-worker`.
4. Confirm Render `/health` and `/readyz`.
5. Deploy the Vercel dashboard from `apps/ops-dashboard`.
6. Confirm `/api/deployment/status` on Vercel.

## 2. Render services

The backend is intentionally split into two services because the worker is a real long-running process.

### API service

- Root directory: `apps/api`
- Build command: `pnpm build:deploy`
- Start command: `pnpm start`
- Health check path: `/health`

Required env:

- `DATABASE_URL`
- `API_SECRET_KEY`
- `OPS_AUTH_SHARED_SECRET`
- `NODE_ENV=staging`
- `EXECUTION_MODE=dry-run`
- `FEATURE_FLAG_LIVE_EXECUTION=false`
- `SENTINEL_ENVIRONMENT_LABEL=staging demo`
- `SENTINEL_EXECUTION_BADGE=devnet only`
- `CORS_ORIGIN=https://<your-vercel-domain>`

Execution env for the current real path:

- `DRIFT_EXECUTION_ENV=devnet`
- `DRIFT_RPC_ENDPOINT=<devnet RPC>`
- `DRIFT_PRIVATE_KEY=<devnet-only secret>`
- keep the read-only Drift env aligned to devnet if you enable the narrow live path

### Worker service

- Root directory: `apps/runtime-worker`
- Build command: `pnpm build:deploy`
- Start command: `pnpm start`

Required env:

- same runtime/execution env as the API
- `RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000`

## 3. Vercel dashboard

- Root directory: `apps/ops-dashboard`
- Build command: `pnpm build:deploy`

Public env:

- `NEXT_PUBLIC_API_BASE_URL=https://<render-api-domain>`
- `NEXT_PUBLIC_ENVIRONMENT_LABEL=staging demo`
- `NEXT_PUBLIC_EXECUTION_BADGE=devnet only`

Server-only env:

- `OPS_DASHBOARD_API_BASE_URL=https://<render-api-domain>`
- `OPS_DASHBOARD_API_KEY=<same value as Render API_SECRET_KEY>`
- `OPS_AUTH_SHARED_SECRET=<same value as Render OPS_AUTH_SHARED_SECRET>`
- `DATABASE_URL=<same shared postgres URL>`

Important codebase reality:

- the current dashboard owns operator auth/session logic in Next server code
- because of that, Vercel still needs `DATABASE_URL`
- this is acceptable for the current demo deployment and was preserved intentionally instead of rewriting auth architecture

## 4. Post-deploy smoke checks

From the repo root:

```bash
BACKEND_BASE_URL=https://<render-api-domain> pnpm smoke:backend
FRONTEND_BASE_URL=https://<vercel-domain> pnpm smoke:frontend
```

Manual spot checks:

1. Open `https://<render-api-domain>/health`
2. Open `https://<render-api-domain>/readyz`
3. Open `https://<vercel-domain>/api/deployment/status`
4. Open the dashboard sign-in page and confirm the visible banner says the environment is demo/staging and devnet-only

## 5. Honest limitations to keep visible

- real execution remains Drift devnet only
- execution remains carry sleeve only
- supported market remains BTC-PERP only
- only market orders are supported
- only reduce-only execution is supported
- post-trade confirmation and venue-native Drift fills remain first-class truth
- hackathon eligibility rules remain enforced exactly as already implemented
