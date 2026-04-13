# Ranger Integration Notes

Purpose: compact handoff notes for integrating Sentinel Apex with Ranger Earn.

Source scope:
- Vault Managers docs provided by user
- Includes repeated Mintlify agent instruction:
  - Use `https://docs.ranger.finance/llms.txt` as the documentation index
  - Only submit doc feedback when specific and actionable

## Core Model

- A Ranger vault is an on-chain Solana vault for a single asset only.
- Users deposit one asset and receive LP tokens representing proportional share.
- Multi-asset support requires separate vaults.

## Role Separation

- `admin`
  - add/remove adaptors
  - initialize strategies
  - update vault configuration
  - calibrate high water mark
- `manager`
  - allocate funds between strategies
  - deposit/withdraw to strategies
  - claim protocol rewards

Implementation implication:
- Sentinel must model separate admin and manager keypairs.
- Admin controls structure.
- Manager controls fund movement.
- These must not be conflated into one operator key in the final integration.

## Required Lifecycle

1. Create vault
2. Create LP metadata
3. Add adaptor(s)
4. Initialize strategy/strategies
5. Allocate funds from idle vault account to strategies
6. Operate with external bots/scripts
7. Request indexing/listing on Ranger
8. Verify LP token on Jupiter

Critical truth:
- Vault creation alone does not make a yield-generating vault.
- Funds remain idle until strategy init + allocation are completed.
- Ranger does not run bots for you. Automation is owner-managed.

## SDK Packages

Required SDK stack from docs:

```bash
npm install @voltr/vault-sdk @solana/web3.js @coral-xyz/anchor
```

Allocation flows may also require:

```bash
npm install @solana/spl-token
```

## Program / SDK Surface

Main client:
- `VoltrClient`

Important constants:
- `VAULT_PROGRAM_ID`
- `LENDING_ADAPTOR_PROGRAM_ID`
- `DRIFT_ADAPTOR_PROGRAM_ID`
- `METADATA_PROGRAM_ID`
- `SEEDS.*`

Important note:
- Current docs still mention Drift adaptor and scripts.
- Sentinel should avoid building any new Drift dependency; use Jupiter / approved adaptors only.

## Vault Creation

Main instruction:
- `createInitializeVaultIx(vaultParams, accounts)`

Required accounts:
- `vault`
- `vaultAssetMint`
- `admin`
- `manager`
- `payer`

Important config fields:
- `maxCap`
- `startAtTs`
- `lockedProfitDegradationDuration`
- manager/admin performance fees
- manager/admin management fees
- `redemptionFee`
- `issuanceFee`
- `withdrawalWaitingPeriod`

Hard constraints from docs:
- `maxCap = 0` means zero capacity, not uncapped
- uncapped uses `u64 max = 18446744073709551615`
- vault `name` max 32 chars
- vault `description` max 64 chars

Sentinel mapping implication:
- Current internal vault model must be extended to store Ranger-native immutable fields and fee config exactly, not approximated.

## LP Metadata

Instruction:
- `createCreateLpMetadataIx`

Admin-only.

Required metadata:
- name
- symbol
- URI to public JSON

Go-to-market implication:
- LP metadata is part of submission readiness for a real Ranger deployment.

## Vault Configuration Updates

Instruction:
- `createUpdateVaultConfigIx(field, data, accounts)`

One field at a time.

Updatable:
- cap
- locked profit degradation duration
- withdrawal waiting period
- fees
- manager

Not updatable:
- name
- description
- asset mint

Special case:
- management fee updates require `vaultLpMint`

Sentinel mapping implication:
- config update UX should be field-based, not only full-object patching.
- manager rotation is sensitive and needs explicit confirmation.

## Strategies / Adaptors

Two-step setup:
1. add adaptor
2. initialize strategy

Main instructions:
- `createAddAdaptorIx`
- `createInitializeStrategyIx`
- `createRemoveAdaptorIx`
- `createCloseStrategyIx`

Strategy setup is protocol-specific and depends on:
- `instructionDiscriminator`
- strategy PDA
- remaining accounts
- adaptor program

Critical implication:
- Ranger does not define a generic “strategy object” rich enough for Sentinel by itself.
- Sentinel will need adaptor-specific integration code or script wrappers for each live strategy lane.

## Allocation

Manager-only.

Prerequisites:
- manager keypair
- SOL for manager
- initialized strategies
- protocol-specific remaining accounts

