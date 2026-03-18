import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function orderRoutes(
  app: FastifyInstance,
  runtime: SentinelRuntime,
): Promise<void> {
  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/orders',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const orders = await runtime.listOrders(limit);

      return reply.status(200).send({
        data: orders,
        meta: {
          correlationId: request.id,
          count: orders.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { clientOrderId: string };
  }>(
    '/api/v1/orders/:clientOrderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const order = await runtime.getOrder(request.params.clientOrderId);

      if (order === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Order with clientOrderId '${request.params.clientOrderId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: order,
        meta: { correlationId: request.id },
      });
    },
  );
}
