# Risk Framework: Sentinel Apex

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-18

---

## 1. Overview

This document defines the formal risk framework governing all capital deployment decisions within Sentinel Apex. The framework is enforced programmatically: risk limits are configured parameters with defined defaults, not policy suggestions. No order intent may proceed to execution without passing the full pre-trade check pipeline.

The risk framework operates at two levels:

1. **Pre-trade:** Point-in-time checks that evaluate a proposed order intent against current portfolio state and configured limits. Any failed check rejects the intent with a documented reason.
2. **Portfolio-level:** Continuous monitoring of aggregate risk metrics. Breaches at this level trigger circuit breakers, de-risking, and in severe cases, the kill switch.

---

## 2. Risk Taxonomy

### 2.1 Market Risk

The risk of loss arising from adverse movements in asset prices, funding rates, or basis spreads.

**Primary exposures:**
- **Delta risk:** Net directional exposure if hedge ratio degrades below target
- **Funding rate risk:** Adverse change in funding rates that erodes carry spread
- **Basis risk:** Unexpected divergence between spot and perp prices during basis trade convergence
- **Correlation breakdown:** Simultaneous adverse moves across multiple positions (e.g., funding rates turning negative across all pairs)

**Mitigation:**
- Net delta limits enforced at portfolio level
- Hedge ratio monitoring with alerts below threshold
- Spread floor requirement before entry (minimum net spread after fees)
- Cross-pair correlation monitoring in risk engine

### 2.2 Liquidity Risk

The risk of being unable to exit positions at fair value when required, or of being unable to meet margin calls.

**Primary exposures:**
- **Position liquidity:** Inability to close carry positions due to thin order book depth on Drift or CEX
- **Margin liquidity:** Insufficient USDC margin to maintain perp positions during adverse funding
- **Treasury liquidity:** T0 reserve insufficient to meet withdrawal or margin requirements
- **Redemption queue:** Inability to process capital allocator withdrawals in a timely manner

**Mitigation:**
- Position sizing based on venue order book depth
- T0 reserve minimum enforced programmatically
- Liquidity stress testing in backtesting harness
- Maximum single-venue concentration limits

### 2.3 Execution Risk

The risk of order outcomes deviating from intent due to slippage, venue failures, or partial fills.

**Primary exposures:**
- **Slippage:** Fill prices materially worse than signal prices
- **Partial fills:** Positions entered partially, leaving unintended exposure
- **Rejection:** Venue rejects order (margin, risk limits, maintenance)
- **Latency:** Execution delay causing stale price exposure

**Mitigation:**
- Slippage tolerance configured per venue and order type
- Partial fill monitoring: partial position entered without corresponding hedge triggers alert
- Retry logic with exponential backoff; failed retries escalate to operator
- Fill price validation against signal price at time of order creation

### 2.4 Operational Risk

The risk of loss arising from system failures, process errors, or human error.

**Primary exposures:**
- **System downtime:** Execution loop stops, leaving open positions unmonitored
- **Reconciliation failure:** Internal state diverges from on-chain/venue state
- **Configuration error:** Misconfigured limits, incorrect venue parameters
- **Key compromise:** Private key or API key exposure leading to unauthorized trading

**Mitigation:**
- Fail-closed design: any system component failure halts new order submission
- Mandatory reconciliation loop; divergence above threshold triggers halt
- Configuration validation at startup; invalid config prevents startup
- Key management procedures (hardware wallet in production, no keys in code or database)

### 2.5 Counterparty Risk

The risk of loss arising from the failure of a venue, protocol, or counterparty.

**Primary exposures:**
- **DEX smart contract risk:** Drift Protocol vulnerability, upgrade, or exploit
- **CEX insolvency or withdrawal freeze:** Locked funds on centralized exchange
- **Treasury protocol failure:** Marginfi or Kamino smart contract exploit or economic failure
- **Stablecoin depeg:** USDC or other stablecoin used as margin/collateral depegs

**Mitigation:**
- Venue concentration limits prevent over-exposure to any single counterparty
- Treasury protocol concentration limits
- Stablecoin peg monitoring; depeg alert if deviation > 0.1% from $1.00
- CEX funds held only as operational margin, not as primary reserves

---

## 3. Risk Metrics

### 3.1 Exposure Metrics

| Metric | Definition | Computation |
|---|---|---|
| Gross Exposure | Total absolute notional across all positions | Σ \|position.notionalUsd\| |
| Net Exposure | Net signed notional (long minus short) | Σ position.signedNotionalUsd |
| Gross Exposure % NAV | Gross exposure as fraction of portfolio NAV | grossExposureUsd / navUsd |
| Net Exposure % NAV | Net exposure as fraction of portfolio NAV | netExposureUsd / navUsd |
| Leverage Ratio | Gross exposure relative to NAV | grossExposureUsd / navUsd |
| Hedge Ratio | Degree to which long exposure is hedged | abs(shortNotional) / longNotional |

