// =============================================================================
// Sentinel Apex — Audit Event Writer
// =============================================================================

/**
 * Strongly-typed audit event. Every action with regulatory or operational
 * significance should produce one of these.
 */
export interface AuditEvent {
  /** Unique identifier for this audit record (UUID). */
  eventId: string;
  /** Human-readable categorisation of the action, e.g. "order.submitted". */
  eventType: string;
  /** ISO 8601 timestamp of when the event occurred. */
  occurredAt: string;
  /** Whether the event was triggered by the system or a human operator. */
  actorType: 'system' | 'operator';
  /** Identifier of the actor (e.g. service name or operator user ID). */
  actorId: string;
  /** The sleeve in whose context the event occurred, if applicable. */
  sleeveId?: string;
  /** Event-specific payload. The real DB writer will validate/serialize this. */
  data: unknown;
  /** Correlation ID linking this event to a broader request chain. */
  correlationId?: string;
}

/**
 * Abstraction over audit persistence. The in-process implementation writes to
 * stdout; production code will inject a database-backed implementation.
 */
export interface AuditWriter {
  write(event: AuditEvent): Promise<void>;
}

/**
 * Development / test audit writer that serialises each event as a single JSON
 * line to stdout. Suitable for local runs and unit tests.
 */
export class ConsoleAuditWriter implements AuditWriter {
  write(event: AuditEvent): Promise<void> {
    process.stdout.write(`${JSON.stringify(event)}\n`);
    return Promise.resolve();
  }
}
