# Domain Model: Sentinel Apex

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-18

---

## 1. Bounded Contexts

The domain is partitioned into five bounded contexts. Each context owns its entities and publishes events for cross-context communication. No context accesses another context's database tables directly.

```
┌──────────────────────────────────────────────────────────────────┐
│  PORTFOLIO CONTEXT                                               │
│  Portfolio · Sleeve · AllocationTarget · NAVSnapshot            │
└─────────────────────────────┬────────────────────────────────────┘
                              │ publishes: AllocationChanged,
                              │           DrawdownBreached
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  STRATEGY CONTEXT                                                │
│  Opportunity · Signal · PositionIntent · Sleeve(carry/treasury)  │
└─────────────────────────────┬────────────────────────────────────┘
                              │ publishes: OpportunityDetected,
                              │           IntentCreated, IntentRejected
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  RISK CONTEXT                                                    │
│  RiskState · RiskLimit · CircuitBreaker · RiskCheckResult        │
└─────────────────────────────┬────────────────────────────────────┘
                              │ publishes: RiskCheckPassed,
                              │           RiskCheckFailed,
                              │           LimitBreached,
                              │           CircuitBreakerTripped
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  EXECUTION CONTEXT                                               │
│  Order · Fill · Trade · Venue · ExecutionRecord                  │
└─────────────────────────────┬────────────────────────────────────┘
                              │ publishes: OrderSubmitted, OrderFilled,
                              │           OrderCancelled, OrderFailed,
                              │           FillRecorded
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  REPORTING CONTEXT                                               │
│  PerformanceRecord · AttributionRecord · AuditEvent · Report     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Entities

### 2.1 Asset

Represents a tradeable or depositable financial instrument.

```typescript
interface Asset {
  id: string;                    // UUID
  symbol: string;                // Normalized symbol: "SOL", "BTC", "USDC"
  assetType: AssetType;          // 'spot' | 'perp' | 'stable' | 'lp_token'
  baseSymbol: string;            // Underlying: "SOL" for SOL-PERP
  quoteSymbol: string;           // Quote: "USDC"
  decimals: number;              // On-chain precision
  venueSymbols: Record<VenueId, string>; // Per-venue ticker mappings
  isActive: boolean;
  createdAt: string;
}
```

**Invariants:**
- `symbol` must be unique across all active assets
- `decimals` must be consistent with on-chain asset definition
- `baseSymbol` and `quoteSymbol` must reference valid symbols

### 2.2 Venue

Represents an execution or deployment venue.

```typescript
interface Venue {
  id: string;
  name: string;
  venueType: VenueType;          // 'dex' | 'cex' | 'treasury_protocol'
  adapterClass: string;          // e.g. 'DriftAdapter'
  chain: Chain | null;           // 'solana' | null (for CEX)
  isActive: boolean;
  isCircuitBreakerOpen: boolean;
  circuitBreakerOpenedAt: string | null;
  maxGrossAllocation: Decimal;   // % of NAV
  config: VenueConfig;           // Adapter-specific config (API endpoints, etc.)
  createdAt: string;
}
```

**Invariants:**
- CEX venues must have non-null API credentials reference
- DEX venues must have non-null `chain`
- `maxGrossAllocation` must be between 0 and 1 (exclusive)

### 2.3 Position

Represents a held exposure in an asset at a venue.

```typescript
interface Position {
  id: string;
  portfolioId: string;
  sleeveId: string;
  assetId: string;
  venueId: string;
  side: PositionSide;            // 'long' | 'short'
  positionType: PositionType;    // 'spot' | 'perp' | 'basis' | 'treasury'
  status: PositionStatus;        // See state machine below
  quantity: Decimal;             // Absolute size in base asset
  notionalUsd: Decimal;          // Computed: quantity × mark price
  entryPrice: Decimal;
  currentMarkPrice: Decimal;
  unrealizedPnl: Decimal;
  realizedPnl: Decimal;
  fundingAccrued: Decimal;       // For perp positions
  hedgeGroupId: string | null;   // Links paired spot/perp positions
  openedAt: string;
  lastUpdatedAt: string;
  closedAt: string | null;
}
```

**Invariants:**
- `quantity` must be positive (side is expressed in `PositionSide`)
- `notionalUsd` must equal `quantity × currentMarkPrice` (recomputed on every price update)
- If `positionType = 'basis'`, a corresponding position with same `hedgeGroupId` must exist
- `realizedPnl + unrealizedPnl` must equal cumulative fills P&L for this position

#### Position State Machine

```
                    ┌──────────┐
                    │  PENDING  │ (intent created, not yet executed)
                    └────┬─────┘
                         │ OrderFilled (first partial or full)
                         ▼
                    ┌──────────┐
         ┌─────────►│   OPEN   │◄──────────────────────────┐
         │          └────┬─────┘                           │
         │               │                                 │
         │    ┌──────────┼──────────┐                      │
         │    │          │          │                       │
         │    ▼          ▼          ▼                       │
         │  ADDING  REDUCING  PARTIALLY_HEDGED              │
         │    │          │          │                       │
         │    └──────────┴──────────┘                       │
         │               │                                 │
         │               ▼                          AdditionalFill
         │    ┌───────────────────────┐                     │
         │    │  CLOSING_IN_PROGRESS  ├─────────────────────┘
         │    └───────────┬───────────┘
         │                │
         │    ┌───────────┼───────────┐
         │    ▼                       ▼
         │  CLOSED                  FAILED_CLOSE
         │                          (requires manual)
         └─────────────────────────────────────────
           RecoveryAction → OPEN (partial close recovery)
