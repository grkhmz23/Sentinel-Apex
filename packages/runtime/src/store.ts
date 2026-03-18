import { and, desc, eq, sql } from 'drizzle-orm';

import {
  auditEvents,
  executionEvents,
  fills,
  orders,
  portfolioCurrent,
  portfolioSnapshots,
  positions,
  riskCurrent,
  riskBreaches,
  riskSnapshots,
  runtimeCommands,
  runtimeMismatches,
  runtimeRecoveryEvents,
  runtimeState,
  runtimeWorkerState,
  strategyIntents,
  strategyOpportunities,
  strategyRuns,
  type Database,
} from '@sentinel-apex/db';
import type { OrderFill, OrderIntent, OrderStatus , RiskAssessment } from '@sentinel-apex/domain';
import type { OrderRecord, OrderStore } from '@sentinel-apex/execution';
import type { AuditEvent, AuditWriter } from '@sentinel-apex/observability';
import type { PortfolioState, RiskSummary } from '@sentinel-apex/risk-engine';

import type {
  AuditEventView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  ProjectionStatus,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RiskBreachView,
  RuntimeCommandStatus,
  RuntimeCommandType,
  RuntimeCommandView,
  RuntimeLifecycleState,
  RuntimeMismatchStatus,
  RuntimeMismatchView,
  RuntimeRecoveryEventView,
  RiskSummaryView,
  RuntimeStatusView,
  WorkerLifecycleState,
  WorkerSchedulerState,
  WorkerStatusView,
} from './types.js';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serialiseMap(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map.entries());
}

function asJsonObject(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function extractSleeveId(intent: OrderIntent): string {
  const raw = intent.metadata['sleeveId'];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`Order intent "${intent.intentId}" is missing metadata.sleeveId`);
  }
  return raw;
}

export class DatabaseAuditWriter implements AuditWriter {
  constructor(private readonly db: Database) {}

  async write(event: AuditEvent): Promise<void> {
    await this.db
      .insert(auditEvents)
      .values({
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt),
        actorType: event.actorType,
        actorId: event.actorId,
        sleeveId: event.sleeveId ?? null,
        correlationId: event.correlationId ?? null,
        data: asRecord(event.data),
      })
      .onConflictDoNothing({
        target: auditEvents.eventId,
      });
  }
}

export class RuntimeOrderStore implements OrderStore {
  constructor(private readonly db: Database) {}

  async save(record: OrderRecord): Promise<void> {
    await this.db
      .insert(orders)
      .values({
        clientOrderId: record.intent.intentId,
        strategyRunId: typeof record.intent.metadata['runId'] === 'string'
          ? record.intent.metadata['runId']
          : null,
        sleeveId: extractSleeveId(record.intent),
        opportunityId: record.intent.opportunityId,
        venueId: record.intent.venueId,
        venueOrderId: record.venueOrderId,
        asset: record.intent.asset,
        side: record.intent.side,
        orderType: record.intent.type,
        executionMode: typeof record.intent.metadata['executionMode'] === 'string'
          ? String(record.intent.metadata['executionMode'])
          : 'dry-run',
        reduceOnly: record.intent.reduceOnly,
        requestedSize: record.intent.size,
        requestedPrice: record.intent.limitPrice,
        filledSize: record.filledSize,
        averageFillPrice: record.averageFillPrice,
        status: record.status,
        attemptCount: record.attemptCount,
        lastError: record.lastError,
        metadata: asRecord(record.intent.metadata),
        submittedAt: record.submittedAt,
        completedAt: record.completedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: orders.clientOrderId,
        set: {
          strategyRunId: typeof record.intent.metadata['runId'] === 'string'
            ? String(record.intent.metadata['runId'])
            : null,
          sleeveId: extractSleeveId(record.intent),
          opportunityId: record.intent.opportunityId,
          venueId: record.intent.venueId,
          venueOrderId: record.venueOrderId,
          asset: record.intent.asset,
          side: record.intent.side,
          orderType: record.intent.type,
          executionMode: typeof record.intent.metadata['executionMode'] === 'string'
            ? String(record.intent.metadata['executionMode'])
            : 'dry-run',
          reduceOnly: record.intent.reduceOnly,
          requestedSize: record.intent.size,
          requestedPrice: record.intent.limitPrice,
          filledSize: record.filledSize,
          averageFillPrice: record.averageFillPrice,
          status: record.status,
          attemptCount: record.attemptCount,
          lastError: record.lastError,
          metadata: asRecord(record.intent.metadata),
          submittedAt: record.submittedAt,
          completedAt: record.completedAt,
          updatedAt: new Date(),
        },
      });
  }

  async getByClientId(clientOrderId: string): Promise<OrderRecord | null> {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.clientOrderId, clientOrderId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const fillRows = await this.db
      .select()
      .from(fills)
      .where(eq(fills.clientOrderId, clientOrderId))
      .orderBy(desc(fills.filledAt));

    return {
      intent: {
        intentId: row.clientOrderId,
        venueId: row.venueId,
        asset: row.asset,
        side: row.side as OrderIntent['side'],
        type: row.orderType as OrderIntent['type'],
        size: row.requestedSize,
        limitPrice: row.requestedPrice,
        opportunityId: row.opportunityId as OrderIntent['opportunityId'],
        reduceOnly: row.reduceOnly,
        createdAt: row.createdAt,
        metadata: asRecord(row.metadata),
      },
      status: row.status as OrderStatus,
      venueOrderId: row.venueOrderId,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice,
      feesPaid: fillRows[0]?.fee ?? null,
      fills: fillRows.map((fillRow): OrderFill => ({
        fillId: fillRow.fillId ?? fillRow.id,
        orderId: row.clientOrderId as OrderFill['orderId'],
        filledSize: fillRow.size,
        fillPrice: fillRow.price,
        fee: fillRow.fee,
        feeAsset: (fillRow.feeAsset ?? row.asset),
        filledAt: fillRow.filledAt,
      })),
      submittedAt: row.submittedAt,
      completedAt: row.completedAt,
      lastError: row.lastError,
      attemptCount: row.attemptCount,
    };
  }

  async updateStatus(
    clientOrderId: string,
    status: OrderStatus,
    updates: Partial<OrderRecord> = {},
  ): Promise<void> {
    const existing = await this.getByClientId(clientOrderId);

    if (existing === null) {
      throw new Error(`RuntimeOrderStore.updateStatus: unknown order "${clientOrderId}"`);
    }

    const merged: OrderRecord = {
      ...existing,
      ...updates,
      status,
      fills: updates.fills ?? existing.fills,
    };

    await this.save(merged);
  }

