# System Architecture Overview: Sentinel Apex

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-18

---

## 1. System Context

Sentinel Apex operates as an automated yield infrastructure layer between capital allocators and DeFi/CeFi execution venues. The system has no end-user consumer interface. All interactions are either programmatic (automated execution loop) or operator-initiated (via the ops dashboard or API).

```
┌─────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL ACTORS                              │
│                                                                     │
│  Capital Allocator        Institutional Operator                    │
│  (read-only reporting)    (monitoring + manual intervention)        │
└────────────────┬──────────────────────┬────────────────────────────┘
                 │                      │
                 ▼                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                     SENTINEL APEX SYSTEM                           │
│                                                                    │
│  ┌─────────────────┐       ┌────────────────────────────────────┐  │
│  │   apps/api      │◄─────►│      apps/ops-dashboard           │  │
│  │  REST API       │       │  React + real-time ops UI          │  │
│  └────────┬────────┘       └────────────────────────────────────┘  │
│           │                                                        │
│           ▼                                                        │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                  Core Domain Layer                          │   │
│  │  packages/domain · packages/risk-engine · packages/carry   │   │
│  │  packages/treasury · packages/allocator · packages/backtest│   │
│  └─────────────────────────┬──────────────────────────────────┘   │
│                             │                                      │
│           ┌─────────────────┼─────────────────┐                   │
│           ▼                 ▼                 ▼                   │
│  ┌────────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ packages/      │ │ packages/    │ │ packages/                │ │
│  │ execution      │ │ strategy-    │ │ venue-adapters           │ │
│  │                │ │ engine       │ │                          │ │
│  └────────┬───────┘ └──────────────┘ └───────────┬──────────────┘ │
│           │                                       │               │
│           └───────────────────┬───────────────────┘               │
│                               ▼                                   │
│                    ┌─────────────────────┐                        │
│                    │    PostgreSQL        │                        │
│                    │  (primary datastore) │                        │
│                    └─────────────────────┘                        │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
   ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
   │  Drift Protocol  │  │  CEX APIs        │  │  Treasury    │
   │  (Solana DEX)    │  │  (Binance, OKX,  │  │  Venues      │
   │                  │  │   Bybit, etc.)   │  │  (Marginfi,  │
   └─────────────────┘  └──────────────────┘  │   Kamino)    │
                                               └──────────────┘
```

---

## 2. Component Breakdown

### 2.1 apps/api

The REST API is the primary programmatic interface for the system. It serves:

- Portfolio state (NAV, positions, exposures, P&L)
- Order history and live order status
- Risk metrics and limit state
- Regime and allocation state
- Manual intervention endpoints (pause, resume, kill switch)
- Reporting endpoints (daily NAV, attribution, fill analysis)

The API is stateless and reads from PostgreSQL. It does not hold in-memory state that is not also persisted. All write operations (manual interventions) produce AuditEvents.

**Technology:** Node.js, Fastify, Drizzle ORM
**Authentication:** API key (institutional) with scoped permissions

### 2.2 apps/ops-dashboard

A server-side rendered web interface for institutional operators. Provides:

- Real-time portfolio overview (positions, exposures, NAV)
- Live order book and fill stream
- Risk metric gauges and limit breach indicators
- Regime state and allocation visualization
- Circuit breaker and kill switch controls
- Audit log viewer

The dashboard polls the API on short intervals and uses server-sent events for live order and fill updates. It has no direct database access.

**Technology:** Next.js, React, Tailwind CSS

### 2.3 packages/domain

The core domain model package. Contains:

- Entity definitions: Asset, Venue, Position, Order, Fill, Trade, Portfolio, Sleeve, Opportunity, RiskState, AllocationTarget, AuditEvent
- State machine implementations for Order, Position, and Sleeve
- Domain events: typed event definitions for every entity lifecycle transition
- Business rule implementations (invariant checks, constraint validation)
- Repository interfaces (implemented in the database layer, not here)

