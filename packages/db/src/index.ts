// =============================================================================
// @sentinel-apex/db — public API
// =============================================================================

// Schema tables — re-exported so consumers don't need to drill into sub-paths
export {
  auditEvents,
  orders,
  fills,
  positions,
  portfolioCurrent,
  portfolioSnapshots,
  riskBreaches,
  executionEvents,
  runtimeCommands,
  runtimeMismatches,
  runtimeRecoveryEvents,
  riskCurrent,
  riskSnapshots,
  runtimeState,
  runtimeWorkerState,
  strategyIntents,
  strategyOpportunities,
  strategyRuns,
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
