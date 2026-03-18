import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function positionRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/positions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const positions = await controlPlane.listPositions(limit);

      return reply.status(200).send({
        data: positions,
        meta: {
          correlationId: request.id,
          count: positions.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { id: string };
  }>(
    '/api/v1/positions/:id',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const position = await controlPlane.getPosition(request.params.id);

      if (position === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Position '${request.params.id}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: position,
        meta: { correlationId: request.id },
      });
    },
  );
}
