import { DefinitionList } from '../../../src/components/definition-list';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { JsonBlock } from '../../../src/components/json-block';
import { MismatchActionPanel } from '../../../src/components/mismatch-action-panel';
import { Panel } from '../../../src/components/panel';
import { StatusBadge } from '../../../src/components/status-badge';
import { formatDateTime } from '../../../src/lib/format';
import { getMismatchDetail } from '../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function MismatchDetailPage(
  { params }: { params: { mismatchId: string } },
): Promise<JSX.Element> {
  try {
    const detail = await getMismatchDetail(params.mismatchId);

    return (
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Mismatch Detail</p>
            <h1>{detail.mismatch.summary}</h1>
          </div>
          <StatusBadge label={detail.mismatch.status} tone={detail.mismatch.status === 'verified' ? 'good' : 'warn'} />
        </header>

        <div className="grid grid--two-column">
          <Panel subtitle="Current lifecycle and linkage" title="Overview">
            <DefinitionList
              items={[
                { label: 'Category', value: detail.mismatch.category },
                { label: 'Severity', value: detail.mismatch.severity },
                { label: 'Source', value: detail.mismatch.sourceKind },
                { label: 'Entity', value: detail.mismatch.entityId ?? 'Unavailable' },
                { label: 'First detected', value: formatDateTime(detail.mismatch.firstDetectedAt) },
                { label: 'Last detected', value: formatDateTime(detail.mismatch.lastDetectedAt) },
                { label: 'Occurrence count', value: String(detail.mismatch.occurrenceCount) },
                { label: 'Actionable', value: detail.isActionable ? 'Yes' : 'No' },
                { label: 'Remediation in flight', value: detail.remediationInFlight ? 'Yes' : 'No' },
              ]}
            />
          </Panel>

          <Panel subtitle="Safe operator controls" title="Actions">
            <MismatchActionPanel detail={detail} />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Latest reconciliation context" title="Reconciliation Findings">
            {detail.reconciliationFindings.length === 0 ? (
              <EmptyState message="No reconciliation findings are linked to this mismatch." title="No linked findings" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Detected</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.reconciliationFindings.map((finding) => (
                    <tr key={finding.id}>
                      <td>{finding.findingType}</td>
                      <td>{finding.severity}</td>
                      <td><StatusBadge label={finding.status} tone={finding.status === 'resolved' ? 'good' : 'warn'} /></td>
                      <td>{formatDateTime(finding.detectedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {detail.latestReconciliationFinding !== null ? (
              <JsonBlock value={detail.latestReconciliationFinding.delta} />
            ) : null}
          </Panel>

          <Panel subtitle="Suggested remediations and durable attempts" title="Remediation History">
            <p className="panel__hint">Recommended: {detail.recommendedRemediationTypes.join(', ') || 'none'}</p>
            {detail.remediationHistory.length === 0 ? (
              <EmptyState message="No remediations have been requested for this mismatch." title="No remediation history" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Requested At</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.remediationHistory.map((remediation) => (
                    <tr key={remediation.id}>
                      <td>{remediation.remediationType}</td>
                      <td><StatusBadge label={remediation.status} tone={remediation.status === 'completed' ? 'good' : remediation.status === 'failed' ? 'bad' : 'accent'} /></td>
                      <td>{remediation.requestedBy}</td>
                      <td>{formatDateTime(remediation.requestedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Linked command and mismatch details" title="Linked Command">
            {detail.linkedCommand === null ? (
              <EmptyState message="This mismatch does not currently link to a command." title="No linked command" />
            ) : (
              <JsonBlock value={detail.linkedCommand.result} />
            )}
          </Panel>
          <Panel subtitle="Recovery events and operator outcomes" title="Recovery Events">
            {detail.recoveryEvents.length === 0 ? (
              <EmptyState message="No recovery events are linked to this mismatch." title="No recovery events" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Occurred</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recoveryEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{event.eventType}</td>
                      <td>{event.status}</td>
                      <td>{formatDateTime(event.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel subtitle="Raw mismatch details as persisted" title="Details">
          <JsonBlock value={detail.mismatch.details} />
        </Panel>
      </div>
    );
  } catch (error) {
    return <ErrorState message={error instanceof Error ? error.message : 'Failed to load mismatch detail.'} title="Mismatch detail unavailable" />;
  }
}
