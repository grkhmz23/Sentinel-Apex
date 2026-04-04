# Apex Carry Strategy: Specification

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-04-01

## Phase 6.0 Addendum: First Real Devnet Execution Boundary

Phase 6.0 does not broaden the carry thesis. It adds the first honest real execution connector under the existing carry control plane.

Current execution truth:

- the first real connector is `drift-solana-devnet-carry`
- it is devnet only
- it supports only BTC-PERP reduce-only market orders
- it reuses the existing carry action approval and runtime command rail
- it persists real Solana transaction signatures as execution references
- it does not add generic order entry, increase-exposure execution, or broad live carry trading

Operationally, this means the carry sleeve can now prove one real gated reduction path end to end, but it still does not claim broad autonomous or multi-market deployment.

## Phase 5.6 Addendum: Internal Derivative State Boundary

Phase 5.6 does not change the carry thesis. It changes how Sentinel Apex represents the carry sleeve's internal derivative posture for comparison against external Drift-native truth.

Current internal derivative state truth:

- configured Drift account identity is treated as canonical internal account state
- open carry-related derivative orders are treated as canonical internal order inventory when they exist in persisted runtime orders
- open derivative positions are reconstructed from persisted fills and remain explicitly marked as derived internal state
- internal health and margin-like state remain unsupported

Operationally, this means carry execution now feeds a durable internal derivative comparison layer, but the runtime still does not pretend allocator budgets, generic risk snapshots, or external venue truth are themselves the canonical internal derivative state.

## Phase 5.7 Addendum: Derived Internal Health And Richer Market Identity

Phase 5.7 does not widen carry execution scope. It improves how the existing carry sleeve is compared against Drift-native truth.

Current derivative comparison truth:

- internal health posture is now derived from persisted portfolio and risk projections
- this health posture is explicitly marked as derived and only supports band-level comparison against external Drift health
- exact venue-native collateral, free-collateral, margin-ratio, and requirement fields remain external-only
- internal market identity now preserves venue-native keys when runtime metadata truly has them
- when exact keys are absent, the runtime falls back honestly to derived market symbol or asset-plus-market-type identity
- reconciliation can now distinguish:
  - exact market-identity mismatch
  - position identity gap
  - partial market-identity comparison
  - partial health comparison

Operationally, this means carry operators can inspect whether a reported issue is a true inventory mismatch, an exact identity mismatch, a partial health comparison, or an identity-gap problem. It does not mean the carry sleeve now owns a venue-native internal margin engine.

## Phase 5.8 Addendum: Earlier Market Metadata Propagation

Phase 5.8 does not widen carry execution scope. It preserves richer market identity earlier in the existing carry workflow.

Current propagation truth:

- carry opportunity legs can now carry canonical market identity from upstream market data when the venue adapter truly provides it
- strategy intents persist that identity instead of collapsing immediately to `asset + instrumentType`
- carry planned orders and carry execution steps keep the same identity plus explicit provenance and capture-stage metadata
- runtime orders and fills preserve the best available identity for later internal snapshot and reconciliation use
- when the carry pipeline only knows derived symbol or asset-plus-type identity, it stays explicitly derived and only partially comparable

Operationally, this means a carry mismatch can now be exact because the internal side captured venue-native identity early, not because reconciliation guessed more later.

## Phase 4.3 Addendum: Execution Transparency

Phase 4.3 does not change the carry thesis. It changes how operators inspect execution truth.

Current execution transparency truth:

- carry execution now has a dedicated execution-detail read model
- each execution can expose downstream execution steps when the runtime actually attempted order-like work
- venue references are shown only when the connector/runtime really produced them
- rebalance proposal detail, carry action detail, and carry execution detail now link together directly

This remains an operator-grade transparency layer, not a full OMS.

## Phase 4.2 Addendum: Controlled Execution Boundary

The carry sleeve is no longer only a recommendation engine. Phase 4.2 adds explicit controlled-execution semantics on top of the strategy layer.

Current execution truth:

- carry opportunities still originate from the strategy pipeline and approved strategy intents
- carry deployment now becomes an explicit persisted action before execution
- each carry action carries readiness, blocked reasons, approval requirement, execution mode, and deterministic planned orders
- dry-run remains the default
- simulated carry execution is supported and durable
- unsupported live carry connectors remain explicitly blocked
- allocator rebalance execution may create downstream carry actions, but it does not hide autonomous live deployment

