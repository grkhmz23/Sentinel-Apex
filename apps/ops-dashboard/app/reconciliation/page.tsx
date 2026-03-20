import type {
  RuntimeReconciliationFindingSeverity,
  RuntimeReconciliationFindingStatus,
  RuntimeReconciliationFindingType,
} from '@sentinel-apex/runtime';

import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { JsonBlock } from '../../src/components/json-block';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { formatDateTime } from '../../src/lib/format';
import { loadReconciliationPageData } from '../../src/lib/runtime-api.server';

import type { ReconciliationFilters } from '../../src/lib/types';

export const dynamic = 'force-dynamic';

function readFilters(
  searchParams: Record<string, string | string[] | undefined>,
): ReconciliationFilters {
  const status = typeof searchParams['status'] === 'string' ? searchParams['status'] : undefined;
  const severity = typeof searchParams['severity'] === 'string' ? searchParams['severity'] : undefined;
  const findingType = typeof searchParams['findingType'] === 'string'
    ? searchParams['findingType']
    : undefined;

  return {
    ...(status !== undefined ? { status: status as RuntimeReconciliationFindingStatus } : {}),
    ...(severity !== undefined ? { severity: severity as RuntimeReconciliationFindingSeverity } : {}),
    ...(findingType !== undefined ? { findingType: findingType as RuntimeReconciliationFindingType } : {}),
  };
}

export default async function ReconciliationPage(
  { searchParams }: { searchParams: Record<string, string | string[] | undefined> },
): Promise<JSX.Element> {
  const state = await loadReconciliationPageData(readFilters(searchParams));

  if (state.error !== null || state.data === null) {
    return <ErrorState message={state.error ?? 'Failed to load reconciliation data.'} title="Reconciliation unavailable" />;
  }

  const { summary, runs, findings } = state.data;

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Reconciliation</p>
          <h1>Runs and Findings</h1>
        </div>
      </header>

      <div className="grid grid--two-column">
        <Panel subtitle="Latest run summary and severity posture" title="Summary">
          {summary === null ? (
            <EmptyState message="No reconciliation summary is available yet." title="No summary" />
          ) : (
            <JsonBlock
              value={{
                latestRunId: summary.latestRun?.id ?? null,
                latestCompletedRunId: summary.latestCompletedRun?.id ?? null,
                latestFindingCount: summary.latestFindingCount,
                latestLinkedMismatchCount: summary.latestLinkedMismatchCount,
                latestSeverityCounts: summary.latestSeverityCounts,
                latestTypeCounts: summary.latestTypeCounts,
              }}
            />
          )}
        </Panel>

        <Panel subtitle="Filter finding views without leaving runtime truth" title="Filters">
          <form className="filters" method="get">
            <select className="select" defaultValue="" name="status">
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="resolved">resolved</option>
            </select>
            <select className="select" defaultValue="" name="severity">
              <option value="">All severities</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <input className="input" name="findingType" placeholder="Finding type" />
            <button className="button" type="submit">Apply</button>
          </form>
        </Panel>
      </div>

      <div className="grid grid--two-column">
        <Panel subtitle="Recent reconciliation runs" title="Runs">
          {runs.length === 0 ? (
            <EmptyState message="No reconciliation runs have been recorded." title="No runs" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Findings</th>
                  <th>Mismatches</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.trigger}</td>
                    <td><StatusBadge label={run.status} tone={run.status === 'completed' ? 'good' : run.status === 'failed' ? 'bad' : 'accent'} /></td>
                    <td>{String(run.findingCount)}</td>
                    <td>{String(run.linkedMismatchCount)}</td>
                    <td>{formatDateTime(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel subtitle="Recent reconciliation findings" title="Findings">
          {findings.length === 0 ? (
            <EmptyState message="No findings matched the current filter." title="No findings" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Mismatch</th>
                  <th>Detected</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.id}>
                    <td>{finding.findingType}</td>
                    <td>{finding.severity}</td>
                    <td><StatusBadge label={finding.status} tone={finding.status === 'resolved' ? 'good' : 'warn'} /></td>
                    <td>{finding.mismatchId ?? 'None'}</td>
                    <td>{formatDateTime(finding.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
