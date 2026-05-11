# Sentinel Apex

Sentinel Apex is an operator-run control plane for vault accounting, risk-managed
strategy operations, treasury workflows, allocator decisions, venue readiness,
and submission evidence. The system is built as a TypeScript monorepo with a
Fastify API, a Next.js operator dashboard, a runtime worker, Drizzle/Postgres
persistence, and domain packages for carry, treasury, risk, allocation, venue
adapters, PUSD, and Encrypt pre-alpha strategy-state evidence.

The current public demo is intentionally dry-run only. It supports PUSD
accounting and operator intents, Encrypt pre-alpha strategy-state workflows, and
auditable runtime evidence. It does not enable PUSD live execution, signing,
`sendTransaction`, mainnet trading, Ika, production privacy, or real encryption
claims.

## Product Overview

Sentinel Apex gives an operator a single system for monitoring and controlling a
vault strategy lifecycle:

- Account for vault assets, deposit lots, redemption timing, treasury state, and
  operator intents.
- Evaluate carry, treasury, allocator, and risk decisions before any action is
  considered executable.
- Keep execution posture explicit with dry-run, simulated, read-only, blocked,
  and evidence-only states.
- Track venue readiness, connector promotion, reconciliation findings, mismatch
  recovery, and operational escalations.
- Produce submission-ready evidence with clear truth labels for simulated runs,
  backtests, missing data, and blocked production scope.
- Surface all major workflows through an internal operator dashboard and
  authenticated API.

## Core Products

### PUSD Vault and Treasury State

PUSD is implemented as a first-class vault base asset for the current demo. The
PUSD product supports accounting, read-only balance checks, treasury state,
operator intent capture, runtime/API integration, and dashboard visibility.

Features:

- PUSD base-asset configuration through validated environment settings.
- Vault summary, treasury state, snapshots, and read-only token balance checks.
- Missing token accounts treated as zero balance rather than runtime crashes.
- Deposit, withdrawal, and rebalance intent workflows.
- Operator-authenticated PUSD mutations.
- Audit records for operator intents.
- Runtime and dashboard evidence showing live execution is disabled.
- Safety rejection for private keys, seed phrases, mnemonics, wallet JSON, and
  signing material in PUSD API payloads.

Current boundary:

- PUSD live execution is disabled.
- PUSD does not submit orders.
- PUSD does not sign transactions.
- PUSD does not call `sendTransaction`.
- Jupiter Perps is disabled in PUSD mode.

### Encrypt Pre-Alpha Strategy State

Encrypt is integrated as a pre-alpha strategy-state evidence layer. It is used to
represent a controlled public/private split for strategy-state records without
claiming production confidentiality.

Features:

- Encrypt enablement is explicit and defaults off.
- Adapter mode is the default SDK mode.
- SDK pre-alpha mode requires explicit acknowledgement flags.
- Strategy-state creation and update workflows.
- Reveal request and audit surfaces.
- Deterministic non-sensitive SDK demo inputs.
- Sanitized SDK demo evidence for success and failure paths.
- Dashboard pages for Encrypt status, strategy-state evidence, public fields,
  private-state references, and safety posture.
- API guards that reject arbitrary plaintext production strategy payloads and
  forbidden signing/key material fields.

Current boundary:

- `productionPrivacyReady=false`.
- `realEncryption=false`.
- SDK demo data is deterministic and non-sensitive.
- Encrypt does not enable PUSD movement, signing, `sendTransaction`, live
  trading, or Ika.

### Operator Dashboard

The operator dashboard is the primary control surface for reviewing strategy
state, vault status, allocator decisions, treasury actions, venue posture,
submission evidence, and runtime health.

Features:

- PUSD vault page with accounting state, snapshots, safety indicators, and
  operator intents.
- Encrypt page with pre-alpha readiness, strategy-state evidence, and SDK demo
  status.
- Runtime overview with cycle state, commands, health, pause/resume/halt
  controls, reconciliation, and mismatch workflows.
- Allocator pages for target allocations, rebalance proposals, recovery
  candidates, escalation handling, and approval workflows.
- Treasury pages for policy, action recommendations, approvals, execution
  history, and venue readiness.
- Carry pages for strategy profile, recommendations, actions, executions, and
  venue state.
- Venue pages for inventory, readiness, promotion workflow, snapshots, and
  internal-versus-external truth comparisons.
- Submission pages for readiness checks, evidence categories, export bundles,
  performance reports, and judge-facing completeness.
