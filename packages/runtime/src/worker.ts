import os from 'node:os';

import {
  applyMigrations,
  createDatabaseConnection,
} from '@sentinel-apex/db';

import { remediationFailureNextStatus } from './mismatch-lifecycle.js';
import { SentinelRuntime, type DeterministicRuntimeScenario } from './runtime.js';
import { DatabaseAuditWriter, RuntimeStore } from './store.js';

import type {
  RuntimeCommandView,
  RuntimeRemediationActionType,
  WorkerStatusView,
} from './types.js';

export interface RuntimeWorkerOptions {
  workerId?: string;
  cycleIntervalMs: number;
  pollIntervalMs?: number;
}

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('PGlite is closed');
}

interface RemediationContext {
  mismatchId: string;
  remediationType: RuntimeRemediationActionType;
  requestedBy: string | null;
}

function getRemediationContext(command: RuntimeCommandView): RemediationContext | null {
  const raw = command.payload['remediation'];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const remediation = raw as Record<string, unknown>;
  const mismatchId = remediation['mismatchId'];
  const remediationType = remediation['remediationType'];
  const requestedBy = remediation['requestedBy'];
  if (
    typeof mismatchId !== 'string'
    || (remediationType !== 'run_cycle' && remediationType !== 'rebuild_projections')
  ) {
    return null;
  }

  return {
    mismatchId,
    remediationType,
    requestedBy: typeof requestedBy === 'string' ? requestedBy : null,
  };
}

