// =============================================================================
// Sentinel Apex — Backtest API Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import type { RuntimeControlPlane } from '@sentinel-apex/runtime';
import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

export async function backtestRoutes(
  app: FastifyInstance,
  options: { controlPlane: RuntimeControlPlane },
) {
  const { controlPlane } = options;

  // Run a backtest
  app.post<{
    Body: {
      backtestId: string;
      name?: string;
      description?: string;
      period: { startDate: string; endDate: string };
      assets: string[];
      initialCapitalUsd: string;
      saveAsEvidence?: boolean;
    };
  }>(
    '/api/v1/backtest/run',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const { backtestId, name, description, period, assets, initialCapitalUsd, saveAsEvidence } = request.body;

      try {
        const result = await controlPlane.runBacktest(operator.operatorId, {
          backtestId,
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          period: {
            startDate: new Date(period.startDate),
            endDate: new Date(period.endDate),
          },
          assets,
          initialCapitalUsd,
          ...(saveAsEvidence !== undefined ? { saveAsEvidence } : {}),
        });

        return reply.status(200).send({
          data: result,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backtest failed.';
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );
}
