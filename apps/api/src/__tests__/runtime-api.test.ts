import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTestRuntime } from './helpers.js';

import type { FastifyInstance } from 'fastify';

const TEST_API_KEY = 'test-secret-key-for-vitest-suite-32chars!!';

describe('runtime-backed API routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['API_SECRET_KEY'] = TEST_API_KEY;
    const runtime = await createTestRuntime();
    app = await createApp({ runtime });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('runs a real paper cycle and exposes persisted data through the API', async () => {
    const runResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });

    expect(runResponse.statusCode).toBe(200);
    const runBody = runResponse.json<{ data: { intentsExecuted: number } }>();
    expect(runBody.data.intentsExecuted).toBeGreaterThan(0);

    const [portfolioResponse, ordersResponse, eventsResponse, runtimeStatusResponse] = await Promise.all([
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
    ]);

    expect(portfolioResponse.statusCode).toBe(200);
    expect(ordersResponse.statusCode).toBe(200);
    expect(eventsResponse.statusCode).toBe(200);
    expect(runtimeStatusResponse.statusCode).toBe(200);

    const portfolioBody = portfolioResponse.json<{ data: { totalNav: string; sleeves: unknown[] } }>();
    const ordersBody = ordersResponse.json<{ data: Array<{ clientOrderId: string; status: string }> }>();
    const eventsBody = eventsResponse.json<{ data: Array<{ eventType: string }> }>();
    const runtimeStatusBody = runtimeStatusResponse.json<{ data: { lastRunStatus: string } }>();

    expect(portfolioBody.data.totalNav).not.toBe('0');
    expect(portfolioBody.data.sleeves.length).toBeGreaterThan(0);
    expect(ordersBody.data.length).toBeGreaterThan(0);
    expect(eventsBody.data.some((event) => event.eventType === 'runtime.cycle_completed')).toBe(true);
    expect(runtimeStatusBody.data.lastRunStatus).toBe('completed');
  });

  it('supports operator pause, resume, and projection rebuild actions', async () => {
    const pauseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'maintenance-window' },
    });

    expect(pauseResponse.statusCode).toBe(200);
    const pausedBody = pauseResponse.json<{ data: { status: string } }>();
    expect(pausedBody.data.status).toBe('paused');

    const blockedCycle = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(blockedCycle.statusCode).toBe(500);

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/resume',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'maintenance-complete', confirmedBy: 'vitest' },
    });
    expect(resumeResponse.statusCode).toBe(200);

    const cycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(cycleResponse.statusCode).toBe(200);

    const rebuildResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/projections/rebuild',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(rebuildResponse.statusCode).toBe(200);

    const rebuildBody = rebuildResponse.json<{
      data: { lifecycleState: string; projectionStatus: string };
    }>();
    expect(rebuildBody.data.lifecycleState).toBe('ready');
    expect(rebuildBody.data.projectionStatus).toBe('fresh');
  });
});
