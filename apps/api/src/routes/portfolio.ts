import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function portfolioRoutes(
  app: FastifyInstance,
  runtime: SentinelRuntime,
): Promise<void> {
  app.get(
    '/api/v1/portfolio',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const portfolio = await runtime.getPortfolioSummary();

      return reply.status(200).send({
        data:
          portfolio ?? {
            totalNav: '0',
            grossExposure: '0',
            netExposure: '0',
            liquidityReserve: '0',
            openPositionCount: 0,
            dailyPnl: '0',
            cumulativePnl: '0',
            sleeves: [],
            venueExposures: {},
            assetExposures: {},
            updatedAt: new Date(0).toISOString(),
          },
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: {
      limit?: string;
    };
  }>(
    '/api/v1/portfolio/snapshots',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 500);
      const snapshots = await runtime.listPortfolioSnapshots(limit);

      return reply.status(200).send({
        data: snapshots,
        meta: {
          correlationId: request.id,
          count: snapshots.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/portfolio/pnl',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const pnlSummary = await runtime.getPnlSummary();
      return reply.status(200).send({
        data: pnlSummary,
        meta: { correlationId: request.id },
      });
    },
  );
}
