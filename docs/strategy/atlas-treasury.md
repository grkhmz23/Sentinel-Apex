# Atlas Treasury Strategy: Specification

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-21

## Implementation Status

Phase 3.1 establishes the first controlled treasury execution foundation in the repo.
Phase 3.2 adds operator-grade workflow depth and connector readiness visibility on top of that execution foundation.

Implemented now:

- dedicated `packages/treasury` policy engine
- treasury reserve and concentration evaluation
- treasury execution-intent planning and blocked-reason assessment
- explicit simulated treasury venue adapters
- runtime-integrated treasury evaluation during real runtime cycles
- persisted treasury runs, venue snapshots, actions, execution history, and current read models
- treasury approval and controlled execution via runtime commands
- treasury API and ops-dashboard visibility for recommendations and execution state
- treasury action detail, execution detail, and venue readiness drill-through
- structured blocked-reason categories with operator guidance
- venue readiness metadata for simulated, read-only, and live-approval posture
- connector onboarding and live-enable runbooks

Not implemented yet:

- live treasury connectors
- allocator-driven target setting
- autonomous treasury execution without operator approval
- full regime-aware tiering from this strategy document

The rest of this document remains the target strategic design. The current runtime implementation is a smaller production-ready foundation aligned to that target.

## Phase 3.1 Runtime Boundary

Phase 3.1 makes Atlas Treasury operationally executable without overstating what exists:

- treasury actions can be approved and executed
- execution is still controlled, operator-mediated, and backend revalidated
- simulated treasury execution is explicitly labeled simulated
- live treasury execution still depends on future live-capable treasury connectors

## Phase 3.2 Operator Boundary

Phase 3.2 does not add allocator autonomy. It adds:

- action, execution, and venue drill-through
- structured policy and risk explanations for blocked actions
- explicit connector readiness visibility
- operator runbooks for onboarding and live-enable review

It still does not claim:

- allocator-driven treasury targets
- generic connector orchestration
- production-ready real treasury integrations in this repo today

---

## 1. Purpose and Role

Atlas Treasury manages all capital within the portfolio that is not actively deployed in Apex Carry positions. Its objectives are:

1. **Preserve capital:** No speculative risk on treasury allocation. All approved venues must have defined principal protection characteristics or well-understood collateral risk.
2. **Generate incremental yield:** Deploy idle capital into yield-bearing instruments rather than holding USDC in an uninvested wallet.
3. **Maintain liquidity for carry operations:** Ensure that the carry sleeve can always source margin or collateral on demand without needing to unwind treasury positions through illiquid channels.
4. **Maintain withdrawal liquidity:** Ensure that capital allocator withdrawal requests can be serviced within the committed timeframe.

Atlas Treasury is a capital preservation and liquidity management sleeve, not an alpha sleeve. Its contribution to portfolio yield is secondary to its role as a liquidity buffer.

---

## 2. Approved Venue Types

Only pre-approved venue types are eligible for treasury allocation. Approval of new venue types requires a documented risk assessment and explicit inclusion in the configuration.

### 2.1 T0: Instant Redemption

Venues in this tier can return capital within the same block or within seconds. Capital here is treated as equivalent to cash for liquidity purposes.

| Venue Type | Example Protocols | Characteristics |
|---|---|---|
| On-chain overcollateralized lending (withdraw-on-demand) | Marginfi (supply), Kamino (lending market supply) | Yield accrues continuously; withdrawal is a single on-chain transaction with no lock or queue |
| Stablecoin yield aggregators with instant redemption | Protocols with no lock and on-chain liquidity | Must have > $10M TVL and audited smart contracts |

**Minimum T0 allocation:** By default, at least 10% of portfolio NAV must be held in T0 at all times (RL-004). This is the liquidity reserve floor.

### 2.2 T1: Same-Day Redemption

Venues where capital can be withdrawn within the same business day but may require a manual transaction or short queue.

| Venue Type | Example Protocols | Characteristics |
|---|---|---|
| Lending markets with queued withdrawal | Protocols with withdrawal queues < 4 hours | Yield is typically higher than T0; redemption requires monitoring |
| Short-duration stable yield vaults | Protocols with rolling 24h windows | Must have documented redemption window in config |

**Maximum T1 allocation:** 60% of treasury allocation (configurable). Cannot hold more capital in T1 than the T0 reserve could cover in a margin call scenario.

### 2.3 T2: 1–3 Day Redemption