This package has zero runtime dependencies outside TypeScript. It is the authoritative source of business logic and must not import from infrastructure packages.

### 2.4 packages/config

Shared configuration schema and loading logic. Defines:

- All configurable parameters with types, defaults, and validation
- Environment variable schema (using Zod)
- Configuration profiles: development, paper-trading, production

All packages consume configuration through this package's typed interface. No package reads `process.env` directly.

### 2.5 packages/observability

Structured logging, metrics, and tracing. Provides:

- A structured logger interface (wrapping pino)
- Metric emission (Prometheus-compatible counters, gauges, histograms)
- OpenTelemetry trace context propagation
- Correlation ID injection and propagation across async boundaries

All packages log through this interface. No package uses `console.log` in production code.

### 2.6 packages/shared

Utility functions, type helpers, and cross-cutting concerns:

- Date/time utilities (all timestamps are UTC, represented as ISO 8601 strings or Unix milliseconds)
- Decimal arithmetic (using `decimal.js` — no native floats for financial values)
- Result/Either types for explicit error handling
- Retry logic with exponential backoff
- Schema validation utilities

### 2.7 packages/carry

Apex Carry strategy engine:

- Funding rate ingestion and normalization across venues
- Opportunity detection and scoring
- Position intent generation (sized, risk-checked candidates)
- Hedge ratio monitoring
- Carry-specific performance attribution

### 2.8 packages/risk-engine

Pre-trade and portfolio-level risk enforcement:

- Pre-trade check pipeline (exposure limits, concentration, leverage)
- Portfolio-level risk metric computation (gross/net exposure, VaR, drawdown)
- Risk state management and limit breach detection
- Circuit breaker state machine
- Stale data detection and staleness policy enforcement

### 2.9 packages/strategy-engine

The execution coordinator. Orchestrates:

- Signal consumption from carry and treasury engines
- Risk check invocation and result handling
- Order intent routing to execution layer
- Reconciliation loop coordination
- Sleeve state transitions

### 2.10 packages/allocator

Sentinel meta-allocator:

- Regime detection and classification
- Capital budget computation per sleeve
- Allocation target generation
- De-risking trigger logic
- Drawdown-aware allocation adjustment

### 2.11 packages/treasury

Atlas Treasury sleeve:

- Idle capital detection
- Tiered venue allocation policy
- Deposit and withdrawal intent generation
- T0 reserve enforcement
- Rebalance trigger evaluation

### 2.12 packages/venue-adapters

Typed venue integration layer:

- `VenueAdapter` interface: `getPrice`, `getOrderBook`, `getFundingRate`, `submitOrder`, `cancelOrder`, `getPositions`, `getBalances`
- Implementations: `DriftAdapter`, `BinanceAdapter`, `OkxAdapter`, `MarginfiAdapter`, `KaminoAdapter`
- Response normalization (all external data normalized to internal domain types before entering the system)
- Rate limiting, retry logic, and circuit breakers per venue connection

### 2.13 packages/execution

Order lifecycle management:

- Order state machine: Intent → Submitted → PartialFill → Filled | Cancelled | Failed
- Fill aggregation and trade construction
- Reconciliation against on-chain state (Drift) and CEX account state
- Execution failure handling and retry policy
- Slippage tracking and post-trade analysis

### 2.14 packages/backtest

Historical simulation harness:

- Replay historical funding rate and price data through carry signal engine
- Simulated fill execution with configurable slippage model
- Full risk check pipeline applied (not bypassed in backtest)
- Attribution and performance report generation
- Reproducible results given the same input data and configuration

---

## 3. Data Flow

The system follows a strict unidirectional data flow from signal generation to reconciliation:

