# Sentinel Apex

Sentinel Apex is an operator-run Solana yield protocol and control plane for a
USDC-denominated delta-neutral carry vault. The repository includes the internal
API, runtime worker, ops dashboard, strategy engine, risk engine, treasury
sleeve, allocator, venue truth adapters, controlled carry execution, and
protocol-native vault accounting.

The current in-repo vault profile is:

- Vault: `Apex USDC Delta-Neutral Carry Vault`
- Strategy: `Apex USDC Delta-Neutral Carry`
- Base asset: `USDC`
- Tenor: 3-month rolling lock
- Reassessment cadence: every 3 months
- Target APY floor: `10%`

## Protocol

Sentinel Apex is designed around one constrained carry product:

- Capital is modeled as a USDC vault with depositor records, deposit lots, lock
  expiry, redemption eligibility, and share accounting.
- Strategy policy is explicit and fails closed when the product drifts outside
  the allowed Build-A-Bear posture.
- Carry deployment is gated by runtime health, risk checks, venue capability,
  promotion/readiness evidence, and operator approval.
- Treasury and allocator logic remain separate from carry deployment so capital
  routing, execution, and recovery are auditable.

### Strategy Constraints

- Allowed yield profile: delta-neutral carry / basis-style funding capture
- Disallowed yield sources: DEX LP, junior tranche, insurance pool, circular
  stable-yield dependency
- Leverage metadata must be explicit when leverage is present
- Unsafe looping below health rate `1.05` on non-hardcoded oracle dependencies
  is blocked

## System Surfaces

### Applications

- `apps/api`: authenticated control-plane and read API
- `apps/runtime-worker`: scheduled runtime execution and command processing
- `apps/ops-dashboard`: internal operator dashboard

### Core Packages

- `packages/runtime`: persistence, orchestration, reconciliation, worker state
- `packages/carry`: strategy policy, opportunity detection, controlled execution
  planning
- `packages/strategy-engine`: signal pipeline and intent generation
- `packages/risk-engine`: risk checks and circuit-breaker logic
- `packages/allocator`: sleeve budgeting and rebalance planning
- `packages/treasury`: treasury policy and execution planning
- `packages/venue-adapters`: simulated, read-only, and narrow real-execution
  connectors
- `packages/db`: schema, migrations, and DB client

## Vault Model

The protocol now exposes first-class internal vault state:

- vault summary
- depositor registry
- deposit lots with mint price and lock expiry
- redemption requests with eligibility timing

Primary authenticated vault routes:

- `GET /api/v1/vault`
- `GET /api/v1/vault/depositors`
- `GET /api/v1/vault/deposits`
- `GET /api/v1/vault/redemptions`
- `POST /api/v1/vault/deposits`
- `POST /api/v1/vault/redemptions`

Vault accounting is internal and operator-managed. This repo does not claim
on-chain vault token issuance.

## Execution Model

Dry-run is the default mode. Live execution is opt-in and separately gated.

Current in-repo connector scope:

- `drift-solana-readonly`: real, read-only Drift truth
- `drift-solana-devnet-carry`: real execution-capable connector for a narrow
  path only

Current real execution scope:

- devnet only
- carry sleeve only
- BTC-PERP only
- market orders only
- single-market open / add / reduce semantics only

Current real execution does not provide:

- mainnet deployment
- generic order entry
- generic Ranger integration
- treasury live execution
- multi-leg carry orchestration
- CEX execution connectors

## API Domains

The API is organized by protocol concern:

- `/api/v1/portfolio`: portfolio summary, snapshots, PnL
- `/api/v1/vault`: vault accounting and redemption timing
- `/api/v1/carry`: strategy profile, recommendations, actions, executions
- `/api/v1/treasury`: treasury policy, actions, executions
- `/api/v1/allocator`: allocator decisions, targets, rebalance workflow
- `/api/v1/venues`: venue truth, readiness, comparison, promotion
- `/api/v1/runtime`: runtime state, commands, reconciliation, mismatch workflows
- `/api/v1/control`: kill switch and mode controls

## Local Development

Minimum environment:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
export API_SECRET_KEY=replace-with-at-least-32-characters
export OPS_AUTH_SHARED_SECRET=replace-with-at-least-32-characters
export EXECUTION_MODE=dry-run
export FEATURE_FLAG_LIVE_EXECUTION=false
export DRIFT_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
export DRIFT_READONLY_ENV=mainnet-beta
export DRIFT_READONLY_ACCOUNT_ADDRESS=replace-with-a-drift-user-account-public-key
export DRIFT_READONLY_SUBACCOUNT_ID=0
export RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000
```

Optional devnet execution environment for the narrow real connector:

```bash
export EXECUTION_MODE=live
export FEATURE_FLAG_LIVE_EXECUTION=true
export DRIFT_RPC_ENDPOINT=https://api.devnet.solana.com
export DRIFT_READONLY_ENV=devnet
export DRIFT_EXECUTION_ENV=devnet
export DRIFT_PRIVATE_KEY=replace-with-devnet-secret-key
export DRIFT_EXECUTION_SUBACCOUNT_ID=0
export DRIFT_EXECUTION_ACCOUNT_LABEL="Hackathon Devnet Carry"
```

Bootstrap the local stack:

```bash
pnpm db:start
pnpm db:health
pnpm db:migrate
pnpm --filter @sentinel-apex/api dev
pnpm --filter @sentinel-apex/runtime-worker dev
PORT=3100 pnpm --filter @sentinel-apex/ops-dashboard dev
```

Run one deterministic cycle directly:

```bash
pnpm --filter @sentinel-apex/runtime dev:run-cycle
```

Rebuild projections:

```bash
pnpm --filter @sentinel-apex/runtime dev:rebuild-projections
```

## Validation

Canonical validation commands:

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Preferred repo-wide entrypoints:

```bash
pnpm validate
pnpm validate:ci
pnpm release:check
```

## Current Boundaries

Sentinel Apex is materially stronger than a mockup, but it is not a complete
production deployment stack yet.

- No Ranger/Earn integration is implemented in source.
- No mainnet live carry connector is implemented.
- The only real execution path is Drift devnet BTC-PERP market execution for a single perp leg.
- No CEX execution adapters are implemented.
- No generic on-chain vault tokenization is implemented.
- No historical backtest package is implemented.

Use the repo as an honest protocol/control-plane implementation with explicit
boundaries, not as a claim that unsupported scope already exists.