Operationally, this means the strategy document below describes the economic thesis and opportunity logic, while Phase 4.2 adds a separate operator-visible action layer that gates whether those opportunities can actually be executed.

---

## 1. Strategy Thesis

Apex Carry is the primary alpha engine of Sentinel Apex. It systematically identifies and captures structural yield arising from three closely related market inefficiencies: perpetual funding rate differentials, spot/futures basis spreads, and cross-venue rate discrepancies.

These opportunities exist because perpetual futures markets use funding mechanisms to anchor prices to spot, and because the demand for leveraged long exposure in crypto markets creates persistent positive funding rates paid to short holders. The carry sleeve captures this flow by holding market-neutral pairs: long the spot or low-funding-rate venue, short the high-funding-rate perp. The position collects the funding payment without meaningful directional exposure.

This is not a momentum or directional strategy. The edge is structural, not predictive. The strategy works because leveraged retail demand is consistent and because the basis between spot and perp converges reliably at settlement or over short horizons. The risk is hedge degradation, venue failure, or a regime shift where funding rates flip negative across all pairs simultaneously.

The strategy is designed to run continuously. Positions are sized for the medium term (days to weeks), not for intraday scalping. Entry is disciplined: a minimum net spread threshold must be met before capital is deployed. Exit is rule-based: funding rate flips, spread compression below floor, or risk-limit-triggered close.

---

## 2. Opportunity Types

### 2.1 Perpetual Funding Arbitrage

**Structure:** Long spot asset on a low-cost spot venue (or hold as collateral), short the corresponding perpetual on Drift or a CEX.

**Yield source:** The funding payment made by longs to shorts when the perp trades at a premium to spot (positive funding). The carry sleeve sits on the short side and receives these payments at each funding interval (typically every 8 hours).

**Market condition required:** Positive funding rate on the short side, sufficient to cover:
- Position entry/exit fees (taker on both legs)
- Estimated basis impact at close
- A minimum spread floor (configurable; default 3% annualized net)

**Primary venue:** Drift Protocol (perpetuals), spot on-chain or CEX

**Holding period:** Until funding rate compresses to or below the spread floor, or a regime shift triggers exit

### 2.2 Basis Trading

**Structure:** Long spot, short a fixed-expiry futures contract at a premium to spot.

**Yield source:** Basis convergence: the futures price must equal the spot price at expiry. If futures trade at a 5% annualized premium to spot, holding the long spot / short futures pair earns that premium upon convergence.

**Market condition required:** Futures contract trading at annualized basis above the spread floor after fees. Sufficient time to expiry to justify entry costs.

**Primary venue:** CEX (for fixed-expiry futures)

**Holding period:** Until expiry or until basis compresses enough to make early close more attractive than holding to expiry.

**Additional risk:** Basis can widen before converging. The pair must be sized such that the maximum basis widening does not trigger a margin call before convergence.

### 2.3 Cross-Venue Rate Differential

**Structure:** Long perp at venue A (lower funding rate), short perp at venue B (higher funding rate), for the same underlying.

**Yield source:** Collect the higher funding payment from venue B, pay the lower funding rate at venue A. The net differential, minus fees, is the carry.

**Market condition required:** Funding rate differential between two venues exceeds fees plus a minimum spread floor. Differential must be persistent (i.e., not a one-interval anomaly).

**Primary venues:** Drift Protocol vs. Binance/OKX perpetuals

**Holding period:** Until rate convergence or regime shift

**Additional risk:** Unlike spot/perp pairs, both legs are synthetic. Any failure to maintain the position on either venue creates uncollateralized directional exposure. This opportunity type has stricter hedge monitoring requirements.

---

## 3. Signal Generation

### 3.1 Data Inputs

The carry signal engine consumes the following inputs at each evaluation cycle:

| Input | Source | Frequency | Staleness Limit |
|---|---|---|---|
| Funding rate (current interval) | All configured venues | 30s poll | 60s |
| Predicted next-interval funding rate | Drift (on-chain computed) | 30s poll | 60s |
| Mark price (spot and perp) | All configured venues | 10s poll | 30s |
| Order book depth (top 5 levels) | All configured venues | 30s poll | 30s |
| Open interest | Drift, CEX APIs | 60s poll | 120s |

### 3.2 Opportunity Scoring

For each candidate opportunity, the signal engine computes:

```
grossSpreadBps = (shortVenueFundingRate - longVenueFundingRate) × (10000 / 365 × 3)
  # Annualized, converted to bps per 8-hour funding period

entryFeesBps = (takerFeeBps_longVenue + takerFeeBps_shortVenue) × 2
  # Both legs, entry and exit

estimatedSlippageBps = f(orderSize, depthAtVenue)
  # Computed from order book depth at target size

netSpreadBps = grossSpreadBps - entryFeesBps - estimatedSlippageBps - spreadFloorBps

score = (netSpreadBps / annualizedTargetBps) × liquidityScore × regimeMultiplier
```

Where:
- `liquidityScore` = order book depth at target size relative to average depth (1.0 = average, <1.0 = thin)
- `regimeMultiplier` = Sentinel-provided scaling factor based on current regime (0 in Crisis, up to 1.0 in Neutral)

Opportunities with `netSpreadBps < 0` or `score < minimumScoreThreshold` are discarded.

### 3.3 Opportunity Deduplication

The engine maintains an active opportunity set. If an opportunity for the same (asset, longVenue, shortVenue) tuple already has an active position, no new opportunity of the same type is created. Size additions to existing positions are handled through the position sizing module, not as new opportunities.

---

## 4. Position Sizing Methodology

### 4.1 Kelly-Adjacent Sizing

The target position size is derived from a Kelly-adjacent formula with hard caps applied:

```
kellyFraction = (edgeExpected / varianceEstimate) × kellyScalingFactor

where:
  edgeExpected = annualizedNetSpread
  varianceEstimate = rollingVolatility(spreadSeries, lookback=30d)
  kellyScalingFactor = 0.25  # Quarter-Kelly: conservative fractional Kelly

targetSizeUsdc = portfolio.navUsdc × min(kellyFraction, maxSingleOpportunitySizePct)
```

The Kelly fraction is computed at opportunity detection time. `maxSingleOpportunitySizePct` is configurable (default: 10% NAV per opportunity). The result is further constrained by:

1. **Venue depth constraint:** Target size must not exceed 20% of the venue's order book depth at the top 5 levels (to limit market impact)
2. **Gross exposure headroom:** Target size is reduced if it would push portfolio gross exposure above the RL-001 limit
3. **Venue concentration headroom:** Target size is reduced if it would push any venue concentration above RL-008
4. **Minimum viable size:** Opportunities below 0.5% NAV are discarded (fees make them uneconomic)

### 4.2 Hedge Sizing

The hedge leg is sized to achieve exact dollar-neutral balance at entry:

```
hedgeQuantity = longLegNotionalUsd / shortLegMarkPrice
```

Rounding is handled conservatively: the hedge is always rounded up to ensure short notional >= long notional.

### 4.3 Position Addition Policy

If a carry opportunity opens while a position for the same pair already exists:

- If the existing position is below the minimum target (e.g., due to a previous partial fill), the system may add to it up to the full target size
- If the existing position is at or above target, the signal is discarded — no pyramiding above the Kelly target
- Position additions are subject to the same pre-trade risk checks as new positions

---

## 5. Entry and Exit Rules

### 5.1 Entry Rules

An entry is initiated when all of the following conditions are met:

- `E-01:` Net spread after fees exceeds spread floor (RL-013: default 3% annualized)
- `E-02:` Opportunity score meets minimum threshold
- `E-03:` Regime multiplier from Sentinel is > 0
- `E-04:` All pre-trade risk checks pass
- `E-05:` No existing position for this pair is in `ClosingInProgress` state
- `E-06:` Sleeve status is `Active` (not halted, paused, or emergency closing)

Both legs of the trade (long and short) are submitted as near-simultaneous as technically possible. The system attempts the short (hedge) leg first, as unhedged long exposure is the greater risk in a funding arbitrage. If the short leg fails to fill within the submission timeout, the long leg order is cancelled before submission.

### 5.2 Exit Rules

Exits are triggered by the following conditions:

| Trigger | Description | Exit Type |
|---|---|---|
| `X-01: Spread Compression` | Net spread drops below 50% of entry spread | Orderly close (limit then market) |
| `X-02: Funding Rate Flip` | Funding rate on short venue turns negative | Immediate market close |
| `X-03: Spread Floor Breach` | Net spread drops below minimum floor (RL-013) | Orderly close |
| `X-04: Holding Period Max` | Position open > configurable max holding days (default 30d) | Orderly close |
| `X-05: Risk Limit Breach` | Position contributes to portfolio-level limit breach | Forced close |
| `X-06: Circuit Breaker` | CB-001, CB-002, or CB-005 trips | Orderly close or hold (per breaker) |
| `X-07: Kill Switch` | Emergency stop activated | Market close (immediate) |
| `X-08: Better Opportunity` | Capital reallocation requested by Sentinel | Orderly close |