```

### 2.4 Order

Represents a single order instruction submitted to a venue.

```typescript
interface Order {
  id: string;
  correlationId: string;        // Links to originating intent and signal
  portfolioId: string;
  sleeveId: string;
  positionId: string | null;    // Null until position is created
  venueId: string;
  assetId: string;
  side: OrderSide;              // 'buy' | 'sell'
  orderType: OrderType;         // 'market' | 'limit' | 'ioc'
  status: OrderStatus;          // See state machine below
  intentQty: Decimal;           // Requested quantity
  submittedQty: Decimal;        // Quantity sent to venue
  filledQty: Decimal;           // Confirmed filled quantity
  remainingQty: Decimal;        // submittedQty - filledQty
  limitPrice: Decimal | null;   // Null for market orders
  slippageBps: number | null;   // Allowed slippage in basis points
  venueOrderId: string | null;  // Venue-assigned order ID
  rejectionReason: string | null;
  riskCheckResultId: string;    // FK to risk check that approved this order
  createdAt: string;
  submittedAt: string | null;
  lastFillAt: string | null;
  completedAt: string | null;
}
```

**Invariants:**
- `filledQty` must never exceed `submittedQty`
- `remainingQty` must equal `submittedQty - filledQty`
- An order in terminal state (`Filled`, `Cancelled`, `Failed`) must not be modified
- Every order must have a valid `riskCheckResultId` — no order may be submitted without a passing risk check

#### Order State Machine

```
┌──────────┐
│  INTENT  │ (constructed, not yet submitted)
└────┬─────┘
     │ Risk check passed → submit to venue
     │
     ├──── Risk check failed ──► RISK_REJECTED (terminal)
     │
     ▼
┌───────────┐
│ SUBMITTED │ (sent to venue, awaiting acknowledgment)
└─────┬─────┘
      │
      ├──── Venue reject ──────► VENUE_REJECTED (terminal)
      │
      ├──── Timeout/no ack ────► SUBMISSION_TIMEOUT
      │                              │ Retry ──► SUBMITTED
      │                              │ Max retries ──► FAILED (terminal)
      ▼
┌─────────────┐
│ ACKNOWLEDGED│ (venue confirmed receipt)
└──────┬──────┘
       │
       ├──── Partial fill ──────► PARTIAL_FILL
       │                              │ More fills ──► PARTIAL_FILL
       │                              │ Complete ──► FILLED (terminal)
       │                              │ Cancelled ──► PARTIALLY_FILLED_CANCELLED (terminal)
       │
       ├──── Full fill ─────────► FILLED (terminal)
       │
       └──── Cancelled ─────────► CANCELLED (terminal)
