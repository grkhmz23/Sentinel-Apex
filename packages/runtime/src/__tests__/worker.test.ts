import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import {
  allocatorRebalanceProposals,
  allocatorRebalanceExecutions,
  carryActions,
  createDatabaseConnection,
  treasuryActionExecutions,
  treasuryActions,
} from '@sentinel-apex/db';

import { RuntimeControlPlane } from '../control-plane.js';
import { RuntimeWorker } from '../worker.js';

async function createConnectionString(): Promise<string> {
  return `file:///tmp/sentinel-apex-worker-test-${randomUUID()}`;
}

async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('Timed out waiting for condition');
}

describe('RuntimeWorker', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup !== undefined) {
        await cleanup();
      }
    }
  });

  it('boots, schedules cycles, and shuts down with persisted worker metadata', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 25,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const runtimeStatus = await waitFor(
      () => controlPlane.getRuntimeStatus(),
      (status) => status.lastRunStatus === 'completed',
    );
    const workerStatus = await controlPlane.getWorkerStatus();
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (summary): summary is Exclude<typeof summary, null> => summary !== null,
    );
    if (treasurySummary === null) {
      throw new Error('Expected treasury summary to be present');
    }

    expect(runtimeStatus.lastRunId).toBeTruthy();
    expect(workerStatus.lifecycleState).toMatch(/ready|degraded/);
    expect(workerStatus.lastHeartbeatAt).toBeTruthy();
    expect(workerStatus.lastSuccessAt).toBeTruthy();
    expect(treasurySummary.sleeveId).toBe('treasury');
    expect(treasurySummary.actionCount).toBeGreaterThanOrEqual(0);
  }, 90_000);

  it('processes commands serially, persists failures as mismatches, and records recovery history', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('worker-test-pause', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-blocked-cycle',
    });
    const failedCommand = await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );
    if (failedCommand === null) {
      throw new Error('Expected failed command to be present');
    }
    expect(failedCommand.errorMessage).toContain('Runtime is paused');

    const mismatches = await waitFor(
      () => controlPlane.listMismatches(20, { status: 'open' }),
      (items) => items.some((item) => item.category === 'recovery_action_failure'),
    );
    expect(mismatches.some((item) => item.category === 'recovery_action_failure')).toBe(true);

    await controlPlane.resume('worker-test-resume', 'vitest');

    const firstCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-first-command',
    });
    const secondCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-second-command',
    });

    const completedFirst = await waitFor(
      async () => controlPlane.getCommand(firstCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    const completedSecond = await waitFor(
      async () => controlPlane.getCommand(secondCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    if (completedFirst === null || completedSecond === null) {
      throw new Error('Expected completed commands to be present');
    }

    expect(completedFirst.result['runId']).toBeTruthy();
    expect(completedSecond.result['runId']).toBeTruthy();
    expect(completedSecond.startedAt !== null && completedFirst.completedAt !== null).toBe(true);

    const recoveryEvents = await controlPlane.listRecoveryEvents(20);
    expect(recoveryEvents.some((event) => event.eventType === 'runtime_command_failed')).toBe(true);
    expect(recoveryEvents.some((event) => event.eventType === 'runtime_command_completed')).toBe(true);
  });

  it('supports acknowledge, recovering, resolve, verify, and reopen lifecycle transitions', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('phase-1-7-test-pause', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-7-test-cycle',
    });
    await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );

    const openMismatch = await waitFor(
      async () => {
        const mismatches = await controlPlane.listMismatches(20);
        return mismatches.find((item) => item.category === 'recovery_action_failure') ?? null;
      },
      (mismatch): mismatch is Exclude<typeof mismatch, null> => mismatch !== null,
    );
    if (openMismatch === null) {
      throw new Error('Expected recovery_action_failure mismatch to exist');
    }

    expect(openMismatch.status).toBe('open');

    const acknowledged = await controlPlane.acknowledgeMismatch(
      openMismatch.id,
      'vitest',
      'operator saw the failure',
    );
    expect(acknowledged?.status).toBe('acknowledged');
    expect(acknowledged?.acknowledgedBy).toBe('vitest');

    const recovering = await controlPlane.startMismatchRecovery({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'linking a recovery command',
      commandId: blockedCommand.commandId,
    });
    expect(recovering?.status).toBe('recovering');
    expect(recovering?.linkedCommandId).toBe(blockedCommand.commandId);

    const resolved = await controlPlane.resolveMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'investigation complete and fix applied',
      commandId: blockedCommand.commandId,
    });
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.resolvedBy).toBe('vitest');

    const verified = await controlPlane.verifyMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'fix confirmed by operator review',
    });
    expect(verified?.status).toBe('verified');
    expect(verified?.verificationOutcome).toBe('verified');

    const reopened = await controlPlane.reopenMismatch(
      openMismatch.id,
      'vitest',
      'issue reappeared after verification',
    );
    expect(reopened?.status).toBe('reopened');
    expect(reopened?.reopenedBy).toBe('vitest');

    const failedVerificationReopen = await controlPlane.resolveMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'second fix applied',
    });
    expect(failedVerificationReopen?.status).toBe('resolved');

    const verificationFailed = await controlPlane.verifyMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'verification failed; problem still present',
      outcome: 'failed',
    });
    expect(verificationFailed?.status).toBe('reopened');
    expect(verificationFailed?.verificationOutcome).toBe('failed');

    await expect(
      controlPlane.verifyMismatch({
        mismatchId: openMismatch.id,
        actorId: 'vitest',
        summary: 'invalid verification attempt from reopened',
      }),
    ).rejects.toThrow('Cannot verify mismatch');

    const detail = await controlPlane.getMismatchDetail(openMismatch.id);
    expect(detail?.mismatch.status).toBe('reopened');
    expect(detail?.linkedCommand?.commandId).toBe(blockedCommand.commandId);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_recovery_started')).toBe(true);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_verified')).toBe(true);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_verification_failed')).toBe(true);

    const summary = await controlPlane.summarizeMismatches();
    expect(summary.statusCounts.reopened).toBeGreaterThanOrEqual(1);
    expect(summary.activeMismatchCount).toBeGreaterThanOrEqual(1);
  });

  it('creates durable mismatch-scoped remediation attempts and exposes successful outcomes in detail', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 25,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('phase-1-8-open-mismatch', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-8-open-mismatch',
    });
    await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );

    const mismatch = await waitFor(
      async () => {
        const mismatches = await controlPlane.listMismatches(20);
        return mismatches.find((item) => item.category === 'recovery_action_failure') ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (mismatch === null) {
      throw new Error('Expected mismatch to exist');
    }

    await controlPlane.acknowledgeMismatch(mismatch.id, 'vitest', 'operator acknowledged mismatch');
    await controlPlane.resume('phase-1-8-remediation-success', 'vitest');

    const remediation = await controlPlane.remediateMismatch({
      mismatchId: mismatch.id,
      actorId: 'vitest',
      remediationType: 'rebuild_projections',
      summary: 'rebuild projections for mismatch context',
    });

    expect(remediation.commandId).toBeTruthy();
    expect(remediation.attemptSequence).toBe(1);
    expect(remediation.status).toBe('requested');

    const completedRemediation = await waitFor(
      async () => controlPlane.getLatestMismatchRemediation(mismatch.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    if (completedRemediation === null) {
      throw new Error('Expected remediation to complete');
    }

    expect(completedRemediation.command?.status).toBe('completed');
    expect(completedRemediation.latestRecoveryEvent?.eventType).toBe('runtime_command_completed');

    const detail = await controlPlane.getMismatchDetail(mismatch.id);
    expect(detail?.mismatch.status).toBe('recovering');
    expect(detail?.latestRemediation?.id).toBe(completedRemediation.id);
    expect(detail?.remediationInFlight).toBe(false);
    expect(detail?.isActionable).toBe(true);
    expect(detail?.remediationHistory).toHaveLength(1);
    expect(detail?.remediationHistory[0]?.command?.commandId).toBe(remediation.commandId);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_remediation_requested')).toBe(true);
  });

  it('processes explicit treasury evaluation commands and persists treasury read models', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const command = await controlPlane.enqueueTreasuryEvaluation('vitest');
    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (summary): summary is Exclude<typeof summary, null> => summary !== null,
    );
    if (completedCommand === null || treasurySummary === null) {
      throw new Error('Expected treasury command and summary to be present');
    }
    const allocations = await controlPlane.listTreasuryAllocations(10);
    const actions = await controlPlane.listTreasuryActions(10);

    expect(completedCommand.result['treasuryRunId']).toBe(treasurySummary.treasuryRunId);
    expect(allocations.length).toBeGreaterThan(0);
    expect(actions.length).toBeGreaterThan(0);
    expect(treasurySummary.reserveStatus.requiredReserveUsd).not.toBe('0.00');
  });

  it('approves rebalance proposals and executes them through the runtime command rail', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_rebalance_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposals = await waitFor(
      async () => controlPlane.listRebalanceProposals(10),
      (value): value is Exclude<typeof value, null> => value.length > 0,
    );
    const actionable = proposals.find((proposal) => proposal.executable);
    if (actionable === undefined) {
      throw new Error('Expected actionable rebalance proposal.');
    }

    const executionCommand = await controlPlane.approveRebalanceProposal(actionable.id, 'vitest', 'operator');
    expect(executionCommand?.commandType).toBe('execute_rebalance_proposal');

    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(String(executionCommand?.commandId)),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const detail = await waitFor(
      async () => controlPlane.getRebalanceProposal(actionable.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.executions.length > 0,
    );
    const downstreamCarryActionIds = Array.isArray(completedCommand?.result['downstreamCarryActionIds'])
      ? completedCommand.result['downstreamCarryActionIds'].filter((value): value is string => typeof value === 'string')
      : [];
    const downstreamTreasuryActionIds = Array.isArray(completedCommand?.result['downstreamTreasuryActionIds'])
      ? completedCommand.result['downstreamTreasuryActionIds'].filter((value): value is string => typeof value === 'string')
      : [];
    const graph = await waitFor(
      async () => controlPlane.getRebalanceExecutionGraph(actionable.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.timeline.length > 0,
    );
    const bundle = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(actionable.id),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (bundle === null) {
      throw new Error('Expected rebalance bundle detail.');
    }

    expect(completedCommand?.result['proposalId']).toBe(actionable.id);
    expect(detail?.executions.length).toBeGreaterThan(0);
    expect(detail?.proposal.linkedCommandId).toBe(executionCommand?.commandId ?? null);
    expect(Array.isArray(completedCommand?.result['downstreamCarryActionIds'])).toBe(true);
    expect(Array.isArray(completedCommand?.result['downstreamTreasuryActionIds'])).toBe(true);
    expect(graph?.downstream.carry.rollup.actionCount).toBe(downstreamCarryActionIds.length);
    expect(graph?.downstream.carry.actions.map((action) => action.action.id).sort()).toEqual(
      [...downstreamCarryActionIds].sort(),
    );
    if (downstreamCarryActionIds.length > 0) {
      expect(graph?.downstream.carry.actions.every((action) => action.action.linkedRebalanceProposalId === actionable.id)).toBe(true);
    }
    expect(graph?.downstream.treasury.actions.map((action) => action.action.id).sort()).toEqual(
      [...downstreamTreasuryActionIds].sort(),
    );
    if (downstreamTreasuryActionIds.length > 0) {
      expect(graph?.downstream.treasury.actions.every((action) => action.action.linkedRebalanceProposalId === actionable.id)).toBe(true);
    } else {
      expect(graph?.downstream.treasury.note).toBeTruthy();
    }
    expect(bundle.bundle.proposalId).toBe(actionable.id);
    expect(bundle.graph.detail.proposal.id).toBe(actionable.id);
    expect(bundle.bundle.totalChildCount).toBeGreaterThanOrEqual(bundle.bundle.completedChildCount);
    expect(bundle.bundle.interventionRecommendation).toBeTruthy();
  });

  it('rolls partial downstream application into a requires_intervention bundle recommendation', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const connection = await createDatabaseConnection(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });
    cleanups.push(async () => {
      await connection.close();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_rebalance_bundle_partial_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (proposal === null || treasurySummary === null) {
      throw new Error('Expected rebalance proposal and treasury summary.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'command-partial-bundle-1',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual partial bundle setup for runtime test.',
        outcome: {
          applied: true,
        },
        createdAt: new Date('2026-03-20T12:03:00.000Z'),
        startedAt: new Date('2026-03-20T12:03:01.000Z'),
        completedAt: new Date('2026-03-20T12:03:02.000Z'),
        updatedAt: new Date('2026-03-20T12:03:02.000Z'),
      })
      .returning();

    const [carryAction] = await connection.db
      .insert(carryActions)
      .values({
        strategyRunId: null,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'increase_carry_exposure',
        status: 'recommended',
        sourceKind: 'rebalance',
        sourceReference: proposal.id,
        opportunityId: null,
        asset: null,
        summary: 'Carry child remained blocked for bundle test.',
        notionalUsd: '150000.00',
        details: {},
        readiness: 'blocked',
        executable: false,
        blockedReasons: [{
          code: 'venue_execution_unsupported',
          category: 'venue_capability',
          message: 'Carry venue remains unsupported for execution.',
          operatorAction: 'Inspect venue readiness before retrying.',
          details: {},
        }],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        executionPlan: {},
        actorId: 'vitest',
        createdAt: new Date('2026-03-20T12:03:03.000Z'),
        updatedAt: new Date('2026-03-20T12:03:03.000Z'),
      })
      .returning();

    const [treasuryAction] = await connection.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: treasurySummary.treasuryRunId,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'rebalance_treasury_budget',
        status: 'completed',
        venueId: null,
        venueName: null,
        venueMode: 'reserve',
        amountUsd: '150000.00',
        reasonCode: 'rebalance_budget_application',
        summary: 'Treasury child completed for bundle test.',
        details: {
          rebalanceProposalId: proposal.id,
        },
        readiness: 'actionable',
        executable: true,
        blockedReasons: [],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        approvedBy: 'vitest',
        approvedAt: new Date('2026-03-20T12:03:04.000Z'),
        completedAt: new Date('2026-03-20T12:03:06.000Z'),
        actorId: 'vitest',
        createdAt: new Date('2026-03-20T12:03:04.000Z'),
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .returning();

    const [treasuryExecution] = await connection.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: treasuryAction.id,
        treasuryRunId: treasurySummary.treasuryRunId,
        commandId: 'command-partial-bundle-1',
        status: 'completed',
        executionMode: proposal.executionMode,
        venueMode: 'reserve',
        simulated: true,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        blockedReasons: [],
        outcomeSummary: 'Budget-state treasury application completed.',
        outcome: {
          executionKind: 'budget_state_application',
          rebalanceProposalId: proposal.id,
        },
        createdAt: new Date('2026-03-20T12:03:05.000Z'),
        startedAt: new Date('2026-03-20T12:03:05.000Z'),
        completedAt: new Date('2026-03-20T12:03:06.000Z'),
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .returning();

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution.id,
        linkedCommandId: 'command-partial-bundle-1',
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .where(eq(allocatorRebalanceProposals.id, proposal.id));

    await connection.db
      .update(treasuryActions)
      .set({
        latestExecutionId: treasuryExecution.id,
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .where(eq(treasuryActions.id, treasuryAction.id));

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: true,
          downstreamCarryActionIds: [carryAction.id],
          downstreamTreasuryActionIds: [treasuryAction.id],
        },
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .where(eq(allocatorRebalanceExecutions.id, rebalanceExecution.id));

    const proposalDetail = await controlPlane.getRebalanceProposal(proposal.id);
    if (proposalDetail === null) {
      throw new Error('Expected rebalance proposal detail.');
    }

    const bundle = await controlPlane.getRebalanceBundleForProposal(proposal.id);
    if (bundle === null) {
      throw new Error('Expected rebalance bundle detail.');
    }

    expect(bundle.bundle.status).toBe('requires_intervention');
    expect(bundle.bundle.outcomeClassification).toBe('partial_application');
    expect(bundle.bundle.interventionRecommendation).toBe('unresolved_partial_application');
    expect(bundle.bundle.completedChildCount).toBe(1);
    expect(bundle.bundle.blockedChildCount).toBe(1);
    expect(bundle.graph.downstream.carry.actions[0]?.action.id).toBe(carryAction.id);
    expect(bundle.graph.downstream.treasury.actions[0]?.executions[0]?.id).toBe(treasuryExecution.id);
    expect(proposalDetail.executions[0]?.id).toBe(rebalanceExecution.id);
  });

  it('evaluates and executes carry actions through the runtime command rail', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'carry-worker-test-cycle',
    });

    const evaluationCommand = await controlPlane.enqueueCarryEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_carry_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(evaluationCommand.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const action = await waitFor(
      async () => {
        const actions = await controlPlane.listCarryActions(20);
        return actions.find((item) => item.executable) ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (action === null) {
      throw new Error('Expected actionable carry action.');
    }

    const command = await controlPlane.approveCarryAction(action.id, 'vitest', 'operator');
    if (command === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const detail = await waitFor(
      () => controlPlane.getCarryAction(action.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.action.status === 'completed',
    );
    const executions = await controlPlane.listCarryExecutions(10);
    const executionDetail = await waitFor(
      () => controlPlane.getCarryExecution(String(detail?.executions[0]?.id)),
      (value): value is Exclude<typeof value, null> => value !== null && value.steps.length > 0,
    );
    if (executionDetail === null) {
      throw new Error('Expected carry execution detail.');
    }

    expect(completedCommand?.result['carryExecutionId']).toBeTruthy();
    expect(detail?.executions[0]?.status).toBe('completed');
    expect(detail?.executions[0]?.requestedBy).toBe('vitest');
    expect(executions.some((execution) => execution.carryActionId === action.id)).toBe(true);
    expect(executionDetail.execution.id).toBe(detail?.executions[0]?.id);
    expect(executionDetail.action?.id).toBe(action.id);
    expect(executionDetail.steps[0]?.intentId).toBeTruthy();
    expect(executionDetail.steps[0]?.executionReference).toBeTruthy();
    expect(executionDetail.timeline.some((entry) => entry.linkedExecutionId === executionDetail.execution.id)).toBe(true);
  });

  it('approves and executes treasury actions with durable execution history', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const evaluationCommand = await controlPlane.enqueueTreasuryEvaluation('vitest');
    await waitFor(
      async () => controlPlane.getCommand(evaluationCommand.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const action = await waitFor(
      async () => {
        const actions = await controlPlane.listTreasuryActions(20);
        return actions.find((item) => item.executable) ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (action === null) {
      throw new Error('Expected actionable treasury action.');
    }

    const approved = await controlPlane.approveTreasuryAction(action.id, 'vitest', 'operator');
    expect(approved?.status).toBe('approved');

    const command = await controlPlane.enqueueTreasuryActionExecution(action.id, 'vitest', 'operator');
    if (command === null) {
      throw new Error('Expected treasury execution command to be queued.');
    }

    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const detail = await waitFor(
      () => controlPlane.getTreasuryAction(action.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.action.status === 'completed',
    );
    const executions = await controlPlane.listTreasuryExecutions(10);

    expect(completedCommand?.result['treasuryExecutionId']).toBeTruthy();
    expect(detail?.executions[0]?.status).toBe('completed');
    expect(detail?.executions[0]?.venueExecutionReference).toBeTruthy();
    expect(executions.some((execution) => execution.treasuryActionId === action.id)).toBe(true);
  });

  it('persists blocked treasury execution attempts with durable reasons', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });
    const connection = await createDatabaseConnection(connectionString);

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const evaluationCommand = await controlPlane.enqueueTreasuryEvaluation('vitest');
    await waitFor(
      async () => controlPlane.getCommand(evaluationCommand.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const action = await waitFor(
      async () => {
        const actions = await controlPlane.listTreasuryActions(20);
        return actions.find((item) => item.executable) ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (action === null) {
      throw new Error('Expected actionable treasury action.');
    }

    await controlPlane.approveTreasuryAction(action.id, 'vitest', 'operator');
    await connection.db
      .update(treasuryActions)
      .set({
        amountUsd: '999999.99',
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, action.id));

    const command = await controlPlane.enqueueTreasuryActionExecution(action.id, 'vitest', 'operator');
    if (command === null) {
      throw new Error('Expected treasury execution command to be queued.');
    }

    const failedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'failed',
    );
    const detail = await waitFor(
      () => controlPlane.getTreasuryAction(action.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.action.status === 'failed',
    );

    expect(failedCommand?.errorMessage).toBeTruthy();
    expect(detail?.executions[0]?.status).toBe('failed');
    expect(detail?.executions[0]?.blockedReasons.length).toBeGreaterThan(0);
  });

  it('rejects duplicate in-flight remediation and reopens the mismatch when a remediation command fails', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 500,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('phase-1-8-remediation-failure-setup', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-8-remediation-failure-setup',
    });
    await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );

    const mismatch = await waitFor(
      async () => {
        const mismatches = await controlPlane.listMismatches(20);
        return mismatches.find((item) => item.category === 'recovery_action_failure') ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (mismatch === null) {
      throw new Error('Expected mismatch to exist');
    }

    await controlPlane.resume('phase-1-8-remediation-failure-ready', 'vitest');

    const remediation = await controlPlane.remediateMismatch({
      mismatchId: mismatch.id,
      actorId: 'vitest',
      remediationType: 'run_cycle',
      summary: 'attempt one safe remediation cycle',
    });
    expect(remediation.status).toBe('requested');

    await expect(
      controlPlane.remediateMismatch({
        mismatchId: mismatch.id,
        actorId: 'vitest',
        remediationType: 'rebuild_projections',
        summary: 'duplicate in-flight remediation should reject',
      }),
    ).rejects.toThrow('already has remediation');

    await controlPlane.activateKillSwitch('phase-1-8-remediation-failure-trigger', 'vitest');

    const failedRemediation = await waitFor(
      async () => controlPlane.getLatestMismatchRemediation(mismatch.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'failed',
      7000,
    );
    if (failedRemediation === null) {
      throw new Error('Expected remediation to fail');
    }

    expect(failedRemediation.command?.status).toBe('failed');
    expect(failedRemediation.latestRecoveryEvent?.eventType).toBe('mismatch_remediation_failed');

    const detail = await waitFor(
      async () => controlPlane.getMismatchDetail(mismatch.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.mismatch.status === 'reopened',
      7000,
    );
    if (detail === null) {
      throw new Error('Expected mismatch detail to exist');
    }

    expect(detail.mismatch.linkedCommandId).toBe(remediation.commandId);
    expect(detail.latestRemediation?.status).toBe('failed');
    expect(detail.remediationInFlight).toBe(false);
    expect(detail.isActionable).toBe(true);
    expect(detail.recoveryEvents.some((event) => event.eventType === 'mismatch_remediation_failed')).toBe(true);
  });

  it('persists reconciliation runs and findings, creates reconciliation-driven mismatches, and preserves remediation linkage', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 25,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const cycleCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-9-seed-cycle',
    });
    const completedCycle = await waitFor(
      async () => controlPlane.getCommand(cycleCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    expect(completedCycle?.result['runId']).toBeTruthy();

    const positions = await controlPlane.listPositions(20);
    expect(positions.length).toBeGreaterThan(0);

    const connection = await createDatabaseConnection(connectionString);
    const positionId = positions[0]?.id;
    if (positionId === undefined) {
      throw new Error('Expected at least one position to exist');
    }

    await connection.execute(`
      UPDATE positions
      SET size = '999', updated_at = NOW()
      WHERE id = '${positionId.replace(/'/g, "''")}';
    `);

    const reconciliationCommand = await controlPlane.enqueueReconciliationRun('vitest', {
      trigger: 'phase-1-9-manual-reconciliation',
      triggerReference: positionId,
      triggeredBy: 'vitest',
    });
    const completedReconciliationCommand = await waitFor(
      async () => controlPlane.getCommand(reconciliationCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    const reconciliationRunId = completedReconciliationCommand?.result['reconciliationRunId'];
    expect(typeof reconciliationRunId).toBe('string');

    const reconciliationRun = await waitFor(
      async () => controlPlane.getReconciliationRun(String(reconciliationRunId)),
      (run): run is Exclude<typeof run, null> => run !== null && run.status === 'completed',
    );
    if (reconciliationRun === null) {
      throw new Error('Expected reconciliation run to complete');
    }
    expect(reconciliationRun.findingCount).toBeGreaterThan(0);

    const findings = await controlPlane.listReconciliationFindings({
      findingType: 'position_exposure_mismatch',
      limit: 20,
    });
    const finding = findings.find((item) => item.entityId === positions[0]?.asset);
    expect(finding).toBeTruthy();
    expect(finding?.status).toBe('active');
    expect(finding?.mismatchId).toBeTruthy();

    const mismatchDetail = await controlPlane.getMismatchDetail(String(finding?.mismatchId));
    expect(mismatchDetail?.mismatch.sourceKind).toBe('reconciliation');
    expect(mismatchDetail?.reconciliationFindings.length).toBeGreaterThan(0);
    expect(mismatchDetail?.latestReconciliationFinding?.findingType).toBe('position_exposure_mismatch');
    expect(mismatchDetail?.recommendedRemediationTypes).toContain('rebuild_projections');

    const remediation = await controlPlane.remediateMismatch({
      mismatchId: String(finding?.mismatchId),
      actorId: 'vitest',
      remediationType: 'rebuild_projections',
      summary: 'repair projected positions from durable state',
    });
    expect(remediation.commandId).toBeTruthy();

    await waitFor(
      async () => controlPlane.getLatestMismatchRemediation(String(finding?.mismatchId)),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const resolvedMismatch = await waitFor(
      async () => controlPlane.getMismatchDetail(String(finding?.mismatchId)),
      (detail): detail is Exclude<typeof detail, null> => detail !== null && detail.mismatch.status === 'resolved',
    );
    if (resolvedMismatch === null) {
      throw new Error('Expected mismatch to resolve after remediation');
    }

    expect(resolvedMismatch.latestRemediation?.status).toBe('completed');
    expect(resolvedMismatch.reconciliationFindings.some((item) => item.status === 'resolved')).toBe(true);
  });
});
