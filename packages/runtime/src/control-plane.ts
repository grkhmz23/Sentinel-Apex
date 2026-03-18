import {
  applyMigrations,
  createDatabaseConnection,
  type DatabaseConnection,
} from '@sentinel-apex/db';
import { createId } from '@sentinel-apex/domain';

import { DatabaseAuditWriter, RuntimeStore } from './store.js';

import type {
  AuditEventView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RiskBreachView,
  RiskSummaryView,
  RuntimeCommandType,
  RuntimeCommandView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReadApi,
  RuntimeRecoveryEventView,
  RuntimeStatusView,
  WorkerStatusView,
} from './types.js';

export class RuntimeControlPlane implements RuntimeReadApi {
  constructor(
    private readonly connection: DatabaseConnection,
    private readonly store: RuntimeStore,
  ) {}

  static async connect(connectionString: string): Promise<RuntimeControlPlane> {
    const connection = await createDatabaseConnection(connectionString);
    await applyMigrations(connection);
    const auditWriter = new DatabaseAuditWriter(connection.db);
    const store = new RuntimeStore(connection.db, auditWriter);
    return new RuntimeControlPlane(connection, store);
  }

  async close(): Promise<void> {
    await this.connection.close();
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryView | null> {
    return this.store.getPortfolioSummary();
  }

  async listPortfolioSnapshots(limit = 20): Promise<PortfolioSnapshotView[]> {
    return this.store.listPortfolioSnapshots(limit);
  }

  async getPnlSummary(): Promise<PnlSummaryView> {
    return this.store.getPnlSummary();
  }

  async getRiskSummary(): Promise<RiskSummaryView | null> {
    return this.store.getRiskSummary();
  }

  async listRiskBreaches(limit = 50): Promise<RiskBreachView[]> {
    return this.store.listRiskBreaches(limit);
  }

  async listOrders(limit = 100): Promise<OrderView[]> {
    return this.store.listOrders(limit);
  }

  async getOrder(clientOrderId: string): Promise<OrderView | null> {
    return this.store.getOrder(clientOrderId);
  }

  async listPositions(limit = 100): Promise<PositionView[]> {
    return this.store.listPositions(limit);
  }

  async getPosition(id: string): Promise<PositionView | null> {
    return this.store.getPosition(id);
  }

  async listOpportunities(limit = 100): Promise<OpportunityView[]> {
    return this.store.listOpportunities(limit);
  }

  async listRecentEvents(limit = 100): Promise<AuditEventView[]> {
    return this.store.listRecentEvents(limit);
  }

  async getRuntimeStatus(): Promise<RuntimeStatusView> {
    return this.store.getRuntimeStatus();
  }

  async getWorkerStatus(): Promise<WorkerStatusView> {
    return this.store.getWorkerStatus();
  }

  async getRuntimeOverview(): Promise<RuntimeOverviewView> {
    const [runtime, worker, openMismatchCount, lastRecoveryEvent] = await Promise.all([
      this.store.getRuntimeStatus(),
      this.store.getWorkerStatus(),
      this.store.countOpenMismatches(),
      this.store.getLatestRecoveryEvent(),
    ]);

    const degradedReasons = [
      runtime.lastError,
      runtime.reason,
      worker.lastFailureReason,
      openMismatchCount > 0 ? `${openMismatchCount} open mismatches` : null,
    ].filter((value): value is string => value !== null && value.length > 0);

    return {
      runtime,
      worker,
      openMismatchCount,
      degradedReasons,
      lastRecoveryEvent,
    };
  }

  async enqueueCommand(
    commandType: RuntimeCommandType,
    requestedBy: string,
    payload: Record<string, unknown> = {},
  ): Promise<RuntimeCommandView> {
    const commandId = createId();
    await this.store.enqueueRuntimeCommand({
      commandId,
      commandType,
      requestedBy,
      payload,
    });

    await this.store.recordRecoveryEvent({
      commandId,
      eventType: 'runtime_command_requested',
      status: 'pending',
      sourceComponent: 'api-control-plane',
      actorId: requestedBy,
      message: `Runtime command ${commandType} requested.`,
      details: payload,
    });

    const command = await this.store.getRuntimeCommand(commandId);
    if (command === null) {
      throw new Error(`RuntimeControlPlane.enqueueCommand: command "${commandId}" was not persisted`);
    }
    return command;
  }

  async getCommand(commandId: string): Promise<RuntimeCommandView | null> {
    return this.store.getRuntimeCommand(commandId);
  }

  async listMismatches(limit = 100, status?: 'open' | 'acknowledged' | 'resolved'): Promise<RuntimeMismatchView[]> {
    return this.store.listMismatches(limit, status);
  }

  async acknowledgeMismatch(
    mismatchId: string,
    actorId: string,
    summary: string | null = null,
  ): Promise<RuntimeMismatchView | null> {
    const mismatch = await this.store.acknowledgeMismatch(mismatchId, actorId, summary);
    if (mismatch !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId,
        eventType: 'mismatch_acknowledged',
        status: 'acknowledged',
        sourceComponent: 'api-control-plane',
        actorId,
        message: summary ?? `Mismatch ${mismatchId} acknowledged.`,
        details: {
          mismatchId,
        },
      });
    }
    return mismatch;
  }

  async listRecoveryEvents(limit = 100): Promise<RuntimeRecoveryEventView[]> {
    return this.store.listRecoveryEvents(limit);
  }

  async activateKillSwitch(reason: string, actorId: string): Promise<RuntimeStatusView> {
    await this.store.updateRuntimeStatus({
      halted: true,
      lifecycleState: 'paused',
      reason,
      lastUpdatedBy: actorId,
    });

    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.kill_switch_activated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      data: { reason },
    });

    await this.store.recordRecoveryEvent({
      eventType: 'runtime_paused',
      status: 'acknowledged',
      sourceComponent: 'api-control-plane',
      actorId,
      message: `Runtime paused: ${reason}`,
      details: { reason },
    });

    return this.store.getRuntimeStatus();
  }

  async resume(reason: string, actorId: string): Promise<RuntimeStatusView> {
    await this.store.updateRuntimeStatus({
      halted: false,
      lifecycleState: 'ready',
      reason,
      lastUpdatedBy: actorId,
    });

    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.resumed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      data: { reason },
    });

    await this.store.recordRecoveryEvent({
      eventType: 'runtime_resumed',
      status: 'resolved',
      sourceComponent: 'api-control-plane',
      actorId,
      message: `Runtime resumed: ${reason}`,
      details: { reason },
    });

    return this.store.getRuntimeStatus();
  }

  async setExecutionMode(mode: 'dry-run'): Promise<RuntimeStatusView> {
    await this.store.updateRuntimeStatus({
      executionMode: mode,
      reason: null,
      lastUpdatedBy: 'api-control-plane',
    });

    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.execution_mode_changed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: 'api-control-plane',
      data: { mode },
    });

    return this.store.getRuntimeStatus();
  }
}
