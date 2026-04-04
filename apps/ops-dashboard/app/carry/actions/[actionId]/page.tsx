import Link from 'next/link';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { Panel } from '../../../../src/components/panel';
import { StatusBadge } from '../../../../src/components/status-badge';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { carryModeTone, carryReadinessTone, carryStatusTone } from '../../../../src/lib/carry-display';
import {
  carryStrategyEligibilityTone,
  carryStrategyRuleTone,
  formatCarryStrategyEnvironment,
  formatCarryStrategyEvidenceLabel,
} from '../../../../src/lib/carry-strategy-display';
import { formatDateTime, formatUsd } from '../../../../src/lib/format';
import { loadCarryActionDetailPageData } from '../../../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function formatMarketIdentityLabel(
  identity: {
    marketSymbol: string | null;
    marketKey: string | null;
    normalizedKey: string | null;
  } | null,
): string {
  if (identity === null) {
    return 'Unsupported';
  }

  return identity.marketSymbol ?? identity.marketKey ?? identity.normalizedKey ?? 'Unsupported';
}

function formatMarketIdentityDetail(
  identity: {
    provenance: string;
    confidence: string;
    capturedAtStage: string;
    source: string;
  } | null,
): string {
  if (identity === null) {
    return 'No persisted market identity.';
  }

  return `${identity.provenance} / ${identity.confidence} via ${identity.capturedAtStage} (${identity.source})`;
}

