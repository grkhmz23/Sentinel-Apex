# Render Deployment Checklist

Date: 2026-05-11

## Backend API

- Service type: Web Service.
- Recommended root directory: repository root, not `apps/api`.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm build:api`.
- Start command: `pnpm start:api`.
- Health check path: `/health`.
- Readiness path: `/readyz` may be `degraded` if no worker is running.
- Migration command before first start: `pnpm --filter @sentinel-apex/db build && node packages/db/dist/migrate.js`.
- Required env:
  - `NODE_ENV=staging` or `production`
  - `API_PORT=10000`
  - `DATABASE_URL=<Render Postgres internal URL>`
  - `API_SECRET_KEY=<32+ chars>`
  - `OPS_AUTH_SHARED_SECRET=<same as Vercel>`
  - `EXECUTION_MODE=dry-run`
  - `FEATURE_FLAG_LIVE_EXECUTION=false`
  - `CORS_ORIGIN=https://<vercel-production-domain>`
  - `SENTINEL_ENVIRONMENT_LABEL=staging demo`
  - `SENTINEL_EXECUTION_BADGE=dry-run only`
- PUSD demo env when selected:
  - `VAULT_BASE_ASSET=PUSD`
  - `PUSD_MINT=<public mint>`
  - `PUSD_DECIMALS=6`
  - optional `PUSD_VAULT_OWNER=<public owner>`
  - optional `SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com`
- Encrypt safe default:
  - `ENCRYPT_ENABLED=false`
  - `ENCRYPT_SDK_MODE=adapter`
- Encrypt SDK demo only:
  - `ENCRYPT_ENABLED=true`
  - `ENCRYPT_PROGRAM_ID=<public devnet program id>`
  - `ENCRYPT_PRE_ALPHA_ACK=I_UNDERSTAND_ENCRYPT_PRE_ALPHA_IS_NOT_PRODUCTION_PRIVACY`
  - `ENCRYPT_SDK_MODE=sdk-prealpha`
  - `ENCRYPT_GRPC_ENDPOINT=<host:port>`
  - `ENCRYPT_NETWORK_ENCRYPTION_PUBLIC_KEY=<public key>`
  - `ENCRYPT_SDK_DEMO_ACK=I_UNDERSTAND_ENCRYPT_SDK_PREALPHA_USES_NON_SENSITIVE_DEMO_DATA_ONLY`
  - `ENCRYPT_SDK_STRICT=false`
- Must not set for PUSD/Encrypt demo:
  - `JUPITER_PERPS_PRIVATE_KEY`
  - `JUPITER_PERPS_ENABLED=true`
  - `RANGER_ADMIN_PRIVATE_KEY`
  - `RANGER_MANAGER_PRIVATE_KEY`

## Render Blueprint

Current `render.yaml` deploys only the API web service from the repository root:

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build:api`
- Start command: `pnpm start:api`
- Health check: `/health`

Worker deployment is intentionally omitted from the default blueprint. Use the optional worker section below only if continuous runtime cycles are needed for the demo.

The API Dockerfile now starts `dist/main.js`, matching `apps/api/package.json`.

## Operator Bootstrap

Run operator bootstrap manually after migrations and before demo login:

```bash
BOOTSTRAP_OPERATOR_ENABLED=true \
BOOTSTRAP_OPERATOR_EMAIL=operator@example.com \
BOOTSTRAP_OPERATOR_PASSWORD='<generated-password>' \
DATABASE_URL='<render-postgres-url>' \
pnpm --filter @sentinel-apex/ops-dashboard exec tsx ../../scripts/bootstrap-operator.ts
```

The bootstrap script never prints plaintext passwords or generated hashes. Rotate any operator account created by older hardcoded bootstrap scripts.

## Worker

- Service type: Background Worker.
- Deploy only if the demo needs continuous cycle updates.
- Root directory: repository root.
- Build command: `pnpm build:worker`.
- Start command: `pnpm start:worker`.
- Required env: same database/config/execution env as API plus `RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000`.
- Deploy exactly one worker to avoid duplicate cycles.
- Keep `EXECUTION_MODE=dry-run` and `FEATURE_FLAG_LIVE_EXECUTION=false`.

## Logs To Check

- API startup: "API deployment profile loaded".
- Worker startup: "Runtime worker deployment profile loaded".
- Migration: `[db] migrations complete`.
- `/health`: status `ok`.
- `/readyz`: `ok` only with fresh worker heartbeat; otherwise degraded is expected for API-only demo.

## Failure Modes

- Missing `OPS_AUTH_SHARED_SECRET`: API startup fails by design.
- Missing/short `API_SECRET_KEY`: config validation fails outside test.
- Missing `DATABASE_URL`: API/worker/dashboard and migrations fail.
- Missing `PUSD_MINT`/`PUSD_DECIMALS` when `VAULT_BASE_ASSET=PUSD`: config fails closed.
- Omitted `CORS_ORIGIN` in production: API startup fails by design.
