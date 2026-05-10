#!/usr/bin/env node
'use strict';

const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const outputPath = resolve(process.cwd(), '.tmp/demo-evidence.json');
const timestamp = '2026-05-10T10:00:00.000Z';
const pusdMint = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const programId = '4ebfzWdKnrnGseuQpezXdG8yCdHqwQ1SSBHD3bWArND8';
const strategyCommitment = 'encrypt-sdk-demo-commitment:7c1f3a96b0e9d6a2f8c4d1b5e3a9076c4a2d8e1f6b9c0a3d5e7f1a4b8c2d9e30';
const ciphertextIdentifiers = [
  'encrypt-prealpha-demo:pusd-treasury-vault:allocation-weight-bps',
  'encrypt-prealpha-demo:pusd-treasury-vault:rebalance-threshold-bps',
  'encrypt-prealpha-demo:pusd-treasury-vault:max-intent-size-pusd',
  'encrypt-prealpha-demo:pusd-treasury-vault:risk-limit-bps',
];

const evidence = {
  generatedAt: timestamp,
  demoOnly: true,
  nonSensitive: true,
  productionPrivacyReady: false,
  realEncryption: false,
  liveExecution: false,
  signing: false,
  sendTransaction: false,
  ika: false,
  pusd: {
    vaultAsset: 'PUSD',
    baseAssetMint: pusdMint,
    balanceAmount: '125000',
    navAmount: '125000',
    accountingMode: 'read-only',
    runtimeMode: 'dry-run/operator-intent',
    operatorIntentId: 'demo-pusd-operator-intent-001',
    auditEventId: 'demo-pusd-audit-001',
  },
  encrypt: {
    phase: 'pre-alpha SDK demo',
    sdkMode: 'sdk-prealpha',
    endpointHost: 'pre-alpha-dev-1.encrypt.ika-network.net',
    programId,
    strategyId: 'pusd-treasury-vault-demo',
    strategyCommitment,
    ciphertextIdentifiers,
    productionPrivacyReady: false,
    realEncryption: false,
    auditEventId: 'demo-encrypt-audit-001',
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

console.log(`Seeded sanitized demo evidence: ${outputPath}`);
console.log('Open /pusd and /encrypt to show deterministic PUSD + Encrypt pre-alpha demo data.');
console.log('No sensitive values, signing, sendTransaction, live execution, production privacy, or Ika were enabled.');
