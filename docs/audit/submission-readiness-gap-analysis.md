# Submission Readiness Gap Analysis

Date: 2026-04-04
Repo: `/workspaces/Sentinel-Apex`
Track: `Build-A-Bear Hackathon | Main Track`

## Purpose

This document captures the remaining gaps between the current codebase and a submission posture that is both:

- honest relative to what the repo can really prove
- strong enough to support hackathon verification and later seeded deployment work

It is written as a restart point for future implementation work.

## What Is Already In Place

The repo already has the following submission-relevant foundations:

- Build-A-Bear policy enforcement for `USDC`, `10%` APY floor, 3-month rolling tenor, and disallowed yield-source classes
- operator-facing submission dossier and evidence surfaces
- submission evidence persistence and export bundle generation
- real venue-truth snapshots and connector promotion workflow
- a real Drift devnet execution path for one narrow live lane
- post-trade confirmation that combines:
  - transaction signature
  - venue-native Drift event evidence
  - refreshed venue position truth

## Hard Blockers

These are the main gaps for a truly submission-ready live strategy claim.

### 1. No Mainnet Execution Path

Current truth:

- the only real execution path is still Drift `devnet`
- no mainnet carry connector is implemented

Impact:

- the repo cannot honestly claim live deployable mainnet execution
- this is the largest gap between hackathon prototype and seeded product readiness

### 2. No Full Delta-Neutral Multi-Leg Live Orchestration

Current truth:

- the repo can now execute one real BTC-PERP leg on Drift devnet
- it still does not orchestrate the full live strategy across both hedge legs

Impact:

- the marketed strategy is still broader than the executable reality
- the repo can prove one live perp-leg path, not a full production delta-neutral vault

### 3. No Ranger / Earn Integration

Current truth:

- there is no source-level Ranger or Ranger Earn integration
- there is no deployable on-chain vault integration for Ranger manager flows

Impact:

- the repo is not yet ready for the exact deployment surface described by the hackathon track

### 4. No On-Chain Vault Tokenization / Live Vault Plumbing

Current truth:

- internal vault accounting, lock metadata, and dossier flows exist
- generic on-chain vault token issuance, deposit minting, and redemption plumbing are not implemented

Impact:

- the repo is not yet a deployable on-chain vault product
- current vault state is operational/control-plane state, not a finished live vault contract integration

### 5. Realized APY Is Still Not Computed From Durable Strategy Evidence

Current truth:

- target APY and projected APY exist
- realized APY is still effectively unavailable unless attached manually as evidence

Impact:

- the repo can support proof bundles, but it still does not compute a durable realized-performance record end to end
- this matters for both hackathon judging credibility and seeded post-hackathon operations

## Important Gaps

These are not as fundamental as the blockers above, but they still matter for a credible submission.

### 6. Submission Verification Is Stronger, But Still Operator-Driven

Current truth:

- evidence records, export bundles, dossier readiness, and wallet/vault metadata now exist
- realized performance proof is still partly manual and operator-curated

Impact:

- submission evidence is much better than before
- it is not yet a fully automated verification/reporting pipeline

### 7. CEX Strategy Lane Is Missing

Current truth:

- no CEX execution connectors exist
- no CSV ingestion flow exists
- no read-only API key verification workflow exists

Impact:

- if the final strategy depends on CEX execution, the repo is not submission-ready for that path
- if the submission stays on-chain only, this is not on the critical path

### 8. Market Coverage Is Extremely Narrow

Current truth:

- real execution is limited to `BTC-PERP`
- no other perp markets are supported
- no spot-leg real execution path exists

Impact:

- submission scope must stay tightly worded
- any broader strategy claim would be misleading

### 9. Production Hardening Is Still Partial

Current truth:

- operator auth, audit, promotion, and controls exist
- full seed-ready deployment hardening does not

Missing areas include:

- secrets and key custody hardening
- MPC / signer infrastructure integration
- production deployment automation
- deeper monitoring / alerting / incident workflows
- release hardening and operational runbooks for a real fund product

Impact:

- the repo is not yet operationally ready for real seeded AUM

### 10. Backtesting / Historical Validation Is Missing

Current truth:

- no `packages/backtest` harness exists
- no historical replay or strategy-validation engine is implemented

Impact:

- not mandatory for hackathon eligibility
- still a major weakness for reviewer confidence and post-hackathon seeding diligence

## Lower-Priority Gaps

These matter, but they should not be put ahead of the main blockers.

### 11. Treasury Live Execution Breadth Is Limited

Treasury policy and execution rails exist, but treasury-side real venue breadth is still incomplete.

### 12. Broader Operator / Enterprise Auth Is Missing

Local/operator session management exists, but broader SSO, enterprise auth, and multi-operator governance depth are still limited.

### 13. Generic Venue Expansion Is Missing

The venue-truth model is strong, but real execution support remains highly specific rather than generalized across venues.

## Honest Submission Boundary Today

If submitting immediately, the honest claim would be:

- one Build-A-Bear-eligible strategy policy profile exists
- one real Drift devnet single-perp execution lane exists
- submission evidence, dossier, and export bundle surfaces exist
- the repo is not mainnet-ready
- the repo is not yet a full live delta-neutral vault product

Anything broader than that would overstate the codebase.

## Recommended Implementation Order

If work resumes later, the most defensible next sequence is:

1. Implement durable realized APY / realized performance reporting from persisted execution and evidence.
2. Finish the second live leg needed for the real strategy, or narrow the strategy claim even further.
3. Add mainnet-capable execution support for the chosen venue path.
4. Integrate Ranger / live vault deployment plumbing.
5. Harden signer / secret / deployment / monitoring operations for seed readiness.
6. Add CEX verification only if the final strategy actually requires it.
7. Build a historical backtest / replay package after the live path is honest and stable.

## Immediate Next Milestone

The next milestone that most improves submission readiness is:

- move from "single-leg live proof" to "truthful end-to-end strategy proof"

That means either:

- complete the second executable hedge leg

or:

- explicitly re-scope the product and submission around the single executable leg so documentation, UI, and judging claims remain exact.