Venues where capital redemption takes 1–3 business days, typically due to LP withdrawal mechanics or governance-enforced unlocks.

| Venue Type | Example Protocols | Characteristics |
|---|---|---|
| Stable liquidity pool LP positions | Select concentrated stable pairs | Withdrawal may involve IL risk if pool composition shifts; must be near-zero IL pairs (e.g., USDC/USDT) |
| Short-duration yield protocols with defined unlock | Protocols with < 3-day unlock periods | Unlock period must be hardcoded and verifiable on-chain |

**Maximum T2 allocation:** 30% of treasury allocation (configurable). T2 capital is considered illiquid for margin and withdrawal purposes. T2 allocation must be reduced as portfolio drawdown increases (see Section 6).

---

## 3. Allocation Policy

### 3.1 Tiered Allocation Structure

Treasury capital is allocated according to the following tiered structure:

```
Total Treasury Capital
    │
    ├── T0 Reserve (mandatory minimum: 10% of portfolio NAV)
    │     └── Always maintained; reduced allocation to T1/T2 before this floor is breached
    │
    ├── T0 Discretionary (capital above reserve, still deployed in T0 venues)
    │     └── Used when T1/T2 venues are at capacity or during de-risking
    │
    ├── T1 Allocation (target: 40–60% of treasury, subject to caps)
    │     └── Deployed when opportunity yield exceeds T0 yield by > configurable threshold
    │
    └── T2 Allocation (target: 0–30% of treasury, subject to caps and regime)
          └── Deployed only in Neutral or Bull regimes; reduced in Bear/Stressed/Crisis
```

### 3.2 Target Allocation by Regime

The Sentinel allocator provides treasury with a regime-adjusted allocation target. The treasury sleeve respects this target:

| Regime | T0 (min) | T1 (target) | T2 (max) |
|---|---|---|---|
| Bull | 10% NAV | Up to 60% treasury | Up to 30% treasury |
| Neutral | 10% NAV | Up to 55% treasury | Up to 25% treasury |
| Bear | 15% NAV | Up to 50% treasury | Up to 15% treasury |
| Stressed | 20% NAV | Up to 40% treasury | 0% |
| Crisis | 30% NAV | Up to 30% treasury | 0% |

In Stressed and Crisis regimes, T2 positions are actively unwound to the extent possible within their redemption windows.

### 3.3 Protocol Concentration Limits

No single protocol may hold more than 50% of the total treasury allocation (RL-010, configurable). This applies independently of tier. If a single T0 protocol would exceed 50% of treasury, the excess is held in uninvested USDC or a second T0 protocol.

Absolute minimum diversification: at least 2 protocols must be active when treasury > $500,000 notional.

### 3.4 Deployment Trigger

Idle capital (uninvested USDC above T0 reserve) is deployed to treasury venues with a maximum deployment delay:

- **Normal regime:** 30 minutes from when idle capital is identified
- **Rebalance event:** 60 minutes from when Sentinel issues an updated AllocationTarget
- **Carry close event:** 15 minutes from when a carry position closes and capital is returned to the sleeve

Deployment is delayed if:
- Venue gas fees make the yield economically unviable given expected holding period
- The target venue has a circuit breaker active
- Data on the target venue is stale beyond the staleness limit

---

## 4. Withdrawal Reserve Policy

### 4.1 Reserve Floor

The T0 reserve floor (RL-004: default 10% NAV) is a hard programmatic constraint. The system will not execute any allocation that would push T0 liquidity below this floor. Specifically:

- No T1 or T2 deployment is executed if it would breach the T0 floor after accounting for in-flight transactions
- If carry margin requirements consume T0 capital and push the reserve below the floor, the treasury sleeve initiates T1 redemption immediately (before the floor is actually breached)

### 4.2 Predictive Reserve Management

The treasury engine maintains a 24-hour forward look at expected cash requirements:

```
expectedCashDemand24h =
    estimatedCarryMarginBuffer +
    scheduledWithdrawals +
    worstCaseHedgeAdjustment

requiredT0 = max(RL-004 × portfolioNAV, expectedCashDemand24h × 1.2)
```

If `requiredT0 > currentT0Available`, T1 redemption is initiated to top up T0 before the shortfall materializes.

### 4.3 Margin Call Buffer

The carry sleeve may require additional USDC margin on short perp positions if mark prices move adversely. The treasury sleeve maintains a margin call buffer sized at:

```
marginCallBuffer = carrySleeveGrossNotional × maxAdverseMarkMoveAssumption
  # Default: 5% of carry gross notional
```

