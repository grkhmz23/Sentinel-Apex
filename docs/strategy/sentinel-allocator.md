# Sentinel Allocator: Specification

**Version:** 1.0.0
**Status:** Active
**Last Updated:** 2026-03-18

---

## 1. Role and Responsibilities

Sentinel is the meta-allocator of the Sentinel Apex system. It does not trade. It governs how capital is budgeted across the Apex Carry and Atlas Treasury sleeves, and it enforces the risk budget at the portfolio level in response to changing market conditions.

Sentinel's three core responsibilities are:

1. **Capital budgeting:** Determine what fraction of portfolio NAV each sleeve is permitted to deploy, and what risk budget (max gross exposure) the carry sleeve may use.
2. **Regime-aware throttling:** Reduce carry risk allocation in adverse regimes before drawdowns materialize, and expand allocation in favorable regimes to maximize capital efficiency.
3. **Risk-budget enforcement:** Serve as the upstream authority for circuit breaker triggers. When portfolio-level risk conditions deteriorate, Sentinel issues instructions that the sleeves must execute, not suggestions they may consider.

Sentinel does not attempt to time the market or predict directional moves. Its regime detection is based on observable structural signals, not forecast models. Its allocation rules are deterministic given the regime classification.

---

## 2. Regime Definitions

Five market regimes are defined. Regimes represent the current structural state of the market, not a short-term price prediction.

### 2.1 Bull

**Definition:** Markets are trending upward with strong participation, funding rates are persistently positive and above long-run median, open interest is expanding, and realized volatility is moderate to high but not disorderly.

**Characteristics:**
- Funding rates across major perps: > 10% annualized (sustained 24h)
- 7-day realized volatility (BTC): below 60% annualized
- Market depth (normalized): above 30-day average
- Portfolio drawdown: < 3%

**Implication for carry:** Ideal conditions. Carry spread is wide, there is persistent long demand, and hedge costs are manageable. Maximum capital deployment.

### 2.2 Neutral

**Definition:** Markets are range-bound or slowly trending. Funding rates are positive but near the median. Volatility is moderate. No structural stress signals.

**Characteristics:**
- Funding rates: 3–10% annualized
- 7-day realized volatility: within normal range
- Market depth: near 30-day average
- Portfolio drawdown: < 5%

**Implication for carry:** Standard operating conditions. Carry allocation at base target.

### 2.3 Bear

**Definition:** Markets are in a sustained downtrend. Funding rates are declining or intermittently negative. Sell pressure is elevated, and short interest is rising.

**Characteristics:**
- Funding rates: < 3% annualized or intermittently negative over 24h
- 7-day realized volatility: elevated above normal range
- Market depth: below 30-day average
- Portfolio drawdown: < 8%

**Implication for carry:** Carry spread is narrow. Funding flip risk is elevated. Reduce carry gross exposure; shift capital to treasury T0.

### 2.4 Stressed

**Definition:** Markets are exhibiting structural stress. Funding rates may be deeply negative, open interest is falling sharply, and market depth is deteriorating. Short-term disorderly moves are possible.

**Characteristics:**
- Funding rates: persistently negative > 6 hours, or funding rate volatility > 2× normal
- 7-day realized volatility: significantly above normal range
- Market depth: substantially below 30-day average (> 40% decline)
- Portfolio drawdown: >= 5% OR circuit breaker CB-001 or CB-002 active

**Implication for carry:** Carry spread is negative or inverted. Exit remaining carry positions in an orderly manner. Capital moves entirely to T0 and T1 treasury. T2 positions begin unwinding.

### 2.5 Crisis

**Definition:** Acute market disruption. Disorderly price action, venue connectivity issues, extreme funding rate volatility, or portfolio drawdown approaching kill switch threshold.

**Characteristics:**
- Portfolio drawdown: >= 10%
- AND/OR: venue connectivity failures on > 1 active carry venue
- AND/OR: funding rate volatility > 5× normal for > 2 hours
- AND/OR: any reconciliation failure circuit breaker active

**Implication for carry:** All carry positions must be closed. Kill switch evaluation is active. Treasury moves entirely to T0. No new deployments until Crisis regime is cleared.

---

## 3. Regime Detection

### 3.1 Input Signals

Sentinel evaluates regime every 5 minutes using the following signals:

