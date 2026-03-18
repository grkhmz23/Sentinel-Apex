import { randomUUID } from 'node:crypto';

import {
  RuntimeControlPlane,
  RuntimeWorker,
  type DeterministicRuntimeScenario,
  type RuntimeCommandView,
} from '@sentinel-apex/runtime';

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
): Promise<Array<{ id: string; category: string }>> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mismatches = await controlPlane.listMismatches(20, 'open');
    if (mismatches.some((mismatch) => mismatch.category === category)) {
      return mismatches.map((mismatch) => ({
        id: mismatch.id,
        category: mismatch.category,
      }));
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for mismatch category ${category}`);
}
