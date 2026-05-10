import { describe, expect, it } from 'vitest';

import { PreAlphaEncryptClient } from '../prealpha-encrypt-client.js';
import { rejectForbiddenEncryptFields } from '../types.js';

const input = {
  strategyId: 'pusd-treasury-vault-prealpha',
  vaultAssetSymbol: 'PUSD' as const,
  vaultAssetMint: 'So11111111111111111111111111111111111111112',
  encryptCluster: 'devnet' as const,
  publicRiskStatus: 'normal',
  privateFields: {
    totalVaultBalanceBucket: 'pre-alpha-demo-bucket-funded',
    allocationWeights: { idlePusd: '40', simulatedCarry: '60' },
    riskThresholds: { maxDrawdownPct: '5' },
    rebalanceThreshold: '2.5',
    pendingRebalanceAmount: '0',
    simulatedVenueExposure: { simulated: 'true' },
    maxSingleIntentSize: '10000',
    maxDailyMovement: '25000',
  },
};

describe('PreAlphaEncryptClient', () => {
  it('returns explicit pre-alpha capabilities without production privacy claims', () => {
    const client = new PreAlphaEncryptClient();

    expect(client.capabilities.productionPrivacyReady).toBe(false);
    expect(client.capabilities.realEncryption).toBe(false);
    expect(client.capabilities.preAlphaMode).toBe(true);
  });

  it('creates deterministic commitments and ciphertext refs', () => {
    const client = new PreAlphaEncryptClient();
    const first = client.createEncryptedStrategyState(input);
    const second = client.createEncryptedStrategyState(input);

    expect(first.strategyCommitment).toBe(second.strategyCommitment);
    expect(first.ciphertextRefs.allocationWeights).toBe(second.ciphertextRefs.allocationWeights);
    expect(first.ciphertextStatus).toBe('verified');
  });

  it('rejects forbidden key material fields at the boundary', () => {
    expect(() => rejectForbiddenEncryptFields({ walletJson: '{}' })).toThrow(/walletJson/);
    expect(() => rejectForbiddenEncryptFields({ privateKey: 'not-accepted' })).toThrow(/privateKey/);
  });
});
