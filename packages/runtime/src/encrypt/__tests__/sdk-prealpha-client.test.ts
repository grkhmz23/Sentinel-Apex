import { describe, expect, it } from 'vitest';

import { buildEncryptSdkDemoInput } from '../sdk-demo-input.js';
import { SdkPreAlphaEncryptClient } from '../sdk-prealpha-client.js';
import { rejectForbiddenEncryptFields } from '../types.js';

import type { EncryptGrpcModule } from '../sdk-prealpha-types.js';

const validPublicKey = 'So11111111111111111111111111111111111111112';

const baseConfig = {
  sdkMode: 'sdk-prealpha' as const,
  grpcEndpoint: 'pre-alpha-dev-1.encrypt.ika-network.net:443',
  programId: validPublicKey,
  networkEncryptionPublicKey: validPublicKey,
  sdkDemoAck: true,
  sdkStrict: false,
};

function fakeGrpcModule(result: Uint8Array[] = [new Uint8Array([1, 2, 3])]): EncryptGrpcModule {
  return {
    Chain: { Solana: 0 },
    createEncryptClient: () => ({
      createInput: async () => ({ ciphertextIdentifiers: result }),
      close: () => {},
    }),
  };
}

describe('SdkPreAlphaEncryptClient', () => {
  it('reports unavailable without throwing when the SDK import fails', async () => {
    const client = new SdkPreAlphaEncryptClient(baseConfig, async () => {
      throw new Error('module unavailable');
    });

    await expect(client.isAvailable()).resolves.toBe(false);
    const evidence = await client.createDemoInput(buildEncryptSdkDemoInput('sdk-unavailable-test'));
    expect(evidence).toMatchObject({
      success: false,
      sdkAvailable: false,
      productionPrivacyReady: false,
      realEncryption: false,
      demoOnly: true,
    });
  });

  it('creates deterministic demo input evidence with a mocked SDK client', async () => {
    const client = new SdkPreAlphaEncryptClient(baseConfig, async () => fakeGrpcModule());
    const evidence = await client.createDemoInput(buildEncryptSdkDemoInput('sdk-success-test'));

    expect(evidence).toMatchObject({
      strategyId: 'sdk-success-test',
      success: true,
      sdkAvailable: true,
      sdkConfigured: true,
      ciphertextIdentifiers: ['010203'],
      productionPrivacyReady: false,
      realEncryption: false,
      nonSensitive: true,
      preAlphaPlaintextRisk: true,
    });
  });

  it('returns structured failure evidence when the SDK request fails', async () => {
    const client = new SdkPreAlphaEncryptClient(baseConfig, async () => ({
      Chain: { Solana: 0 },
      createEncryptClient: () => ({
        createInput: async () => {
          throw new Error('grpc unavailable');
        },
        close: () => {},
      }),
    }));

    const evidence = await client.createDemoInput(buildEncryptSdkDemoInput('sdk-failure-test'));
    expect(evidence.success).toBe(false);
    expect(evidence.errorMessage).toContain('grpc unavailable');
    expect(evidence.ciphertextIdentifiers).toEqual([]);
  });

  it('builds only the allowed non-sensitive demo fields and rejects forbidden fields', () => {
    const input = buildEncryptSdkDemoInput('sdk-demo-fields-test');
    expect(input).toMatchObject({
      demoOnly: true,
      nonSensitive: true,
      preAlphaPlaintextRisk: true,
      fields: {
        allocationWeightBps: 2500,
        rebalanceThresholdBps: 100,
        maxIntentSizePusd: 1000,
        riskLimitBps: 500,
      },
    });
    expect(() => rejectForbiddenEncryptFields({ walletJson: '{}' })).toThrow(/walletJson/);
    expect(() => rejectForbiddenEncryptFields({ rawStrategy: { secret: true } })).toThrow(/rawStrategy/);
  });
});