```
Signal Generation
  │  (Funding rate, price, depth data from venue adapters)
  ▼
Opportunity Evaluation
  │  (packages/carry or packages/treasury)
  │  Produces: Opportunity record with score, venue, size candidate
  ▼
Intent Construction
  │  (packages/strategy-engine)
  │  Produces: OrderIntent (unsigned, unsubmitted position intent)
  ▼
Pre-Trade Risk Check
  │  (packages/risk-engine)
  │  Checks: exposure limits, concentration, leverage, stale data, circuit breaker state
  │  Produces: RiskCheckResult (Approved | Rejected with reason)
  ▼
[Branch: Rejected → log rejection AuditEvent, discard intent]
  │
  ▼ [Approved]
Execution Submission
  │  (packages/execution + packages/venue-adapters)
  │  Submits order to venue, transitions Order to Submitted state
  │  Produces: OrderSubmittedEvent
  ▼
Fill / Cancellation / Failure
  │  (packages/execution)
  │  Venue callback or poll confirms fill, partial fill, cancel, or failure
  │  Produces: FillEvent, OrderFilledEvent, OrderCancelledEvent, OrderFailedEvent
  ▼
Position Reconciliation
  │  (packages/execution, running on 60s loop)
  │  Cross-references internal position state with venue account state
  │  Produces: ReconciliationEvent with any discrepancies flagged
  ▼
Portfolio State Update
  │  (packages/domain)
  │  Recomputes NAV, exposures, P&L, hedge ratio
  ▼
Risk Metric Recomputation
  │  (packages/risk-engine)
  │  Recomputes drawdown, concentration, leverage
  ▼
Reporting / Audit Log
   (packages/observability + audit_events table)
   All state changes written as immutable events
```

---

## 4. Database Design Philosophy

PostgreSQL is the single source of truth for all persistent state. The design philosophy:

- **No Redis:** Redis is not used. All state requiring fast access is either derivable from PostgreSQL within acceptable latency bounds or maintained in process memory with a defined reconciliation loop. The added operational complexity of a second datastore is not justified by the access pattern requirements.
- **Event sourcing for audit:** All entity state changes are recorded as immutable events in the `audit_events` table. Current state tables are maintained as materialized projections of these events for query efficiency.
- **Append-only audit log:** The `audit_events` table has no UPDATE or DELETE permissions granted to the application role. Inserts only.
- **Explicit schema migrations:** All schema changes are managed through versioned migration files. No auto-migration in production.
- **Decimal precision:** All monetary values are stored as `NUMERIC(28, 10)` (28 significant digits, 10 decimal places). No FLOAT columns for financial data.
- **Timestamps:** All timestamps stored as `TIMESTAMPTZ` in UTC. Application layer always works in UTC.

### Core Tables

| Table | Purpose |
|---|---|
| `assets` | Asset definitions (symbol, type, decimals, venue mappings) |
| `venues` | Venue definitions (name, type, adapter class, config) |
| `positions` | Current position state (projected from fills) |
| `orders` | Order lifecycle state |
| `fills` | Individual fill records (immutable after creation) |
| `trades` | Aggregated trade records (one or more fills) |
| `portfolios` | Portfolio snapshots (NAV, exposures, at point in time) |
| `sleeves` | Sleeve state and allocation targets |
| `opportunities` | Detected carry/basis opportunities (scored, acted on or discarded) |
| `risk_states` | Point-in-time risk metric snapshots |
| `allocation_targets` | Sentinel-computed allocation targets with regime state |
| `audit_events` | Immutable event log (append-only) |
| `circuit_breaker_state` | Current circuit breaker status per breaker type |

---

## 5. Event Model Overview

Every significant state change in the system produces a typed event. Events are:

1. Written synchronously to the `audit_events` table as part of the database transaction that performs the state change
2. Published to in-process event bus for downstream consumers (reconciliation, risk recomputation, reporting)
3. Never deleted or modified after creation

Event envelope:

```typescript
interface AuditEvent {
  id: string;              // UUID v7 (time-ordered)
  correlationId: string;   // Propagated through async chains
  entityType: EntityType;  // 'order' | 'position' | 'portfolio' | ...
  entityId: string;
  eventType: string;       // e.g. 'order.filled', 'position.opened'
  previousState: unknown;  // JSON snapshot of entity before change
  nextState: unknown;      // JSON snapshot of entity after change
  actor: string;           // 'system:carry' | 'operator:user-id' | ...
  occurredAt: string;      // ISO 8601 UTC
  metadata: Record<string, unknown>;
}
```

