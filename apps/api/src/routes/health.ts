import type { RuntimeControlPlane } from '@sentinel-apex/runtime';
import { buildDeploymentProfile } from '@sentinel-apex/shared';

import { buildApiReadinessPayload } from '../deployment.js';

import type { FastifyInstance } from 'fastify';

// Read the package version at startup so we don't hit the filesystem on every request.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const APP_VERSION: string = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
})();

/**
 * GET /health — unauthenticated liveness / readiness probe.
 *
 * Returns:
 *   200 liveness payload for Render / quick smoke checks
 *   200 or 503 readiness payload at /readyz for operator smoke checks
 */
export async function healthRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded'] },
              service: { type: 'string' },
              version: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              mode: { type: 'string' },
              environmentLabel: { type: 'string' },
              executionBadge: { type: 'string' },
            },
            required: [
              'status',
              'service',
              'version',
              'timestamp',
              'mode',
              'environmentLabel',
              'executionBadge',
            ],
          },
        },
      },
    },
    async (_request, reply) => {
      const profile = buildDeploymentProfile(process.env);
      return reply.status(200).send({
        status: 'ok',
        service: 'api',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        mode: profile.executionMode,
        environmentLabel: profile.environmentLabel,
        executionBadge: profile.executionBadge,
      });
    },
  );

  app.get('/readyz', async (_request, reply) => {
    try {
      const overview = await controlPlane.getRuntimeOverview();
      const readiness = buildApiReadinessPayload(overview, APP_VERSION);
      const statusCode = readiness.status === 'ok' ? 200 : 503;
      return reply.status(statusCode).send(readiness.payload);
    } catch (error) {
      const profile = buildDeploymentProfile(process.env);
      return reply.status(503).send({
        status: 'degraded',
        service: 'api',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        environmentLabel: profile.environmentLabel,
        executionBadge: profile.executionBadge,
        executionMode: profile.executionMode,
        liveExecutionEnabled: profile.liveExecutionEnabled,
        driftExecutionEnv: profile.driftExecutionEnv,
        driftReadonlyEnv: profile.driftReadonlyEnv,
        readinessTruth: profile.readinessTruth,
        supportedExecutionScope: profile.supportedExecutionScope,
        blockedExecutionScope: profile.blockedExecutionScope,
        degradedReasons: [
          error instanceof Error ? error.message : String(error),
        ],
      });
    }
  });
}
