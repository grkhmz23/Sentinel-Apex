# Apex Carry Simulation Assumptions

Date: 2026-03-18

## Purpose

The deterministic carry simulation is a local/dev control-plane scenario, not a backtest. Its job is to produce believable, repeatable strategy, risk, and execution records for operational validation.

## Economic Assumptions

- Two simulated centralized venues expose deterministic prices and funding rates.
- Cross-venue spread opportunities require a minimum net spread threshold.
- Funding-rate opportunities require a minimum annualized funding threshold.
- Orders execute immediately in dry-run simulation with configured fee and slippage assumptions.
- Venue balances start with fixed USDC collateral and no pre-existing positions.

## Pricing Assumptions

Default deterministic BTC path:

- `sim-venue-a` mark price around `100000`
- `sim-venue-b` mark price around `100180`
- venue-level slippage and taker fees apply to execution prices

These values are intentionally simple but they now preserve plausible notional sizing instead of placeholder pricing.

## Sizing Assumptions

- Position sizing starts from strategy-engine opportunity sizing.
- Runtime planning applies projected gross exposure and open-position budgeting across generated intents.
- Funding opportunities use mark price for notional sizing.
- Risk engine checks still gate final approval.

This means multiple approved intents now consume budget progressively during one deterministic cycle instead of all sizing from the same untouched starting state.

## Risk Assumptions

- Dry-run remains the default mode.
- Live execution is not used in the deterministic scenario.
- Risk limits can reject intents for gross exposure or other configured constraints.
- Operator pause state blocks cycle execution entirely.

## Known Simplifications

- No historical market path or time-series funding evolution
- No borrow inventory model
- No latency regime simulation
- No venue outage or partial-fill regime
- No treasury sleeve interaction
- No allocator overlays

## Why This Is Good Enough For Phase 1.5

- It produces economically interpretable orders and exposures.
- It keeps runtime recovery and replay tests deterministic.
- It exercises the real strategy, risk, execution, persistence, and API pipeline without speculative backtest infrastructure.