```

### 2.5 Fill

Represents a single matched execution event from a venue. Fills are immutable after creation.

```typescript
interface Fill {
  id: string;
  orderId: string;
  venueId: string;
  assetId: string;
  venueFillId: string;          // Venue-assigned fill ID
  side: OrderSide;
  quantity: Decimal;
  price: Decimal;
  fee: Decimal;
  feeAssetId: string;
  fundingPayment: Decimal;      // For perp fills (may be zero)
  filledAt: string;             // Venue-reported timestamp
  recordedAt: string;           // Internal recording timestamp
}
```

**Invariants:**
- Fills are insert-only; no updates or deletes
- `venueFillId` must be unique per venue (prevents double-counting)
- `quantity` and `price` must be strictly positive

### 2.6 Trade

A Trade aggregates one or more fills that collectively constitute a round-trip (entry + exit) for accounting purposes.

```typescript
interface Trade {
  id: string;
  portfolioId: string;
  sleeveId: string;
  positionId: string;
  fillIds: string[];
  side: TradeSide;              // 'entry' | 'exit'
  totalQuantity: Decimal;
  averagePrice: Decimal;
  totalFees: Decimal;
  realizedPnl: Decimal | null;  // Only populated on exit trades
  fundingPnl: Decimal;
  createdAt: string;
}
```

### 2.7 Portfolio

Represents the top-level capital unit. The portfolio is the aggregation point for NAV, exposure, and P&L.

```typescript
interface Portfolio {
  id: string;
  name: string;
  currency: string;             // 'USDC'
  navUsdc: Decimal;             // Current NAV
  peakNavUsdc: Decimal;         // All-time high NAV (for drawdown computation)
  cashUsdc: Decimal;            // Undeployed cash
  grossExposureUsdc: Decimal;
  netExposureUsdc: Decimal;
  currentDrawdown: Decimal;     // (peakNav - currentNav) / peakNav
  leverageRatio: Decimal;
  tradingMode: TradingMode;     // 'paper' | 'live'
  createdAt: string;
  snapshotAt: string;           // Last time this record was recomputed
}
```

**Invariants:**
- `grossExposureUsdc` = sum of absolute notional across all open positions
- `netExposureUsdc` = sum of signed notional across all open positions
- `leverageRatio` = `grossExposureUsdc / navUsdc`
- `currentDrawdown` = `(peakNavUsdc - navUsdc) / peakNavUsdc`
- `peakNavUsdc` is monotonically non-decreasing

### 2.8 Sleeve

A capital allocation sleeve within the portfolio. Each sleeve has a defined strategy, allocation target, and risk budget.

```typescript
interface Sleeve {
  id: string;
  portfolioId: string;
  sleeveType: SleeveType;       // 'carry' | 'treasury'
  status: SleeveStatus;         // See state machine below
  allocationUsdc: Decimal;      // Capital allocated to this sleeve
  allocationTargetPct: Decimal; // Target as % of portfolio NAV
  navUsdc: Decimal;             // Current value including P&L
  grossExposureUsdc: Decimal;
  netExposureUsdc: Decimal;
  unrealizedPnl: Decimal;
  realizedPnl: Decimal;
  lastRegimeId: string | null;  // Regime under which current allocation was set
  updatedAt: string;
}
```

#### Sleeve State Machine

```
┌────────┐
│ ACTIVE │◄──────────────────────────────────────────────┐
└────┬───┘                                               │
     │                                                   │
     ├──── AllocationChanged ──► REBALANCING             │
     │                              │ Complete ──────────┘
     │
     ├──── CircuitBreakerTripped ──► HALTED
     │                              │ CircuitBreakerReset ──► ACTIVE
     │
     ├──── KillSwitchActivated ──► EMERGENCY_CLOSE
     │                              │ AllPositionsClosed ──► CLOSED
     │
     └──── ManualPause ──────────► PAUSED
                                    │ ManualResume ──► ACTIVE
