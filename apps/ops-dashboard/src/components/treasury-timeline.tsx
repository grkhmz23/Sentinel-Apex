import Link from 'next/link';

import type { TreasuryActionTimelineEntry } from '@sentinel-apex/runtime';

import { StatusBadge } from './status-badge';
import { formatDateTime } from '../lib/format';
import { treasuryStatusTone } from '../lib/treasury-display';

export function TreasuryTimeline(
  { entries }: { entries: TreasuryActionTimelineEntry[] },
): JSX.Element {
  if (entries.length === 0) {
    return <p className="panel__hint">No treasury timeline events are persisted yet.</p>;
  }

  return (
    <div className="timeline">
      {entries.map((entry) => (
        <article className="timeline__item" key={entry.id}>
          <div className="timeline__row">
            <div>
              <p className="reason-card__eyebrow">{entry.eventType.replace('_', ' ')}</p>
              <h3>{entry.summary}</h3>
            </div>
            {entry.status !== null ? (
              <StatusBadge label={entry.status} tone={treasuryStatusTone(entry.status)} />
            ) : null}
          </div>
          <p className="panel__hint">
            {formatDateTime(entry.at)}
            {entry.actorId !== null ? ` · ${entry.actorId}` : ''}
          </p>
          <div className="inline-links">
            {entry.linkedCommandId !== null ? (
              <Link href="/operations">Command: {entry.linkedCommandId}</Link>
            ) : null}
            {entry.linkedExecutionId !== null ? (
              <Link href={`/treasury/executions/${entry.linkedExecutionId}`}>Execution detail</Link>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
