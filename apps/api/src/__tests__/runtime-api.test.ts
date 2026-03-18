import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RuntimeControlPlane, RuntimeWorker } from '@sentinel-apex/runtime';

import { createApp } from '../app.js';
import { createApiHarness, waitForCommand, waitForMismatch } from './helpers.js';

import type { FastifyInstance } from 'fastify';

const TEST_API_KEY = 'test-secret-key-for-vitest-suite-32chars!!';

describe('runtime-backed API routes', () => {
  let app: FastifyInstance;
  let controlPlane: RuntimeControlPlane;
  let worker: RuntimeWorker;

  beforeEach(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['API_SECRET_KEY'] = TEST_API_KEY;

    const harness = await createApiHarness();
    controlPlane = harness.controlPlane;
    worker = harness.worker;

    app = await createApp({ controlPlane });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await worker.stop();
  });

  it('queues a real runtime cycle through the worker and exposes persisted data through the API', async () => {
    const commandResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });

    expect(commandResponse.statusCode).toBe(202);
    const commandBody = commandResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, commandBody.data.commandId);
    expect(command.status).toBe('completed');
    expect(command.result['runId']).toBeTruthy();

    const [portfolioResponse, ordersResponse, eventsResponse, runtimeStatusResponse, workerResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/portfolio',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/runtime/status',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/runtime/worker',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(portfolioResponse.statusCode).toBe(200);
    expect(ordersResponse.statusCode).toBe(200);
    expect(eventsResponse.statusCode).toBe(200);
    expect(runtimeStatusResponse.statusCode).toBe(200);
    expect(workerResponse.statusCode).toBe(200);

    const portfolioBody = portfolioResponse.json<{ data: { totalNav: string; sleeves: unknown[] } }>();
    const ordersBody = ordersResponse.json<{ data: Array<{ clientOrderId: string; status: string }> }>();
    const eventsBody = eventsResponse.json<{ data: Array<{ eventType: string }> }>();
    const runtimeStatusBody = runtimeStatusResponse.json<{
      data: {
        runtime: { lastRunStatus: string };
        worker: { lifecycleState: string };
        openMismatchCount: number;
      };
    }>();
    const workerBody = workerResponse.json<{ data: { schedulerState: string } }>();

    expect(portfolioBody.data.totalNav).not.toBe('0');
    expect(portfolioBody.data.sleeves.length).toBeGreaterThan(0);
    expect(ordersBody.data.length).toBeGreaterThan(0);
    expect(eventsBody.data.some((event) => event.eventType === 'runtime.cycle_completed')).toBe(true);
    expect(runtimeStatusBody.data.runtime.lastRunStatus).toBe('completed');
    expect(runtimeStatusBody.data.worker.lifecycleState).toMatch(/ready|degraded/);
    expect(runtimeStatusBody.data.openMismatchCount).toBeGreaterThanOrEqual(0);
    expect(workerBody.data.schedulerState).toMatch(/waiting|running|paused/);
  });

  it('surfaces pause, resume, rebuild, mismatch history, and command status through the API', async () => {
    const pauseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'maintenance-window' },
    });

    expect(pauseResponse.statusCode).toBe(200);

    const blockedCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    const blockedCommandBody = blockedCycleResponse.json<{ data: { commandId: string } }>();
    const blockedCommand = await waitForCommand(controlPlane, blockedCommandBody.data.commandId);
    expect(blockedCommand.status).toBe('failed');

    const awaitedMismatches = await waitForMismatch(controlPlane, 'recovery_action_failure');

    const mismatchesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/mismatches?status=open',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchesResponse.statusCode).toBe(200);
    const mismatchesBody = mismatchesResponse.json<{ data: Array<{ id: string; category: string }> }>();
    expect(awaitedMismatches.some((mismatch) => mismatch.category === 'recovery_action_failure')).toBe(true);
    expect(mismatchesBody.data.some((mismatch) => mismatch.category === 'recovery_action_failure')).toBe(true);

    const mismatchId = mismatchesBody.data[0]?.id;
    expect(mismatchId).toBeTruthy();

    const acknowledgeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/acknowledge`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { acknowledgedBy: 'vitest', summary: 'reviewed by test' },
    });
    expect(acknowledgeResponse.statusCode).toBe(200);

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/resume',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'maintenance-complete', confirmedBy: 'vitest' },
    });
    expect(resumeResponse.statusCode).toBe(200);

    const rebuildResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/projections/rebuild',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(rebuildResponse.statusCode).toBe(202);
    const rebuildBody = rebuildResponse.json<{ data: { commandId: string } }>();
    const rebuildCommand = await waitForCommand(controlPlane, rebuildBody.data.commandId);
    expect(rebuildCommand.status).toBe('completed');

    const commandStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/commands/${rebuildBody.data.commandId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(commandStatusResponse.statusCode).toBe(200);

    const recoveryEventsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/recovery-events',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(recoveryEventsResponse.statusCode).toBe(200);
    const recoveryEventsBody = recoveryEventsResponse.json<{ data: Array<{ eventType: string; status: string }> }>();
    expect(recoveryEventsBody.data.some((event) => event.eventType === 'runtime_command_completed')).toBe(true);
  });
});
