import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { strategyRuns } from './runtime.js';

export const allocatorRuns = pgTable(
  'allocator_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    allocatorRunId: text('allocator_run_id').notNull().unique(),
    sourceRunId: text('source_run_id').references(() => strategyRuns.runId),
    trigger: text('trigger').notNull(),
    triggeredBy: text('triggered_by'),
    regimeState: text('regime_state').notNull(),
    pressureLevel: text('pressure_level').notNull(),
    totalCapitalUsd: text('total_capital_usd').notNull(),
    reserveConstrainedCapitalUsd: text('reserve_constrained_capital_usd').notNull(),
    allocatableCapitalUsd: text('allocatable_capital_usd').notNull(),
    inputSnapshot: jsonb('input_snapshot').notNull().default({}),
    policySnapshot: jsonb('policy_snapshot').notNull().default({}),
    rationale: jsonb('rationale').notNull().default([]),
    constraints: jsonb('constraints').notNull().default([]),
    summary: jsonb('summary').notNull().default({}),
    recommendationCount: integer('recommendation_count').notNull().default(0),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    allocatorRunIdIdx: index('allocator_runs_allocator_run_id_idx').on(t.allocatorRunId),
    sourceRunIdIdx: index('allocator_runs_source_run_id_idx').on(t.sourceRunId),
    triggerIdx: index('allocator_runs_trigger_idx').on(t.trigger),
    evaluatedAtIdx: index('allocator_runs_evaluated_at_idx').on(t.evaluatedAt),
  }),
);

export const allocatorSleeveTargets = pgTable(
  'allocator_sleeve_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    allocatorRunId: text('allocator_run_id')
      .notNull()
      .references(() => allocatorRuns.allocatorRunId),
    sleeveId: text('sleeve_id').notNull(),
    sleeveKind: text('sleeve_kind').notNull(),
    sleeveName: text('sleeve_name').notNull(),
    status: text('status').notNull(),
    throttleState: text('throttle_state').notNull(),
    currentAllocationUsd: text('current_allocation_usd').notNull(),
    currentAllocationPct: text('current_allocation_pct').notNull(),
    targetAllocationUsd: text('target_allocation_usd').notNull(),
    targetAllocationPct: text('target_allocation_pct').notNull(),
    minAllocationPct: text('min_allocation_pct').notNull(),
    maxAllocationPct: text('max_allocation_pct').notNull(),
    deltaUsd: text('delta_usd').notNull(),
    opportunityScore: text('opportunity_score'),
    capacityUsd: text('capacity_usd'),
    rationale: jsonb('rationale').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    allocatorRunIdIdx: index('allocator_sleeve_targets_allocator_run_id_idx').on(t.allocatorRunId),
    sleeveIdIdx: index('allocator_sleeve_targets_sleeve_id_idx').on(t.sleeveId),
  }),
);

export const allocatorRecommendations = pgTable(
  'allocator_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    allocatorRunId: text('allocator_run_id')
      .notNull()
      .references(() => allocatorRuns.allocatorRunId),
    sleeveId: text('sleeve_id').notNull(),
    recommendationType: text('recommendation_type').notNull(),
    priority: text('priority').notNull(),
    summary: text('summary').notNull(),
    details: jsonb('details').notNull().default({}),
    rationale: jsonb('rationale').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    allocatorRunIdIdx: index('allocator_recommendations_allocator_run_id_idx').on(t.allocatorRunId),
    sleeveIdIdx: index('allocator_recommendations_sleeve_id_idx').on(t.sleeveId),
    priorityIdx: index('allocator_recommendations_priority_idx').on(t.priority),
  }),
);

