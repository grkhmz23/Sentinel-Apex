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
  CarryActionDetailView,
  CarryStrategyProfileView,
  CarryActionView,
  CarryExecutionDetailView,
  CarryExecutionView,
  CarryVenueView,
  ConnectorPromotionDetailView,
  ConnectorPromotionEventView,
  ConnectorPromotionOverviewView,
  ConnectorReadinessEvidenceView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  PositionView,
  RecordSubmissionEvidenceInput,
  RecordVaultDepositInput,
  RebalanceBundleRecoveryActionType,
  RebalanceBundleRecoveryActionView,
  RebalanceBundleRecoveryCandidateView,
  RebalanceBundleEscalationEventView,
  RebalanceEscalationQueueFilters,
  RebalanceEscalationQueueItemView,
  RebalanceEscalationQueueSummaryView,
  RebalanceBundleEscalationTransitionView,
  RebalanceBundleEscalationView,
  RebalanceBundleResolutionActionType,
  RebalanceBundleResolutionActionView,
  RebalanceBundleResolutionOptionView,
  RebalanceBundleDetailView,
  RebalanceBundleView,
  RebalanceCurrentView,
  RebalanceExecutionGraphView,
  RebalanceExecutionTimelineEntry,
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
  RequestVaultRedemptionInput,
  VenueDetailView,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueInventoryItemView,
  VenueInventorySummaryView,
  VenueSnapshotView,
  VenueTruthSummaryView,
  VaultDepositLotView,
  VaultDepositorView,
  VaultRedemptionRequestView,
  VaultSummaryView,
  TreasuryVenueDetailView,
  TreasuryVenueView,
  InternalDerivativeSnapshotView,
  PortfolioPnlResult,
  RuntimeVerificationOutcome,
  SubmissionDossierView,
  SubmissionEvidenceRecordView,
  SubmissionExportBundleView,
  UpsertSubmissionDossierInput,
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

  async getVaultSummary(): Promise<VaultSummaryView> {
    return this.store.getVaultSummary();
  }

  async getSubmissionDossier(): Promise<SubmissionDossierView> {
    return this.store.getSubmissionDossier();
  }

  async listSubmissionEvidence(): Promise<SubmissionEvidenceRecordView[]> {
    return this.store.listSubmissionEvidence();
  }

  async getSubmissionExportBundle(): Promise<SubmissionExportBundleView> {
    return this.store.getSubmissionExportBundle();
  }

  async listVaultDepositors(limit = 100): Promise<VaultDepositorView[]> {
    return this.store.listVaultDepositors(limit);
  }

  async listVaultDepositLots(limit = 100): Promise<VaultDepositLotView[]> {
    return this.store.listVaultDepositLots(limit);
  }

  async listVaultRedemptionRequests(limit = 100): Promise<VaultRedemptionRequestView[]> {
    return this.store.listVaultRedemptionRequests(limit);
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

  async recordVaultDeposit(
    actorId: string,
    input: RecordVaultDepositInput,
  ): Promise<VaultDepositLotView> {
    const deposit = await this.store.recordVaultDeposit(input);
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'vault.deposit_recorded',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'carry',
      data: {
        vaultId: deposit.vaultId,
        depositLotId: deposit.depositLotId,
        depositorId: deposit.depositorId,
        depositedAmount: deposit.depositedAmount,
        mintedShares: deposit.mintedShares,
        lockExpiresAt: deposit.lockExpiresAt,
      },
    });
    return deposit;
  }

  async requestVaultRedemption(
    actorId: string,
    input: RequestVaultRedemptionInput,
  ): Promise<VaultRedemptionRequestView> {
    const request = await this.store.requestVaultRedemption(input);
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'vault.redemption_requested',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'carry',
      data: {
        vaultId: request.vaultId,
        requestId: request.requestId,
        depositorId: request.depositorId,
        requestedShares: request.requestedShares,
        estimatedAssets: request.estimatedAssets,
        eligibleAt: request.eligibleAt,
        status: request.status,
      },
    });
    return request;
  }

  async upsertSubmissionDossier(
    actorId: string,
    input: UpsertSubmissionDossierInput,
  ): Promise<SubmissionDossierView> {
    const dossier = await this.store.upsertSubmissionDossier(input);
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'vault.submission_dossier_updated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'carry',
      data: {
        submissionId: dossier.submissionId,
        track: dossier.track,
        cluster: dossier.cluster,
        addressScope: dossier.addressScope,
        walletAddress: dossier.walletAddress,
        vaultAddress: dossier.vaultAddress,
        cexExecutionUsed: dossier.cexExecutionUsed,
        cexVenues: dossier.cexVenues,
        readinessStatus: dossier.readiness.status,
        blockedReasons: dossier.readiness.blockedReasons,
      },
    });
    return dossier;
  }

  async recordSubmissionEvidence(
    actorId: string,
    input: RecordSubmissionEvidenceInput,
  ): Promise<SubmissionEvidenceRecordView> {
    const evidence = await this.store.recordSubmissionEvidence(input);
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'vault.submission_evidence_recorded',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'carry',
      data: {
        submissionId: evidence.submissionId,
        evidenceId: evidence.evidenceId,
        evidenceType: evidence.evidenceType,
        status: evidence.status,
        source: evidence.source,
        label: evidence.label,
        capturedAt: evidence.capturedAt,
        withinBuildWindow: evidence.withinBuildWindow,
      },
    });
    return evidence;
  }

  async listCarryRecommendations(limit = 50): Promise<CarryActionView[]> {
    return this.store.listCarryRecommendations(limit);
  }

  async listCarryActions(limit = 50): Promise<CarryActionView[]> {
    return this.store.listCarryActions(limit);
  }

  async getCarryStrategyProfile(): Promise<CarryStrategyProfileView> {
    return this.store.getCarryStrategyProfile();
  }

  async getCarryAction(actionId: string): Promise<CarryActionDetailView | null> {
    return this.store.getCarryAction(actionId);
  }

  async listCarryExecutions(limit = 50): Promise<CarryExecutionView[]> {
    return this.store.listCarryExecutions(limit);
  }

  async listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]> {
    return this.store.listCarryExecutionsForAction(actionId);
  }

  async getCarryExecution(executionId: string): Promise<CarryExecutionDetailView | null> {
    return this.store.getCarryExecution(executionId);
  }

  async listCarryVenues(limit = 50): Promise<CarryVenueView[]> {
    return this.store.listCarryVenues(limit);
  }

  async listVenues(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.store.listVenues(limit);
  }

  async getVenue(venueId: string): Promise<VenueDetailView | null> {
    return this.store.getVenue(venueId);
  }

  async listVenueSnapshots(venueId: string, limit = 20): Promise<VenueSnapshotView[]> {
    return this.store.listVenueSnapshots(venueId, limit);
  }

  async getVenueInternalState(venueId: string): Promise<InternalDerivativeSnapshotView | null> {
    return this.store.getVenueInternalState(venueId);
  }

  async getVenueComparisonSummary(
    venueId: string,
  ): Promise<VenueDerivativeComparisonSummaryView | null> {
    return this.store.getVenueComparisonSummary(venueId);
  }

  async getVenueComparisonDetail(
    venueId: string,
  ): Promise<VenueDerivativeComparisonDetailView | null> {
    return this.store.getVenueComparisonDetail(venueId);
  }

  async getVenueSummary(): Promise<VenueInventorySummaryView> {
    return this.store.getVenueSummary();
  }

  async getVenueTruthSummary(): Promise<VenueTruthSummaryView> {
    return this.store.getVenueTruthSummary();
  }

  async listVenueReadiness(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.store.listVenueReadiness(limit);
  }

  async getConnectorPromotionOverview(): Promise<ConnectorPromotionOverviewView> {
    return this.store.getConnectorPromotionOverview();
  }

  async getConnectorPromotion(venueId: string): Promise<ConnectorPromotionDetailView | null> {
    return this.store.getConnectorPromotion(venueId);
  }

  async listConnectorPromotionHistory(venueId: string): Promise<ConnectorPromotionEventView[]> {
    return this.store.listConnectorPromotionHistory(venueId);
  }

  async getConnectorPromotionEligibility(
    venueId: string,
  ): Promise<ConnectorReadinessEvidenceView | null> {
    return this.store.getConnectorPromotionEligibility(venueId);
  }

  async requestConnectorPromotion(
    venueId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
    note?: string | null,
  ): Promise<ConnectorPromotionDetailView | null> {
    if (!canSatisfyApprovalRequirement(actorRole, 'operator')) {
      throw new Error('Connector promotion requests require operator access.');
    }

    const detail = await this.store.getConnectorPromotion(venueId);
    if (detail === null) {
      return null;
    }

    if (detail.evidence.capabilityClass !== 'execution_capable') {
      throw new Error('Only execution-capable connectors can enter promotion review.');
    }

    if (detail.current.promotionStatus === 'pending_review') {
      throw new Error('Connector already has a pending promotion review.');
    }

    if (detail.current.promotionStatus === 'approved') {
      throw new Error('Connector is already approved for live use.');
    }

    const updated = await this.store.requestConnectorPromotion({
      venueId,
      actorId,
      note: note ?? null,
    });
    if (updated !== null) {
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'connector.promotion_requested',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'runtime',
        data: {
          venueId,
          capabilityClass: detail.evidence.capabilityClass,
          blockers: detail.evidence.blockingReasons,
          note: note ?? null,
        },
      });
    }

    return updated;
  }

  async approveConnectorPromotion(
    venueId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
    note?: string | null,
  ): Promise<ConnectorPromotionDetailView | null> {
    if (!canSatisfyApprovalRequirement(actorRole, 'admin')) {
      throw new Error('Connector promotion approval requires admin access.');
    }

    const detail = await this.store.getConnectorPromotion(venueId);
    if (detail === null) {
      return null;
    }

    if (detail.current.promotionStatus !== 'pending_review') {
      throw new Error(
        `Connector promotion cannot be approved from status "${detail.current.promotionStatus}".`,
      );
    }

    if (!detail.evidence.eligibleForPromotion) {
      throw new Error(detail.evidence.blockingReasons.join('; '));
    }

    const updated = await this.store.approveConnectorPromotion({
      venueId,
      actorId,
      note: note ?? null,
    });
    if (updated !== null) {
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'connector.promotion_approved',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'runtime',
        data: {
          venueId,
          blockers: detail.evidence.blockingReasons,
          note: note ?? null,
        },
      });
    }

    return updated;
  }

  async rejectConnectorPromotion(
    venueId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
    note: string,
  ): Promise<ConnectorPromotionDetailView | null> {
    if (!canSatisfyApprovalRequirement(actorRole, 'admin')) {
      throw new Error('Connector promotion rejection requires admin access.');
    }

    const detail = await this.store.getConnectorPromotion(venueId);
    if (detail === null) {
      return null;
    }

    if (detail.current.promotionStatus !== 'pending_review') {
      throw new Error(
        `Connector promotion cannot be rejected from status "${detail.current.promotionStatus}".`,
      );
    }

    const updated = await this.store.rejectConnectorPromotion({
      venueId,
      actorId,
      note,
    });
    if (updated !== null) {
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'connector.promotion_rejected',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'runtime',
        data: {
          venueId,
          note,
        },
      });
    }

    return updated;
  }

  async suspendConnectorPromotion(
    venueId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
    note: string,
  ): Promise<ConnectorPromotionDetailView | null> {
    if (!canSatisfyApprovalRequirement(actorRole, 'admin')) {
      throw new Error('Connector promotion suspension requires admin access.');
    }

    const detail = await this.store.getConnectorPromotion(venueId);
    if (detail === null) {
      return null;
    }

    if (detail.current.promotionStatus !== 'approved') {
      throw new Error(
        `Connector promotion cannot be suspended from status "${detail.current.promotionStatus}".`,
      );
    }

    const updated = await this.store.suspendConnectorPromotion({
      venueId,
      actorId,
      note,
    });
    if (updated !== null) {
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'connector.promotion_suspended',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'runtime',
        data: {
          venueId,
          note,
        },
      });
    }

    return updated;
  }

  async getWorkerStatus(): Promise<WorkerStatusView> {
    return this.store.getWorkerStatus();
  }

  async getRuntimeOverview(): Promise<RuntimeOverviewView> {
    const [
      runtime,
      worker,
      openMismatchCount,
      mismatchSummary,
      lastRecoveryEvent,
      latestReconciliationRun,
      reconciliationSummary,
      treasurySummary,
      allocatorSummary,
    ] = await Promise.all([
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
      mismatchSummary.activeMismatchCount > 0
        ? `${mismatchSummary.activeMismatchCount} active mismatches`
        : null,
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
      throw new Error(
        `RuntimeControlPlane.createCommandRecord: command "${commandId}" was not persisted`,
      );
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

  async enqueueCarryEvaluation(
    requestedBy: string,
    payload: Record<string, unknown> = {},
  ): Promise<RuntimeCommandView> {
    return this.enqueueCommand('run_carry_evaluation', requestedBy, payload);
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

  async getAllocatorDecision(allocatorRunId: string): Promise<AllocatorDecisionDetailView | null> {
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

  async listRebalanceBundles(limit = 50): Promise<RebalanceBundleView[]> {
    return this.store.listRebalanceBundles(limit);
  }

  async getRebalanceBundle(bundleId: string): Promise<RebalanceBundleDetailView | null> {
    return this.store.getRebalanceBundle(bundleId);
  }

  async getRebalanceBundleForProposal(
    proposalId: string,
  ): Promise<RebalanceBundleDetailView | null> {
    return this.store.getRebalanceBundleForProposal(proposalId);
  }

  async listRebalanceBundleRecoveryActions(
    bundleId: string,
  ): Promise<RebalanceBundleRecoveryActionView[]> {
    return this.store.listRebalanceBundleRecoveryActions(bundleId);
  }

  async getRebalanceBundleRecoveryAction(
    bundleId: string,
    recoveryActionId: string,
  ): Promise<RebalanceBundleRecoveryActionView | null> {
    return this.store.getRebalanceBundleRecoveryAction(bundleId, recoveryActionId);
  }

  async listRebalanceBundleRecoveryCandidates(
    bundleId: string,
  ): Promise<RebalanceBundleRecoveryCandidateView[]> {
    return this.store.listRebalanceBundleRecoveryCandidates(bundleId);
  }

  async listRebalanceBundleResolutionActions(
    bundleId: string,
  ): Promise<RebalanceBundleResolutionActionView[]> {
    return this.store.listRebalanceBundleResolutionActions(bundleId);
  }

  async getRebalanceBundleResolutionAction(
    bundleId: string,
    resolutionActionId: string,
  ): Promise<RebalanceBundleResolutionActionView | null> {
    return this.store.getRebalanceBundleResolutionAction(bundleId, resolutionActionId);
  }

  async listRebalanceBundleResolutionOptions(
    bundleId: string,
  ): Promise<RebalanceBundleResolutionOptionView[]> {
    return this.store.listRebalanceBundleResolutionOptions(bundleId);
  }

  async getRebalanceBundleEscalation(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationView | null> {
    return this.store.getRebalanceBundleEscalation(bundleId);
  }

  async listRebalanceEscalations(
    filters: RebalanceEscalationQueueFilters = {},
  ): Promise<RebalanceEscalationQueueItemView[]> {
    return this.store.listRebalanceEscalations(filters);
  }

  async getRebalanceEscalationSummary(
    actorId?: string | null,
  ): Promise<RebalanceEscalationQueueSummaryView> {
    return this.store.getRebalanceEscalationSummary(actorId);
  }

  async listRebalanceBundleEscalationHistory(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationEventView[]> {
    return this.store.listRebalanceBundleEscalationHistory(bundleId);
  }

  async listRebalanceBundleEscalationTransitions(
    bundleId: string,
  ): Promise<RebalanceBundleEscalationTransitionView[]> {
    return this.store.listRebalanceBundleEscalationTransitions(bundleId);
  }

  async requestRebalanceBundleRecoveryAction(
    bundleId: string,
    input: {
      recoveryActionType: RebalanceBundleRecoveryActionType;
      targetChildType: RebalanceBundleRecoveryActionView['targetChildType'];
      targetChildId: string;
      note?: string | null;
    },
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RebalanceBundleRecoveryActionView | null> {
    const bundle = await this.store.getRebalanceBundle(bundleId);
    if (bundle === null) {
      return null;
    }

    const candidate = bundle.recoveryCandidates.find(
      (item) =>
        item.recoveryActionType === input.recoveryActionType &&
        item.targetChildType === input.targetChildType &&
        item.targetChildId === input.targetChildId,
    );
    if (candidate === undefined) {
      throw new Error('Bundle recovery target was not found.');
    }

    if (!canSatisfyApprovalRequirement(actorRole, candidate.approvalRequirement)) {
      throw new Error(`Bundle recovery action requires ${candidate.approvalRequirement} approval.`);
    }

    const requestedAt = new Date();
    const baseRecoveryAction = await this.store.createRebalanceBundleRecoveryAction({
      bundleId: candidate.bundleId,
      proposalId: candidate.proposalId,
      recoveryActionType: candidate.recoveryActionType,
      targetChildType: candidate.targetChildType,
      targetChildId: candidate.targetChildId,
      targetChildStatus: candidate.targetChildStatus,
      targetChildSummary: candidate.targetChildSummary,
      eligibilityState: candidate.eligibilityState,
      blockedReasons: candidate.blockedReasons,
      approvalRequirement: candidate.approvalRequirement,
      status: candidate.eligibilityState === 'eligible' ? 'requested' : 'blocked',
      requestedBy: actorId,
      note: input.note ?? null,
      targetCommandType: candidate.targetCommandType,
      linkedCarryActionId:
        candidate.targetChildType === 'carry_action' ? candidate.targetChildId : null,
      linkedTreasuryActionId:
        candidate.targetChildType === 'treasury_action' ? candidate.targetChildId : null,
      outcomeSummary:
        candidate.eligibilityState === 'eligible'
          ? null
          : (candidate.blockedReasons[0]?.message ?? 'Bundle recovery request remained blocked.'),
      outcome: {
        blockedReasons: candidate.blockedReasons,
      },
      lastError:
        candidate.eligibilityState === 'eligible'
          ? null
          : (candidate.blockedReasons[0]?.message ?? 'Bundle recovery request remained blocked.'),
      executionMode: candidate.executionMode,
      simulated: candidate.simulated,
      requestedAt,
      completedAt: candidate.eligibilityState === 'eligible' ? null : requestedAt,
    });

    if (candidate.eligibilityState !== 'eligible') {
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'allocator.bundle_recovery_blocked',
        occurredAt: requestedAt.toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'allocator',
        data: {
          bundleId,
          proposalId: candidate.proposalId,
          recoveryActionId: baseRecoveryAction.id,
          targetChildType: candidate.targetChildType,
          targetChildId: candidate.targetChildId,
          blockedReasons: candidate.blockedReasons,
        },
      });
      await this.store.syncRebalanceBundleForProposal(candidate.proposalId);
      return baseRecoveryAction;
    }

    try {
      let command: RuntimeCommandView;
      if (candidate.targetChildType === 'carry_action') {
        const detail = await this.store.getCarryAction(candidate.targetChildId);
        if (detail === null) {
          throw new Error(`Carry action "${candidate.targetChildId}" was not found.`);
        }
        if (detail.action.status === 'recommended') {
          await this.store.approveCarryAction(detail.action.id, actorId);
        }
        command = await this.enqueueCommand('execute_carry_action', actorId, {
          actionId: candidate.targetChildId,
          actorId,
          bundleRecoveryActionId: baseRecoveryAction.id,
        });
        await this.store.queueCarryActionExecution({
          actionId: candidate.targetChildId,
          commandId: command.commandId,
          actorId,
        });
      } else if (candidate.targetChildType === 'treasury_action') {
        const detail = await this.store.getTreasuryAction(candidate.targetChildId);
        if (detail === null) {
          throw new Error(`Treasury action "${candidate.targetChildId}" was not found.`);
        }
        if (detail.action.status === 'recommended') {
          await this.store.approveTreasuryAction(detail.action.id, actorId);
        }
        command = await this.enqueueCommand('execute_treasury_action', actorId, {
          treasuryActionId: candidate.targetChildId,
          actorId,
          bundleRecoveryActionId: baseRecoveryAction.id,
        });
        await this.store.queueTreasuryActionExecution({
          actionId: candidate.targetChildId,
          commandId: command.commandId,
          actorId,
        });
      } else {
        throw new Error('Proposal-level bundle recovery is not supported in this pass.');
      }

      const queued = await this.store.updateRebalanceBundleRecoveryAction(baseRecoveryAction.id, {
        status: 'queued',
        linkedCommandId: command.commandId,
        queuedAt: new Date(),
      });
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'allocator.bundle_recovery_queued',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'allocator',
        data: {
          bundleId,
          proposalId: candidate.proposalId,
          recoveryActionId: baseRecoveryAction.id,
          targetChildType: candidate.targetChildType,
          targetChildId: candidate.targetChildId,
          commandId: command.commandId,
        },
      });
      await this.store.syncRebalanceBundleForProposal(candidate.proposalId);
      return queued ?? baseRecoveryAction;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bundle recovery request failed.';
      const failed = await this.store.updateRebalanceBundleRecoveryAction(baseRecoveryAction.id, {
        status: 'failed',
        outcomeSummary: message,
        lastError: message,
        outcome: {
          targetChildType: candidate.targetChildType,
          targetChildId: candidate.targetChildId,
        },
        completedAt: new Date(),
      });
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'allocator.bundle_recovery_failed',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'allocator',
        data: {
          bundleId,
          proposalId: candidate.proposalId,
          recoveryActionId: baseRecoveryAction.id,
          targetChildType: candidate.targetChildType,
          targetChildId: candidate.targetChildId,
          error: message,
        },
      });
      await this.store.syncRebalanceBundleForProposal(candidate.proposalId);
      return failed ?? baseRecoveryAction;
    }
  }

  async requestRebalanceBundleResolutionAction(
    bundleId: string,
    input: {
      resolutionActionType: RebalanceBundleResolutionActionType;
      note: string;
    },
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RebalanceBundleResolutionActionView | null> {
    const bundle = await this.store.getRebalanceBundle(bundleId);
    if (bundle === null) {
      return null;
    }

    const option = bundle.resolutionOptions.find(
      (item) => item.resolutionActionType === input.resolutionActionType,
    );
    if (option === undefined) {
      throw new Error('Bundle manual resolution option was not found.');
    }
    if (!canSatisfyApprovalRequirement(actorRole, option.approvalRequirement)) {
      throw new Error(`Bundle manual resolution requires ${option.approvalRequirement} approval.`);
    }
    const note = input.note.trim();
    if (note.length === 0) {
      throw new Error('Bundle manual resolution note is required.');
    }

    const requestedAt = new Date();
    const latestLinkedRecoveryIds = bundle.recoveryActions.slice(0, 5).map((action) => action.id);
    const affectedChildSummary = {
      retryableChildren: bundle.partialProgress.retryableChildren,
      nonRetryableChildren: bundle.partialProgress.nonRetryableChildren,
      appliedChildren: bundle.partialProgress.appliedChildren,
      progressRecordedChildren: bundle.partialProgress.progressRecordedChildren,
      blockedBeforeApplicationChildren: bundle.partialProgress.blockedBeforeApplicationChildren,
      childStates: bundle.partialProgress.children.map((child) => ({
        childType: child.childType,
        childId: child.childId,
        progressState: child.progressState,
        retryability: child.retryability,
      })),
    };

    const action = await this.store.createRebalanceBundleResolutionAction({
      bundleId: bundle.bundle.id,
      proposalId: bundle.bundle.proposalId,
      resolutionActionType: option.resolutionActionType,
      status: option.eligibilityState === 'eligible' ? 'completed' : 'blocked',
      resolutionState:
        option.eligibilityState === 'eligible'
          ? option.targetResolutionState
          : bundle.bundle.resolutionState,
      note,
      acknowledgedPartialApplication: option.resolutionActionType === 'accept_partial_application',
      escalated: option.resolutionActionType === 'escalate_bundle_for_review',
      affectedChildSummary,
      linkedRecoveryActionIds: latestLinkedRecoveryIds,
      blockedReasons: option.blockedReasons,
      outcomeSummary:
        option.eligibilityState === 'eligible'
          ? option.summary
          : (option.blockedReasons[0]?.message ?? 'Bundle manual resolution remained blocked.'),
      requestedBy: actorId,
      completedBy: option.eligibilityState === 'eligible' ? actorId : null,
      requestedAt,
      completedAt: requestedAt,
    });

    if (option.eligibilityState !== 'eligible') {
      await this.store.auditWriter.write({
        eventId: createId(),
        eventType: 'allocator.bundle_resolution_blocked',
        occurredAt: requestedAt.toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: 'allocator',
        data: {
          bundleId,
          proposalId: bundle.bundle.proposalId,
          resolutionActionId: action.id,
          resolutionActionType: option.resolutionActionType,
          blockedReasons: option.blockedReasons,
          note,
        },
      });
      await this.store.syncRebalanceBundleForProposal(bundle.bundle.proposalId);
      return action;
    }

    await this.store.updateRebalanceBundleResolutionState({
      bundleId,
      resolutionState: option.targetResolutionState,
      latestResolutionActionId: action.id,
      resolutionSummary: note,
      resolvedBy: actorId,
      resolvedAt: requestedAt,
    });
    if (option.resolutionActionType === 'escalate_bundle_for_review') {
      const existingEscalation = await this.store.getOpenRebalanceBundleEscalation(bundleId);
      if (existingEscalation === null) {
        const escalation = await this.store.createRebalanceBundleEscalation({
          bundleId: bundle.bundle.id,
          proposalId: bundle.bundle.proposalId,
          sourceResolutionActionId: action.id,
          status: 'open',
          ownerId: actorId,
          assignedBy: actorId,
          assignedAt: requestedAt,
          handoffNote: note,
          createdAt: requestedAt,
        });
        await this.store.recordRebalanceBundleEscalationEvent({
          escalationId: escalation.id,
          bundleId: bundle.bundle.id,
          proposalId: bundle.bundle.proposalId,
          eventType: 'created',
          fromStatus: null,
          toStatus: 'open',
          actorId,
          ownerId: actorId,
          note,
          createdAt: requestedAt,
        });
        await this.store.updateRebalanceBundleEscalationState({
          bundleId: bundle.bundle.id,
          latestEscalationId: escalation.id,
          escalationStatus: escalation.status,
          escalationOwnerId: escalation.ownerId,
          escalationAssignedAt: requestedAt,
          escalationDueAt: null,
          escalationSummary: note,
        });
      } else {
        await this.store.updateRebalanceBundleEscalationState({
          bundleId: bundle.bundle.id,
          latestEscalationId: existingEscalation.id,
          escalationStatus: existingEscalation.status,
          escalationOwnerId: existingEscalation.ownerId,
          escalationAssignedAt:
            existingEscalation.assignedAt === null ? null : new Date(existingEscalation.assignedAt),
          escalationDueAt:
            existingEscalation.dueAt === null ? null : new Date(existingEscalation.dueAt),
          escalationSummary:
            existingEscalation.handoffNote ??
            existingEscalation.reviewNote ??
            existingEscalation.resolutionNote ??
            note,
        });
      }
    }
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.bundle_resolution_recorded',
      occurredAt: requestedAt.toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        bundleId,
        proposalId: bundle.bundle.proposalId,
        resolutionActionId: action.id,
        resolutionActionType: option.resolutionActionType,
        resolutionState: option.targetResolutionState,
        linkedRecoveryActionIds: latestLinkedRecoveryIds,
        note,
      },
    });
    await this.store.syncRebalanceBundleForProposal(bundle.bundle.proposalId);
    return action;
  }

  async assignRebalanceBundleEscalation(
    bundleId: string,
    input: {
      ownerId: string;
      note: string;
      dueAt?: string | null;
    },
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RebalanceBundleEscalationView | null> {
    const bundle = await this.store.getRebalanceBundle(bundleId);
    if (bundle === null) {
      return null;
    }
    const transition = bundle.escalationTransitions.find(
      (item) => item.transitionType === 'assign',
    );
    if (transition === undefined) {
      throw new Error('Bundle escalation assignment option was not found.');
    }
    if (!canSatisfyApprovalRequirement(actorRole, transition.approvalRequirement)) {
      throw new Error(
        `Bundle escalation assignment requires ${transition.approvalRequirement} approval.`,
      );
    }
    const escalation = bundle.escalation;
    if (escalation === null) {
      throw new Error('Bundle escalation record was not found.');
    }
    const ownerId = input.ownerId.trim();
    if (ownerId.length === 0) {
      throw new Error('Bundle escalation assignee is required.');
    }
    const note = input.note.trim();
    if (note.length === 0) {
      throw new Error('Bundle escalation handoff note is required.');
    }
    if (transition.eligibilityState !== 'eligible') {
      throw new Error(
        transition.blockedReasons[0]?.message ?? 'Bundle escalation assignment is blocked.',
      );
    }
    if (escalation.ownerId === ownerId) {
      throw new Error('Bundle escalation is already assigned to that owner.');
    }

    const dueAt =
      input.dueAt === undefined || input.dueAt === null || input.dueAt.length === 0
        ? null
        : new Date(input.dueAt);
    if (dueAt !== null && Number.isNaN(dueAt.getTime())) {
      throw new Error('Bundle escalation due date is invalid.');
    }

    const updatedAt = new Date();
    const updated = await this.store.updateRebalanceBundleEscalation(escalation.id, {
      ownerId,
      assignedBy: actorId,
      assignedAt: updatedAt,
      dueAt,
      handoffNote: note,
    });
    await this.store.recordRebalanceBundleEscalationEvent({
      escalationId: escalation.id,
      bundleId,
      proposalId: bundle.bundle.proposalId,
      eventType: 'assigned',
      fromStatus: escalation.status,
      toStatus: escalation.status,
      actorId,
      ownerId,
      note,
      dueAt,
      createdAt: updatedAt,
    });
    await this.store.updateRebalanceBundleEscalationState({
      bundleId,
      latestEscalationId: escalation.id,
      escalationStatus: escalation.status,
      escalationOwnerId: ownerId,
      escalationAssignedAt: updatedAt,
      escalationDueAt: dueAt,
      escalationSummary: note,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.bundle_escalation_assigned',
      occurredAt: updatedAt.toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        bundleId,
        proposalId: bundle.bundle.proposalId,
        escalationId: escalation.id,
        ownerId,
        dueAt: dueAt?.toISOString() ?? null,
        note,
      },
    });
    await this.store.syncRebalanceBundleForProposal(bundle.bundle.proposalId);
    return updated;
  }

  async acknowledgeRebalanceBundleEscalation(
    bundleId: string,
    input: { note?: string | null } = {},
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RebalanceBundleEscalationView | null> {
    const bundle = await this.store.getRebalanceBundle(bundleId);
    if (bundle === null) {
      return null;
    }
    const transition = bundle.escalationTransitions.find(
      (item) => item.transitionType === 'acknowledge',
    );
    if (transition === undefined) {
      throw new Error('Bundle escalation acknowledgement option was not found.');
    }
    if (!canSatisfyApprovalRequirement(actorRole, transition.approvalRequirement)) {
      throw new Error(
        `Bundle escalation acknowledgement requires ${transition.approvalRequirement} approval.`,
      );
    }
    const escalation = bundle.escalation;
    if (escalation === null) {
      throw new Error('Bundle escalation record was not found.');
    }
    if (transition.eligibilityState !== 'eligible') {
      throw new Error(
        transition.blockedReasons[0]?.message ?? 'Bundle escalation acknowledgement is blocked.',
      );
    }
    if (actorRole !== 'admin' && escalation.ownerId !== actorId) {
      throw new Error(
        'Only the current escalation owner or an admin may acknowledge this escalation.',
      );
    }

    const updatedAt = new Date();
    const note = input.note?.trim() || null;
    const updated = await this.store.updateRebalanceBundleEscalation(escalation.id, {
      status: 'acknowledged',
      acknowledgedBy: actorId,
      acknowledgedAt: updatedAt,
    });
    await this.store.recordRebalanceBundleEscalationEvent({
      escalationId: escalation.id,
      bundleId,
      proposalId: bundle.bundle.proposalId,
      eventType: 'acknowledged',
      fromStatus: escalation.status,
      toStatus: 'acknowledged',
      actorId,
      ownerId: escalation.ownerId,
      note,
      dueAt: escalation.dueAt === null ? null : new Date(escalation.dueAt),
      createdAt: updatedAt,
    });
    await this.store.updateRebalanceBundleEscalationState({
      bundleId,
      latestEscalationId: escalation.id,
      escalationStatus: 'acknowledged',
      escalationOwnerId: escalation.ownerId,
      escalationAssignedAt: escalation.assignedAt === null ? null : new Date(escalation.assignedAt),
      escalationDueAt: escalation.dueAt === null ? null : new Date(escalation.dueAt),
      escalationSummary: note ?? escalation.handoffNote,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.bundle_escalation_acknowledged',
      occurredAt: updatedAt.toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        bundleId,
        proposalId: bundle.bundle.proposalId,
        escalationId: escalation.id,
        note,
      },
    });
    await this.store.syncRebalanceBundleForProposal(bundle.bundle.proposalId);
    return updated;
  }

  async startRebalanceBundleEscalationReview(
    bundleId: string,
    input: { note?: string | null } = {},
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RebalanceBundleEscalationView | null> {
    const bundle = await this.store.getRebalanceBundle(bundleId);
    if (bundle === null) {
      return null;
    }
    const transition = bundle.escalationTransitions.find(
      (item) => item.transitionType === 'start_review',
    );
    if (transition === undefined) {
      throw new Error('Bundle escalation review option was not found.');
    }
    if (!canSatisfyApprovalRequirement(actorRole, transition.approvalRequirement)) {
      throw new Error(
        `Bundle escalation review requires ${transition.approvalRequirement} approval.`,
      );
    }
    const escalation = bundle.escalation;
    if (escalation === null) {
      throw new Error('Bundle escalation record was not found.');
    }
    if (transition.eligibilityState !== 'eligible') {
      throw new Error(
        transition.blockedReasons[0]?.message ?? 'Bundle escalation review is blocked.',
      );
    }
    if (actorRole !== 'admin' && escalation.ownerId !== actorId) {
      throw new Error('Only the current escalation owner or an admin may start review.');
    }

    const updatedAt = new Date();
    const note = input.note?.trim() || null;
    const updated = await this.store.updateRebalanceBundleEscalation(escalation.id, {
      status: 'in_review',
      reviewNote: note ?? escalation.reviewNote,
    });
    await this.store.recordRebalanceBundleEscalationEvent({
      escalationId: escalation.id,
      bundleId,
      proposalId: bundle.bundle.proposalId,
      eventType: 'review_started',
      fromStatus: escalation.status,
      toStatus: 'in_review',
      actorId,
      ownerId: escalation.ownerId,
      note,
      dueAt: escalation.dueAt === null ? null : new Date(escalation.dueAt),
      createdAt: updatedAt,
    });
    await this.store.updateRebalanceBundleEscalationState({
      bundleId,
      latestEscalationId: escalation.id,
      escalationStatus: 'in_review',
      escalationOwnerId: escalation.ownerId,
      escalationAssignedAt: escalation.assignedAt === null ? null : new Date(escalation.assignedAt),
      escalationDueAt: escalation.dueAt === null ? null : new Date(escalation.dueAt),
      escalationSummary: note ?? escalation.reviewNote ?? escalation.handoffNote,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.bundle_escalation_review_started',
      occurredAt: updatedAt.toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        bundleId,
        proposalId: bundle.bundle.proposalId,
        escalationId: escalation.id,
        note,
      },
    });
    await this.store.syncRebalanceBundleForProposal(bundle.bundle.proposalId);
    return updated;
  }

  async closeRebalanceBundleEscalation(
    bundleId: string,
    input: { note: string },
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RebalanceBundleEscalationView | null> {
    const bundle = await this.store.getRebalanceBundle(bundleId);
    if (bundle === null) {
      return null;
    }
    const transition = bundle.escalationTransitions.find((item) => item.transitionType === 'close');
    if (transition === undefined) {
      throw new Error('Bundle escalation close option was not found.');
    }
    if (!canSatisfyApprovalRequirement(actorRole, transition.approvalRequirement)) {
      throw new Error(
        `Bundle escalation close requires ${transition.approvalRequirement} approval.`,
      );
    }
    const escalation = bundle.escalation;
    if (escalation === null) {
      throw new Error('Bundle escalation record was not found.');
    }
    if (transition.eligibilityState !== 'eligible') {
      throw new Error(
        transition.blockedReasons[0]?.message ?? 'Bundle escalation close is blocked.',
      );
    }
    if (actorRole !== 'admin' && escalation.ownerId !== actorId) {
      throw new Error('Only the current escalation owner or an admin may close this escalation.');
    }

    const note = input.note.trim();
    if (note.length === 0) {
      throw new Error('Bundle escalation close note is required.');
    }

    const updatedAt = new Date();
    const updated = await this.store.updateRebalanceBundleEscalation(escalation.id, {
      status: 'resolved',
      resolutionNote: note,
      closedBy: actorId,
      closedAt: updatedAt,
    });
    await this.store.recordRebalanceBundleEscalationEvent({
      escalationId: escalation.id,
      bundleId,
      proposalId: bundle.bundle.proposalId,
      eventType: 'resolved',
      fromStatus: escalation.status,
      toStatus: 'resolved',
      actorId,
      ownerId: escalation.ownerId,
      note,
      dueAt: escalation.dueAt === null ? null : new Date(escalation.dueAt),
      createdAt: updatedAt,
    });
    await this.store.updateRebalanceBundleEscalationState({
      bundleId,
      latestEscalationId: escalation.id,
      escalationStatus: 'resolved',
      escalationOwnerId: escalation.ownerId,
      escalationAssignedAt: escalation.assignedAt === null ? null : new Date(escalation.assignedAt),
      escalationDueAt: escalation.dueAt === null ? null : new Date(escalation.dueAt),
      escalationSummary: note,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.bundle_escalation_resolved',
      occurredAt: updatedAt.toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'allocator',
      data: {
        bundleId,
        proposalId: bundle.bundle.proposalId,
        escalationId: escalation.id,
        note,
      },
    });
    await this.store.syncRebalanceBundleForProposal(bundle.bundle.proposalId);
    return updated;
  }

  async getRebalanceProposal(proposalId: string): Promise<RebalanceProposalDetailView | null> {
    return this.store.getRebalanceProposal(proposalId);
  }

  async getRebalanceExecutionGraph(
    proposalId: string,
  ): Promise<RebalanceExecutionGraphView | null> {
    return this.store.getRebalanceExecutionGraph(proposalId);
  }

  async getRebalanceTimeline(proposalId: string): Promise<RebalanceExecutionTimelineEntry[]> {
    return this.store.getRebalanceTimeline(proposalId);
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

  async listTreasuryExecutionsForAction(actionId: string): Promise<TreasuryExecutionView[]> {
    return this.store.listTreasuryExecutionsForAction(actionId);
  }

  async getTreasuryExecution(executionId: string): Promise<TreasuryExecutionView | null> {
    return this.store.getTreasuryExecution(executionId);
  }

  async getTreasuryExecutionDetail(
    executionId: string,
  ): Promise<TreasuryExecutionDetailView | null> {
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
      throw new Error(`Treasury action requires ${detail.action.approvalRequirement} approval.`);
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
    if (detail.action.linkedRebalanceProposalId !== null) {
      await this.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
    }

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
      throw new Error(`Treasury action requires ${detail.action.approvalRequirement} approval.`);
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
    if (detail.action.linkedRebalanceProposalId !== null) {
      await this.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
    }

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
      throw new Error(
        `Rebalance proposal cannot be approved from status "${detail.proposal.status}".`,
      );
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

  async approveCarryAction(
    actionId: string,
    actorId: string,
    actorRole: 'viewer' | 'operator' | 'admin',
  ): Promise<RuntimeCommandView | null> {
    const detail = await this.store.getCarryAction(actionId);
    if (detail === null) {
      return null;
    }

    if (!detail.action.executable || detail.action.blockedReasons.length > 0) {
      throw new Error('Carry action is blocked and cannot be approved.');
    }

    if (!canSatisfyApprovalRequirement(actorRole, detail.action.approvalRequirement)) {
      throw new Error(`Carry action requires ${detail.action.approvalRequirement} approval.`);
    }

    if (detail.action.status !== 'recommended') {
      throw new Error(`Carry action cannot be approved from status "${detail.action.status}".`);
    }

    await this.store.approveCarryAction(actionId, actorId);
    const command = await this.enqueueCommand('execute_carry_action', actorId, {
      actionId,
      actorId,
    });
    await this.store.queueCarryActionExecution({
      actionId,
      commandId: command.commandId,
      actorId,
    });
    await this.store.auditWriter.write({
      eventId: createId(),
      eventType: 'carry.action_approved',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: 'carry',
      data: {
        carryActionId: actionId,
        commandId: command.commandId,
      },
    });
    if (detail.action.linkedRebalanceProposalId !== null) {
      await this.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
    }

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
      throw new Error(
        `Rebalance proposal cannot be rejected from status "${detail.proposal.status}".`,
      );
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

  async listReconciliationFindings(
    input: {
      limit?: number;
      findingType?: RuntimeReconciliationFindingType;
      severity?: RuntimeReconciliationFindingSeverity;
      status?: RuntimeReconciliationFindingStatus;
      mismatchId?: string;
      reconciliationRunId?: string;
    } = {},
  ): Promise<RuntimeReconciliationFindingView[]> {
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
      input.remediationType === 'run_cycle' &&
      (runtimeStatus.halted ||
        runtimeStatus.lifecycleState === 'paused' ||
        runtimeStatus.lifecycleState === 'stopped')
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
        throw new Error(
          `RuntimeControlPlane.remediateMismatch: remediation "${remediation.id}" was not persisted`,
        );
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
      (input.summary === null || input.summary.trim().length === 0) &&
      (input.commandId === undefined || input.commandId === null) &&
      (input.linkedRecoveryEventId === undefined || input.linkedRecoveryEventId === null)
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

  // =============================================================================
  // CEX Verification Methods
  // =============================================================================

  async listCexVerificationSessions(sleeveId?: string): Promise<Array<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    totalVolumeUsd: string | null;
    realizedPnl: string | null;
    calculatedApy: string | null;
    createdAt: string;
    validatedAt: string | null;
  }>> {
    return this.store.listCexVerificationSessions(sleeveId);
  }

  async getCexVerificationSession(sessionId: string): Promise<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    totalVolumeUsd: string | null;
    realizedPnl: string | null;
    calculatedApy: string | null;
    fileHash: string | null;
    createdAt: string;
    validatedAt: string | null;
    trades: Array<{
      id: string;
      tradeId: string;
      asset: string;
      side: string;
      quantity: string;
      price: string;
      fee: string | null;
      realizedPnl: string | null;
      tradeTime: string;
    }>;
  } | null> {
    return this.store.getCexVerificationSession(sessionId);
  }

  async createCexVerificationSession(input: {
    operatorId: string;
    sleeveId: string;
    platform: 'binance' | 'okx' | 'bybit' | 'coinbase' | undefined;
    csvContent: string;
    fileName: string;
  }): Promise<{
    id: string;
    sleeveId: string;
    platform: string;
    status: string;
    totalTrades: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    return this.store.createCexVerificationSession(input);
  }

  async validateCexCsv(input: {
    csvContent: string;
    platform: 'binance' | 'okx' | 'bybit' | 'coinbase' | undefined;
  }): Promise<{
    valid: boolean;
    detectedPlatform: string | undefined;
    errors: Array<{ row: number; message: string }>;
    preview: Array<{
      tradeId: string;
      symbol: string;
      side: string;
      quantity: string;
      price: string;
      tradeTime: string;
    }> | undefined;
  }> {
    return this.store.validateCexCsv(input);
  }

  async calculateCexPnl(sessionId: string, input: {
    method: 'fifo' | 'lifo' | 'avg';
    includeFees: boolean;
  }): Promise<PortfolioPnlResult> {
    return this.store.calculateCexPnl(sessionId, input);
  }

  async generateCexSubmissionReport(sessionId: string, input: {
    method: 'fifo' | 'lifo' | 'avg';
    includeFees: boolean;
  }): Promise<{
    sessionId: string;
    generatedAt: string;
    portfolioSummary: {
      totalTrades: number;
      totalPnl: string;
      totalFees: string;
      winRate: string;
      profitableAssets: number;
      losingAssets: number;
    };
    assetReports: Array<{
      asset: string;
      totalTrades: number;
      realizedPnl: string;
      winRate: string;
    }>;
    hackathonEligibility: {
      hasSufficientTrades: boolean;
      hasPositivePnl: boolean;
      meetsMinimumPeriod: boolean;
    };
  }> {
    return this.store.generateCexSubmissionReport(sessionId, input);
  }

  async updateCexVerificationStatus(sessionId: string, input: {
    operatorId: string;
    status: 'validated' | 'rejected';
    notes: string | undefined;
  }): Promise<{ id: string; status: string; validatedAt: string | null }> {
    return this.store.updateCexVerificationStatus(sessionId, input);
  }

  async deleteCexVerificationSession(sessionId: string): Promise<void> {
    return this.store.deleteCexVerificationSession(sessionId);
  }
}
