# Ops Dashboard

Internal operator dashboard for Sentinel Apex.

## Environment

Set these variables before running the app:

```bash
export OPS_DASHBOARD_API_BASE_URL=http://localhost:3000
export OPS_DASHBOARD_API_KEY=replace-with-the-runtime-api-key
export OPS_AUTH_SHARED_SECRET=replace-with-the-operator-shared-secret
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
```

Optional:

```bash
export PORT=3100
export NEXT_PUBLIC_ENVIRONMENT_LABEL="staging demo"
export NEXT_PUBLIC_EXECUTION_BADGE="devnet only"
```

`OPS_DASHBOARD_API_KEY` must match the backend `API_SECRET_KEY`.

The dashboard remains frontend-only in deployment shape, but the current auth/session model still uses server-side DB access from Next.js. That is preserved intentionally for this demo/staging deployment.

## Local Development

```bash
pnpm --filter @sentinel-apex/ops-dashboard dev
```

## Validation

```bash
pnpm --filter @sentinel-apex/ops-dashboard build
pnpm --filter @sentinel-apex/ops-dashboard typecheck
pnpm --filter @sentinel-apex/ops-dashboard lint
pnpm --filter @sentinel-apex/ops-dashboard test
```

Deployment reference:

- `docs/deployment/render-vercel-split.md`
- `docs/runbooks/render-vercel-demo-deploy.md`
