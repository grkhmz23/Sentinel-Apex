import { PublicKey } from '@solana/web3.js';

import {
  buildEncryptSdkDemoInput,
  buildEncryptSdkDemoStrategyCommitment,
  encodeEncryptSdkDemoInput,
} from './sdk-demo-input.js';

import type {
  EncryptGrpcModule,
  EncryptSdkPreAlphaClient,
  EncryptSdkPreAlphaConfig,
} from './sdk-prealpha-types.js';
import type { EncryptSdkDemoEvidence, EncryptSdkDemoInput } from './types.js';

const OFFICIAL_GRPC_IMPORT = '@encrypt.xyz/pre-alpha-solana-client/grpc';

function endpointHost(endpoint: string | null): string | null {
  if (endpoint === null) {
    return null;
  }
  return endpoint.split(':')[0] ?? endpoint;
}

function sanitizeSdkError(error: unknown): { code: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const code = typeof record['code'] === 'string' || typeof record['code'] === 'number'
      ? String(record['code'])
      : 'SDK_ERROR';
    const details = typeof record['details'] === 'string' ? record['details'] : null;
    const message = error instanceof Error ? error.message : details;
    return {
      code,
      message: message === null || message.trim() === '' ? 'Encrypt SDK pre-alpha request failed.' : message,
    };
  }
  if (error instanceof Error) {
    return { code: 'SDK_ERROR', message: error.message };
  }
  return { code: 'SDK_ERROR', message: 'Encrypt SDK pre-alpha request failed.' };
}

function publicKeyBuffer(value: string): Buffer {
  return Buffer.from(new PublicKey(value).toBytes());
}

function evidenceBase(config: EncryptSdkPreAlphaConfig, strategyId: string): Omit<
  EncryptSdkDemoEvidence,
  'success' | 'sdkAvailable' | 'sdkConfigured' | 'ciphertextIdentifiers' | 'errorCode' | 'errorMessage'
> {
  const input = buildEncryptSdkDemoInput(strategyId);
  return {
    strategyId,
    sdkMode: 'sdk-prealpha',
    endpoint: config.grpcEndpoint,
    endpointHost: endpointHost(config.grpcEndpoint),
    chain: 'Solana',
    programId: config.programId,
    strategyCommitment: buildEncryptSdkDemoStrategyCommitment(input),
    requestedAt: new Date().toISOString(),
    preAlphaMode: true,
    productionPrivacyReady: false,
    realEncryption: false,
    demoOnly: true,
    nonSensitive: true,
    preAlphaPlaintextRisk: true,
  };
}

export class SdkPreAlphaEncryptClient implements EncryptSdkPreAlphaClient {
  constructor(
    private readonly config: EncryptSdkPreAlphaConfig,
    private readonly loadGrpcModule: () => Promise<EncryptGrpcModule> = async () => {
      const moduleName = OFFICIAL_GRPC_IMPORT;
      return await import(moduleName) as unknown as EncryptGrpcModule;
    },
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      await this.loadGrpcModule();
      return true;
    } catch {
      return false;
    }
  }

  async createDemoInput(input: EncryptSdkDemoInput = buildEncryptSdkDemoInput()): Promise<EncryptSdkDemoEvidence> {
    const base = evidenceBase(this.config, input.strategyId);
    const sdkConfigured = this.config.sdkMode === 'sdk-prealpha' &&
      this.config.grpcEndpoint !== null &&
      this.config.programId !== null &&
      this.config.networkEncryptionPublicKey !== null &&
      this.config.sdkDemoAck;

    if (!sdkConfigured) {
      return {
        ...base,
        success: false,
        sdkAvailable: await this.isAvailable(),
        sdkConfigured: false,
        ciphertextIdentifiers: [],
        errorCode: 'SDK_NOT_CONFIGURED',
        errorMessage: 'Encrypt SDK pre-alpha mode is not fully configured for demo input creation.',
      };
    }

    let module: EncryptGrpcModule;
    try {
      module = await this.loadGrpcModule();
    } catch (error) {
      const sanitized = sanitizeSdkError(error);
      return {
        ...base,
        success: false,
        sdkAvailable: false,
        sdkConfigured: true,
        ciphertextIdentifiers: [],
        errorCode: 'SDK_UNAVAILABLE',
        errorMessage: sanitized.message,
      };
    }

    const client = module.createEncryptClient(this.config.grpcEndpoint ?? undefined);
    try {
      const result = await client.createInput({
        chain: module.Chain.Solana,
        inputs: [{
          ciphertextBytes: encodeEncryptSdkDemoInput(input),
          fheType: 0,
        }],
        proof: Buffer.alloc(0),
        authorized: publicKeyBuffer(this.config.programId as string),
        networkEncryptionPublicKey: publicKeyBuffer(this.config.networkEncryptionPublicKey as string),
      });

      return {
        ...base,
        success: true,
        sdkAvailable: true,
        sdkConfigured: true,
        ciphertextIdentifiers: result.ciphertextIdentifiers.map((identifier) => Buffer.from(identifier).toString('hex')),
        errorCode: null,
        errorMessage: null,
      };
    } catch (error) {
      const sanitized = sanitizeSdkError(error);
      return {
        ...base,
        success: false,
        sdkAvailable: true,
        sdkConfigured: true,
        ciphertextIdentifiers: [],
        errorCode: sanitized.code,
        errorMessage: sanitized.message,
      };
    } finally {
      client.close();
    }
  }
}