Main instructions:
- `createDepositStrategyIx`
- `createWithdrawStrategyIx`

Observed flow:
- user deposits -> vault idle account
- manager allocates idle funds -> strategy accounts
- strategies -> idle account -> user withdrawals

Operational implication:
- Sentinel allocator/rebalance plans must map onto Ranger manager transactions, not direct internal accounting only.

## Withdrawals / User Flows

Vault-level instructions:
- `createDepositVaultIx`
- `createRequestWithdrawVaultIx`
- `createCancelRequestWithdrawVaultIx`
- `createWithdrawVaultIx`
- `createDirectWithdrawStrategyIx`
- `createInitializeDirectWithdrawStrategyIx`

Important:
- Ranger supports waiting-period withdrawals and, for supported strategies, direct withdrawal.
- Pending withdrawal queries exist in SDK/API.

Sentinel implication:
- Current internal redemption model should be reconciled against actual Ranger request-withdraw / claim-withdraw flow.

## Fees / Accounting

Ranger has native support for:
- locked profit degradation
- high water mark
- performance fees
- management fees
- issuance fee
- redemption fee

Important instructions:
- `createHarvestFeeIx`
- `createCalibrateHighWaterMarkIx`

Important read methods:
- `getAccumulatedAdminFeesForVault`
- `getAccumulatedManagerFeesForVault`
- `getHighWaterMarkForVault`
- `getCurrentAssetPerLpForVault`
- `getVaultLpSupplyBreakdown`

Sentinel implication:
- Sentinel’s internal APY / PnL / fee model must distinguish:
  - internal strategy analytics
  - Ranger on-chain vault accounting
- High-water-mark semantics are Ranger-native and should not be faked internally.

## Monitoring / API

Read API:
- `https://api.voltr.xyz`
- public, no API key
- primarily for indexed vaults

Important pattern:
- API builds unsigned transactions for some user actions
- client signs and broadcasts

SDK is preferred for write/admin/manager automation.

Best-practice split from docs:
- API for reads
- SDK for writes

## Listing / Go To Market

Vaults are not auto-listed.

Requirements mentioned:
- vault public key
- strategy/risk description
- logo
- website
- docs
- social link
- metadata
- Jupiter token verification
- indexing request to Ranger team

Critical implication:
- “Submission through Earn” likely means more than creating a vault account.
- We probably need:
  - on-chain vault created
  - metadata set
  - strategy initialized
  - funds allocated
  - vault indexed or at least review-ready with public key and docs

## Current Sentinel Gaps Inferred From This Doc Set

1. No real `@voltr/vault-sdk` integration yet.
2. No explicit admin/manager key separation in Ranger-native flows.
3. No real Ranger vault creation instruction path.
4. No LP metadata creation/update path.
5. No adaptor add / strategy init / manager allocation transaction path.
6. No Ranger-native pending withdrawal / direct withdraw integration.
7. No on-chain fee harvest / HWM calibration integration.
8. No indexing / listing readiness workflow.

## What We Still Need From Ranger Docs

Mostly satisfied by the user-provided doc dump.

Still useful later:

1. Jupiter-specific initialization / deposit / withdraw examples
2. Trustful-specific initialization / deposit / withdraw examples
3. Any official guidance on indexed vault requirements for hackathon submission

## Adaptor / CPI Model Confirmed

- Ranger vault program is the user-facing accounting layer.
- Adaptors are separate on-chain programs invoked by the vault via CPI.
- Every adaptor must support:
  - `initialize -> Result<()>`
  - `deposit -> Result<u64>`
  - `withdraw -> Result<u64>`
- Returned `u64` from deposit/withdraw is the authoritative underlying position value used by the vault for accounting/PnL tracking.
- Extra adaptor instructions are allowed:
  - request/cancel withdraw
  - harvest rewards
  - rebalancing
  - protocol-specific flows
- Extra instructions are invoked by the vault manager directly, not by the vault program automatically.

Accounts passed by Ranger vault are fixed-order:
- initialize:
  - `payer`
  - `vault_strategy_auth` signer
  - `strategy`
  - `system_program`
  - `remaining_accounts...`
- deposit/withdraw:
  - `vault_strategy_auth` signer
  - `strategy`
  - `vault_asset_mint`
  - `vault_strategy_asset_ata`
  - `asset_token_program`
  - `remaining_accounts...`

