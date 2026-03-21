import type {
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
