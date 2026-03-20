import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const strategyRuns = pgTable(
  'strategy_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: text('run_id').notNull().unique(),
    sleeveId: text('sleeve_id').notNull(),
    executionMode: text('execution_mode').notNull(),
    triggerSource: text('trigger_source').notNull(),
    status: text('status').notNull(),
    opportunitiesDetected: integer('opportunities_detected').notNull().default(0),
    opportunitiesApproved: integer('opportunities_approved').notNull().default(0),
    intentsGenerated: integer('intents_generated').notNull().default(0),
    intentsApproved: integer('intents_approved').notNull().default(0),
    intentsRejected: integer('intents_rejected').notNull().default(0),
    intentsExecuted: integer('intents_executed').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdIdx: index('strategy_runs_run_id_idx').on(t.runId),
    sleeveIdIdx: index('strategy_runs_sleeve_id_idx').on(t.sleeveId),
    statusIdx: index('strategy_runs_status_idx').on(t.status),
    startedAtIdx: index('strategy_runs_started_at_idx').on(t.startedAt),
  }),
);

export const strategyOpportunities = pgTable(
  'strategy_opportunities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    opportunityId: text('opportunity_id').notNull().unique(),
    runId: text('run_id')
      .notNull()
      .references(() => strategyRuns.runId),
    sleeveId: text('sleeve_id').notNull(),
    asset: text('asset').notNull(),
    opportunityType: text('opportunity_type').notNull(),
    expectedAnnualYieldPct: text('expected_annual_yield_pct').notNull(),
    netYieldPct: text('net_yield_pct').notNull(),
    confidenceScore: text('confidence_score').notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    approved: boolean('approved').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdIdx: index('strategy_opportunities_run_id_idx').on(t.runId),
    sleeveIdIdx: index('strategy_opportunities_sleeve_id_idx').on(t.sleeveId),
    detectedAtIdx: index('strategy_opportunities_detected_at_idx').on(t.detectedAt),
  }),
);

export const strategyIntents = pgTable(
  'strategy_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    intentId: text('intent_id').notNull().unique(),
    runId: text('run_id')
      .notNull()
      .references(() => strategyRuns.runId),
    opportunityId: text('opportunity_id')
      .notNull()
      .references(() => strategyOpportunities.opportunityId),
    sleeveId: text('sleeve_id').notNull(),
    venueId: text('venue_id').notNull(),
    asset: text('asset').notNull(),
    side: text('side').notNull(),
    orderType: text('order_type').notNull(),
    requestedSize: text('requested_size').notNull(),
    requestedPrice: text('requested_price'),
    reduceOnly: boolean('reduce_only').notNull().default(false),
    positionSizeUsd: text('position_size_usd'),
    riskStatus: text('risk_status').notNull(),
    approved: boolean('approved').notNull(),
    executionDisposition: text('execution_disposition').notNull(),
    riskAssessment: jsonb('risk_assessment').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    runIdIdx: index('strategy_intents_run_id_idx').on(t.runId),
    opportunityIdIdx: index('strategy_intents_opportunity_id_idx').on(t.opportunityId),
    approvedIdx: index('strategy_intents_approved_idx').on(t.approved),
    createdAtIdx: index('strategy_intents_created_at_idx').on(t.createdAt),
  }),
);

export const executionEvents = pgTable(
  'execution_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id').notNull().unique(),
    runId: text('run_id')
      .notNull()
      .references(() => strategyRuns.runId),
    intentId: text('intent_id')
      .notNull()
      .references(() => strategyIntents.intentId),
    clientOrderId: text('client_order_id'),
    venueOrderId: text('venue_order_id'),
    eventType: text('event_type').notNull(),
    status: text('status').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdIdx: index('execution_events_run_id_idx').on(t.runId),
    intentIdIdx: index('execution_events_intent_id_idx').on(t.intentId),
    occurredAtIdx: index('execution_events_occurred_at_idx').on(t.occurredAt),
  }),
);

export const riskSnapshots = pgTable(
  'risk_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: text('run_id')
      .notNull()
      .references(() => strategyRuns.runId),
    sleeveId: text('sleeve_id').notNull(),
    summary: jsonb('summary').notNull(),
    approvedIntentCount: integer('approved_intent_count').notNull().default(0),
    rejectedIntentCount: integer('rejected_intent_count').notNull().default(0),
    openCircuitBreakers: jsonb('open_circuit_breakers').notNull().default([]),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdIdx: index('risk_snapshots_run_id_idx').on(t.runId),
    sleeveIdIdx: index('risk_snapshots_sleeve_id_idx').on(t.sleeveId),
    capturedAtIdx: index('risk_snapshots_captured_at_idx').on(t.capturedAt),
  }),
);

