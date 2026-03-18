# Product Requirements Document: Sentinel Apex

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-18

---

## 1. Product Vision

Sentinel Apex is an institutional-grade, regime-aware, market-neutral yield vault operating on Solana. It systematically captures structural yield from funding rate differentials, basis spreads, and idle capital deployment while maintaining strict risk-adjusted neutrality across all market regimes.

The system is not a speculative directional fund. It is an engineered yield infrastructure designed to deliver consistent, risk-adjusted returns to capital allocators and institutional operators who require transparency, auditability, and defensible risk controls. Every capital deployment decision is governed by a defined rule set, enforced programmatically, and recorded immutably.

The product is organized into three complementary strategy sleeves coordinated by a meta-allocator:

- **Apex Carry** — the primary alpha engine, capturing funding rate arbitrage, basis spreads, and cross-venue rate differentials
- **Atlas Treasury** — idle capital management, deploying uninvested capital into tiered liquidity venues
- **Sentinel Allocator** — the regime-aware meta-allocator that governs capital budgeting across sleeves and enforces risk budgets

---

## 2. Target Users

### 2.1 Capital Allocators

Institutional or professional investors deploying capital into the vault. They require:

- Transparent, auditable performance attribution
- Predictable drawdown characteristics
- Defined risk limits enforced programmatically, not by policy alone
- Regular reporting aligned with institutional standards (NAV, Sharpe, max drawdown, VaR)
- Confidence that no discretionary overrides exist without documented governance

### 2.2 Institutional Operators

Technical and operational staff responsible for running and monitoring the system. They require:

- Observable system state at all times (positions, orders, fill status, risk metrics)
- Operational runbooks for all failure modes
- Manual intervention capabilities that are gated, logged, and reversible where possible
- Alerting and escalation paths for breached risk limits
- Dry-run mode for testing strategy changes without capital at risk

---

## 3. Strategy Layer Definitions

### 3.1 Apex Carry (Primary Alpha Engine)

Apex Carry identifies and exploits structural yield opportunities arising from:

- Perpetual funding rate arbitrage (long spot on DEX, short perp, or cross-venue perp pairs)
- Spot/futures basis trading where convergence is quantifiable
- Cross-venue funding rate discrepancies where the same instrument trades at different implied rates

The sleeve operates market-neutral by design. Net delta exposure must remain within defined limits at all times. Positions are sized using a Kelly-adjacent methodology with hard notional caps and per-venue concentration limits.

**Primary venue:** Drift Protocol (Solana perpetuals DEX)
**Secondary venues:** CEX perpetuals (for cross-venue rate capture)

### 3.2 Atlas Treasury (Idle Capital Management)

Atlas Treasury deploys capital not currently allocated to Apex Carry positions into yield-bearing instruments with defined liquidity tiers:

- **T0:** Instantly redeemable (e.g., overcollateralized stablecoin lending, on-chain money markets with same-slot redemption)
- **T1:** Same-day redemption (e.g., Marginfi, Kamino supply positions)
- **T2:** 1–3 day redemption (e.g., short-duration stable LP pools with defined unlock periods)

The sleeve maintains a minimum liquidity reserve in T0 at all times to support Apex Carry margin requirements and withdrawal events.

### 3.3 Sentinel Allocator (Meta-Allocator)

Sentinel is not a yield strategy. It is the capital budgeting and risk enforcement layer. It:

- Reads market regime signals (volatility, funding rates, depth, drawdown state)
- Classifies the current regime (Bull, Neutral, Bear, Stressed, Crisis)
- Allocates risk budget across Apex Carry and Atlas Treasury according to regime-specific rules
- Enforces drawdown-aware de-risking
- Triggers circuit breakers and recovery workflows

---

## 4. Success Metrics

The following metrics are measured continuously and reported at daily, weekly, and monthly cadences.

| Metric | Target | Hard Limit |
|---|---|---|
| Annualized net yield | > 8% | — |
| Sharpe ratio (rolling 30d) | > 1.5 | > 1.0 |
| Maximum daily drawdown | < 1% | < 2% |
| Maximum weekly drawdown | < 3% | < 5% |
| Maximum portfolio drawdown (peak-to-trough) | < 10% | < 15% |
| Capital utilization (carry + treasury) | > 85% | — |
| Hedge ratio (carry positions) | > 95% | > 90% |
| Execution fill rate (intended vs filled) | > 98% | > 95% |
| System availability | > 99.9% | > 99.5% |
| Stale data age (risk inputs) | < 30s | < 60s |
| Order round-trip latency (p95) | < 500ms | < 2s |