Critical implication:
- Sentinel can no longer claim “Ranger SDK unavailable” as the main blocker.
- The real blocker is choosing the execution path:
  - existing Ranger Jupiter adaptor
  - existing Ranger Trustful adaptor
  - custom Sentinel adaptor

## Deployed Mainnet Program Addresses

- Vault:
  - `vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8`
- Lending adaptor:
  - `aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz`
- Drift adaptor:
  - `EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP`
- Raydium adaptor:
  - `A5a3Xo2JaKbXNShSHHP4Fe1LxcxNuCZs97gy3FJMSzkM`
- Kamino adaptor:
  - `to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR`
- Jupiter adaptor:
  - `EW35URAx3LiM13fFK3QxAXfGemHso9HWPixrv7YDY4AM`
- Trustful adaptor:
  - `3pnpK9nrs1R65eMV1wqCXkDkhSgN18xb1G5pgYPwoZjJ`
- Upgrade authority multisig:
  - `7p4d84NuXbuDhaAq9H3Yp3vpBSDLQWousp1a4jBVoBgU`

## User CPI Flow Confirmed

Ranger supports on-chain CPI for user actions:
- `deposit_vault`
- `request_withdraw_vault`
- `withdraw_vault`
- `cancel_request_withdraw_vault`
- `instant_withdraw_vault`

Mainnet vault program for CPI:
- `vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8`

Implication:
- Sentinel does not need to own the user deposit/withdraw transaction builder if Ranger already exposes this through API/SDK/CPI.
- Sentinel can focus on manager/admin workflows plus strategy evidence.

## Security Posture Confirmed

- Ranger docs emphasize:
  - admin/manager separation
  - PDA validation
  - ATA validation
  - checked math
  - account reload after CPI before value calculation
  - accurate returned position values
- Official audits listed:
  - Sec3 X-RAY passed
  - FYEO passed
  - Certora passed

Implication:
- For hackathon credibility, integrating with audited Ranger programs is materially stronger than keeping Sentinel-only simulated vault accounting.

## Revised Integration Decision Tree

### Option A: Existing Jupiter adaptor

Best if:
- Jupiter adaptor supports the exact strategy lane we need
- initialization/deposit/withdraw scripts exist and are practical

Pros:
- fastest path
- stays inside audited Ranger architecture
- lowest custom smart-contract work

Cons:
- strategy flexibility limited by adaptor capability

### Option B: Existing Trustful adaptor

Best if:
- Sentinel wants off-chain/CEX/MPC-style strategy routing
- Trustful supports arbitrary counterparty / managed execution pattern cleanly

Pros:
- may fit Sentinel’s off-chain orchestration better
- could preserve more of current runtime design

Cons:
- requires more due diligence on evidence/accounting semantics

### Option C: Custom Sentinel adaptor

Best if:
- Jupiter and Trustful cannot express the strategy safely/truthfully

Pros:
- maximal fit to Sentinel execution model

Cons:
- highest implementation risk
- requires on-chain Rust adaptor work
- new security/testing burden

## Updated Submission-Ready Recommendation

Shortest viable path is now:

1. Real Ranger vault creation via `@voltr/vault-sdk`
2. Real LP metadata creation
3. Real adaptor add + strategy init using an existing adaptor
4. Real manager allocation transaction path
5. Sentinel runtime switched to monitor/report Ranger vault state instead of pretending to be the vault of record
6. Submission dossier/export updated with real Ranger vault pubkey, LP metadata, and strategy allocation evidence

## Current Best Guess

The most realistic submission-ready target is:
- Ranger vault on mainnet
- Ranger Jupiter adaptor if viable
- Sentinel as manager-side orchestration, monitoring, evidence, and investor/operator dashboard

If Jupiter adaptor cannot express the strategy correctly, next best path is:
- Ranger vault on mainnet
- Trustful adaptor
- Sentinel runtime as off-chain decision engine

## Immediate Integration Direction

Most likely realistic path for Sentinel:

- use Ranger vault for on-chain vault + LP token + user deposit/withdraw surface
- use Ranger admin/manager roles directly
- use an existing adaptor if Jupiter or Trustful is sufficient
- otherwise build a Sentinel-specific adaptor boundary
- keep Sentinel runtime as the off-chain policy / orchestration / evidence layer

Avoid:
- rebuilding Ranger vault accounting internally as the source of truth
- pretending simulated Ranger integration is enough for a hackathon-grade Earn submission
