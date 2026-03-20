import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabaseConnection } from '@sentinel-apex/db';
import type { RuntimeControlPlane, RuntimeWorker } from '@sentinel-apex/runtime';

import { createApp } from '../app.js';
import {
  createApiHarness,
  waitForCommand,
  waitForMismatch,
  waitForMismatchStatus,
  waitForReconciliationRun,
  waitForRemediationStatus,
} from './helpers.js';

import type { FastifyInstance } from 'fastify';

const TEST_API_KEY = 'test-secret-key-for-vitest-suite-32chars!!';

describe('runtime-backed API routes', () => {
  let app: FastifyInstance;
  let controlPlane: RuntimeControlPlane;
  let worker: RuntimeWorker;
  let connectionString: string;

  beforeEach(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['API_SECRET_KEY'] = TEST_API_KEY;

    const harness = await createApiHarness();
    connectionString = harness.connectionString;
    controlPlane = harness.controlPlane;
    worker = harness.worker;

    app = await createApp({ controlPlane });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await worker.stop();
  });

  it('queues a real runtime cycle through the worker and exposes persisted data through the API', async () => {
    const commandResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });

    expect(commandResponse.statusCode).toBe(202);
    const commandBody = commandResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, commandBody.data.commandId);
    expect(command.status).toBe('completed');
    expect(command.result['runId']).toBeTruthy();

    const [portfolioResponse, ordersResponse, eventsResponse, runtimeStatusResponse, workerResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/portfolio',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/runtime/status',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/runtime/worker',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(portfolioResponse.statusCode).toBe(200);
    expect(ordersResponse.statusCode).toBe(200);
    expect(eventsResponse.statusCode).toBe(200);
    expect(runtimeStatusResponse.statusCode).toBe(200);
    expect(workerResponse.statusCode).toBe(200);

    const portfolioBody = portfolioResponse.json<{ data: { totalNav: string; sleeves: unknown[] } }>();
    const ordersBody = ordersResponse.json<{ data: Array<{ clientOrderId: string; status: string }> }>();
    const eventsBody = eventsResponse.json<{ data: Array<{ eventType: string }> }>();
    const runtimeStatusBody = runtimeStatusResponse.json<{
      data: {
        runtime: { lastRunStatus: string };
        worker: { lifecycleState: string };
        openMismatchCount: number;
      };
    }>();
    const workerBody = workerResponse.json<{ data: { schedulerState: string } }>();

    expect(portfolioBody.data.totalNav).not.toBe('0');
    expect(portfolioBody.data.sleeves.length).toBeGreaterThan(0);
    expect(ordersBody.data.length).toBeGreaterThan(0);
    expect(eventsBody.data.some((event) => event.eventType === 'runtime.cycle_completed')).toBe(true);
    expect(runtimeStatusBody.data.runtime.lastRunStatus).toBe('completed');
    expect(runtimeStatusBody.data.worker.lifecycleState).toMatch(/ready|degraded/);
    expect(runtimeStatusBody.data.openMismatchCount).toBeGreaterThanOrEqual(0);
    expect(workerBody.data.schedulerState).toMatch(/waiting|running|paused/);
  });

  it('surfaces the full mismatch recovery lifecycle through the API', async () => {
    const pauseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'maintenance-window' },
    });

    expect(pauseResponse.statusCode).toBe(200);

    const blockedCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    const blockedCommandBody = blockedCycleResponse.json<{ data: { commandId: string } }>();
    const blockedCommand = await waitForCommand(controlPlane, blockedCommandBody.data.commandId);
    expect(blockedCommand.status).toBe('failed');

    const awaitedMismatches = await waitForMismatch(controlPlane, 'recovery_action_failure');
    expect(awaitedMismatches.some((mismatch) => mismatch.status === 'open')).toBe(true);

    const mismatchesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/mismatches',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchesResponse.statusCode).toBe(200);
    const mismatchesBody = mismatchesResponse.json<{ data: Array<{ id: string; category: string; status: string }> }>();
    expect(awaitedMismatches.some((mismatch) => mismatch.category === 'recovery_action_failure')).toBe(true);
    expect(mismatchesBody.data.some((mismatch) => mismatch.category === 'recovery_action_failure')).toBe(true);

    const mismatchId = mismatchesBody.data.find((mismatch) => mismatch.category === 'recovery_action_failure')?.id;
    expect(mismatchId).toBeTruthy();

    const acknowledgeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/acknowledge`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { acknowledgedBy: 'vitest', summary: 'reviewed by test' },
    });
    expect(acknowledgeResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'acknowledged');

    const recoverResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/recover`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        recoveryBy: 'vitest',
        summary: 'linking failed command to recovery workflow',
        commandId: blockedCommand.commandId,
      },
    });
    expect(recoverResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'recovering');

    const resolveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/resolve`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        resolvedBy: 'vitest',
        summary: 'operator applied a remediation path',
        commandId: blockedCommand.commandId,
      },
    });
    expect(resolveResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'resolved');

    const verifyResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/verify`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        verifiedBy: 'vitest',
        summary: 'operator verified the incident closure',
      },
    });
    expect(verifyResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'verified');

    const reopenResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/reopen`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        reopenedBy: 'vitest',
        summary: 'manual reopen after additional review',
      },
    });
    expect(reopenResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'reopened');

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        mismatch: { status: string; linkedCommandId: string | null; reopenedBy: string | null };
        linkedCommand: { commandId: string } | null;
        recoveryEvents: Array<{ eventType: string }>;
      };
    }>();
    expect(mismatchDetailBody.data.mismatch.status).toBe('reopened');
    expect(mismatchDetailBody.data.mismatch.linkedCommandId).toBe(blockedCommand.commandId);
    expect(mismatchDetailBody.data.linkedCommand?.commandId).toBe(blockedCommand.commandId);
    expect(mismatchDetailBody.data.recoveryEvents.some((event) => event.eventType === 'mismatch_verified')).toBe(true);

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/mismatches/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summaryBody = summaryResponse.json<{
      data: {
        activeMismatchCount: number;
        statusCounts: Record<string, number>;
      };
    }>();
    expect(summaryBody.data.activeMismatchCount).toBeGreaterThanOrEqual(1);
    expect(summaryBody.data.statusCounts['reopened']).toBeGreaterThanOrEqual(1);

    const invalidVerifyResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/verify`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        verifiedBy: 'vitest',
        summary: 'invalid verification from reopened state',
      },
    });
    expect(invalidVerifyResponse.statusCode).toBe(409);

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/resume',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'maintenance-complete', confirmedBy: 'vitest' },
    });
    expect(resumeResponse.statusCode).toBe(200);

    const rebuildResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/projections/rebuild',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(rebuildResponse.statusCode).toBe(202);
    const rebuildBody = rebuildResponse.json<{ data: { commandId: string } }>();
    const rebuildCommand = await waitForCommand(controlPlane, rebuildBody.data.commandId);
    expect(rebuildCommand.status).toBe('completed');

    const commandStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/commands/${rebuildBody.data.commandId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(commandStatusResponse.statusCode).toBe(200);

    const recoveryEventsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/recovery-events',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(recoveryEventsResponse.statusCode).toBe(200);
    const recoveryEventsBody = recoveryEventsResponse.json<{ data: Array<{ eventType: string; status: string }> }>();
    expect(recoveryEventsBody.data.some((event) => event.eventType === 'runtime_command_completed')).toBe(true);

    const recoveryOutcomesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/recovery-outcomes',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(recoveryOutcomesResponse.statusCode).toBe(200);
    const recoveryOutcomesBody = recoveryOutcomesResponse.json<{ data: Array<{ eventType: string; status: string }> }>();
    expect(recoveryOutcomesBody.data.some((event) => event.eventType === 'mismatch_resolved')).toBe(true);
    expect(recoveryOutcomesBody.data.some((event) => event.eventType === 'mismatch_reopened')).toBe(true);
  });

  it('triggers and exposes mismatch-scoped remediation actions through the API', async () => {
    const pauseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'phase-1-8-remediation-setup' },
    });
    expect(pauseResponse.statusCode).toBe(200);

    const blockedCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    const blockedCommandBody = blockedCycleResponse.json<{ data: { commandId: string } }>();
    const blockedCommand = await waitForCommand(controlPlane, blockedCommandBody.data.commandId);
    expect(blockedCommand.status).toBe('failed');

    const awaitedMismatches = await waitForMismatch(controlPlane, 'recovery_action_failure');
    const mismatchId = awaitedMismatches.find((mismatch) => mismatch.category === 'recovery_action_failure')?.id;
    expect(mismatchId).toBeTruthy();

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/resume',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: { reason: 'phase-1-8-remediation-ready', confirmedBy: 'vitest' },
    });
    expect(resumeResponse.statusCode).toBe(200);

    const remediateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediate`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        remediationBy: 'vitest',
        actionType: 'rebuild_projections',
        summary: 'rebuild projections for the mismatched read model',
      },
    });
    expect(remediateResponse.statusCode).toBe(202);
    const remediationBody = remediateResponse.json<{
      data: { id: string; commandId: string; status: string; attemptSequence: number };
    }>();
    expect(remediationBody.data.status).toBe('requested');
    expect(remediationBody.data.attemptSequence).toBe(1);

    const completedRemediation = await waitForRemediationStatus(
      controlPlane,
      mismatchId as string,
      'completed',
    );
    expect(completedRemediation.command?.status).toBe('completed');

    const remediationLatestResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediation-latest`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(remediationLatestResponse.statusCode).toBe(200);
    const remediationLatestBody = remediationLatestResponse.json<{
      data: { id: string; status: string; command: { commandId: string; status: string } | null };
    }>();
    expect(remediationLatestBody.data.id).toBe(completedRemediation.id);
    expect(remediationLatestBody.data.command?.status).toBe('completed');

    const remediationHistoryResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediation-history`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(remediationHistoryResponse.statusCode).toBe(200);
    const remediationHistoryBody = remediationHistoryResponse.json<{
      data: Array<{ id: string; status: string; commandId: string }>;
    }>();
    expect(remediationHistoryBody.data).toHaveLength(1);
    expect(remediationHistoryBody.data[0]?.status).toBe('completed');

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        mismatch: { status: string };
        latestRemediation: { id: string; status: string } | null;
        remediationHistory: Array<{ id: string; status: string }>;
        remediationInFlight: boolean;
        isActionable: boolean;
      };
    }>();
    expect(mismatchDetailBody.data.mismatch.status).toBe('recovering');
    expect(mismatchDetailBody.data.latestRemediation?.status).toBe('completed');
    expect(mismatchDetailBody.data.remediationHistory).toHaveLength(1);
    expect(mismatchDetailBody.data.remediationInFlight).toBe(false);
    expect(mismatchDetailBody.data.isActionable).toBe(true);

    const resolveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/resolve`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        resolvedBy: 'vitest',
        summary: 'remediation completed and operator is closing the incident',
        commandId: completedRemediation.commandId,
      },
    });
    expect(resolveResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'resolved');

    const verifyResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/verify`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        verifiedBy: 'vitest',
        summary: 'operator verified the remediation outcome',
      },
    });
    expect(verifyResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'verified');

    const invalidRemediateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediate`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        remediationBy: 'vitest',
        actionType: 'rebuild_projections',
        summary: 'verified incidents should not accept remediation',
      },
    });
    expect(invalidRemediateResponse.statusCode).toBe(409);
  });

  it('persists reconciliation runs and findings through the API and links reconciliation-driven mismatches to remediation', async () => {
    const runCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(runCycleResponse.statusCode).toBe(202);
    const seededCycle = runCycleResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, seededCycle.data.commandId);

    const positionsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/positions',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(positionsResponse.statusCode).toBe(200);
    const positionsBody = positionsResponse.json<{ data: Array<{ id: string; asset: string }> }>();
    const position = positionsBody.data[0];
    expect(position?.id).toBeTruthy();

    const connection = await createDatabaseConnection(connectionString);
    await connection.execute(`
      UPDATE positions
      SET size = '777', updated_at = NOW()
      WHERE id = '${String(position?.id).replace(/'/g, "''")}';
    `);

    const reconciliationResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/reconciliation/run',
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        trigger: 'api-reconciliation-test',
        triggerReference: position?.id,
        triggeredBy: 'vitest',
      },
    });
    expect(reconciliationResponse.statusCode).toBe(202);
    const reconciliationBody = reconciliationResponse.json<{ data: { commandId: string } }>();
    const completedReconciliationCommand = await waitForCommand(
      controlPlane,
      reconciliationBody.data.commandId,
    );
    const reconciliationRun = await waitForReconciliationRun(
      controlPlane,
      String(completedReconciliationCommand.result['reconciliationRunId']),
    );
    expect(reconciliationRun.status).toBe('completed');
    expect(reconciliationRun.findingCount).toBeGreaterThan(0);

    const runsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/runs',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(runsResponse.statusCode).toBe(200);
    const runsBody = runsResponse.json<{ data: Array<{ id: string }> }>();
    expect(runsBody.data.some((run) => run.id === reconciliationRun.id)).toBe(true);

    const findingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/findings?findingType=position_exposure_mismatch',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(findingsResponse.statusCode).toBe(200);
    const findingsBody = findingsResponse.json<{
      data: Array<{ id: string; mismatchId: string | null; status: string; findingType: string }>;
    }>();
    const finding = findingsBody.data.find((item) => item.findingType === 'position_exposure_mismatch');
    expect(finding).toBeTruthy();
    expect(finding?.status).toBe('active');
    expect(finding?.mismatchId).toBeTruthy();

    const findingDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/reconciliation/findings/${finding?.id}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(findingDetailResponse.statusCode).toBe(200);

    const mismatchFindingsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}/findings`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchFindingsResponse.statusCode).toBe(200);
    const mismatchFindingsBody = mismatchFindingsResponse.json<{ data: Array<{ id: string }> }>();
    expect(mismatchFindingsBody.data.some((item) => item.id === finding?.id)).toBe(true);

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        mismatch: { sourceKind: string };
        reconciliationFindings: Array<{ id: string; status: string }>;
        latestReconciliationFinding: { id: string; findingType: string } | null;
        recommendedRemediationTypes: string[];
      };
    }>();
    expect(mismatchDetailBody.data.mismatch.sourceKind).toBe('reconciliation');
    expect(mismatchDetailBody.data.reconciliationFindings.some((item) => item.id === finding?.id)).toBe(true);
    expect(mismatchDetailBody.data.latestReconciliationFinding?.findingType).toBe('position_exposure_mismatch');
    expect(mismatchDetailBody.data.recommendedRemediationTypes).toContain('rebuild_projections');

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summaryBody = summaryResponse.json<{
      data: {
        latestRun: { id: string } | null;
        latestSeverityCounts: Record<string, number>;
        latestTypeCounts: Record<string, number>;
      } | null;
    }>();
    expect(summaryBody.data?.latestRun?.id).toBe(reconciliationRun.id);
    expect((summaryBody.data?.latestSeverityCounts['high'] ?? 0) + (summaryBody.data?.latestSeverityCounts['critical'] ?? 0)).toBeGreaterThan(0);
    expect(summaryBody.data?.latestTypeCounts['position_exposure_mismatch']).toBeGreaterThan(0);

    const remediateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}/remediate`,
      headers: { 'x-api-key': TEST_API_KEY },
      payload: {
        remediationBy: 'vitest',
        actionType: 'rebuild_projections',
        summary: 'repair projected positions from persisted truth',
      },
    });
    expect(remediateResponse.statusCode).toBe(202);
    await waitForRemediationStatus(controlPlane, String(finding?.mismatchId), 'completed');
    await waitForMismatchStatus(controlPlane, String(finding?.mismatchId), 'resolved');

    const resolvedMismatchFindingsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}/findings`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(resolvedMismatchFindingsResponse.statusCode).toBe(200);
    const resolvedMismatchFindingsBody = resolvedMismatchFindingsResponse.json<{
      data: Array<{ status: string }>;
    }>();
    expect(resolvedMismatchFindingsBody.data.some((item) => item.status === 'resolved')).toBe(true);
  });
});
