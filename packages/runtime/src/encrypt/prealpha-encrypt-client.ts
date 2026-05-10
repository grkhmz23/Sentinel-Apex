import { createHash } from 'node:crypto';

import type {
  CreateEncryptedStrategyStateInput,
  EncryptCapabilities,
  EncryptCiphertextRefs,
  EncryptedStrategyAdapterResult,
} from './types.js';

export const PRE_ALPHA_ENCRYPT_CAPABILITIES: EncryptCapabilities = {
  supportsCiphertextAccounts: true,
  supportsGraphExecution: false,
  supportsThresholdDecrypt: false,
  preAlphaMode: true,
  productionPrivacyReady: false,
  realEncryption: false,
  adapterMode: 'pre-alpha-mock-adapter',
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function digest(prefix: string, input: unknown): string {
  return `${prefix}_${createHash('sha256').update(stableStringify(input)).digest('hex')}`;
}

export class PreAlphaEncryptClient {
  readonly capabilities = PRE_ALPHA_ENCRYPT_CAPABILITIES;

  createEncryptedStrategyState(input: CreateEncryptedStrategyStateInput): EncryptedStrategyAdapterResult {
    const base = {
      strategyId: input.strategyId,
      vaultAssetSymbol: input.vaultAssetSymbol,
      vaultAssetMint: input.vaultAssetMint,
      encryptCluster: input.encryptCluster,
      privateFields: input.privateFields,
    };

    const ciphertextRefs: EncryptCiphertextRefs = {
      totalVaultBalanceBucket: digest('encrypt_pre_alpha_ct_total_balance_bucket', {
        strategyId: input.strategyId,
        value: input.privateFields.totalVaultBalanceBucket,
      }),
      allocationWeights: digest('encrypt_pre_alpha_ct_allocation_weights', {
        strategyId: input.strategyId,
        value: input.privateFields.allocationWeights,
      }),
      riskThresholds: digest('encrypt_pre_alpha_ct_risk_thresholds', {
        strategyId: input.strategyId,
        value: input.privateFields.riskThresholds,
      }),
      rebalanceThreshold: digest('encrypt_pre_alpha_ct_rebalance_threshold', {
        strategyId: input.strategyId,
        value: input.privateFields.rebalanceThreshold,
      }),
      pendingRebalanceAmount: digest('encrypt_pre_alpha_ct_pending_rebalance', {
        strategyId: input.strategyId,
        value: input.privateFields.pendingRebalanceAmount,
      }),
      simulatedVenueExposure: digest('encrypt_pre_alpha_ct_sim_exposure', {
        strategyId: input.strategyId,
        value: input.privateFields.simulatedVenueExposure,
      }),
      maxSingleIntentSize: digest('encrypt_pre_alpha_ct_max_single_intent', {
        strategyId: input.strategyId,
        value: input.privateFields.maxSingleIntentSize,
      }),
      maxDailyMovement: digest('encrypt_pre_alpha_ct_max_daily_movement', {
        strategyId: input.strategyId,
        value: input.privateFields.maxDailyMovement,
      }),
    };

    return {
      strategyCommitment: digest('encrypt_pre_alpha_commitment', base),
      ciphertextRefs,
      ciphertextStatus: 'verified',
      publicSummary: {
        strategyId: input.strategyId,
        vaultAssetSymbol: input.vaultAssetSymbol,
        encryptCluster: input.encryptCluster,
        publicRiskStatus: input.publicRiskStatus,
        privateFieldCount: Object.keys(input.privateFields).length,
        preAlphaWarning: 'Encrypt pre-alpha stores public/plaintext data on-chain; no production privacy.',
      },
      capabilities: this.capabilities,
    };
  }

  getCiphertextStatus(): 'verified' {
    return 'verified';
  }
}
