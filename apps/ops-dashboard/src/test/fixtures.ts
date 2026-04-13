import type {
  AllocatorDecisionDetailView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  CarryActionDetailView,
  CarryActionView,
  CarryStrategyProfileView,
  CarryExecutionDetailView,
  CarryExecutionStepView,
  CarryExecutionView,
  CarryVenueView,
  ConnectorPromotionDetailView,
  ConnectorPromotionEventView,
  ConnectorPromotionSummaryView,
  ConnectorReadinessEvidenceView,
  RebalanceBundleDetailView,
  RebalanceBundleEscalationEventView,
  RebalanceBundleEscalationTransitionView,
  RebalanceBundleEscalationView,
  RebalanceEscalationQueueItemView,
  RebalanceEscalationQueueSummaryView,
  RebalanceBundleRecoveryActionView,
  RebalanceBundleRecoveryCandidateView,
  RebalanceBundleResolutionActionView,
  RebalanceBundleResolutionOptionView,
  RebalanceBundleView,
  RebalanceBundlePartialProgressView,
  RebalanceExecutionGraphView,
  RebalanceProposalDetailView,
  RebalanceProposalView,
  TreasuryActionDetailView,
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  InternalDerivativeSnapshotView,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRecoveryEventView,
  SubmissionDossierView,
  SubmissionEvidenceRecordView,
  SubmissionExportBundleView,
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryExecutionDetailView,
  TreasuryExecutionView,
  TreasuryPolicyView,
  TreasurySummaryView,
  VenueDetailView,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueInventoryItemView,
  VenueInventorySummaryView,
  VenueSnapshotView,
  VenueTruthSummaryView,
  TreasuryVenueDetailView,
  TreasuryVenueView,
} from '@sentinel-apex/runtime';

import type { DashboardSession } from '../lib/operator-session';

export function createDashboardSession(overrides: Partial<DashboardSession> = {}): DashboardSession {
  return {
    sessionId: 'session-1',
    expiresAt: '2026-03-20T18:00:00.000Z',
    operator: {
      operatorId: 'ops-user',
      email: 'ops@example.com',
      displayName: 'Ops User',
      role: 'operator',
      active: true,
    },
    ...overrides,
  };
}

export function createOverview(): RuntimeOverviewView {
  return {
    runtime: {
      executionMode: 'dry-run',
      liveExecutionEnabled: false,
      riskLimits: {},
      halted: false,
      lifecycleState: 'ready',
      projectionStatus: 'fresh',
      lastRunId: 'run-1',
      lastRunStatus: 'completed',
      lastSuccessfulRunId: 'run-1',
      lastCycleStartedAt: '2026-03-20T12:00:00.000Z',
      lastCycleCompletedAt: '2026-03-20T12:01:00.000Z',
      lastProjectionRebuildAt: '2026-03-20T12:01:00.000Z',
      lastProjectionSourceRunId: 'run-1',
      startedAt: '2026-03-20T11:00:00.000Z',
      readyAt: '2026-03-20T11:00:30.000Z',
      stoppedAt: null,
      lastError: null,
      reason: null,
      updatedAt: '2026-03-20T12:01:00.000Z',
    },
    worker: {
      workerId: 'worker-1',
      lifecycleState: 'ready',
      schedulerState: 'waiting',
      currentOperation: null,
      currentCommandId: null,
      currentRunId: null,
      cycleIntervalMs: 60000,
      processId: 1234,
      hostname: 'ops-host',
      lastHeartbeatAt: '2026-03-20T12:01:00.000Z',
      lastStartedAt: '2026-03-20T11:00:00.000Z',
      lastStoppedAt: null,
      lastRunStartedAt: '2026-03-20T12:00:00.000Z',
      lastRunCompletedAt: '2026-03-20T12:01:00.000Z',
      lastSuccessAt: '2026-03-20T12:01:00.000Z',
      lastFailureAt: null,
      lastFailureReason: null,
      nextScheduledRunAt: '2026-03-20T12:02:00.000Z',
      updatedAt: '2026-03-20T12:01:00.000Z',
    },
    openMismatchCount: 2,
    mismatchStatusCounts: {
      open: 1,
      acknowledged: 0,
      recovering: 1,
      resolved: 0,
      verified: 0,
      reopened: 0,
    },
    degradedReasons: [],
    lastRecoveryEvent: createRecoveryEvent(),
    latestReconciliationRun: createReconciliationRun(),
    reconciliationSummary: createReconciliationSummary(),
    treasurySummary: createTreasurySummary(),
    allocatorSummary: createAllocatorSummary(),
  };
}

export function createAllocatorSummary(
  overrides: Partial<AllocatorSummaryView> = {},
): AllocatorSummaryView {
  return {
    allocatorRunId: 'allocator-run-1',
    sourceRunId: 'run-1',
    trigger: 'post_cycle',
    triggeredBy: 'sentinel-runtime',
    regimeState: 'normal',
    pressureLevel: 'normal',
    totalCapitalUsd: '1000000',
    reserveConstrainedCapitalUsd: '100000',
    allocatableCapitalUsd: '900000',
    carryTargetPct: 60,
    treasuryTargetPct: 40,
    recommendationCount: 2,
    evaluatedAt: '2026-03-20T12:01:02.000Z',
    updatedAt: '2026-03-20T12:01:02.000Z',
    ...overrides,
  };
}

export function createAllocatorTarget(
  overrides: Partial<AllocatorSleeveTargetView> = {},
): AllocatorSleeveTargetView {
  return {
    allocatorRunId: 'allocator-run-1',
    sleeveId: 'carry',
    sleeveKind: 'carry',
    sleeveName: 'Apex Carry',
    status: 'active',
    throttleState: 'normal',
    currentAllocationUsd: '450000',
    currentAllocationPct: 45,
    targetAllocationUsd: '600000',
    targetAllocationPct: 60,
    minAllocationPct: 0,
    maxAllocationPct: 65,
    deltaUsd: '150000',
    opportunityScore: 0.82,
    capacityUsd: '1000000',
    rationale: [
      {
        code: 'carry_opportunity_strong',
        severity: 'info',
        summary: 'Carry opportunity quality is strong.',
        details: {},
      },
    ],
    metadata: {},
    ...overrides,
  };
}

export function createAllocatorRun(
  overrides: Partial<AllocatorRunView> = {},
): AllocatorRunView {
  return {
    allocatorRunId: 'allocator-run-1',
    sourceRunId: 'run-1',
    trigger: 'post_cycle',
    triggeredBy: 'sentinel-runtime',
    regimeState: 'normal',
    pressureLevel: 'normal',
    totalCapitalUsd: '1000000',
    reserveConstrainedCapitalUsd: '100000',
    allocatableCapitalUsd: '900000',
    recommendationCount: 2,
    rationale: [],
    constraints: [],
    inputSnapshot: {},
    policySnapshot: {},
    evaluatedAt: '2026-03-20T12:01:02.000Z',
    updatedAt: '2026-03-20T12:01:02.000Z',
    ...overrides,
  };
}

export function createAllocatorDecisionDetail(
  overrides: Partial<AllocatorDecisionDetailView> = {},
): AllocatorDecisionDetailView {
  return {
    run: createAllocatorRun(),
    summary: createAllocatorSummary(),
    targets: [
      createAllocatorTarget(),
      createAllocatorTarget({
        sleeveId: 'treasury',
        sleeveKind: 'treasury',
        sleeveName: 'Atlas Treasury',
        currentAllocationUsd: '550000',
        currentAllocationPct: 55,
        targetAllocationUsd: '400000',
        targetAllocationPct: 40,
        minAllocationPct: 35,
        maxAllocationPct: 100,
        deltaUsd: '-150000',
        opportunityScore: null,
        rationale: [
          {
            code: 'treasury_residual_allocator',
            severity: 'info',
            summary: 'Treasury receives residual capital.',
            details: {},
          },
        ],
      }),
    ],
    recommendations: [],
    rationale: [
      {
        code: 'baseline_policy_applied',
        severity: 'info',
        summary: 'Baseline policy applied.',
        details: {},
      },
    ],
    constraints: [],
    ...overrides,
  };
}

export function createRebalanceProposal(
  overrides: Partial<RebalanceProposalView> = {},
): RebalanceProposalView {
  return {
    id: 'rebalance-proposal-1',
    allocatorRunId: 'allocator-run-1',
    actionType: 'rebalance_between_sleeves',
    status: 'proposed',
    summary: 'Rebalance 150000.00 USD from Treasury to Carry budget.',
    executionMode: 'dry-run',
    simulated: true,
    executable: true,
    approvalRequirement: 'operator',
    rationale: [],
    blockedReasons: [],
    details: {
      rebalanceAmountUsd: '150000.00',
    },
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    linkedCommandId: null,
    latestExecutionId: null,
    lastError: null,
    createdAt: '2026-03-20T12:02:00.000Z',
    updatedAt: '2026-03-20T12:02:00.000Z',
    ...overrides,
  };
}

export function createRebalanceProposalDetail(
  overrides: Partial<RebalanceProposalDetailView> = {},
): RebalanceProposalDetailView {
  return {
    proposal: createRebalanceProposal(),
    intents: [
      {
        id: 'rebalance-intent-1',
        proposalId: 'rebalance-proposal-1',
        sleeveId: 'carry',
        sourceSleeveId: 'treasury',
        targetSleeveId: 'carry',
        actionType: 'increase_carry_budget',
        status: 'proposed',
        readiness: 'actionable',
        executable: true,
        currentAllocationUsd: '450000',
        currentAllocationPct: 45,
        targetAllocationUsd: '600000',
        targetAllocationPct: 60,
        deltaUsd: '150000',
        rationale: [],
        blockedReasons: [],
        details: {},
        createdAt: '2026-03-20T12:02:00.000Z',
        updatedAt: '2026-03-20T12:02:00.000Z',
      },
    ],
    latestCommand: null,
    executions: [{
      id: 'rebalance-execution-1',
      proposalId: 'rebalance-proposal-1',
      commandId: 'command-rebalance-1',
      status: 'completed',
      executionMode: 'dry-run',
      simulated: true,
      requestedBy: 'ops-user',
      startedBy: 'runtime-worker-1',
      outcomeSummary: 'Rebalance completed with downstream carry action.',
      outcome: {
        downstreamCarryActionIds: ['carry-action-1'],
      },
      lastError: null,
      createdAt: '2026-03-20T12:03:00.000Z',
      startedAt: '2026-03-20T12:03:01.000Z',
      completedAt: '2026-03-20T12:03:02.000Z',
      updatedAt: '2026-03-20T12:03:02.000Z',
    }],
    currentState: null,
    ...overrides,
  };
}

