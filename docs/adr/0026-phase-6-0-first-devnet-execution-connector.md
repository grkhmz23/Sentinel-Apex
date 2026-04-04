# ADR 0026: Phase 6.0 First Devnet Execution Connector

Date: 2026-04-03
Status: Accepted

## Context

By the end of Phase 5.9, Sentinel Apex had:

- real read-only Drift truth
- durable connector promotion workflow
- operator-approved carry execution workflow
- explicit runtime command rail
- durable execution drill-through

What it still did not have was one honest real execution-capable connector path flowing through that exact system.

The next step needed to prove that the repo was not only simulated architecture, but the first real path still had to stay narrow and devnet-safe.

## Decision

Sentinel Apex will add the first real execution-capable connector as:

- `drift-solana-devnet-carry`
- carry sleeve only
- Drift devnet only
- BTC-PERP reduce-only market orders only

This connector will:

- reuse the existing Drift-native read-only truth depth
- expose explicit supported and unsupported execution scope in metadata
- persist real Solana signatures as durable execution references
- remain blocked unless promotion, current evidence, runtime live mode, and operator authorization all allow execution

## Why

This choice maximizes proof while minimizing blast radius.

- carry already has the strongest operator approval and execution drill-through flow in the repo
- Drift already has the strongest real venue truth foundation in the repo
- reduce-only execution is materially safer than opening new exposure
- BTC-PERP-only scope stays within the current honest market-identity envelope

## Rejected Alternatives

### 1. Treasury-side real connector first

Rejected.

The repo does not yet have an equally strong real treasury connector foundation to reuse end to end.

### 2. Broad Drift execution support

Rejected.

Multi-market, increase-exposure, spot, or limit-order support would overstate current safety and readiness.

### 3. Auto-promotion for the devnet connector

Rejected.

Even a devnet execution-capable connector must still flow through the same durable approval and evidence gates.

## Consequences

Positive:

- the repo now has one honest real execution path
- promotion workflow now gates a real connector, not only simulated or read-only posture
- operators can prove end-to-end auditability with real execution references

Negative:

- the first real path is deliberately narrow
- hackathon demos still require an existing devnet position to reduce
- broader live rollout remains future work

## Follow-up

The next step is not broad live enablement.

The next step is to widen real execution scope only where the repo can continue to stay explicit about:

- connector contract
- evidence model
- runtime gating
- unsupported boundaries
