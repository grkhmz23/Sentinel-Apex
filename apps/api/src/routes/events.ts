import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function eventRoutes(
  app: FastifyInstance,
  runtime: SentinelRuntime,
): Promise<void> {
  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/events',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const events = await runtime.listRecentEvents(limit);

      return reply.status(200).send({
        data: events,
        meta: {
          correlationId: request.id,
          count: events.length,
          limit,
        },
      });
    },
  );
}
