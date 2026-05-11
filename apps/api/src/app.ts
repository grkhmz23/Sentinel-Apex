import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';

import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { errorHandler } from './middleware/error-handler.js';
import { registerRoutes } from './routes/index.js';
import { createControlPlaneFromEnv } from './runtime.js';

import type { FastifyInstance } from 'fastify';

const LOCAL_DEV_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
] as const;

function parseCorsOrigins(): string[] {
  const raw = process.env['CORS_ORIGIN'];
  if (raw === undefined || raw.trim() === '') {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('CORS_ORIGIN is required in production.');
    }
    return [...LOCAL_DEV_CORS_ORIGINS];
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must include at least one origin when set.');
  }

  for (const origin of origins) {
    if (origin === '*') {
      throw new Error('CORS_ORIGIN must not use wildcard "*".');
    }
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin.replace(/\/$/, '')) {
        throw new Error('origin must not include a path, query, or fragment');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid CORS_ORIGIN value "${origin}": ${message}`);
    }
  }

  return origins.map((origin) => origin.replace(/\/$/, ''));
}

/**
 * Fastify application factory.
 *
 * Separated from main.ts so the app can be imported in tests and instantiated
 * without binding to a port (using Fastify's inject() for in-process requests).
 */
export async function createApp(
  options: { controlPlane?: RuntimeControlPlane } = {},
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
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // ── Global error handler ───────────────────────────────────────────────────

  app.setErrorHandler(errorHandler);

  const ownsControlPlane = options.controlPlane === undefined;
  const controlPlane = options.controlPlane ?? await createControlPlaneFromEnv();

  app.addHook('onClose', async () => {
    if (ownsControlPlane) {
      await controlPlane.close();
    }
  });

  // ── Routes ────────────────────────────────────────────────────────────────

  await registerRoutes(app, controlPlane);

  return app;
}
