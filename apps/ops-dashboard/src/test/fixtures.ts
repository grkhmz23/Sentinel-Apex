import type {
  AllocatorDecisionDetailView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  CarryActionDetailView,
  CarryActionView,
  CarryExecutionDetailView,
  CarryExecutionStepView,
  CarryExecutionView,
  CarryVenueView,
  RebalanceBundleDetailView,
  RebalanceBundleView,
  RebalanceExecutionGraphView,
  RebalanceProposalDetailView,
  RebalanceProposalView,
  TreasuryActionDetailView,
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRecoveryEventView,
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryExecutionDetailView,
  TreasuryExecutionView,
  TreasuryPolicyView,
  TreasurySummaryView,
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
    executionMode: 'dry-run',
    simulated: true,
    createdAt: '2026-03-20T12:02:00.000Z',
    updatedAt: '2026-03-20T12:03:02.000Z',
    ...overrides,
  };
}

export function createRebalanceBundleDetail(
  overrides: Partial<RebalanceBundleDetailView> = {},
): RebalanceBundleDetailView {
  return {
    bundle: createRebalanceBundle(),
    graph: createRebalanceExecutionGraph(),
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
    },
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
    lastError: null,
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