### 3.2 Concentration Metrics

| Metric | Definition | Computation |
|---|---|---|
| Venue Concentration | Max share of gross exposure at any single venue | max(venueNotional[v] / grossExposure) |
| Asset Concentration | Max share of gross exposure in any single base asset | max(assetNotional[a] / grossExposure) |
| Treasury Protocol Concentration | Share of treasury allocation at any single protocol | protocolBalance / totalTreasuryBalance |

### 3.3 Drawdown Metrics

| Metric | Definition | Computation |
|---|---|---|
| Daily Drawdown | Intraday loss from day-open NAV | (navOpen - navCurrent) / navOpen |
| Rolling 7-day Drawdown | Loss from highest NAV in past 7 days | (nav7dPeak - navCurrent) / nav7dPeak |
| Peak-to-Trough Drawdown | Loss from all-time high NAV | (peakNav - navCurrent) / peakNav |

### 3.4 Liquidity Metrics

| Metric | Definition |
|---|---|
| Liquidity Reserve Ratio | T0 cash + T0 treasury as % of portfolio NAV |
| Available T0 Liquidity | Instantly redeemable funds in USD |
| Margin Utilization | Used margin / available margin on each venue |

---

## 4. Risk Limits

All limits are configurable. The following are production defaults. Any change to production risk limits requires a documented config change with approval and is logged as an AuditEvent.

### 4.1 Portfolio-Level Limits

| Limit ID | Parameter | Default | Hard Cap |
|---|---|---|---|
| RL-001 | Max gross exposure % NAV | 200% | 200% |
| RL-002 | Max net exposure % NAV | 20% | 20% |
| RL-003 | Max leverage ratio | 3.0x | 3.0x |
| RL-004 | Min liquidity reserve % NAV | 10% | 10% |
| RL-005 | Max daily drawdown | 2% | 2% |
| RL-006 | Max rolling 7-day drawdown | 5% | 5% |
| RL-007 | Max peak-to-trough drawdown | 15% | 15% |

### 4.2 Concentration Limits

| Limit ID | Parameter | Default | Hard Cap |
|---|---|---|---|
| RL-008 | Max single venue % gross | 40% | 40% |
| RL-009 | Max single asset % gross | 30% | 30% |
| RL-010 | Max single treasury protocol % treasury | 50% | 50% |
| RL-011 | Max CEX gross exposure % total gross | 60% | 60% |

### 4.3 Carry-Specific Limits

| Limit ID | Parameter | Default | Hard Cap |
|---|---|---|---|
| RL-012 | Min hedge ratio (carry positions) | 95% | 90% |
| RL-013 | Min net spread to enter (annualized, after fees) | 3% | 2% |
| RL-014 | Max single opportunity size % NAV | 10% | 15% |
| RL-015 | Max total carry sleeve gross % NAV | 150% | 180% |

### 4.4 Staleness Limits

| Limit ID | Parameter | Default | Hard Cap |
|---|---|---|---|
| RL-016 | Max price data age (carry entry) | 10s | 30s |
| RL-017 | Max funding rate data age | 60s | 120s |
| RL-018 | Max position reconciliation age | 60s | 120s |
| RL-019 | Max risk state age (for pre-trade checks) | 30s | 60s |

---

## 5. Pre-Trade Check Pipeline

Every order intent passes through the following checks in sequence. A failure at any step rejects the intent immediately; subsequent checks are not evaluated.