export const allocatorCurrent = pgTable('allocator_current', {
  id: text('id').primaryKey(),
  latestAllocatorRunId: text('latest_allocator_run_id')
    .notNull()
    .references(() => allocatorRuns.allocatorRunId),
  summary: jsonb('summary').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const allocatorRebalanceProposals = pgTable(
  'allocator_rebalance_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    allocatorRunId: text('allocator_run_id')
      .notNull()
      .references(() => allocatorRuns.allocatorRunId),
    actionType: text('action_type').notNull(),
    status: text('status').notNull().default('proposed'),
    summary: text('summary').notNull(),
    executionMode: text('execution_mode').notNull().default('dry-run'),
    simulated: boolean('simulated').notNull().default(true),
    executable: boolean('executable').notNull().default(false),
    approvalRequirement: text('approval_requirement').notNull().default('operator'),
    rationale: jsonb('rationale').notNull().default([]),
    blockedReasons: jsonb('blocked_reasons').notNull().default([]),
    details: jsonb('details').notNull().default({}),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    linkedCommandId: text('linked_command_id'),
    latestExecutionId: uuid('latest_execution_id'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    allocatorRunIdIdx: index('allocator_rebalance_proposals_allocator_run_id_idx').on(t.allocatorRunId),
    statusIdx: index('allocator_rebalance_proposals_status_idx').on(t.status),
    createdAtIdx: index('allocator_rebalance_proposals_created_at_idx').on(t.createdAt),
  }),
);

export const allocatorRebalanceProposalIntents = pgTable(
  'allocator_rebalance_proposal_intents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => allocatorRebalanceProposals.id),
    sleeveId: text('sleeve_id').notNull(),
    sourceSleeveId: text('source_sleeve_id'),
    targetSleeveId: text('target_sleeve_id'),
    actionType: text('action_type').notNull(),
    status: text('status').notNull().default('proposed'),
    readiness: text('readiness').notNull().default('blocked'),
    executable: boolean('executable').notNull().default(false),
    currentAllocationUsd: text('current_allocation_usd').notNull(),
    currentAllocationPct: text('current_allocation_pct').notNull(),
    targetAllocationUsd: text('target_allocation_usd').notNull(),
    targetAllocationPct: text('target_allocation_pct').notNull(),
    deltaUsd: text('delta_usd').notNull(),
    rationale: jsonb('rationale').notNull().default([]),
    blockedReasons: jsonb('blocked_reasons').notNull().default([]),
    details: jsonb('details').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    proposalIdIdx: index('allocator_rebalance_proposal_intents_proposal_id_idx').on(t.proposalId),
    sleeveIdIdx: index('allocator_rebalance_proposal_intents_sleeve_id_idx').on(t.sleeveId),
    actionTypeIdx: index('allocator_rebalance_proposal_intents_action_type_idx').on(t.actionType),
  }),
);

export const allocatorRebalanceExecutions = pgTable(
  'allocator_rebalance_executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => allocatorRebalanceProposals.id),
    commandId: text('command_id'),
    status: text('status').notNull(),
    executionMode: text('execution_mode').notNull(),
    simulated: boolean('simulated').notNull().default(true),
    requestedBy: text('requested_by').notNull(),
    startedBy: text('started_by'),
    outcomeSummary: text('outcome_summary'),
    outcome: jsonb('outcome').notNull().default({}),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    proposalIdIdx: index('allocator_rebalance_executions_proposal_id_idx').on(t.proposalId),
    commandIdIdx: index('allocator_rebalance_executions_command_id_idx').on(t.commandId),
    statusIdx: index('allocator_rebalance_executions_status_idx').on(t.status),
  }),
);

