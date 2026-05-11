# Sentinel Apex Audit Risk Report

Date: 2026-05-11

## Executive Summary

Tracked code is clean; only `Encrypt Developer Guide.pdf` is untracked. Root validation passed:

- `pnpm typecheck`: passed, 34/34 Turbo tasks cached, 636 ms.
- `pnpm test`: passed, 35/35 Turbo tasks cached, 637 ms. Replayed API tests show 39 API tests and config tests show 42 config tests.
- `pnpm build`: passed, 19/19 Turbo tasks cached, 649 ms.
- `pnpm lint`: passed, 19/19 Turbo tasks cached, 635 ms.

Overall verdict:

- Demo readiness: yes, for dry-run PUSD + Encrypt pre-alpha demo only.
- Render/Vercel readiness: ready for dry-run public demo after environment variables are configured and the old bootstrapped operator is rotated.
- Hackathon submission readiness: yes for dry-run PUSD + Encrypt pre-alpha demo after old bootstrap credentials are rotated.
- Production/live readiness: no. Live execution, signing, `sendTransaction`, and production privacy are intentionally absent.

## Critical Findings

| ID | Severity | Title | Evidence | Impact | Recommended fix | Fixed |
| --- | --- | --- | --- | --- | --- | --- |
| P0-1 | P0 | Hardcoded operator password and printed password/hash in bootstrap scripts | Fixed: generated JS/SQL bootstrap artifacts were deleted; TypeScript bootstrap now requires explicit env input and does not print password/hash | Previously bootstrapped operators could still exist in external DBs | Rotate any operator created by the old bootstrap path | Yes |
| P1-1 | P1 | Deployment truth claimed Jupiter devnet execution was available | Fixed: shared deployment truth now says PUSD accounting/intents enabled, PUSD live execution/signing/sendTransaction disabled, Encrypt pre-alpha only when configured | Prevents dashboard/readiness from overstating execution readiness | Keep release truth in sync with public demo claims | Yes |
| P1-2 | P1 | Render blueprint likely built from wrong root | Fixed: Render API builds from repo root with `pnpm build:api` and starts with `pnpm start:api` | Reduces monorepo deploy failure risk | Keep worker deployment separate and opt-in | Yes |
| P1-3 | P1 | API CORS defaulted to any origin | Fixed: production requires `CORS_ORIGIN`; wildcard/invalid values fail startup; local dev keeps localhost defaults | Public deployment now fails closed if CORS is omitted | Set `CORS_ORIGIN` to the Vercel production origin | Yes |
| P1-4 | P1 | Dashboard mutating proxy routes had no CSRF token/origin check | Fixed: POST route handlers now enforce strict production Origin/Referer validation with `OPS_DASHBOARD_ORIGIN` | Reduces cross-site POST risk at dashboard boundary | Keep `OPS_DASHBOARD_ORIGIN` exact per deployment domain | Yes |
| P1-5 | P1 | Operator login had no rate limit/lockout | Fixed: login route now has an in-memory demo limiter keyed by email + IP | Brute-force risk is reduced but limiter resets on serverless cold starts | Replace with DB-backed failed attempt tracking after demo | Yes |
| P1-6 | P1 | Dockerfile command pointed to wrong API entry | Fixed: API Docker CMD uses `node dist/main.js`, matching the API package start script | Docker runtime starts the compiled API entry | None | Yes |

## Risk Register

### P0 Critical

- Previously hardcoded operator credential in bootstrap scripts. Status: fixed in source by deleting generated JS/SQL artifacts and requiring env-only TypeScript bootstrap input. Residual action: rotate any operator already created from the old bootstrap path.

### P1 High

- Stale execution claims in shared deployment profile. Status: fixed; default badge is now dry-run only and PUSD live execution remains disabled.
- Render blueprint build-root mismatch. Status: fixed for API; worker deployment remains opt-in and documented.
- Permissive CORS fallback. Status: fixed; production startup requires explicit `CORS_ORIGIN`.
- Missing CSRF controls on dashboard POST proxy/auth routes. Status: fixed with strict production Origin/Referer checks.
- No login rate limit. Status: fixed with an in-memory demo limiter; DB-backed tracking remains a post-demo improvement.
- Docker API CMD mismatch. Status: fixed.

### P2 Medium

- `ENCRYPT_SDK_MODE=sdk-prealpha` can trigger SDK network calls during API-controlled Encrypt mutations when enabled. This is guarded by acknowledgements and strict mode defaults false, but should not be enabled in root CI or default demo unless intentionally testing SDK evidence.
- `RANGER_ADMIN_PRIVATE_KEY` and `RANGER_MANAGER_PRIVATE_KEY` are parsed from env in `packages/runtime/src/control-plane.ts`; keep unset for PUSD/Encrypt demo. They are not used in PUSD/Encrypt paths but are live signing material for Ranger routes.
- Runtime worker and API both call `applyMigrations`; concurrent first boot can race on migration DDL. Most SQL uses `IF NOT EXISTS`, but manual one-shot migration before services is cleaner.
- Some query `limit` parsing can produce `NaN` metadata (`PUSD`, `Encrypt`, others) if non-numeric. Mostly low blast radius but should clamp invalid values to defaults.
- `OPS_DASHBOARD_API_BASE_URL` falls back to `NEXT_PUBLIC_API_BASE_URL`; using public URL is acceptable for base URL but can confuse server-only deployment docs.

