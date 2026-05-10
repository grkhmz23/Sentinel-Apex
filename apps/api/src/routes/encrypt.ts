import { ENCRYPT_PRE_ALPHA_ACK_VALUE, ENCRYPT_SDK_DEMO_ACK_VALUE } from '@sentinel-apex/config';
import type {
  CreateEncryptedStrategyStateRequest,
  CreateEncryptRevealRequestInput,
  CreateEncryptSdkDemoRequest,
  RuntimeControlPlane,
} from '@sentinel-apex/runtime';

import { authenticate } from '../middleware/auth.js';
import { getRequiredOperator, requireOperatorRole } from '../middleware/operator-auth.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const forbiddenFields = [
  'privateKey',
  'secretKey',
  'seedPhrase',
  'mnemonic',
  'walletJson',
  'keypair',
  'signer',
  'rawStrategy',
  'productionStrategy',
  'inputs',
] as const;

function assertObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be an object.');
  }
  const record = body as Record<string, unknown>;
  for (const field of forbiddenFields) {
    if (record[field] !== undefined) {
      throw new Error(`${field} is not accepted by Encrypt pre-alpha endpoints.`);
    }
  }
  if (process.env['ENCRYPT_PRE_ALPHA_ACK'] !== ENCRYPT_PRE_ALPHA_ACK_VALUE) {
    throw new Error('ENCRYPT_PRE_ALPHA_ACK is required before mutating Encrypt pre-alpha strategy state.');
  }
  return record;
}

function validateStrategyStateBody(body: unknown): CreateEncryptedStrategyStateRequest {
  const record = assertObjectBody(body);
  return {
    ...(typeof record['strategyId'] === 'string' && record['strategyId'].trim() !== ''
      ? { strategyId: record['strategyId'] }
      : {}),
    ...(typeof record['publicRiskStatus'] === 'string' && record['publicRiskStatus'].trim() !== ''
      ? { publicRiskStatus: record['publicRiskStatus'] }
      : {}),
    ...(typeof record['demoValues'] === 'object' && record['demoValues'] !== null && !Array.isArray(record['demoValues'])
      ? { demoValues: record['demoValues'] as Record<string, unknown> }
      : {}),
  };
}

function validateRevealBody(body: unknown): CreateEncryptRevealRequestInput {
  const record = assertObjectBody(body);
  if (typeof record['strategyStateId'] !== 'string' || record['strategyStateId'].trim() === '') {
    throw new Error('strategyStateId is required.');
  }
  if (typeof record['reason'] !== 'string' || record['reason'].trim() === '') {
    throw new Error('reason is required.');
  }
  return {
    strategyStateId: record['strategyStateId'],
    reason: record['reason'],
  };
}

function validateSdkDemoBody(body: unknown): CreateEncryptSdkDemoRequest {
  const record = assertObjectBody(body);
  if (record['demoValues'] !== undefined || record['privateFields'] !== undefined) {
    throw new Error('SDK demo endpoint does not accept caller-supplied plaintext strategy values.');
  }
  if (process.env['ENCRYPT_SDK_DEMO_ACK'] !== ENCRYPT_SDK_DEMO_ACK_VALUE) {
    throw new Error('ENCRYPT_SDK_DEMO_ACK is required before creating Encrypt SDK pre-alpha demo inputs.');
  }
  return {
    ...(typeof record['strategyId'] === 'string' && record['strategyId'].trim() !== ''
      ? { strategyId: record['strategyId'] }
      : {}),
  };
}

async function handleBadRequest(reply: FastifyReply, request: FastifyRequest, error: unknown): Promise<FastifyReply> {
  return reply.status(400).send({
    error: {
      code: 'BAD_REQUEST',
      message: error instanceof Error ? error.message : 'Invalid Encrypt pre-alpha request.',
      correlationId: request.id,
    },
  });
}

export async function encryptRoutes(
  app: FastifyInstance,
  controlPlane: RuntimeControlPlane,
): Promise<void> {
  app.get('/api/v1/encrypt/status', { preHandler: authenticate }, async (request, reply) => {
    const status = await controlPlane.getEncryptStatus();
    return reply.status(200).send({ data: status, meta: { correlationId: request.id } });
  });

  app.get('/api/v1/encrypt/strategy-state', { preHandler: authenticate }, async (request, reply) => {
    const state = await controlPlane.getEncryptedStrategyState();
    return reply.status(200).send({ data: state, meta: { correlationId: request.id } });
  });

  app.get<{ Querystring: { limit?: string } }>(
    '/api/v1/encrypt/audit',
    { preHandler: authenticate },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '50', 10), 200);
      const events = await controlPlane.listEncryptedStrategyAuditEvents(limit);
      return reply.status(200).send({
        data: events,
        meta: { correlationId: request.id, count: events.length, limit },
      });
    },
  );

  app.get<{ Querystring: { limit?: string } }>(
    '/api/v1/encrypt/sdk-demo/evidence',
    { preHandler: authenticate },
    async (request, reply) => {
      const limit = Math.min(Number.parseInt(request.query.limit ?? '25', 10), 100);
      const events = await controlPlane.listEncryptSdkDemoEvidence(limit);
      return reply.status(200).send({
        data: events,
        meta: { correlationId: request.id, count: events.length, limit },
      });
    },
  );

  app.post('/api/v1/encrypt/strategy-state', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    try {
      const operator = getRequiredOperator(request);
      const body = validateStrategyStateBody(request.body);
      const state = await controlPlane.createEncryptedStrategyState(operator.operatorId, body);
      return reply.status(201).send({ data: state, meta: { correlationId: request.id } });
    } catch (error) {
      return handleBadRequest(reply, request, error);
    }
  });

  app.post('/api/v1/encrypt/strategy-state/update', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    try {
      const operator = getRequiredOperator(request);
      const body = validateStrategyStateBody(request.body);
      const state = await controlPlane.updateEncryptedStrategyState(operator.operatorId, body);
      return reply.status(200).send({ data: state, meta: { correlationId: request.id } });
    } catch (error) {
      return handleBadRequest(reply, request, error);
    }
  });

  app.post('/api/v1/encrypt/reveal-request', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    try {
      const operator = getRequiredOperator(request);
      const body = validateRevealBody(request.body);
      const reveal = await controlPlane.createEncryptRevealRequest(operator.operatorId, body);
      return reply.status(201).send({ data: reveal, meta: { correlationId: request.id } });
    } catch (error) {
      return handleBadRequest(reply, request, error);
    }
  });

  app.post('/api/v1/encrypt/sdk-demo/create-input', {
    preHandler: [authenticate, requireOperatorRole('operator')],
  }, async (request, reply) => {
    try {
      const operator = getRequiredOperator(request);
      const body = validateSdkDemoBody(request.body);
      const evidence = await controlPlane.createEncryptSdkDemoInput(operator.operatorId, body);
      return reply.status(201).send({ data: evidence, meta: { correlationId: request.id } });
    } catch (error) {
      return handleBadRequest(reply, request, error);
    }
  });
}
