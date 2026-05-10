import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { EncryptPageData, PusdPageData } from './types';

const demoEvidencePath = resolve(process.cwd(), '../../.tmp/demo-evidence.json');
const timestamp = '2026-05-10T10:00:00.000Z';
const pusdMint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const programId = '4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8';
const strategyCommitment = 'encrypt-sdk-demo-commitment:7c1f3a96b0e9d6a2f8c4d1b5e3a9076c4a2d8e1f6b9c0a3d5e7f1a4b8c2d9e30';
const ciphertextIdentifiers = [
  'encrypt-prealpha-demo:pusd-treasury-vault:allocation-weight-bps',
  'encrypt-prealpha-demo:pusd-treasury-vault:rebalance-threshold-bps',
];

export function hasDemoEvidenceSeed(): boolean {
  return existsSync(demoEvidencePath);
}

export function createDemoPusdPageData(): PusdPageData {
  const snapshot = {
    snapshotId: 'demo-pusd-snapshot-001',
    sourceRunId: 'demo-runtime-cycle-001',
    baseAssetSymbol: 'PUSD' as const,
    baseAssetMint: pusdMint,
    baseAssetDecimals: 6,
    vaultOwnerAddress: 'DemoPusdVault111111111111111111111111111111111',
    balanceRaw: '125000000000',
    balanceAmount: '125000',
    navAmount: '125000',
    treasuryState: {
      demoOnly: true,
      nonSensitive: true,
      accountingMode: 'read-only',
      executionMode: 'dry-run/operator-intent',
    },
    riskStatus: 'demo-normal',
    readStatus: 'ok' as const,
    readError: null,
    capturedAt: timestamp,
    createdAt: timestamp,
  };

  const intent = {
    intentId: 'demo-pusd-operator-intent-001',
    intentType: 'rebalance' as const,
    asset: 'PUSD' as const,
    amount: '1000',
    status: 'requested' as const,
    requestedBy: 'demo-operator',
    reason: 'Hackathon demo operator intent. Dry-run only.',
    payload: {
      demoOnly: true,
      liveExecution: false,
      signing: false,
      sendTransaction: false,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const treasuryState = {
    treasuryRunId: 'demo-pusd-treasury-run-001',
    sourceRunId: 'demo-runtime-cycle-001',
    sleeveId: 'treasury',
    simulated: true,
    policy: {
      sleeveId: 'treasury' as const,
      reserveFloorPct: 20,
      minReserveUsd: '25000',
      minimumRemainingIdleUsd: '10000',
      maxAllocationPctPerVenue: 35,
      minimumDeployableUsd: '1000',
      eligibleVenues: ['demo-read-only-reserve'],
    },
    reserveStatus: {
      totalCapitalUsd: '125000',
      idleCapitalUsd: '95000',
      allocatedCapitalUsd: '30000',
      requiredReserveUsd: '25000',
      currentReserveUsd: '95000',
      reserveCoveragePct: '380',
      surplusCapitalUsd: '70000',
      reserveShortfallUsd: '0',
    },
    actionCount: 1,
    alerts: ['demo_seeded_non_sensitive_data_only'],
    concentrationLimitBreached: false,
    evaluatedAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    vault: {
      phase: 'PUSD+Encrypt-1',
      title: 'Sentinel Apex Private PUSD Treasury Vault',
      baseAsset: 'PUSD',
      baseAssetMint: pusdMint,
      baseAssetDecimals: 6,
      vaultOwnerAddress: snapshot.vaultOwnerAddress,
      runtimeMode: 'dry-run',
      liveExecutionEnabled: false,
      balance: snapshot,
      latestTreasuryState: treasuryState,
      latestIntents: [intent],
      safety: {
        signingEnabled: false,
        sendTransactionEnabled: false,
        liveExecutionEnabled: false,
        simulationOnly: true,
      },
    },
    snapshots: [snapshot],
    intents: [intent],
    auditEvents: [
      {
        eventId: 'demo-pusd-audit-001',
        eventType: 'pusd.demo_seeded',
        occurredAt: timestamp,
        actorType: 'system',
        actorId: 'demo-seed',
        sleeveId: 'treasury',
        correlationId: 'demo-seed-001',
        data: {
          demoOnly: true,
          nonSensitive: true,
          liveExecution: false,
          signing: false,
          sendTransaction: false,
        },
      },
    ],
  };
}

export function createDemoEncryptPageData(): EncryptPageData {
  const sdkEvidence = {
    strategyId: 'pusd-treasury-vault-demo',
    sdkMode: 'sdk-prealpha' as const,
    endpoint: 'pre-alpha-dev-1.encrypt.ika-network.net:443',
    endpointHost: 'pre-alpha-dev-1.encrypt.ika-network.net',
    chain: 'Solana' as const,
    programId,
    strategyCommitment,
    success: true,
    sdkAvailable: true,
    sdkConfigured: true,
    ciphertextIdentifiers,
    errorCode: null,
    errorMessage: null,
    requestedAt: timestamp,
    preAlphaMode: true as const,
    productionPrivacyReady: false as const,
    realEncryption: false as const,
    demoOnly: true as const,
    nonSensitive: true as const,
    preAlphaPlaintextRisk: true as const,
  };

  const strategyState = {
    stateId: 'demo-encrypt-state-001',
    strategyId: 'pusd-treasury-vault-demo',
    vaultAssetSymbol: 'PUSD' as const,
    vaultAssetMint: pusdMint,
    encryptEnabled: true,
    encryptCluster: 'devnet',
    preAlphaMode: true as const,
    productionPrivacyReady: false as const,
    realEncryption: false as const,
    adapterMode: 'sdk-prealpha',
    strategyCommitment,
    ciphertextRefs: {
      allocationWeightBps: ciphertextIdentifiers[0] ?? '',
      rebalanceThresholdBps: ciphertextIdentifiers[1] ?? '',
      maxIntentSizePusd: 'encrypt-prealpha-demo:pusd-treasury-vault:max-intent-size-pusd',
      riskLimitBps: 'encrypt-prealpha-demo:pusd-treasury-vault:risk-limit-bps',
    },
    ciphertextStatus: 'verified' as const,
    publicRiskStatus: 'demo-normal',
    publicSummary: {
      demoOnly: true,
      nonSensitive: true,
      preAlphaPlaintextRisk: true,
    },
    auditEvidence: {
      sdkEvidence,
      productionPrivacyReady: false,
      realEncryption: false,
    },
    createdBy: 'demo-seed',
    updatedBy: 'demo-seed',
    lastUpdateSlot: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    status: {
      enabled: true,
      cluster: 'devnet',
      phase: 'Encrypt-2A',
      title: 'Sentinel Apex Private PUSD Treasury Vault — PUSD + Encrypt Pre-Alpha',
      preAlphaMode: true,
      productionPrivacyReady: false,
      realEncryption: false,
      sdkMode: 'sdk-prealpha',
      sdkAvailable: true,
      sdkConfigured: true,
      sdkLastCheck: timestamp,
      grpcEndpointHost: 'pre-alpha-dev-1.encrypt.ika-network.net',
      programId,
      capabilities: {
        supportsCiphertextAccounts: true,
        supportsGraphExecution: false,
        supportsThresholdDecrypt: false,
        preAlphaMode: true,
        productionPrivacyReady: false,
        realEncryption: false,
        adapterMode: 'sdk-prealpha',
      },
      latestState: strategyState,
      safety: {
        sensitiveProductionDataAllowed: false,
        signingEnabled: false,
        sendTransactionEnabled: false,
        liveExecutionEnabled: false,
      },
    },
    strategyState,
    auditEvents: [
      {
        eventId: 'demo-encrypt-audit-001',
        strategyStateId: strategyState.stateId,
        eventType: 'encrypt.demo_seeded',
        actorId: 'demo-seed',
        evidence: {
          demoOnly: true,
          nonSensitive: true,
          productionPrivacyReady: false,
          realEncryption: false,
          ciphertextIdentifiers,
          strategyCommitment,
        },
        occurredAt: timestamp,
        createdAt: timestamp,
      },
    ],
    sdkEvidence: [sdkEvidence],
  };
}