| Signal | Source | Weight |
|---|---|---|
| Funding rate level (cross-venue median) | packages/venue-adapters | High |
| Funding rate trend (1h change) | Derived from funding rate time series | Medium |
| Funding rate volatility (rolling 24h σ) | Derived | High |
| 7-day realized volatility (BTC as proxy) | Price time series | High |
| Market depth normalized to 30d average | packages/venue-adapters | Medium |
| Open interest change (24h) | packages/venue-adapters | Medium |
| Current portfolio drawdown | packages/risk-engine | High |
| Active circuit breakers | packages/risk-engine | High (override) |

### 3.2 Classification Logic

Regime classification is rule-based, not model-based. The classifier evaluates conditions in severity order (Crisis → Stressed → Bear → Neutral → Bull). The first regime whose conditions are fully satisfied is assigned.

This means that a single crisis-level indicator (e.g., drawdown >= 10%) immediately classifies the regime as Crisis regardless of how favorable all other signals appear. There is no averaging or weighting between regimes.

```
classifyRegime(signals):
  if signals.drawdown >= 0.10 OR signals.activeCircuitBreakers includes CB-006:
    return Crisis
  if signals.drawdown >= 0.05 OR
     signals.fundingVolatility > 2 × signals.fundingVolatilityNorm OR
     signals.marketDepthRatio < 0.60:
    return Stressed
  if signals.fundingRateMedian < 0.03 OR
     signals.fundingRateTrend < -0.02 OR
     signals.realizedVol > signals.realizedVolNorm × 1.5:
    return Bear
  if signals.fundingRateMedian >= 0.10 AND
     signals.realizedVol < signals.realizedVolNorm × 1.2 AND
     signals.marketDepthRatio >= 0.90 AND
     signals.drawdown < 0.03:
    return Bull
  return Neutral
```

### 3.3 Regime Persistence

A regime transition is only accepted after the new regime conditions are met for a minimum persistence period:

| Transition Direction | Minimum Persistence |
|---|---|
| → More favorable (e.g., Stressed → Bear) | 30 minutes |
| → Less favorable (e.g., Bear → Stressed) | Immediate |
| → Crisis | Immediate |
| → Bull from any | 60 minutes |

This prevents rapid oscillation between regimes on noisy signal data. The current regime only updates when the new classification has been stable for the persistence period. In the downward direction (toward more stress), transitions are immediate to ensure defensive action is not delayed.

---

## 4. Allocation Rules per Regime

The following allocation targets represent the default configuration. All values are configurable.

### 4.1 Capital Allocation per Regime

| Regime | Carry Target % NAV | Treasury Target % NAV | Max Carry Gross Exposure |
|---|---|---|---|
| Bull | 80% | 20% | 150% NAV |
| Neutral | 65% | 35% | 120% NAV |
| Bear | 40% | 60% | 70% NAV |
| Stressed | 10% | 90% | 15% NAV |
| Crisis | 0% | 100% | 0% |

### 4.2 Treasury Tier Targets per Regime

| Regime | T0 (min % NAV) | T1 (max % treasury) | T2 (max % treasury) |
|---|---|---|---|
| Bull | 10% | 60% | 30% |
| Neutral | 10% | 55% | 25% |
| Bear | 15% | 50% | 15% |
| Stressed | 20% | 40% | 0% |
| Crisis | 30% | 30% | 0% |

---

## 5. Sleeve Scoring Model

Sentinel continuously scores each sleeve to determine priority for capital allocation when total capital is constrained. Scoring is used for fine-grained allocation within the regime targets, not to override the regime structure.

### 5.1 Carry Sleeve Score

```
carryScore = (
  opportunityScore × 0.40 +      // Weighted avg score of active opportunities
  recentSharpe × 0.30 +          // Rolling 7-day Sharpe of carry P&L
  hedgeQuality × 0.20 +          // Avg hedge ratio over past 24h
  executionQuality × 0.10        // Fill rate × (1 - avg slippage/estimate ratio)
)
```

A carry score < 0.3 triggers a review flag. A carry score = 0 (no scoreable opportunities) results in carry allocation being collapsed to zero and capital moved to treasury.

### 5.2 Treasury Sleeve Score

The treasury sleeve does not compete for capital in the same way. It receives whatever carry does not use. Its scoring is used internally to rank venue allocation quality:

```
treasuryVenueScore[v] = (
  yieldAnnualized[v] × 0.50 +
  liquidityScore[v] × 0.30 +    // Depth and redemption reliability
  protocolHealthScore[v] × 0.20 // TVL trend, audit recency, no incidents
)
```

---

