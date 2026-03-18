import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function runtimeRoutes(
  app: FastifyInstance,
  runtime: SentinelRuntime,
): Promise<void> {
  app.get(
    '/api/v1/runtime/status',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await runtime.getRuntimeStatus();
      return reply.status(200).send({
        data: status,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post(
    '/api/v1/runtime/cycles/run',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      if (process.env['NODE_ENV'] === 'production') {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Manual runtime cycle triggering is disabled in production.',
            correlationId: request.id,
          },
        });
      }

      const result = await runtime.runCycle('api-runtime-trigger');
      return reply.status(200).send({
        data: result,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post(
    '/api/v1/runtime/projections/rebuild',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await runtime.rebuildProjections('api-runtime-rebuild');
      return reply.status(200).send({
        data: status,
        meta: { correlationId: request.id },
      });
    },
  );
}
