# Phase Encrypt-2B Devnet SDK Demo

Phase Encrypt-2B adds a repeatable, judge-friendly Encrypt pre-alpha SDK demo flow for the PUSD treasury vault.

## What This Adds

- `pnpm encrypt:sdk-demo` for a one-command Codespaces SDK demo.
- A sanitized local evidence export at `.tmp/encrypt-sdk-demo-evidence.json`.
- A clearer `/encrypt` dashboard demo section with latest SDK result and recent evidence.
- Hardened API rejection for production-looking payload fields.

## What It Proves

- Sentinel Apex can load explicit Encrypt SDK pre-alpha devnet configuration.
- The runtime can call the installed `@encrypt.xyz/pre-alpha-solana-client` wrapper.
- The demo path stores SDK evidence and displays it for operators.
- The flow is repeatable for a hackathon walkthrough.

## What It Does Not Prove

- It does not prove production privacy.
- It does not prove real encryption for Sentinel strategy data.
- It does not send production treasury balances, real allocations, or strategy secrets.
- It does not enable live PUSD execution, signing, `sendTransaction`, or Ika.

## Codespaces Setup

1. Install dependencies if needed:

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and keep SDK mode disabled until the demo:

```bash
cp .env.example .env
```

3. Ensure normal local requirements are present:

```bash
NODE_ENV=development
DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
API_SECRET_KEY=<32+ character local demo key>
```

4. For the SDK demo only, set:

```bash
ENCRYPT_ENABLED=true
ENCRYPT_CLUSTER=devnet
ENCRYPT_SDK_MODE=sdk-prealpha
ENCRYPT_GRPC_ENDPOINT=pre-alpha-dev-1.encrypt.ika-network.net:443
ENCRYPT_SOLANA_RPC_URL=https://api.devnet.solana.com
ENCRYPT_PROGRAM_ID=4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8
ENCRYPT_NETWORK_ENCRYPTION_PUBLIC_KEY=<current Encrypt pre-alpha network encryption public key>
ENCRYPT_PRE_ALPHA_ACK=I_UNDERSTAND_ENCRYPT_PRE_ALPHA_IS_NOT_PRODUCTION_PRIVACY
ENCRYPT_SDK_DEMO_ACK=I_UNDERSTAND_ENCRYPT_SDK_PREALPHA_USES_NON_SENSITIVE_DEMO_DATA_ONLY
ENCRYPT_SDK_STRICT=false
```

## CLI Demo Flow

Run:

```bash
pnpm encrypt:sdk-demo
```

The script uses only deterministic demo values:

- `allocationWeightBps: 2500`
- `rebalanceThresholdBps: 100`
- `maxIntentSizePusd: 1000`
- `riskLimitBps: 500`

It prints and writes sanitized evidence:

- SDK mode
- endpoint host
- program id
- ciphertext identifiers if returned
- strategy commitment
- `productionPrivacyReady=false`
- `realEncryption=false`
- timestamp
- sanitized error if failed

The generated evidence file is `.tmp/encrypt-sdk-demo-evidence.json` and is ignored by git.

## API And Dashboard Flow

Start the app:

```bash
pnpm dev
```

API endpoints:

- `GET /api/v1/encrypt/status`
- `POST /api/v1/encrypt/sdk-demo/create-input`
- `GET /api/v1/encrypt/sdk-demo/evidence`

The create-input endpoint requires operator auth. It rejects arbitrary plaintext and forbidden fields including `privateKey`, `secretKey`, `seedPhrase`, `mnemonic`, `walletJson`, `keypair`, `signer`, `rawStrategy`, `productionStrategy`, `vaultBalance`, and `realAllocation`.

Dashboard demo:

1. Open `/encrypt`.
2. Confirm SDK mode, configured status, endpoint host, and program id.
3. Confirm `productionPrivacyReady=false` and `realEncryption=false`.
4. Click “Create demo ciphertext input”.
5. Show the latest result and recent evidence table.

## Troubleshooting

- SDK package not installed: run `pnpm install` and verify `@encrypt.xyz/pre-alpha-solana-client` is present in `@sentinel-apex/runtime`.
- gRPC endpoint unavailable: the CLI/API records `success=false` with a sanitized error. This is acceptable for pre-alpha infrastructure.
- Devnet reset: rerun the demo; prior ciphertext identifiers may no longer resolve.
- Missing ack: set both exact acknowledgement values shown above.
- Invalid program id: use a valid Solana public key.
- Operator auth failure: sign in to the ops dashboard as an operator/admin or use the backend operator HMAC headers.

## Safety Statement

This is not production privacy. It uses non-sensitive demo inputs only. Live PUSD execution, signing, `sendTransaction`, production-sensitive values, real confidentiality claims, and Ika remain disabled.

## Hackathon Video Script

60 to 90 seconds:

1. “This is Sentinel Apex running a PUSD treasury vault with Encrypt pre-alpha integration.”
2. “The banner is explicit: demo inputs only, not production privacy.”
3. “Status shows SDK mode, endpoint host, program id, `productionPrivacyReady=false`, and `realEncryption=false`.”
4. “I click Create demo ciphertext input. The operator-auth API uses a fixed server-side demo builder; I cannot submit arbitrary strategy plaintext.”
5. “The result is stored as evidence. If devnet returns ciphertext identifiers, they appear here. If the endpoint is unavailable, the failure is shown honestly.”
6. “No signing, no PUSD movement, no `sendTransaction`, and no Ika are enabled in this phase.”
