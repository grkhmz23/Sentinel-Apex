import { createEncryptSdkPreAlphaClient, createEncryptStrategyClient } from './encrypt-client-factory.js';
import { buildEncryptSdkDemoInput } from './sdk-demo-input.js';

import type { EncryptClient } from './encrypt-client.js';
import type { EncryptSdkPreAlphaClient } from './sdk-prealpha-types.js';
import type {
  CreateEncryptSdkDemoInput,
  CreateEncryptedStrategyStateInput,
  EncryptRuntimeConfig,
  EncryptSdkDemoEvidence,
  EncryptedStrategyAdapterResult,
} from './types.js';

export class EncryptedStrategyService {
  private readonly client: EncryptClient;
  private readonly sdkClient: EncryptSdkPreAlphaClient;

  constructor(private readonly config: EncryptRuntimeConfig) {
    const sdkConfig = {
      sdkMode: config.sdkMode,
      grpcEndpoint: config.grpcEndpoint,
      programId: config.programId,
      networkEncryptionPublicKey: config.networkEncryptionPublicKey,
      sdkDemoAck: config.sdkDemoAck,
      sdkStrict: config.sdkStrict,
    };
    this.client = createEncryptStrategyClient(sdkConfig);
    this.sdkClient = createEncryptSdkPreAlphaClient(sdkConfig);
  }

  async createEncryptedStrategyState(input: CreateEncryptedStrategyStateInput): Promise<EncryptedStrategyAdapterResult> {
    const result = this.client.createEncryptedStrategyState(input);
    if (this.config.sdkMode !== 'sdk-prealpha') {
      return result;
    }
    const sdkEvidence = await this.sdkClient.createDemoInput(buildEncryptSdkDemoInput(input.strategyId));
    if (!sdkEvidence.success && this.config.sdkStrict) {
      throw new Error(sdkEvidence.errorMessage ?? 'Encrypt SDK pre-alpha demo input creation failed.');
    }
    return {
      ...result,
      ciphertextRefs: sdkEvidence.success && sdkEvidence.ciphertextIdentifiers[0] !== undefined
        ? {
            ...result.ciphertextRefs,
            allocationWeights: sdkEvidence.ciphertextIdentifiers[0],
          }
        : result.ciphertextRefs,
      ciphertextStatus: sdkEvidence.success ? 'pending' : 'failed',
      publicSummary: {
        ...result.publicSummary,
        sdkMode: this.config.sdkMode,
        sdkDemoSuccess: sdkEvidence.success,
        sdkEvidenceStored: true,
      },
      capabilities: {
        ...result.capabilities,
        adapterMode: 'sdk-prealpha',
      },
      sdkEvidence,
    };
  }

  async updateEncryptedStrategyState(input: CreateEncryptedStrategyStateInput): Promise<EncryptedStrategyAdapterResult> {
    return this.createEncryptedStrategyState(input);
  }

  getCiphertextStatus(ref: string): { ref: string; status: 'verified'; preAlphaMode: true } {
    return {
      ref,
      status: this.client.getCiphertextStatus(ref) as 'verified',
      preAlphaMode: true,
    };
  }

  buildPublicStrategySummary(result: EncryptedStrategyAdapterResult): Record<string, unknown> {
    return {
      ...result.publicSummary,
      ciphertextStatus: result.ciphertextStatus,
      productionPrivacyReady: result.capabilities.productionPrivacyReady,
      realEncryption: result.capabilities.realEncryption,
      preAlphaMode: result.capabilities.preAlphaMode,
    };
  }

  async getSdkAvailable(): Promise<boolean> {
    return this.sdkClient.isAvailable();
  }

  async createSdkDemoInput(input: CreateEncryptSdkDemoInput): Promise<EncryptSdkDemoEvidence> {
    const evidence = await this.sdkClient.createDemoInput(buildEncryptSdkDemoInput(input.strategyId));
    if (!evidence.success && this.config.sdkStrict) {
      throw new Error(evidence.errorMessage ?? 'Encrypt SDK pre-alpha demo input creation failed.');
    }
    return evidence;
  }
}
