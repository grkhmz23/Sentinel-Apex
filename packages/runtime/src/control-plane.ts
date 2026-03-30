import {
  applyMigrations,
  createDatabaseConnection,
  type DatabaseConnection,
} from '@sentinel-apex/db';
import { createId } from '@sentinel-apex/domain';

import {
  acknowledgeNextStatus,
  remediationFailureNextStatus,
  recoveryNextStatus,
  reopenNextStatus,
  resolveNextStatus,
  RuntimeMismatchLifecycleError,
  RuntimeMismatchNotFoundError,
  verifyNextStatus,
} from './mismatch-lifecycle.js';
import { DatabaseAuditWriter, RuntimeStore } from './store.js';

import type {
  AllocatorDecisionDetailView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  AuditEventView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RebalanceCurrentView,
  RebalanceProposalDetailView,
  RebalanceProposalView,
  RiskBreachView,
  RiskSummaryView,
  RuntimeCommandType,
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchRemediationView,
  RuntimeMismatchSourceKind,
  RuntimeMismatchStatus,
  RuntimeMismatchSummaryView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReadApi,
  RuntimeReconciliationFindingDetailView,
  RuntimeReconciliationFindingSeverity,
  RuntimeReconciliationFindingStatus,
  RuntimeReconciliationFindingType,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRemediationActionType,
  RuntimeRecoveryEventView,
  RuntimeStatusView,
  TreasuryActionDetailView,
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryExecutionDetailView,
  TreasuryExecutionView,
  TreasuryPolicyView,
  TreasurySummaryView,
  TreasuryVenueDetailView,
  TreasuryVenueView,
  RuntimeVerificationOutcome,
  WorkerStatusView,
} from './types.js';