export function createRebalanceExecutionGraph(
  overrides: Partial<RebalanceExecutionGraphView> = {},
): RebalanceExecutionGraphView {
  const detail = createRebalanceProposalDetail({
    proposal: createRebalanceProposal({
      status: 'completed',
      approvedBy: 'ops-user',
      approvedAt: '2026-03-20T12:02:20.000Z',
      linkedCommandId: 'command-rebalance-1',
      latestExecutionId: 'rebalance-execution-1',
    }),
    latestCommand: createCommand({
      commandId: 'command-rebalance-1',
      commandType: 'execute_rebalance_proposal',
      status: 'completed',
      requestedBy: 'ops-user',
      result: {
        proposalId: 'rebalance-proposal-1',
        downstreamCarryActionIds: ['carry-action-1'],
      },
    }),
    currentState: {
      allocatorRunId: 'allocator-run-1',
      latestProposalId: 'rebalance-proposal-1',
      carryTargetAllocationUsd: '600000',
      carryTargetAllocationPct: 60,
      treasuryTargetAllocationUsd: '400000',
      treasuryTargetAllocationPct: 40,
      appliedAt: '2026-03-20T12:03:02.000Z',
      updatedAt: '2026-03-20T12:03:02.000Z',
    },
  });
  const carryAction = createCarryAction({
    status: 'completed',
    linkedCommandId: 'command-carry-1',
    latestExecutionId: 'carry-execution-1',
  });
  const carryExecution = createCarryExecution({ carryActionId: carryAction.id });
  const recoveryAction = createRebalanceBundleRecoveryAction();
  const resolutionAction = createRebalanceBundleResolutionAction();
  const escalation = createRebalanceBundleEscalation();
  const escalationEvent = createRebalanceBundleEscalationEvent();

  return {
    detail,
    allocatorDecision: createAllocatorDecisionDetail(),
    commands: [
      detail.latestCommand ?? createCommand({
        commandId: 'command-rebalance-1',
        commandType: 'execute_rebalance_proposal',
      }),
    ].filter((command): command is RuntimeCommandView => command !== null),
    downstream: {
      carry: {
        actions: [{
          action: carryAction,
          executions: [carryExecution],
        }],
        rollup: {
          status: 'completed',
          actionCount: 1,
          executionCount: 1,
          blockedCount: 0,
          failureCount: 0,
          completedCount: 1,
          simulated: true,
          live: false,
          references: ['sim-venue-a:carry:1'],
          summary: '1 actions and 1 executions recorded.',
        },
      },
      treasury: {
        actions: [],
        rollup: {
          status: 'idle',
          actionCount: 0,
          executionCount: 0,
          blockedCount: 0,
          failureCount: 0,
          completedCount: 0,
          simulated: true,
          live: false,
          references: [],
          summary: 'No downstream treasury actions are persisted for this proposal.',
        },
        note: 'Treasury sleeve impact is currently represented by approved rebalance budget-state application, not by proposal-linked treasury action records.',
      },
    },
    recoveryActions: [recoveryAction],
    resolutionActions: [resolutionAction],
    escalation,
    escalationHistory: [escalationEvent],
    timeline: [
      {
        id: 'rebalance-proposal-1:proposed',
        eventType: 'proposed',
        at: detail.proposal.createdAt,
        actorId: null,
        sleeveId: 'allocator',
        scope: 'proposal',
        status: 'completed',
        summary: 'Rebalance proposal was persisted from the allocator decision.',
        linkedCommandId: null,
        linkedRebalanceExecutionId: null,
        linkedActionId: null,
        linkedExecutionId: null,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {},
      },
      {
        id: 'rebalance-proposal-1:carry-action:carry-action-1',
        eventType: 'downstream_action_recorded',
        at: carryAction.createdAt,
        actorId: carryAction.actorId,
        sleeveId: 'carry',
        scope: 'downstream_action',
        status: carryAction.status,
        summary: carryAction.summary,
        linkedCommandId: carryAction.linkedCommandId,
        linkedRebalanceExecutionId: null,
        linkedActionId: carryAction.id,
        linkedExecutionId: null,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {},
      },
      {
        id: 'bundle-recovery-action-1:completed',
        eventType: 'recovery_completed',
        at: recoveryAction.completedAt ?? recoveryAction.requestedAt,
        actorId: recoveryAction.requestedBy,
        sleeveId: 'carry',
        scope: 'recovery_action',
        status: recoveryAction.status,
        summary: recoveryAction.outcomeSummary ?? 'Bundle recovery completed.',
        linkedCommandId: recoveryAction.linkedCommandId,
        linkedRebalanceExecutionId: null,
        linkedActionId: recoveryAction.targetChildId,
        linkedExecutionId: null,
        linkedRecoveryActionId: recoveryAction.id,
        linkedResolutionActionId: null,
        linkedEscalationId: null,
        details: {},
      },
      {
        id: 'bundle-resolution-action-1:completed',
        eventType: 'resolution_completed',
        at: resolutionAction.completedAt ?? resolutionAction.requestedAt,
        actorId: resolutionAction.completedBy ?? resolutionAction.requestedBy,
        sleeveId: 'allocator',
        scope: 'resolution_action',
        status: resolutionAction.status,
        summary: resolutionAction.outcomeSummary ?? 'Bundle resolution completed.',
        linkedCommandId: null,
        linkedRebalanceExecutionId: null,
        linkedActionId: null,
        linkedExecutionId: null,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: resolutionAction.id,
        linkedEscalationId: null,
        details: {},
      },
      {
        id: 'bundle-escalation-1:created:event',
        eventType: 'escalation_created',
        at: escalationEvent.createdAt,
        actorId: escalationEvent.actorId,
        sleeveId: 'allocator',
        scope: 'escalation',
        status: escalationEvent.toStatus,
        summary: escalationEvent.note ?? 'Escalation created.',
        linkedCommandId: null,
        linkedRebalanceExecutionId: null,
        linkedActionId: null,
        linkedExecutionId: null,
        linkedRecoveryActionId: null,
        linkedResolutionActionId: null,
        linkedEscalationId: escalation.id,
        details: {},
      },
    ],
    ...overrides,
  };
}

