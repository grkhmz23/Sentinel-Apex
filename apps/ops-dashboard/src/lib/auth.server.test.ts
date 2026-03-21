import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  authenticateOperatorCredentials,
  createDashboardSession,
  getDashboardSessionFromToken,
  resetDashboardAuthForTests,
  revokeDashboardSessionByToken,
  upsertOperator,
} from './auth.server';

describe('dashboard auth server', () => {
  beforeEach(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: `file:///tmp/sentinel-apex-ops-auth-${randomUUID()}`,
      OPS_AUTH_SHARED_SECRET: 'ops-auth-shared-secret-for-tests-32chars',
      OPS_DASHBOARD_SESSION_TTL_HOURS: '12',
    });
    await resetDashboardAuthForTests();
  });

  afterEach(async () => {
    await resetDashboardAuthForTests();
  });

  it('persists operators, authenticates credentials, and resolves durable sessions', async () => {
    const operator = await upsertOperator({
      operatorId: 'ops-user',
      email: 'ops@example.com',
      displayName: 'Ops User',
      password: 'super-secure-password',
      role: 'operator',
    });

    expect(operator.operatorId).toBe('ops-user');

    const authenticated = await authenticateOperatorCredentials(
      'ops@example.com',
      'super-secure-password',
    );
    expect(authenticated?.operatorId).toBe('ops-user');

    const { session, token } = await createDashboardSession('ops-user');
    expect(session.operator.email).toBe('ops@example.com');

    const resolved = await getDashboardSessionFromToken(token);
    expect(resolved?.sessionId).toBe(session.sessionId);
    expect(resolved?.operator.role).toBe('operator');
  });

  it('rejects invalid credentials and revokes sessions durably', async () => {
    await upsertOperator({
      operatorId: 'viewer-user',
      email: 'viewer@example.com',
      displayName: 'Viewer User',
      password: 'viewer-password-123',
      role: 'viewer',
    });

    await expect(
      authenticateOperatorCredentials('viewer@example.com', 'wrong-password'),
    ).resolves.toBeNull();

    const { token } = await createDashboardSession('viewer-user');
    expect(await getDashboardSessionFromToken(token)).not.toBeNull();

    await revokeDashboardSessionByToken(token);
    expect(await getDashboardSessionFromToken(token)).toBeNull();
  });
});
