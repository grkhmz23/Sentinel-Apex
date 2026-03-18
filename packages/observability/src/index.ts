// =============================================================================
// Sentinel Apex — Observability Package Public API
// =============================================================================

export type { LogContext, Logger } from './logger.js';
export { createLogger } from './logger.js';

export type { MetricType, Counter, Gauge, Histogram, MetricsSnapshot, MetricsRegistry } from './metrics.js';
export {
  registry,
  ordersTotal,
  positionSizeUsd,
  portfolioNavUsd,
  riskChecksTotal,
  opportunityDetectedTotal,
  executionLatencyMs,
} from './metrics.js';

export {
  generateCorrelationId,
  withCorrelationId,
  getCurrentCorrelationId,
} from './tracing.js';

export type { AuditEvent, AuditWriter } from './audit.js';
export { ConsoleAuditWriter } from './audit.js';
