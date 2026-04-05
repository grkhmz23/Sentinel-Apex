# Runbook: Ranger Vault Setup

**Purpose**: Configure and operate Ranger Earn vault integration

## Prerequisites

- PostgreSQL database running
- Database migrations applied (`pnpm db:migrate`)
- Solana RPC endpoint configured

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Ranger Integration (optional - defaults to simulated mode)
RANGER_VAULT_FACTORY_PROGRAM_ID=
RANGER_STRATEGY_ADAPTER_PROGRAM_ID=
RANGER_INTEGRATION_MODE=simulated  # Options: simulated, readonly, full

# Solana Connection
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
# Or for devnet:
# SOLANA_RPC_ENDPOINT=https://api.devnet.solana.com
```

### Integration Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `simulated` | Local state only, no blockchain interaction | Development, testing |
| `readonly` | Read from blockchain, no transactions | Monitoring, audit |
| `full` | Full blockchain interaction | Production (requires SDK) |

## Creating a Vault

### Step 1: Initialize Client

```typescript
import { RangerVaultClient } from '@sentinel-apex/ranger';
import { Connection, Keypair } from '@solana/web3.js';

const connection = new Connection(process.env.SOLANA_RPC_ENDPOINT!);
const signer = Keypair.fromSecretKey(/* your key */);

const client = new RangerVaultClient({
  connection,
  mode: 'simulated', // or 'full' when SDK available
  signer,
});
```

### Step 2: Check Integration Status

```typescript
const status = client.getIntegrationStatus();
console.log('Mode:', status.mode);
console.log('SDK Available:', status.sdkAvailable);

if (status.blockerDescription) {
  console.warn('Blocker:', status.blockerDescription);
}
```

### Step 3: Create Vault

```typescript
import { VaultConfigSchema } from '@sentinel-apex/ranger';

const config = VaultConfigSchema.parse({
  baseAsset: 'USDC',
  minDeposit: '100',           // Minimum deposit amount
  maxCapacity: '1000000',      // Maximum vault capacity ($1M)
  lockPeriodSeconds: 7884000,  // 3 months
  performanceFeeBps: 1000,     // 10% performance fee
  managementFeeBps: 100,       // 1% management fee
  strategyId: 'delta-neutral-carry',
  strategyMetadataUri: 'https://...', // Optional
});

const authority = signer.publicKey;
const result = await client.createVault(config, authority);

if (result.ok) {
  console.log('Vault ID:', result.value.vaultId);
  console.log('Vault Address:', result.value.vaultAddress.toBase58());
  console.log('Share Token Mint:', result.value.shareTokenMint.toBase58());
} else {
  console.error('Failed to create vault:', result.error.message);
}
```

## Processing Deposits

### Record Deposit

```typescript
const depositResult = await client.deposit(vaultId, {
  depositId: `deposit_${Date.now()}`,
  depositor: depositorPublicKey,
  amount: new Decimal(10000),      // USDC amount
  minSharesOut: new Decimal(9000), // Slippage protection
  requestedAt: new Date(),
});

if (depositResult.ok) {
  console.log('Shares minted:', depositResult.value.sharesMinted.toString());
  console.log('Lock expires:', depositResult.value.lockExpiry);
  console.log('Transaction:', depositResult.value.signature);
}
```

### Query Deposit

```typescript
const deposit = await client.getDeposit(depositId);
if (deposit.ok && deposit.value) {
  console.log('Status:', deposit.value.status);
  console.log('Shares:', deposit.value.sharesMinted.toString());
}
```

## Processing Withdrawals

### Request Withdrawal

```typescript
const withdrawalResult = await client.requestWithdrawal(vaultId, {
  withdrawalId: `withdrawal_${Date.now()}`,
  shareholder: shareholderPublicKey,
  sharesToBurn: new Decimal(5000),
  minAmountOut: new Decimal(4500), // Slippage protection
  requestedAt: new Date(),
});

if (withdrawalResult.ok) {
  console.log('Amount returned:', withdrawalResult.value.amountReturned.toString());
  console.log('Shares burned:', withdrawalResult.value.sharesBurned.toString());
  console.log('Transaction:', withdrawalResult.value.signature);
}
```

## Vault Operations

### Get Vault State

```typescript
const stateResult = await client.getVaultState(vaultId);
if (stateResult.ok) {
  const state = stateResult.value;
  console.log('Status:', state.status);
  console.log('Total AUM:', state.totalAum.toString());
  console.log('Share Price:', state.sharePrice.toString());
  console.log('Total Shares:', state.totalShares.toString());
}
```

### Calculate NAV

```typescript
const navResult = await client.calculateNav(vaultId);
if (navResult.ok) {
  console.log('NAV:', navResult.value.nav.toString());
  console.log('Share Price:', navResult.value.sharePrice.toString());
}
```

### Update Vault Status

```typescript
// Pause vault (admin only)
const result = await client.updateVaultStatus(
  vaultId,
  'paused',
  'Emergency pause due to market conditions'
);

// Resume vault
await client.updateVaultStatus(vaultId, 'active', 'Market conditions normalized');
```

## Submission Verification

### Generate Evidence

```typescript
import { RangerVaultFactoryClient } from '@sentinel-apex/ranger';

const factory = new RangerVaultFactoryClient({
  connection,
  mode: 'simulated',
});

const evidenceResult = await factory.generateSubmissionEvidence(
  vaultId,
  vaultState
);

if (evidenceResult.ok) {
  const evidence = evidenceResult.value;
  console.log('Vault Address:', evidence.vaultAddress.toBase58());
  console.log('Strategy Program:', evidence.strategyProgram.toBase58());
  console.log('Creation Signature:', evidence.creationSignature);
}
```

## Troubleshooting

### "SDK unavailable" Error

**Cause**: Trying to use `mode: 'full'` without Ranger SDK

**Solution**: Use `mode: 'simulated'` for development

### "Vault factory not available"

**Cause**: Factory program ID not configured

**Solution**: Set `RANGER_VAULT_FACTORY_PROGRAM_ID` environment variable

### Database Errors

**Cause**: Migrations not applied

**Solution**:
```bash
pnpm db:migrate
```

## Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **RPC Endpoints**: Use dedicated RPC endpoints in production
3. **Slippage Protection**: Always set `minSharesOut` and `minAmountOut`
4. **Authority**: Keep vault authority secure

## See Also

- [Phase R1 Architecture](/docs/architecture/phase-r1-ranger-vault-foundation.md)
- [Phase R1 Gap Analysis](/docs/audit/phase-r1-ranger-vault-gap-analysis.md)
