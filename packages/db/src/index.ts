// =============================================================================
// @sentinel-apex/db — public API
// =============================================================================

// Schema tables — re-exported so consumers don't need to drill into sub-paths
export {
  carryActionExecutions,
  carryActionOrderIntents,
  carryExecutionSteps,
  carryActions,
  carryVenueSnapshots,
  allocatorCurrent,
  allocatorRebalanceBundleEscalationEvents,
  allocatorRebalanceBundleEscalations,
  allocatorRebalanceBundleRecoveryActions,
  allocatorRebalanceBundleResolutionActions,
  allocatorRebalanceBundles,
  allocatorRebalanceCurrent,
  allocatorRebalanceExecutions,
  allocatorRebalanceProposalIntents,
  allocatorRebalanceProposals,
  allocatorRecommendations,
  allocatorRuns,
  allocatorSleeveTargets,
  opsOperators,
  opsOperatorSessions,
  auditEvents,
  orders,
  fills,
  positions,
  portfolioCurrent,
  portfolioSnapshots,
  riskBreaches,
  executionEvents,
  internalDerivativeCurrent,
  internalDerivativeSnapshots,
  runtimeCommands,
  runtimeMismatchRemediations,
  runtimeMismatches,
  runtimeReconciliationFindings,
  runtimeReconciliationRuns,
  runtimeRecoveryEvents,
  venueConnectorPromotionEvents,
  venueConnectorPromotions,
  venueConnectorSnapshots,
  riskCurrent,
  riskSnapshots,
  runtimeState,
  runtimeWorkerState,
  strategyIntents,
  strategyOpportunities,
  strategyRuns,
  treasuryActionExecutions,
  treasuryActions,
  treasuryCurrent,
  treasuryRuns,
  treasuryVenueSnapshots,
} from './schema/index.js';

// Database client factory + type
export {
  closeAllDatabases,
  createDatabaseConnection,
  getDb,
  resetDatabaseConnectionCache,
} from './client.js';
export type { Database, DatabaseConnection } from './client.js';

export { applyMigrations } from './migrations.js';
