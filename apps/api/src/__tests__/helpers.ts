import { randomUUID } from 'node:crypto';

import {
  RuntimeControlPlane,
  RuntimeWorker,
  type DeterministicRuntimeScenario,
  type RuntimeCommandView,
  type RuntimeMismatchRemediationView,
  type RuntimeMismatchStatus,
  type RuntimeReconciliationRunView,
} from '@sentinel-apex/runtime';
import { createSignedOperatorHeaders, type OpsOperatorRole } from '@sentinel-apex/shared';

export async function createApiHarness(
  runtimeOverrides: DeterministicRuntimeScenario = {},
): Promise<{
  connectionString: string;
  controlPlane: RuntimeControlPlane;
  worker: RuntimeWorker;
}> {
  const connectionString = `file:///tmp/sentinel-apex-api-test-${randomUUID()}`;
  const controlPlane = await RuntimeControlPlane.connect(connectionString);
  const worker = await RuntimeWorker.createDeterministic(connectionString, runtimeOverrides, {
    cycleIntervalMs: 25,
    pollIntervalMs: 10,
  });
  await worker.start();

  return {
    connectionString,
    controlPlane,
    worker,
  };
}

export async function waitForCommand(
  controlPlane: RuntimeControlPlane,
  commandId: string,
  timeoutMs = 5000,
): Promise<RuntimeCommandView> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const command = await controlPlane.getCommand(commandId);
    if (command !== null && (command.status === 'completed' || command.status === 'failed')) {
      return command;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for runtime command ${commandId}`);
}

export async function waitForMismatch(
  controlPlane: RuntimeControlPlane,
  category: string,
  timeoutMs = 5000,
): Promise<Array<{ id: string; category: string; status: RuntimeMismatchStatus }>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mismatches = await controlPlane.listMismatches(20);
    if (mismatches.some((mismatch) => mismatch.category === category)) {
      return mismatches.map((mismatch) => ({
        id: mismatch.id,
        category: mismatch.category,
        status: mismatch.status,
      }));
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for mismatch category ${category}`);
}

export async function waitForMismatchStatus(
  controlPlane: RuntimeControlPlane,
  mismatchId: string,
  status: RuntimeMismatchStatus,
  timeoutMs = 5000,
): Promise<NonNullable<Awaited<ReturnType<RuntimeControlPlane['getMismatchDetail']>>>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const detail = await controlPlane.getMismatchDetail(mismatchId);
    if (detail !== null && detail.mismatch.status === status) {
      return detail;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for mismatch ${mismatchId} to reach status ${status}`);
}

export async function waitForRemediationStatus(
  controlPlane: RuntimeControlPlane,
  mismatchId: string,
  status: RuntimeMismatchRemediationView['status'],
  timeoutMs = 5000,
): Promise<RuntimeMismatchRemediationView> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remediation = await controlPlane.getLatestMismatchRemediation(mismatchId);
    if (remediation !== null && remediation.status === status) {
      return remediation;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for mismatch ${mismatchId} remediation to reach status ${status}`);
}

export async function waitForReconciliationRun(
  controlPlane: RuntimeControlPlane,
  reconciliationRunId: string,
  timeoutMs = 5000,
): Promise<RuntimeReconciliationRunView> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const run = await controlPlane.getReconciliationRun(reconciliationRunId);
    if (run !== null && (run.status === 'completed' || run.status === 'failed')) {
      return run;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for reconciliation run ${reconciliationRunId}`);
}

export function createOperatorHeaders(input: {
  role: OpsOperatorRole;
  operatorId?: string;
  sessionId?: string;
  method: string;
  path: string;
  apiKey: string;
  sharedSecret: string;
}): Record<string, string> {
  const signed = createSignedOperatorHeaders({
    operatorId: input.operatorId ?? `${input.role}-user`,
    role: input.role,
    sessionId: input.sessionId ?? `session-${input.role}`,
  }, input.sharedSecret, input.method, input.path);

  return {
    'x-api-key': input.apiKey,
    'x-sentinel-operator-id': signed.operatorId,
    'x-sentinel-operator-role': signed.role,
    'x-sentinel-operator-session-id': signed.sessionId,
    'x-sentinel-operator-issued-at': signed.issuedAt,
    'x-sentinel-operator-signature': signed.signature,
  };
}