export default async function CarryActionDetailPage(
  { params }: { params: { actionId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/carry/actions/${params.actionId}`);
  const state = await loadCarryActionDetailPageData(params.actionId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Carry action unavailable.'} title="Carry action unavailable" />
      </AppShell>
    );
  }

  const { detail } = state.data;
  const effects = typeof detail.action.executionPlan['effects'] === 'object'
    && detail.action.executionPlan['effects'] !== null
    && !Array.isArray(detail.action.executionPlan['effects'])
    ? detail.action.executionPlan['effects'] as {
      currentCarryAllocationUsd?: string;
      projectedCarryAllocationUsd?: string;
      projectedCarryAllocationPct?: number;
      approvedCarryBudgetUsd?: string | null;
      projectedRemainingBudgetUsd?: string | null;
      openPositionCount?: number;
    }
    : null;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Apex Carry</p>
            <h1>Carry Action Detail</h1>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Execution envelope, approval state, and downstream linkage" title="Action">
            <DefinitionList
              items={[
                { label: 'Action', value: detail.action.actionType },
                { label: 'Status', value: <StatusBadge label={detail.action.status} tone={carryStatusTone(detail.action.status)} /> },
                { label: 'Readiness', value: <StatusBadge label={detail.action.readiness} tone={carryReadinessTone(detail.action.readiness)} /> },
                { label: 'Mode', value: <StatusBadge label={detail.action.executionMode} tone={carryModeTone(detail.action.executionMode)} /> },
                { label: 'Notional', value: formatUsd(detail.action.notionalUsd) },
                { label: 'Approval requirement', value: detail.action.approvalRequirement },
                { label: 'Linked command', value: detail.latestCommand?.commandId ?? 'Not queued' },
                {
                  label: 'Linked rebalance',
                  value: detail.linkedRebalanceProposal === null
                    ? 'Standalone carry evaluation'
                    : <Link href={`/allocator/rebalance-proposals/${detail.linkedRebalanceProposal.id}`}>{detail.linkedRebalanceProposal.id}</Link>,
                },
              ]}
            />
            <p className="panel__hint">{detail.action.summary}</p>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Persisted strategy and vault snapshot attached to this carry action" title="Strategy Snapshot">
            <DefinitionList
              items={[
                {
                  label: 'Eligibility',
                  value: <StatusBadge label={detail.action.strategyProfile.eligibility.status} tone={carryStrategyEligibilityTone(detail.action.strategyProfile.eligibility.status)} />,
                },
                { label: 'Vault base asset', value: detail.action.strategyProfile.vaultBaseAsset },
                { label: 'Tenor', value: `${detail.action.strategyProfile.tenor.lockPeriodMonths}-month rolling` },
                { label: 'Reassessment', value: `Every ${detail.action.strategyProfile.tenor.reassessmentCadenceMonths} months` },
                { label: 'Target APY floor', value: `${detail.action.strategyProfile.apy.targetFloorPct}%` },
                { label: 'Configured target APY', value: `${detail.action.strategyProfile.apy.targetApyPct}%` },
                {
                  label: 'Projected APY',
                  value: detail.action.strategyProfile.apy.projectedApyPct === null
                    ? `Unknown (${formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.apy.projectedApySource)})`
                    : `${detail.action.strategyProfile.apy.projectedApyPct}% (${formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.apy.projectedApySource)})`,
                },
                {
                  label: 'Realized APY',
                  value: detail.action.strategyProfile.apy.realizedApyPct === null
                    ? `Unknown (${formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.apy.realizedApySource)})`
                    : `${detail.action.strategyProfile.apy.realizedApyPct}% (${formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.apy.realizedApySource)})`,
                },
                { label: 'Yield source', value: formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.yieldSourceCategory) },
                { label: 'Leverage model', value: formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.leverageModel) },
                { label: 'Health threshold', value: detail.action.strategyProfile.leverageHealthThreshold ?? 'Unavailable' },
                { label: 'Oracle dependency', value: formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.oracleDependencyClass) },
                { label: 'Evidence environment', value: formatCarryStrategyEnvironment(detail.action.strategyProfile.evidence.environment) },
                { label: 'Latest evidence source', value: formatCarryStrategyEvidenceLabel(detail.action.strategyProfile.evidence.latestEvidenceSource) },
              ]}
            />
            <p className="panel__hint">{detail.action.strategyProfile.evidence.summary}</p>
          </Panel>

          <Panel subtitle="Structured policy and venue gating reasons" title="Blocked Reasons">
            {detail.action.blockedReasons.length === 0 ? (
              <EmptyState message="No blocked reasons were persisted for this action." title="No blocked reasons" />
            ) : (
              <div className="stack">
                {detail.action.blockedReasons.map((reason) => (
                  <p className="feedback feedback--warning" key={`${reason.category}:${reason.code}`}>
                    <strong>{reason.code}:</strong> {reason.message} Operator action: {reason.operatorAction}
                  </p>
                ))}
              </div>
            )}
          </Panel>

          <Panel subtitle="Projected carry exposure effects before execution" title="Effects">
            <DefinitionList
              items={[
                { label: 'Current carry allocation', value: effects?.currentCarryAllocationUsd === undefined ? 'Unavailable' : formatUsd(effects.currentCarryAllocationUsd) },
                { label: 'Projected carry allocation', value: effects?.projectedCarryAllocationUsd === undefined ? 'Unavailable' : formatUsd(effects.projectedCarryAllocationUsd) },
                { label: 'Projected carry allocation %', value: effects?.projectedCarryAllocationPct === undefined ? 'Unavailable' : `${effects.projectedCarryAllocationPct.toFixed(2)}%` },
                { label: 'Approved carry budget', value: effects?.approvedCarryBudgetUsd === undefined || effects.approvedCarryBudgetUsd === null ? 'Unbounded' : formatUsd(effects.approvedCarryBudgetUsd) },
                { label: 'Projected remaining budget', value: effects?.projectedRemainingBudgetUsd === undefined || effects.projectedRemainingBudgetUsd === null ? 'Unavailable' : formatUsd(effects.projectedRemainingBudgetUsd) },
                { label: 'Open position count', value: effects?.openPositionCount === undefined ? 'Unavailable' : String(effects.openPositionCount) },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Per-rule Build-A-Bear eligibility verdict captured when the action was planned" title="Eligibility Checks">
            <div className="stack">
              {detail.action.strategyProfile.eligibility.ruleResults.map((rule) => (
                <p className={rule.status === 'pass' ? 'feedback feedback--success' : 'feedback feedback--warning'} key={rule.ruleKey}>
                  <StatusBadge label={rule.status} tone={carryStrategyRuleTone(rule.status)} /> {rule.summary}
                </p>
              ))}
              {detail.action.strategyProfile.eligibility.blockedReasons.length === 0 ? null : (
                <p className="feedback feedback--error">
                  Blocked reasons: {detail.action.strategyProfile.eligibility.blockedReasons.join(', ')}
                </p>
              )}
            </div>
          </Panel>

          <Panel subtitle="Deterministic order intents attached to this carry action" title="Planned Orders">
            {detail.plannedOrders.length === 0 ? (
              <EmptyState message="This carry action does not require order intents." title="No planned orders" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Asset</th>
                    <th>Market</th>
                    <th>Identity</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Reduce Only</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.plannedOrders.map((order) => (
                    <tr key={order.intentId}>
                      <td>{order.venueId}</td>
                      <td>{order.asset}</td>
                      <td>{formatMarketIdentityLabel(order.marketIdentity)}</td>
                      <td>{formatMarketIdentityDetail(order.marketIdentity)}</td>
                      <td>{order.side}</td>
                      <td>{order.orderType}</td>
                      <td>{order.requestedSize}</td>
                      <td>{order.reduceOnly ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Durable execution attempts linked to this action" title="Executions">
            {detail.executions.length === 0 ? (
              <EmptyState message="This carry action has not produced an execution attempt yet." title="No executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Outcome</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.executions.map((execution) => (
                    <tr key={execution.id}>
                      <td><Link href={`/carry/executions/${execution.id}`}>{execution.id}</Link></td>
                      <td><StatusBadge label={execution.status} tone={carryStatusTone(execution.status)} /></td>
                      <td>{execution.requestedBy}</td>
                      <td>{execution.outcomeSummary ?? execution.lastError ?? 'Pending'}</td>
                      <td>{formatDateTime(execution.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
