import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function riskRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/risk/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getRiskSummary();
      return reply.status(200).send({
        data:
          summary ?? {
            summary: {
              grossExposurePct: 0,
              netExposurePct: 0,
              leverage: 0,
              liquidityReservePct: 0,
              dailyDrawdownPct: 0,
              weeklyDrawdownPct: 0,
              portfolioDrawdownPct: 0,
              openCircuitBreakers: [],
              riskLevel: 'normal',
            },
            approvedIntentCount: 0,
            rejectedIntentCount: 0,
            capturedAt: new Date(0).toISOString(),
          },
        meta: { correlationId: request.id },
      });
    },
  );

  app.get(
    '/api/v1/risk/limits',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await controlPlane.getRuntimeStatus();
      const limits = status.riskLimits as Record<string, number>;
      return reply.status(200).send({
        data: {
          ...limits,
          maxVenueConcentrationPct: limits['maxSingleVenuePct'],
          maxAssetConcentrationPct: limits['maxSingleAssetPct'],
        },
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/risk/breaches',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const breaches = await controlPlane.listRiskBreaches(limit);

      return reply.status(200).send({
        data: breaches,
        meta: {
          correlationId: request.id,
          count: breaches.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/risk/circuit-breakers',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getRiskSummary();

      return reply.status(200).send({
        data: (summary?.summary.openCircuitBreakers ?? []).map((name: string) => ({
          name,
          state: 'open',
        })),
        meta: { correlationId: request.id },
      });
    },
  );
}
