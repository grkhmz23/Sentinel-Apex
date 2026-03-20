# Ops Dashboard

Internal operator dashboard for Sentinel Apex.

## Environment

Set these variables before running the app:

```bash
export OPS_DASHBOARD_API_BASE_URL=http://localhost:3000
export OPS_DASHBOARD_API_KEY=replace-with-the-runtime-api-key
export OPS_DASHBOARD_DEFAULT_ACTOR=local-operator
```

Optional:

```bash
export PORT=3100
```

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
