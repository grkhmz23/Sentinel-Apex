# Phase Roadmap: Sentinel Apex

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-18

---

## Overview

Sentinel Apex is built in five phases. Each phase produces a demonstrably working system that is tested and reviewable before the next phase begins. No phase's deliverables are "carry-over" from a previous phase — each phase starts from a state where the prior phase's success criteria have been met.

The phases are designed to de-risk in the correct order:
- **Phase 0** creates a solid foundation so that no technical debt is incurred in subsequent phases
- **Phase 1** builds the primary alpha engine in isolation, validatable in paper mode, before any further complexity is added
- **Phase 2** adds treasury without introducing strategy risk — treasury is lower complexity and its integration is well-bounded
- **Phase 3** adds the meta-allocator, which coordinates everything and is the most complex integration point
- **Phase 4** hardens the system for production deployment; live trading is not enabled before this phase is complete

---

## Phase 0: Foundation

**Target Completion:** 4 weeks from project start
**Status:** In Progress

### Scope

Phase 0 establishes the engineering foundation. No trading logic is implemented. The deliverables are infrastructure, standards, and documentation that all subsequent phases depend on.

### Deliverables

**Repository structure:**
- [ ] Monorepo initialized with pnpm workspaces and Turborepo (ADR-0001)
- [ ] All package directories created with correct `package.json` files and cross-package dependencies declared
- [ ] Root `tsconfig.base.json` with strict mode configuration (ADR-0002)
- [ ] ESLint configuration with custom financial-value rules
- [ ] Prettier configuration
- [ ] Vitest configuration for all packages
- [ ] `.env.example` with all required environment variables documented

**CI pipeline:**
- [ ] GitHub Actions workflow: lint, typecheck, test on every PR
- [ ] Turborepo remote cache configured for CI
- [ ] Branch protection rules: PR required to merge to main; CI must pass

**Database foundation:**
- [ ] PostgreSQL schema for all core domain tables (see domain model)
- [ ] `audit_events` table with partitioning and permission model (ADR-0006)
- [ ] Migration tooling configured with Drizzle ORM (ADR-0007)
- [ ] Seed script for development data (test assets, venues, initial portfolio)
- [ ] `docker-compose.yml` for local PostgreSQL instance

**Package scaffolding:**
- [ ] `packages/domain`: entity type definitions, state machine types, event type definitions, repository interfaces
- [ ] `packages/config`: Zod schema for all configuration parameters, environment variable loading
- [ ] `packages/observability`: structured logger, metric interface, correlation ID middleware
- [ ] `packages/shared`: Result type, Decimal utilities, date utilities, retry logic

**Documentation (this phase):**
- [x] PRD (docs/prd/product-requirements.md)
- [x] System overview (docs/architecture/system-overview.md)
- [x] Domain model (docs/architecture/domain-model.md)
- [x] Risk framework (docs/risk/risk-framework.md)
- [x] Apex Carry spec (docs/strategy/apex-carry.md)
- [x] Atlas Treasury spec (docs/strategy/atlas-treasury.md)
- [x] Sentinel Allocator spec (docs/strategy/sentinel-allocator.md)
- [x] ADRs 0001–0007
- [x] Phase roadmap (this document)

### Success Criteria

- A new developer can clone the repository, run `pnpm install && docker-compose up -d && pnpm turbo run build`, and have a fully building local environment within 10 minutes
- `pnpm turbo run typecheck` passes with zero errors across all packages
- `pnpm turbo run lint` passes with zero errors across all packages
- `pnpm turbo run test` passes; all packages have at least a passing placeholder test
- All documentation reviewed and no outstanding questions about architecture or domain model

### Dependencies

None.

---

## Phase 1: Apex Carry MVP

**Target Completion:** 10 weeks from Phase 0 completion
**Status:** Not Started

### Scope

Phase 1 implements the complete Apex Carry strategy in paper-trading mode. At the end of this phase, the system runs continuously, identifies carry opportunities, submits orders to the simulated fill engine, manages positions, enforces risk checks, and exposes a working API and dashboard. Live execution is not enabled in this phase.

### Deliverables