export class RuntimeWorker {
  private readonly workerId: string;
  private readonly pollIntervalMs: number;
  private nextScheduledRunAt: Date;
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly store: RuntimeStore,
    private readonly runtime: SentinelRuntime,
    private readonly options: RuntimeWorkerOptions,
  ) {
    this.workerId = options.workerId ?? `runtime-worker-${process.pid}`;
    this.pollIntervalMs = options.pollIntervalMs ?? Math.min(options.cycleIntervalMs, 1000);
    this.nextScheduledRunAt = new Date(Date.now() + options.cycleIntervalMs);
  }

  static async createDeterministic(
    connectionString: string,
    runtimeOverrides: DeterministicRuntimeScenario = {},
    options: RuntimeWorkerOptions,
  ): Promise<RuntimeWorker> {
    const connection = await createDatabaseConnection(connectionString);
    await applyMigrations(connection);
    const auditWriter = new DatabaseAuditWriter(connection.db);
    const store = new RuntimeStore(connection.db, auditWriter);
    const runtime = await SentinelRuntime.createDeterministic(connectionString, runtimeOverrides);
    await store.ensureWorkerState(options.workerId ?? `runtime-worker-${process.pid}`, options.cycleIntervalMs);
    return new RuntimeWorker(store, runtime, options);
  }

  async start(): Promise<WorkerStatusView> {
    this.stopping = false;
    this.nextScheduledRunAt = new Date(Date.now() + this.options.cycleIntervalMs);

    await this.store.ensureWorkerState(this.workerId, this.options.cycleIntervalMs);
    await this.store.updateWorkerStatus({
      workerId: this.workerId,
      lifecycleState: 'starting',
      schedulerState: 'waiting',
      cycleIntervalMs: this.options.cycleIntervalMs,
      processId: process.pid,
      hostname: os.hostname(),
      lastStartedAt: new Date(),
      lastStoppedAt: null,
      lastFailureAt: null,
      lastFailureReason: null,
      lastHeartbeatAt: new Date(),
      nextScheduledRunAt: this.nextScheduledRunAt,
    });

    await this.store.recordRecoveryEvent({
      eventType: 'worker_started',
      status: 'ready',
      sourceComponent: 'runtime-worker',
      actorId: this.workerId,
      message: 'Runtime worker started.',
      details: {
        cycleIntervalMs: this.options.cycleIntervalMs,
      },
    });

    await this.store.updateWorkerStatus({
      lifecycleState: 'ready',
      schedulerState: 'waiting',
      lastHeartbeatAt: new Date(),
      nextScheduledRunAt: this.nextScheduledRunAt,
    });

    this.scheduleNextTick();
    return this.store.getWorkerStatus();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      await this.store.updateWorkerStatus({
        lifecycleState: 'stopping',
        schedulerState: 'idle',
        nextScheduledRunAt: null,
        lastHeartbeatAt: new Date(),
      });

      await this.inFlight;

      await this.store.updateWorkerStatus({
        lifecycleState: 'stopped',
        schedulerState: 'idle',
        currentOperation: null,
        currentCommandId: null,
        currentRunId: null,
        nextScheduledRunAt: null,
        lastStoppedAt: new Date(),
        lastHeartbeatAt: new Date(),
      });

      await this.store.recordRecoveryEvent({
        eventType: 'worker_stopped',
        status: 'resolved',
        sourceComponent: 'runtime-worker',
        actorId: this.workerId,
        message: 'Runtime worker stopped cleanly.',
      });
    } catch (error) {
      if (!isClosedDatabaseError(error)) {
        throw error;
      }
    }

    try {
      await this.runtime.close();
    } catch (error) {
      if (!isClosedDatabaseError(error)) {
        throw error;
      }
    }
  }

  async getWorkerStatus(): Promise<WorkerStatusView> {
    return this.store.getWorkerStatus();
  }

  private scheduleNextTick(): void {
    if (this.stopping) {
      return;
    }

    this.timer = setTimeout(() => {
      this.inFlight = this.tick().finally(() => {
        this.inFlight = null;
        this.scheduleNextTick();
      });
    }, this.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    if (this.stopping) {
      return;
    }

    await this.store.updateWorkerStatus({
      lifecycleState: 'ready',
      lastHeartbeatAt: new Date(),
      nextScheduledRunAt: this.nextScheduledRunAt,
    });

    const command = await this.store.claimNextPendingCommand(this.workerId);
    if (command !== null) {
      await this.executeCommand(command);
      this.nextScheduledRunAt = new Date(Date.now() + this.options.cycleIntervalMs);
      return;
    }

    const runtimeStatus = await this.store.getRuntimeStatus();
    if (runtimeStatus.halted || runtimeStatus.lifecycleState === 'paused') {
      await this.store.updateWorkerStatus({
        schedulerState: 'paused',
        currentOperation: null,
        currentCommandId: null,
        currentRunId: null,
        nextScheduledRunAt: null,
      });
      return;
    }

    const now = Date.now();
    if (now >= this.nextScheduledRunAt.getTime()) {
      await this.executeScheduledCycle();
      this.nextScheduledRunAt = new Date(Date.now() + this.options.cycleIntervalMs);
      return;
    }

    await this.store.updateWorkerStatus({
      schedulerState: 'waiting',
      currentOperation: null,
      currentCommandId: null,
      currentRunId: null,
      nextScheduledRunAt: this.nextScheduledRunAt,
    });
  }

  private async executeScheduledCycle(): Promise<void> {
    await this.store.updateWorkerStatus({
      schedulerState: 'running',
      currentOperation: 'scheduled_cycle',
      currentCommandId: null,
      currentRunId: null,
      lastRunStartedAt: new Date(),
      nextScheduledRunAt: null,
    });

    try {
      const result = await this.runtime.runCycle('worker-scheduled-cycle');
      await this.store.updateWorkerStatus({
        schedulerState: 'waiting',
        currentOperation: null,
        currentRunId: result.runId,
        lastRunCompletedAt: new Date(),
        lastSuccessAt: new Date(),
        lastFailureAt: null,
        lastFailureReason: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.updateWorkerStatus({
        lifecycleState: 'degraded',
        schedulerState: 'waiting',
        currentOperation: null,
        lastRunCompletedAt: new Date(),
        lastFailureAt: new Date(),
        lastFailureReason: message,
      });
    }
  }

  private async executeCommand(command: RuntimeCommandView): Promise<void> {
    const remediation = getRemediationContext(command);

    await this.store.updateWorkerStatus({
      schedulerState: 'running',
      currentOperation: command.commandType,
      currentCommandId: command.commandId,
      currentRunId: null,
      lastHeartbeatAt: new Date(),
      nextScheduledRunAt: null,
    });

    const startedEvent = await this.store.recordRecoveryEvent({
      mismatchId: remediation?.mismatchId ?? null,
      commandId: command.commandId,
      eventType: 'runtime_command_started',
      status: 'running',
      sourceComponent: 'runtime-worker',
      actorId: this.workerId,
      message: `Runtime command ${command.commandType} started.`,
      details: command.payload,
    });

    if (remediation !== null) {
      const remediationAttempt = await this.store.getMismatchRemediationByCommandId(command.commandId);
      if (remediationAttempt !== null) {
        await this.store.updateMismatchRemediationById(remediationAttempt.id, {
          status: 'running',
          startedAt: new Date(),
          latestRecoveryEventId: startedEvent.id,
        });
        await this.store.updateMismatchById(remediation.mismatchId, {
          linkedCommandId: command.commandId,
          linkedRecoveryEventId: startedEvent.id,
        });
      }
    }

    try {
      if (command.commandType === 'run_cycle') {
        const result = await this.runtime.runCycle(
          typeof command.payload['triggerSource'] === 'string'
            ? String(command.payload['triggerSource'])
            : 'worker-command-cycle',
        );

        await this.store.completeRuntimeCommand(command.commandId, {
          ...result,
        });
        await this.store.updateWorkerStatus({
          schedulerState: 'waiting',
          currentOperation: null,
          currentCommandId: null,
          currentRunId: result.runId,
          lastRunStartedAt: new Date(),
          lastRunCompletedAt: new Date(),
          lastSuccessAt: new Date(),
          lastFailureAt: null,
          lastFailureReason: null,
        });
        const completedEvent = await this.store.recordRecoveryEvent({
          mismatchId: remediation?.mismatchId ?? null,
          commandId: command.commandId,
          runId: result.runId,
          eventType: 'runtime_command_completed',
          status: 'completed',
          sourceComponent: 'runtime-worker',
          actorId: this.workerId,
          message: 'Runtime cycle command completed.',
          details: {
            runId: result.runId,
          },
        });

        if (remediation !== null) {
          const remediationAttempt = await this.store.getMismatchRemediationByCommandId(command.commandId);
          if (remediationAttempt !== null) {
            await this.store.updateMismatchRemediationById(remediationAttempt.id, {
              status: 'completed',
              completedAt: new Date(),
              outcomeSummary: `Remediation ${remediation.remediationType} completed successfully.`,
              latestRecoveryEventId: completedEvent.id,
            });
            await this.store.updateMismatchById(remediation.mismatchId, {
              linkedCommandId: command.commandId,
              linkedRecoveryEventId: completedEvent.id,
            });
          }
        }
        return;
      }

      if (command.commandType === 'run_reconciliation') {
        const reconciliationRun = await this.runtime.runReconciliation({
          trigger: typeof command.payload['trigger'] === 'string'
            ? String(command.payload['trigger'])
            : 'manual_reconciliation',
          sourceComponent: 'runtime-worker',
          triggerReference: typeof command.payload['triggerReference'] === 'string'
            ? String(command.payload['triggerReference'])
            : null,
          triggeredBy: typeof command.payload['triggeredBy'] === 'string'
            ? String(command.payload['triggeredBy'])
            : null,
        });

        await this.store.completeRuntimeCommand(command.commandId, {
          reconciliationRunId: reconciliationRun.id,
          reconciliationRunStatus: reconciliationRun.status,
          findingCount: reconciliationRun.findingCount,
          linkedMismatchCount: reconciliationRun.linkedMismatchCount,
        });
        await this.store.updateWorkerStatus({
          schedulerState: 'waiting',
          currentOperation: null,
          currentCommandId: null,
          lastSuccessAt: new Date(),
          lastFailureAt: null,
          lastFailureReason: null,
        });
        await this.store.recordRecoveryEvent({
          mismatchId: remediation?.mismatchId ?? null,
          commandId: command.commandId,
          eventType: 'runtime_command_completed',
          status: 'completed',
          sourceComponent: 'runtime-worker',
          actorId: this.workerId,
          message: 'Reconciliation command completed.',
          details: {
            reconciliationRunId: reconciliationRun.id,
            findingCount: reconciliationRun.findingCount,
          },
        });
        return;
      }

      if (command.commandType === 'run_treasury_evaluation') {
        const treasurySummary = await this.runtime.runTreasuryEvaluation({
          actorId: typeof command.payload['actorId'] === 'string'
            ? String(command.payload['actorId'])
            : command.requestedBy,
          sourceRunId: typeof command.payload['sourceRunId'] === 'string'
            ? String(command.payload['sourceRunId'])
            : null,
        });

        await this.store.completeRuntimeCommand(command.commandId, {
          treasuryRunId: treasurySummary.treasuryRunId,
          actionCount: treasurySummary.actionCount,
          simulated: treasurySummary.simulated,
          reserveShortfallUsd: treasurySummary.reserveStatus.reserveShortfallUsd,
          surplusCapitalUsd: treasurySummary.reserveStatus.surplusCapitalUsd,
        });
        await this.store.updateWorkerStatus({
          schedulerState: 'waiting',
          currentOperation: null,
          currentCommandId: null,
          lastSuccessAt: new Date(),
          lastFailureAt: null,
          lastFailureReason: null,
        });
        await this.store.recordRecoveryEvent({
          mismatchId: remediation?.mismatchId ?? null,
          commandId: command.commandId,
          eventType: 'runtime_command_completed',
          status: 'completed',
          sourceComponent: 'runtime-worker',
          actorId: this.workerId,
          message: 'Treasury evaluation command completed.',
          details: {
            treasuryRunId: treasurySummary.treasuryRunId,
            actionCount: treasurySummary.actionCount,
          },
        });
        return;
      }

      if (command.commandType === 'execute_treasury_action') {
        const treasuryActionId = typeof command.payload['treasuryActionId'] === 'string'
          ? String(command.payload['treasuryActionId'])
          : null;
        if (treasuryActionId === null) {
          throw new Error('Treasury action execution command is missing treasuryActionId.');
        }

        const outcome = await this.runtime.executeTreasuryAction({
          actionId: treasuryActionId,
          actorId: typeof command.payload['actorId'] === 'string'
            ? String(command.payload['actorId'])
            : command.requestedBy,
          commandId: command.commandId,
          startedBy: this.workerId,
        });

        await this.store.completeRuntimeCommand(command.commandId, {
          treasuryActionId: outcome.actionId,
          treasuryExecutionId: outcome.executionId,
          treasuryRunId: outcome.treasuryRunId,
          venueExecutionReference: outcome.venueExecutionReference,
          simulated: outcome.simulated,
        });
        await this.store.updateWorkerStatus({
          schedulerState: 'waiting',
          currentOperation: null,
          currentCommandId: null,
          lastSuccessAt: new Date(),
          lastFailureAt: null,
          lastFailureReason: null,
        });
        await this.store.recordRecoveryEvent({
          mismatchId: remediation?.mismatchId ?? null,
          commandId: command.commandId,
          eventType: 'runtime_command_completed',
          status: 'completed',
          sourceComponent: 'runtime-worker',
          actorId: this.workerId,
          message: 'Treasury action execution completed.',
          details: {
            treasuryActionId: outcome.actionId,
            treasuryExecutionId: outcome.executionId,
          },
        });
        return;
      }

      const status = await this.runtime.rebuildProjections('runtime-worker-command');
      await this.store.completeRuntimeCommand(command.commandId, {
        projectionStatus: status.projectionStatus,
        lifecycleState: status.lifecycleState,
        lastProjectionSourceRunId: status.lastProjectionSourceRunId,
      });
      await this.store.updateWorkerStatus({
        schedulerState: 'waiting',
        currentOperation: null,
        currentCommandId: null,
        lastSuccessAt: new Date(),
        lastFailureAt: null,
        lastFailureReason: null,
      });
      const completedEvent = await this.store.recordRecoveryEvent({
        mismatchId: remediation?.mismatchId ?? null,
        commandId: command.commandId,
        eventType: 'runtime_command_completed',
        status: 'completed',
        sourceComponent: 'runtime-worker',
        actorId: this.workerId,
        message: 'Projection rebuild command completed.',
        details: {
          lastProjectionSourceRunId: status.lastProjectionSourceRunId,
        },
      });

      if (remediation !== null) {
        const remediationAttempt = await this.store.getMismatchRemediationByCommandId(command.commandId);
        if (remediationAttempt !== null) {
          await this.store.updateMismatchRemediationById(remediationAttempt.id, {
            status: 'completed',
            completedAt: new Date(),
            outcomeSummary: `Remediation ${remediation.remediationType} completed successfully.`,
            latestRecoveryEventId: completedEvent.id,
          });
          await this.store.updateMismatchById(remediation.mismatchId, {
            linkedCommandId: command.commandId,
            linkedRecoveryEventId: completedEvent.id,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.store.failRuntimeCommand(command.commandId, message);

      if (remediation !== null) {
        const remediationAttempt = await this.store.getMismatchRemediationByCommandId(command.commandId);
        const mismatch = await this.store.getMismatchById(remediation.mismatchId);
        const nextStatus = mismatch === null ? 'reopened' : remediationFailureNextStatus(mismatch.status);
        const failedEvent = await this.store.recordRecoveryEvent({
          mismatchId: remediation.mismatchId,
          commandId: command.commandId,
          eventType: 'mismatch_remediation_failed',
          status: nextStatus,
          sourceComponent: 'runtime-worker',
          actorId: this.workerId,
          message,
          details: {
            remediationId: remediationAttempt?.id ?? null,
            remediationType: remediation.remediationType,
          },
        });
        if (remediationAttempt !== null) {
          await this.store.updateMismatchRemediationById(remediationAttempt.id, {
            status: 'failed',
            failedAt: new Date(),
            outcomeSummary: message,
            latestRecoveryEventId: failedEvent.id,
          });
        }
        if (mismatch !== null) {
          await this.store.updateMismatchById(remediation.mismatchId, {
            status: nextStatus,
            linkedCommandId: command.commandId,
            linkedRecoveryEventId: failedEvent.id,
            reopenedAt: new Date(),
            reopenedBy: this.workerId,
            reopenSummary: message,
            lastStatusChangeAt: new Date(),
          });
        }
      } else {
        const { mismatch, outcome } = await this.store.upsertMismatch({
          dedupeKey: `runtime_command_failure:${command.commandId}`,
          category: 'recovery_action_failure',
          severity: 'medium',
          sourceComponent: 'runtime-worker',
          entityType: 'runtime_command',
          entityId: command.commandId,
          summary: message,
          details: {
            commandType: command.commandType,
            commandId: command.commandId,
          },
          detectedAt: new Date(),
        });
        await this.store.recordRecoveryEvent({
          mismatchId: mismatch.id,
          commandId: command.commandId,
          eventType: outcome === 'reopened' ? 'runtime_command_failure_reopened' : 'runtime_command_failed',
          status: mismatch.status,
          sourceComponent: 'runtime-worker',
          actorId: this.workerId,
          message,
        });
      }

      await this.store.updateWorkerStatus({
        lifecycleState: 'degraded',
        schedulerState: 'waiting',
        currentOperation: null,
        currentCommandId: null,
        lastFailureAt: new Date(),
        lastFailureReason: message,
      });
    }
  }
}
