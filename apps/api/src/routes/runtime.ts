import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';

import type { FastifyInstance } from 'fastify';

export async function runtimeRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/runtime/status',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const status = await controlPlane.getRuntimeOverview();
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
      const command = await controlPlane.enqueueCommand('run_cycle', 'api-runtime-trigger', {
        triggerSource: 'api-runtime-trigger',
      });
      return reply.status(202).send({
        data: command,
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
      const command = await controlPlane.enqueueCommand(
        'rebuild_projections',
        'api-runtime-rebuild',
      );
      return reply.status(202).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string; status?: 'open' | 'acknowledged' | 'resolved' };
  }>(
    '/api/v1/runtime/mismatches',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const mismatches = await controlPlane.listMismatches(limit, request.query.status);
      return reply.status(200).send({
        data: mismatches,
        meta: {
          correlationId: request.id,
          count: mismatches.length,
          limit,
        },
      });
    },
  );

  app.post<{
    Params: { mismatchId: string };
    Body: { acknowledgedBy: string; summary?: string };
  }>(
    '/api/v1/runtime/mismatches/:mismatchId/acknowledge',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const mismatch = await controlPlane.acknowledgeMismatch(
        request.params.mismatchId,
        request.body.acknowledgedBy,
        request.body.summary ?? null,
      );

      if (mismatch === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Mismatch '${request.params.mismatchId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: mismatch,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/runtime/recovery-events',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '100', 10), 500);
      const events = await controlPlane.listRecoveryEvents(limit);
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

  app.get(
    '/api/v1/runtime/worker',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const worker = await controlPlane.getWorkerStatus();
      return reply.status(200).send({
        data: worker,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Params: { commandId: string };
  }>(
    '/api/v1/runtime/commands/:commandId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const command = await controlPlane.getCommand(request.params.commandId);

      if (command === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Runtime command '${request.params.commandId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );
}
