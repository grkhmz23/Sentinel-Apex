import { timingSafeEqual, createHash } from 'node:crypto';

import { createAuthConfig } from '@sentinel-apex/config';
import { createLogger } from '@sentinel-apex/observability';

import type { FastifyRequest, FastifyReply } from 'fastify';

const logger = createLogger('api:auth');

/**
 * Performs a timing-safe comparison of two ASCII strings.
 *
 * timingSafeEqual requires equal-length Buffers.  We hash both sides to a
 * fixed 32-byte digest so the comparison always takes the same amount of time
 * regardless of the input length — this prevents timing oracles on the key
 * length itself.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Fastify pre-handler hook that enforces API key authentication.
 *
 * Reads the `X-API-Key` header and compares it against `config.API_SECRET_KEY`
 * using a timing-safe comparison.  Replies with 401 if missing or invalid.
 *
 * Usage:
 *   fastify.addHook('preHandler', authenticate);
 * Or on individual routes:
 *   fastify.get('/protected', { preHandler: authenticate }, handler);
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const runtimeAuthConfig = createAuthConfig(process.env);
  const secretKey = runtimeAuthConfig.API_SECRET_KEY;
  const isPermissiveTestMode =
    runtimeAuthConfig.NODE_ENV === 'test' &&
    (secretKey === undefined || secretKey === '');

  if (isPermissiveTestMode) {
    return;
  }

  const apiKey = request.headers['x-api-key'];

  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    logger.warn('Request rejected: missing X-API-Key header', {
      correlationId: request.id,
    });
    await reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API key. Provide a valid X-API-Key header.',
        correlationId: request.id,
      },
    });
    return;
  }

  if (secretKey === undefined) {
    throw new Error('API_SECRET_KEY is undefined outside permissive test mode');
  }

  const isValid = timingSafeStringEqual(apiKey, secretKey);

  if (!isValid) {
    logger.warn('Request rejected: invalid API key', {
      correlationId: request.id,
    });
    await reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key.',
        correlationId: request.id,
      },
    });
  }
}