**Domain implementation (`packages/domain`):**
- [ ] Full entity implementations (Asset, Venue, Position, Order, Fill, Trade, Portfolio, Sleeve, Opportunity, RiskState, AuditEvent)
- [ ] Order state machine with all transitions and guards
- [ ] Position state machine with all transitions
- [ ] Repository implementations (Drizzle ORM, using schema from Phase 0)
- [ ] Domain event emitter with typed event definitions
- [ ] Invariant check functions for all entities

**Carry strategy engine (`packages/carry`):**
- [ ] Funding rate ingestion and normalization
- [ ] Opportunity detection for all three opportunity types (funding arb, basis, cross-venue)
- [ ] Opportunity scoring algorithm
- [ ] Position sizing (Kelly-adjacent with hard caps)
- [ ] Entry rule evaluation
- [ ] Exit rule evaluation (all X-01 through X-08 triggers)
- [ ] Hedge ratio computation and monitoring
- [ ] Carry-specific performance attribution model

**Risk engine (`packages/risk-engine`):**
- [ ] Pre-trade check pipeline (all 10 checks from risk framework)
- [ ] Portfolio-level risk metric computation
- [ ] Risk state management and persistence
- [ ] All 6 circuit breaker implementations
- [ ] Stale data detection
- [ ] Kill switch state machine

**Execution layer (`packages/execution`):**
- [ ] Order lifecycle manager
- [ ] Fill processor
- [ ] Reconciliation loop (60-second cycle)
- [ ] Execution failure handler with retry logic
- [ ] Unhedged position recovery logic

**Venue adapters (`packages/venue-adapters`):**
- [ ] `VenueAdapter` interface and `BaseVenueAdapter`
- [ ] `DriftAdapter` (Drift Protocol perpetuals)
- [ ] `BinanceAdapter` (Binance perpetuals — for cross-venue rate data)
- [ ] `SimulatedVenueAdapter` (paper trading fill engine)
- [ ] Response schema validation (Zod) for all venue adapters
- [ ] Rate limit management for CEX adapters

**Strategy engine (`packages/strategy-engine`):**
- [ ] Main execution loop (configurable cycle interval)
- [ ] Signal consumption and routing
- [ ] Dry-run/live mode adapter factory (ADR-0004)
- [ ] Graceful shutdown handling

**REST API (`apps/api`):**
- [ ] Portfolio state endpoints (NAV, exposures, P&L)
- [ ] Position list and detail endpoints
- [ ] Order history and live order status endpoints
- [ ] Risk state and limit status endpoints
- [ ] Manual intervention endpoints (pause, resume sleeve)
- [ ] Basic authentication (API key)

**Operations dashboard (`apps/ops-dashboard`):**
- [ ] Portfolio overview (NAV, drawdown, exposures)
- [ ] Position table with hedge ratio indicators
- [ ] Live order stream
- [ ] Risk metric gauges with limit indicators
- [ ] Circuit breaker status display
- [ ] Basic audit log viewer

**Backtest harness (`packages/backtest`):**
- [ ] Historical data loader (funding rates, prices)
- [ ] Carry strategy replay with configurable date range
- [ ] Simulated fill model with slippage
- [ ] Full risk check pipeline (not bypassed)
- [ ] Performance report: Sharpe, drawdown, attribution, trade log

### Success Criteria

- Paper trading runs continuously for 7 days without any unhandled exceptions or process crashes
- All 10 pre-trade risk checks enforced; rejection events logged and visible in API
- Carry backtest over 12-month historical data produces Sharpe ratio > 1.5 at production risk limits
- Hedge ratio maintained > 95% across all simulated positions
- API returns correct portfolio, position, and risk state; tested with integration tests
- Dashboard displays live paper-trading state and updates in real-time
- Zero TypeScript errors; zero lint errors; all tests passing in CI

### Dependencies

- Phase 0 complete (all success criteria met)
- Drift Protocol SDK available and documented
- 12 months of historical funding rate data sourced for backtest

---

## Phase 2: Atlas Treasury

**Target Completion:** 6 weeks from Phase 1 completion
**Status:** Not Started

### Scope

Phase 2 implements the Atlas Treasury sleeve. Idle capital is automatically deployed to approved treasury venues according to the tiered allocation policy. The carry sleeve and treasury sleeve operate simultaneously in paper mode. The T0 reserve floor is enforced programmatically.