export const allocatorRebalanceBundles = pgTable(
  'allocator_rebalance_bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proposalId: uuid('proposal_id')
      .notNull()
      .unique()
      .references(() => allocatorRebalanceProposals.id),
    status: text('status').notNull().default('proposed'),
    completionState: text('completion_state').notNull().default('open'),
    outcomeClassification: text('outcome_classification').notNull().default('pending'),
    interventionRecommendation: text('intervention_recommendation').notNull().default('operator_review_required'),
    totalChildCount: integer('total_child_count').notNull().default(0),
    blockedChildCount: integer('blocked_child_count').notNull().default(0),
    failedChildCount: integer('failed_child_count').notNull().default(0),
    completedChildCount: integer('completed_child_count').notNull().default(0),
    pendingChildCount: integer('pending_child_count').notNull().default(0),
    childRollup: jsonb('child_rollup').notNull().default({}),
    finalizationReason: text('finalization_reason'),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    resolutionState: text('resolution_state').notNull().default('unresolved'),
    latestResolutionActionId: uuid('latest_resolution_action_id'),
    resolutionSummary: text('resolution_summary'),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    latestEscalationId: uuid('latest_escalation_id'),
    escalationStatus: text('escalation_status'),
    escalationOwnerId: text('escalation_owner_id'),
    escalationAssignedAt: timestamp('escalation_assigned_at', { withTimezone: true }),
    escalationDueAt: timestamp('escalation_due_at', { withTimezone: true }),
    escalationSummary: text('escalation_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    proposalIdIdx: index('allocator_rebalance_bundles_proposal_id_idx').on(t.proposalId),
    statusIdx: index('allocator_rebalance_bundles_status_idx').on(t.status),
    resolutionStateIdx: index('allocator_rebalance_bundles_resolution_state_idx').on(t.resolutionState),
    escalationStatusIdx: index('allocator_rebalance_bundles_escalation_status_idx').on(t.escalationStatus),
    createdAtIdx: index('allocator_rebalance_bundles_created_at_idx').on(t.createdAt),
  }),
);

export const allocatorRebalanceBundleRecoveryActions = pgTable(
  'allocator_rebalance_bundle_recovery_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => allocatorRebalanceBundles.id),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => allocatorRebalanceProposals.id),
    recoveryActionType: text('recovery_action_type').notNull(),
    targetChildType: text('target_child_type').notNull(),
    targetChildId: text('target_child_id').notNull(),
    targetChildStatus: text('target_child_status').notNull(),
    targetChildSummary: text('target_child_summary').notNull(),
    eligibilityState: text('eligibility_state').notNull().default('blocked'),
    blockedReasons: jsonb('blocked_reasons').notNull().default([]),
    approvalRequirement: text('approval_requirement').notNull().default('operator'),
    status: text('status').notNull().default('requested'),
    requestedBy: text('requested_by').notNull(),
    note: text('note'),
    linkedCommandId: text('linked_command_id'),
    targetCommandType: text('target_command_type'),
    linkedCarryActionId: uuid('linked_carry_action_id'),
    linkedTreasuryActionId: uuid('linked_treasury_action_id'),
    outcomeSummary: text('outcome_summary'),
    outcome: jsonb('outcome').notNull().default({}),
    lastError: text('last_error'),
    executionMode: text('execution_mode').notNull().default('dry-run'),
    simulated: boolean('simulated').notNull().default(true),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    queuedAt: timestamp('queued_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bundleIdIdx: index('allocator_rebalance_bundle_recovery_actions_bundle_id_idx').on(t.bundleId),
    proposalIdIdx: index('allocator_rebalance_bundle_recovery_actions_proposal_id_idx').on(t.proposalId),
    statusIdx: index('allocator_rebalance_bundle_recovery_actions_status_idx').on(t.status),
    targetChildIdx: index('allocator_rebalance_bundle_recovery_actions_target_child_idx').on(
      t.targetChildType,
      t.targetChildId,
    ),
    requestedAtIdx: index('allocator_rebalance_bundle_recovery_actions_requested_at_idx').on(t.requestedAt),
    linkedCommandIdx: index('allocator_rebalance_bundle_recovery_actions_linked_command_id_idx').on(t.linkedCommandId),
  }),
);

