export const ENCRYPT_FORBIDDEN_FIELDS = [
  'privateKey',
  'secretKey',
  'seedPhrase',
  'mnemonic',
  'walletJson',
  'keypair',
  'signer',
  'rawStrategy',
  'productionStrategy',
  'vaultBalance',
  'realAllocation',
  'inputs',
] as const;

export type EncryptCluster = 'devnet' | 'testnet' | 'mainnet-beta';
export type EncryptSdkMode = 'adapter' | 'sdk-prealpha';
export type EncryptCiphertextStatus =
  | 'not_created'
  | 'pending'
  | 'verified'
  | 'reveal_requested'
  | 'reveal_completed'
  | 'failed';

export interface EncryptCapabilities {
  supportsCiphertextAccounts: boolean;
  supportsGraphExecution: boolean;
  supportsThresholdDecrypt: boolean;
  preAlphaMode: true;
  productionPrivacyReady: false;
  realEncryption: false;
  adapterMode: 'pre-alpha-mock-adapter' | 'sdk-prealpha';
}

export interface EncryptRuntimeConfig {
  enabled: boolean;
  cluster: EncryptCluster;
  programId: string | null;
  configPda: string | null;
  networkEncryptionKey: string | null;
  preAlphaAck: boolean;
  sdkMode: EncryptSdkMode;
  grpcEndpoint: string | null;
  solanaRpcUrl: string | null;
  networkEncryptionPublicKey: string | null;
  sdkDemoAck: boolean;
  sdkStrict: boolean;
}

export interface EncryptPrivateStrategyFields {
  totalVaultBalanceBucket: string;
  allocationWeights: Record<string, string>;
  riskThresholds: Record<string, string>;
  rebalanceThreshold: string;
  pendingRebalanceAmount: string;
  simulatedVenueExposure: Record<string, string>;
  maxSingleIntentSize: string;
  maxDailyMovement: string;
}

export interface EncryptCiphertextRefs {
  totalVaultBalanceBucket: string;
  allocationWeights: string;
  riskThresholds: string;
  rebalanceThreshold: string;
  pendingRebalanceAmount: string;
  simulatedVenueExposure: string;
  maxSingleIntentSize: string;
  maxDailyMovement: string;
}

export interface CreateEncryptedStrategyStateInput {
  strategyId: string;
  vaultAssetSymbol: 'PUSD';
  vaultAssetMint: string;
  encryptCluster: EncryptCluster;
  publicRiskStatus: string;
  privateFields: EncryptPrivateStrategyFields;
  auditEvidence?: Record<string, unknown>;
  actorId?: string | null;
}

export interface EncryptedStrategyAdapterResult {
  strategyCommitment: string;
  ciphertextRefs: EncryptCiphertextRefs;
  ciphertextStatus: EncryptCiphertextStatus;
  publicSummary: Record<string, unknown>;
  capabilities: EncryptCapabilities;
  sdkEvidence?: EncryptSdkDemoEvidence;
}

export interface RevealRequestInput {
  strategyStateId: string;
  requestedBy: string;
  reason: string;
}

export interface EncryptSdkDemoInput {
  strategyId: string;
  demoOnly: true;
  nonSensitive: true;
  preAlphaPlaintextRisk: true;
  fields: {
    allocationWeightBps: 2500;
    rebalanceThresholdBps: 100;
    maxIntentSizePusd: 1000;
    riskLimitBps: 500;
  };
}

export interface EncryptSdkDemoEvidence {
  strategyId: string;
  sdkMode: 'sdk-prealpha';
  endpoint: string | null;
  endpointHost: string | null;
  chain: 'Solana';
  programId: string | null;
  strategyCommitment: string;
  success: boolean;
  sdkAvailable: boolean;
  sdkConfigured: boolean;
  ciphertextIdentifiers: string[];
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: string;
  preAlphaMode: true;
  productionPrivacyReady: false;
  realEncryption: false;
  demoOnly: true;
  nonSensitive: true;
  preAlphaPlaintextRisk: true;
}

export interface CreateEncryptSdkDemoInput {
  strategyId?: string;
  actorId: string;
}

export function rejectForbiddenEncryptFields(body: unknown): void {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return;
  }
  const record = body as Record<string, unknown>;
  for (const field of ENCRYPT_FORBIDDEN_FIELDS) {
    if (record[field] !== undefined) {
      throw new Error(`${field} is not accepted by Encrypt pre-alpha endpoints.`);
    }
  }
}