### Deliverables

**Treasury engine (`packages/treasury`):**
- [ ] Idle capital detection
- [ ] Tiered allocation policy (T0, T1, T2)
- [ ] Deployment trigger logic (all RB-01 through RB-08 triggers)
- [ ] T0 reserve floor enforcement
- [ ] Predictive reserve management (24h forward look)
- [ ] Margin call buffer computation
- [ ] Drawdown-aware T2 unwind logic
- [ ] Treasury performance attribution (yield per protocol, tier)

**Venue adapters:**
- [ ] `MarginfiAdapter` (supply/withdraw, balance query)
- [ ] `KaminoAdapter` (supply/withdraw, balance query)
- [ ] On-chain reconciliation for treasury positions (5-minute cycle)

**Integration:**
- [ ] Treasury positions visible in portfolio NAV computation
- [ ] Treasury P&L attributed separately from carry P&L
- [ ] T0 available liquidity feeds into carry pre-trade risk checks (RL-004)
- [ ] Allocation events visible in audit log and dashboard

**API additions:**
- [ ] Treasury position endpoints (per protocol, per tier)
- [ ] T0 liquidity status endpoint
- [ ] Treasury allocation breakdown endpoint

**Dashboard additions:**
- [ ] Treasury sleeve overview (NAV, yield, tier breakdown)
- [ ] Protocol concentration visualization
- [ ] T0 reserve indicator

### Success Criteria

- Idle capital deployed within 30 minutes of carry position changes in paper mode
- T0 reserve maintained above floor in all simulated scenarios including carry margin calls
- Treasury reconciliation runs every 5 minutes without errors
- Combined carry + treasury NAV computation is consistent with sum of sleeve values
- Treasury yield attribution is correct (tested against known historical protocol APYs)
- No regressions in carry functionality from Phase 1

### Dependencies

- Phase 1 complete
- Marginfi and Kamino TypeScript SDKs available for mainnet integration
- Access to testnet versions of Marginfi and Kamino for integration testing

---

## Phase 3: Sentinel Allocator

**Target Completion:** 8 weeks from Phase 2 completion
**Status:** Not Started

### Scope

Phase 3 implements the Sentinel meta-allocator: regime detection, capital budgeting, drawdown-aware allocation, and circuit breaker integration. After this phase, all three system components (carry, treasury, Sentinel) work together as a coordinated system.

### Deliverables

**Sentinel allocator (`packages/allocator`):**
- [ ] Regime detection signal ingestion (funding rates, volatility, depth, drawdown)
- [ ] Regime classification logic with persistence thresholds
- [ ] Allocation target computation per regime
- [ ] Drawdown-aware allocation cap
- [ ] Allocation change workflow with audit trail
- [ ] De-risking trigger and execution logic
- [ ] Allocation execution verification (target vs actual within 30 minutes)
- [ ] Sleeve scoring model (carry score, treasury venue scoring)

**Integration:**
- [ ] Carry sleeve consumes AllocationChanged events and adjusts position sizing
- [ ] Treasury sleeve consumes AllocationChanged events and triggers rebalance
- [ ] Circuit breaker state propagates to Sentinel; Sentinel forces regime transitions on CB-006
- [ ] Kill switch triggers EmergencyClose across all sleeves

**API additions:**
- [ ] Regime state endpoint (current regime, signal inputs, history)
- [ ] Allocation target history endpoint
- [ ] Sleeve score endpoint

**Dashboard additions:**
- [ ] Regime indicator with signal breakdown
- [ ] Allocation target visualization (carry vs treasury)
- [ ] De-risking event timeline

**Testing:**
- [ ] Regime detection tested against 5 defined historical stress periods (2022 Terra/Luna, 2022 FTX, 2023 banking stress, 2024 rate shock, 2025 altcoin collapse)
- [ ] Allocation transition simulations for all regime pairs
- [ ] Circuit breaker propagation tests
- [ ] Full system paper trading under simulated stress scenarios

### Success Criteria

- Regime detection correctly classifies all 5 historical stress test periods
- Allocation changes triggered within 60 seconds of regime transition in paper mode
- Circuit breakers halt new carry entries within 1 second of condition detection
- De-risking reduces carry allocation to target within 30 minutes of trigger
- Full system paper trading runs for 14 days under normal conditions without unhandled errors
- Stress simulation (rapid funding rate flip + 10% price drop) produces correct kill switch evaluation