export function createRebalanceBundle(
  overrides: Partial<RebalanceBundleView> = {},
): RebalanceBundleView {
  return {
    id: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    allocatorRunId: 'allocator-run-1',
    proposalStatus: 'completed',
    status: 'completed',
    completionState: 'finalized',
    outcomeClassification: 'safe_complete',
    interventionRecommendation: 'no_action_needed',
    totalChildCount: 1,
    blockedChildCount: 0,
    failedChildCount: 0,
    completedChildCount: 1,
    pendingChildCount: 0,
    childRollup: {
      carry: { completedCount: 1 },
      treasury: { completedCount: 0 },
    },
    finalizationReason: 'All downstream work recorded for the rebalance bundle completed successfully.',
    finalizedAt: '2026-03-20T12:03:02.000Z',
    resolutionState: 'unresolved',
    latestResolutionActionId: null,
    resolutionSummary: null,
    resolvedBy: null,
    resolvedAt: null,
    latestEscalationId: null,
    escalationStatus: null,
    escalationOwnerId: null,
    escalationAssignedAt: null,
    escalationDueAt: null,
    escalationSummary: null,
    executionMode: 'dry-run',
    simulated: true,
    createdAt: '2026-03-20T12:02:00.000Z',
    updatedAt: '2026-03-20T12:03:02.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleRecoveryCandidate(
  overrides: Partial<RebalanceBundleRecoveryCandidateView> = {},
): RebalanceBundleRecoveryCandidateView {
  return {
    id: 'bundle-recovery-candidate-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    recoveryActionType: 'requeue_child_execution',
    targetChildType: 'carry_action',
    targetChildId: 'carry-action-1',
    targetChildStatus: 'failed',
    targetChildSummary: 'Retry carry child after failed execution.',
    targetCommandType: 'execute_carry_action',
    approvalRequirement: 'operator',
    eligibilityState: 'eligible',
    blockedReasons: [],
    executionMode: 'dry-run',
    simulated: true,
    note: 'Carry child can be requeued safely because no partial execution progress was recorded.',
    createdAt: '2026-03-20T12:04:00.000Z',
    updatedAt: '2026-03-20T12:04:00.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleRecoveryAction(
  overrides: Partial<RebalanceBundleRecoveryActionView> = {},
): RebalanceBundleRecoveryActionView {
  return {
    id: 'bundle-recovery-action-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    recoveryActionType: 'requeue_child_execution',
    targetChildType: 'carry_action',
    targetChildId: 'carry-action-1',
    targetChildStatus: 'failed',
    targetChildSummary: 'Retry carry child after failed execution.',
    eligibilityState: 'eligible',
    blockedReasons: [],
    approvalRequirement: 'operator',
    status: 'completed',
    requestedBy: 'ops-user',
    requestedAt: '2026-03-20T12:05:00.000Z',
    note: 'Retry requested from bundle detail.',
    linkedCommandId: 'command-carry-recovery-1',
    targetCommandType: 'execute_carry_action',
    linkedCarryActionId: 'carry-action-1',
    linkedTreasuryActionId: null,
    outcomeSummary: 'Bundle recovery requeued the carry child successfully.',
    outcome: {
      carryExecutionId: 'carry-execution-2',
    },
    lastError: null,
    executionMode: 'dry-run',
    simulated: true,
    queuedAt: '2026-03-20T12:05:02.000Z',
    startedAt: '2026-03-20T12:05:03.000Z',
    completedAt: '2026-03-20T12:05:06.000Z',
    updatedAt: '2026-03-20T12:05:06.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleResolutionOption(
  overrides: Partial<RebalanceBundleResolutionOptionView> = {},
): RebalanceBundleResolutionOptionView {
  return {
    id: 'bundle-resolution-option-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    resolutionActionType: 'accept_partial_application',
    targetResolutionState: 'accepted_partial',
    approvalRequirement: 'operator',
    eligibilityState: 'eligible',
    blockedReasons: [],
    noteRequired: true,
    summary: 'Accept the current partial application without retrying remaining children.',
    operatorAction: 'Record why the partial state is acceptable.',
    createdAt: '2026-03-20T12:06:00.000Z',
    updatedAt: '2026-03-20T12:06:00.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleResolutionAction(
  overrides: Partial<RebalanceBundleResolutionActionView> = {},
): RebalanceBundleResolutionActionView {
  return {
    id: 'bundle-resolution-action-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    resolutionActionType: 'accept_partial_application',
    status: 'completed',
    resolutionState: 'accepted_partial',
    note: 'Operator accepted the partial application after review.',
    acknowledgedPartialApplication: true,
    escalated: false,
    affectedChildSummary: {
      retryableChildren: 0,
      nonRetryableChildren: 1,
      appliedChildren: 1,
    },
    linkedRecoveryActionIds: ['bundle-recovery-action-1'],
    requestedBy: 'ops-user',
    requestedAt: '2026-03-20T12:06:00.000Z',
    completedBy: 'ops-user',
    completedAt: '2026-03-20T12:06:01.000Z',
    outcomeSummary: 'Operator accepted the partial bundle outcome as-is.',
    blockedReasons: [],
    updatedAt: '2026-03-20T12:06:01.000Z',
    ...overrides,
  };
}

export function createRebalanceBundlePartialProgress(
  overrides: Partial<RebalanceBundlePartialProgressView> = {},
): RebalanceBundlePartialProgressView {
  return {
    totalChildren: 1,
    appliedChildren: 1,
    progressRecordedChildren: 1,
    retryableChildren: 0,
    nonRetryableChildren: 1,
    blockedBeforeApplicationChildren: 0,
    inflightChildren: 0,
    sleeves: [
      {
        sleeveId: 'carry',
        totalChildren: 1,
        appliedChildren: 1,
        progressRecordedChildren: 1,
        retryableChildren: 0,
        nonRetryableChildren: 1,
        blockedBeforeApplicationChildren: 0,
      },
      {
        sleeveId: 'treasury',
        totalChildren: 0,
        appliedChildren: 0,
        progressRecordedChildren: 0,
        retryableChildren: 0,
        nonRetryableChildren: 0,
        blockedBeforeApplicationChildren: 0,
      },
    ],
    children: [{
      childType: 'carry_action',
      sleeveId: 'carry',
      childId: 'carry-action-1',
      summary: 'Carry child applied partially and needs operator review.',
      actionStatus: 'failed',
      latestExecutionId: 'carry-execution-1',
      latestExecutionStatus: 'failed',
      progressState: 'partial_progress',
      retryability: 'non_retryable',
      applied: true,
      progressRecorded: true,
      blockedBeforeApplication: false,
      retryCandidateId: null,
      retryBlockedReasons: [],
      evidence: ['Venue execution references recorded.'],
    }],
    ...overrides,
  };
}

export function createRebalanceBundleEscalation(
  overrides: Partial<RebalanceBundleEscalationView> = {},
): RebalanceBundleEscalationView {
  return {
    id: 'bundle-escalation-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    sourceResolutionActionId: 'bundle-resolution-action-1',
    status: 'open',
    isOpen: true,
    ownerId: 'ops-owner',
    assignedBy: 'ops-user',
    assignedAt: '2026-03-20T12:06:05.000Z',
    acknowledgedBy: null,
    acknowledgedAt: null,
    dueAt: '2026-03-21T12:00:00.000Z',
    handoffNote: 'Escalated for manual venue-side review.',
    reviewNote: null,
    resolutionNote: null,
    closedBy: null,
    closedAt: null,
    createdAt: '2026-03-20T12:06:05.000Z',
    updatedAt: '2026-03-20T12:06:05.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleEscalationEvent(
  overrides: Partial<RebalanceBundleEscalationEventView> = {},
): RebalanceBundleEscalationEventView {
  return {
    id: 'bundle-escalation-event-1',
    escalationId: 'bundle-escalation-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    eventType: 'created',
    fromStatus: null,
    toStatus: 'open',
    actorId: 'ops-user',
    ownerId: 'ops-owner',
    note: 'Escalated for manual venue-side review.',
    dueAt: '2026-03-21T12:00:00.000Z',
    createdAt: '2026-03-20T12:06:05.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleEscalationTransition(
  overrides: Partial<RebalanceBundleEscalationTransitionView> = {},
): RebalanceBundleEscalationTransitionView {
  return {
    id: 'rebalance-bundle-1:assign',
    bundleId: 'rebalance-bundle-1',
    escalationId: 'bundle-escalation-1',
    transitionType: 'assign',
    targetStatus: 'open',
    approvalRequirement: 'operator',
    eligibilityState: 'eligible',
    blockedReasons: [],
    noteRequired: true,
    assigneeRequired: true,
    summary: 'Assign or reassign the escalation owner and optional follow-up date.',
    operatorAction: 'Document the handoff and choose the operator who now owns the escalated bundle.',
    createdAt: '2026-03-20T12:06:06.000Z',
    updatedAt: '2026-03-20T12:06:06.000Z',
    ...overrides,
  };
}

export function createRebalanceEscalationQueueItem(
  overrides: Partial<RebalanceEscalationQueueItemView> = {},
): RebalanceEscalationQueueItemView {
  return {
    escalationId: 'bundle-escalation-1',
    bundleId: 'rebalance-bundle-1',
    proposalId: 'rebalance-proposal-1',
    allocatorRunId: 'allocator-run-1',
    escalationStatus: 'open',
    escalationQueueState: 'due_soon',
    isOpen: true,
    ownerId: 'ops-owner',
    assignedBy: 'ops-user',
    assignedAt: '2026-03-20T12:06:05.000Z',
    acknowledgedAt: null,
    inReviewAt: null,
    dueAt: '2026-03-21T12:00:00.000Z',
    latestActivityAt: '2026-03-20T12:06:05.000Z',
    latestEventType: 'created',
    latestEventSummary: 'Escalated for manual venue-side review.',
    bundleStatus: 'requires_intervention',
    interventionRecommendation: 'escalated_for_review',
    resolutionState: 'escalated',
    outcomeClassification: 'partial_application',
    failedChildCount: 1,
    blockedChildCount: 0,
    pendingChildCount: 0,
    totalChildCount: 2,
    childSleeves: ['carry', 'treasury'],
    executionMode: 'dry-run',
    simulated: true,
    createdAt: '2026-03-20T12:06:05.000Z',
    updatedAt: '2026-03-20T12:06:05.000Z',
    ...overrides,
  };
}

export function createRebalanceEscalationQueueSummary(
  overrides: Partial<RebalanceEscalationQueueSummaryView> = {},
): RebalanceEscalationQueueSummaryView {
  return {
    total: 1,
    open: 1,
    acknowledged: 0,
    inReview: 0,
    resolved: 0,
    overdue: 0,
    dueSoon: 1,
    unassigned: 0,
    mine: 0,
    ...overrides,
  };
}

export function createRebalanceBundleDetail(
  overrides: Partial<RebalanceBundleDetailView> = {},
): RebalanceBundleDetailView {
  return {
    bundle: createRebalanceBundle(),
    graph: createRebalanceExecutionGraph({
      recoveryActions: [createRebalanceBundleRecoveryAction()],
      resolutionActions: [createRebalanceBundleResolutionAction()],
    }),
    partialProgress: createRebalanceBundlePartialProgress(),
    recoveryCandidates: [createRebalanceBundleRecoveryCandidate()],
    recoveryActions: [createRebalanceBundleRecoveryAction()],
    resolutionOptions: [createRebalanceBundleResolutionOption()],
    resolutionActions: [createRebalanceBundleResolutionAction()],
    escalation: createRebalanceBundleEscalation(),
    escalationHistory: [createRebalanceBundleEscalationEvent()],
    escalationTransitions: [
      createRebalanceBundleEscalationTransition(),
      createRebalanceBundleEscalationTransition({
        id: 'rebalance-bundle-1:acknowledge',
        transitionType: 'acknowledge',
        targetStatus: 'acknowledged',
        noteRequired: false,
        assigneeRequired: false,
        summary: 'Acknowledge that the escalation owner has accepted the handoff.',
        operatorAction: 'Record acknowledgement once the owner accepts responsibility for follow-up.',
      }),
    ],
    ...overrides,
  };
}

export function createMismatch(overrides: Partial<RuntimeMismatchView> = {}): RuntimeMismatchView {
  return {
    id: 'mismatch-1',
    dedupeKey: 'reconciliation:position_exposure_mismatch:sim-venue-a:BTC',
    category: 'position_exposure_mismatch',
    severity: 'high',
    sourceKind: 'reconciliation',
    sourceComponent: 'sentinel-runtime',
    entityType: 'position',
    entityId: 'BTC',
    summary: 'BTC projected position does not match venue state.',
    details: { asset: 'BTC' },
    status: 'open',
    firstDetectedAt: '2026-03-20T12:00:00.000Z',
    lastDetectedAt: '2026-03-20T12:01:00.000Z',
    occurrenceCount: 2,
    acknowledgedAt: null,
    acknowledgedBy: null,
    recoveryStartedAt: null,
    recoveryStartedBy: null,
    recoverySummary: null,
    linkedCommandId: 'command-1',
    linkedRecoveryEventId: 'event-1',
    resolvedAt: null,
    resolvedBy: null,
    resolutionSummary: null,
    verifiedAt: null,
    verifiedBy: null,
    verificationSummary: null,
    verificationOutcome: null,
    reopenedAt: null,
    reopenedBy: null,
    reopenSummary: null,
    lastStatusChangeAt: '2026-03-20T12:01:00.000Z',
    updatedAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createCommand(overrides: Partial<RuntimeCommandView> = {}): RuntimeCommandView {
  return {
    commandId: 'command-1',
    commandType: 'run_cycle',
    status: 'completed',
    requestedBy: 'ops-user',
    claimedBy: 'worker-1',
    payload: {},
    result: { runId: 'run-1' },
    errorMessage: null,
    requestedAt: '2026-03-20T12:00:00.000Z',
    startedAt: '2026-03-20T12:00:05.000Z',
    completedAt: '2026-03-20T12:01:00.000Z',
    updatedAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createRecoveryEvent(overrides: Partial<RuntimeRecoveryEventView> = {}): RuntimeRecoveryEventView {
  return {
    id: 'event-1',
    mismatchId: 'mismatch-1',
    commandId: 'command-1',
    runId: 'run-1',
    eventType: 'runtime_command_completed',
    status: 'completed',
    sourceComponent: 'runtime-worker',
    actorId: 'ops-user',
    message: 'Cycle completed.',
    details: {},
    occurredAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createReconciliationRun(
  overrides: Partial<RuntimeReconciliationRunView> = {},
): RuntimeReconciliationRunView {
  return {
    id: 'recon-1',
    runType: 'runtime_reconciliation',
    trigger: 'post_cycle',
    triggerReference: 'run-1',
    sourceComponent: 'sentinel-runtime',
    triggeredBy: 'ops-user',
    status: 'completed',
    findingCount: 1,
    linkedMismatchCount: 1,
    summary: {},
    errorMessage: null,
    startedAt: '2026-03-20T12:01:05.000Z',
    completedAt: '2026-03-20T12:01:10.000Z',
    createdAt: '2026-03-20T12:01:05.000Z',
    updatedAt: '2026-03-20T12:01:10.000Z',
    ...overrides,
  };
}

export function createReconciliationFinding(
  overrides: Partial<RuntimeReconciliationFindingView> = {},
): RuntimeReconciliationFindingView {
  return {
    id: 'finding-1',
    reconciliationRunId: 'recon-1',
    dedupeKey: 'position_exposure_mismatch:sim-venue-a:BTC',
    findingType: 'position_exposure_mismatch',
    severity: 'high',
    status: 'active',
    sourceComponent: 'sentinel-runtime',
    subsystem: 'position_projection',
    venueId: 'sim-venue-a',
    entityType: 'position',
    entityId: 'BTC',
    mismatchId: 'mismatch-1',
    summary: 'BTC position mismatch is active.',
    expectedState: { size: '1.0' },
    actualState: { size: '0.8' },
    delta: { sizeDelta: '0.2' },
    details: {},
    detectedAt: '2026-03-20T12:01:10.000Z',
    createdAt: '2026-03-20T12:01:10.000Z',
    ...overrides,
  };
}

export function createReconciliationSummary(): RuntimeReconciliationSummaryView {
  return {
    latestRun: createReconciliationRun(),
    latestCompletedRun: createReconciliationRun(),
    latestFindingCount: 1,
    latestLinkedMismatchCount: 1,
    latestStatusCounts: {
      active: 1,
      resolved: 0,
    },
    latestSeverityCounts: {
      low: 0,
      medium: 0,
      high: 1,
      critical: 0,
    },
    latestTypeCounts: {
      order_state_mismatch: 0,
      position_exposure_mismatch: 1,
      projection_state_mismatch: 0,
      stale_projection_state: 0,
      command_outcome_mismatch: 0,
      missing_venue_truth_snapshot: 0,
      stale_venue_truth_snapshot: 0,
      venue_truth_unavailable: 0,
      venue_truth_partial_coverage: 0,
      venue_execution_reference_mismatch: 0,
      drift_position_mismatch: 0,
      drift_order_inventory_mismatch: 0,
      drift_subaccount_identity_mismatch: 0,
      drift_health_state_mismatch: 0,
      drift_market_identity_mismatch: 0,
      drift_position_identity_gap: 0,
      drift_partial_health_comparison: 0,
      drift_partial_market_identity_comparison: 0,
      drift_truth_comparison_gap: 0,
      stale_internal_derivative_state: 0,
    },
  };
}

export function createInternalDerivativeSnapshot(
  overrides: Partial<InternalDerivativeSnapshotView> = {},
): InternalDerivativeSnapshotView {
  return {
    id: 'internal-derivative-snapshot-1',
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    sourceComponent: 'sentinel-runtime',
    sourceRunId: 'run-1',
    sourceReference: 'carry-action-1',
    capturedAt: '2026-03-20T12:01:03.000Z',
    updatedAt: '2026-03-20T12:01:03.000Z',
    coverage: {
      accountState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      positionState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      healthState: {
        status: 'available',
        reason: null,
        limitations: [
          'Internal health posture is derived from internal portfolio and risk projections, not from venue-native Drift margin math.',
          'Only band-level health comparison is currently truthful; exact margin fields remain external-only.',
        ],
      },
      orderState: {
        status: 'partial',
        reason: 'One internal open order does not yet have a venue order id for direct comparison.',
        limitations: [
          'Orders without a venue order id remain canonical internally but are only partially comparable to external open-order truth.',
        ],
      },
    },
    accountState: {
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      configured: true,
      accountLocatorMode: 'authority_subaccount',
      accountAddress: null,
      authorityAddress: 'drift-authority',
      subaccountId: 0,
      accountLabel: 'Apex Carry',
      methodology: 'runtime_operator_config',
      notes: ['The runtime tracks authority plus subaccount identity from operator configuration.'],
      provenance: {
        classification: 'canonical',
        source: 'runtime_derivative_tracking_config',
        notes: ['Internal account identity is sourced from Sentinel Apex runtime configuration.'],
      },
    },
    positionState: {
      positions: [
        {
          positionKey: 'perp:0',
          asset: 'BTC',
          marketType: 'perp',
          side: 'long',
          netQuantity: '0.75',
          averageEntryPrice: '68333.333333',
          executedBuyQuantity: '0.95',
          executedSellQuantity: '0.2',
          fillCount: 3,
          sourceOrderCount: 2,
          firstFilledAt: '2026-03-20T11:40:00.000Z',
          lastFilledAt: '2026-03-20T11:58:30.000Z',
          marketIdentity: {
            asset: 'BTC',
            marketType: 'perp',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            normalizedKey: 'perp:0',
            normalizedKeyType: 'market_index',
            confidence: 'exact',
            notes: ['Internal position identity inherited exact market metadata from a source order.'],
            provenance: {
              classification: 'canonical',
              source: 'runtime_fill_ledger',
              notes: ['Internal market identity was sourced from exact order metadata.'],
            },
          },
          metadata: {
            instrumentType: 'perpetual',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
          },
          provenance: {
            classification: 'derived',
            source: 'runtime_fills_joined_to_orders',
            notes: ['Internal position inventory is reconstructed from persisted fills joined to order metadata.'],
          },
        },
      ],
      openPositionCount: 1,
      methodology: 'runtime_fills_joined_to_orders',
      notes: ['Position inventory is derived from internal fills rather than external venue truth.'],
      provenance: {
        classification: 'derived',
        source: 'runtime_fills_joined_to_orders',
        notes: ['Internal positions are reconstructed from canonical fill records.'],
      },
    },
    healthState: {
      healthStatus: 'healthy',
      modelType: 'internal_risk_posture',
      comparisonMode: 'status_band_only',
      riskPosture: 'normal',
      collateralLikeUsd: '109150.25',
      liquidityReserveUsd: '109150.25',
      grossExposureUsd: '51000',
      netExposureUsd: '51000',
      venueExposureUsd: '51000',
      exposureToNavRatio: '0.204',
      liquidityReservePct: 43.66,
      leverage: '2.11',
      openPositionCount: 1,
      openOrderCount: 2,
      openCircuitBreakers: [],
      unsupportedReasons: ['Exact Drift collateral, free collateral, margin ratio, and requirement fields remain external-only.'],
      methodology: 'portfolio_current_plus_risk_current',
      notes: [
        'Internal health posture is derived from persisted portfolio and risk read models.',
        'Collateral-like posture maps to internal liquidity reserve rather than exact Drift collateral accounting.',
      ],
      provenance: {
        classification: 'derived',
        source: 'portfolio_current_plus_risk_current',
        notes: ['Internal health posture is derived from internal runtime projections rather than external venue truth.'],
      },
    },
    orderState: {
      openOrderCount: 2,
      comparableOpenOrderCount: 1,
      nonComparableOpenOrderCount: 1,
      openOrders: [
        {
          orderKey: '901',
          clientOrderId: 'client-order-1',
          venueOrderId: '901',
          asset: 'BTC',
          marketType: 'perp',
          side: 'buy',
          status: 'open',
          requestedSize: '0.1',
          filledSize: '0',
          remainingSize: '0.1',
          requestedPrice: '68000',
          reduceOnly: false,
          executionMode: 'dry-run',
          comparableByVenueOrderId: true,
          submittedAt: '2026-03-20T12:00:40.000Z',
          completedAt: null,
          updatedAt: '2026-03-20T12:01:03.000Z',
          marketIdentity: {
            asset: 'BTC',
            marketType: 'perp',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            normalizedKey: 'perp:0',
            normalizedKeyType: 'market_index',
            confidence: 'exact',
            notes: ['Internal order market identity is sourced from persisted order metadata.'],
            provenance: {
              classification: 'canonical',
              source: 'runtime_orders_table',
              notes: ['Internal market identity was sourced from exact order metadata.'],
            },
          },
          metadata: {
            instrumentType: 'perpetual',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
          },
          provenance: {
            classification: 'canonical',
            source: 'runtime_orders_table',
            notes: ['Open-order inventory comes from persisted runtime order records.'],
          },
        },
        {
          orderKey: 'client-order-2',
          clientOrderId: 'client-order-2',
          venueOrderId: null,
          asset: 'SOL',
          marketType: 'spot',
          side: 'sell',
          status: 'open',
          requestedSize: '4.5',
          filledSize: '0',
          remainingSize: '4.5',
          requestedPrice: '151.25',
          reduceOnly: false,
          executionMode: 'dry-run',
          comparableByVenueOrderId: false,
          submittedAt: '2026-03-20T12:00:50.000Z',
          completedAt: null,
          updatedAt: '2026-03-20T12:01:03.000Z',
          marketIdentity: {
            asset: 'SOL',
            marketType: 'spot',
            marketIndex: null,
            marketKey: null,
            marketSymbol: 'SOL',
            normalizedKey: 'spot:SOL',
            normalizedKeyType: 'market_symbol',
            confidence: 'derived',
            notes: ['Internal order market identity is derived from order asset plus instrument type.'],
            provenance: {
              classification: 'derived',
              source: 'runtime_orders_table',
              notes: ['Internal market symbol is derived from asset plus market type, not from venue-native order metadata.'],
            },
          },
          metadata: {
            instrumentType: 'spot',
          },
          provenance: {
            classification: 'canonical',
            source: 'runtime_orders_table',
            notes: ['This internal order exists canonically even before a venue order id is assigned.'],
          },
        },
      ],
      methodology: 'runtime_orders_table',
      notes: ['Open-order inventory is sourced from persisted internal order lifecycle state.'],
      provenance: {
        classification: 'canonical',
        source: 'runtime_orders_table',
        notes: ['Open-order inventory is based on persisted runtime orders.'],
      },
    },
    metadata: {
      scenario: 'phase-5-6-fixture',
    },
    ...overrides,
  };
}

export function createVenueComparisonSummary(
  overrides: Partial<VenueDerivativeComparisonSummaryView> = {},
): VenueDerivativeComparisonSummaryView {
  return {
    internalSnapshotAt: '2026-03-20T12:01:03.000Z',
    externalSnapshotAt: '2026-03-20T12:01:00.000Z',
    subaccountIdentity: {
      status: 'available',
      reason: null,
    },
    positionInventory: {
      status: 'available',
      reason: null,
    },
    marketIdentity: {
      status: 'available',
      reason: null,
    },
    healthState: {
      status: 'partial',
      reason: 'Only band-level internal-vs-external health comparison is currently supported.',
    },
    orderInventory: {
      status: 'partial',
      reason: 'One internal open order does not yet have a venue order id for direct comparison.',
    },
    healthComparisonMode: 'status_band_only',
    exactPositionIdentityCount: 1,
    partialPositionIdentityCount: 0,
    positionIdentityGapCount: 0,
    matchedPositionCount: 1,
    mismatchedPositionCount: 0,
    matchedOrderCount: 1,
    mismatchedOrderCount: 0,
    activeFindingCount: 1,
    activeMismatchCount: 0,
    notes: [
      'Position comparison now carries normalized market identity and exact-vs-derived comparison semantics.',
      'Health comparison is now band-level only; exact Drift collateral and margin fields remain external-only.',
    ],
    ...overrides,
  };
}

function createVenueSnapshotFixture(): VenueSnapshotView {
  return {
    id: 'venue-snapshot-1',
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    connectorType: 'drift_native_readonly',
    sleeveApplicability: ['carry'],
    truthMode: 'real',
    readOnlySupport: true,
    executionSupport: false,
    approvedForLiveUse: false,
    onboardingState: 'read_only',
    missingPrerequisites: [],
    authRequirementsSummary: ['DRIFT_RPC_ENDPOINT', 'DRIFT_READONLY_ACCOUNT_ADDRESS'],
    healthy: true,
    healthState: 'healthy',
    degradedReason: null,
    truthProfile: 'derivative_aware',
    snapshotType: 'drift_native_user_account',
    snapshotSuccessful: true,
    snapshotSummary: 'Drift-native read-only snapshot captured for Apex Carry with 2 positions, 2 open orders, and health score 84.',
    snapshotPayload: {
      accountAddress: 'readonly-account',
      authorityAddress: 'drift-authority',
      subaccountId: 0,
      openOrderCount: 2,
      openPositionCount: 2,
      healthScore: 84,
    },
    errorMessage: null,
    capturedAt: '2026-03-20T12:01:00.000Z',
    snapshotCompleteness: 'complete',
    truthCoverage: createVenueInventoryItem().truthCoverage,
    comparisonCoverage: createVenueInventoryItem().comparisonCoverage,
    sourceMetadata: createVenueInventoryItem().sourceMetadata,
    accountState: {
      accountAddress: 'readonly-account',
      accountLabel: 'Apex Carry',
      accountExists: true,
      ownerProgram: 'drift-program',
      executable: false,
      lamports: '12000000000',
      nativeBalanceDisplay: '12.000000000',
      observedSlot: '123',
      rentEpoch: '0',
      dataLength: 512,
    },
    balanceState: null,
    capacityState: null,
    exposureState: {
      exposures: [{
        exposureKey: 'perp:0:readonly-account',
        exposureType: 'position',
        assetKey: 'BTC-PERP',
        quantity: '0.75',
        quantityDisplay: '0.75',
        accountAddress: 'readonly-account',
      }],
      methodology: 'drift_position_inventory_exposure',
      provenance: {
        classification: 'derived',
        source: 'drift_sdk_margin_math',
        notes: [
          'Exposure rows were derived from decoded Drift position inventory.',
        ],
      },
    },
    derivativeAccountState: {
      venue: 'drift-solana-readonly',
      accountAddress: 'readonly-account',
      accountLabel: 'Apex Carry',
      accountExists: true,
      ownerProgram: 'drift-program',
      accountModel: 'program_account',
      venueAccountType: 'drift_user',
      decoded: true,
      authorityAddress: 'drift-authority',
      subaccountId: 0,
      userName: 'Apex Carry',
      delegateAddress: 'drift-delegate',
      marginMode: 'default',
      poolId: 0,
      marginTradingEnabled: true,
      openOrderCount: 2,
      openAuctionCount: 0,
      statusFlags: ['protected_maker'],
      observedSlot: '123',
      rpcVersion: '1.18.0',
      dataLength: 512,
      rawDiscriminatorHex: '0102030405060708',
      notes: [
        'The Drift user account was decoded directly with the Drift SDK account coder.',
        'Order inventory in this snapshot comes directly from the user account, while health and liquidation metrics are SDK-derived.',
      ],
      provenance: {
        classification: 'exact',
        source: 'drift_user_account_decode',
        notes: ['Values were decoded directly from the Drift user account.'],
      },
    },
    derivativePositionState: {
      positions: [
        {
          marketIndex: 0,
          marketKey: 'perp:0',
          marketSymbol: 'BTC-PERP',
          positionType: 'perp',
          side: 'long',
          baseAssetAmount: '0.75',
          quoteAssetAmount: '-51250',
          entryPrice: '68333.333333',
          breakEvenPrice: '68400.000000',
          unrealizedPnlUsd: '950.250000',
          liquidationPrice: '52100.000000',
          positionValueUsd: '52125.000000',
          openOrders: 1,
          openBids: '0.10',
          openAsks: '0',
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: ['Inventory is exact while valuation uses Drift SDK market context.'],
          },
        },
        {
          marketIndex: 1,
          marketKey: 'spot:1',
          marketSymbol: 'SOL',
          positionType: 'spot',
          side: 'long',
          baseAssetAmount: '12.500000000',
          quoteAssetAmount: null,
          entryPrice: null,
          breakEvenPrice: null,
          unrealizedPnlUsd: null,
          liquidationPrice: '102.100000',
          positionValueUsd: '1875.000000',
          openOrders: 1,
          openBids: null,
          openAsks: null,
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: ['Spot balance identity is exact while valuation uses Drift spot-market context.'],
          },
        },
      ],
      openPositionCount: 2,
      methodology: 'drift_user_account_with_market_context',
      notes: [
        'Perp and spot inventory was decoded from the Drift user account.',
        'Valuation and liquidation fields used subscribed Drift market and oracle state where required.',
      ],
      provenance: {
        classification: 'mixed',
        source: 'drift_user_account_with_market_context',
        notes: ['Inventory is exact venue-native state while valuation fields are SDK-derived.'],
      },
    },
    derivativeHealthState: {
      healthStatus: 'healthy',
      healthScore: 84,
      collateralUsd: '153450.250000',
      marginRatio: '0.2841',
      leverage: '2.1100',
      maintenanceMarginRequirementUsd: '18050.000000',
      initialMarginRequirementUsd: '26250.000000',
      freeCollateralUsd: '109150.250000',
      methodology: 'drift_sdk_margin_calculation',
      notes: [
        'Health, collateral, leverage, and margin metrics are derived from decoded Drift user, market, and oracle state.',
      ],
      provenance: {
        classification: 'derived',
        source: 'drift_sdk_margin_math',
        notes: ['All health and margin metrics are SDK-derived from venue-native state.'],
      },
    },
    orderState: {
      openOrderCount: 2,
      openOrders: [
        {
          marketIndex: 0,
          venueOrderId: '901',
          reference: '41',
          marketKey: 'perp:0',
          marketSymbol: 'BTC-PERP',
          marketType: 'perp',
          userOrderId: 41,
          side: 'buy',
          status: 'open',
          orderType: 'limit',
          price: '68000.000000',
          quantity: '0.100000000',
          reduceOnly: false,
          accountAddress: 'readonly-account',
          slot: '123',
          placedAt: null,
          metadata: {},
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: ['Open-order inventory was decoded directly from the Drift user account.'],
          },
        },
        {
          marketIndex: 1,
          venueOrderId: '902',
          reference: '42',
          marketKey: 'spot:1',
          marketSymbol: 'SOL',
          marketType: 'spot',
          userOrderId: 42,
          side: 'sell',
          status: 'open',
          orderType: 'limit',
          price: '151.250000',
          quantity: '4.500000000',
          reduceOnly: false,
          accountAddress: 'readonly-account',
          slot: '123',
          placedAt: null,
          metadata: {},
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: ['Open-order inventory was decoded directly from the Drift user account.'],
          },
        },
      ],
      referenceMode: 'venue_open_orders',
      methodology: 'drift_user_account_open_orders',
      notes: [
        'Open-order inventory was decoded directly from the Drift user account.',
        'placedAt remains null because this read-only path does not backfill transaction timestamps for each order.',
      ],
      provenance: {
        classification: 'exact',
        source: 'drift_user_account_decode',
        notes: ['Open-order inventory was decoded directly from the Drift user account.'],
      },
    },
    executionReferenceState: {
      referenceLookbackLimit: 10,
      references: [{
        referenceType: 'solana_signature',
        reference: 'sig-fixture-1',
        accountAddress: 'readonly-account',
        slot: '123',
        blockTime: '2026-03-20T12:00:30.000Z',
        confirmationStatus: 'confirmed',
        errored: false,
        memo: null,
      }],
      oldestReferenceAt: '2026-03-20T12:00:30.000Z',
    },
    executionConfirmationState: createConnectorPostTradeConfirmationEvidence(),
    metadata: {},
  };
}

export function createVenueComparisonDetail(
  overrides: Partial<VenueDerivativeComparisonDetailView> = {},
): VenueDerivativeComparisonDetailView {
  const internalState = createInternalDerivativeSnapshot();
  const externalSnapshot = createVenueSnapshotFixture();
  const activeFinding = createReconciliationFinding({
    id: 'finding-drift-gap-1',
    dedupeKey: 'drift_truth_comparison_gap:drift-solana-readonly',
    findingType: 'drift_truth_comparison_gap',
    severity: 'low',
    venueId: 'drift-solana-readonly',
    entityType: 'venue_connector',
    entityId: 'drift-solana-readonly',
    mismatchId: null,
    subsystem: 'derivative_truth_comparison',
    summary: 'Derivative truth comparison remains partial for health and one internal order.',
    expectedState: {
      healthState: 'available_or_external_unsupported',
      orderInventory: 'available_or_external_unsupported',
    },
    actualState: {
      healthState: 'partial',
      orderInventory: 'partial',
    },
    delta: {},
  });

  return {
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    internalState,
    externalSnapshot,
    summary: createVenueComparisonSummary(),
    accountComparison: {
      comparable: true,
      status: 'matched',
      internalState: internalState.accountState,
      externalState: externalSnapshot.derivativeAccountState,
      notes: ['Authority and subaccount identity align between internal configuration and external Drift truth.'],
    },
    positionComparisons: [
      {
        comparisonKey: 'perp:0',
        asset: 'BTC',
        marketType: 'perp',
        comparable: true,
        status: 'matched',
        quantityDelta: '0',
        internalPosition: internalState.positionState?.positions[0] ?? null,
        externalPosition: externalSnapshot.derivativePositionState?.positions[0] ?? null,
        marketIdentityComparison: {
          comparable: true,
          status: 'matched',
          comparisonMode: 'exact',
          internalIdentity: internalState.positionState?.positions[0]?.marketIdentity ?? null,
          externalIdentity: {
            asset: 'BTC',
            marketType: 'perp',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            normalizedKey: 'perp:0',
            normalizedKeyType: 'market_index',
            confidence: 'exact',
            notes: [],
            provenance: externalSnapshot.derivativePositionState?.positions[0]?.provenance ?? null,
          },
          normalizedIdentity: {
            key: 'perp:0',
            keyType: 'market_index',
            comparisonMode: 'exact',
            notes: [],
          },
          notes: [],
        },
        notes: ['Comparison uses internal fill-derived positions against external Drift-native position inventory.'],
      },
    ],
    orderComparisons: [
      {
        comparisonKey: '901',
        comparable: true,
        status: 'matched',
        remainingSizeDelta: '0',
        internalOrder: internalState.orderState?.openOrders[0] ?? null,
        externalOrder: externalSnapshot.orderState?.openOrders[0] ?? null,
        marketIdentityComparison: {
          comparable: true,
          status: 'matched',
          comparisonMode: 'exact',
          internalIdentity: internalState.orderState?.openOrders[0]?.marketIdentity ?? null,
          externalIdentity: {
            asset: 'BTC',
            marketType: 'perp',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            normalizedKey: 'perp:0',
            normalizedKeyType: 'market_index',
            confidence: 'exact',
            notes: [],
            provenance: externalSnapshot.orderState?.openOrders[0]?.provenance ?? null,
          },
          normalizedIdentity: {
            key: 'perp:0',
            keyType: 'market_index',
            comparisonMode: 'exact',
            notes: [],
          },
          notes: [],
        },
        notes: ['Order comparison only includes open internal orders with a venue order id.'],
      },
    ],
    healthComparison: {
      comparable: true,
      status: 'matched',
      comparisonMode: 'status_band_only',
      internalState: internalState.healthState,
      externalState: externalSnapshot.derivativeHealthState,
      fields: [
        {
          field: 'healthStatus',
          comparable: true,
          status: 'matched',
          internalValue: 'healthy',
          externalValue: 'healthy',
          reason: null,
        },
        {
          field: 'collateralLikeUsd',
          comparable: false,
          status: 'not_comparable',
          internalValue: '109150.25',
          externalValue: '153450.25',
          reason: 'Internal collateral-like posture maps to liquidity reserve, not exact venue collateral.',
        },
      ],
      notes: ['Only band-level health comparison is currently supported.'],
    },
    activeFindings: [activeFinding],
    ...overrides,
  };
}

export function createMismatchDetail(
  overrides: Partial<RuntimeMismatchDetailView> = {},
): RuntimeMismatchDetailView {
  const mismatch = createMismatch();
  const finding = createReconciliationFinding();
  const command = createCommand();
  const event = createRecoveryEvent();

  return {
    mismatch,
    linkedCommand: command,
    recoveryEvents: [event],
    remediationHistory: [],
    latestRemediation: null,
    reconciliationFindings: [finding],
    latestReconciliationFinding: finding,
    recommendedRemediationTypes: ['rebuild_projections', 'run_cycle'],
    isActionable: true,
    remediationInFlight: false,
    ...overrides,
  };
}

export function createTreasurySummary(
  overrides: Partial<TreasurySummaryView> = {},
): TreasurySummaryView {
  return {
    treasuryRunId: 'treasury-run-1',
    sourceRunId: 'run-1',
    sleeveId: 'treasury',
    simulated: true,
    policy: {
      sleeveId: 'treasury',
      reserveFloorPct: 10,
      minReserveUsd: '10000',
      minimumRemainingIdleUsd: '10000',
      maxAllocationPctPerVenue: 50,
      minimumDeployableUsd: '2500',
      eligibleVenues: ['atlas-t0-sim', 'atlas-t1-sim'],
    },
    reserveStatus: {
      totalCapitalUsd: '125000',
      idleCapitalUsd: '25000',
      allocatedCapitalUsd: '100000',
      requiredReserveUsd: '12500',
      currentReserveUsd: '25000',
      reserveCoveragePct: '200.00',
      surplusCapitalUsd: '12500',
      reserveShortfallUsd: '0.00',
    },
    actionCount: 2,
    alerts: [],
    concentrationLimitBreached: false,
    evaluatedAt: '2026-03-20T12:01:00.000Z',
    updatedAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createCarryVenue(
  overrides: Partial<CarryVenueView> = {},
): CarryVenueView {
  return {
    strategyRunId: 'run-1',
    venueId: 'sim-venue-a',
    venueMode: 'simulated',
    executionSupported: true,
    supportsIncreaseExposure: true,
    supportsReduceExposure: true,
    readOnly: false,
    approvedForLiveUse: false,
    healthy: true,
    onboardingState: 'simulated',
    missingPrerequisites: ['live_connector_not_available'],
    metadata: {},
    updatedAt: '2026-03-20T12:01:00.000Z',
    createdAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createCarryStrategyProfile(
  overrides: Partial<CarryStrategyProfileView> = {},
): CarryStrategyProfileView {
  return {
    strategyId: 'apex-usdc-delta-neutral-carry',
    strategyName: 'Apex USDC Delta-Neutral Carry',
    sleeveId: 'carry',
    vaultBaseAsset: 'USDC',
    strategyFamily: 'delta_neutral_carry',
    yieldSourceCategory: 'delta_neutral_carry',
    leverageModel: 'perp_basis_hedged',
    leverageHealthThreshold: '1.10',
    oracleDependencyClass: 'market_oracle_non_hardcoded',
    lockReassessmentPolicy: 'rolling_3_month',
    thesis: 'Capture delta-neutral carry without DEX LP, junior tranche, insurance pool, or circular stable yield exposure.',
    riskProfile: 'Constrained and operator-supervised.',
    disallowedYieldSources: [
      'yield_bearing_stable_circular',
      'junior_tranche',
      'insurance_pool',
      'dex_lp',
    ],
    apy: {
      targetFloorPct: '10.00',
      targetApyPct: '10.00',
      projectedApyPct: '12.40',
      projectedApySource: 'projected',
      realizedApyPct: null,
      realizedApySource: 'unavailable',
      realizedApyUpdatedAt: null,
      summary: 'Realized APY is currently unavailable or unverified; only target and projected APY are surfaced.',
    },
    tenor: {
      lockPeriodMonths: 3,
      rolling: true,
      reassessmentCadenceMonths: 3,
      summary: 'Lock period is 3 months and reassessment occurs every 3 months on a rolling basis.',
    },
    riskLimits: [
      {
        key: 'max_drawdown_pct',
        value: '12.00',
        summary: 'Strategy-level drawdown limit for hackathon-facing vault metadata.',
      },
      {
        key: 'min_health_threshold',
        value: '1.10',
        summary: 'Explicit leverage health threshold metadata is required whenever leverage is present.',
      },
      {
        key: 'max_single_action_notional_usd',
        value: '25000.00',
        summary: 'Carry action notional stays bounded while the vault remains devnet-only and manually supervised.',
      },
    ],
    evidence: {
      environment: 'devnet',
      supportLabel: 'devnet_real_execution_narrow_scope',
      supportedScope: [
        'USDC-denominated carry strategy metadata and policy enforcement.',
        'Jupiter Perpetuals devnet execution evidence for BTC-PERP, ETH-PERP, and SOL-PERP.',
      ],
      blockedScope: [
        'Mainnet deployment remains blocked.',
        'DEX LP, junior tranche, insurance pool, and circular stable yield remain blocked.',
      ],
      latestExecutionId: 'carry-execution-1',
      latestExecutionReference: 'drift-devnet:signature-1',
      latestConfirmationStatus: 'confirmed_full',
      latestEvidenceSource: 'devnet_execution',
      summary: 'Latest strategy evidence includes a persisted Jupiter Perpetuals devnet execution reference plus the current confirmation state for the current real execution path.',
    },
    eligibility: {
      status: 'eligible',
      summary: 'Strategy metadata satisfies the Build-A-Bear product-policy rules, but execution scope remains narrow and devnet-only.',
      blockedReasons: [],
      ruleResults: [
        {
          ruleKey: 'base_asset_usdc',
          status: 'pass',
          summary: 'Vault base asset is USDC as required.',
          blockedReason: null,
          details: {},
        },
        {
          ruleKey: 'tenor_three_month_rolling',
          status: 'pass',
          summary: 'Tenor is a 3-month rolling lock with 3-month reassessment cadence.',
          blockedReason: null,
          details: {},
        },
        {
          ruleKey: 'target_apy_floor',
          status: 'pass',
          summary: 'Target APY floor is 10.00% and meets the 10.00% minimum.',
          blockedReason: null,
          details: {},
        },
        {
          ruleKey: 'allowed_yield_source',
          status: 'pass',
          summary: 'Yield source category delta_neutral_carry is allowed for Build-A-Bear.',
          blockedReason: null,
          details: {},
        },
        {
          ruleKey: 'leverage_health_metadata',
          status: 'pass',
          summary: 'Leverage metadata is explicit and includes a health threshold.',
          blockedReason: null,
          details: {},
        },
        {
          ruleKey: 'unsafe_looping_leverage',
          status: 'pass',
          summary: 'No disqualifying unsafe looping leverage condition is present.',
          blockedReason: null,
          details: {},
        },
      ],
    },
    ...overrides,
  };
}

export function createSubmissionDossier(
  overrides: Partial<SubmissionDossierView> = {},
): SubmissionDossierView {
  return {
    submissionId: 'build-a-bear-main-track',
    submissionName: 'Build-A-Bear Main Track',
    track: 'build_a_bear_main_track',
    strategyId: 'apex-usdc-delta-neutral-carry',
    strategyName: 'Apex USDC Delta-Neutral Carry',
    vaultId: 'apex-usdc-carry-vault',
    vaultName: 'Apex USDC Delta-Neutral Carry Vault',
    baseAsset: 'USDC',
    buildWindowStart: '2026-03-09T00:00:00.000Z',
    buildWindowEnd: '2026-04-06T23:59:59.999Z',
    cluster: 'mainnet-beta',
    addressScope: 'both',
    walletAddress: 'submission-wallet-1',
    walletVerificationUrl: 'https://solscan.io/account/submission-wallet-1',
    vaultAddress: 'submission-vault-1',
    vaultVerificationUrl: 'https://solscan.io/account/submission-vault-1',
    managerWalletAddress: null,
    latestExecutionReference: 'signature-1',
    latestExecutionReferenceUrl: 'https://solscan.io/tx/signature-1',
    latestExecutionAt: '2026-03-20T12:01:05.000Z',
    rangerVaultAddress: 'submission-vault-1',
    rangerLpMintAddress: 'submission-lp-mint-1',
    rangerVaultProgramId: 'vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8',
    rangerAdaptorProgramId: 'EW35URAx3LiM13fFK3QxAXfGemHso9HWPixrv7YDY4AM',
    rangerStrategyAddress: 'submission-strategy-1',
    rangerLpMetadataUri: 'https://example.com/sentinel-lp.json',
    rangerStrategyInitialized: true,
    rangerFundsAllocated: true,
    strategyDocumentationUrl: 'https://example.com/apex-carry-strategy-docs',
    codeRepositoryUrl: 'https://github.com/sentinel/apex',
    codeRepositoryVisibility: 'private',
    privateRepoReviewerAdded: true,
    realExecutionCountInWindow: 2,
    simulatedExecutionCountInWindow: 4,
    realizedApyPct: null,
    cexExecutionUsed: false,
    cexVenues: [],
    cexTradeHistoryProvided: false,
    cexReadOnlyApiKeyProvided: false,
    supportedScope: [
      'USDC-denominated carry strategy metadata and policy enforcement.',
      'Jupiter Perpetuals devnet execution evidence for BTC-PERP, ETH-PERP, and SOL-PERP.',
    ],
    blockedScope: [
      'Mainnet deployment remains blocked.',
      'Generic Ranger vault integration remains blocked.',
    ],
    notes: 'Canonical submission dossier still blocked on real realized performance evidence.',
    metadata: {},
    readiness: {
      status: 'blocked',
      summary: 'Submission dossier is still blocked because one or more eligibility or verification requirements are unmet.',
      blockedReasons: ['realized_apy_evidence_missing'],
      warnings: [],
      checks: [
        {
          key: 'submission_address_present',
          status: 'pass',
          summary: 'Submission includes a wallet or vault address for on-chain verification.',
          blockedReason: null,
          details: {},
        },
        {
          key: 'realized_performance_evidence',
          status: 'fail',
          summary: 'Realized APY evidence is not currently persisted.',
          blockedReason: 'realized_apy_evidence_missing',
          details: {},
        },
      ],
    },
    createdAt: '2026-04-04T09:00:00.000Z',
    updatedAt: '2026-04-04T09:10:00.000Z',
    ...overrides,
  };
}

export function createSubmissionEvidence(
  overrides: Partial<SubmissionEvidenceRecordView> = {},
): SubmissionEvidenceRecordView {
  return {
    evidenceId: 'submission-evidence-1',
    submissionId: 'build-a-bear-main-track',
    evidenceType: 'on_chain_transaction',
    status: 'verified',
    source: 'solscan',
    label: 'Primary submission trade',
    summary: 'Canonical on-chain trade captured inside the build window.',
    reference: 'signature-1',
    url: 'https://solscan.io/tx/signature-1',
    capturedAt: '2026-03-20T12:01:05.000Z',
    withinBuildWindow: true,
    notes: null,
    metadata: {},
    createdAt: '2026-04-04T09:05:00.000Z',
    updatedAt: '2026-04-04T09:05:00.000Z',
    ...overrides,
  };
}

export function createSubmissionExportBundle(
  overrides: Partial<SubmissionExportBundleView> = {},
): SubmissionExportBundleView {
  return {
    generatedAt: '2026-04-04T09:15:00.000Z',
    dossier: createSubmissionDossier(),
    evidence: [createSubmissionEvidence()],
    artifactChecklist: [
      {
        key: 'addresses',
        label: 'Canonical wallet or vault address',
        required: true,
        status: 'pass',
        summary: 'Submission exposes 2 canonical on-chain verification address(es).',
        blockedReason: null,
        evidenceCount: 2,
        evidenceTypes: [],
      },
      {
        key: 'on_chain_trade_activity',
        label: 'On-chain trade activity in the build window',
        required: true,
        status: 'pass',
        summary: '1 explicit on-chain transaction evidence item is attached to the build window.',
        blockedReason: null,
        evidenceCount: 1,
        evidenceTypes: ['on_chain_transaction'],
      },
      {
        key: 'realized_performance',
        label: 'Realized performance evidence',
        required: true,
        status: 'fail',
        summary: 'No realized APY evidence is attached or persisted yet.',
        blockedReason: 'realized_apy_evidence_missing',
        evidenceCount: 0,
        evidenceTypes: ['performance_snapshot'],
      },
    ],
    judgeSummary:
      'Submission bundle remains blocked by 1 requirement(s): realized_apy_evidence_missing.',
    blockedReasons: ['realized_apy_evidence_missing'],
    verificationLinks: [
      'https://solscan.io/account/submission-wallet-1',
      'https://solscan.io/account/submission-vault-1',
      'https://solscan.io/tx/signature-1',
    ],
    ...overrides,
  };
}

export function createCarryAction(
  overrides: Partial<CarryActionView> = {},
): CarryActionView {
  return {
    id: 'carry-action-1',
    strategyRunId: 'run-1',
    linkedRebalanceProposalId: 'rebalance-proposal-1',
    actionType: 'increase_carry_exposure',
    status: 'recommended',
    sourceKind: 'rebalance',
    sourceReference: 'rebalance-proposal-1',
    opportunityId: 'opp-1',
    asset: 'BTC',
    summary: 'Increase carry exposure for BTC opportunity.',
    notionalUsd: '15000',
    details: {
      confidenceScore: 0.82,
    },
    readiness: 'actionable',
    executable: true,
    blockedReasons: [],
    approvalRequirement: 'operator',
    executionMode: 'dry-run',
    simulated: true,
    strategyProfile: createCarryStrategyProfile(),
    executionPlan: {
      effects: {
        currentCarryAllocationUsd: '450000',
        projectedCarryAllocationUsd: '465000',
        projectedCarryAllocationPct: 46.5,
        approvedCarryBudgetUsd: '600000',
        projectedRemainingBudgetUsd: '135000',
        openPositionCount: 2,
      },
      plannedOrderCount: 1,
      strategyProfile: createCarryStrategyProfile(),
    },
    approvedBy: null,
    approvedAt: null,
    executionRequestedBy: null,
    executionRequestedAt: null,
    queuedAt: null,
    executingAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
    linkedCommandId: null,
    latestExecutionId: null,
    lastError: null,
    actorId: 'ops-user',
    createdAt: '2026-03-20T12:02:30.000Z',
    updatedAt: '2026-03-20T12:02:30.000Z',
    ...overrides,
  };
}

export function createCarryExecution(
  overrides: Partial<CarryExecutionView> = {},
): CarryExecutionView {
  return {
    id: 'carry-execution-1',
    carryActionId: 'carry-action-1',
    strategyRunId: 'run-1',
    commandId: 'command-carry-1',
    status: 'completed',
    executionMode: 'dry-run',
    simulated: true,
    requestedBy: 'ops-user',
    startedBy: 'runtime-worker-1',
    blockedReasons: [],
    outcomeSummary: 'Simulated carry execution completed.',
    outcome: {},
    venueExecutionReference: 'sim-venue-a:carry:1',
    lastError: null,
    createdAt: '2026-03-20T12:03:00.000Z',
    startedAt: '2026-03-20T12:03:01.000Z',
    completedAt: '2026-03-20T12:03:02.000Z',
    updatedAt: '2026-03-20T12:03:02.000Z',
    ...overrides,
  };
}

export function createCarryExecutionStep(
  overrides: Partial<CarryExecutionStepView> = {},
): CarryExecutionStepView {
  return {
    id: 'carry-step-1',
    carryExecutionId: 'carry-execution-1',
    carryActionId: 'carry-action-1',
    strategyRunId: 'run-1',
    plannedOrderId: 'carry-order-intent-1',
    intentId: 'intent-1',
    venueId: 'sim-venue-a',
    venueMode: 'simulated',
    executionSupported: true,
    readOnly: false,
    approvedForLiveUse: false,
    onboardingState: 'simulated',
    asset: 'BTC',
    side: 'sell',
    orderType: 'market',
    requestedSize: '0.10',
    requestedPrice: null,
    reduceOnly: false,
    clientOrderId: 'intent-1',
    venueOrderId: 'sim-order-1',
    executionReference: 'sim-order-1',
    status: 'filled',
    simulated: true,
    filledSize: '0.10',
    averageFillPrice: '62000',
    outcomeSummary: 'Execution step completed with status filled.',
    outcome: {
      attemptCount: 1,
      fillCount: 1,
    },
    postTradeConfirmation: null,
    lastError: null,
    marketIdentity: {
      venueId: 'sim-venue-a',
      asset: 'BTC',
      marketType: 'spot',
      marketIndex: null,
      marketKey: null,
      marketSymbol: 'BTC',
      marketName: null,
      aliases: ['BTC', 'spot:BTC'],
      normalizedKey: 'spot:BTC',
      normalizedKeyType: 'market_symbol',
      provenance: 'derived',
      confidence: 'partial',
      capturedAtStage: 'execution_result',
      source: 'simulated_market_fill',
      notes: ['Simulated execution steps only expose derived spot identity.'],
    },
    metadata: {},
    createdAt: '2026-03-20T12:03:00.000Z',
    updatedAt: '2026-03-20T12:03:02.000Z',
    completedAt: '2026-03-20T12:03:02.000Z',
    ...overrides,
  };
}

export function createCarryActionDetail(
  overrides: Partial<CarryActionDetailView> = {},
): CarryActionDetailView {
  const action = createCarryAction();
  return {
    action,
    plannedOrders: [
      {
        id: 'carry-order-intent-1',
        carryActionId: action.id,
        intentId: 'intent-1',
        venueId: 'sim-venue-a',
        asset: 'BTC',
        side: 'sell',
        orderType: 'market',
        requestedSize: '0.10',
        requestedPrice: null,
        reduceOnly: false,
        marketIdentity: {
          venueId: 'sim-venue-a',
          asset: 'BTC',
          marketType: 'spot',
          marketIndex: null,
          marketKey: null,
          marketSymbol: 'BTC',
          marketName: null,
          aliases: ['BTC', 'spot:BTC'],
          normalizedKey: 'spot:BTC',
          normalizedKeyType: 'market_symbol',
          provenance: 'derived',
          confidence: 'partial',
          capturedAtStage: 'strategy_intent',
          source: 'strategy_intent_builder',
          notes: ['Carry planned orders inherit derived spot identity from strategy intents.'],
        },
        metadata: {},
        createdAt: '2026-03-20T12:02:30.000Z',
      },
    ],
    latestCommand: createCommand({
      commandId: 'command-carry-1',
      commandType: 'execute_carry_action',
      result: { carryActionId: action.id },
    }),
    executions: [createCarryExecution({ carryActionId: action.id })],
    linkedRebalanceProposal: createRebalanceProposal({ id: action.linkedRebalanceProposalId ?? 'rebalance-proposal-1' }),
    ...overrides,
  };
}

export function createCarryExecutionDetail(
  overrides: Partial<CarryExecutionDetailView> = {},
): CarryExecutionDetailView {
  const action = createCarryAction({
    status: 'completed',
    latestExecutionId: 'carry-execution-1',
    linkedCommandId: 'command-carry-1',
    executionRequestedBy: 'ops-user',
    executionRequestedAt: '2026-03-20T12:02:55.000Z',
    queuedAt: '2026-03-20T12:02:55.000Z',
    approvedBy: 'ops-user',
    approvedAt: '2026-03-20T12:02:50.000Z',
  });
  const execution = createCarryExecution({ carryActionId: action.id });
  return {
    execution,
    action,
    command: createCommand({
      commandId: execution.commandId ?? 'command-carry-1',
      commandType: 'execute_carry_action',
      result: { carryExecutionId: execution.id, carryActionId: action.id },
    }),
    linkedRebalanceProposal: createRebalanceProposal({ id: action.linkedRebalanceProposalId ?? 'rebalance-proposal-1' }),
    venueSnapshots: [createCarryVenue()],
    steps: [createCarryExecutionStep({ carryExecutionId: execution.id, carryActionId: action.id })],
    timeline: [
      {
        id: `${action.id}:recommended`,
        eventType: 'recommended',
        at: action.createdAt,
        actorId: action.actorId,
        status: 'recommended',
        summary: 'Carry action was recommended by the latest evaluation.',
        linkedCommandId: null,
        linkedExecutionId: null,
        linkedStepId: null,
        details: {},
      },
      {
        id: `${action.id}:execution:${execution.id}`,
        eventType: 'executing',
        at: execution.createdAt,
        actorId: execution.requestedBy,
        status: execution.status,
        summary: execution.outcomeSummary ?? 'Carry execution attempt was recorded.',
        linkedCommandId: execution.commandId,
        linkedExecutionId: execution.id,
        linkedStepId: null,
        details: {},
      },
    ],
    ...overrides,
  };
}

export function createTreasuryAllocation(
  overrides: Partial<TreasuryAllocationView> = {},
): TreasuryAllocationView {
  return {
    treasuryRunId: 'treasury-run-1',
    venueId: 'atlas-t0-sim',
    venueName: 'Atlas Treasury T0',
    venueMode: 'simulated',
    liquidityTier: 'instant',
    healthy: true,
    aprBps: 385,
    currentAllocationUsd: '50000',
    withdrawalAvailableUsd: '50000',
    availableCapacityUsd: '250000',
    concentrationPct: '40.00',
    updatedAt: '2026-03-20T12:01:00.000Z',
    metadata: {},
    ...overrides,
  };
}

export function createTreasuryPolicy(
  overrides: Partial<TreasuryPolicyView> = {},
): TreasuryPolicyView {
  return {
    treasuryRunId: 'treasury-run-1',
    policy: createTreasurySummary().policy,
    updatedAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createTreasuryAction(
  overrides: Partial<TreasuryActionView> = {},
): TreasuryActionView {
  return {
    id: 'treasury-action-1',
    treasuryRunId: 'treasury-run-1',
    linkedRebalanceProposalId: null,
    actionType: 'allocate_to_venue',
    status: 'recommended',
    readiness: 'actionable',
    executable: true,
    blockedReasons: [],
    approvalRequirement: 'operator',
    venueId: 'atlas-t1-sim',
    venueName: 'Atlas Treasury T1',
    venueMode: 'simulated',
    amountUsd: '12500',
    reasonCode: 'surplus_deployable',
    summary: 'Deploy surplus capital into Atlas Treasury T1.',
    details: {},
    actorId: 'ops-user',
    approvedBy: null,
    approvedAt: null,
    executionRequestedBy: null,
    executionRequestedAt: null,
    linkedCommandId: null,
    latestExecutionId: null,
    simulated: true,
    executionMode: 'dry-run',
    lastError: null,
    createdAt: '2026-03-20T12:01:00.000Z',
    updatedAt: '2026-03-20T12:01:00.000Z',
    ...overrides,
  };
}

export function createTreasuryVenue(
  overrides: Partial<TreasuryVenueView> = {},
): TreasuryVenueView {
  return {
    venueId: 'atlas-t1-sim',
    venueName: 'Atlas Treasury T1',
    venueMode: 'simulated',
    liquidityTier: 'same_day',
    healthy: true,
    aprBps: 415,
    currentAllocationUsd: '37500',
    withdrawalAvailableUsd: '37500',
    availableCapacityUsd: '125000',
    concentrationPct: '30.00',
    executionSupported: true,
    supportsAllocation: true,
    supportsReduction: true,
    readOnly: false,
    approvedForLiveUse: false,
    onboardingState: 'simulated',
    missingPrerequisites: [
      'Real connector implementation',
      'Read-only validation against venue',
      'Live enable approval',
    ],
    readinessLabel: 'Simulated execution-capable',
    simulationState: 'simulated',
    lastSnapshotAt: '2026-03-20T12:01:00.000Z',
    metadata: {},
    ...overrides,
  };
}

export function createTreasuryExecution(
  overrides: Partial<TreasuryExecutionView> = {},
): TreasuryExecutionView {
  return {
    id: 'treasury-execution-1',
    treasuryActionId: 'treasury-action-1',
    treasuryRunId: 'treasury-run-1',
    commandId: 'command-1',
    status: 'completed',
    executionMode: 'dry-run',
    venueMode: 'simulated',
    simulated: true,
    requestedBy: 'ops-user',
    startedBy: 'runtime-worker-1',
    blockedReasons: [],
    outcomeSummary: 'Simulated allocation completed.',
    outcome: {},
    venueExecutionReference: 'atlas-t1-sim-treasury-1',
    lastError: null,
    createdAt: '2026-03-20T12:02:00.000Z',
    startedAt: '2026-03-20T12:02:01.000Z',
    completedAt: '2026-03-20T12:02:02.000Z',
    updatedAt: '2026-03-20T12:02:02.000Z',
    ...overrides,
  };
}

export function createTreasuryActionDetail(
  overrides: Partial<TreasuryActionDetailView> = {},
): TreasuryActionDetailView {
  const action = createTreasuryAction();
  return {
    action,
    latestCommand: createCommand({
      commandId: 'command-treasury-1',
      commandType: 'execute_treasury_action',
      result: { treasuryActionId: action.id },
    }),
    executions: [createTreasuryExecution({ treasuryActionId: action.id })],
    timeline: [
      {
        id: 'timeline-1',
        eventType: 'recommended',
        at: action.createdAt,
        actorId: action.actorId,
        status: action.status,
        summary: 'Treasury recommendation persisted.',
        linkedCommandId: null,
        linkedExecutionId: null,
        details: {},
      },
    ],
    linkedRebalanceProposal: null,
    venue: createTreasuryVenue({ venueId: action.venueId ?? 'atlas-t1-sim' }),
    summary: createTreasurySummary(),
    policy: createTreasuryPolicy(),
    ...overrides,
  };
}

export function createTreasuryExecutionDetail(
  overrides: Partial<TreasuryExecutionDetailView> = {},
): TreasuryExecutionDetailView {
  const execution = createTreasuryExecution();
  const action = createTreasuryAction({ id: execution.treasuryActionId });
  return {
    execution,
    action,
    command: createCommand({
      commandId: execution.commandId ?? 'command-treasury-1',
      commandType: 'execute_treasury_action',
      result: { executionId: execution.id },
    }),
    linkedRebalanceProposal: null,
    executionKind: 'venue_execution',
    venue: createTreasuryVenue(),
    timeline: [
      {
        id: 'timeline-execution-1',
        eventType: 'completed',
        at: execution.completedAt ?? execution.updatedAt,
        actorId: execution.startedBy,
        status: execution.status,
        summary: execution.outcomeSummary ?? 'Execution completed.',
        linkedCommandId: execution.commandId,
        linkedExecutionId: execution.id,
        details: execution.outcome,
      },
    ],
    ...overrides,
  };
}

export function createTreasuryVenueDetail(
  overrides: Partial<TreasuryVenueDetailView> = {},
): TreasuryVenueDetailView {
  const venue = createTreasuryVenue();
  return {
    venue,
    policy: createTreasuryPolicy(),
    latestSummary: createTreasurySummary(),
    recentActions: [createTreasuryAction({ venueId: venue.venueId, venueName: venue.venueName })],
    recentExecutions: [createTreasuryExecution()],
    ...overrides,
  };
}

export function createVenueInventoryItem(
  overrides: Partial<VenueInventoryItemView> = {},
): VenueInventoryItemView {
  return {
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    connectorType: 'drift_native_readonly',
    sleeveApplicability: ['carry'],
    truthMode: 'real',
    readOnlySupport: true,
    executionSupport: false,
    approvedForLiveUse: false,
    onboardingState: 'read_only',
    missingPrerequisites: [],
    authRequirementsSummary: ['DRIFT_RPC_ENDPOINT', 'DRIFT_READONLY_ACCOUNT_ADDRESS'],
    healthy: true,
    healthState: 'healthy',
    degradedReason: null,
    truthProfile: 'derivative_aware',
    latestSnapshotType: 'drift_native_user_account',
    latestSnapshotSummary: 'Drift-native read-only snapshot captured for Apex Carry with 2 positions, 2 open orders, and health score 84.',
    latestErrorMessage: null,
    snapshotFreshness: 'fresh',
    snapshotCompleteness: 'complete',
    lastSnapshotAt: '2026-03-20T12:01:00.000Z',
    lastSuccessfulSnapshotAt: '2026-03-20T12:01:00.000Z',
    truthCoverage: {
      accountState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      balanceState: {
        status: 'unsupported',
        reason: 'Drift-native read-only decode exposes collateral inventory via derivative positions rather than generic wallet balances.',
        limitations: [],
      },
      capacityState: {
        status: 'unsupported',
        reason: 'Read-only Drift connector does not expose treasury-style venue capacity.',
        limitations: [],
      },
      exposureState: {
        status: 'available',
        reason: null,
        limitations: ['Exposure rows are operator-facing derived views over decoded Drift positions.'],
      },
      derivativeAccountState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      derivativePositionState: {
        status: 'available',
        reason: null,
        limitations: ['Inventory is venue-native; valuation fields are Drift SDK calculations over current market and oracle state.'],
      },
      derivativeHealthState: {
        status: 'available',
        reason: null,
        limitations: ['Health and margin metrics are Drift SDK calculations over venue-native state.'],
      },
      orderState: {
        status: 'available',
        reason: null,
        limitations: ['placedAt is intentionally null because the read-only path does not backfill per-order timestamps.'],
      },
      executionReferences: {
        status: 'available',
        reason: null,
        limitations: ['Execution references are recent Solana signatures for the tracked Drift user account.'],
      },
    },
    comparisonCoverage: {
      executionReferences: {
        status: 'available',
        reason: null,
      },
      positionInventory: {
        status: 'unsupported',
        reason: 'Decoded Drift position inventory is visible, but the runtime does not yet persist venue-native Drift position projections for direct comparison.',
      },
      healthState: {
        status: 'unsupported',
        reason: 'Drift health and margin metrics are visible, but the runtime does not yet persist an internal canonical health model for direct comparison.',
      },
      orderInventory: {
        status: 'unsupported',
        reason: 'Decoded Drift open-order inventory is visible, but the runtime does not yet persist a venue-native open-order model for direct comparison.',
      },
      notes: [
        'Decoded Drift account, position, health, and order sections are operator-visible venue truth.',
        'Current reconciliation directly compares internal execution references when they are available.',
      ],
    },
    sourceMetadata: {
      sourceKind: 'adapter',
      sourceName: 'drift_native_readonly',
      connectorDepth: 'drift_native_readonly',
      commitment: 'confirmed',
      observedSlot: '123',
      observedScope: [
        'drift_user_account_lookup',
        'drift_user_account_decode',
        'drift_position_inventory',
        'drift_margin_health',
        'drift_open_orders',
        'recent_signatures',
      ],
      provenanceNotes: [
        'This connector is read-only and never signs or submits transactions.',
        'Derivative health and valuation metrics are Drift SDK calculations over decoded user, market, and oracle state.',
      ],
    },
    executionConfirmationState: createConnectorPostTradeConfirmationEvidence(),
    metadata: {
      endpointConfigured: true,
      accountAddressConfigured: true,
      executionPosture: 'read_only',
    },
    promotion: createConnectorPromotionSummary(),
    ...overrides,
  };
}

export function createVenueInventorySummary(
  overrides: Partial<VenueInventorySummaryView> = {},
): VenueInventorySummaryView {
  return {
    totalVenues: 3,
    simulatedOnly: 2,
    realReadOnly: 1,
    realExecutionCapable: 0,
    derivativeAware: 1,
    genericWallet: 0,
    capacityOnly: 0,
    approvedForLiveUse: 0,
    degraded: 0,
    unavailable: 0,
    stale: 0,
    missingPrerequisites: 0,
    ...overrides,
  };
}

export function createVenueTruthSummary(
  overrides: Partial<VenueTruthSummaryView> = {},
): VenueTruthSummaryView {
  return {
    totalVenues: 3,
    derivativeAwareVenues: 1,
    genericWalletVenues: 0,
    capacityOnlyVenues: 0,
    connectorDepth: {
      simulation: 2,
      generic_rpc_readonly: 0,
      drift_native_readonly: 1,
      execution_capable: 0,
    },
    completeSnapshots: 1,
    partialSnapshots: 0,
    minimalSnapshots: 2,
    decodedDerivativeAccountVenues: 1,
    decodedDerivativePositionVenues: 1,
    healthMetricVenues: 1,
    venueOpenOrderInventoryVenues: 1,
    accountState: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    balanceState: {
      available: 0,
      partial: 0,
      unsupported: 3,
    },
    capacityState: {
      available: 0,
      partial: 0,
      unsupported: 3,
    },
    exposureState: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    derivativeAccountState: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    derivativePositionState: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    derivativeHealthState: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    orderState: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    executionReferences: {
      available: 1,
      partial: 0,
      unsupported: 2,
    },
    ...overrides,
  };
}

export function createConnectorPromotionSummary(
  overrides: Partial<ConnectorPromotionSummaryView> = {},
): ConnectorPromotionSummaryView {
  return {
    promotionId: 'promotion-1',
    requestedTargetPosture: 'approved_for_live',
    capabilityClass: 'real_readonly',
    promotionStatus: 'rejected',
    effectivePosture: 'rejected',
    approvedForLiveUse: false,
    sensitiveExecutionEligible: false,
    requestedBy: 'ops-user',
    requestedAt: '2026-03-20T11:50:00.000Z',
    reviewedBy: 'admin-user',
    reviewedAt: '2026-03-20T12:10:00.000Z',
    approvedBy: null,
    approvedAt: null,
    rejectedBy: 'admin-user',
    rejectedAt: '2026-03-20T12:10:00.000Z',
    suspendedBy: null,
    suspendedAt: null,
    latestNote: 'Execution connector support is not available yet.',
    blockers: [
      'Connector remains read-only and does not provide execution capability.',
      'Read-only validation is complete.',
    ],
    ...overrides,
  };
}

export function createConnectorReadinessEvidence(
  overrides: Partial<ConnectorReadinessEvidenceView> = {},
): ConnectorReadinessEvidenceView {
  return {
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    connectorType: 'drift_native_readonly',
    sleeveApplicability: ['carry'],
    truthMode: 'real',
    capabilityClass: 'real_readonly',
    executionSupport: false,
    readOnlySupport: true,
    snapshotFreshness: 'fresh',
    snapshotCompleteness: 'complete',
    healthy: true,
    healthState: 'healthy',
    degradedReason: null,
    lastSnapshotAt: '2026-03-20T12:01:00.000Z',
    lastSuccessfulSnapshotAt: '2026-03-20T12:01:00.000Z',
    truthCoverageAvailableCount: 5,
    truthCoveragePartialCount: 0,
    truthCoverageUnsupportedCount: 4,
    readOnlyValidationState: 'complete',
    configReadiness: [
      {
        key: 'endpointConfigured',
        ready: true,
        summary: 'endpoint configured marker',
      },
      {
        key: 'accountAddressConfigured',
        ready: true,
        summary: 'account address configured marker',
      },
    ],
    missingPrerequisites: [],
    blockingReasons: [
      'Connector remains read-only and does not provide execution capability.',
    ],
    eligibleForPromotion: false,
    postTradeConfirmation: createConnectorPostTradeConfirmationEvidence(),
    ...overrides,
  };
}

export function createConnectorPostTradeConfirmationEvidence(
  overrides: Partial<ConnectorReadinessEvidenceView['postTradeConfirmation']> = {},
): ConnectorReadinessEvidenceView['postTradeConfirmation'] {
  return {
    status: 'not_required',
    summary: 'No recent real execution references currently require post-trade confirmation.',
    evaluatedAt: '2026-03-20T12:01:00.000Z',
    recentExecutionCount: 0,
    confirmedFullCount: 0,
    confirmedPartialCount: 0,
    confirmedPartialEventOnlyCount: 0,
    confirmedPartialPositionOnlyCount: 0,
    pendingCount: 0,
    pendingEventCount: 0,
    pendingPositionDeltaCount: 0,
    conflictingEventCount: 0,
    conflictingEventVsPositionCount: 0,
    missingReferenceCount: 0,
    invalidCount: 0,
    insufficientContextCount: 0,
    latestConfirmedAt: null,
    blockingReasons: [],
    entries: [],
    ...overrides,
  };
}

export function createConnectorPromotionEvent(
  overrides: Partial<ConnectorPromotionEventView> = {},
): ConnectorPromotionEventView {
  return {
    id: 'promotion-event-1',
    promotionId: 'promotion-1',
    venueId: 'drift-solana-readonly',
    eventType: 'rejected',
    fromStatus: 'pending_review',
    toStatus: 'rejected',
    effectivePosture: 'rejected',
    requestedTargetPosture: 'approved_for_live',
    actorId: 'admin-user',
    note: 'Execution connector support is not available yet.',
    evidence: createConnectorReadinessEvidence(),
    occurredAt: '2026-03-20T12:10:00.000Z',
    metadata: {},
    ...overrides,
  };
}

export function createConnectorPromotionDetail(
  overrides: Partial<ConnectorPromotionDetailView> = {},
): ConnectorPromotionDetailView {
  return {
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    connectorType: 'drift_native_readonly',
    sleeveApplicability: ['carry'],
    current: createConnectorPromotionSummary(),
    evidence: createConnectorReadinessEvidence(),
    history: [
      createConnectorPromotionEvent({
        id: 'promotion-event-0',
        eventType: 'requested',
        fromStatus: null,
        toStatus: 'pending_review',
        effectivePosture: 'promotion_pending',
        actorId: 'ops-user',
        note: 'Requesting live-readiness review.',
        occurredAt: '2026-03-20T11:50:00.000Z',
      }),
      createConnectorPromotionEvent(),
    ],
    ...overrides,
  };
}

export function createVenueDetail(
  overrides: Partial<VenueDetailView> = {},
): VenueDetailView {
  const snapshot = createVenueSnapshotFixture();

  return {
    venue: createVenueInventoryItem(),
    snapshots: [snapshot],
    internalState: createInternalDerivativeSnapshot(),
    comparisonSummary: createVenueComparisonSummary(),
    comparisonDetail: createVenueComparisonDetail({
      externalSnapshot: snapshot,
    }),
    promotion: createConnectorPromotionDetail(),
    ...overrides,
  };
}
