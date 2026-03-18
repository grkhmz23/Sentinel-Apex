import type { SentinelRuntime } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function controlRoutes(
  app: FastifyInstance,
  runtime: SentinelRuntime,
): Promise<void> {
  app.post<{
    Body: { reason: string };
  }>(
    '/api/v1/control/kill-switch',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await runtime.activateKillSwitch(request.body.reason, 'api-control');

      return reply.status(200).send({
        data: {
          acknowledged: true,
          status: status.lifecycleState,
          reason: status.reason,
          activatedAt: status.updatedAt,
        },
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: { reason: string; confirmedBy: string };
  }>(
    '/api/v1/control/resume',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await runtime.resume(request.body.reason, request.body.confirmedBy);

      return reply.status(200).send({
        data: {
          acknowledged: true,
          status: status.lifecycleState,
          reason: status.reason,
          confirmedBy: request.body.confirmedBy,
          resumedAt: status.updatedAt,
        },
        meta: { correlationId: request.id },
      });
    },
  );

  app.get(
    '/api/v1/control/mode',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await runtime.getRuntimeStatus();
      return reply.status(200).send({
        data: {
          mode: status.executionMode,
          featureFlagLiveExecution: status.liveExecutionEnabled,
          halted: status.halted,
          lifecycleState: status.lifecycleState,
          projectionStatus: status.projectionStatus,
        },
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Body: { mode: 'dry-run' };
  }>(
    '/api/v1/control/mode',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await runtime.setExecutionMode(request.body.mode);
      return reply.status(200).send({
        data: {
          acknowledged: true,
          mode: status.executionMode,
          changedAt: status.updatedAt,
        },
        meta: { correlationId: request.id },
      });
    },
  );
}