- Authenticated operator sessions with HttpOnly cookies.
- Server-side API proxy signing for protected backend operations.
- Production Origin/Referer checks on mutating dashboard route handlers.
- Demo login rate limiting by email and IP.

### Backend API

The API is the authenticated backend for dashboard, runtime, vault, treasury,
allocator, submission, carry, venue, and Encrypt/PUSD workflows.

API domains:

- `/api/v1/health` and `/readyz`: service and runtime readiness.
- `/api/v1/pusd`: PUSD vault state, treasury state, snapshots, and operator
  intents.
- `/api/v1/encrypt`: Encrypt pre-alpha status, strategy-state records, reveal
  requests, audits, and SDK demo evidence.
- `/api/v1/vault`: internal vault accounting, depositors, deposit lots, and
  redemption requests.
- `/api/v1/portfolio`: portfolio summary, snapshots, and PnL surfaces.
- `/api/v1/runtime`: runtime state, cycles, commands, reconciliation, mismatch
  recovery, and operational history.
- `/api/v1/control`: pause, resume, halt, and mode controls.
- `/api/v1/allocator`: allocator decisions, targets, proposals, approvals,
  recovery, and escalations.
- `/api/v1/treasury`: treasury policy, actions, approvals, executions, and venue
  readiness.
- `/api/v1/carry`: carry strategy profile, recommendations, actions,
  executions, and evidence.
- `/api/v1/venues`: venue inventory, readiness, connector promotion, snapshots,
  and comparison data.
- `/api/v1/submission`: submission dossier, completeness, reports, evidence,
  and export bundles.
- `/api/v1/backtest`: historical simulation entrypoints for strategy evidence.

Security posture:

- API key protection for backend routes.
- Operator HMAC authorization for sensitive operator actions.
- Production CORS fail-closed behavior.
- Runtime validation on critical request bodies.
- Explicit rejection of forbidden signing material in PUSD and Encrypt paths.
- Safe error handling with correlation identifiers.

### Runtime Worker and Control Plane

The runtime package and worker coordinate scheduled cycles, command processing,
strategy evidence, reconciliation, mismatch handling, and projection rebuilds.

Features:

- Runtime cycle orchestration.
- Worker metadata and health state.
- Pause, resume, halt, and command lifecycle handling.
- Carry evaluation and controlled execution planning.
- Treasury evaluation and action tracking.
- Allocator target calculation and rebalance proposal lifecycle.
- PUSD mode support without live order submission.
- Encrypt pre-alpha state creation during configured demo flows.
- Reconciliation runs, findings, mismatch records, remediation attempts, and
  escalation workflow.
- Idempotent projection rebuilds from persisted records.
- Explicit execution posture labels for simulated, dry-run, blocked, and
  evidence-only states.

Current deployment stance:

- The API can run without a separate worker for the public demo.
- The worker is deployable as a separate background service when continuous
  scheduled cycles are required.
- The worker should remain dry-run for the PUSD/Encrypt demo.

### Vault Accounting

Sentinel Apex includes internal vault accounting for operator-managed strategy
evidence and protocol state.

Features:

- Vault summary and asset denomination.
- Depositor registry.
- Deposit lots with mint price and lock expiry.
- Redemption requests with eligibility timing.
- Share accounting.
- Protocol vault state for submission evidence.

Current boundary:

- The repo does not claim on-chain vault token issuance for the current demo.
- Vault accounting is internal and operator-managed.

### Carry Strategy Product

The carry product models a constrained delta-neutral carry strategy and its
operational checks.

Features:

- Strategy profile and policy enforcement.
- Opportunity detection and recommendation generation.
- Multi-leg execution planning model.
- Hedge deviation tracking.
- Carry action approval workflow.
- Execution history with truth labels.
- Strategy constraints for yield source, tenor, leverage metadata, and unsafe
  looping behavior.

Allowed strategy profile:

- Delta-neutral carry and basis-style funding capture.
- Explicit strategy policy and eligibility checks.
- Dry-run and simulation evidence for public demo workflows.

Blocked strategy profile:

- DEX LP yield claims.
- Junior tranche yield claims.
- Insurance pool yield claims.
- Circular stable-yield dependencies.
- Unsafe looping leverage on non-hardcoded oracle dependencies.

### Risk Engine

The risk engine evaluates whether proposed actions fit the system's configured
limits and operating posture.

Features:

- Gross and net exposure checks.
- Venue and asset concentration checks.
- Notional limits.
- Circuit-breaker and halt controls.
- Failure tolerance checks.
- Risk breach records.
- Risk assessment evidence for runtime decisions.

### Allocator

The allocator manages sleeve targets, proposed rebalances, approvals, recovery
states, and operational escalations.

Features:

- Target allocation modeling.
- Allocation history.
- Rebalance proposals and approval workflow.
- Bundle recovery candidates.
- Manual resolution paths for partially applied plans.
- Escalation ownership, acknowledgement, review, and closure workflow.

### Treasury

The treasury module keeps capital routing, treasury policy, and execution
planning separate from strategy generation.

Features:

- Treasury summary and policy surfaces.
- Treasury action recommendations.
- Operator approval workflow.
- Execution history.
- Venue readiness and blocked execution reasons.
- PUSD treasury state integration.

### Venue Readiness and Adapters

Venue adapters represent simulated, read-only, and narrowly scoped connector
capabilities while keeping live execution claims explicit.

Features:

- Venue inventory.
- Connector readiness.
- Real-versus-internal truth comparison.
- Read-only snapshots where supported.
- Connector promotion and suspension workflow.
- Reconciliation evidence.
- Simulated venue execution for tests and demo evidence.

Current boundary:

- PUSD mode does not select Jupiter Perps.
- Ranger and Jupiter private-key environment variables must remain unset for the
  PUSD/Encrypt demo.
- CEX execution adapters are not part of the current demo scope.

### Submission and Evidence

Sentinel Apex includes a submission dossier system designed to make demo and
hackathon evidence explicit rather than implied.

Features:

- Submission readiness profile.
- Evidence category tracking.
- Completeness assessment.
- Performance report generation.
- Backtest evidence.
- Multi-leg evidence summaries.
- Export bundle checklist.
- Truth labels for simulated runs, dry-run posture, missing data, and blocked
  production scope.

### Backtesting

The backtesting package provides historical simulation evidence for strategy
evaluation.

Features:

- Deterministic run configuration.
- Funding and basis replay.
- Return, drawdown, and Sharpe-style metrics.
- Trade statistics.
- Funding capture analysis.
- JSON, Markdown, and CSV-style report outputs.
- Explicit historical-simulation truth labels.

## System Architecture

Applications:

- `apps/api`: authenticated Fastify backend API.
- `apps/ops-dashboard`: Next.js operator dashboard.
- `apps/runtime-worker`: background runtime worker for scheduled cycles.

Core packages:

- `packages/config`: environment validation and configuration.
- `packages/db`: Drizzle schema, migrations, and database access.
- `packages/runtime`: control plane, runtime state, projection store, and
  orchestration.
- `packages/venue-adapters`: simulated, read-only, and narrow real connector
  adapters.
- `packages/risk-engine`: risk checks, limits, and guardrails.
- `packages/carry`: carry strategy policy and planning.
- `packages/allocator`: allocation and rebalance planning.
- `packages/treasury`: treasury policy and action planning.
- `packages/ranger`: Ranger integration boundary and simulated client.
- `packages/observability`: structured logging and redaction helpers.
- `packages/shared`: shared deployment truth and utility helpers.
- `packages/domain`: domain event types and factories.
- `packages/backtest`: historical simulation and reporting.
- `packages/cex-verification`: import, verification, and reporting helpers for
  CEX evidence.
- `packages/strategy-engine`: strategy signal and intent pipeline.
- `packages/execution`: order-management and reconciliation primitives.

## Current Product Truth

Implemented for the current public demo:

- PUSD as a first-class vault/base asset.
- PUSD accounting, read-only token balance checks, treasury state, operator
  intents, API/runtime/dashboard integration.
- Encrypt pre-alpha strategy-state integration.
- Optional Encrypt SDK demo with deterministic non-sensitive inputs.
- Operator dashboard and authenticated API.
- Runtime evidence, risk checks, allocator workflows, treasury workflows, venue
  readiness, reconciliation, submission dossier, and backtesting.

Not implemented or intentionally disabled for the current public demo:

- PUSD live execution.
- Signing.
- `sendTransaction`.
- Live trading.
- Ika.
- Production privacy.
- Real encryption claims.
- Mainnet execution.
- CEX execution adapters.

Sentinel Apex should be evaluated as a dry-run, operator-controlled protocol and
evidence system with strict safety boundaries, not as a production live-trading
deployment.
