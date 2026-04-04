import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createApp } from '../app.js';
import { createApiHarness } from './helpers.js';

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Health endpoint tests
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let worker: Awaited<ReturnType<typeof createApiHarness>>['worker'];
let controlPlane: Awaited<ReturnType<typeof createApiHarness>>['controlPlane'];

beforeAll(async () => {
  process.env['NODE_ENV'] = 'test';
  process.env['API_SECRET_KEY'] = 'health-test-api-secret-key-32chars!';
  process.env['OPS_AUTH_SHARED_SECRET'] = 'health-test-ops-shared-secret-32chars!';

  const harness = await createApiHarness({}, {
    cycleIntervalMs: 50,
    pollIntervalMs: 10,
  });
  worker = harness.worker;
  controlPlane = harness.controlPlane;

  app = await createApp({ controlPlane });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await worker.stop();
  try {
    await controlPlane.close();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('PGlite is closed')) {
      throw error;
    }
  }
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      status: string;
      service: string;
      version: string;
      timestamp: string;
      mode: string;
      environmentLabel: string;
      executionBadge: string;
    }>();

    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
  });

  it('includes version field', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const body = response.json<{ version: string }>();
    expect(typeof body.version).toBe('string');
    expect(body.version.length).toBeGreaterThan(0);
  });

  it('includes a valid ISO 8601 timestamp', async () => {
    const before = Date.now();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const after = Date.now();
    const body = response.json<{ timestamp: string }>();

    const ts = new Date(body.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('includes a mode field', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const body = response.json<{ mode: string }>();
    expect(typeof body.mode).toBe('string');
    expect(body.mode.length).toBeGreaterThan(0);
  });

  it('includes honest environment labels', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const body = response.json<{
      environmentLabel: string;
      executionBadge: string;
    }>();

    expect(body.environmentLabel.length).toBeGreaterThan(0);
    expect(body.executionBadge.length).toBeGreaterThan(0);
  });

  it('does not require authentication', async () => {
    // No X-API-Key header — should still succeed
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {},
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('GET /readyz', () => {
  it('returns 200 with worker/runtime readiness details when the worker is running', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/readyz',
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      status: string;
      runtime: { lifecycleState: string; halted: boolean };
      worker: { lifecycleState: string; heartbeatStale: boolean };
      supportedExecutionScope: string[];
      blockedExecutionScope: string[];
    }>();

    expect(body.status).toBe('ok');
    expect(body.runtime.lifecycleState).toBe('ready');
    expect(body.runtime.halted).toBe(false);
    expect(body.worker.lifecycleState).toBe('ready');
    expect(body.worker.heartbeatStale).toBe(false);
    expect(body.supportedExecutionScope.length).toBeGreaterThan(0);
    expect(body.blockedExecutionScope.length).toBeGreaterThan(0);
  });
});
