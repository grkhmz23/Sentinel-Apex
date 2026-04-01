import Link from 'next/link';

import type { RebalanceEscalationQueueFilters } from '@sentinel-apex/runtime';

import { AppShell } from '../../../src/components/app-shell';
import { DefinitionList } from '../../../src/components/definition-list';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { Panel } from '../../../src/components/panel';
import { RebalanceEscalationQueueActions } from '../../../src/components/rebalance-escalation-queue-actions';
import { StatusBadge } from '../../../src/components/status-badge';
import { requireDashboardSession } from '../../../src/lib/auth.server';
import { formatDateTime } from '../../../src/lib/format';
import { loadEscalationsPageData } from '../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function readFilters(
  searchParams: Record<string, string | string[] | undefined>,
): RebalanceEscalationQueueFilters {
  const status = typeof searchParams['status'] === 'string' ? searchParams['status'] : undefined;
  const ownerId = typeof searchParams['ownerId'] === 'string' ? searchParams['ownerId'] : undefined;
  const openState = typeof searchParams['openState'] === 'string' ? searchParams['openState'] : undefined;
  const queueState = typeof searchParams['queueState'] === 'string' ? searchParams['queueState'] : undefined;
  const sortBy = typeof searchParams['sortBy'] === 'string' ? searchParams['sortBy'] : undefined;
  const sortDirection = typeof searchParams['sortDirection'] === 'string' ? searchParams['sortDirection'] : undefined;

  const filters: Record<string, unknown> = {};
  if (status !== undefined) {
    filters['status'] = status;
  }
  if (ownerId !== undefined) {
    filters['ownerId'] = ownerId;
  }
  if (openState !== undefined) {
    filters['openState'] = openState;
  }
  if (queueState !== undefined) {
    filters['queueState'] = queueState;
  }
  if (sortBy !== undefined) {
    filters['sortBy'] = sortBy;
  }
  if (sortDirection !== undefined) {
    filters['sortDirection'] = sortDirection;
  }

  return filters as RebalanceEscalationQueueFilters;
}

function queueTone(queueState: string): 'good' | 'warn' | 'bad' | 'neutral' {
  if (queueState === 'overdue') {
    return 'bad';
  }
  if (queueState === 'due_soon' || queueState === 'unassigned') {
    return 'warn';
  }
  if (queueState === 'resolved') {
    return 'good';
  }

  return 'neutral';
}

export default async function EscalationsPage(
  { searchParams }: { searchParams: Record<string, string | string[] | undefined> },
): Promise<JSX.Element> {
  const session = await requireDashboardSession('/allocator/escalations');
  const filters = readFilters(searchParams);
  const state = await loadEscalationsPageData({
    ...filters,
    limit: 100,
  });

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Escalations queue unavailable.'} title="Escalations queue unavailable" />
      </AppShell>
    );
  }

  const { escalations, summary } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Allocator</p>
            <h1>Escalations Queue</h1>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Cross-bundle ownership and follow-up counts" title="Queue Summary">
            <DefinitionList
              items={[
                { label: 'Open', value: String(summary.open) },
                { label: 'Acknowledged', value: String(summary.acknowledged) },
                { label: 'In review', value: String(summary.inReview) },
                { label: 'Overdue', value: String(summary.overdue) },
                { label: 'Due soon', value: String(summary.dueSoon) },
                { label: 'Unassigned', value: String(summary.unassigned) },
                { label: 'Mine', value: String(summary.mine) },
              ]}
            />
          </Panel>
        </div>

        <Panel subtitle="Filter the active escalation queue by owner, status, and due-state" title="Filters">
          <form className="filters" method="get">
            <select className="select" defaultValue={filters.status ?? ''} name="status">
              <option value="">All statuses</option>
              <option value="open">open</option>
              <option value="acknowledged">acknowledged</option>
              <option value="in_review">in_review</option>
              <option value="resolved">resolved</option>
            </select>
            <select className="select" defaultValue={filters.openState ?? 'open'} name="openState">
              <option value="open">Open only</option>
              <option value="closed">Closed only</option>
              <option value="">Open and closed</option>
            </select>
            <select className="select" defaultValue={filters.queueState ?? ''} name="queueState">
              <option value="">All queue states</option>
              <option value="overdue">overdue</option>
              <option value="due_soon">due_soon</option>
              <option value="unassigned">unassigned</option>
            </select>
            <input className="input" defaultValue={filters.ownerId ?? ''} name="ownerId" placeholder="Owner id" />
            <select className="select" defaultValue={filters.sortBy ?? 'latest_activity'} name="sortBy">
              <option value="latest_activity">Latest activity</option>
              <option value="due_at">Due date</option>
              <option value="created_at">Created at</option>
              <option value="updated_at">Updated at</option>
            </select>
            <select className="select" defaultValue={filters.sortDirection ?? 'desc'} name="sortDirection">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
            <button className="button" type="submit">Apply</button>
          </form>
        </Panel>

        <Panel subtitle="Open escalations across bundles with safe triage actions" title="Triage Board">
          {escalations.length === 0 ? (
            <EmptyState message="No escalations matched the current queue filters." title="No escalations" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Bundle</th>
                  <th>Status</th>
                  <th>Queue state</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Bundle state</th>
                  <th>Latest activity</th>
                  <th>Quick actions</th>
                </tr>
              </thead>
              <tbody>
                {escalations.map((item) => (
                  <tr key={item.escalationId}>
                    <td>
                      <div className="stack stack--compact">
                        <Link href={`/allocator/rebalance-bundles/${item.bundleId}`}>{item.bundleId}</Link>
                        <span className="panel__hint">Proposal {item.proposalId}</span>
                        <span className="panel__hint">Sleeves {item.childSleeves.join(', ') || 'none recorded'}</span>
                      </div>
                    </td>
                    <td><StatusBadge label={item.escalationStatus} tone={item.escalationStatus === 'resolved' ? 'good' : 'warn'} /></td>
                    <td><StatusBadge label={item.escalationQueueState} tone={queueTone(item.escalationQueueState)} /></td>
                    <td>{item.ownerId ?? 'Unassigned'}</td>
                    <td>{item.dueAt === null ? 'No target' : formatDateTime(item.dueAt)}</td>
                    <td>
                      <div className="stack stack--compact">
                        <StatusBadge label={item.bundleStatus} tone={item.bundleStatus === 'completed' ? 'good' : item.bundleStatus === 'failed' || item.bundleStatus === 'blocked' || item.bundleStatus === 'requires_intervention' ? 'bad' : 'warn'} />
                        <span className="panel__hint">{item.interventionRecommendation}</span>
                        <span className="panel__hint">{item.failedChildCount} failed / {item.blockedChildCount} blocked / {item.pendingChildCount} pending</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack--compact">
                        <span>{formatDateTime(item.latestActivityAt)}</span>
                        <span className="panel__hint">{item.latestEventSummary ?? 'No event note recorded.'}</span>
                      </div>
                    </td>
                    <td><RebalanceEscalationQueueActions item={item} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
