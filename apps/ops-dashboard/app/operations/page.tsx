import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { JsonBlock } from '../../src/components/json-block';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { formatDateTime } from '../../src/lib/format';
import { loadOperationsPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function OperationsPage(): Promise<JSX.Element> {
  const state = await loadOperationsPageData();

  if (state.error !== null || state.data === null) {
    return <ErrorState message={state.error ?? 'Failed to load operations data.'} title="Operations unavailable" />;
  }

  const { commands, recoveryEvents, recoveryOutcomes } = state.data;

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Commands and Recovery Activity</h1>
        </div>
      </header>

      <div className="grid grid--two-column">
        <Panel subtitle="Recent runtime commands and result state" title="Commands">
          {commands.length === 0 ? (
            <EmptyState message="No commands are available." title="No commands" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {commands.map((command) => (
                  <tr key={command.commandId}>
                    <td>{command.commandType}</td>
                    <td><StatusBadge label={command.status} tone={command.status === 'completed' ? 'good' : command.status === 'failed' ? 'bad' : 'accent'} /></td>
                    <td>{formatDateTime(command.requestedAt)}</td>
                    <td>
                      <details>
                        <summary>Inspect result</summary>
                        <JsonBlock value={command.result} />
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel subtitle="Latest recovery workflow events" title="Recovery Events">
          {recoveryEvents.length === 0 ? (
            <EmptyState message="No recovery events are available." title="No recovery events" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Actor</th>
                  <th>Occurred</th>
                </tr>
              </thead>
              <tbody>
                {recoveryEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{event.eventType}</td>
                    <td>{event.status}</td>
                    <td>{event.actorId ?? 'system'}</td>
                    <td>{formatDateTime(event.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel subtitle="Most recent durable recovery outcomes" title="Recovery Outcomes">
        {recoveryOutcomes.length === 0 ? (
          <EmptyState message="No recovery outcomes are available." title="No recovery outcomes" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Source</th>
                <th>Occurred</th>
              </tr>
            </thead>
            <tbody>
              {recoveryOutcomes.map((event) => (
                <tr key={event.id}>
                  <td>{event.message}</td>
                  <td><StatusBadge label={event.status} tone={event.status === 'failed' ? 'bad' : 'neutral'} /></td>
                  <td>{event.sourceComponent}</td>
                  <td>{formatDateTime(event.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
