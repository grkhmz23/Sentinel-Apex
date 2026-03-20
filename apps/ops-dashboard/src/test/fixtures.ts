import type {
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRecoveryEventView,
} from '@sentinel-apex/runtime';

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
