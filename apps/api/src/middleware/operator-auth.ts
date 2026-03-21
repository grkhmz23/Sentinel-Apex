import {
  OpsAuthError,
  canAssumeRole,
  isOpsOperatorRole,
  verifySignedOperatorHeaders,
  type OpsOperatorRole,
} from '@sentinel-apex/shared';

import type {
  FastifyReply,
  FastifyRequest as FastifyRequestType,
  preHandlerAsyncHookHandler,
} from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    operator?: {
      operatorId: string;
      role: OpsOperatorRole;
      sessionId: string;
    };
  }
}

const HEADER_OPERATOR_ID = 'x-sentinel-operator-id';
const HEADER_OPERATOR_ROLE = 'x-sentinel-operator-role';
const HEADER_SESSION_ID = 'x-sentinel-operator-session-id';
const HEADER_ISSUED_AT = 'x-sentinel-operator-issued-at';
const HEADER_SIGNATURE = 'x-sentinel-operator-signature';

function getSharedSecret(): string {
  const secret = process.env['OPS_AUTH_SHARED_SECRET'];
  if (secret === undefined || secret.trim() === '') {
    throw new Error('OPS_AUTH_SHARED_SECRET is required for operator authorization.');
  }

  return secret;
}

function getRequestPath(request: FastifyRequestType): string {
  return request.raw.url?.split('?')[0] ?? request.url;
}

function getHeaderValue(
  request: FastifyRequestType,
  name: string,
): string | null {
  const value = request.headers[name];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

async function rejectForbidden(
  reply: FastifyReply,
  request: FastifyRequestType,
  message: string,
): Promise<void> {
  await reply.status(403).send({
    error: {
      code: 'FORBIDDEN',
      message,
      correlationId: request.id,
    },
  });
}

export const requireOperatorRole = (
  requiredRole: OpsOperatorRole,
): preHandlerAsyncHookHandler => {
  return async (request, reply): Promise<void> => {
    const operatorId = getHeaderValue(request, HEADER_OPERATOR_ID);
    const role = getHeaderValue(request, HEADER_OPERATOR_ROLE);
    const sessionId = getHeaderValue(request, HEADER_SESSION_ID);
    const issuedAt = getHeaderValue(request, HEADER_ISSUED_AT);
    const signature = getHeaderValue(request, HEADER_SIGNATURE);

    if (
      operatorId === null ||
      role === null ||
      sessionId === null ||
      issuedAt === null ||
      signature === null
    ) {
      await rejectForbidden(reply, request, 'Operator authorization headers are required.');
      return;
    }

    if (!isOpsOperatorRole(role)) {
      await rejectForbidden(reply, request, 'Operator authorization role is invalid.');
      return;
    }

    try {
      const operator = verifySignedOperatorHeaders({
        operatorId,
        role,
        sessionId,
        issuedAt,
        signature,
      }, getSharedSecret(), request.method, getRequestPath(request));

      if (!canAssumeRole(operator.role, requiredRole)) {
        await rejectForbidden(
          reply,
          request,
          `Role "${operator.role}" cannot perform this action. Required role: "${requiredRole}".`,
        );
        return;
      }

      request.operator = operator;
    } catch (error) {
      let message = 'Operator authorization failed.';
      if (error instanceof OpsAuthError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      await rejectForbidden(reply, request, message);
    }
  };
};

export function getRequiredOperator(
  request: FastifyRequestType,
): {
  operatorId: string;
  role: OpsOperatorRole;
  sessionId: string;
} {
  if (request.operator === undefined) {
    throw new Error('Operator authorization middleware did not run for this route.');
  }

  return request.operator;
}
