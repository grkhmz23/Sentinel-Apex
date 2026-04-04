import Link from 'next/link';

import { AppShell } from '../../src/components/app-shell';
import { CarryActionTable } from '../../src/components/carry-action-table';
import { CarryActions } from '../../src/components/carry-actions';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { carryModeTone, carryOnboardingTone, carryStatusTone, formatCarryOnboardingState } from '../../src/lib/carry-display';
import {
  carryStrategyEligibilityTone,
  carryStrategyRuleTone,
  formatCarryStrategyEnvironment,
  formatCarryStrategyEvidenceLabel,
} from '../../src/lib/carry-strategy-display';
import { formatDateTime, formatUsd } from '../../src/lib/format';
import { loadCarryPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function CarryPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/carry');
  const state = await loadCarryPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Carry view unavailable.'} title="Carry unavailable" />
      </AppShell>
    );
  }

  const { strategyProfile, recommendations, actions, executions, venues } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Apex Carry</p>
            <h1>Carry Sleeve</h1>
          </div>
          <div className="stack stack--compact">
            <CarryActions />
            <Link href="/carry/executions">Execution drill-through</Link>
          </div>
        </header>

        <div className="grid grid--two-column">
          <Panel subtitle="Hackathon-facing vault policy, APY model, and current supported evidence scope" title="Strategy Profile">
            <DefinitionList
              items={[
                { label: 'Strategy', value: strategyProfile.strategyName },
                {
                  label: 'Eligibility',
                  value: <StatusBadge label={strategyProfile.eligibility.status} tone={carryStrategyEligibilityTone(strategyProfile.eligibility.status)} />,
                },
                { label: 'Vault base asset', value: strategyProfile.vaultBaseAsset },
                { label: 'Tenor', value: `${strategyProfile.tenor.lockPeriodMonths}-month rolling` },
                { label: 'Reassessment', value: `Every ${strategyProfile.tenor.reassessmentCadenceMonths} months` },
                { label: 'Target APY floor', value: `${strategyProfile.apy.targetFloorPct}%` },
                { label: 'Configured target APY', value: `${strategyProfile.apy.targetApyPct}%` },
                {
                  label: 'Projected APY',
                  value: strategyProfile.apy.projectedApyPct === null
                    ? `Unknown (${formatCarryStrategyEvidenceLabel(strategyProfile.apy.projectedApySource)})`
                    : `${strategyProfile.apy.projectedApyPct}% (${formatCarryStrategyEvidenceLabel(strategyProfile.apy.projectedApySource)})`,
                },
                {
                  label: 'Realized APY',
                  value: strategyProfile.apy.realizedApyPct === null
                    ? `Unknown (${formatCarryStrategyEvidenceLabel(strategyProfile.apy.realizedApySource)})`
                    : `${strategyProfile.apy.realizedApyPct}% (${formatCarryStrategyEvidenceLabel(strategyProfile.apy.realizedApySource)})`,
                },
                { label: 'Yield source', value: formatCarryStrategyEvidenceLabel(strategyProfile.yieldSourceCategory) },
                { label: 'Leverage model', value: formatCarryStrategyEvidenceLabel(strategyProfile.leverageModel) },
                { label: 'Health threshold', value: strategyProfile.leverageHealthThreshold ?? 'Unavailable' },
                { label: 'Oracle dependency', value: formatCarryStrategyEvidenceLabel(strategyProfile.oracleDependencyClass) },
                { label: 'Evidence environment', value: formatCarryStrategyEnvironment(strategyProfile.evidence.environment) },
                { label: 'Latest evidence source', value: formatCarryStrategyEvidenceLabel(strategyProfile.evidence.latestEvidenceSource) },
                { label: 'Latest execution reference', value: strategyProfile.evidence.latestExecutionReference ?? 'Not recorded' },
                { label: 'Latest confirmation status', value: strategyProfile.evidence.latestConfirmationStatus ?? 'Not recorded' },
              ]}
            />
            <p className="panel__hint">{strategyProfile.evidence.summary}</p>
          </Panel>

          <Panel subtitle="Each Build-A-Bear rule is evaluated explicitly and fails closed when unsupported or ineligible" title="Eligibility Checks">
            {strategyProfile.eligibility.ruleResults.length === 0 ? (
              <EmptyState message="No eligibility rules were recorded for this strategy profile." title="No rules" />
            ) : (
              <div className="stack">
                {strategyProfile.eligibility.ruleResults.map((rule) => (
                  <p className={rule.status === 'pass' ? 'feedback feedback--success' : 'feedback feedback--warning'} key={rule.ruleKey}>
                    <StatusBadge label={rule.status} tone={carryStrategyRuleTone(rule.status)} /> {rule.summary}
                  </p>
                ))}
                {strategyProfile.eligibility.blockedReasons.length === 0 ? null : (
                  <p className="feedback feedback--error">
                    Blocked reasons: {strategyProfile.eligibility.blockedReasons.join(', ')}
                  </p>
                )}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Execution-ready carry recommendations with backend-enforced gating" title="Recommendations">
            {recommendations.length === 0 ? (
              <EmptyState message="No carry recommendations are currently persisted." title="No recommendations" />
            ) : (
              <CarryActionTable actions={recommendations} />
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Venue readiness, simulation state, and execution support boundaries" title="Venue Readiness">
            {venues.length === 0 ? (
              <EmptyState message="No carry venue snapshots are persisted yet." title="No venues" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Mode</th>
                    <th>Onboarding</th>
                    <th>Execution</th>
                    <th>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map((venue) => (
                    <tr key={venue.venueId}>
                      <td><Link href={`/venues/${venue.venueId}`}>{venue.venueId}</Link></td>
                      <td><StatusBadge label={venue.venueMode} tone={carryModeTone(venue.venueMode)} /></td>
                      <td><StatusBadge label={formatCarryOnboardingState(venue.onboardingState)} tone={carryOnboardingTone(venue.onboardingState)} /></td>
                      <td>{venue.executionSupported ? 'Supported' : 'Unsupported'}</td>
                      <td>{venue.missingPrerequisites.join(', ') || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Durable carry action lifecycle, including simulated and blocked states" title="Action History">
            {actions.length === 0 ? (
              <EmptyState message="No carry actions are currently persisted." title="No actions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Notional</th>
                    <th>Source</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id}>
                      <td>
                        <div className="stack stack--compact">
                          <Link href={`/carry/actions/${action.id}`}>{action.actionType}</Link>
                          <span className="panel__hint">{action.summary}</span>
                        </div>
                      </td>
                      <td><StatusBadge label={action.status} tone={carryStatusTone(action.status)} /></td>
                      <td>{action.executionMode}{action.simulated ? ' / simulated' : ''}</td>
                      <td>{formatUsd(action.notionalUsd)}</td>
                      <td>{action.sourceKind}</td>
                      <td>{formatDateTime(action.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Recent downstream execution attempts and outcomes" title="Execution History">
            {executions.length === 0 ? (
              <EmptyState message="No carry execution attempts are currently persisted." title="No executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Action</th>
                    <th>Mode</th>
                    <th>Requested By</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution.id}>
                      <td><StatusBadge label={execution.status} tone={carryStatusTone(execution.status)} /></td>
                      <td>
                        <div className="stack stack--compact">
                          <Link href={`/carry/executions/${execution.id}`}>{execution.id}</Link>
                          <Link href={`/carry/actions/${execution.carryActionId}`}>{execution.carryActionId}</Link>
                        </div>
                      </td>
                      <td>{execution.executionMode}{execution.simulated ? ' / simulated' : ''}</td>
                      <td>{execution.requestedBy}</td>
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
