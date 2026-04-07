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

**IMPORTANT: Drift protocol adapters have been removed due to hackathon eligibility requirements. The Drift protocol was compromised and strategies using Drift are disqualified from prize consideration.**

**Jupiter Perpetuals has been integrated as the replacement execution venue.**

Dry-run is the default mode. Live execution is available on Jupiter Perps devnet.

Current execution scope:

- **Jupiter Perpetuals devnet** - BTC-PERP, ETH-PERP, SOL-PERP
- **USDC collateral** - Matches vault base asset requirement
- Backtesting framework for strategy validation
- Multi-leg carry orchestration framework

Blocked execution scope:

- Mainnet execution (devnet only for hackathon)
- Drift protocol (disqualified)
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
export SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
export JUPITER_PERPS_ENABLED=true
export JUPITER_PERPS_NETWORK=devnet
export JUPITER_PERPS_RPC_ENDPOINT=https://api.devnet.solana.com
export RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000
```

**Jupiter Perps devnet execution:** Set `EXECUTION_MODE=live` and `FEATURE_FLAG_LIVE_EXECUTION=true` to enable real execution on Jupiter Perps devnet.

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

### Implemented (Phase R1 - Ranger + Vault Foundation)

- ✅ **Ranger integration layer** (`packages/ranger`) with:
  - Vault client for lifecycle operations (create, deposit, withdraw, NAV)
  - Strategy adapter for delta-neutral carry strategies
  - Simulated mode for development/testing
  - Full TypeScript types and interfaces
  - Comprehensive test coverage (19 tests passing)
- ✅ **On-chain vault database schema** for:
  - Vault addresses and program IDs
  - On-chain deposit/withdrawal receipts
  - Ranger integration state tracking
  - Submission verification tracking

### Implemented (Phase R2 - Execution + Multi-Leg Orchestration)

- ✅ **Multi-leg carry orchestration** (`packages/carry`):
  - Multi-leg plan creation with dependency management
  - Leg sequencing and execution ordering
  - Hedge deviation tracking for delta-neutral positions
  - Partial failure handling (continue/rollback/wait)
  - Database schema for plan/leg persistence
  - 82 tests passing
- ✅ **Execution guardrails** (`packages/risk-engine`):
  - Kill switch for emergency execution halt
  - Circuit breaker for failure tolerance
  - Notional limits (max/min, daily, position)
  - Concurrency limits
  - Partial fill policies
  - Scoped configurations (global/venue/sleeve/strategy)
  - 146 tests passing
- ✅ **Database schema** (Migration 0027):
  - Multi-leg plan and leg execution tables
  - Hedge state tracking
  - Guardrail configuration and violations

### Implemented (Phase R3 - Submission Dossier + Performance Reporting)

- ✅ **CEX verification pipeline** (`packages/cex-verification`):
  - CSV import for Binance, OKX, Bybit, Coinbase trade history
  - PnL calculation with FIFO, LIFO, and Average Cost methods
  - Read-only API verification (OKX implemented)
  - Cross-validation with internal signals
  - 26 tests passing
- ✅ **Submission dossier system** (`packages/runtime`):
  - Vault identity and on-chain address tracking
  - Strategy configuration and eligibility evidence
  - Execution evidence with real vs simulated labeling
  - Multi-leg execution evidence with hedge state
  - Completeness assessment with category breakdown
  - Missing evidence tracking (truthful about gaps)
  - 66 tests passing
- ✅ **Performance reports** (`packages/runtime`):
  - Date-range configurable report generation
  - JSON (machine-readable) and Markdown (human-readable) formats
  - Execution summary with notional and APY
  - Multi-leg execution summary with completion rates
  - Hedge deviation statistics
  - Explicit truth labels (devnet/simulated/backtest)
  - Missing data visibility (never hidden)
- ✅ **API endpoints** (`apps/api`):
  - `GET /api/v1/submission` - Dossier summary
  - `GET /api/v1/submission/completeness` - Completeness assessment
  - `POST /api/v1/submission/report` - Generate performance report
  - `GET /api/v1/submission/reports` - List reports
  - `GET /api/v1/submission/report/:id` - Get specific report
  - `POST /api/v1/submission/multi-leg-evidence` - Record ML evidence
  - `GET /api/v1/submission/export` - Export judge bundle
- ✅ **Dashboard** (`apps/ops-dashboard`):
  - Submission profile page with readiness checks
  - Supported/blocked scope visibility
  - Verification evidence panel
  - Export bundle artifact checklist
- ✅ **Database schema** (Migration 0028):
  - Performance reports table with metadata
  - Multi-leg evidence summary table
  - Submission evidence categories reference data

### Implemented (Phase R4 - Backtesting + Final Polish)

- ✅ **Backtesting framework** (`packages/backtest`):
  - Historical simulation for delta-neutral carry strategies
  - Deterministic run configuration
  - Funding rate and basis replay
  - Performance metrics (return, drawdown, Sharpe)
  - Trade statistics and funding capture analysis
  - Truthful labeling as "historical_simulation"
  - Exportable reports (JSON, Markdown, CSV)
  - Integrated with submission evidence system
  - API endpoint: `POST /api/v1/backtest/run`
- ✅ **Devnet demo runbook** (`docs/runbooks/hackathon-demo-runbook.md`):
  - Step-by-step reproducible demo flow
  - Prerequisite checklist
  - Environment validation steps
  - Expected outcome artifacts
  - Troubleshooting guide
- ✅ **Final truthfulness sweep**:
  - All docs audited for honest claims
  - No mainnet execution claimed
  - Backtests clearly labeled as simulations
  - Devnet status explicitly stated

### Blockers / Not Yet Available

- 🔴 **Ranger SDK integration** - External blocker: Ranger SDK/program IDs not publicly available
  - Integration boundary implemented and ready
  - Simulated mode available for development
- 🔴 **All live execution venues** - Drift protocol compromised and disqualified from hackathon
  - Drift adapters removed from codebase
  - Alternative venue adapters pending integration
- ✅ **Multi-leg runtime integration** - Complete as of Phase R3 Part 4
- 🔴 **CEX execution adapters** - Not implemented (optional for submission)
- 🔴 **On-chain vault program** - Needs Ranger SDK or custom Solana program

## Hackathon Submission Workflow

The repo now supports producing credible hackathon submission packages:

### For Operators

1. **Configure vault addresses** via `POST /api/v1/submission`
2. **Run backtests** to validate strategy performance
3. **Check completeness** via `GET /api/v1/submission/completeness`
4. **Generate performance report** via `POST /api/v1/submission/report`
5. **Record strategy evidence** (backtest results, simulation data)
6. **Export submission bundle** via `GET /api/v1/submission/export`

### For Judges

The export bundle includes:
- Vault and wallet addresses with Solscan links
- Execution evidence with transaction references
- Performance report with truthful labels
- Multi-leg proof with hedge deviation
- Artifact checklist with pass/warn/fail status

### Truthfulness Guarantees

Every report explicitly labels:
- **Simulated executions**: Mock venue execution
- **Backtests**: Historical simulation
- **Missing data**: Explicitly listed, never hidden
- **Live execution status**: Not available (Drift protocol disqualified)

See `docs/runbooks/submission-dossier.md` for detailed workflow.
- 🔴 **Historical backtest package** - Not implemented

### Current Execution Capability

**Simulation Only**:
- All execution is dry-run / simulated
- Backtesting framework for historical simulation
- No live venue adapters configured

**Infrastructure Ready**:
- Multi-leg orchestration types and logic
- Execution guardrails with kill switch
- Database schema for coordination

Use the repo as an honest protocol/control-plane implementation with explicit
boundaries, not as a claim that unsupported scope already exists.

See [Phase R1 Architecture](/docs/architecture/phase-r1-ranger-vault-foundation.md) and [Phase R2 Completion Report](/docs/audit/phase-r2-completion-report.md) for details.