```

### 2.9 Opportunity

A detected carry, basis, or funding arbitrage opportunity before it becomes an order intent.

```typescript
interface Opportunity {
  id: string;
  sleeveId: string;
  opportunityType: OpportunityType; // 'funding_arb' | 'basis' | 'cross_venue_rate'
  assetId: string;
  longVenueId: string;
  shortVenueId: string;
  longFundingRate: Decimal;      // Annualized
  shortFundingRate: Decimal;     // Annualized
  spreadBps: Decimal;            // Gross rate differential in bps
  netSpreadBps: Decimal;         // After estimated fees and slippage
  sizingCandidateUsdc: Decimal;  // Pre-risk-check size candidate
  score: Decimal;                // Normalized opportunity score (0–1)
  status: OpportunityStatus;     // 'detected' | 'acted_on' | 'rejected' | 'expired'
  expiresAt: string;
  detectedAt: string;
  actedOnAt: string | null;
}
```

### 2.10 RiskState

A point-in-time snapshot of portfolio-level risk metrics.

```typescript
interface RiskState {
  id: string;
  portfolioId: string;
  grossExposurePct: Decimal;     // % of NAV
  netExposurePct: Decimal;
  leverageRatio: Decimal;
  liquidityReservePct: Decimal;  // T0 cash as % of NAV
  dailyDrawdown: Decimal;
  weeklyDrawdown: Decimal;
  peakToTroughDrawdown: Decimal;
  venueConcentration: Record<VenueId, Decimal>; // % of gross per venue
  assetConcentration: Record<AssetId, Decimal>; // % of gross per asset
  breachedLimits: RiskLimitId[]; // Any limits currently in breach
  dataAge: Record<string, number>; // Age in ms of key data inputs
  computedAt: string;
}
```

### 2.11 AllocationTarget

The Sentinel allocator's output: a target allocation per sleeve.

```typescript
interface AllocationTarget {
  id: string;
  portfolioId: string;
  regimeId: string;              // Regime that produced this target
  carryAllocationPct: Decimal;
  treasuryAllocationPct: Decimal;
  maxCarryGrossExposurePct: Decimal; // Risk budget for carry sleeve
  rationale: string;             // Human-readable explanation
  effectiveFrom: string;
  supersededAt: string | null;
  createdAt: string;
}
```

### 2.12 AuditEvent

The immutable audit record. See system-overview for envelope definition.

---

## 3. State Machine Summary

| Entity | States | Terminal States |
|---|---|---|
| Order | Intent, Submitted, Acknowledged, PartialFill, Filled, Cancelled, Failed, RiskRejected, VenueRejected | Filled, Cancelled, Failed, RiskRejected, VenueRejected |
| Position | Pending, Open, Adding, Reducing, PartiallyHedged, ClosingInProgress, Closed, FailedClose | Closed |
| Sleeve | Active, Rebalancing, Halted, Paused, EmergencyClose, Closed | Closed |

---

## 4. Entity Relationships

```
Portfolio
  └── has many Sleeves
         └── Carry Sleeve
               ├── holds many Positions
               │      └── aggregated from Fills
               │             └── belong to Orders
               └── tracks many Opportunities
         └── Treasury Sleeve
               └── holds many Positions (treasury protocol deposits)

Portfolio
  └── has many RiskStates (time series)
  └── has many AllocationTargets (time series, from Sentinel)
  └── has many NAVSnapshots (time series)

Order
  └── belongs to Sleeve
  └── has many Fills
  └── belongs to RiskCheckResult

AuditEvent
  └── references any entity by (entityType, entityId)