  async listByStatus(status: OrderStatus): Promise<OrderRecord[]> {
    const rows = await this.db
      .select({
        clientOrderId: orders.clientOrderId,
      })
      .from(orders)
      .where(eq(orders.status, status));

    const result: OrderRecord[] = [];

    for (const row of rows) {
      const record = await this.getByClientId(row.clientOrderId);
      if (record !== null) {
        result.push(record);
      }
    }

    return result;
  }
}

export class RuntimeStore {
  constructor(
    readonly db: Database,
    readonly auditWriter: DatabaseAuditWriter,
  ) {}

  async ensureRuntimeState(
    executionMode: 'dry-run' | 'live',
    liveExecutionEnabled: boolean,
    riskLimits: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .insert(runtimeState)
      .values({
        id: 'primary',
        executionMode,
        liveExecutionEnabled,
        riskLimits,
        halted: false,
        lifecycleState: 'starting',
        projectionStatus: 'stale',
        startedAt: now,
        lastUpdatedBy: 'runtime-bootstrap',
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: runtimeState.id,
      });
  }

  async getRuntimeStatus(): Promise<RuntimeStatusView> {
    const [row] = await this.db
      .select()
      .from(runtimeState)
      .where(eq(runtimeState.id, 'primary'))
      .limit(1);

    if (row === undefined) {
      return {
        executionMode: 'dry-run',
        liveExecutionEnabled: false,
        riskLimits: {},
        halted: false,
        lifecycleState: 'stopped',
        projectionStatus: 'stale',
        lastRunId: null,
        lastRunStatus: null,
        lastSuccessfulRunId: null,
        lastCycleStartedAt: null,
        lastCycleCompletedAt: null,
        lastProjectionRebuildAt: null,
        lastProjectionSourceRunId: null,
        startedAt: null,
        readyAt: null,
        stoppedAt: null,
        lastError: null,
        reason: null,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return {
      executionMode: row.executionMode as 'dry-run' | 'live',
      liveExecutionEnabled: row.liveExecutionEnabled,
      riskLimits: asJsonObject(row.riskLimits),
      halted: row.halted,
      lifecycleState: row.lifecycleState as RuntimeLifecycleState,
      projectionStatus: row.projectionStatus as ProjectionStatus,
      lastRunId: row.lastRunId ?? null,
      lastRunStatus: row.lastRunStatus ?? null,
      lastSuccessfulRunId: row.lastSuccessfulRunId ?? null,
      lastCycleStartedAt: toIsoString(row.lastCycleStartedAt),
      lastCycleCompletedAt: toIsoString(row.lastCycleCompletedAt),
      lastProjectionRebuildAt: toIsoString(row.lastProjectionRebuildAt),
      lastProjectionSourceRunId: row.lastProjectionSourceRunId ?? null,
      startedAt: toIsoString(row.startedAt),
      readyAt: toIsoString(row.readyAt),
      stoppedAt: toIsoString(row.stoppedAt),
      lastError: row.lastError ?? null,
      reason: row.reason ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateRuntimeStatus(
    patch: {
      executionMode?: 'dry-run' | 'live';
      liveExecutionEnabled?: boolean;
      riskLimits?: Record<string, unknown>;
      halted?: boolean;
      lifecycleState?: RuntimeLifecycleState;
      projectionStatus?: ProjectionStatus;
      lastRunId?: string | null;
      lastRunStatus?: string | null;
      lastSuccessfulRunId?: string | null;
      lastCycleStartedAt?: Date | null;
      lastCycleCompletedAt?: Date | null;
      lastProjectionRebuildAt?: Date | null;
      lastProjectionSourceRunId?: string | null;
      startedAt?: Date | null;
      readyAt?: Date | null;
      stoppedAt?: Date | null;
      lastError?: string | null;
      reason?: string | null;
      lastUpdatedBy: string;
    },
  ): Promise<void> {
    await this.db
      .update(runtimeState)
      .set({
        ...(patch.executionMode !== undefined ? { executionMode: patch.executionMode } : {}),
        ...(patch.liveExecutionEnabled !== undefined
          ? { liveExecutionEnabled: patch.liveExecutionEnabled }
          : {}),
        ...(patch.riskLimits !== undefined ? { riskLimits: patch.riskLimits } : {}),
        ...(patch.halted !== undefined ? { halted: patch.halted } : {}),
        ...(patch.lifecycleState !== undefined ? { lifecycleState: patch.lifecycleState } : {}),
        ...(patch.projectionStatus !== undefined ? { projectionStatus: patch.projectionStatus } : {}),
        ...(patch.lastRunId !== undefined ? { lastRunId: patch.lastRunId } : {}),
        ...(patch.lastRunStatus !== undefined ? { lastRunStatus: patch.lastRunStatus } : {}),
        ...(patch.lastSuccessfulRunId !== undefined
          ? { lastSuccessfulRunId: patch.lastSuccessfulRunId }
          : {}),
        ...(patch.lastCycleStartedAt !== undefined
          ? { lastCycleStartedAt: patch.lastCycleStartedAt }
          : {}),
        ...(patch.lastCycleCompletedAt !== undefined
          ? { lastCycleCompletedAt: patch.lastCycleCompletedAt }
          : {}),
        ...(patch.lastProjectionRebuildAt !== undefined
          ? { lastProjectionRebuildAt: patch.lastProjectionRebuildAt }
          : {}),
        ...(patch.lastProjectionSourceRunId !== undefined
          ? { lastProjectionSourceRunId: patch.lastProjectionSourceRunId }
          : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.readyAt !== undefined ? { readyAt: patch.readyAt } : {}),
        ...(patch.stoppedAt !== undefined ? { stoppedAt: patch.stoppedAt } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
        lastUpdatedBy: patch.lastUpdatedBy,
        updatedAt: new Date(),
      })
      .where(eq(runtimeState.id, 'primary'));
  }

  async ensureWorkerState(workerId: string, cycleIntervalMs: number): Promise<void> {
    await this.db
      .insert(runtimeWorkerState)
      .values({
        id: 'primary',
        workerId,
        lifecycleState: 'stopped',
        schedulerState: 'idle',
        cycleIntervalMs,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: runtimeWorkerState.id,
      });
  }

  async getWorkerStatus(): Promise<WorkerStatusView> {
    const [row] = await this.db
      .select()
      .from(runtimeWorkerState)
      .where(eq(runtimeWorkerState.id, 'primary'))
      .limit(1);

    if (row === undefined) {
      return {
        workerId: 'unassigned',
        lifecycleState: 'stopped',
        schedulerState: 'idle',
        currentOperation: null,
        currentCommandId: null,
        currentRunId: null,
        cycleIntervalMs: 60000,
        processId: null,
        hostname: null,
        lastHeartbeatAt: null,
        lastStartedAt: null,
        lastStoppedAt: null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        nextScheduledRunAt: null,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return {
      workerId: row.workerId,
      lifecycleState: row.lifecycleState as WorkerLifecycleState,
      schedulerState: row.schedulerState as WorkerSchedulerState,
      currentOperation: row.currentOperation ?? null,
      currentCommandId: row.currentCommandId ?? null,
      currentRunId: row.currentRunId ?? null,
      cycleIntervalMs: row.cycleIntervalMs,
      processId: row.processId ?? null,
      hostname: row.hostname ?? null,
      lastHeartbeatAt: toIsoString(row.lastHeartbeatAt),
      lastStartedAt: toIsoString(row.lastStartedAt),
      lastStoppedAt: toIsoString(row.lastStoppedAt),
      lastRunStartedAt: toIsoString(row.lastRunStartedAt),
      lastRunCompletedAt: toIsoString(row.lastRunCompletedAt),
      lastSuccessAt: toIsoString(row.lastSuccessAt),
      lastFailureAt: toIsoString(row.lastFailureAt),
      lastFailureReason: row.lastFailureReason ?? null,
      nextScheduledRunAt: toIsoString(row.nextScheduledRunAt),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateWorkerStatus(
    patch: {
      workerId?: string;
      lifecycleState?: WorkerLifecycleState;
      schedulerState?: WorkerSchedulerState;
      currentOperation?: string | null;
      currentCommandId?: string | null;
      currentRunId?: string | null;
      cycleIntervalMs?: number;
      processId?: number | null;
      hostname?: string | null;
      lastHeartbeatAt?: Date | null;
      lastStartedAt?: Date | null;
      lastStoppedAt?: Date | null;
      lastRunStartedAt?: Date | null;
      lastRunCompletedAt?: Date | null;
      lastSuccessAt?: Date | null;
      lastFailureAt?: Date | null;
      lastFailureReason?: string | null;
      nextScheduledRunAt?: Date | null;
    },
  ): Promise<void> {
    await this.db
      .update(runtimeWorkerState)
      .set({
        ...(patch.workerId !== undefined ? { workerId: patch.workerId } : {}),
        ...(patch.lifecycleState !== undefined ? { lifecycleState: patch.lifecycleState } : {}),
        ...(patch.schedulerState !== undefined ? { schedulerState: patch.schedulerState } : {}),
        ...(patch.currentOperation !== undefined ? { currentOperation: patch.currentOperation } : {}),
        ...(patch.currentCommandId !== undefined ? { currentCommandId: patch.currentCommandId } : {}),
        ...(patch.currentRunId !== undefined ? { currentRunId: patch.currentRunId } : {}),
        ...(patch.cycleIntervalMs !== undefined ? { cycleIntervalMs: patch.cycleIntervalMs } : {}),
        ...(patch.processId !== undefined ? { processId: patch.processId } : {}),
        ...(patch.hostname !== undefined ? { hostname: patch.hostname } : {}),
        ...(patch.lastHeartbeatAt !== undefined ? { lastHeartbeatAt: patch.lastHeartbeatAt } : {}),
        ...(patch.lastStartedAt !== undefined ? { lastStartedAt: patch.lastStartedAt } : {}),
        ...(patch.lastStoppedAt !== undefined ? { lastStoppedAt: patch.lastStoppedAt } : {}),
        ...(patch.lastRunStartedAt !== undefined ? { lastRunStartedAt: patch.lastRunStartedAt } : {}),
        ...(patch.lastRunCompletedAt !== undefined ? { lastRunCompletedAt: patch.lastRunCompletedAt } : {}),
        ...(patch.lastSuccessAt !== undefined ? { lastSuccessAt: patch.lastSuccessAt } : {}),
        ...(patch.lastFailureAt !== undefined ? { lastFailureAt: patch.lastFailureAt } : {}),
        ...(patch.lastFailureReason !== undefined ? { lastFailureReason: patch.lastFailureReason } : {}),
        ...(patch.nextScheduledRunAt !== undefined ? { nextScheduledRunAt: patch.nextScheduledRunAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(runtimeWorkerState.id, 'primary'));
  }

  async enqueueRuntimeCommand(input: {
    commandId: string;
    commandType: RuntimeCommandType;
    requestedBy: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.db
      .insert(runtimeCommands)
      .values({
        commandId: input.commandId,
        commandType: input.commandType,
        status: 'pending',
        requestedBy: input.requestedBy,
        payload: input.payload ?? {},
        result: {},
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: runtimeCommands.commandId,
      });
  }

  async getRuntimeCommand(commandId: string): Promise<RuntimeCommandView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeCommands)
      .where(eq(runtimeCommands.commandId, commandId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      commandId: row.commandId,
      commandType: row.commandType as RuntimeCommandType,
      status: row.status as RuntimeCommandStatus,
      requestedBy: row.requestedBy,
      claimedBy: row.claimedBy ?? null,
      payload: asJsonObject(row.payload),
      result: asJsonObject(row.result),
      errorMessage: row.errorMessage ?? null,
      requestedAt: row.requestedAt.toISOString(),
      startedAt: toIsoString(row.startedAt),
      completedAt: toIsoString(row.completedAt),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async claimNextPendingCommand(claimedBy: string): Promise<RuntimeCommandView | null> {
    const [pending] = await this.db
      .select()
      .from(runtimeCommands)
      .where(eq(runtimeCommands.status, 'pending'))
      .orderBy(runtimeCommands.requestedAt)
      .limit(1);

    if (pending === undefined) {
      return null;
    }

    await this.db
      .update(runtimeCommands)
      .set({
        status: 'running',
        claimedBy,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(runtimeCommands.commandId, pending.commandId),
          eq(runtimeCommands.status, 'pending'),
        ),
      );

    return this.getRuntimeCommand(pending.commandId);
  }

  async completeRuntimeCommand(
    commandId: string,
    result: Record<string, unknown>,
  ): Promise<RuntimeCommandView | null> {
    await this.db
      .update(runtimeCommands)
      .set({
        status: 'completed',
        result,
        errorMessage: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(runtimeCommands.commandId, commandId));

    return this.getRuntimeCommand(commandId);
  }

  async failRuntimeCommand(commandId: string, errorMessage: string): Promise<RuntimeCommandView | null> {
    await this.db
      .update(runtimeCommands)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(runtimeCommands.commandId, commandId));

    return this.getRuntimeCommand(commandId);
  }

  async createStrategyRun(input: {
    runId: string;
    sleeveId: string;
    executionMode: 'dry-run' | 'live';
    triggerSource: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(strategyRuns).values({
      runId: input.runId,
      sleeveId: input.sleeveId,
      executionMode: input.executionMode,
      triggerSource: input.triggerSource,
      status: 'running',
      startedAt: new Date(),
      metadata: input.metadata ?? {},
      updatedAt: new Date(),
    });
  }

  async completeStrategyRun(input: {
    runId: string;
    status: 'completed' | 'failed';
    opportunitiesDetected: number;
    opportunitiesApproved: number;
    intentsGenerated: number;
    intentsApproved: number;
    intentsRejected: number;
    intentsExecuted: number;
    errorMessage?: string;
  }): Promise<void> {
    await this.db
      .update(strategyRuns)
      .set({
        status: input.status,
        opportunitiesDetected: input.opportunitiesDetected,
        opportunitiesApproved: input.opportunitiesApproved,
        intentsGenerated: input.intentsGenerated,
        intentsApproved: input.intentsApproved,
        intentsRejected: input.intentsRejected,
        intentsExecuted: input.intentsExecuted,
        errorMessage: input.errorMessage ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(strategyRuns.runId, input.runId));
  }

  async persistOpportunity(input: OpportunityView): Promise<void> {
    await this.db
      .insert(strategyOpportunities)
      .values({
        opportunityId: input.opportunityId,
        runId: input.runId,
        sleeveId: input.sleeveId,
        asset: input.asset,
        opportunityType: input.opportunityType,
        expectedAnnualYieldPct: input.expectedAnnualYieldPct,
        netYieldPct: input.netYieldPct,
        confidenceScore: input.confidenceScore,
        detectedAt: new Date(input.detectedAt),
        expiresAt: new Date(input.expiresAt),
        approved: input.approved,
        payload: input.payload,
      })
      .onConflictDoNothing({
        target: strategyOpportunities.opportunityId,
      });
  }

  async persistIntent(input: {
    runId: string;
    intent: OrderIntent;
    approved: boolean;
    riskAssessment: RiskAssessment;
    executionDisposition: string;
  }): Promise<void> {
    await this.db
      .insert(strategyIntents)
      .values({
        intentId: input.intent.intentId,
        runId: input.runId,
        opportunityId: input.intent.opportunityId,
        sleeveId: extractSleeveId(input.intent),
        venueId: input.intent.venueId,
        asset: input.intent.asset,
        side: input.intent.side,
        orderType: input.intent.type,
        requestedSize: input.intent.size,
        requestedPrice: input.intent.limitPrice,
        reduceOnly: input.intent.reduceOnly,
        positionSizeUsd:
          typeof input.intent.metadata['positionSizeUsd'] === 'string'
            ? input.intent.metadata['positionSizeUsd']
            : null,
        riskStatus: input.riskAssessment.overallStatus,
        approved: input.approved,
        executionDisposition: input.executionDisposition,
        riskAssessment: {
          overallStatus: input.riskAssessment.overallStatus,
          timestamp: input.riskAssessment.timestamp.toISOString(),
          results: input.riskAssessment.results,
        },
        metadata: asRecord(input.intent.metadata),
        createdAt: input.intent.createdAt,
      })
      .onConflictDoNothing({
        target: strategyIntents.intentId,
      });
  }

  async persistExecutionEvent(input: {
    eventId: string;
    runId: string;
    intentId: string;
    clientOrderId?: string | null;
    venueOrderId?: string | null;
    eventType: string;
    status: string;
    payload: Record<string, unknown>;
    occurredAt: Date;
  }): Promise<void> {
    await this.db
      .insert(executionEvents)
      .values({
        eventId: input.eventId,
        runId: input.runId,
        intentId: input.intentId,
        clientOrderId: input.clientOrderId ?? null,
        venueOrderId: input.venueOrderId ?? null,
        eventType: input.eventType,
        status: input.status,
        payload: input.payload,
        occurredAt: input.occurredAt,
      })
      .onConflictDoNothing({
        target: executionEvents.eventId,
      });
  }

  async persistRiskSnapshot(input: {
    runId: string;
    sleeveId: string;
    summary: RiskSummary;
    approvedIntentCount: number;
    rejectedIntentCount: number;
    capturedAt: Date;
  }): Promise<void> {
    await this.db.insert(riskSnapshots).values({
      runId: input.runId,
      sleeveId: input.sleeveId,
      summary: input.summary as unknown as Record<string, unknown>,
      approvedIntentCount: input.approvedIntentCount,
      rejectedIntentCount: input.rejectedIntentCount,
      openCircuitBreakers: input.summary.openCircuitBreakers,
      capturedAt: input.capturedAt,
    });

    await this.db
      .insert(riskCurrent)
      .values({
        id: 'primary',
        sourceRunId: input.runId,
        sleeveId: input.sleeveId,
        summary: input.summary as unknown as Record<string, unknown>,
        approvedIntentCount: input.approvedIntentCount,
        rejectedIntentCount: input.rejectedIntentCount,
        openCircuitBreakers: input.summary.openCircuitBreakers,
        capturedAt: input.capturedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: riskCurrent.id,
        set: {
          sourceRunId: input.runId,
          sleeveId: input.sleeveId,
          summary: input.summary as unknown as Record<string, unknown>,
          approvedIntentCount: input.approvedIntentCount,
          rejectedIntentCount: input.rejectedIntentCount,
          openCircuitBreakers: input.summary.openCircuitBreakers,
          capturedAt: input.capturedAt,
          updatedAt: new Date(),
        },
      });
  }

  async persistRiskBreach(input: RiskBreachView): Promise<void> {
    await this.db
      .insert(riskBreaches)
      .values({
        id: input.id,
        breachType: input.breachType,
        severity: input.severity,
        description: input.description,
        triggeredAt: new Date(input.triggeredAt),
        resolvedAt: input.resolvedAt !== null ? new Date(input.resolvedAt) : null,
        details: input.details,
      })
      .onConflictDoNothing({
        target: riskBreaches.id,
      });
  }

  async persistPortfolioSnapshot(input: {
    sourceRunId: string | null;
    snapshotAt: Date;
    portfolioState: PortfolioState;
    riskSummary: RiskSummary;
    dailyPnl: string;
    cumulativePnl: string;
  }): Promise<void> {
    const totalNav = Number.parseFloat(input.portfolioState.totalNav || '0');
    const sleeves = Array.from(input.portfolioState.sleeveNav.entries()).map(([sleeveId, nav]) => ({
      sleeveId,
      nav,
      allocationPct: totalNav === 0 ? 0 : (Number.parseFloat(nav) / totalNav) * 100,
    }));

    await this.db.insert(portfolioSnapshots).values({
      snapshotAt: input.snapshotAt,
      sourceRunId: input.sourceRunId,
      totalNav: input.portfolioState.totalNav,
      grossExposure: input.portfolioState.grossExposure,
      netExposure: input.portfolioState.netExposure,
      liquidityReserve: input.portfolioState.liquidityReserve,
      openPositionCount: String(input.portfolioState.openPositionCount),
      dailyPnl: input.dailyPnl,
      cumulativePnl: input.cumulativePnl,
      sleeveAllocations: sleeves as unknown as Record<string, unknown>,
      venueExposures: serialiseMap(input.portfolioState.venueExposures),
      assetExposures: serialiseMap(input.portfolioState.assetExposures),
      riskMetrics: input.riskSummary as unknown as Record<string, unknown>,
    });

    await this.db
      .insert(portfolioCurrent)
      .values({
        id: 'primary',
        sourceSnapshotAt: input.snapshotAt,
        sourceRunId: input.sourceRunId,
        totalNav: input.portfolioState.totalNav,
        grossExposure: input.portfolioState.grossExposure,
        netExposure: input.portfolioState.netExposure,
        liquidityReserve: input.portfolioState.liquidityReserve,
        openPositionCount: String(input.portfolioState.openPositionCount),
        dailyPnl: input.dailyPnl,
        cumulativePnl: input.cumulativePnl,
        sleeveAllocations: sleeves as unknown as Record<string, unknown>,
        venueExposures: serialiseMap(input.portfolioState.venueExposures),
        assetExposures: serialiseMap(input.portfolioState.assetExposures),
        riskMetrics: input.riskSummary as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioCurrent.id,
        set: {
          sourceSnapshotAt: input.snapshotAt,
          sourceRunId: input.sourceRunId,
          totalNav: input.portfolioState.totalNav,
          grossExposure: input.portfolioState.grossExposure,
          netExposure: input.portfolioState.netExposure,
          liquidityReserve: input.portfolioState.liquidityReserve,
          openPositionCount: String(input.portfolioState.openPositionCount),
          dailyPnl: input.dailyPnl,
          cumulativePnl: input.cumulativePnl,
          sleeveAllocations: sleeves as unknown as Record<string, unknown>,
          venueExposures: serialiseMap(input.portfolioState.venueExposures),
          assetExposures: serialiseMap(input.portfolioState.assetExposures),
          riskMetrics: input.riskSummary as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      });
  }

  async syncPositions(positionsSnapshot: PositionView[]): Promise<void> {
    await this.db.execute(sql`DELETE FROM ${positions};`);

    if (positionsSnapshot.length === 0) {
      return;
    }

    await this.db.insert(positions).values(
      positionsSnapshot.map((positionRow) => ({
        id: positionRow.id,
        sleeveId: positionRow.sleeveId,
        venueId: positionRow.venueId,
        asset: positionRow.asset,
        side: positionRow.side,
        size: positionRow.size,
        entryPrice: positionRow.entryPrice,
        markPrice: positionRow.markPrice,
        unrealizedPnl: positionRow.unrealizedPnl,
        realizedPnl: positionRow.realizedPnl,
        fundingAccrued: positionRow.fundingAccrued,
        hedgeState: positionRow.hedgeState,
        status: positionRow.status,
        openedAt: new Date(positionRow.openedAt),
        closedAt: positionRow.closedAt !== null ? new Date(positionRow.closedAt) : null,
        updatedAt: new Date(positionRow.updatedAt),
      })),
    );
  }

  async persistFill(orderId: string, fill: OrderFill): Promise<void> {
    const [orderRow] = await this.db
      .select({
        id: orders.id,
        clientOrderId: orders.clientOrderId,
        venueOrderId: orders.venueOrderId,
        side: orders.side,
      })
      .from(orders)
      .where(eq(orders.clientOrderId, orderId))
      .limit(1);

    if (orderRow === undefined || orderRow.venueOrderId === null) {
      return;
    }

    await this.db
      .insert(fills)
      .values({
        orderId: orderRow.id,
        clientOrderId: orderRow.clientOrderId,
        venueOrderId: orderRow.venueOrderId,
        fillId: fill.fillId,
        size: fill.filledSize,
        price: fill.fillPrice,
        fee: fill.fee,
        side: orderRow.side,
        feeAsset: fill.feeAsset,
        filledAt: fill.filledAt,
        metadata: asRecord(fill),
      })
      .onConflictDoNothing({
        target: fills.id,
      });
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryView | null> {
    const [row] = await this.db
      .select()
      .from(portfolioCurrent)
      .limit(1);

    if (row === undefined) {
      return null;
    }

    const sleevesRaw = Array.isArray(row.sleeveAllocations) ? row.sleeveAllocations : [];

    return {
      totalNav: row.totalNav,
      grossExposure: row.grossExposure,
      netExposure: row.netExposure,
      liquidityReserve: row.liquidityReserve,
      openPositionCount: Number.parseInt(row.openPositionCount, 10),
      dailyPnl: row.dailyPnl,
      cumulativePnl: row.cumulativePnl,
      sleeves: sleevesRaw.map((item) => ({
        sleeveId: String(asRecord(item)['sleeveId'] ?? 'unknown'),
        nav: String(asRecord(item)['nav'] ?? '0'),
        allocationPct: Number(asRecord(item)['allocationPct'] ?? 0),
      })),
      venueExposures: (row.venueExposures ?? {}) as Record<string, string>,
      assetExposures: (row.assetExposures ?? {}) as Record<string, string>,
      updatedAt: row.sourceSnapshotAt.toISOString(),
    };
  }

  async listPortfolioSnapshots(limit: number): Promise<PortfolioSnapshotView[]> {
    const rows = await this.db
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(limit);

    return Promise.all(rows.map(async (row) => this.getPortfolioSummaryFromRow(row)));
  }

  private async getPortfolioSummaryFromRow(
    row: typeof portfolioSnapshots.$inferSelect,
  ): Promise<PortfolioSnapshotView> {
    const sleevesRaw = Array.isArray(row.sleeveAllocations) ? row.sleeveAllocations : [];

    return {
      totalNav: row.totalNav,
      grossExposure: row.grossExposure,
      netExposure: row.netExposure,
      liquidityReserve: row.liquidityReserve,
      openPositionCount: Number.parseInt(row.openPositionCount, 10),
      dailyPnl: row.dailyPnl,
      cumulativePnl: row.cumulativePnl,
      sleeves: sleevesRaw.map((item) => ({
        sleeveId: String(asRecord(item)['sleeveId'] ?? 'unknown'),
        nav: String(asRecord(item)['nav'] ?? '0'),
        allocationPct: Number(asRecord(item)['allocationPct'] ?? 0),
      })),
      venueExposures: (row.venueExposures ?? {}) as Record<string, string>,
      assetExposures: (row.assetExposures ?? {}) as Record<string, string>,
      updatedAt: row.snapshotAt.toISOString(),
    };
  }

  async getPnlSummary(): Promise<PnlSummaryView> {
    const [row] = await this.db
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(1);

    return {
      dailyPnl: row?.dailyPnl ?? '0',
      cumulativePnl: row?.cumulativePnl ?? '0',
      lastSnapshotAt: row?.snapshotAt.toISOString() ?? null,
    };
  }

  async getRiskSummary(): Promise<RiskSummaryView | null> {
    const [row] = await this.db
      .select()
      .from(riskCurrent)
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      summary: row.summary as RiskSummary,
      approvedIntentCount: row.approvedIntentCount,
      rejectedIntentCount: row.rejectedIntentCount,
      capturedAt: row.capturedAt.toISOString(),
    };
  }

  async replacePortfolioCurrentFromSnapshot(
    row: typeof portfolioSnapshots.$inferSelect,
  ): Promise<void> {
    await this.db
      .insert(portfolioCurrent)
      .values({
        id: 'primary',
        sourceSnapshotAt: row.snapshotAt,
        sourceRunId: row.sourceRunId ?? null,
        totalNav: row.totalNav,
        grossExposure: row.grossExposure,
        netExposure: row.netExposure,
        liquidityReserve: row.liquidityReserve,
        openPositionCount: row.openPositionCount,
        dailyPnl: row.dailyPnl,
        cumulativePnl: row.cumulativePnl,
        sleeveAllocations: row.sleeveAllocations,
        venueExposures: row.venueExposures,
        assetExposures: row.assetExposures,
        riskMetrics: row.riskMetrics,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: portfolioCurrent.id,
        set: {
          sourceSnapshotAt: row.snapshotAt,
          sourceRunId: row.sourceRunId ?? null,
          totalNav: row.totalNav,
          grossExposure: row.grossExposure,
          netExposure: row.netExposure,
          liquidityReserve: row.liquidityReserve,
          openPositionCount: row.openPositionCount,
          dailyPnl: row.dailyPnl,
          cumulativePnl: row.cumulativePnl,
          sleeveAllocations: row.sleeveAllocations,
          venueExposures: row.venueExposures,
          assetExposures: row.assetExposures,
          riskMetrics: row.riskMetrics,
          updatedAt: new Date(),
        },
      });
  }

  async replaceRiskCurrentFromSnapshot(
    row: typeof riskSnapshots.$inferSelect,
  ): Promise<void> {
    await this.db
      .insert(riskCurrent)
      .values({
        id: 'primary',
        sourceRunId: row.runId,
        sleeveId: row.sleeveId,
        summary: row.summary,
        approvedIntentCount: row.approvedIntentCount,
        rejectedIntentCount: row.rejectedIntentCount,
        openCircuitBreakers: row.openCircuitBreakers,
        capturedAt: row.capturedAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: riskCurrent.id,
        set: {
          sourceRunId: row.runId,
          sleeveId: row.sleeveId,
          summary: row.summary,
          approvedIntentCount: row.approvedIntentCount,
          rejectedIntentCount: row.rejectedIntentCount,
          openCircuitBreakers: row.openCircuitBreakers,
          capturedAt: row.capturedAt,
          updatedAt: new Date(),
        },
      });
  }

  async getLatestPortfolioSnapshotRow(): Promise<typeof portfolioSnapshots.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(portfolioSnapshots)
      .orderBy(desc(portfolioSnapshots.snapshotAt))
      .limit(1);

    return row ?? null;
  }

  async getLatestRiskSnapshotRow(): Promise<typeof riskSnapshots.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(riskSnapshots)
      .orderBy(desc(riskSnapshots.capturedAt))
      .limit(1);

    return row ?? null;
  }

  async getLatestSuccessfulRunId(): Promise<string | null> {
    const [row] = await this.db
      .select({ runId: strategyRuns.runId })
      .from(strategyRuns)
      .where(eq(strategyRuns.status, 'completed'))
      .orderBy(desc(strategyRuns.completedAt), desc(strategyRuns.startedAt))
      .limit(1);

    return row?.runId ?? null;
  }

  async listFillHistory(): Promise<Array<{
    venueId: string;
    venueOrderId: string;
    clientOrderId: string;
    asset: string;
    side: 'buy' | 'sell';
    size: string;
    price: string;
    fee: string;
    feeAsset: string | null;
    reduceOnly: boolean;
    filledAt: Date;
  }>> {
    const rows = await this.db
      .select({
        venueId: orders.venueId,
        venueOrderId: fills.venueOrderId,
        clientOrderId: fills.clientOrderId,
        asset: orders.asset,
        side: fills.side,
        size: fills.size,
        price: fills.price,
        fee: fills.fee,
        feeAsset: fills.feeAsset,
        reduceOnly: orders.reduceOnly,
        filledAt: fills.filledAt,
      })
      .from(fills)
      .innerJoin(orders, eq(fills.clientOrderId, orders.clientOrderId))
      .orderBy(fills.filledAt, fills.createdAt);

    return rows.map((row) => ({
      venueId: row.venueId,
      venueOrderId: row.venueOrderId,
      clientOrderId: row.clientOrderId,
      asset: row.asset,
      side: row.side as 'buy' | 'sell',
      size: row.size,
      price: row.price,
      fee: row.fee,
      feeAsset: row.feeAsset,
      reduceOnly: row.reduceOnly,
      filledAt: row.filledAt,
    }));
  }

  async listRiskBreaches(limit: number): Promise<RiskBreachView[]> {
    const rows = await this.db
      .select()
      .from(riskBreaches)
      .orderBy(desc(riskBreaches.triggeredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      breachType: row.breachType,
      severity: row.severity,
      description: row.description,
      triggeredAt: row.triggeredAt.toISOString(),
      resolvedAt: toIsoString(row.resolvedAt),
      details: (row.details ?? {}) as Record<string, unknown>,
    }));
  }

  async listOrders(limit: number): Promise<OrderView[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      clientOrderId: row.clientOrderId,
      runId: row.strategyRunId ?? null,
      sleeveId: row.sleeveId,
      opportunityId: row.opportunityId ?? null,
      venueId: row.venueId,
      venueOrderId: row.venueOrderId ?? null,
      asset: row.asset,
      side: row.side,
      orderType: row.orderType,
      executionMode: row.executionMode,
      requestedSize: row.requestedSize,
      requestedPrice: row.requestedPrice ?? null,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice ?? null,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError ?? null,
      reduceOnly: row.reduceOnly,
      metadata: asRecord(row.metadata),
      submittedAt: toIsoString(row.submittedAt),
      completedAt: toIsoString(row.completedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getOrder(clientOrderId: string): Promise<OrderView | null> {
    const [row] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.clientOrderId, clientOrderId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      clientOrderId: row.clientOrderId,
      runId: row.strategyRunId ?? null,
      sleeveId: row.sleeveId,
      opportunityId: row.opportunityId ?? null,
      venueId: row.venueId,
      venueOrderId: row.venueOrderId ?? null,
      asset: row.asset,
      side: row.side,
      orderType: row.orderType,
      executionMode: row.executionMode,
      requestedSize: row.requestedSize,
      requestedPrice: row.requestedPrice ?? null,
      filledSize: row.filledSize,
      averageFillPrice: row.averageFillPrice ?? null,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError ?? null,
      reduceOnly: row.reduceOnly,
      metadata: asRecord(row.metadata),
      submittedAt: toIsoString(row.submittedAt),
      completedAt: toIsoString(row.completedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listPositions(limit: number): Promise<PositionView[]> {
    const rows = await this.db
      .select()
      .from(positions)
      .orderBy(desc(positions.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      sleeveId: row.sleeveId,
      venueId: row.venueId,
      asset: row.asset,
      side: row.side,
      size: row.size,
      entryPrice: row.entryPrice,
      markPrice: row.markPrice,
      unrealizedPnl: row.unrealizedPnl,
      realizedPnl: row.realizedPnl,
      fundingAccrued: row.fundingAccrued,
      hedgeState: row.hedgeState,
      status: row.status,
      openedAt: row.openedAt.toISOString(),
      closedAt: toIsoString(row.closedAt),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getPosition(id: string): Promise<PositionView | null> {
    const [row] = await this.db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      sleeveId: row.sleeveId,
      venueId: row.venueId,
      asset: row.asset,
      side: row.side,
      size: row.size,
      entryPrice: row.entryPrice,
      markPrice: row.markPrice,
      unrealizedPnl: row.unrealizedPnl,
      realizedPnl: row.realizedPnl,
      fundingAccrued: row.fundingAccrued,
      hedgeState: row.hedgeState,
      status: row.status,
      openedAt: row.openedAt.toISOString(),
      closedAt: toIsoString(row.closedAt),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listOpportunities(limit: number): Promise<OpportunityView[]> {
    const rows = await this.db
      .select()
      .from(strategyOpportunities)
      .orderBy(desc(strategyOpportunities.detectedAt))
      .limit(limit);

    return rows.map((row) => ({
      opportunityId: row.opportunityId,
      runId: row.runId,
      sleeveId: row.sleeveId,
      asset: row.asset,
      opportunityType: row.opportunityType,
      expectedAnnualYieldPct: row.expectedAnnualYieldPct,
      netYieldPct: row.netYieldPct,
      confidenceScore: row.confidenceScore,
      detectedAt: row.detectedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      approved: row.approved,
      payload: row.payload as Record<string, unknown>,
    }));
  }

  async listRecentEvents(limit: number): Promise<AuditEventView[]> {
    const rows = await this.db
      .select()
      .from(auditEvents)
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      eventId: row.eventId,
      eventType: row.eventType,
      occurredAt: row.occurredAt.toISOString(),
      actorType: row.actorType,
      actorId: row.actorId,
      sleeveId: row.sleeveId ?? null,
      correlationId: row.correlationId ?? null,
      data: row.data as Record<string, unknown>,
    }));
  }

  async upsertMismatch(input: {
    dedupeKey: string;
    category: string;
    severity: string;
    sourceComponent: string;
    entityType?: string | null;
    entityId?: string | null;
    summary: string;
    details?: Record<string, unknown>;
    detectedAt: Date;
  }): Promise<RuntimeMismatchView> {
    const [existing] = await this.db
      .select()
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.dedupeKey, input.dedupeKey))
      .limit(1);

    if (existing === undefined) {
      await this.db.insert(runtimeMismatches).values({
        dedupeKey: input.dedupeKey,
        category: input.category,
        severity: input.severity,
        sourceComponent: input.sourceComponent,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        details: input.details ?? {},
        status: 'open',
        firstDetectedAt: input.detectedAt,
        lastDetectedAt: input.detectedAt,
        occurrenceCount: 1,
        updatedAt: new Date(),
      });
    } else {
      const nextStatus: RuntimeMismatchStatus =
        existing.status === 'resolved' ? 'open' : (existing.status as RuntimeMismatchStatus);

      await this.db
        .update(runtimeMismatches)
        .set({
          category: input.category,
          severity: input.severity,
          sourceComponent: input.sourceComponent,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          summary: input.summary,
          details: input.details ?? {},
          status: nextStatus,
          lastDetectedAt: input.detectedAt,
          occurrenceCount: existing.occurrenceCount + 1,
          resolvedAt: null,
          resolvedBy: null,
          resolutionSummary: null,
          updatedAt: new Date(),
        })
        .where(eq(runtimeMismatches.dedupeKey, input.dedupeKey));
    }

    const record = await this.getMismatchByDedupeKey(input.dedupeKey);
    if (record === null) {
      throw new Error(`RuntimeStore.upsertMismatch: mismatch "${input.dedupeKey}" was not persisted`);
    }
    return record;
  }

  async getMismatchByDedupeKey(dedupeKey: string): Promise<RuntimeMismatchView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.dedupeKey, dedupeKey))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      dedupeKey: row.dedupeKey,
      category: row.category,
      severity: row.severity,
      sourceComponent: row.sourceComponent,
      entityType: row.entityType ?? null,
      entityId: row.entityId ?? null,
      summary: row.summary,
      details: asJsonObject(row.details),
      status: row.status as RuntimeMismatchStatus,
      firstDetectedAt: row.firstDetectedAt.toISOString(),
      lastDetectedAt: row.lastDetectedAt.toISOString(),
      occurrenceCount: row.occurrenceCount,
      acknowledgedAt: toIsoString(row.acknowledgedAt),
      acknowledgedBy: row.acknowledgedBy ?? null,
      resolvedAt: toIsoString(row.resolvedAt),
      resolvedBy: row.resolvedBy ?? null,
      resolutionSummary: row.resolutionSummary ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async acknowledgeMismatch(
    mismatchId: string,
    actorId: string,
    summary: string | null = null,
  ): Promise<RuntimeMismatchView | null> {
    await this.db
      .update(runtimeMismatches)
      .set({
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        acknowledgedBy: actorId,
        resolutionSummary: summary,
        updatedAt: new Date(),
      })
      .where(eq(runtimeMismatches.id, mismatchId));

    return this.getMismatchById(mismatchId);
  }

  async resolveMismatch(
    dedupeKey: string,
    resolvedBy: string,
    resolutionSummary: string,
  ): Promise<RuntimeMismatchView | null> {
    await this.db
      .update(runtimeMismatches)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy,
        resolutionSummary,
        updatedAt: new Date(),
      })
      .where(eq(runtimeMismatches.dedupeKey, dedupeKey));

    return this.getMismatchByDedupeKey(dedupeKey);
  }

  async getMismatchById(mismatchId: string): Promise<RuntimeMismatchView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.id, mismatchId))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      dedupeKey: row.dedupeKey,
      category: row.category,
      severity: row.severity,
      sourceComponent: row.sourceComponent,
      entityType: row.entityType ?? null,
      entityId: row.entityId ?? null,
      summary: row.summary,
      details: asJsonObject(row.details),
      status: row.status as RuntimeMismatchStatus,
      firstDetectedAt: row.firstDetectedAt.toISOString(),
      lastDetectedAt: row.lastDetectedAt.toISOString(),
      occurrenceCount: row.occurrenceCount,
      acknowledgedAt: toIsoString(row.acknowledgedAt),
      acknowledgedBy: row.acknowledgedBy ?? null,
      resolvedAt: toIsoString(row.resolvedAt),
      resolvedBy: row.resolvedBy ?? null,
      resolutionSummary: row.resolutionSummary ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listMismatches(
    limit: number,
    status?: RuntimeMismatchStatus,
  ): Promise<RuntimeMismatchView[]> {
    const rows = status === undefined
      ? await this.db
        .select()
        .from(runtimeMismatches)
        .orderBy(desc(runtimeMismatches.lastDetectedAt))
        .limit(limit)
      : await this.db
        .select()
        .from(runtimeMismatches)
        .where(eq(runtimeMismatches.status, status))
        .orderBy(desc(runtimeMismatches.lastDetectedAt))
        .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      dedupeKey: row.dedupeKey,
      category: row.category,
      severity: row.severity,
      sourceComponent: row.sourceComponent,
      entityType: row.entityType ?? null,
      entityId: row.entityId ?? null,
      summary: row.summary,
      details: asJsonObject(row.details),
      status: row.status as RuntimeMismatchStatus,
      firstDetectedAt: row.firstDetectedAt.toISOString(),
      lastDetectedAt: row.lastDetectedAt.toISOString(),
      occurrenceCount: row.occurrenceCount,
      acknowledgedAt: toIsoString(row.acknowledgedAt),
      acknowledgedBy: row.acknowledgedBy ?? null,
      resolvedAt: toIsoString(row.resolvedAt),
      resolvedBy: row.resolvedBy ?? null,
      resolutionSummary: row.resolutionSummary ?? null,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async countOpenMismatches(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(runtimeMismatches)
      .where(eq(runtimeMismatches.status, 'open'));

    return Number(rows[0]?.count ?? 0);
  }

  async recordRecoveryEvent(input: {
    mismatchId?: string | null;
    commandId?: string | null;
    runId?: string | null;
    eventType: string;
    status: string;
    sourceComponent: string;
    actorId?: string | null;
    message: string;
    details?: Record<string, unknown>;
    occurredAt?: Date;
  }): Promise<void> {
    await this.db.insert(runtimeRecoveryEvents).values({
      mismatchId: input.mismatchId ?? null,
      commandId: input.commandId ?? null,
      runId: input.runId ?? null,
      eventType: input.eventType,
      status: input.status,
      sourceComponent: input.sourceComponent,
      actorId: input.actorId ?? null,
      message: input.message,
      details: input.details ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
  }

  async listRecoveryEvents(limit: number): Promise<RuntimeRecoveryEventView[]> {
    const rows = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .orderBy(desc(runtimeRecoveryEvents.occurredAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      mismatchId: row.mismatchId ?? null,
      commandId: row.commandId ?? null,
      runId: row.runId ?? null,
      eventType: row.eventType,
      status: row.status,
      sourceComponent: row.sourceComponent,
      actorId: row.actorId ?? null,
      message: row.message,
      details: asJsonObject(row.details),
      occurredAt: row.occurredAt.toISOString(),
    }));
  }

  async getLatestRecoveryEvent(): Promise<RuntimeRecoveryEventView | null> {
    const [row] = await this.db
      .select()
      .from(runtimeRecoveryEvents)
      .orderBy(desc(runtimeRecoveryEvents.occurredAt))
      .limit(1);

    if (row === undefined) {
      return null;
    }

    return {
      id: row.id,
      mismatchId: row.mismatchId ?? null,
      commandId: row.commandId ?? null,
      runId: row.runId ?? null,
      eventType: row.eventType,
      status: row.status,
      sourceComponent: row.sourceComponent,
      actorId: row.actorId ?? null,
      message: row.message,
      details: asJsonObject(row.details),
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  async countApprovedIntentsForRun(runId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(strategyIntents)
      .where(and(eq(strategyIntents.runId, runId), eq(strategyIntents.approved, true)));

    return Number(rows[0]?.count ?? 0);
  }

  async countOrdersForRun(runId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.strategyRunId, runId));

    return Number(rows[0]?.count ?? 0);
  }

  async getProjectionSources(): Promise<{
    latestSuccessfulRunId: string | null;
    runtimeProjectionSourceRunId: string | null;
    riskCurrentSourceRunId: string | null;
    portfolioCurrentSourceRunId: string | null;
    projectionStatus: ProjectionStatus;
  }> {
    const [runtimeRow] = await this.db
      .select({
        projectionStatus: runtimeState.projectionStatus,
        lastProjectionSourceRunId: runtimeState.lastProjectionSourceRunId,
      })
      .from(runtimeState)
      .where(eq(runtimeState.id, 'primary'))
      .limit(1);

    const [riskRow] = await this.db
      .select({ sourceRunId: riskCurrent.sourceRunId })
      .from(riskCurrent)
      .limit(1);

    const [portfolioRow] = await this.db
      .select({ sourceRunId: portfolioCurrent.sourceRunId })
      .from(portfolioCurrent)
      .limit(1);

    return {
      latestSuccessfulRunId: await this.getLatestSuccessfulRunId(),
      runtimeProjectionSourceRunId: runtimeRow?.lastProjectionSourceRunId ?? null,
      riskCurrentSourceRunId: riskRow?.sourceRunId ?? null,
      portfolioCurrentSourceRunId: portfolioRow?.sourceRunId ?? null,
      projectionStatus: (runtimeRow?.projectionStatus ?? 'stale') as ProjectionStatus,
    };
  }
}
