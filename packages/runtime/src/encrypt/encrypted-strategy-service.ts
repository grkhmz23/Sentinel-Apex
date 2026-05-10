import { PreAlphaEncryptClient } from './prealpha-encrypt-client.js';

import type {
  CreateEncryptedStrategyStateInput,
  EncryptedStrategyAdapterResult,
} from './types.js';

export class EncryptedStrategyService {
  private readonly client = new PreAlphaEncryptClient();

  createEncryptedStrategyState(input: CreateEncryptedStrategyStateInput): EncryptedStrategyAdapterResult {
    return this.client.createEncryptedStrategyState(input);
  }

  updateEncryptedStrategyState(input: CreateEncryptedStrategyStateInput): EncryptedStrategyAdapterResult {
    return this.client.createEncryptedStrategyState(input);
  }

  getCiphertextStatus(ref: string): { ref: string; status: 'verified'; preAlphaMode: true } {
    return {
      ref,
      status: this.client.getCiphertextStatus(),
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
}