function canSatisfyApprovalRequirement(
  actorRole: 'viewer' | 'operator' | 'admin',
  requiredRole: 'operator' | 'admin',
): boolean {
  if (requiredRole === 'operator') {
    return actorRole === 'operator' || actorRole === 'admin';
  }

  return actorRole === 'admin';
}

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
    const [runtime, worker, openMismatchCount, mismatchSummary, lastRecoveryEvent, latestReconciliationRun, reconciliationSummary, treasurySummary, allocatorSummary] = await Promise.all([
      this.store.getRuntimeStatus(),
      this.store.getWorkerStatus(),
      this.store.countOpenMismatches(),
      this.store.summarizeMismatches(),
      this.store.getLatestRecoveryEvent(),
      this.store.getLatestReconciliationRun(),
      this.store.summarizeLatestReconciliation(),
      this.store.getTreasurySummary(),
      this.store.getAllocatorSummary(),
    ]);

    const degradedReasons = [
      runtime.lastError,
      runtime.reason,
      worker.lastFailureReason,
      mismatchSummary.activeMismatchCount > 0 ? `${mismatchSummary.activeMismatchCount} active mismatches` : null,
    ].filter((value): value is string => value !== null && value.length > 0);

    return {
      runtime,
      worker,
      openMismatchCount,
      mismatchStatusCounts: mismatchSummary.statusCounts,
      degradedReasons,
      lastRecoveryEvent,
      latestReconciliationRun,
      reconciliationSummary,
      treasurySummary,
      allocatorSummary,
    };
  }

  private async createCommandRecord(
    commandId: string,
    commandType: RuntimeCommandType,
    requestedBy: string,
    payload: Record<string, unknown>,
  ): Promise<RuntimeCommandView> {
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
      throw new Error(`RuntimeControlPlane.createCommandRecord: command "${commandId}" was not persisted`);
    }

    return command;
  }

  async enqueueCommand(
    commandType: RuntimeCommandType,
    requestedBy: string,
    payload: Record<string, unknown> = {},
  ): Promise<RuntimeCommandView> {
    const commandId = createId();
    return this.createCommandRecord(commandId, commandType, requestedBy, payload);
  }

  async getCommand(commandId: string): Promise<RuntimeCommandView | null> {
    return this.store.getRuntimeCommand(commandId);
  }

  async listMismatches(
    limit = 100,
    filters: {
      status?: RuntimeMismatchStatus;
      severity?: string;
      sourceKind?: RuntimeMismatchSourceKind;
      category?: string;
    } = {},
  ): Promise<RuntimeMismatchView[]> {
    return this.store.listMismatches(limit, filters);
  }

  async getMismatchDetail(mismatchId: string): Promise<RuntimeMismatchDetailView | null> {
    return this.store.getMismatchDetail(mismatchId);
  }

  async summarizeMismatches(): Promise<RuntimeMismatchSummaryView> {
    return this.store.summarizeMismatches();
  }

  async listMismatchRemediationHistory(
    mismatchId: string,
    limit = 50,
  ): Promise<RuntimeMismatchRemediationView[]> {
    await this.getRequiredMismatch(mismatchId);
    return this.store.listMismatchRemediations(mismatchId, limit);
  }

  async getLatestMismatchRemediation(
    mismatchId: string,
  ): Promise<RuntimeMismatchRemediationView | null> {
    await this.getRequiredMismatch(mismatchId);
    return this.store.getLatestMismatchRemediation(mismatchId);
  }

  async enqueueReconciliationRun(
    requestedBy: string,
    payload: Record<string, unknown> = {},
  ): Promise<RuntimeCommandView> {
    return this.enqueueCommand('run_reconciliation', requestedBy, payload);
  }

  async enqueueTreasuryEvaluation(
    requestedBy: string,
    payload: Record<string, unknown> = {},
  ): Promise<RuntimeCommandView> {
    return this.enqueueCommand('run_treasury_evaluation', requestedBy, payload);
  }

  async enqueueAllocatorEvaluation(
    requestedBy: string,
    payload: Record<string, unknown> = {},
  ): Promise<RuntimeCommandView> {
    return this.enqueueCommand('run_allocator_evaluation', requestedBy, payload);
  }

  async getAllocatorSummary(): Promise<AllocatorSummaryView | null> {
    return this.store.getAllocatorSummary();
  }

  async listAllocatorTargets(limit = 20): Promise<AllocatorSleeveTargetView[]> {
    return this.store.listAllocatorTargets(limit);
  }

  async listAllocatorRuns(limit = 20): Promise<AllocatorRunView[]> {
    return this.store.listAllocatorRuns(limit);
  }

  async getAllocatorDecision(
    allocatorRunId: string,
  ): Promise<AllocatorDecisionDetailView | null> {
    return this.store.getAllocatorDecision(allocatorRunId);
  }

  async listRebalanceProposals(limit = 50): Promise<RebalanceProposalView[]> {
    return this.store.listRebalanceProposals(limit);
  }

  async listRebalanceProposalsForDecision(
    allocatorRunId: string,
  ): Promise<RebalanceProposalView[]> {
    return this.store.listRebalanceProposalsForDecision(allocatorRunId);
  }

  async getRebalanceProposal(proposalId: string): Promise<RebalanceProposalDetailView | null> {
    return this.store.getRebalanceProposal(proposalId);
  }

  async getRebalanceCurrent(): Promise<RebalanceCurrentView | null> {
    return this.store.getRebalanceCurrent();
  }

  async getTreasurySummary(): Promise<TreasurySummaryView | null> {
    return this.store.getTreasurySummary();
  }

  async listTreasuryAllocations(limit = 50): Promise<TreasuryAllocationView[]> {
    return this.store.listTreasuryAllocations(limit);
  }

  async getTreasuryPolicy(): Promise<TreasuryPolicyView | null> {
    return this.store.getTreasuryPolicy();
  }

  async listTreasuryActions(limit = 50): Promise<TreasuryActionView[]> {
    return this.store.listTreasuryActions(limit);
  }

  async getTreasuryAction(actionId: string): Promise<TreasuryActionDetailView | null> {
    return this.store.getTreasuryAction(actionId);
  }

  async listTreasuryExecutions(limit = 50): Promise<TreasuryExecutionView[]> {
    return this.store.listTreasuryExecutions(limit);
  }

  async getTreasuryExecution(executionId: string): Promise<TreasuryExecutionView | null> {
    return this.store.getTreasuryExecution(executionId);
  }

  async getTreasuryExecutionDetail(executionId: string): Promise<TreasuryExecutionDetailView | null> {
    return this.store.getTreasuryExecutionDetail(executionId);
  }

  async listTreasuryVenues(limit = 50): Promise<TreasuryVenueView[]> {
    return this.store.listTreasuryVenues(limit);
  }

  async getTreasuryVenue(venueId: string): Promise<TreasuryVenueDetailView | null> {
    return this.store.getTreasuryVenue(venueId);
  }

  async approveTreasuryAction(
    actionId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<TreasuryActionView | null> {
    const detail = await this.store.getTreasuryAction(actionId);
    if (detail === null) {
      return null;
    }

    if (!detail.action.executable || detail.action.readiness === 'blocked') {
      throw new Error('Treasury action is blocked and cannot be approved.');
    }

    if (!canSatisfyApprovalRequirement(actorRole, detail.action.approvalRequirement)) {
      throw new Error(
        `Treasury action requires ${detail.action.approvalRequirement} approval.`,
      );
    }

    const approved = await this.store.approveTreasuryAction(actionId, actorId);
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'treasury.action_approved',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'treasury',
      data: {
        treasuryActionId: actionId,
        approvalRequirement: detail.action.approvalRequirement,
      },
    });

    return approved;
  }

  async enqueueTreasuryActionExecution(
    actionId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RuntimeCommandView | null> {
    const detail = await this.store.getTreasuryAction(actionId);
    if (detail === null) {
      return null;
    }

    if (detail.action.readiness === 'blocked' || !detail.action.executable) {
      throw new Error('Treasury action is blocked and cannot be executed.');
    }

    if (detail.action.status !== 'approved') {
      throw new Error('Treasury action must be approved before execution.');
    }

    if (!canSatisfyApprovalRequirement(actorRole, detail.action.approvalRequirement)) {
      throw new Error(
        `Treasury action requires ${detail.action.approvalRequirement} approval.`,
      );
    }

    const command = await this.enqueueCommand('execute_treasury_action', actorId, {
      treasuryActionId: actionId,
      actorId,
    });
    await this.store.queueTreasuryActionExecution({
      actionId,
      commandId: command.commandId,
      actorId,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'treasury.action_execution_queued',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'treasury',
      data: {
        treasuryActionId: actionId,
        commandId: command.commandId,
      },
    });

    return command;
  }

  async approveRebalanceProposal(
    proposalId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RuntimeCommandView | null> {
    const detail = await this.store.getRebalanceProposal(proposalId);
    if (detail === null) {
      return null;
    }

    if (!detail.proposal.executable || detail.proposal.blockedReasons.length > 0) {
      throw new Error('Rebalance proposal is blocked and cannot be approved.');
    }

    if (!canSatisfyApprovalRequirement(actorRole, detail.proposal.approvalRequirement)) {
      throw new Error(
        `Rebalance proposal requires ${detail.proposal.approvalRequirement} approval.`,
      );
    }

    if (detail.proposal.status !== 'proposed') {
      throw new Error(`Rebalance proposal cannot be approved from status "${detail.proposal.status}".`);
    }

    await this.store.approveRebalanceProposal(proposalId, actorId);
    const command = await this.enqueueCommand('execute_rebalance_proposal', actorId, {
      proposalId,
      actorId,
    });
    await this.store.queueRebalanceProposalExecution({
      proposalId,
      commandId: command.commandId,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.rebalance_approved',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        proposalId,
        allocatorRunId: detail.proposal.allocatorRunId,
        commandId: command.commandId,
      },
    });

    return command;
  }

  async rejectRebalanceProposal(
    proposalId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
    reason: string,
  ): Promise<RebalanceProposalView | null> {
    const detail = await this.store.getRebalanceProposal(proposalId);
    if (detail === null) {
      return null;
    }

    if (!canSatisfyApprovalRequirement(actorRole, detail.proposal.approvalRequirement)) {
      throw new Error(
        `Rebalance proposal requires ${detail.proposal.approvalRequirement} approval.`,
      );
    }

    if (detail.proposal.status !== 'proposed') {
      throw new Error(`Rebalance proposal cannot be rejected from status "${detail.proposal.status}".`);
    }

    const rejected = await this.store.rejectRebalanceProposal(proposalId, actorId, reason);
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.rebalance_rejected',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        proposalId,
        allocatorRunId: detail.proposal.allocatorRunId,
        reason,
      },
    });

    return rejected;
  }

  async listReconciliationRuns(limit = 50): Promise<RuntimeReconciliationRunView[]> {
    return this.store.listReconciliationRuns(limit);
  }

  async getReconciliationRun(
    reconciliationRunId: string,
  ): Promise<RuntimeReconciliationRunView | null> {
    return this.store.getReconciliationRun(reconciliationRunId);
  }

  async listReconciliationFindings(input: {
    limit?: number;
    findingType?: RuntimeReconciliationFindingType;
    severity?: RuntimeReconciliationFindingSeverity;
    status?: RuntimeReconciliationFindingStatus;
    mismatchId?: string;
    reconciliationRunId?: string;
  } = {}): Promise<RuntimeReconciliationFindingView[]> {
    return this.store.listReconciliationFindings({
      limit: input.limit ?? 100,
      ...(input.findingType !== undefined ? { findingType: input.findingType } : {}),
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.mismatchId !== undefined ? { mismatchId: input.mismatchId } : {}),
      ...(input.reconciliationRunId !== undefined
        ? { reconciliationRunId: input.reconciliationRunId }
        : {}),
    });
  }

  async getReconciliationFinding(
    findingId: string,
  ): Promise<RuntimeReconciliationFindingDetailView | null> {
    return this.store.getReconciliationFindingDetail(findingId);
  }

  async getReconciliationSummary(): Promise<RuntimeReconciliationSummaryView | null> {
    return this.store.summarizeLatestReconciliation();
  }

  async listRuntimeCommands(limit = 100): Promise<RuntimeCommandView[]> {
    return this.store.listRuntimeCommands(limit);
  }

  async listMismatchFindings(
    mismatchId: string,
    limit = 100,
  ): Promise<RuntimeReconciliationFindingView[]> {
    await this.getRequiredMismatch(mismatchId);
    return this.store.listReconciliationFindings({
      limit,
      mismatchId,
    });
  }

  async remediateMismatch(input: {
    mismatchId: string;
    actorId: string;
    remediationType: RuntimeRemediationActionType;
    summary?: string | null;
  }): Promise<RuntimeMismatchRemediationView> {
    const mismatch = await this.getRequiredMismatch(input.mismatchId);
    if (mismatch.status === 'resolved' || mismatch.status === 'verified') {
      throw new RuntimeMismatchLifecycleError(
        `Cannot start remediation for mismatch "${input.mismatchId}" from status "${mismatch.status}".`,
      );
    }

    const inFlight = await this.store.getInFlightMismatchRemediation(input.mismatchId);
    if (inFlight !== null) {
      throw new RuntimeMismatchLifecycleError(
        `Mismatch "${input.mismatchId}" already has remediation "${inFlight.id}" in flight.`,
      );
    }

    const runtimeStatus = await this.store.getRuntimeStatus();
    if (
      input.remediationType === 'run_cycle'
      && (runtimeStatus.halted || runtimeStatus.lifecycleState === 'paused' || runtimeStatus.lifecycleState === 'stopped')
    ) {
      throw new RuntimeMismatchLifecycleError(
        `Cannot start run_cycle remediation while runtime is ${runtimeStatus.lifecycleState}.`,
      );
    }

    const summary = input.summary?.trim() ?? null;
    const commandId = createId();
    const payload: Record<string, unknown> = {
      ...(input.remediationType === 'run_cycle'
        ? { triggerSource: `mismatch-remediation:${input.mismatchId}` }
        : {}),
      remediation: {
        mismatchId: input.mismatchId,
        remediationType: input.remediationType,
        requestedBy: input.actorId,
      },
    };

    await this.createCommandRecord(commandId, input.remediationType, input.actorId, payload);
    const remediation = await this.store.createMismatchRemediation({
      mismatchId: input.mismatchId,
      remediationType: input.remediationType,
      commandId,
      requestedBy: input.actorId,
      requestedSummary: summary,
    });

    const nextStatus = recoveryNextStatus(mismatch.status);
    await this.store.updateMismatchById(input.mismatchId, {
      status: nextStatus,
      recoveryStartedAt: new Date(),
      recoveryStartedBy: input.actorId,
      recoverySummary: summary ?? `Remediation ${input.remediationType} requested.`,
      linkedCommandId: commandId,
      linkedRecoveryEventId: null,
      lastStatusChangeAt: new Date(),
    });

    await this.store.recordRecoveryEvent({
      mismatchId: input.mismatchId,
      commandId,
      eventType: 'mismatch_remediation_requested',
      status: nextStatus,
      sourceComponent: 'api-control-plane',
      actorId: input.actorId,
      message: summary ?? `Mismatch remediation ${input.remediationType} requested.`,
      details: {
        mismatchId: input.mismatchId,
        remediationId: remediation.id,
        remediationType: input.remediationType,
      },
    });

    return this.store.getMismatchRemediationById(remediation.id).then((result) => {
      if (result === null) {
        throw new Error(`RuntimeControlPlane.remediateMismatch: remediation "${remediation.id}" was not persisted`);
      }
      return result;
    });
  }

  async acknowledgeMismatch(
    mismatchId: string,
    actorId: string,
    summary: string | null = null,
  ): Promise<RuntimeMismatchView | null> {
    const mismatch = await this.getRequiredMismatch(mismatchId);
    const nextStatus = acknowledgeNextStatus(mismatch.status);

    if (nextStatus === mismatch.status) {
      return mismatch;
    }

    const updated = await this.store.updateMismatchById(mismatchId, {
      status: nextStatus,
      acknowledgedAt: new Date(),
      acknowledgedBy: actorId,
      lastStatusChangeAt: new Date(),
    });

    if (updated !== null) {
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

    return updated;
  }

  async startMismatchRecovery(input: {
    mismatchId: string;
    actorId: string;
    summary: string | null;
    commandId?: string | null;
    linkedRecoveryEventId?: string | null;
  }): Promise<RuntimeMismatchView | null> {
    if (
      (input.summary === null || input.summary.trim().length === 0)
      && (input.commandId === undefined || input.commandId === null)
      && (input.linkedRecoveryEventId === undefined || input.linkedRecoveryEventId === null)
    ) {
      throw new RuntimeMismatchLifecycleError(
        'Recovery start requires a summary, linked commandId, or linked recoveryEventId.',
      );
    }

    const mismatch = await this.getRequiredMismatch(input.mismatchId);
    const nextStatus = recoveryNextStatus(mismatch.status);

    if (nextStatus === mismatch.status) {
      return mismatch;
    }

    const updated = await this.store.updateMismatchById(input.mismatchId, {
      status: nextStatus,
      recoveryStartedAt: new Date(),
      recoveryStartedBy: input.actorId,
      recoverySummary: input.summary,
      linkedCommandId: input.commandId ?? null,
      linkedRecoveryEventId: input.linkedRecoveryEventId ?? null,
      lastStatusChangeAt: new Date(),
    });

    if (updated !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId: input.mismatchId,
        commandId: input.commandId ?? null,
        eventType: 'mismatch_recovery_started',
        status: 'recovering',
        sourceComponent: 'api-control-plane',
        actorId: input.actorId,
        message: input.summary ?? `Mismatch ${input.mismatchId} moved to recovering.`,
        details: {
          mismatchId: input.mismatchId,
          linkedRecoveryEventId: input.linkedRecoveryEventId ?? null,
        },
      });
    }

    return updated;
  }

  async resolveMismatch(input: {
    mismatchId: string;
    actorId: string;
    summary: string;
    commandId?: string | null;
    linkedRecoveryEventId?: string | null;
  }): Promise<RuntimeMismatchView | null> {
    if (input.summary.trim().length === 0) {
      throw new RuntimeMismatchLifecycleError('Mismatch resolution summary is required.');
    }

    const mismatch = await this.getRequiredMismatch(input.mismatchId);
    const nextStatus = resolveNextStatus(mismatch.status);

    if (nextStatus === mismatch.status) {
      return mismatch;
    }

    const now = new Date();
    const updated = await this.store.updateMismatchById(input.mismatchId, {
      status: nextStatus,
      resolvedAt: now,
      resolvedBy: input.actorId,
      resolutionSummary: input.summary,
      linkedCommandId: input.commandId ?? mismatch.linkedCommandId,
      linkedRecoveryEventId: input.linkedRecoveryEventId ?? mismatch.linkedRecoveryEventId,
      lastStatusChangeAt: now,
    });

    if (updated !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId: input.mismatchId,
        commandId: input.commandId ?? mismatch.linkedCommandId,
        eventType: 'mismatch_resolved',
        status: 'resolved',
        sourceComponent: 'api-control-plane',
        actorId: input.actorId,
        message: input.summary,
        details: {
          mismatchId: input.mismatchId,
          linkedRecoveryEventId: input.linkedRecoveryEventId ?? mismatch.linkedRecoveryEventId,
        },
      });
    }

    return updated;
  }

  async verifyMismatch(input: {
    mismatchId: string;
    actorId: string;
    summary: string;
    outcome?: RuntimeVerificationOutcome;
  }): Promise<RuntimeMismatchView | null> {
    const outcome = input.outcome ?? 'verified';
    if (input.summary.trim().length === 0) {
      throw new RuntimeMismatchLifecycleError('Mismatch verification summary is required.');
    }

    const mismatch = await this.getRequiredMismatch(input.mismatchId);
    const nextStatus = verifyNextStatus(mismatch.status, outcome);

    if (nextStatus === mismatch.status) {
      return mismatch;
    }

    const now = new Date();
    const updated = await this.store.updateMismatchById(input.mismatchId, {
      status: nextStatus,
      verifiedAt: now,
      verifiedBy: input.actorId,
      verificationSummary: input.summary,
      verificationOutcome: outcome,
      ...(outcome === 'failed'
        ? {
          reopenedAt: now,
          reopenedBy: input.actorId,
          reopenSummary: input.summary,
        }
        : {}),
      lastStatusChangeAt: now,
    });

    if (mismatch !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId: input.mismatchId,
        eventType: outcome === 'verified' ? 'mismatch_verified' : 'mismatch_verification_failed',
        status: outcome === 'verified' ? 'verified' : 'reopened',
        sourceComponent: 'api-control-plane',
        actorId: input.actorId,
        message: input.summary,
        details: {
          mismatchId: input.mismatchId,
          outcome,
        },
      });
    }

    return updated;
  }

  async reopenMismatch(
    mismatchId: string,
    actorId: string,
    summary: string,
  ): Promise<RuntimeMismatchView | null> {
    if (summary.trim().length === 0) {
      throw new RuntimeMismatchLifecycleError('Mismatch reopen summary is required.');
    }

    const mismatch = await this.getRequiredMismatch(mismatchId);
    const nextStatus = reopenNextStatus(mismatch.status);

    if (nextStatus === mismatch.status) {
      return mismatch;
    }

    const updated = await this.store.updateMismatchById(mismatchId, {
      status: nextStatus,
      reopenedAt: new Date(),
      reopenedBy: actorId,
      reopenSummary: summary,
      lastStatusChangeAt: new Date(),
    });

    if (updated !== null) {
      await this.store.recordRecoveryEvent({
        mismatchId,
        commandId: updated.linkedCommandId,
        eventType: 'mismatch_reopened',
        status: 'reopened',
        sourceComponent: 'api-control-plane',
        actorId,
        message: summary,
        details: {
          mismatchId,
        },
      });
    }

    return updated;
  }

  async listRecoveryEvents(limit = 100): Promise<RuntimeRecoveryEventView[]> {
    return this.store.listRecoveryEvents(limit);
  }

  async listRecoveryOutcomes(limit = 100): Promise<RuntimeRecoveryEventView[]> {
    return this.store.listRecoveryOutcomes(limit);
  }

  async recordFailedRemediationOutcome(input: {
    mismatchId: string;
    commandId: string;
    remediationId: string;
    actorId: string;
    summary: string;
  }): Promise<RuntimeMismatchView | null> {
    const mismatch = await this.getRequiredMismatch(input.mismatchId);
    const nextStatus = remediationFailureNextStatus(mismatch.status);
    const event = await this.store.recordRecoveryEvent({
      mismatchId: input.mismatchId,
      commandId: input.commandId,
      eventType: 'mismatch_remediation_failed',
      status: nextStatus,
      sourceComponent: 'runtime-worker',
      actorId: input.actorId,
      message: input.summary,
      details: {
        mismatchId: input.mismatchId,
        remediationId: input.remediationId,
      },
    });

    await this.store.updateMismatchRemediationById(input.remediationId, {
      status: 'failed',
      failedAt: new Date(),
      outcomeSummary: input.summary,
      latestRecoveryEventId: event.id,
    });

    return this.store.updateMismatchById(input.mismatchId, {
      status: nextStatus,
      linkedCommandId: input.commandId,
      linkedRecoveryEventId: event.id,
      reopenedAt: new Date(),
      reopenedBy: input.actorId,
      reopenSummary: input.summary,
      lastStatusChangeAt: new Date(),
    });
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

  private async getRequiredMismatch(mismatchId: string): Promise<RuntimeMismatchView> {
    const mismatch = await this.store.getMismatchById(mismatchId);
    if (mismatch === null) {
      throw new RuntimeMismatchNotFoundError(`Mismatch "${mismatchId}" was not found.`);
    }
    return mismatch;
  }
}