export const riskCurrent = pgTable('risk_current', {
  id: text('id').primaryKey(),
  sourceRunId: text('source_run_id')
    .notNull()
    .references(() => strategyRuns.runId),
  sleeveId: text('sleeve_id').notNull(),
  summary: jsonb('summary').notNull(),
  approvedIntentCount: integer('approved_intent_count').notNull().default(0),
  rejectedIntentCount: integer('rejected_intent_count').notNull().default(0),
  openCircuitBreakers: jsonb('open_circuit_breakers').notNull().default([]),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const runtimeState = pgTable('runtime_state', {
  id: text('id').primaryKey(),
  executionMode: text('execution_mode').notNull(),
  liveExecutionEnabled: boolean('live_execution_enabled').notNull().default(false),
  riskLimits: jsonb('risk_limits').notNull().default({}),
  halted: boolean('halted').notNull().default(false),
  lifecycleState: text('lifecycle_state').notNull().default('starting'),
  projectionStatus: text('projection_status').notNull().default('stale'),
  lastRunId: text('last_run_id'),
  lastRunStatus: text('last_run_status'),
  lastSuccessfulRunId: text('last_successful_run_id'),
  lastCycleStartedAt: timestamp('last_cycle_started_at', { withTimezone: true }),
  lastCycleCompletedAt: timestamp('last_cycle_completed_at', { withTimezone: true }),
  lastProjectionRebuildAt: timestamp('last_projection_rebuild_at', { withTimezone: true }),
  lastProjectionSourceRunId: text('last_projection_source_run_id'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  stoppedAt: timestamp('stopped_at', { withTimezone: true }),
  lastError: text('last_error'),
  lastUpdatedBy: text('last_updated_by').notNull(),
  reason: text('reason'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const runtimeWorkerState = pgTable('runtime_worker_state', {
  id: text('id').primaryKey(),
  workerId: text('worker_id').notNull(),
  lifecycleState: text('lifecycle_state').notNull().default('stopped'),
  schedulerState: text('scheduler_state').notNull().default('idle'),
  currentOperation: text('current_operation'),
  currentCommandId: text('current_command_id'),
  currentRunId: text('current_run_id'),
  cycleIntervalMs: integer('cycle_interval_ms').notNull().default(60000),
  processId: integer('process_id'),
  hostname: text('hostname'),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
  lastStoppedAt: timestamp('last_stopped_at', { withTimezone: true }),
  lastRunStartedAt: timestamp('last_run_started_at', { withTimezone: true }),
  lastRunCompletedAt: timestamp('last_run_completed_at', { withTimezone: true }),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  lastFailureReason: text('last_failure_reason'),
  nextScheduledRunAt: timestamp('next_scheduled_run_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const runtimeCommands = pgTable(
  'runtime_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commandId: text('command_id').notNull().unique(),
    commandType: text('command_type').notNull(),
    status: text('status').notNull(),
    requestedBy: text('requested_by').notNull(),
    claimedBy: text('claimed_by'),
    payload: jsonb('payload').notNull().default({}),
    result: jsonb('result').notNull().default({}),
    errorMessage: text('error_message'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    commandIdIdx: index('runtime_commands_command_id_idx').on(t.commandId),
    statusIdx: index('runtime_commands_status_idx').on(t.status),
    requestedAtIdx: index('runtime_commands_requested_at_idx').on(t.requestedAt),
  }),
);

export const runtimeMismatches = pgTable(
  'runtime_mismatches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dedupeKey: text('dedupe_key').notNull().unique(),
    category: text('category').notNull(),
    severity: text('severity').notNull(),
    sourceKind: text('source_kind').notNull().default('workflow'),
    sourceComponent: text('source_component').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    summary: text('summary').notNull(),
    details: jsonb('details').notNull().default({}),
    status: text('status').notNull().default('open'),
    firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).notNull(),
    lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }).notNull(),
    occurrenceCount: integer('occurrence_count').notNull().default(1),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),
    recoveryStartedAt: timestamp('recovery_started_at', { withTimezone: true }),
    recoveryStartedBy: text('recovery_started_by'),
    recoverySummary: text('recovery_summary'),
    linkedCommandId: text('linked_command_id'),
    linkedRecoveryEventId: text('linked_recovery_event_id'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    resolutionSummary: text('resolution_summary'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: text('verified_by'),
    verificationSummary: text('verification_summary'),
    verificationOutcome: text('verification_outcome'),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    reopenedBy: text('reopened_by'),
    reopenSummary: text('reopen_summary'),
    lastStatusChangeAt: timestamp('last_status_change_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    dedupeKeyIdx: index('runtime_mismatches_dedupe_key_idx').on(t.dedupeKey),
    statusIdx: index('runtime_mismatches_status_idx').on(t.status),
    categoryIdx: index('runtime_mismatches_category_idx').on(t.category),
    lastDetectedAtIdx: index('runtime_mismatches_last_detected_at_idx').on(t.lastDetectedAt),
  }),
);

export const runtimeReconciliationRuns = pgTable(
  'runtime_reconciliation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runType: text('run_type').notNull(),
    trigger: text('trigger').notNull(),
    triggerReference: text('trigger_reference'),
    sourceComponent: text('source_component').notNull(),
    triggeredBy: text('triggered_by'),
    status: text('status').notNull(),
    findingCount: integer('finding_count').notNull().default(0),
    linkedMismatchCount: integer('linked_mismatch_count').notNull().default(0),
    summary: jsonb('summary').notNull().default({}),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runTypeIdx: index('runtime_reconciliation_runs_run_type_idx').on(t.runType),
    triggerIdx: index('runtime_reconciliation_runs_trigger_idx').on(t.trigger),
    statusIdx: index('runtime_reconciliation_runs_status_idx').on(t.status),
    startedAtIdx: index('runtime_reconciliation_runs_started_at_idx').on(t.startedAt),
  }),
);

export const runtimeReconciliationFindings = pgTable(
  'runtime_reconciliation_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reconciliationRunId: uuid('reconciliation_run_id')
      .notNull()
      .references(() => runtimeReconciliationRuns.id),
    dedupeKey: text('dedupe_key').notNull(),
    findingType: text('finding_type').notNull(),
    severity: text('severity').notNull(),
    status: text('status').notNull(),
    sourceComponent: text('source_component').notNull(),
    subsystem: text('subsystem').notNull(),
    venueId: text('venue_id'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    mismatchId: uuid('mismatch_id').references(() => runtimeMismatches.id),
    summary: text('summary').notNull(),
    expectedState: jsonb('expected_state').notNull().default({}),
    actualState: jsonb('actual_state').notNull().default({}),
    delta: jsonb('delta').notNull().default({}),
    details: jsonb('details').notNull().default({}),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    reconciliationRunIdIdx: index('runtime_reconciliation_findings_run_id_idx').on(t.reconciliationRunId),
    dedupeKeyIdx: index('runtime_reconciliation_findings_dedupe_key_idx').on(t.dedupeKey),
    findingTypeIdx: index('runtime_reconciliation_findings_finding_type_idx').on(t.findingType),
    severityIdx: index('runtime_reconciliation_findings_severity_idx').on(t.severity),
    statusIdx: index('runtime_reconciliation_findings_status_idx').on(t.status),
    mismatchIdIdx: index('runtime_reconciliation_findings_mismatch_id_idx').on(t.mismatchId),
    detectedAtIdx: index('runtime_reconciliation_findings_detected_at_idx').on(t.detectedAt),
  }),
);

export const runtimeMismatchRemediations = pgTable(
  'runtime_mismatch_remediations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mismatchId: uuid('mismatch_id')
      .notNull()
      .references(() => runtimeMismatches.id),
    attemptSequence: integer('attempt_sequence').notNull(),
    remediationType: text('remediation_type').notNull(),
    commandId: text('command_id')
      .notNull()
      .references(() => runtimeCommands.commandId),
    status: text('status').notNull(),
    requestedBy: text('requested_by').notNull(),
    requestedSummary: text('requested_summary'),
    outcomeSummary: text('outcome_summary'),
    latestRecoveryEventId: uuid('latest_recovery_event_id'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    mismatchIdIdx: index('runtime_mismatch_remediations_mismatch_id_idx').on(t.mismatchId),
    commandIdIdx: index('runtime_mismatch_remediations_command_id_idx').on(t.commandId),
    statusIdx: index('runtime_mismatch_remediations_status_idx').on(t.status),
    requestedAtIdx: index('runtime_mismatch_remediations_requested_at_idx').on(t.requestedAt),
  }),
);

export const runtimeRecoveryEvents = pgTable(
  'runtime_recovery_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mismatchId: uuid('mismatch_id').references(() => runtimeMismatches.id),
    commandId: text('command_id'),
    runId: text('run_id').references(() => strategyRuns.runId),
    eventType: text('event_type').notNull(),
    status: text('status').notNull(),
    sourceComponent: text('source_component').notNull(),
    actorId: text('actor_id'),
    message: text('message').notNull(),
    details: jsonb('details').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    mismatchIdIdx: index('runtime_recovery_events_mismatch_id_idx').on(t.mismatchId),
    commandIdIdx: index('runtime_recovery_events_command_id_idx').on(t.commandId),
    occurredAtIdx: index('runtime_recovery_events_occurred_at_idx').on(t.occurredAt),
  }),
);
