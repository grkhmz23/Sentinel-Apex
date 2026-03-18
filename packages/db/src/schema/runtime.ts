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
