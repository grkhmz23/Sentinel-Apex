# Vercel Deployment Checklist

Date: 2026-05-11

- Project root: `apps/ops-dashboard` if Vercel is configured with monorepo support, or repo root with build command filtered to dashboard.
- Install command: `pnpm install --frozen-lockfile`.
- Build command from repo root: `pnpm build:frontend`.
- Build command from `apps/ops-dashboard`: `pnpm build:deploy`.
- Framework/output: Next.js 14 app router, server-rendered route handlers.

## Required Env

- `NODE_ENV=production`
- `NEXT_PUBLIC_API_BASE_URL=https://<render-api>.onrender.com`
- `OPS_DASHBOARD_API_BASE_URL=https://<render-api>.onrender.com`
- `OPS_DASHBOARD_API_KEY=<same value as Render API_SECRET_KEY>`
- `OPS_AUTH_SHARED_SECRET=<same value as Render OPS_AUTH_SHARED_SECRET>`
- `OPS_DASHBOARD_ORIGIN=https://<vercel-production-domain>`
- `DATABASE_URL=<Render Postgres connection string>`
- `OPS_DASHBOARD_SESSION_COOKIE_NAME=sentinel_apex_ops_session`
- `OPS_DASHBOARD_SESSION_TTL_HOURS=12`
- optional `OPS_DASHBOARD_DEFAULT_SIGN_IN_EMAIL=<operator email>`
- public labels:
  - `NEXT_PUBLIC_ENVIRONMENT_LABEL=staging demo`
  - `NEXT_PUBLIC_EXECUTION_BADGE=dry-run only`

## Server-Only Restrictions

Do not prefix these with `NEXT_PUBLIC_`:

- `OPS_DASHBOARD_API_KEY`
- `OPS_AUTH_SHARED_SECRET`
- `DATABASE_URL`
- `OPS_DASHBOARD_ORIGIN` is not secret, but keep it server-side because it is used by route handlers.
- any private keys or webhook secrets

## Verification

- Visit `/sign-in`; confirm invalid credentials do not reveal which field failed.
- Confirm repeated failed sign-in attempts for the same email/IP are rate-limited.
- Confirm session cookie is HttpOnly, SameSite=Lax, and Secure in production.
- Confirm mutating dashboard routes reject requests with a mismatched `Origin`.
- Confirm `/api/runtime/status` returns 401 without a session.
- After sign-in, confirm proxied API requests include server-side API key and signed operator headers.
- Visit `/pusd`; verify it says live execution disabled and no signing/sendTransaction.
- Visit `/encrypt`; verify `productionPrivacyReady=false` and `realEncryption=false`.
- Visit `/api/deployment/status`; verify backend health is visible and readiness status is understood.

## Caveats

- Login rate limiting is in-memory and suitable for a single Vercel function instance demo, not a distributed production control.
- Mutating routes enforce strict production Origin/Referer validation. This is a deployment blocker if `OPS_DASHBOARD_ORIGIN` is missing or wrong.
- Preview domains require matching `CORS_ORIGIN` on Render if the browser calls the API directly. The current dashboard primarily uses server-side proxy routes, but set production CORS explicitly anyway.