---

## 6. Deployment Topology

```
┌─────────────────────────────────────────────────────────┐
│                   Production Environment                 │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Application Host                      │   │
│  │                                                   │   │
│  │  ┌───────────────┐   ┌─────────────────────────┐ │   │
│  │  │   apps/api    │   │   apps/ops-dashboard    │ │   │
│  │  │  (Fastify)    │   │   (Next.js)             │ │   │
│  │  └───────┬───────┘   └─────────────────────────┘ │   │
│  │          │                                        │   │
│  │  ┌───────▼───────────────────────────────────┐   │   │
│  │  │           Core Engine Process              │   │   │
│  │  │  strategy-engine (main loop)               │   │   │
│  │  │  carry · treasury · allocator · risk       │   │   │
│  │  └───────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │                  PostgreSQL                       │   │
│  │           (managed instance, daily backups)       │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The core engine, API, and dashboard run in the same environment. Horizontal scaling of the core engine is not supported in the initial deployment (single-process, single-writer to avoid concurrent position state conflicts). The API can be scaled horizontally as it is read-heavy and stateless.

---

## 7. Dry-Run vs Live Mode Separation

The system defaults to **dry-run mode**. Live execution requires explicit opt-in.

**Dry-run mode:**
- All signals are generated and risk checks are performed identically to live mode
- `VenueAdapter.submitOrder()` calls are intercepted and routed to a `SimulatedVenueAdapter`
- Simulated fills are generated using best-bid-ask spread model with configurable slippage
- All positions, fills, and audit events are recorded to the database identically to live mode
- There is no flag or marker in the domain entities distinguishing simulated from live data — they are separate database schemas (`paper_trading` vs `live`)

**Live mode activation:**
1. Environment variable `TRADING_MODE=live` must be set
2. A separate `LIVE_TRADING_CONFIRMATION=<dated-token>` must match a server-side generated confirmation token
3. The system logs a `LiveModeActivated` audit event with operator identity and timestamp
4. Live mode can be reverted to dry-run at any time; the opposite is not true (live positions must be closed before switching back to paper)

**Code-level separation:**
- `packages/execution` instantiates adapters through a factory that reads `TRADING_MODE`
- The `SimulatedVenueAdapter` implements the full `VenueAdapter` interface and is drop-in replaceable
- No production code path contains conditionals on `TRADING_MODE` except the adapter factory

---

## 8. Key Integration Points

### 8.1 Drift Protocol (Primary DEX)

- **Connection:** Solana RPC + Drift Protocol TypeScript SDK
- **Capabilities used:** Perpetual market orders, limit orders, account balance, position fetch, funding rate history
- **Authentication:** Solana keypair (hardware wallet in production, software wallet in development)
- **Reconciliation:** On-chain position state fetched every 60 seconds and compared to internal state
- **Failure handling:** RPC failover to secondary endpoint; order submission retried up to 3 times with exponential backoff; position state treated as stale if > 60s old

### 8.2 CEX APIs

- **Supported venues:** Binance, OKX, Bybit (configurable)
- **Capabilities used:** Perpetual funding rates, market data (price, depth), order submission, position fetch, account balance
- **Authentication:** API key + secret (stored in environment variables, never in code or database)
- **Rate limiting:** Per-venue rate limit tracking; requests are queued if approaching limits
- **Failure handling:** Circuit breaker per venue; breached circuit disables that venue for a configurable cooldown period

### 8.3 Treasury Venues

- **Marginfi:** Supply (deposit) and withdraw via Marginfi TypeScript SDK; position tracked as lending balance
- **Kamino:** Supply to lending market via Kamino SDK; yield tracked as accrued interest
- **Reconciliation:** On-chain balance fetched every 5 minutes for treasury positions; discrepancies > 0.01% flagged for operator review
