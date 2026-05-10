import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  createConfig,
  ENCRYPT_PRE_ALPHA_ACK_VALUE,
  ENCRYPT_SDK_DEMO_ACK_VALUE,
} from '../packages/config/src/env.js';
import {
  buildEncryptSdkDemoInput,
  buildEncryptSdkDemoStrategyCommitment,
  EncryptedStrategyService,
} from '../packages/runtime/src/encrypt/index.js';

import type { EncryptRuntimeConfig, EncryptSdkDemoEvidence } from '../packages/runtime/src/encrypt/index.js';

interface CliResult {
  success: boolean;
  sdkMode: 'sdk-prealpha';
  endpointHost: string | null;
  programId: string | null;
  ciphertextIdentifiers: string[];
  strategyCommitment: string;
  productionPrivacyReady: false;
  realEncryption: false;
  createdAt: string;
  error: string | null;
}

function loadDotEnv(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) {
    return;
  }

  const contents = readFileSync(path, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function findRepoRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (current !== dirname(current)) {
    const packagePath = join(current, 'package.json');
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { name?: string };
      if (packageJson.name === 'sentinel-apex') {
        return current;
      }
    }
    current = dirname(current);
  }
  return resolve(start);
}

function endpointHost(endpoint: string | null): string | null {
  if (endpoint === null) {
    return null;
  }
  return endpoint.split(':')[0] ?? endpoint;
}

function assertDemoAcknowledged(): void {
  if (process.env['ENCRYPT_ENABLED'] !== 'true' && process.env['ENCRYPT_ENABLED'] !== '1') {
    throw new Error('ENCRYPT_ENABLED=true is required for the Encrypt SDK pre-alpha demo.');
  }
  if (process.env['ENCRYPT_SDK_MODE'] !== 'sdk-prealpha') {
    throw new Error('ENCRYPT_SDK_MODE=sdk-prealpha is required for the Encrypt SDK pre-alpha demo.');
  }
  if (process.env['ENCRYPT_PRE_ALPHA_ACK'] !== ENCRYPT_PRE_ALPHA_ACK_VALUE) {
    throw new Error(`ENCRYPT_PRE_ALPHA_ACK must be exactly "${ENCRYPT_PRE_ALPHA_ACK_VALUE}".`);
  }
  if (process.env['ENCRYPT_SDK_DEMO_ACK'] !== ENCRYPT_SDK_DEMO_ACK_VALUE) {
    throw new Error(`ENCRYPT_SDK_DEMO_ACK must be exactly "${ENCRYPT_SDK_DEMO_ACK_VALUE}".`);
  }
}

function toRuntimeConfig(config: ReturnType<typeof createConfig>): EncryptRuntimeConfig {
  return {
    enabled: config.ENCRYPT_ENABLED,
    cluster: config.ENCRYPT_CLUSTER,
    programId: config.ENCRYPT_PROGRAM_ID ?? null,
    configPda: config.ENCRYPT_CONFIG_PDA ?? null,
    networkEncryptionKey: config.ENCRYPT_NETWORK_ENCRYPTION_KEY ?? null,
    preAlphaAck: config.ENCRYPT_PRE_ALPHA_ACK === ENCRYPT_PRE_ALPHA_ACK_VALUE,
    sdkMode: config.ENCRYPT_SDK_MODE,
    grpcEndpoint: config.ENCRYPT_GRPC_ENDPOINT ?? null,
    solanaRpcUrl: config.ENCRYPT_SOLANA_RPC_URL ?? null,
    networkEncryptionPublicKey: config.ENCRYPT_NETWORK_ENCRYPTION_PUBLIC_KEY ?? null,
    sdkDemoAck: config.ENCRYPT_SDK_DEMO_ACK === ENCRYPT_SDK_DEMO_ACK_VALUE,
    sdkStrict: config.ENCRYPT_SDK_STRICT,
  };
}

function toCliResult(evidence: EncryptSdkDemoEvidence): CliResult {
  return {
    success: evidence.success,
    sdkMode: evidence.sdkMode,
    endpointHost: evidence.endpointHost,
    programId: evidence.programId,
    ciphertextIdentifiers: evidence.ciphertextIdentifiers,
    strategyCommitment: evidence.strategyCommitment,
    productionPrivacyReady: false,
    realEncryption: false,
    createdAt: evidence.requestedAt,
    error: evidence.errorMessage,
  };
}

function writeEvidence(result: CliResult): string {
  const tmpDir = join(findRepoRoot(), '.tmp');
  mkdirSync(tmpDir, { recursive: true });
  const evidencePath = join(tmpDir, 'encrypt-sdk-demo-evidence.json');
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return evidencePath;
}

async function main(): Promise<void> {
  loadDotEnv(join(findRepoRoot(), '.env'));
  assertDemoAcknowledged();

  const config = createConfig(process.env);
  const runtimeConfig = toRuntimeConfig(config);
  const demoInput = buildEncryptSdkDemoInput();
  const fallbackCommitment = buildEncryptSdkDemoStrategyCommitment(demoInput);
  const service = new EncryptedStrategyService(runtimeConfig);

  let result: CliResult;
  try {
    const evidence = await service.createSdkDemoInput({ strategyId: demoInput.strategyId, actorId: 'codespaces-demo-cli' });
    result = toCliResult(evidence);
  } catch (error) {
    result = {
      success: false,
      sdkMode: 'sdk-prealpha',
      endpointHost: endpointHost(runtimeConfig.grpcEndpoint),
      programId: runtimeConfig.programId,
      ciphertextIdentifiers: [],
      strategyCommitment: fallbackCommitment,
      productionPrivacyReady: false,
      realEncryption: false,
      createdAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Encrypt SDK pre-alpha demo failed.',
    };
  }

  const evidencePath = writeEvidence(result);
  console.log(JSON.stringify({ ...result, evidencePath }, null, 2));

  if (!result.success) {
    console.error('Encrypt pre-alpha SDK demo did not return ciphertext identifiers. The devnet/mock endpoint may be unavailable or reset.');
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Encrypt SDK pre-alpha demo failed.');
  process.exitCode = 1;
});