### P3 Low

- `rg` is not installed in the Codespace, slowing audit workflows.
- Several older docs still discuss legacy/live Jupiter or carry behavior. They are not PUSD/Encrypt claims, but current demo docs should lead with disabled execution.

## Security Keyword Audit

| Pattern | Result |
| --- | --- |
| `privateKey`, `secretKey`, `seedPhrase`, `mnemonic`, `walletJson` | PUSD and Encrypt routes explicitly reject these fields. Jupiter/Ranger code can accept env private keys outside PUSD/Encrypt; keep unset for demo. |
| `Keypair` | Present in Ranger and control-plane Ranger helpers; not PUSD/Encrypt path. |
| `sendTransaction` | Only appears as disabled safety fields/docs; no PUSD/Encrypt send path found. |
| `mock_tx` | No actionable production use found. |
| `password` | Secure hashing in dashboard auth; bootstrap now requires password via environment and never prints plaintext or hash. |
| `API_KEY`, `SECRET`, `TOKEN`, `AUTH` | API key and HMAC operator headers are server-side. `OPS_DASHBOARD_API_KEY` is used only in Next server route handlers. |
| `localStorage`, `sessionStorage` | No unsafe dashboard secret storage found. |
| `NEXT_PUBLIC` | Only public API base URL and public labels/badges; no API key exposed. |
| `CORS_ORIGIN` | Required in production; comma-separated origins are validated and wildcard is rejected. |
| `cookie`, `setCookie` | HttpOnly, SameSite=Lax, Secure only in production. Dashboard mutating route handlers enforce Origin/Referer in production. |
| `x-operator-signature` | Actual header is `x-sentinel-operator-signature`; HMAC covers method/path/timestamp/operator/session. |

## PUSD Audit

- PUSD mode cannot select Jupiter Perps: verified. `SentinelRuntime.createDeterministic` initializes Jupiter only when `!pusdMode && JUPITER_PERPS_ENABLED === 'true'`.
- PUSD live orders: no PUSD live submission path found. `PusdTreasuryAdapter.executeTreasuryAction` always throws.
- PUSD API rejects signing material: verified in `apps/api/src/routes/pusd.ts`.
- PUSD token adapter is read-only: verified. It only calls `getParsedTokenAccountsByOwner`.
- Missing token accounts become zero balance: verified. Empty RPC account list reduces to `0n`.
- Invalid PUSD config fails closed: `packages/config/src/env.ts` requires mint and decimals when `VAULT_BASE_ASSET=PUSD`; token reader invalid input returns zero with `invalid_input`.
- `PUSD_MINT` is not hardcoded as unknown production value in config; demo fixtures/scripts use demo values only.
- `PUSD_DECIMALS` validates integer 0-18.
- PUSD operator intents write audit events and include `liveExecutionDisabled: true`.
- Docs and dashboard generally do not claim live PUSD execution.

## Encrypt Audit

- `ENCRYPT_ENABLED` defaults false and `ENCRYPT_SDK_MODE` defaults `adapter`.
- SDK pre-alpha requires both acknowledgement strings plus endpoint/public key.
- `productionPrivacyReady=false` and `realEncryption=false` are consistently surfaced in API, DB schema, runtime types, SDK evidence, docs, and dashboard.
- SDK demo input is deterministic and non-sensitive (`sdk-demo-input.ts`).
- API rejects arbitrary plaintext strategy payloads on SDK demo endpoint and forbidden fields on Encrypt endpoints.
- SDK demo endpoint is API-key plus operator-HMAC protected.
- SDK evidence sanitizes errors into code/message and records success/failure visibly.
- Dashboard shows status/evidence and does not claim production privacy.
- Root validation passed without live SDK network dependency because tests were cached and default mode is adapter/disabled.

## API Mutating Endpoint Audit

All routes are globally or per-route API-key protected except `/health` and `/readyz`. Operator HMAC is required on high-risk operator actions.

