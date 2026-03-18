import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';

import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { errorHandler } from './middleware/error-handler.js';
import { registerRoutes } from './routes/index.js';
import { createRuntimeFromEnv } from './runtime.js';

import type { FastifyInstance } from 'fastify';

/**
 * Fastify application factory.
 *
 * Separated from main.ts so the app can be imported in tests and instantiated
 * without binding to a port (using Fastify's inject() for in-process requests).
 */
export async function createApp(
  options: { runtime?: SentinelRuntime } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    // Disable Fastify's built-in logger; we use @sentinel-apex/observability (pino) directly.
    logger: false,
    // Fastify generates a request ID for each request; use it as correlation ID.
    genReqId: () => `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  });

  // ── Security headers ───────────────────────────────────────────────────────

  await app.register(helmet, {
    // Content-Security-Policy is relaxed since this is a JSON API, not an HTML app.
    contentSecurityPolicy: false,
  });

  // ── CORS ───────────────────────────────────────────────────────────────────

  await app.register(cors, {
    // Allow any origin by default (tighten per deployment environment via config).
    origin: process.env['CORS_ORIGIN'] ?? true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // ── Global error handler ───────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  const runtime = options.runtime ?? await createRuntimeFromEnv();

  app.addHook('onClose', async () => {
    await runtime.close();
  });

  // ── Routes ────────────────────────────────────────────────────────────────

  await registerRoutes(app, runtime);

  return app;
}
