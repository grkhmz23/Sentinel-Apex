# Deployment Environment Matrix

Date: 2026-05-11

Legend: required means required for that service to start/use the relevant feature. Secret means do not expose to browser or logs.

| Env var | Used by | Required/default | Example | Secret | Render API | Render Worker | Vercel Dashboard | Local/Codespaces | Validation/notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | all | required by config | `staging`, `production`, `development` | no | yes | yes | yes | yes | Must be `development`, `staging`, `production`, or `test`. |
| `LOG_LEVEL` | config/logger | default `info` | `info` | no | yes | yes | optional | yes | Code enum accepts `debug/info/warn/error`; `.env.example` lists more than code accepts. |
| `EXECUTION_MODE` | API/worker/runtime | default `dry-run` | `dry-run` | no | yes | yes | displayed indirectly | yes | Keep `dry-run` for demo. |
| `FEATURE_FLAG_LIVE_EXECUTION` | API/worker/runtime | default false | `false` | no | yes | yes | displayed indirectly | yes | Keep false. |
| `SENTINEL_ENVIRONMENT_LABEL` | readiness/banner | default `staging demo` | `staging demo` | no | yes | yes | server status | yes | Code uses in shared deployment profile; not config-validated. |
| `SENTINEL_EXECUTION_BADGE` | readiness/banner | default `dry-run only` | `dry-run only` | no | yes | yes | server status | yes | Current build must not claim live execution. |
| `API_PORT` | API | default 3000 | `10000` | no | yes | no | no | yes | Render also sets `PORT`; API code uses `API_PORT`, so set `API_PORT=10000`. |
| `PORT` | platform/possible docs | not read by API code | `10000` | no | platform | no | platform | optional | Docs/platform-only; missing in code for API. |
| `API_SECRET_KEY` | API auth/config | required outside test, min 32 chars | generated 64-byte hex | yes | yes | yes via config startup | no, use dashboard API key instead | yes | Same value as `OPS_DASHBOARD_API_KEY` on Vercel. |
| `CORS_ORIGIN` | API CORS | required in production; local default localhost origins | `https://your-app.vercel.app` | no | yes | no | no | optional | Comma-separated origins. Wildcard rejected. |
| `DATABASE_URL` | API, worker, dashboard, db scripts | required | Render Postgres internal URL | yes | yes | yes | yes | yes | Dashboard sessions use DB. |
| `DB_POOL_MIN` | config | default 2 | `2` | no | optional | optional | no | optional | Must be <= `DB_POOL_MAX`. |
| `DB_POOL_MAX` | config | default 10 | `10` | no | optional | optional | no | optional | Pool size. |
| `DB_SSL` | config | default false | `true` | no | as needed | as needed | no | optional | Config-validates; actual DB client behavior should be confirmed for Render. |
| `METRICS_ENABLED` | config | default false | `false` | no | optional | optional | no | optional | `.env.example` sets true; confirm metrics server usage before public deploy. |
| `METRICS_PORT` | config | default 9090 | `9090` | no | optional | optional | no | optional | Valid port. |
| `ALERT_WEBHOOK_URL` | config | optional | webhook URL | yes | optional | optional | no | optional | URL-validated. |
| `NEXT_PUBLIC_API_BASE_URL` | dashboard server/client env fallback | required if `OPS_DASHBOARD_API_BASE_URL` unset | `https://sentinel-apex-api.onrender.com` | no | no | no | yes | yes | Public; do not put API key here. |
| `NEXT_PUBLIC_ENVIRONMENT_LABEL` | dashboard banner | optional | `staging demo` | no | no | no | yes | yes | Public. |
| `NEXT_PUBLIC_EXECUTION_BADGE` | dashboard banner | optional | `dry-run only` | no | no | no | yes | yes | Public; current build must not claim live execution. |
| `OPS_DASHBOARD_API_BASE_URL` | dashboard server routes | optional preferred | `https://sentinel-apex-api.onrender.com` | no | no | no | yes | yes | Server-only backend URL. |
| `OPS_DASHBOARD_API_KEY` | dashboard proxy | required for proxy | same as backend `API_SECRET_KEY` | yes | no | no | yes | yes | Server-only. |
| `OPS_AUTH_SHARED_SECRET` | API operator auth + dashboard signing | required for API startup and proxy | generated 64-byte hex | yes | yes | no unless worker uses protected API, currently no | yes | yes | Must match API and Vercel. |
| `OPS_DASHBOARD_ORIGIN` | dashboard mutating route Origin/Referer guard | required in production; local fallback request origin | `https://sentinel-apex.vercel.app` | no | no | no | yes | optional | Must exactly match production dashboard origin. |
| `OPS_DASHBOARD_SESSION_COOKIE_NAME` | dashboard | default `sentinel_apex_ops_session` | same | no | no | no | optional | optional | Server cookie name. |
| `OPS_DASHBOARD_SESSION_TTL_HOURS` | dashboard | default 12 | `12` | no | no | no | optional | optional | Integer 1-168. |
| `OPS_DASHBOARD_DEFAULT_SIGN_IN_EMAIL` | dashboard sign-in UI | optional | operator email | no | no | no | optional | optional | Convenience only. |
| `VAULT_BASE_ASSET` | config/runtime/store | default `USDC` | `PUSD` | no | yes | yes | no | yes | PUSD requires mint/decimals. |
| `USDC_MINT` | config/runtime/store | optional | Solana pubkey | no | optional | optional | no | optional | Undocumented in `.env.example` except code; deployment risk if USDC mode needs real mint. |
| `USDC_DECIMALS` | config/runtime/store | default 6 | `6` | no | optional | optional | no | optional | 0-18. |
| `PUSD_MINT` | config/runtime/store | required when PUSD | Solana pubkey | no | yes if PUSD | yes if PUSD | no | yes if PUSD | No unknown live mint hardcoded. |
| `PUSD_DECIMALS` | config/runtime/store | required when PUSD | `6` | no | yes if PUSD | yes if PUSD | no | yes if PUSD | Integer 0-18. |
| `PUSD_VAULT_OWNER` | runtime/store | optional | Solana pubkey | no | optional | optional | no | optional | If unset, snapshots show zero/unconfigured. |
| `SOLANA_RPC_ENDPOINT` | PUSD reader, Jupiter fallback, Ranger fallback | optional | `https://api.devnet.solana.com` | maybe | optional | optional | no | optional | Needed for PUSD live read-only balance checks. |
| `ENCRYPT_ENABLED` | config/runtime/API | default false | `false` | no | yes | yes | no | yes | true requires pre-alpha ack and program ID. |
| `ENCRYPT_CLUSTER` | config/runtime/API | default devnet | `devnet` | no | optional | optional | no | optional | devnet/testnet/mainnet-beta. |
| `ENCRYPT_PROGRAM_ID` | config/runtime/API | required if Encrypt enabled | Solana pubkey | no | if enabled | if enabled | no | if enabled | `.env.example` has demo program ID. |
| `ENCRYPT_CONFIG_PDA` | config/runtime/API | optional | Solana pubkey | no | optional | optional | no | optional | Public address. |
| `ENCRYPT_NETWORK_ENCRYPTION_KEY` | config/runtime/API | optional | Solana pubkey | no | optional | optional | no | optional | Name says key but validator treats as public key; clarify before production. |
| `ENCRYPT_PRE_ALPHA_ACK` | config/API | required if Encrypt enabled | exact ack string | no | if enabled | if enabled | no | if enabled | Must equal `I_UNDERSTAND_ENCRYPT_PRE_ALPHA_IS_NOT_PRODUCTION_PRIVACY`. |
| `ENCRYPT_SDK_MODE` | config/runtime/API | default `adapter` | `adapter` | no | optional | optional | no | optional | `sdk-prealpha` requires extra ack/config. |
| `ENCRYPT_GRPC_ENDPOINT` | config/SDK | required in sdk-prealpha | `pre-alpha-dev-1.encrypt.ika-network.net:443` | no | sdk only | sdk only | no | sdk only | Host:port validation. |
| `ENCRYPT_SOLANA_RPC_URL` | config/runtime metadata | optional | `https://api.devnet.solana.com` | no | optional | optional | no | optional | URL-validated if set. |
| `ENCRYPT_NETWORK_ENCRYPTION_PUBLIC_KEY` | config/SDK | required in sdk-prealpha | Solana pubkey | no | sdk only | sdk only | no | sdk only | Public key. |
| `ENCRYPT_SDK_DEMO_ACK` | config/API | required in sdk-prealpha | exact ack string | no | sdk only | sdk only | no | sdk only | Must equal `I_UNDERSTAND_ENCRYPT_SDK_PREALPHA_USES_NON_SENSITIVE_DEMO_DATA_ONLY`. |
| `ENCRYPT_SDK_STRICT` | config/service | default false | `false` | no | optional | optional | no | optional | If true, SDK demo failure throws. |
| `JUPITER_PERPS_ENABLED` | config/runtime | default false | `false` | no | yes, false | yes, false | no | yes | PUSD mode ignores Jupiter even if true. |
| `JUPITER_PERPS_NETWORK` | config/runtime | default devnet | `devnet` | no | optional | optional | no | optional | Keep disabled. |
| `JUPITER_PERPS_RPC_ENDPOINT` | config/runtime | optional | devnet RPC | no | optional | optional | no | optional | Only if Jupiter enabled in non-PUSD. |
| `JUPITER_PERPS_API_ENDPOINT` | config/runtime | optional default Jup API | URL | no | optional | optional | no | optional | Only if Jupiter enabled. |
| `JUPITER_PERPS_PRIVATE_KEY` | config/runtime | optional | never for demo | yes | no | no | no | no | Do not set for PUSD/Encrypt demo. |
| `JUPITER_PERPS_SUBACCOUNT_ID` | config/runtime | default 0 | `0` | no | optional | optional | no | optional | Only if Jupiter enabled. |
| `JUPITER_PERPS_ACCOUNT_LABEL` | config/runtime | optional | label | no | optional | optional | no | optional | Only if Jupiter enabled. |
| `RUNTIME_WORKER_CYCLE_INTERVAL_MS` | worker | default 60000 | `60000` | no | no | yes | no | optional | >= 1000. |
| `RUNTIME_SIMULATION_REPLAY_LIMIT` | runtime | default 1000 | `1000` | no | optional | optional | no | optional | `0` means no limit. Undocumented. |
| `RANGER_RPC_ENDPOINT` | control-plane Ranger | optional fallback Solana RPC | URL | no | only if Ranger routes | no | no | optional | Not PUSD/Encrypt demo. |
| `RANGER_ADMIN_PRIVATE_KEY` | control-plane Ranger | optional | JSON secret-key bytes | yes | no for demo | no | no | no | Signing material; do not set for demo. |
| `RANGER_MANAGER_PRIVATE_KEY` | control-plane Ranger | optional | JSON secret-key bytes | yes | no for demo | no | no | no | Signing material; do not set for demo. |
| `RANGER_DEFAULT_ADAPTOR_PROGRAM_ID` | control-plane Ranger | optional | Solana pubkey | no | only if Ranger | no | no | optional | Not PUSD/Encrypt demo. |
| `BOOTSTRAP_OPERATOR_ENABLED` | one-time bootstrap script | required as `true` to run | `true` | no | manual only | no | no | manual only | Script fails closed unless true. Do not set as persistent service env. |
| `BOOTSTRAP_OPERATOR_EMAIL` | one-time bootstrap script | required when bootstrap enabled | `operator@example.com` | no | manual only | no | no | manual only | No hardcoded operator email remains. |
| `BOOTSTRAP_OPERATOR_PASSWORD` | one-time bootstrap script | required when bootstrap enabled, min 12 chars | generated password | yes | manual only | no | no | manual only | Never printed. Do not commit or store as persistent env after use. |
| `CI` | vitest configs | optional | `1` | no | build/test only | build/test only | build/test only | optional | Test reporter switch. |
| `COVERAGE` | vitest configs | optional | `1` | no | test only | test only | test only | optional | Test coverage switch. |

Docs-only or stale references to `DRIFT_*`, `LIVE_CARRY_API_KEY`, `FRONTEND_BASE_URL`, `BACKEND_BASE_URL`, `TRADING_MODE`, `PAPER_MODE`, `LIVE_TRADING_CONFIRMATION`, and `PORT` appear in older docs/scripts but are not part of the current PUSD/Encrypt runtime config path. Treat them as docs-only unless reintroduced in code.
