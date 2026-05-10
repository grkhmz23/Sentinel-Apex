import type {
  CreatePusdOperatorIntentInput,
  PusdOperatorIntentType,
  RuntimeControlPlane,
} from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

function validateIntentBody(body: unknown): CreatePusdOperatorIntentInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be an object.');
  }
  const record = body as Record<string, unknown>;
  if (typeof record['amount'] !== 'string' || record['amount'].trim() === '') {
    throw new Error('amount is required as a string.');
  }
  const amount = Number(record['amount']);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be a positive number.');
  }

  for (const forbidden of ['privateKey', 'secretKey', 'seedPhrase', 'mnemonic', 'walletJson']) {
    if (record[forbidden] !== undefined) {
      throw new Error(`${forbidden} is not accepted by PUSD intent endpoints.`);
    }
  }

  return {
    amount: record['amount'],
    ...(typeof record['reason'] === 'string' ? { reason: record['reason'] } : {}),
    ...(typeof record['requestedAction'] === 'string'
      ? { requestedAction: record['requestedAction'] }
      : {}),
  };
}

async function createIntent(
  request: FastifyRequest,
  reply: FastifyReply,
  controlPlane: RuntimeControlPlane,
  operatorId: string,
  intentType: PusdOperatorIntentType,
): Promise<FastifyReply> {
  try {
    const body = validateIntentBody(request.body);
    const intent = await controlPlane.createPusdOperatorIntent(operatorId, intentType, body);
    return reply.status(201).send({
      data: intent,
      meta: { correlationId: request.id },
    });
  } catch (error) {
    return reply.status(400).send({
      error: {
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'Invalid PUSD intent request.',
        correlationId: request.id,
      },
    });
  }
}

export async function pusdRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get('/api/v1/pusd/vault', { preHandler: authenticate }, async (request, reply) => {
    const vault = await controlPlane.getPusdVault();
    return reply.status(200).send({
      data: vault,
      meta: { correlationId: request.id },
    });
  });

  app.get('/api/v1/pusd/treasury-state', { preHandler: authenticate }, async (request, reply) => {
    const state = await controlPlane.getPusdTreasuryState();
    return reply.status(200).send({
      data: state,
      meta: { correlationId: request.id },
    });
  });

  app.get<{
    Querystring: { limit?: string };
  }>('/api/v1/pusd/snapshots', { preHandler: authenticate }, async (request, reply) => {
    const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
    const snapshots = await controlPlane.listPusdVaultSnapshots(limit);
    return reply.status(200).send({
      data: snapshots,
      meta: { correlationId: request.id, count: snapshots.length, limit },
    });
  });

  app.get<{
    Querystring: { limit?: string };
  }>('/api/v1/pusd/intents', { preHandler: authenticate }, async (request, reply) => {
    const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
    const intents = await controlPlane.listPusdOperatorIntents(limit);
    return reply.status(200).send({
      data: intents,
      meta: { correlationId: request.id, count: intents.length, limit },
    });
  });

  app.post('/api/v1/pusd/deposit-intent', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    const operator = getRequiredOperator(request);
    return createIntent(request, reply, controlPlane, operator.operatorId, 'deposit');
  });

  app.post('/api/v1/pusd/withdraw-intent', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    const operator = getRequiredOperator(request);
    return createIntent(request, reply, controlPlane, operator.operatorId, 'withdraw');
  });

  app.post('/api/v1/pusd/rebalance-intent', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    const operator = getRequiredOperator(request);
    return createIntent(request, reply, controlPlane, operator.operatorId, 'rebalance');
  });
}
