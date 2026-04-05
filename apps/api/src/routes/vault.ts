import type {
  RecordVaultDepositInput,
  RequestVaultRedemptionInput,
  RuntimeControlPlane,
} from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance } from 'fastify';

export async function vaultRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get(
    '/api/v1/vault',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const vault = await controlPlane.getVaultSummary();
      return reply.status(200).send({
        data: vault,
        meta: { correlationId: request.id },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/vault/depositors',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const depositors = await controlPlane.listVaultDepositors(limit);
      return reply.status(200).send({
        data: depositors,
        meta: {
          correlationId: request.id,
          count: depositors.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/vault/deposits',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const deposits = await controlPlane.listVaultDepositLots(limit);
      return reply.status(200).send({
        data: deposits,
        meta: {
          correlationId: request.id,
          count: deposits.length,
          limit,
        },
      });
    },
  );

  app.get<{
    Querystring: { limit?: string };
  }>(
    '/api/v1/vault/redemptions',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const redemptions = await controlPlane.listVaultRedemptionRequests(limit);
      return reply.status(200).send({
        data: redemptions,
        meta: {
          correlationId: request.id,
          count: redemptions.length,
          limit,
        },
      });
    },
  );

  app.post<{
    Body: RecordVaultDepositInput;
  }>(
    '/api/v1/vault/deposits',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const deposit = await controlPlane.recordVaultDeposit(operator.operatorId, request.body);
        return reply.status(201).send({
          data: deposit,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Vault deposit failed.';
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

  app.post<{
    Body: RequestVaultRedemptionInput;
  }>(
    '/api/v1/vault/redemptions',
    {
      preHandler: [authenticate, requireOperatorRole('operator')],
    },
    async (request, reply) => {
      const operator = getRequiredOperator(request);
      try {
        const redemption = await controlPlane.requestVaultRedemption(
          operator.operatorId,
          request.body,
        );
        return reply.status(201).send({
          data: redemption,
          meta: { correlationId: request.id },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Vault redemption request failed.';
        const statusCode = message.includes('was not found')
          ? 404
          : message.includes('exceeds available')
            ? 409
            : 400;
        return reply.status(statusCode).send({
          error: {
            code:
              statusCode === 404 ? 'NOT_FOUND' : statusCode === 409 ? 'CONFLICT' : 'BAD_REQUEST',
            message,
            correlationId: request.id,
          },
        });
      }
    },
  );
}