| Route group | Mutating endpoints | Auth | Validation | Audit | Risk | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Runtime | `POST /api/v1/runtime/cycle`, pause/resume/halt/command/recovery endpoints | API key; operator role on protected control actions | Mixed manual validation | Runtime audit/store events | Medium | No signing path; malformed bodies generally handled but not uniformly schema-driven. |
| Control | `POST /api/v1/control/pause`, `/resume`, `/halt` | API key + operator | Manual | Runtime command/audit | Medium | Execution gated by runtime flags. |
| PUSD | `POST /deposit-intent`, `/withdraw-intent`, `/rebalance-intent` | API key + operator | Manual positive amount and forbidden fields | Yes | Low | Intent only; live execution disabled. |
| Encrypt | `POST /strategy-state`, `/strategy-state/update`, `/reveal-request`, `/sdk-demo/create-input` | API key + operator | Manual object/forbidden field validation | Yes | Low/Medium | SDK mode can call pre-alpha network if explicitly enabled. |
| Allocator | approve/reject/evaluate/recovery/escalation endpoints | API key; operator required for approvals/transitions | Mixed | Yes via store/control-plane | Medium | No direct signing. |
| Carry/Treasury | evaluate, approve, execute actions | API key; operator for approvals/execution | Mixed | Yes | Medium | Execution still gated; simulated/PUSD paths block live. |
| Venues | connector promotion/posture/snapshot mutations | API key; operator where applicable | Mixed | Yes | Medium | No direct signing found. |
| Submission/Ranger | dossier/evidence and Ranger create/init/allocate/metadata | API key + operator for mutating Ranger routes | Mixed | Yes | High if Ranger private key env is set | Keep Ranger signer env unset for PUSD/Encrypt demo. |
| CEX verification | session import/validate/calculate/patch/delete/report | API key; some operator actions | Mixed with CSV validation | Store records | Medium | Read/report workflow; no secret storage except statuses. |
| Backtest | `POST /api/v1/backtest` | API key | Manual | No durable audit | Low | Simulation only. |
| Vault | deposits/redemptions | API key/operator | Mixed | Store records | Medium | Demo/accounting path. |

## Dashboard Audit

| Page/route | Purpose | Backend dependency | Env vars | Risk | Notes |
| --- | --- | --- | --- | --- | --- |
| `/sign-in`, `/api/auth/login`, `/api/auth/logout` | Operator auth | Postgres | `DATABASE_URL`, session vars | High | HttpOnly cookie; no rate limit or CSRF token. |
| `/api/{runtime,allocator,carry,treasury,venues,submission,encrypt}/...` | Server-side proxy | Render API | `OPS_DASHBOARD_API_BASE_URL`/`NEXT_PUBLIC_API_BASE_URL`, `OPS_DASHBOARD_API_KEY`, `OPS_AUTH_SHARED_SECRET` | Medium | API key remains server-only; signs operator headers. Missing CSRF token. |
| `/pusd` | PUSD vault/intents view | API PUSD routes | Same proxy env | Low | Shows live execution disabled; loading/error handled by SSR error components. |
| `/encrypt` | Encrypt status/state/evidence | API Encrypt routes | Same proxy env plus backend Encrypt env | Low | Shows pre-alpha and false privacy claims clearly. |
| Operational pages | Runtime, allocator, carry, treasury, venues, submission, CEX | API route groups | Same proxy env | Medium | Production broken if backend URL/API key/session DB missing. |
| `/api/deployment/status` | Health/readiness proxy | Render API | backend URL | Medium | Does not include API key; backend health/readyz are public. |

## Runtime/Worker Audit

- Worker should be a separate Render background worker only when a continuously updated demo is desired. API can run without it, but `/readyz` will be degraded/stale.
- Worker requires `DATABASE_URL`, `NODE_ENV`, `API_SECRET_KEY` indirectly through config, execution flags, and `RUNTIME_WORKER_CYCLE_INTERVAL_MS`.
- Scheduler interval defaults to 60000 ms; invalid values below 1000 throw.
- Runtime applies migrations on startup and honors halt/pause state in store.
- PUSD mode switches sleeve to treasury, skips simulated carry venues, and does not initialize Jupiter.
- Live execution requires both `EXECUTION_MODE=live` and `FEATURE_FLAG_LIVE_EXECUTION=true`, but current deployment should keep both dry/false.
- Idempotency risk: two workers against one DB can race cycles. Deploy at most one worker.

## DB/Migration Audit

- Migration command: `pnpm --filter @sentinel-apex/db build && node packages/db/dist/migrate.js` from repo root, or `pnpm --filter @sentinel-apex/db exec tsx src/migrate.ts` in dev.
- `DATABASE_URL` is required and must be a URL for app config; migrations throw if absent.
- Migrations run automatically in API/control-plane and worker startup; dashboard also runs migrations outside production.
- First deployment can fail if migrations are not available in deployed package or if API/worker run migrations concurrently.
- PUSD and Encrypt tables/columns match schema; common query indexes exist for IDs and timestamps.
- JSONB evidence fields are flexible but rely on runtime mapping discipline.

## Remaining Unknowns

- Render’s exact workspace behavior with `rootDir: apps/api` was not executed against Render; local evidence strongly indicates repo-root build is safer.
- The untracked `Encrypt Developer Guide.pdf` was not audited.
- Dependency vulnerability audit was not run; no network access was used.
