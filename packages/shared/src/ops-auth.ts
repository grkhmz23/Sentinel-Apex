import { createHmac, timingSafeEqual } from 'crypto';

export const OPS_OPERATOR_ROLES = ['viewer', 'operator', 'admin'] as const;

export type OpsOperatorRole = (typeof OPS_OPERATOR_ROLES)[number];

export interface SignedOperatorContext {
  operatorId: string;
  role: OpsOperatorRole;
  sessionId: string;
}

export interface SignedOperatorHeaders {
  operatorId: string;
  role: string;
  sessionId: string;
  issuedAt: string;
  signature: string;
}

export class OpsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpsAuthError';
  }
}

export function isOpsOperatorRole(value: string): value is OpsOperatorRole {
  return OPS_OPERATOR_ROLES.includes(value as OpsOperatorRole);
}

export function canAssumeRole(
  actualRole: OpsOperatorRole,
  requiredRole: OpsOperatorRole,
): boolean {
  const roleOrder: Record<OpsOperatorRole, number> = {
    viewer: 0,
    operator: 1,
    admin: 2,
  };

  return roleOrder[actualRole] >= roleOrder[requiredRole];
}

function buildSigningPayload(
  method: string,
  path: string,
  issuedAt: string,
  context: {
    operatorId: string;
    role: string;
    sessionId: string;
  },
): string {
  return [
    method.toUpperCase(),
    path,
    issuedAt,
    context.operatorId,
    context.role,
    context.sessionId,
  ].join('\n');
}

function signPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

export function createSignedOperatorHeaders(
  context: SignedOperatorContext,
  secret: string,
  method: string,
  path: string,
  issuedAt = new Date().toISOString(),
): SignedOperatorHeaders {
  const signature = signPayload(
    secret,
    buildSigningPayload(method, path, issuedAt, context),
  );

  return {
    ...context,
    issuedAt,
    signature,
  };
}

export function verifySignedOperatorHeaders(
  headers: SignedOperatorHeaders,
  secret: string,
  method: string,
  path: string,
  maxSkewMs = 5 * 60 * 1000,
): SignedOperatorContext {
  if (!isOpsOperatorRole(headers.role)) {
    throw new OpsAuthError(`Invalid operator role "${headers.role}".`);
  }

  const issuedAtMs = Date.parse(headers.issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    throw new OpsAuthError('Invalid operator signature timestamp.');
  }

  if (Math.abs(Date.now() - issuedAtMs) > maxSkewMs) {
    throw new OpsAuthError('Operator signature is expired.');
  }

  const expectedSignature = signPayload(
    secret,
    buildSigningPayload(method, path, headers.issuedAt, headers),
  );

  if (!timingSafeStringEqual(headers.signature, expectedSignature)) {
    throw new OpsAuthError('Invalid operator signature.');
  }

  return {
    operatorId: headers.operatorId,
    role: headers.role,
    sessionId: headers.sessionId,
  };
}
