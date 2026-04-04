# Build-A-Bear Main Track Submission Posture

Date: 2026-04-04
Repo: `/workspaces/Sentinel-Apex`

## Strategy Summary

Sentinel Apex now exposes one hackathon-facing strategy profile in code, API, and ops UI:

- strategy: `Apex USDC Delta-Neutral Carry`
- vault base asset: `USDC`
- tenor: 3-month lock, rolling
- reassessment cadence: every 3 months
- target APY floor: `10%`
- yield source category: delta-neutral carry / basis-style funding capture
- leverage model: explicit `perp_basis_hedged` metadata with minimum health threshold metadata

This is a product-policy and readiness model. It is not a claim of broad live vault deployment.

## Why It Is Eligible In Principle

The repo now enforces the following Build-A-Bear rules in code:

- base asset must be `USDC`
- tenor must be exactly 3 months rolling
- target APY floor defaults to `10%` and fails closed below that floor
- disallowed yield sources fail closed:
  - circular yield-bearing stable dependencies
  - junior tranche
  - insurance pool
  - DEX LP
- leverage metadata must include an explicit health threshold whenever leverage is present
- unsafe looping leverage below `1.05` on non-hardcoded oracle dependencies is blocked

These checks are persisted on carry actions, exposed through `/api/v1/carry/strategy-profile`, and rendered in the carry dashboard.

## APY Truth

The repo now separates:

- target APY
- projected APY
- realized APY

Important honesty boundary:

- target APY is policy metadata, not realized performance
- projected APY comes from current strategy evaluation inputs and is explicitly labeled as projected
- realized APY remains `unknown` / `unavailable` unless the repo has real evidence to support it
- no live production APY is claimed

## Current Live Truth

The only real execution-capable path remains:

- venue: Drift devnet
- sleeve: carry
- market: BTC-PERP
- order type: market
- risk posture: reduce-only

Execution confirmation truth can now point to:

- transaction signature
- venue-native Drift event evidence
- refreshed position-delta truth

This improves evidence quality, but it still does not make the repo mainnet-ready.

## Still Blocked

The following are still blocked and must not be claimed in a submission:

- mainnet deployment
- generic Ranger vault integration
- increase-exposure live execution
- non-BTC markets
- non-USDC vault base assets
- DEX LP / junior tranche / insurance pool / circular stable-yield strategies

## Reviewer Guidance

The honest reviewer posture is:

- eligible in principle at the strategy-policy layer for one narrow USDC carry profile
- execution-capable only on a narrow Drift devnet reduction path
- not production-ready
- not mainnet-ready
- not widened beyond the repo’s currently provable scope

