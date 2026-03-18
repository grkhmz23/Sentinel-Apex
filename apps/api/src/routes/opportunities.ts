import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function opportunityRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/opportunities',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const opportunities = await controlPlane.listOpportunities(limit);

      return reply.status(200).send({
        data: opportunities,
        meta: {
          correlationId: request.id,
          count: opportunities.length,
          limit,
        },
      });
    },
  );
}
