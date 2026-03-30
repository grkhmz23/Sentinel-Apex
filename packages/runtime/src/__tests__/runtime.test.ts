import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { applyMigrations, createDatabaseConnection } from '@sentinel-apex/db';
import { createId } from '@sentinel-apex/domain';

import { RuntimeControlPlane } from '../control-plane.js';
import { SentinelRuntime } from '../runtime.js';
import { DatabaseAuditWriter } from '../store.js';


async function createRuntimeConnectionString(): Promise<string> {
  return `file:///tmp/sentinel-apex-runtime-test-${randomUUID()}`;
}

async function createRuntime(overrides: Parameters<typeof SentinelRuntime.createDeterministic>[1] = {}) {
  const connectionString = await createRuntimeConnectionString();
  return SentinelRuntime.createDeterministic(connectionString, overrides);
}

function asPositionFingerprint(position: {
  venueId: string;
  asset: string;
  side: string;
  size: string;
}): string {
  return `${position.venueId}:${position.asset}:${position.side}:${position.size}`;
}

describe('SentinelRuntime', () => {
  it('persists approved paper executions into read models', async () => {
    const runtime = await createRuntime();

    const result = await runtime.runCycle('runtime-test');
    const portfolio = await runtime.getPortfolioSummary();
    const orders = await runtime.listOrders();
    const riskSummary = await runtime.getRiskSummary();
    const events = await runtime.listRecentEvents();

    expect(result.intentsExecuted).toBeGreaterThan(0);
    expect(portfolio?.sleeves.length ?? 0).toBeGreaterThan(0);
    expect(orders.length).toBeGreaterThan(0);
    expect(riskSummary?.approvedIntentCount ?? 0).toBeGreaterThan(0);
    expect(events.some((event) => event.eventType === 'runtime.cycle_completed')).toBe(true);

    await runtime.close();
  });

  it('persists rejected-by-risk paths and risk breaches', async () => {
    const runtime = await createRuntime({
      riskLimits: {
        maxGrossExposurePct: 0.01,
      },
    });

    const result = await runtime.runCycle('runtime-risk-test');
    const breaches = await runtime.listRiskBreaches();
    const orders = await runtime.listOrders();

    expect(result.intentsRejected).toBeGreaterThan(0);
    expect(breaches.length).toBeGreaterThan(0);
    expect(orders.length).toBe(0);

    await runtime.close();
  });

  it('deduplicates audit events by eventId', async () => {
    const connectionString = await createRuntimeConnectionString();
    const connection = await createDatabaseConnection(connectionString);
    await applyMigrations(connection);
    const auditWriter = new DatabaseAuditWriter(connection.db);

    const auditEvent = {
      eventId: createId(),
      eventType: 'test.duplicate_event',
      occurredAt: new Date().toISOString(),
      actorType: 'system' as const,
      actorId: 'runtime-test',
      data: { duplicate: true },
    };

    await auditWriter.write(auditEvent);
    await auditWriter.write(auditEvent);

    const runtime = await SentinelRuntime.createDeterministic(connectionString);
    const events = await runtime.listRecentEvents();

    expect(events.filter((event) => event.eventType === 'test.duplicate_event')).toHaveLength(1);

    await runtime.close();
  });

  it('restores runtime state and positions from persisted history on restart', async () => {
    const connectionString = await createRuntimeConnectionString();

    const runtime = await SentinelRuntime.createDeterministic(connectionString);
    const firstCycle = await runtime.runCycle('runtime-restart-test');
    const positionsBeforeClose = await runtime.listPositions();
    await runtime.close();

    const restarted = await SentinelRuntime.createDeterministic(connectionString);
    const restoredStatus = await restarted.getRuntimeStatus();
    const restoredPositions = await restarted.listPositions();

    expect(restoredStatus.lifecycleState).toBe('ready');
    expect(restoredStatus.lastSuccessfulRunId).toBe(firstCycle.runId);
    expect(restoredStatus.lastProjectionSourceRunId).toBe(firstCycle.runId);
    expect(restoredPositions).toHaveLength(positionsBeforeClose.length);
    expect(restoredPositions.map(asPositionFingerprint).sort()).toEqual(
      positionsBeforeClose.map(asPositionFingerprint).sort(),
    );

    await restarted.close();
  });

  it('rebuilds projections idempotently from persisted records', async () => {
    const runtime = await createRuntime();

    const cycle = await runtime.runCycle('runtime-rebuild-test');
    const portfolioBefore = await runtime.getPortfolioSummary();
    const positionsBefore = await runtime.listPositions();

    const firstRebuild = await runtime.rebuildProjections('runtime-test-rebuild');
    const secondRebuild = await runtime.rebuildProjections('runtime-test-rebuild');
    const portfolioAfter = await runtime.getPortfolioSummary();
    const positionsAfter = await runtime.listPositions();

    expect(firstRebuild.projectionStatus).toBe('fresh');
    expect(secondRebuild.projectionStatus).toBe('fresh');
    expect(secondRebuild.lastProjectionSourceRunId).toBe(cycle.runId);
    expect(portfolioAfter).toEqual(portfolioBefore);
    expect(positionsAfter.map(asPositionFingerprint).sort()).toEqual(
      positionsBefore.map(asPositionFingerprint).sort(),
    );

    await runtime.close();
  });

  it('enforces pause and resume semantics through persisted runtime state', async () => {
    const runtime = await createRuntime();

    const paused = await runtime.activateKillSwitch('operator-maintenance', 'runtime-test');
    expect(paused.lifecycleState).toBe('paused');
    await expect(runtime.runCycle('paused-runtime-test')).rejects.toThrow('Runtime is paused');

    const resumed = await runtime.resume('operator-maintenance-complete', 'runtime-test');
    expect(resumed.lifecycleState).toBe('ready');

    const cycle = await runtime.runCycle('post-resume-runtime-test');
    expect(cycle.runId).toBeTruthy();

    await runtime.close();
  });

  it('persists allocator evaluations with target allocations and recommendations', async () => {
    const runtime = await createRuntime();

    await runtime.runCycle('runtime-allocator-test');

    const summary = await runtime.getAllocatorSummary();

    expect(summary?.allocatorRunId).toBeTruthy();
    expect(summary?.carryTargetPct).toBeGreaterThanOrEqual(0);
    expect(summary?.treasuryTargetPct).toBeGreaterThan(0);
    expect(summary?.recommendationCount).toBeGreaterThanOrEqual(1);

    await runtime.close();
  });

  it('persists rebalance proposals derived from allocator targets', async () => {
    const connectionString = await createRuntimeConnectionString();
    const runtime = await SentinelRuntime.createDeterministic(connectionString);
    const controlPlane = await RuntimeControlPlane.connect(connectionString);

    await runtime.runCycle('runtime-rebalance-proposal-test');
    const proposals = await controlPlane.listRebalanceProposals(10);

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0]?.allocatorRunId).toBeTruthy();
    expect(proposals[0]?.actionType).toBe('rebalance_between_sleeves');

    const detail = await controlPlane.getRebalanceProposal(String(proposals[0]?.id));
    expect(detail?.intents.length).toBeGreaterThan(0);
    expect(detail?.proposal.summary).toContain('Rebalance');

    await runtime.close();
  });

  it('persists carry evaluations with actionability state and venue readiness snapshots', async () => {
    const runtime = await createRuntime();

    await runtime.runCycle('runtime-carry-evaluation-test');
    const evaluation = await runtime.runCarryEvaluation({
      actorId: 'vitest',
      trigger: 'runtime_carry_evaluation_test',
    });

    const actions = await runtime.listCarryActions(20);
    const venues = await runtime.listCarryVenues(20);
    const detail = actions[0] === undefined ? null : await runtime.getCarryAction(actions[0].id);
    const executionDetail = detail?.executions[0] === undefined
      ? null
      : await runtime.getCarryExecution(detail.executions[0].id);

    expect(evaluation.actionCount).toBeGreaterThan(0);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.executionMode).toBe('dry-run');
    expect(actions[0]?.simulated).toBe(true);
    expect(venues.length).toBeGreaterThan(0);
    expect(venues[0]?.venueMode).toBe('simulated');
    expect(detail?.plannedOrders.length).toBeGreaterThan(0);
    expect(executionDetail).toBeNull();

    await runtime.close();
  });
});
