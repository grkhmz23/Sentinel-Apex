import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

import { createApp } from '../app.js';

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Authentication middleware tests
//
// We test auth by hitting a protected endpoint (GET /api/v1/portfolio) under
// various API key scenarios.  The health endpoint is intentionally skipped
// here because it is unauthenticated.
// ---------------------------------------------------------------------------

// The test secret must be >= 32 characters to satisfy the config schema.
const TEST_API_KEY = 'test-secret-key-for-vitest-suite-32chars!!';

let app: FastifyInstance;

// Capture original env so we can restore it after each test
let originalApiSecretKey: string | undefined;
let originalNodeEnv: string | undefined;
let originalDatabaseUrl: string | undefined;

beforeAll(async () => {
  originalNodeEnv = process.env['NODE_ENV'];
  originalApiSecretKey = process.env['API_SECRET_KEY'];
  originalDatabaseUrl = process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = 'file:///tmp/sentinel-apex-auth-test';
});

afterAll(async () => {
  process.env['NODE_ENV'] = originalNodeEnv;
  if (originalApiSecretKey !== undefined) {
    process.env['API_SECRET_KEY'] = originalApiSecretKey;
  } else {
    delete process.env['API_SECRET_KEY'];
  }
  if (originalDatabaseUrl !== undefined) {
    process.env['DATABASE_URL'] = originalDatabaseUrl;
  } else {
    delete process.env['DATABASE_URL'];
  }
  await app?.close();
});

// Re-create the app for each test so env changes take effect.
// createApp() is fast (no I/O) so this is acceptable in a test suite.
beforeEach(async () => {
  await app?.close();
  app = await createApp();
  await app.ready();
});

afterEach(async () => {
  await app?.close();
});

// ---------------------------------------------------------------------------
// When API_SECRET_KEY is set
// ---------------------------------------------------------------------------

describe('when API_SECRET_KEY is configured', () => {
  beforeEach(() => {
    process.env['API_SECRET_KEY'] = TEST_API_KEY;
  });

  it('returns 401 when X-API-Key header is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      // Deliberately no X-API-Key header
    });

    expect(response.statusCode).toBe(401);

    const body = response.json<{ error: { code: string; message: string; correlationId: string } }>();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.correlationId).toBe('string');
  });

  it('returns 401 when X-API-Key header is present but empty', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      headers: { 'x-api-key': '' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when X-API-Key header has a wrong value', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      headers: { 'x-api-key': 'totally-wrong-key' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json<{ error: { code: string } }>();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 even when the wrong key is almost right (timing-safe)', async () => {
    // Key that differs only in the last character
    const almostRight = `${TEST_API_KEY.slice(0, -1)  }X`;
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      headers: { 'x-api-key': almostRight },
    });

    expect(response.statusCode).toBe(401);
  });

  it('passes through to the route handler with the correct API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      headers: { 'x-api-key': TEST_API_KEY },
    });

    // The portfolio route returns 200; any non-401 confirms auth passed
    expect(response.statusCode).toBe(200);
  });

  it('error response includes correlationId', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      headers: { 'x-api-key': 'wrong' },
    });

    const body = response.json<{
      error: { code: string; message: string; correlationId: string };
    }>();

    expect(body.error.correlationId).toBeDefined();
    expect(typeof body.error.correlationId).toBe('string');
    expect(body.error.correlationId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// When API_SECRET_KEY is absent (test-mode permissive behaviour)
// ---------------------------------------------------------------------------

describe('when API_SECRET_KEY is absent (test-mode permissive)', () => {
  beforeEach(() => {
    delete process.env['API_SECRET_KEY'];
    process.env['NODE_ENV'] = 'test';
  });

  it('allows requests without X-API-Key in test mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      // No API key — should be allowed in test mode
    });

    // The route itself returns 200 (portfolio stub)
    expect(response.statusCode).toBe(200);
  });

  it('allows requests with any non-empty X-API-Key in test mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/portfolio',
      headers: { 'x-api-key': 'any-value-is-fine-in-test-mode' },
    });

    expect(response.statusCode).toBe(200);
  });
});
