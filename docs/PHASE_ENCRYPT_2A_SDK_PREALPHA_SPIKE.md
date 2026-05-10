# Phase Encrypt-2A SDK Pre-Alpha Spike

Phase Encrypt-2A adds an optional SDK-backed Encrypt pre-alpha demo path beside the existing deterministic adapter.

## What Was Implemented

- Installed `@encrypt.xyz/pre-alpha-solana-client` in `@sentinel-apex/runtime`.
- Added `ENCRYPT_SDK_MODE=adapter|sdk-prealpha`.
- Added a runtime SDK wrapper using the official gRPC import shape:
  `@encrypt.xyz/pre-alpha-solana-client/grpc`.
- Added a fixed demo input builder for non-sensitive PUSD strategy demo values.
- Added API endpoints for SDK demo status and evidence.
- Added dashboard evidence for the SDK pre-alpha demo path.

## Truth and Limitations

Encrypt pre-alpha is not production privacy.

- `productionPrivacyReady=false`
- `realEncryption=false`
- Demo/test inputs only
- No production treasury values
- No strategy secrets
- No signing for PUSD movement
- No `sendTransaction`
- No live trading
- No Ika integration in this phase

Official pre-alpha docs state that data may be public/plaintext on-chain, APIs may change, and devnet data may be wiped.

## Configuration

Default mode remains the safe deterministic adapter:

```bash
ENCRYPT_ENABLED=false
ENCRYPT_SDK_MODE=adapter
```

SDK demo mode must be explicitly enabled:

```bash
ENCRYPT_ENABLED=true
ENCRYPT_CLUSTER=devnet
ENCRYPT_PRE_ALPHA_ACK=I_UNDERSTAND_ENCRYPT_PRE_ALPHA_IS_NOT_PRODUCTION_PRIVACY
ENCRYPT_SDK_MODE=sdk-prealpha
ENCRYPT_SDK_DEMO_ACK=I_UNDERSTAND_ENCRYPT_SDK_PREALPHA_USES_NON_SENSITIVE_DEMO_DATA_ONLY
ENCRYPT_GRPC_ENDPOINT=pre-alpha-dev-1.encrypt.ika-network.net:443
ENCRYPT_SOLANA_RPC_URL=https://api.devnet.solana.com
ENCRYPT_PROGRAM_ID=4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8
ENCRYPT_NETWORK_ENCRYPTION_PUBLIC_KEY=<Encrypt pre-alpha network encryption public key>
ENCRYPT_SDK_STRICT=false
```

`ENCRYPT_SDK_STRICT=false` keeps the PUSD runtime healthy if the pre-alpha endpoint is unavailable. SDK failures are recorded as evidence and warnings.

## Demo Inputs

The SDK endpoint does not accept arbitrary plaintext strategy payloads. It uses a fixed demo builder:

- `allocationWeightBps: 2500`
- `rebalanceThresholdBps: 100`
- `maxIntentSizePusd: 1000`
- `riskLimitBps: 500`

Each SDK evidence record is labeled:

- `demoOnly=true`
- `nonSensitive=true`
- `preAlphaPlaintextRisk=true`

## API

- `GET /api/v1/encrypt/status`
- `POST /api/v1/encrypt/sdk-demo/create-input`
- `GET /api/v1/encrypt/sdk-demo/evidence`

The mutating SDK endpoint requires operator auth and rejects forbidden fields:

- `privateKey`
- `secretKey`
- `seedPhrase`
- `mnemonic`
- `walletJson`
- `keypair`
- `signer`
- `rawStrategy`
- `productionStrategy`
- `inputs`

## Dashboard

Open `/encrypt` and review the “Encrypt SDK Pre-Alpha Demo” section.

For a hackathon video, show:

- PUSD vault remains the stablecoin asset.
- Encrypt status reports SDK mode.
- `productionPrivacyReady=false`.
- `realEncryption=false`.
- SDK evidence shows either returned ciphertext identifiers or a sanitized failure.

Do not present a failed SDK request as success.

## Troubleshooting

- SDK package unavailable: keep `ENCRYPT_SDK_MODE=adapter`.
- gRPC endpoint unreachable: evidence records `success=false` with a sanitized error.
- Devnet reset: rerun the demo; old ciphertext identifiers may no longer resolve.
- Missing network encryption key: startup fails closed in `sdk-prealpha` mode.

## Codespaces Validation

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

## What Remains Disabled

- Production-sensitive strategy values
- Production privacy claims
- Live PUSD movement
- Signing
- `sendTransaction`
- Jupiter Perps in PUSD mode
- Ika

## Recommended Next Phase

Encrypt-2B should use a stable official SDK workflow to register/read ciphertext references against devnet with a documented network encryption key source and no production data.