```
OrderIntent
     │
     ▼
[CHECK 1: Circuit Breaker State]
  Is the relevant sleeve or portfolio circuit breaker open?
  → FAIL: Reject with reason 'CircuitBreakerOpen'
     │
     ▼
[CHECK 2: Data Staleness]
  Is any required input data (price, funding rate, risk state) older than staleness limit?
  → FAIL: Reject with reason 'StaleData:<field>'
     │
     ▼
[CHECK 3: Gross Exposure]
  Would this order, if filled, cause portfolio gross exposure > RL-001?
  → FAIL: Reject with reason 'GrossExposureLimitBreached'
     │
     ▼
[CHECK 4: Net Exposure]
  Would this order cause portfolio net exposure > RL-002?
  → FAIL: Reject with reason 'NetExposureLimitBreached'
     │
     ▼
[CHECK 5: Leverage]
  Would this order cause leverage ratio > RL-003?
  → FAIL: Reject with reason 'LeverageLimitBreached'
     │
     ▼
[CHECK 6: Venue Concentration]
  Would this order cause single-venue concentration > RL-008?
  → FAIL: Reject with reason 'VenueConcentrationLimitBreached:<venueId>'
     │
     ▼
[CHECK 7: Asset Concentration]
  Would this order cause single-asset concentration > RL-009?
  → FAIL: Reject with reason 'AssetConcentrationLimitBreached:<assetId>'
     │
     ▼
[CHECK 8: Liquidity Reserve]
  Would this order consume capital that would push liquidity reserve below RL-004?
  → FAIL: Reject with reason 'LiquidityReserveBreached'
     │
     ▼
[CHECK 9: Carry-Specific: Hedge Integrity]
  (Carry orders only) Does this order maintain or improve hedge ratio above RL-012?
  → FAIL: Reject with reason 'HedgeRatioBelowMinimum'
     │
     ▼
[CHECK 10: Carry-Specific: Spread Floor]
  (Carry entry orders only) Is net spread after fees above RL-013?
  → FAIL: Reject with reason 'SpreadBelowMinimum'
     │
     ▼
APPROVED → Submit to execution layer
```

All check results are persisted as `RiskCheckResult` records and linked to the order intent. Both passing and failing results are stored.

---

## 6. Circuit Breakers

Circuit breakers are named, independently managed mechanisms that halt specific categories of activity. They do not automatically reset; reset requires operator intervention unless configured with an automatic cooldown.

### 6.1 Defined Circuit Breakers

| ID | Name | Trip Condition | Effect | Auto-Reset |
|---|---|---|---|---|
| CB-001 | DailyDrawdown | Daily drawdown > RL-005 | Halt all new carry entry orders | No |
| CB-002 | WeeklyDrawdown | Weekly drawdown > RL-006 | Halt all new carry entry orders; begin orderly position reduction | No |
| CB-003 | VenueCircuitBreaker | 3 consecutive order failures at venue | Halt all orders to that venue | 15-minute cooldown |
| CB-004 | StaleData | Any required data input > hard staleness cap | Halt all new order submission system-wide | Auto-reset when data freshens |
| CB-005 | HedgeDegradation | Hedge ratio < 90% for > 5 minutes | Halt new carry entries; alert operator | No |
| CB-006 | ReconciliationFailure | Internal vs. on-chain discrepancy > 0.1% for > 2 reconciliation cycles | Halt all new order submission | No |

### 6.2 Circuit Breaker Behavior

When a circuit breaker trips:

1. The `CircuitBreakerTripped` audit event is written immediately
2. The affected sleeve (or all sleeves for system-wide breakers) transitions to `Halted`
3. In-flight orders are allowed to complete (not cancelled) unless the breaker is CB-006 (ReconciliationFailure)
4. No new order intents are created for the halted sleeve
5. An alert is raised via the configured alerting channel
6. The ops dashboard displays the active circuit breaker with trip reason and timestamp

### 6.3 Circuit Breaker Reset

All resets are manual except CB-003 (auto-cooldown) and CB-004 (auto-reset on data freshness):

1. Operator authenticates and reviews the trip reason in the dashboard
2. Operator confirms the underlying condition is resolved
3. Operator clicks "Reset Circuit Breaker" in the ops dashboard, entering a confirmation code
4. System writes `CircuitBreakerReset` audit event with operator identity
5. Sleeve transitions from `Halted` to `Active`
6. Risk state is recomputed before first new order is permitted

---

## 7. Kill Switch

The kill switch is a system-wide emergency stop. It initiates immediate position closure across all sleeves.

### 7.1 Activation Conditions

- **Automatic:** Portfolio peak-to-trough drawdown exceeds RL-007 (15%)
- **Manual:** Operator activates via ops dashboard with double-confirmation

### 7.2 Kill Switch Behavior

Upon activation:

1. `KillSwitchActivated` audit event written with activation source (system or operator identity)
2. All sleeves transition to `EmergencyClose`
3. All pending order intents are discarded
4. System submits market close orders for all open positions, prioritizing the largest positions first
5. No new order intents are created during emergency close
6. System logs each close order as it is submitted and filled
7. Once all positions are closed and confirmed on-chain, `EmergencyCloseCompleted` event is written
8. System transitions to `Closed` state; no automated activity resumes

### 7.3 Kill Switch Recovery

Recovery requires explicit operator action and is intentionally slow:

1. Operator reviews all audit events from the kill switch activation through position closure
2. Operator documents the root cause
3. If automatic activation: the underlying limit breach must be resolved (NAV recovery above circuit breaker threshold is not sufficient — manual review is required regardless)
4. Operator resets kill switch state via ops dashboard with two-operator confirmation in production
5. System reinitializes in paper-trading mode; operator must explicitly re-enable live trading