This buffer must be held in T0 at all times when the carry sleeve is active.

---

## 5. Rebalance Triggers

The treasury sleeve initiates a rebalance when any of the following conditions are met:

| Trigger ID | Condition | Action |
|---|---|---|
| RB-01 | T0 reserve falls below 110% of floor | Redeem T1 to restore T0 |
| RB-02 | Any single protocol exceeds 50% of treasury | Reduce excess to secondary protocol or USDC |
| RB-03 | Idle USDC exceeds 5% of treasury for > 30 minutes | Deploy idle capital per allocation policy |
| RB-04 | Sentinel issues new AllocationTarget | Rebalance to new tier targets within 60 minutes |
| RB-05 | Carry sleeve closes > 20% NAV of positions | Redeploy freed capital to treasury within 15 minutes |
| RB-06 | T2 position redemption window is within 24 hours of expiry | Initiate redemption before window closes |
| RB-07 | Yield differential between T0 and T1 narrows below threshold | Collapse T1 to T0 if spread < 1% annualized |
| RB-08 | Regime transitions to Stressed or Crisis | Immediately begin T2 unwind |

Rebalance execution follows the same order submission and risk check pipeline as carry orders. All treasury rebalance transactions produce AuditEvents with trigger ID, before/after allocation state, and timestamp.

---

## 6. Drawdown-Aware Allocation Adjustment

Treasury allocation shifts as portfolio drawdown increases:

| Drawdown Level | T0 Floor Increase | T2 Max Reduction |
|---|---|---|
| > 3% | T0 floor → 12% NAV | T2 max → 20% treasury |
| > 5% | T0 floor → 15% NAV | T2 max → 10% treasury |
| > 7% | T0 floor → 20% NAV | T2 max → 0% (begin unwind) |
| > 10% | T0 floor → 25% NAV | All T2 must be unwinding |
| Kill switch | T0 floor → 100% (full liquidity) | All positions unwinding |

These adjustments are automatic and triggered by the risk engine's drawdown metric. They do not require operator action.

---

## 7. Risk Controls

### 7.1 Smart Contract Risk Mitigation

All approved protocols must satisfy minimum criteria before capital deployment:

- Protocol audit by two independent reputable firms within the past 12 months
- Minimum $20M TVL sustained for > 90 days
- No unresolved critical findings in any public audit
- Protocol has been live on mainnet for > 6 months without an exploit
- Withdrawal mechanism is documented and on-chain verifiable

### 7.2 Stablecoin Risk

All treasury yield is denominated in USDC. If any stablecoin used as treasury collateral depegs by > 0.1%, the following actions are triggered:

- Alert raised to operator
- No new deposits to protocols using the depegged stablecoin
- If depeg exceeds 0.5% for > 15 minutes: begin redemption from affected protocols

### 7.3 Protocol Failure Handling

If a treasury protocol becomes unresponsive (withdrawal transaction reverts or times out repeatedly):

1. Circuit breaker for that venue is opened
2. No new deposits to that venue
3. Operator is alerted
4. If total exposure to the failed venue exceeds 10% of treasury: critical alert and manual review required
5. Position is marked as `Impaired` in internal state; NAV impact is computed at last known value pending resolution

### 7.4 On-Chain Reconciliation

Treasury positions are reconciled against on-chain state every 5 minutes. Reconciliation checks:

- Protocol-reported deposit balance matches internal record
- Accrued interest is captured accurately
- No unexpected withdrawal or transfer events on the protocol-side

Discrepancies > 0.01% trigger a warning. Discrepancies > 0.1% trigger CB-006 (ReconciliationFailure).

---

## 8. Integration with Sentinel Allocator

The Sentinel allocator treats treasury as a passive receiver of allocation instructions. The integration contract:

- Sentinel publishes `AllocationTarget` records that include `treasuryAllocationPct` and an implicit tier breakdown
- Treasury sleeve reads the latest `AllocationTarget` and computes the required rebalance
- Treasury sleeve reports its current NAV, tier breakdown, and T0 available to the portfolio-level risk state
- During de-risking triggered by Sentinel, treasury acts as the primary buffer: capital moves from carry → treasury T0, not from treasury to anything less liquid
- Treasury never independently initiates an allocation that contradicts Sentinel's current target without logging the override reason

Communication is via the domain event bus, not direct function calls. Treasury subscribes to `AllocationChanged` events and produces `TreasuryRebalanceCompleted` events when the rebalance is done.
