import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { RuntimeControlPlane } from '../control-plane.js';
import { RuntimeWorker } from '../worker.js';

async function createConnectionString(): Promise<string> {
  return `file:///tmp/sentinel-apex-worker-test-${randomUUID()}`;
}

async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('Timed out waiting for condition');
}

describe('RuntimeWorker', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup !== undefined) {
        await cleanup();
      }
    }
  });

  it('boots, schedules cycles, and shuts down with persisted worker metadata', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 25,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const runtimeStatus = await waitFor(
      () => controlPlane.getRuntimeStatus(),
      (status) => status.lastRunStatus === 'completed',
    );
    const workerStatus = await controlPlane.getWorkerStatus();

    expect(runtimeStatus.lastRunId).toBeTruthy();
    expect(workerStatus.lifecycleState).toMatch(/ready|degraded/);
    expect(workerStatus.lastHeartbeatAt).toBeTruthy();
    expect(workerStatus.lastSuccessAt).toBeTruthy();
  });

  it('processes commands serially, persists failures as mismatches, and records recovery history', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('worker-test-pause', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-blocked-cycle',
    });
    const failedCommand = await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );
    if (failedCommand === null) {
      throw new Error('Expected failed command to be present');
    }
    expect(failedCommand.errorMessage).toContain('Runtime is paused');

    const mismatches = await waitFor(
      () => controlPlane.listMismatches(20, 'open'),
      (items) => items.some((item) => item.category === 'recovery_action_failure'),
    );
    expect(mismatches.some((item) => item.category === 'recovery_action_failure')).toBe(true);

    await controlPlane.resume('worker-test-resume', 'vitest');

    const firstCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-first-command',
    });
    const secondCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-second-command',
    });

    const completedFirst = await waitFor(
      async () => controlPlane.getCommand(firstCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    const completedSecond = await waitFor(
      async () => controlPlane.getCommand(secondCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    if (completedFirst === null || completedSecond === null) {
      throw new Error('Expected completed commands to be present');
    }

    expect(completedFirst.result['runId']).toBeTruthy();
    expect(completedSecond.result['runId']).toBeTruthy();
    expect(completedSecond.startedAt !== null && completedFirst.completedAt !== null).toBe(true);

    const recoveryEvents = await controlPlane.listRecoveryEvents(20);
    expect(recoveryEvents.some((event) => event.eventType === 'runtime_command_failed')).toBe(true);
    expect(recoveryEvents.some((event) => event.eventType === 'runtime_command_completed')).toBe(true);
  });
});