---

## 8. Stale Data Handling

### 8.1 Policy

The risk engine tracks the age of all inputs used in pre-trade checks and portfolio risk computations:

- Funding rates per venue
- Mark prices per asset
- Order book depth per venue
- Portfolio NAV and position state (from last reconciliation)

### 8.2 Staleness Thresholds

Two thresholds apply per input type:

- **Warning threshold:** Log a warning; pre-trade checks still pass but include a staleness warning in the result
- **Hard threshold (RL-016 to RL-019):** Pre-trade checks fail with `StaleData` rejection; CB-004 trips if any hard threshold is exceeded

### 8.3 Staleness Handling During Position Close

Stale data does NOT block position close orders. If the system is attempting to close positions (emergency or circuit-breaker-triggered closure), close orders proceed using last-known prices. This is by design: the risk of holding open positions without data is greater than the slippage risk of closing with stale prices.

---

## 9. Execution Failure Handling

### 9.1 Failure Categories

| Category | Definition | Response |
|---|---|---|
| Transient | Network timeout, temporary venue unavailability | Retry with exponential backoff (max 3 attempts) |
| Venue Rejection | Venue explicitly rejects order (margin, risk, param error) | Log rejection reason; do not retry; alert operator if unexpected |
| Partial Fill Timeout | Order partially filled; no further activity for > 30s | Cancel remaining; log partial fill state; monitor hedge impact |
| Submission Failure | Order could not be sent to venue (connection failure) | Retry; if all retries fail, log as Failed and trigger CB-003 |

### 9.2 Unhedged Position Handling

If a carry entry order fills on one leg (e.g., spot buy executed) but the corresponding hedge leg (e.g., perp short) fails:

1. The position is marked as `PartiallyHedged` in the position state machine
2. CB-005 (HedgeDegradation) is evaluated immediately
3. An alert is raised via the alerting channel
4. The system attempts to submit the missing hedge leg for up to 5 minutes
5. If the hedge cannot be restored, the system submits a close order for the unhedged leg

### 9.3 Duplicate Order Prevention

Each order has a client-generated `correlationId` that is submitted to venues supporting idempotency keys. Before submitting any order, the system checks for an existing order with the same `correlationId` in the database. If found in a non-terminal state, the submission is skipped and the existing order is monitored.

---

## 10. Manual Intervention Workflow

### 10.1 Permitted Operator Actions

| Action | Description | Audit Required | Confirmation Required |
|---|---|---|---|
| Pause Sleeve | Stop new order creation for a sleeve | Yes | Single confirmation |
| Resume Sleeve | Re-enable paused sleeve | Yes | Single confirmation |
| Reset Circuit Breaker | Clear a tripped circuit breaker | Yes | Operator confirmation + code |
| Force Close Position | Submit market close for a specific position | Yes | Double confirmation |
| Adjust Risk Limits | Change configurable limit values | Yes | Documented change + approval |
| Activate Kill Switch | Emergency stop all activity | Yes | Double confirmation |
| Reset Kill Switch | Re-enable system after emergency stop | Yes | Two-operator confirmation (production) |

### 10.2 Audit Requirements

All manual interventions must:
- Be authenticated (operator identity recorded)
- Produce an `AuditEvent` with operator ID, action, inputs, and timestamp
- Be visible in the audit log viewer in the ops dashboard
- Include a reason field (free text, mandatory) explaining why the intervention was taken

---

## 11. Risk Event Types and Escalation

### 11.1 Event Severity Levels

| Level | Description | Response Time | Notification |
|---|---|---|---|
| INFO | Normal operation metric update | None | Log only |
| WARNING | Approaching limit threshold (>80% of limit) | Monitor | Dashboard indicator |
| ALERT | Limit breached or circuit breaker tripped | < 15 minutes | Dashboard + alerting channel |
| CRITICAL | Kill switch activation or unrecoverable failure | Immediate | Dashboard + alerting + on-call page |

### 11.2 Escalation Matrix

| Condition | Level | Escalation |
|---|---|---|
| Gross exposure > 80% of limit | WARNING | Dashboard indicator |
| Daily drawdown > 1% | WARNING | Dashboard indicator |
| Any circuit breaker tripped | ALERT | Alerting channel notification |
| Hedge ratio < 93% | ALERT | Alerting channel notification |
| Stale data > warning threshold | WARNING | Log + dashboard |
| Stale data > hard threshold (CB-004) | ALERT | Alerting channel notification |
| Kill switch activated | CRITICAL | Alerting + on-call page |
| Reconciliation failure > 0.5% | CRITICAL | Alerting + on-call page |
| Portfolio drawdown > 10% | CRITICAL | Alerting + on-call page |