Exit leg order: short (hedge) leg is closed first to reduce directional exposure. If the short close fails, the system retries before attempting to close the long leg.

---

## 6. Hedge State Definitions

| State | Definition | System Response |
|---|---|---|
| `FullyHedged` | Hedge ratio >= 99% | Normal operation |
| `NearlyHedged` | Hedge ratio 95–99% | Monitor; alert if sustained > 5 minutes |
| `PartiallyHedged` | Hedge ratio 80–95% | Alert operator; attempt hedge restoration |
| `UnderHedged` | Hedge ratio < 80% | Alert + attempt hedge restoration; if not restored in 5 minutes, close long leg |
| `Unhedged` | No hedge leg at all | Immediate emergency close of long leg; critical alert |

Hedge ratio is computed as:

```
hedgeRatio = abs(shortLegNotionalUsd) / abs(longLegNotionalUsd)
```

---

## 7. Venue Routing Logic

The venue router selects the optimal venue pair for a given opportunity using the following criteria:

1. **Funding rate differential:** Prefer venue pairs with highest net spread
2. **Execution quality:** Score based on historical fill quality (avg slippage vs estimate), connection reliability, and order book depth
3. **Venue exposure headroom:** Prefer venues with available capacity relative to RL-008
4. **Latency:** Prefer venues with lower p95 order round-trip time

Venue scores are maintained as a rolling 7-day exponentially weighted average. Venues with active circuit breakers are excluded from routing. Venues with margin utilization > 80% are flagged; if all venues for an asset exceed this threshold, the opportunity is deferred.

---

## 8. Risk Controls Specific to Carry

In addition to the portfolio-level risk framework, the carry sleeve enforces the following controls:

| Control | Rule |
|---|---|
| **Spread floor enforcement** | No entry if net spread < RL-013 |
| **Leg correlation monitoring** | Alert if spot/perp correlation < 0.98 on a 1h rolling basis |
| **Funding rate persistence** | No entry if current interval is the first positive interval after > 3 negative intervals (regime instability signal) |
| **Open interest threshold** | No entry if OI on target perp venue dropped > 30% in past 24h (liquidity withdrawal signal) |
| **Basis cap** | For basis trades: no entry if basis > 20% annualized (risk of adverse widening outweighs yield) |
| **Simultaneous pair close** | Both legs of a pair must be closed together; single-leg close is only permitted for hedge restoration |

---

## 9. Performance Attribution Model

Carry P&L is decomposed into the following components for attribution purposes:

| Component | Definition |
|---|---|
| **Funding Carry** | Sum of funding payments received on short legs minus funding paid on long legs |
| **Basis P&L** | Gain/loss from entry and exit basis levels |
| **Fee Drag** | Sum of all taker fees paid on entry and exit |
| **Slippage** | Difference between signal price and actual fill price at entry and exit |
| **Funding Flip Loss** | Loss incurred on early exits triggered by funding rate flips |
| **Net Carry P&L** | Funding Carry + Basis P&L - Fee Drag - Slippage - Funding Flip Loss |

Attribution is computed per trade and aggregated by opportunity type, venue pair, and asset.

---

## 10. Backtesting Requirements

The carry strategy must be validatable against historical data before any live capital deployment. The backtest harness must:

- **BR-01:** Replay historical funding rates from all configured venues over a minimum 12-month lookback
- **BR-02:** Apply the same entry/exit rules, position sizing, and risk checks as the live system (no relaxed rules)
- **BR-03:** Simulate fills using a realistic model: mid-price ± configured slippage fraction, with order book depth consumed
- **BR-04:** Include historical fee schedules per venue (not flat estimates)
- **BR-05:** Produce a full trade log with attribution decomposed per BR-09 components
- **BR-06:** Report Sharpe ratio (annualized), max drawdown (peak-to-trough), win rate, average hold duration, and fee/slippage as % of gross carry
- **BR-07:** Be reproducible: same input data and config must produce identical output
- **BR-08:** Support regime-based performance slicing: show metrics during Bull, Neutral, Bear, Stressed periods
- **BR-09:** Include a funding rate flip stress test: simulate an abrupt reversal of all funding rates to negative for 48 hours and measure drawdown impact

Acceptance criterion: backtest Sharpe > 1.5 on 12-month lookback at production risk limits.