export const allocatorRebalanceBundleResolutionActions = pgTable(
  'allocator_rebalance_bundle_resolution_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => allocatorRebalanceBundles.id),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => allocatorRebalanceProposals.id),
    resolutionActionType: text('resolution_action_type').notNull(),
    status: text('status').notNull().default('completed'),
    resolutionState: text('resolution_state').notNull().default('unresolved'),
    note: text('note').notNull(),
    acknowledgedPartialApplication: boolean('acknowledged_partial_application').notNull().default(false),
    escalated: boolean('escalated').notNull().default(false),
    affectedChildSummary: jsonb('affected_child_summary').notNull().default({}),
    linkedRecoveryActionIds: jsonb('linked_recovery_action_ids').notNull().default([]),
    blockedReasons: jsonb('blocked_reasons').notNull().default([]),
    outcomeSummary: text('outcome_summary'),
    requestedBy: text('requested_by').notNull(),
    completedBy: text('completed_by'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bundleIdIdx: index('allocator_rebalance_bundle_resolution_actions_bundle_id_idx').on(t.bundleId),
    proposalIdIdx: index('allocator_rebalance_bundle_resolution_actions_proposal_id_idx').on(t.proposalId),
    resolutionStateIdx: index('allocator_rebalance_bundle_resolution_actions_resolution_state_idx').on(t.resolutionState),
    statusIdx: index('allocator_rebalance_bundle_resolution_actions_status_idx').on(t.status),
    requestedAtIdx: index('allocator_rebalance_bundle_resolution_actions_requested_at_idx').on(t.requestedAt),
  }),
);

export const allocatorRebalanceBundleEscalations = pgTable(
  'allocator_rebalance_bundle_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => allocatorRebalanceBundles.id),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => allocatorRebalanceProposals.id),
    sourceResolutionActionId: uuid('source_resolution_action_id'),
    status: text('status').notNull().default('open'),
    ownerId: text('owner_id'),
    assignedBy: text('assigned_by'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    handoffNote: text('handoff_note'),
    reviewNote: text('review_note'),
    resolutionNote: text('resolution_note'),
    closedBy: text('closed_by'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    bundleIdIdx: index('allocator_rebalance_bundle_escalations_bundle_id_idx').on(t.bundleId),
    proposalIdIdx: index('allocator_rebalance_bundle_escalations_proposal_id_idx').on(t.proposalId),
    statusIdx: index('allocator_rebalance_bundle_escalations_status_idx').on(t.status),
    createdAtIdx: index('allocator_rebalance_bundle_escalations_created_at_idx').on(t.createdAt),
  }),
);

export const allocatorRebalanceBundleEscalationEvents = pgTable(
  'allocator_rebalance_bundle_escalation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    escalationId: uuid('escalation_id')
      .notNull()
      .references(() => allocatorRebalanceBundleEscalations.id),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => allocatorRebalanceBundles.id),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => allocatorRebalanceProposals.id),
    eventType: text('event_type').notNull(),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    actorId: text('actor_id').notNull(),
    ownerId: text('owner_id'),
    note: text('note'),
    dueAt: timestamp('due_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    escalationIdIdx: index('allocator_rebalance_bundle_escalation_events_escalation_id_idx').on(t.escalationId),
    bundleIdIdx: index('allocator_rebalance_bundle_escalation_events_bundle_id_idx').on(t.bundleId),
    proposalIdIdx: index('allocator_rebalance_bundle_escalation_events_proposal_id_idx').on(t.proposalId),
    createdAtIdx: index('allocator_rebalance_bundle_escalation_events_created_at_idx').on(t.createdAt),
  }),
);

export const allocatorRebalanceCurrent = pgTable('allocator_rebalance_current', {
  id: text('id').primaryKey(),
  latestProposalId: uuid('latest_proposal_id')
    .references(() => allocatorRebalanceProposals.id),
  allocatorRunId: text('allocator_run_id')
    .notNull()
    .references(() => allocatorRuns.allocatorRunId),
  carryTargetAllocationUsd: text('carry_target_allocation_usd').notNull(),
  carryTargetAllocationPct: text('carry_target_allocation_pct').notNull(),
  treasuryTargetAllocationUsd: text('treasury_target_allocation_usd').notNull(),
  treasuryTargetAllocationPct: text('treasury_target_allocation_pct').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