---

## 5. Phase Breakdown

### Phase 0: Foundation

**Scope:** Documentation, repository scaffold, tooling, and development environment.

**Deliverables:**
- Monorepo structure with pnpm workspaces and Turborepo
- All ADRs and foundational documentation
- TypeScript configuration, linting, formatting standards
- CI pipeline (lint, typecheck, test)
- Database schema design (domain tables, event log, audit trail)
- Development environment with local Postgres

**Success Criteria:**
- All developers can clone and run the full local stack in under 10 minutes
- CI pipeline passes on all PRs
- Architecture documents reviewed and accepted

**Dependencies:** None

---

### Phase 1: Apex Carry MVP

**Scope:** Domain model implementation, carry strategy engine, risk engine, execution layer, paper trading, API skeleton, and dashboard skeleton.

**Deliverables:**
- Full domain model implemented in `packages/domain`
- Carry signal generation in `packages/carry`
- Pre-trade risk checks in `packages/risk-engine`
- Execution adapter for Drift Protocol in `packages/venue-adapters`
- Order lifecycle management in `packages/execution`
- Paper trading (dry-run) mode with simulated fills
- REST API skeleton in `apps/api`
- Ops dashboard skeleton in `apps/ops-dashboard`
- Backtesting harness in `packages/backtest`
- Carry strategy backtest over 12 months of historical funding data

**Success Criteria:**
- Paper trading runs continuously for 7 days without unhandled errors
- All pre-trade risk checks enforced and logged
- Backtest produces attributable P&L with Sharpe > 1.5 on historical data
- API returns correct position, order, and risk state
- Dashboard displays live portfolio state in dry-run mode

**Dependencies:** Phase 0

---

### Phase 2: Atlas Treasury

**Scope:** Treasury sleeve implementation, idle capital routing, tiered liquidity management, rebalance policies.

**Deliverables:**
- Treasury sleeve engine in `packages/treasury`
- Venue adapters for Marginfi and Kamino
- Tiered liquidity allocation policy
- T0 reserve enforcement
- Rebalance trigger logic
- Treasury positions visible in dashboard and API

**Success Criteria:**
- Treasury correctly allocates idle capital within 5 minutes of carry position changes
- T0 reserve maintained in all simulated stress scenarios
- Rebalance triggers tested against defined thresholds

**Dependencies:** Phase 1

---

### Phase 3: Sentinel Allocator

**Scope:** Meta-allocator implementation, regime detection, risk budgeting, drawdown-aware allocation.

**Deliverables:**
- Sentinel allocator in `packages/allocator`
- Regime detection signals and classification
- Allocation rules per regime
- Circuit breaker integration
- Drawdown-aware de-risking logic
- Sleeve scoring model

**Success Criteria:**
- Regime detection tested against 5 defined historical stress periods
- Allocation changes triggered correctly on regime transitions
- Circuit breakers halt execution within 1 second of breach
- Full system paper trading under simulated stress scenarios

**Dependencies:** Phase 2

---

### Phase 4: Hardening

**Scope:** Security review, operational runbooks, production deployment, alerting, and monitoring.

**Deliverables:**
- Security audit of all execution paths and key management
- Operational runbooks for all failure modes
- Production deployment infrastructure
- Alerting configuration (PagerDuty or equivalent)
- Rate limit and abuse protection on API
- Key rotation procedures
- Disaster recovery plan and tested restore procedures
- Live trading opt-in with double confirmation safeguards

**Success Criteria:**
- Zero critical findings from security review (or all remediated)
- All runbooks tested by operator who did not write them
- Production monitoring covering all system components
- Live trading enabled after 30-day clean paper trading record

**Dependencies:** Phase 3

---

## 6. Core Requirements per Sleeve

### 6.1 Apex Carry Requirements

**Functional:**
- FR-C-01: System must identify funding rate arbitrage opportunities across all configured venues
- FR-C-02: System must generate sized position intents within configurable gross/net exposure limits
- FR-C-03: All position intents must pass pre-trade risk checks before execution
- FR-C-04: Hedge ratio must be maintained; partial hedges are monitored and trigger alerts above defined thresholds
- FR-C-05: Position entry and exit must be logged with full audit trail including signal, intent, checks, and execution
- FR-C-06: System must detect and respond to funding rate flips within one funding interval
- FR-C-07: Backtesting must be runnable against historical venue data with reproducible results

