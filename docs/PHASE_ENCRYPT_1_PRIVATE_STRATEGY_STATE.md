# Phase Encrypt-1 Private Strategy State

## What Was Implemented

Phase Encrypt-1 adds an honest Encrypt pre-alpha integration layer for PUSD treasury strategy state.

- PUSD remains the vault/base asset.
- Encrypt is disabled by default.
- Enabling Encrypt requires explicit pre-alpha acknowledgement.
- Runtime cycles can persist public strategy commitments and ciphertext references.
- API endpoints expose Encrypt status, strategy state, reveal requests, and audit evidence.
- The ops dashboard includes `/encrypt` for the PUSD + Encrypt pre-alpha story.

## What Encrypt Pre-Alpha Means

Encrypt developer documentation describes the current SDK as pre-alpha. This phase does not claim production privacy.

- `preAlphaMode: true`
- `productionPrivacyReady: false`
- `realEncryption: false`
- No sensitive or production strategy data should be submitted.
- Production privacy depends on Encrypt Alpha/Mainnet maturity and final SDK/API guarantees.

Because the actual Encrypt SDK is not available in this repository, Sentinel Apex uses an internal pre-alpha adapter boundary. It creates deterministic strategy commitments and ciphertext reference identifiers for demo/test strategy values only.

## Private Strategy Fields By Design

These fields are treated as confidential strategy state and represented by ciphertext references:

- total vault balance bucket
- allocation weights
- risk thresholds
- rebalance threshold
- pending rebalance amount
- simulated venue exposure
- max single-intent size
- max daily movement

## Public Fields

These fields remain public for operator safety and auditability:

- strategy id
- vault asset `PUSD`
- strategy commitment
- ciphertext references
- ciphertext status
- public risk status
- runtime mode
- last update time
- audit evidence

## Configuration

Encrypt is disabled by default:

```bash
ENCRYPT_ENABLED=false
ENCRYPT_CLUSTER=devnet
ENCRYPT_PROGRAM_ID=
ENCRYPT_CONFIG_PDA=
ENCRYPT_NETWORK_ENCRYPTION_KEY=
```

To enable the pre-alpha layer in local/dev environments:

```bash
VAULT_BASE_ASSET=PUSD
PUSD_MINT=<PUSD mint public key>
PUSD_DECIMALS=6
ENCRYPT_ENABLED=true
ENCRYPT_CLUSTER=devnet
ENCRYPT_PROGRAM_ID=<Encrypt pre-alpha program public key>
ENCRYPT_PRE_ALPHA_ACK=I_UNDERSTAND_ENCRYPT_PRE_ALPHA_IS_NOT_PRODUCTION_PRIVACY
```

Startup fails closed if `ENCRYPT_ENABLED=true` and the acknowledgement is missing or incorrect. Program IDs and optional public keys must be valid Solana public keys.

## Codespaces Demo Flow

```bash
pnpm install
VAULT_BASE_ASSET=PUSD \
PUSD_MINT=<public mint> \
PUSD_DECIMALS=6 \
ENCRYPT_ENABLED=true \
ENCRYPT_CLUSTER=devnet \
ENCRYPT_PROGRAM_ID=<public program id> \
ENCRYPT_PRE_ALPHA_ACK=I_UNDERSTAND_ENCRYPT_PRE_ALPHA_IS_NOT_PRODUCTION_PRIVACY \
pnpm dev
```

Open the dashboard route `/encrypt`.

## API Endpoints

- `GET /api/v1/encrypt/status`
- `GET /api/v1/encrypt/strategy-state`
- `POST /api/v1/encrypt/strategy-state`
- `POST /api/v1/encrypt/strategy-state/update`
- `POST /api/v1/encrypt/reveal-request`
- `GET /api/v1/encrypt/audit`

Mutating endpoints require operator authentication, reject private key material, and create audit evidence.

## Safety Constraints

- No live PUSD execution.
- No PUSD signing.
- No `sendTransaction` for PUSD movement.
- No private keys, seed phrases, mnemonics, or wallet JSON accepted by Encrypt endpoints.
- No production-sensitive plaintext strategy data should be used.
- Jupiter Perps remains unselected in PUSD mode.
- The pre-alpha adapter is labeled as `pre-alpha-mock-adapter`.

## Intentionally Disabled

- Ika.
- Live trading.
- Treasury execution signing.
- Production FHE/privacy claims.
- Sensitive data ingestion.
- Real ciphertext account submission until an actual Encrypt SDK/API is available and mature.

## Next Phase

Phase Encrypt-2 should replace the pre-alpha adapter with the actual Encrypt SDK once its APIs and privacy guarantees are stable enough for non-sensitive testnet integration.
