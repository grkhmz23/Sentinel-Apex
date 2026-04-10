# Apex USDC Delta-Neutral Carry

**Strategy Documentation for Investors and Hackathon Review**

**Status:** Active  
**Last Updated:** 2026-04-10

## 1. Strategy Thesis

Sentinel Apex is built around a single constrained product: a USDC-denominated,
delta-neutral carry vault for Solana.

The thesis is that structural yield exists in perpetual futures funding,
spot-perpetual basis, and cross-venue rate differentials because leveraged long
demand in crypto markets is often persistent and unevenly priced. Instead of
taking directional market exposure, the strategy seeks to capture that yield by
pairing offsetting long and short exposures so that returns come primarily from
carry, not from predicting price direction.

In practical terms, the strategy targets situations where:

- a perpetual market is paying positive funding to the short side
- a futures or perp contract is trading at a premium that is attractive after
  fees and expected slippage
- one venue offers materially better carry than another for the same underlying

The product mandate is intentionally narrow:

- base asset: `USDC`
- tenor: `3-month` rolling lock
- reassessment cadence: every `3 months`
- target APY floor: `10%`

The policy layer also excludes disallowed yield sources such as DEX LP exposure,
junior tranche structures, insurance-pool style risk, and circular
yield-bearing stable dependencies.

## 2. How The Strategy Works In Practice

The strategy follows a controlled pipeline rather than a single trading loop.

### 2.1 Opportunity Detection

The runtime continuously evaluates market data and identifies candidate carry
opportunities. The main opportunity classes are:

- perpetual funding arbitrage
- spot/perpetual basis capture
- cross-venue funding-rate differential capture

An opportunity is only considered valid if expected net yield remains positive
after fees, slippage, and a minimum spread floor.

### 2.2 Portfolio-Level Selection

Sentinel Apex does not trade every detected opportunity. It uses a
portfolio-level optimizer to evaluate and rank candidates before capital is
assigned.

Each opportunity is scored using:

- expected net yield
- confidence score
- venue breadth
- diversification value
- concentration-aware capital constraints

The optimizer then records:

- which opportunities are approved
- which are rejected
- why that decision was made
- planned notional for each approved opportunity

This means deployment is portfolio-driven, not opportunity-by-opportunity.

### 2.3 Action Gating And Execution

Approved opportunities become explicit carry actions. Those actions are then
subject to runtime readiness, approval, venue capability, and risk checks before
execution is allowed.

In the current hackathon implementation:

- dry-run and operator-controlled flows are first-class
- Jupiter Perps devnet is the real execution path used for demonstration
- execution is recorded as evidence, not treated as an invisible side effect

### 2.4 Ongoing Monitoring

After entry, the system continues to monitor:

- funding-rate persistence
- spread compression
- hedge integrity
- venue concentration
- reconciliation status
- runtime health and mismatch pressure

Positions are reduced or blocked from further increase if these conditions
deteriorate.

## 3. Risk Management Approach

The strategy is designed to fail closed. New deployment is blocked when the
system, data, or portfolio state is not safe enough to justify additional risk.

### 3.1 Drawdown Limits

The current documented risk defaults are:

- max daily drawdown: `2%`
- max rolling 7-day drawdown: `5%`
- max peak-to-trough drawdown: `15%`

These limits are treated as enforced risk controls, not as discretionary
guidelines. Breaches can trigger de-risking, blocked execution, or a halt in new
deployment depending on severity.

### 3.2 Position Sizing

Position sizing is conservative and multi-layered.

At the strategy level, sizing starts from expected edge but is then constrained
by hard caps. At the risk and allocator layers, the final deployment must still
fit within portfolio and concentration limits.

Key sizing limits currently documented in the protocol are:

- max single opportunity size: `10%` of NAV by default
- max total carry sleeve gross exposure: `150%` of NAV by default
- max single venue concentration: `40%` of gross exposure
- max single asset concentration: `30%` of gross exposure
- minimum hedge ratio for carry positions: `95%`

Operationally, that means an attractive trade can still be rejected or reduced
if:

- it would over-concentrate the portfolio in one venue
- it would over-concentrate exposure in one asset
- it would weaken hedge quality
- it would push the sleeve beyond allowed gross exposure
- it would conflict with liquidity reserve or runtime safety requirements

### 3.3 Rebalancing Logic

Rebalancing in Sentinel Apex is rule-based, not discretionary.

The protocol re-evaluates existing and candidate positions continuously and
responds to changes in carry quality, exposure distribution, and system health.

Rebalancing logic is driven by:

- spread compression below the minimum acceptable net carry threshold
- funding-rate deterioration or negative carry regime change
- venue or asset concentration drift
- hedge-ratio degradation
- allocator or treasury-driven capital reallocation
- critical mismatches or operational integrity issues

In practice, this means the system can:

- avoid adding to existing exposure
- scale down positions
- rotate capital toward higher-quality carry opportunities
- block execution until reconciliation or operational issues are resolved

The rebalancing goal is not to maximize gross deployment. The goal is to keep
capital allocated to the best available risk-adjusted carry while maintaining
portfolio integrity and liquidity discipline.

## 4. Principal Risks

The strategy is market-neutral by design, but it is not risk-free. The main
risks are:

- hedge degradation causing unintended delta exposure
- funding-rate reversal reducing or eliminating expected carry
- basis widening before convergence
- execution slippage and partial-fill risk
- venue outage or counterparty failure
- reconciliation mismatch between expected and actual state
- liquidity stress during forced reduction or unwind

The protocol addresses these through pre-trade checks, concentration controls,
hedge thresholds, runtime gating, and reconciliation workflows.

## 5. Why This Is Structured As A Vault Product

Sentinel Apex is intended to operate as a managed vault product, not just a
strategy script. The architecture separates:

- strategy selection
- capital allocation
- execution
- risk enforcement
- reconciliation
- vault and submission evidence

This separation is important for investors because yield generation alone is not
enough. A credible vault must also be able to explain what it is doing, why it
is doing it, and how it responds when risk or operational conditions change.

## 6. Current Implementation Boundary

For the current hackathon build:

- the strategy policy, optimizer, action flow, and risk framework are encoded in
  the protocol
- devnet is used for product demonstration and execution walkthroughs
- submission and evidence surfaces are built into the control plane

The intended progression from here is:

- deeper hedge lifecycle automation
- richer NAV and fee accounting
- stronger allocator analytics
- mainnet evidence-backed deployment readiness

That means the protocol already demonstrates the control structure of a managed
carry vault, while continuing to mature toward full allocator-grade production
operation.