## 6. De-Risking Triggers and Behavior

### 6.1 Proactive De-Risking

Sentinel begins reducing carry allocation before drawdown limits are reached. Proactive de-risking is triggered by deteriorating regime signals, not by breached limits:

| Signal | Threshold | Action |
|---|---|---|
| Funding rate median falling | Below 5% annualized | Begin reducing carry target by 10% NAV steps every 30 min |
| Portfolio drawdown | > 2% | Reduce carry target by 20% NAV immediately |
| Funding volatility | > 1.5× normal | Reduce carry target by 15% NAV |
| Venue market depth | < 80% of 30d average | Cap new carry entries at venues with thin depth |

### 6.2 De-Risking Execution

When Sentinel issues a lower AllocationTarget for carry:

1. `AllocationChanged` event is emitted with old target, new target, and trigger reason
2. The carry sleeve receives the event and computes the required position reduction
3. Position reduction is orderly: exit the lowest-scoring (smallest net spread) positions first
4. New carry entries are suspended during the de-risking period
5. Capital released by carry close goes directly to T0 treasury
6. De-risking is complete when carry gross exposure is within 5% of the new target
7. `DeRiskingCompleted` event is emitted

De-risking does not close positions at market unless the regime transitions to Crisis (which triggers the kill switch evaluation) or a circuit breaker fires.

---

## 7. Drawdown-Aware Allocation Logic

Portfolio drawdown is the primary override signal. It interacts with regime but is evaluated independently:

| Drawdown Level | Carry Allocation Cap | Treasury T0 Floor | Action |
|---|---|---|---|
| 0–2% | Regime target | Regime target | Normal |
| 2–5% | Min(regime target, 50% NAV) | Max(regime floor, 15% NAV) | Reduce carry |
| 5–8% | Min(regime target, 25% NAV) | Max(regime floor, 20% NAV) | Significant reduction |
| 8–10% | Min(regime target, 10% NAV) | 25% NAV | Begin emergency wind-down |
| > 10% | 0% | 30% NAV | Kill switch evaluation |

The drawdown constraint is applied as a cap on top of the regime target. If the regime target is already lower (e.g., regime is Stressed), the regime target takes precedence. The drawdown cap never raises the regime target.

---

## 8. Circuit Breaker Integration

Sentinel is the upstream authority for circuit breakers. It:

1. **Monitors** all circuit breaker states via the risk engine
2. **Reacts** to new circuit breaker trips by issuing updated AllocationTargets immediately
3. **Blocks** carry entry when CB-001 or CB-002 is active (daily/weekly drawdown)
4. **Forces regime** to Stressed when CB-005 (HedgeDegradation) has been active > 15 minutes without recovery
5. **Forces regime** to Crisis when CB-006 (ReconciliationFailure) is active

Sentinel does not reset circuit breakers. Circuit breaker reset is an operator action. Sentinel re-evaluates regime and allocation targets immediately upon circuit breaker reset.

---

## 9. Allocation Change Workflow

Every allocation change follows a defined workflow to ensure auditability:

```
Step 1: Regime Evaluation
  Sentinel evaluates regime signals every 5 minutes
  If regime changes or drawdown threshold changes:
    → Proceed to Step 2

Step 2: Target Computation
  Compute new AllocationTarget based on regime rules + drawdown cap
  If new target is materially different from current target (> 5% NAV):
    → Proceed to Step 3
  Else: No change; log as no-op

Step 3: Validation
  Validate that new AllocationTarget satisfies all risk constraints
  (T0 floor, max gross, concentration limits)
  If invalid:
    → Log validation failure + alert; apply conservative fallback target

Step 4: Publication
  Write AllocationTarget record to database
  Emit AllocationChanged domain event with:
    - Previous target
    - New target
    - Regime (before and after, if changed)
    - Trigger reason
    - Computed inputs at time of decision
    - Timestamp

Step 5: Sleeve Execution
  Carry sleeve receives event; begins position reduction or expansion
  Treasury sleeve receives event; begins rebalance
  Both sleeves emit completion events when rebalance is done

Step 6: Verification
  Sentinel verifies that actual allocation matches target within tolerance (±5% NAV)
  If not achieved within 30 minutes:
    → Alert operator; log allocation execution failure
```

All inputs used in the regime classification and target computation at the time of decision are stored in the `AllocationTarget` record. This ensures that every allocation decision is fully explainable from the stored data alone, without relying on reconstructing external market conditions.