```

---

## 5. Invariants

The following invariants must hold at all times. Violations are treated as critical system errors.

**Portfolio-level:**
- INV-P-01: `portfolio.navUsdc` = `portfolio.cashUsdc` + sum(`sleeve.navUsdc`)
- INV-P-02: `portfolio.grossExposureUsdc` = sum(`abs(position.notionalUsd)`) across all open positions
- INV-P-03: `portfolio.netExposureUsdc` = sum(`signed(position.notionalUsd)`) across all open positions
- INV-P-04: `portfolio.peakNavUsdc` >= `portfolio.navUsdc` at all times
- INV-P-05: `portfolio.leverageRatio` = `portfolio.grossExposureUsdc / portfolio.navUsdc`

**Order/Fill consistency:**
- INV-O-01: sum(`fill.quantity`) for an order must equal `order.filledQty`
- INV-O-02: An order in terminal state must not receive new fills
- INV-O-03: Every order must have a `riskCheckResultId` with status `Approved`

**Position/Fill consistency:**
- INV-POS-01: sum(`fill.quantity × fill.price`) for position entry fills equals `position.entryPrice × position.quantity` (VWAP basis)
- INV-POS-02: A closed position must have `realizedPnl` computed and non-null

**Hedge integrity:**
- INV-H-01: For any position with `hedgeGroupId`, a corresponding counter-position with the same `hedgeGroupId` must exist
- INV-H-02: The sum of signed delta across all positions in a hedge group must be within the configured hedge tolerance

**Audit:**
- INV-A-01: Every state transition for a tracked entity must have a corresponding `AuditEvent`
- INV-A-02: `AuditEvent` records are never modified after creation

---

## 6. Event Types by Entity Lifecycle

### Portfolio Events
| Event | Trigger |
|---|---|
| `portfolio.created` | Portfolio initialized |
| `portfolio.nav_updated` | NAV recomputed after fill or price update |
| `portfolio.peak_nav_updated` | New all-time high NAV |
| `portfolio.drawdown_breached` | Drawdown limit exceeded |

### Sleeve Events
| Event | Trigger |
|---|---|
| `sleeve.activated` | Sleeve transitions to Active |
| `sleeve.allocation_changed` | Sentinel issues new AllocationTarget |
| `sleeve.rebalancing_started` | Rebalance process begins |
| `sleeve.rebalancing_completed` | Rebalance process ends |
| `sleeve.halted` | Circuit breaker trips |
| `sleeve.resumed` | Circuit breaker reset |
| `sleeve.paused` | Manual pause by operator |
| `sleeve.emergency_close_started` | Kill switch activated |
| `sleeve.emergency_close_completed` | All positions closed |

### Order Events
| Event | Trigger |
|---|---|
| `order.intent_created` | Order intent constructed from opportunity |
| `order.risk_approved` | Pre-trade risk check passed |
| `order.risk_rejected` | Pre-trade risk check failed |
| `order.submitted` | Order sent to venue |
| `order.acknowledged` | Venue confirmed receipt |
| `order.partial_fill` | Partial fill received |
| `order.filled` | Order fully filled |
| `order.cancelled` | Order cancelled (system or venue) |
| `order.failed` | Order failed after exhausting retries |
| `order.venue_rejected` | Venue explicitly rejected the order |

### Position Events
| Event | Trigger |
|---|---|
| `position.opened` | First fill creates position |
| `position.increased` | Additional fill increases existing position |
| `position.decreased` | Closing fill reduces position size |
| `position.hedge_degraded` | Hedge ratio falls below threshold |
| `position.hedge_restored` | Hedge ratio returns to threshold |
| `position.close_initiated` | Close order submitted |
| `position.closed` | Position fully closed |

### Risk Events
| Event | Trigger |
|---|---|
| `risk.limit_breached` | Any risk limit exceeded |
| `risk.limit_restored` | Breached limit returns within bounds |
| `risk.circuit_breaker_tripped` | Circuit breaker condition met |
| `risk.circuit_breaker_reset` | Circuit breaker manually or automatically reset |
| `risk.stale_data_detected` | Input data age exceeds threshold |
| `risk.kill_switch_activated` | Manual kill switch triggered |
| `risk.kill_switch_reset` | Kill switch manually cleared |

### Opportunity Events
| Event | Trigger |
|---|---|
| `opportunity.detected` | New carry/basis opportunity identified |
| `opportunity.acted_on` | Intent created from opportunity |
| `opportunity.rejected` | Opportunity failed risk pre-screen |
| `opportunity.expired` | Opportunity window closed before action |
