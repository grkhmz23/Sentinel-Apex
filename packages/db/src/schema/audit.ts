import { pgTable, text, timestamp, jsonb, uuid, index } from 'drizzle-orm/pg-core';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id').notNull().unique(),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    actorType: text('actor_type').notNull(), // 'system' | 'operator'
    actorId: text('actor_id').notNull(),
    sleeveId: text('sleeve_id'),
    correlationId: text('correlation_id'),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventTypeIdx: index('audit_events_event_type_idx').on(t.eventType),
    eventIdIdx: index('audit_events_event_id_idx').on(t.eventId),
    occurredAtIdx: index('audit_events_occurred_at_idx').on(t.occurredAt),
    sleeveIdIdx: index('audit_events_sleeve_id_idx').on(t.sleeveId),
    correlationIdIdx: index('audit_events_correlation_id_idx').on(t.correlationId),
  }),
);
