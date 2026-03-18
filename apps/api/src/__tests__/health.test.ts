import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createApp } from '../app.js';

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Health endpoint tests
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeAll(async () => {
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = 'file:///tmp/sentinel-apex-health-test';
  app = await createApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
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
      version: string;
      timestamp: string;
      mode: string;
    }>();

    expect(body.status).toBe('ok');
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
