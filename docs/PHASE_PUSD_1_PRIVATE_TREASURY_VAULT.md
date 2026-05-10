# Phase PUSD-1 Private Treasury Vault

## What Was Implemented

Phase PUSD-1 makes PUSD a first-class configurable vault/base asset for Sentinel Apex.

- `VAULT_BASE_ASSET=PUSD` selects PUSD mode.
- `PUSD_MINT` and `PUSD_DECIMALS` are required in PUSD mode and startup fails closed without them.
- The runtime can run a PUSD-denominated treasury cycle.
- The runtime captures PUSD vault snapshots with read-only token balance status.
- PUSD deposit, withdrawal, and rebalance requests are persisted as operator intents.
- The API exposes PUSD vault, treasury state, snapshots, and intent endpoints.
- The ops dashboard includes a PUSD Vault page with accounting, dry-run posture, intents, and audit evidence.

## Configuration

Required for PUSD mode:

```bash
VAULT_BASE_ASSET=PUSD
PUSD_MINT=<PUSD mint public key>
PUSD_DECIMALS=<PUSD decimals>
```

Optional read-only balance configuration:

```bash
SOLANA_RPC_ENDPOINT=<Solana RPC URL>
PUSD_VAULT_OWNER=<vault or owner public key>
```

`PUSD_MINT` and `PUSD_VAULT_OWNER` are validated as Solana public keys. `PUSD_DECIMALS` must be a safe integer from 0 to 18.

## Local Run In Codespaces

```bash
pnpm install
VAULT_BASE_ASSET=PUSD \
PUSD_MINT=<public mint> \
PUSD_DECIMALS=6 \
SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com \
pnpm dev
```

Use the dashboard route `/pusd` to inspect PUSD vault state.

## API Endpoints

- `GET /api/v1/pusd/vault`
- `GET /api/v1/pusd/treasury-state`
- `GET /api/v1/pusd/snapshots`
- `POST /api/v1/pusd/deposit-intent`
- `POST /api/v1/pusd/withdraw-intent`
- `POST /api/v1/pusd/rebalance-intent`

Mutating endpoints require operator authentication, reject private key material, and only create operator intents.

## What Is Real

- PUSD vault/base asset configuration and validation.
- PUSD mint and decimals persistence on vault configuration.
- Read-only SPL token balance accounting when RPC and vault owner are configured.
- Durable PUSD vault snapshots.
- Durable PUSD operator intents.
- Audit events for PUSD snapshots and operator intents.
- PUSD-denominated runtime and dashboard summaries.

## What Is Simulation / Dry-Run

- PUSD treasury/yield opportunities are deterministic dry-run models.
- PUSD/USDC liquidity carry and PUSD lending carry are simulated strategy labels only.
- Treasury adapter capabilities explicitly report `supportsLiveExecution: false`.
- PUSD operator intents do not submit transactions.

## Intentionally Not Implemented

- Encrypt/FHE.
- Ika.
- Live PUSD yield execution.
- Any signing path.
- `sendTransaction`.
- Private key, seed phrase, mnemonic, or wallet JSON ingestion.
- Fake real transaction signatures.

## Safety Constraints

- No private keys are accepted by PUSD API endpoints.
- No secrets are stored in PUSD tables.
- Missing PUSD config fails closed.
- Missing associated token accounts read as zero balance.
- RPC failures return structured read status instead of creating execution side effects.
- Jupiter Perps is not selected by default in PUSD mode.

## Next Phase

Phase Encrypt-1 should add private strategy state and privacy-preserving operator evidence after the PUSD foundation is stable.
