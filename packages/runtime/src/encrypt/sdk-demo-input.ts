import type { EncryptSdkDemoInput } from './types.js';

export function buildEncryptSdkDemoInput(strategyId = 'pusd-treasury-vault-sdk-prealpha-demo'): EncryptSdkDemoInput {
  return {
    strategyId,
    demoOnly: true,
    nonSensitive: true,
    preAlphaPlaintextRisk: true,
    fields: {
      allocationWeightBps: 2500,
      rebalanceThresholdBps: 100,
      maxIntentSizePusd: 1000,
      riskLimitBps: 500,
    },
  };
}

export function encodeEncryptSdkDemoInput(input: EncryptSdkDemoInput): Buffer {
  return Buffer.from(JSON.stringify({
    strategyId: input.strategyId,
    demoOnly: input.demoOnly,
    nonSensitive: input.nonSensitive,
    preAlphaPlaintextRisk: input.preAlphaPlaintextRisk,
    fields: input.fields,
  }), 'utf8');
}
