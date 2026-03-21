import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function treasuryRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/treasury/recommendations',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const actions = await controlPlane.listTreasuryActions(limit);
      return reply.status(200).send({
        data: actions,
        meta: {
          correlationId: request.id,
          count: actions.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/treasury/summary',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const summary = await controlPlane.getTreasurySummary();
      return reply.status(200).send({
        data: summary,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/treasury/allocations',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const allocations = await controlPlane.listTreasuryAllocations(limit);
      return reply.status(200).send({
        data: allocations,
        meta: {
          correlationId: request.id,
          count: allocations.length,
          limit,
        },
      });
    },
  );

  app.get(
    '/api/v1/treasury/policy',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const policy = await controlPlane.getTreasuryPolicy();
      return reply.status(200).send({
        data: policy,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/treasury/actions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const actions = await controlPlane.listTreasuryActions(limit);
      return reply.status(200).send({
        data: actions,
        meta: {
          correlationId: request.id,
          count: actions.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { actionId: string };
  }>(
    '/api/v1/treasury/actions/:actionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const action = await controlPlane.getTreasuryAction(request.params.actionId);
      if (action === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Treasury action '${request.params.actionId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: action,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/treasury/executions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const executions = await controlPlane.listTreasuryExecutions(limit);
      return reply.status(200).send({
        data: executions,
        meta: {
          correlationId: request.id,
          count: executions.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Params: { executionId: string };
  }>(
    '/api/v1/treasury/executions/:executionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const execution = await controlPlane.getTreasuryExecution(request.params.executionId);
      if (execution === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Treasury execution '${request.params.executionId}' was not found.`,
            correlationId: request.id,
          },
        });
      }

      return reply.status(200).send({
        data: execution,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post(
    '/api/v1/treasury/evaluate',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const command = await controlPlane.enqueueTreasuryEvaluation(operator.operatorId, {
        actorId: operator.operatorId,
      });
      return reply.status(202).send({
        data: command,
        meta: { correlationId: request.id },
      });
    },
  );

  app.post<{
    Params: { actionId: string };
  }>(
    '/api/v1/treasury/actions/:actionId/approve',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const action = await controlPlane.approveTreasuryAction(
          request.params.actionId,
          operator.operatorId,
          operator.role,
        );
        if (action === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Treasury action '${request.params.actionId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(200).send({
          data: action,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Treasury approval failed.';
        const statusCode = message.includes('requires') ? 403 : 409;
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );

  app.post<{
    Params: { actionId: string };
  }>(
    '/api/v1/treasury/actions/:actionId/execute',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const command = await controlPlane.enqueueTreasuryActionExecution(
          request.params.actionId,
          operator.operatorId,
          operator.role,
        );
        if (command === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Treasury action '${request.params.actionId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(202).send({
          data: command,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Treasury execution failed.';
        const statusCode = message.includes('requires') ? 403 : 409;
        return reply.status(statusCode).send({
          error: {
            code: statusCode === 403 ? 'FORBIDDEN' : 'CONFLICT',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );
}
