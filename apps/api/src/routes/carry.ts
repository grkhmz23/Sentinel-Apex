import type { RuntimeControlPlane } from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function carryRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/carry/strategy-profile',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const strategyProfile = await controlPlane.getCarryStrategyProfile();
      return reply.status(200).send({
        data: strategyProfile,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/carry/recommendations',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const actions = await controlPlane.listCarryRecommendations(limit);
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
    Querystring: { limit?: string };
  }>(
    '/api/v1/carry/actions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const actions = await controlPlane.listCarryActions(limit);
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
    '/api/v1/carry/actions/:actionId/executions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const executions = await controlPlane.listCarryExecutionsForAction(request.params.actionId);
      return reply.status(200).send({
        data: executions,
        meta: {
          correlationId: request.id,
          count: executions.length,
        },
      });
    },
  );

  app.get<{
    Params: { actionId: string };
  }>(
    '/api/v1/carry/actions/:actionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const action = await controlPlane.getCarryAction(request.params.actionId);
      if (action === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Carry action '${request.params.actionId}' was not found.`,
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
    '/api/v1/carry/executions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const executions = await controlPlane.listCarryExecutions(limit);
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
    '/api/v1/carry/executions/:executionId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const execution = await controlPlane.getCarryExecution(request.params.executionId);
      if (execution === null) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Carry execution '${request.params.executionId}' was not found.`,
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

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/carry/venues',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const venues = await controlPlane.listCarryVenues(limit);
      return reply.status(200).send({
        data: venues,
        meta: {
          correlationId: request.id,
          count: venues.length,
          limit,
        },
      });
    },
  );

  app.post(
    '/api/v1/carry/evaluate',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      const command = await controlPlane.enqueueCarryEvaluation(operator.operatorId, {
        actorId: operator.operatorId,
        trigger: 'api_manual_carry_evaluation',
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
    '/api/v1/carry/actions/:actionId/approve',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const command = await controlPlane.approveCarryAction(
          request.params.actionId,
          operator.operatorId,
          operator.role,
        );
        if (command === null) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: `Carry action '${request.params.actionId}' was not found.`,
              correlationId: request.id,
            },
          });
        }

        return reply.status(202).send({
          data: command,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Carry approval failed.';
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
