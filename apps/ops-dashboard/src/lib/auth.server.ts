import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  applyMigrations,
  createDatabaseConnection,
  opsOperators,
  opsOperatorSessions,
  resetDatabaseConnectionCache,
  type DatabaseConnection,
} from '@sentinel-apex/db';
import {
  createSignedOperatorHeaders,
  type OpsOperatorRole,
} from '@sentinel-apex/shared';

import {
  getDatabaseUrl,
  getOpsAuthSharedSecret,
  getSessionCookieName,
  getSessionTtlHours,
  isProductionEnv,
} from './env.server';

import type {
  DashboardOperatorIdentity,
  DashboardSession,
} from './operator-session';

const PASSWORD_PREFIX = 'scrypt';
const PASSWORD_COST = 16_384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

interface SessionCookieDescriptor {
  rawToken: string;
  hashedToken: string;
}

let connectionPromise: Promise<DatabaseConnection> | null = null;

async function getConnection(): Promise<DatabaseConnection> {
  if (connectionPromise === null) {
    connectionPromise = (async () => {
      const connection = await createDatabaseConnection(getDatabaseUrl());
      // Skip migrations in production/Vercel - they should be applied during build or manually
      if (process.env['NODE_ENV'] !== 'production') {
        await applyMigrations(connection);
      }
      return connection;
    })();
  }

  return connectionPromise;
}

function createPasswordHashBuffer(
  password: string,
  saltHex: string,
): Buffer {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
  });
}

function parsePasswordHash(hash: string): {
  saltHex: string;
  derivedHex: string;
} {
  const [prefix, cost, blockSize, parallelization, saltHex, derivedHex] = hash.split('$');
  if (
    prefix !== PASSWORD_PREFIX ||
    cost !== String(PASSWORD_COST) ||
    blockSize !== String(PASSWORD_BLOCK_SIZE) ||
    parallelization !== String(PASSWORD_PARALLELIZATION) ||
    saltHex === undefined ||
    derivedHex === undefined
  ) {
    throw new Error('Unsupported password hash format.');
  }

  return { saltHex, derivedHex };
}

function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function createSessionCookieDescriptor(): SessionCookieDescriptor {
  const rawToken = randomBytes(32).toString('base64url');
  return {
    rawToken,
    hashedToken: hashSessionToken(rawToken),
  };
}

function buildDashboardSession(
  sessionRow: typeof opsOperatorSessions.$inferSelect,
  operatorRow: typeof opsOperators.$inferSelect,
): DashboardSession {
  return {
    sessionId: sessionRow.sessionId,
    expiresAt: sessionRow.expiresAt.toISOString(),
    operator: {
      operatorId: operatorRow.operatorId,
      email: operatorRow.email,
      displayName: operatorRow.displayName,
      role: operatorRow.role as OpsOperatorRole,
      active: operatorRow.active,
    },
  };
}