**Non-Functional:**
- NFR-C-01: Signal evaluation cycle must complete within 500ms per venue
- NFR-C-02: Order submission latency to Drift must be < 200ms p95
- NFR-C-03: Position state must be reconciled against on-chain state every 60 seconds

### 6.2 Atlas Treasury Requirements

**Functional:**
- FR-T-01: System must deploy idle capital to approved venues within a configurable deployment delay
- FR-T-02: T0 liquidity reserve must never fall below configured minimum (default 10% NAV)
- FR-T-03: Rebalancing must occur on defined triggers (allocation drift, new idle capital, carry draw-down)
- FR-T-04: All protocol interactions must be logged and reconciled against on-chain state
- FR-T-05: Withdrawal from any venue must be executable within the venue's defined redemption window

### 6.3 Sentinel Allocator Requirements

**Functional:**
- FR-S-01: Regime must be classified and logged at minimum every 5 minutes
- FR-S-02: Allocation targets must be updated on regime transitions within 60 seconds
- FR-S-03: De-risking triggers must reduce carry allocation before drawdown breach
- FR-S-04: Circuit breaker state must propagate to all downstream sleeves synchronously
- FR-S-05: All allocation changes must be logged with regime state, inputs, and rationale

---

## 7. Non-Functional Requirements

### 7.1 Latency

- Signal evaluation: < 500ms per cycle per venue
- Pre-trade risk check pipeline: < 50ms
- Order submission (Drift): < 200ms p95
- API response (read): < 100ms p95
- API response (action): < 500ms p95
- Regime classification: < 1s

### 7.2 Availability

- Core execution loop: 99.9% uptime (< 8.7 hours downtime/year)
- API: 99.5% uptime
- Dashboard: 99.0% uptime
- Degraded mode: If risk checks are unavailable, all order submission must halt (fail-closed)

### 7.3 Auditability

- Every state change to a Position, Order, Sleeve, or Portfolio must produce an immutable AuditEvent
- AuditEvents must include: entity type, entity ID, previous state, new state, actor (system or user), timestamp (UTC), and correlation ID
- The audit log must be append-only; no delete or update operations on the events table
- Audit log must be queryable by entity, time range, actor, and event type

### 7.4 Security

- Private keys and API credentials must never appear in logs, events, or API responses
- All API endpoints must require authentication
- Live trading mode requires explicit environment variable opt-in (`LIVE_TRADING=true`) plus a separate runtime confirmation
- Manual intervention actions (force-close, kill switch) must require multi-factor confirmation in production
- All external API calls must validate response schemas; unknown fields are logged and ignored, not trusted

---

## 8. Risk Constraints

The following constraints are non-negotiable and enforced programmatically:

- **RC-01:** Net delta exposure must not exceed 20% of NAV at any time
- **RC-02:** Gross exposure must not exceed 200% of NAV
- **RC-03:** No single venue may hold more than 40% of gross exposure
- **RC-04:** No single asset may represent more than 30% of gross exposure
- **RC-05:** Leverage must not exceed 3x NAV
- **RC-06:** Minimum T0 liquidity reserve must be maintained at all times
- **RC-07:** Any daily drawdown exceeding 2% triggers a circuit breaker and halts new position entry
- **RC-08:** Any portfolio drawdown exceeding 15% triggers a full kill switch and requires manual reset

---

## 9. Out of Scope

The following are explicitly not part of Sentinel Apex:

- **Directional trading:** No net-long or net-short directional exposure is intentional. Any directional exposure is a failure mode, not a feature.
- **Options strategies:** Options pricing, delta management, and volatility trading are not supported in any phase.
- **Cross-chain deployment:** All on-chain execution is Solana-only. EVM chain support is not planned.
- **Retail user interface:** The system is designed for institutional operators and capital allocators, not retail investors. No consumer-facing UI is in scope.
- **Discretionary overrides of risk limits:** Operators may pause the system or trigger the kill switch, but may not override computed risk limit checks for individual orders.
- **Custom smart contract deployment:** The system integrates with existing protocols (Drift, Marginfi, Kamino) via their published interfaces. No proprietary on-chain programs are deployed.
- **Token issuance or vault tokenization:** There is no plan to issue ERC-20 or SPL tokens representing vault shares in any phase.
- **Tax reporting or compliance advisory:** The system produces trade logs and P&L records, but does not provide tax advice or regulatory compliance guidance.