### Dependencies

- Phase 2 complete
- Historical market data for stress test validation periods

---

## Phase 4: Hardening

**Target Completion:** 8 weeks from Phase 3 completion
**Status:** Not Started

### Scope

Phase 4 prepares the system for live production deployment. No new strategy features are added. The focus is on security, reliability, observability, operational procedures, and the explicit enablement of live trading with appropriate safeguards.

### Deliverables

**Security:**
- [ ] Security review of all execution paths (order submission, venue authentication, API authentication)
- [ ] Key management review: private key storage, rotation procedures, hardware wallet integration for Drift
- [ ] API rate limiting and abuse protection
- [ ] Input validation review: all external inputs validated with Zod schemas
- [ ] Dependency audit (supply chain security)
- [ ] No secrets in logs, events, or API responses (automated check in CI)
- [ ] Environment variable security (no secrets in version control)

**Operational runbooks:**
- [ ] Runbook: Normal startup and shutdown
- [ ] Runbook: Circuit breaker investigation and reset
- [ ] Runbook: Kill switch activation and recovery
- [ ] Runbook: Reconciliation failure investigation
- [ ] Runbook: Database backup and restore
- [ ] Runbook: Venue adapter connectivity failure
- [ ] Runbook: Live trading opt-in procedure
- [ ] Runbook: Emergency position close (manual force-close)
- [ ] All runbooks tested by an operator who did not write them

**Production deployment:**
- [ ] Production environment provisioned (application host + managed PostgreSQL)
- [ ] PgBouncer connection pooler configured
- [ ] Production configuration validated (all risk limits, all venue configs)
- [ ] Database backup policy: daily automated backups, 30-day retention, tested restore
- [ ] TLS for all API endpoints
- [ ] Firewall rules: API accessible only from authorized IP ranges

**Monitoring and alerting:**
- [ ] Prometheus metrics exposition for all key system metrics
- [ ] Grafana dashboards: portfolio state, risk metrics, execution quality, system health
- [ ] Alert rules configured for all ALERT and CRITICAL severity conditions (from risk framework)
- [ ] PagerDuty (or equivalent) integration for CRITICAL alerts
- [ ] Uptime monitoring for API and execution loop
- [ ] Database disk space and query performance alerts

**Live trading:**
- [ ] Live trading activation procedure documented and tested in paper mode
- [ ] Two-operator confirmation requirement implemented for kill switch reset
- [ ] Live trading confirmation token flow implemented (ADR-0004)
- [ ] 30-day clean paper trading record required before first live activation
- [ ] Initial live deployment with reduced risk limits (50% of production defaults) for first 30 days

### Success Criteria

- Zero critical security findings (or all critical/high findings remediated before go-live)
- All runbooks tested by a second operator; sign-off documented
- Production monitoring covers 100% of ALERT and CRITICAL conditions from the risk framework
- Database backup successfully restored to a separate environment in test
- 30-day paper trading record with no unhandled errors and Sharpe > 1.5
- Live trading activation procedure rehearsed in paper mode
- System availability in production: 99.9% measured over first 30 days of operation
- First live trade executed with full operator presence and post-trade review completed

### Dependencies

- Phase 3 complete
- Production infrastructure provisioned
- Security review scheduled and completed
- Operational team trained on all runbooks

---

## Cross-Phase Constraints

The following constraints apply across all phases:

- **No live trading before Phase 4 is complete.** The system must not be connected to live venues with real capital until all Phase 4 success criteria are met. Paper trading is available from Phase 1 onward.
- **Documentation kept current.** ADRs, strategy specs, and the risk framework must be updated if any implementation decision deviates from the documented specification. Undocumented deviations are treated as defects.
- **CI must pass before merging.** No exceptions. If CI is broken, fixing CI is the highest priority.
- **Risk limits are not bypassed in any phase.** The full pre-trade risk check pipeline is active in paper trading mode from Phase 1 onward. Risk limits are not relaxed for testing purposes.
- **Backtest results are not sufficient to enable live trading.** Backtests validate strategy logic but do not validate execution infrastructure. Paper trading validation is required independently.