async function touchSessionIfNeeded(sessionId: string, lastSeenAt: Date): Promise<void> {
  if (Date.now() - lastSeenAt.getTime() < SESSION_TOUCH_INTERVAL_MS) {
    return;
  }

  const connection = await getConnection();
  await connection.db
    .update(opsOperatorSessions)
    .set({
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opsOperatorSessions.sessionId, sessionId));
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('Operator passwords must be at least 12 characters.');
  }

  const saltHex = randomBytes(16).toString('hex');
  const derived = createPasswordHashBuffer(password, saltHex);

  return [
    PASSWORD_PREFIX,
    String(PASSWORD_COST),
    String(PASSWORD_BLOCK_SIZE),
    String(PASSWORD_PARALLELIZATION),
    saltHex,
    derived.toString('hex'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const { saltHex, derivedHex } = parsePasswordHash(encodedHash);
  const actual = createPasswordHashBuffer(password, saltHex);
  const expected = Buffer.from(derivedHex, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export async function upsertOperator(input: {
  operatorId: string;
  email: string;
  displayName: string;
  role: OpsOperatorRole;
  password: string;
  active?: boolean;
}): Promise<DashboardOperatorIdentity> {
  const connection = await getConnection();
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const existing = await connection.db.query.opsOperators.findFirst({
    where: or(
      eq(opsOperators.operatorId, input.operatorId),
      eq(opsOperators.email, input.email),
    ),
  });

  if (existing === undefined) {
    await connection.db.insert(opsOperators).values({
      operatorId: input.operatorId,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      passwordHash,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await connection.db
      .update(opsOperators)
      .set({
        operatorId: input.operatorId,
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        passwordHash,
        active: input.active ?? existing.active,
        updatedAt: now,
      })
      .where(eq(opsOperators.id, existing.id));
  }

  const operator = await connection.db.query.opsOperators.findFirst({
    where: eq(opsOperators.operatorId, input.operatorId),
  });

  if (operator === undefined) {
    throw new Error(`Failed to persist operator "${input.operatorId}".`);
  }

  return {
    operatorId: operator.operatorId,
    email: operator.email,
    displayName: operator.displayName,
    role: operator.role as OpsOperatorRole,
    active: operator.active,
  };
}

export async function authenticateOperatorCredentials(
  email: string,
  password: string,
): Promise<DashboardOperatorIdentity | null> {
  const connection = await getConnection();
  const operator = await connection.db.query.opsOperators.findFirst({
    where: eq(opsOperators.email, email.trim().toLowerCase()),
  });

  if (operator === undefined || !operator.active) {
    return null;
  }

  const isValid = await verifyPassword(password, operator.passwordHash);
  if (!isValid) {
    return null;
  }

  await connection.db
    .update(opsOperators)
    .set({
      lastAuthenticatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opsOperators.id, operator.id));

  return {
    operatorId: operator.operatorId,
    email: operator.email,
    displayName: operator.displayName,
    role: operator.role as OpsOperatorRole,
    active: operator.active,
  };
}

export async function createDashboardSession(
  operatorId: string,
): Promise<{ session: DashboardSession; token: string }> {
  const connection = await getConnection();
  const operator = await connection.db.query.opsOperators.findFirst({
    where: eq(opsOperators.operatorId, operatorId),
  });

  if (operator === undefined || !operator.active) {
    throw new Error(`Operator "${operatorId}" is not active.`);
  }

  const descriptor = createSessionCookieDescriptor();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getSessionTtlHours() * 60 * 60 * 1000);
  const sessionId = randomBytes(16).toString('hex');

  await connection.db.insert(opsOperatorSessions).values({
    sessionId,
    operatorId: operator.operatorId,
    tokenHash: descriptor.hashedToken,
    expiresAt,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return {
    session: {
      sessionId,
      expiresAt: expiresAt.toISOString(),
      operator: {
        operatorId: operator.operatorId,
        email: operator.email,
        displayName: operator.displayName,
        role: operator.role as OpsOperatorRole,
        active: operator.active,
      },
    },
    token: descriptor.rawToken,
  };
}

export async function revokeDashboardSessionByToken(rawToken: string): Promise<void> {
  const connection = await getConnection();
  await connection.db
    .update(opsOperatorSessions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opsOperatorSessions.tokenHash, hashSessionToken(rawToken)));
}

export async function revokeDashboardSessionById(sessionId: string): Promise<void> {
  const connection = await getConnection();
  await connection.db
    .update(opsOperatorSessions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(opsOperatorSessions.sessionId, sessionId));
}

export async function getDashboardSessionFromToken(
  rawToken: string | null,
): Promise<DashboardSession | null> {
  if (rawToken === null || rawToken.trim() === '') {
    return null;
  }

  const connection = await getConnection();
  const sessionRow = await connection.db.query.opsOperatorSessions.findFirst({
    where: and(
      eq(opsOperatorSessions.tokenHash, hashSessionToken(rawToken)),
      gt(opsOperatorSessions.expiresAt, new Date()),
      isNull(opsOperatorSessions.revokedAt),
    ),
  });

  if (sessionRow === undefined) {
    return null;
  }

  const operatorRow = await connection.db.query.opsOperators.findFirst({
    where: and(
      eq(opsOperators.operatorId, sessionRow.operatorId),
      eq(opsOperators.active, true),
    ),
  });

  if (operatorRow === undefined) {
    await revokeDashboardSessionById(sessionRow.sessionId);
    return null;
  }

  await touchSessionIfNeeded(sessionRow.sessionId, sessionRow.lastSeenAt);

  return buildDashboardSession(sessionRow, operatorRow);
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  const token = cookies().get(getSessionCookieName())?.value ?? null;
  return getDashboardSessionFromToken(token);
}

export async function requireDashboardSession(
  nextPath = '/',
): Promise<DashboardSession> {
  const session = await getDashboardSession();
  if (session === null) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  return session;
}

export function buildOperatorProxyHeaders(
  session: DashboardSession,
  method: string,
  path: string,
): Record<string, string> {
  const signed = createSignedOperatorHeaders({
    operatorId: session.operator.operatorId,
    role: session.operator.role,
    sessionId: session.sessionId,
  }, getOpsAuthSharedSecret(), method, path);

  return {
    'x-sentinel-operator-id': signed.operatorId,
    'x-sentinel-operator-role': signed.role,
    'x-sentinel-operator-session-id': signed.sessionId,
    'x-sentinel-operator-issued-at': signed.issuedAt,
    'x-sentinel-operator-signature': signed.signature,
  };
}

export function getSessionCookieOptions(expiresAt: string): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProductionEnv(),
    path: '/',
    expires: new Date(expiresAt),
  };
}

export function getClearedSessionCookieOptions(): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  expires: Date;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProductionEnv(),
    path: '/',
    expires: new Date(0),
  };
}

export async function resetDashboardAuthForTests(): Promise<void> {
  connectionPromise = null;
  resetDatabaseConnectionCache();
}
