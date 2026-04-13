import type {
  SubmissionCheckStatus,
  SubmissionEvidenceRecordView,
  SubmissionReadinessStatus,
} from '@sentinel-apex/runtime';

import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { SubmissionRangerActions } from '../../src/components/submission-ranger-actions';
import { SubmissionRequirementsActions } from '../../src/components/submission-requirements-actions';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime } from '../../src/lib/format';
import { loadSubmissionPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

const SUBMISSION_DEADLINE_LABEL = 'Apr 17, 2026, 15:59 UTC';
const EVIDENCE_WINDOW_NOTE =
  'Trade and performance verification remains scoped to the hackathon build window of March 9, 2026 through April 6, 2026. Submission packaging can continue until April 17, 2026 at 15:59 UTC.';

function submissionReadinessTone(
  status: SubmissionReadinessStatus,
): 'good' | 'warn' | 'bad' {
  switch (status) {
    case 'ready':
      return 'good';
    case 'partial':
      return 'warn';
    default:
      return 'bad';
  }
}

function submissionCheckTone(
  status: SubmissionCheckStatus,
): 'good' | 'warn' | 'bad' {
  switch (status) {
    case 'pass':
      return 'good';
    case 'warning':
      return 'warn';
    default:
      return 'bad';
  }
}

function formatTrack(track: string): string {
  return track === 'build_a_bear_main_track' ? 'Build-A-Bear Main Track' : 'Hackathon Track';
}

function formatAddressScope(scope: string): string {
  switch (scope) {
    case 'wallet':
      return 'Wallet only';
    case 'vault':
      return 'Vault only';
    case 'both':
      return 'Wallet + vault';
    default:
      return 'Unconfigured';
  }
}

function formatEvidenceType(type: SubmissionEvidenceRecordView['evidenceType']): string {
  switch (type) {
    case 'on_chain_transaction':
      return 'On-chain transaction';
    case 'performance_snapshot':
      return 'Performance snapshot';
    case 'cex_trade_history':
      return 'CEX trade history';
    case 'cex_read_only_api':
      return 'CEX read-only API';
    default:
      return 'Document';
  }
}

export default async function SubmissionPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/submission');
  const state = await loadSubmissionPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Submission dossier unavailable.'} title="Submission unavailable" />
      </AppShell>
    );
  }

  const { dossier, evidence, exportBundle } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Hackathon</p>
            <h1>Submission Dossier</h1>
            <p className="page__summary">
              {EVIDENCE_WINDOW_NOTE} Current submission deadline: {SUBMISSION_DEADLINE_LABEL}.
            </p>
          </div>
        </header>

        <div className="grid grid--two-column">
          <Panel
            subtitle="Canonical vault identity, build window, address scope, and latest verifiable execution evidence"
            title="Submission Profile"
          >
            <DefinitionList
              items={[
                { label: 'Track', value: formatTrack(dossier.track) },
                {
                  label: 'Readiness',
                  value: (
                    <StatusBadge
                      label={dossier.readiness.status}
                      tone={submissionReadinessTone(dossier.readiness.status)}
                    />
                  ),
                },
                { label: 'Strategy', value: dossier.strategyName },
                { label: 'Vault', value: dossier.vaultName },
                { label: 'Base asset', value: dossier.baseAsset },
                { label: 'Build window start', value: formatDateTime(dossier.buildWindowStart) },
                { label: 'Build window end', value: formatDateTime(dossier.buildWindowEnd) },
                { label: 'Cluster', value: dossier.cluster },
                { label: 'Address scope', value: formatAddressScope(dossier.addressScope) },
                {
                  label: 'Wallet address',
                  value: dossier.walletAddress === null ? 'Not configured' : dossier.walletAddress,
                },
                {
                  label: 'Vault address',
                  value: dossier.vaultAddress === null ? 'Not configured' : dossier.vaultAddress,
                },
                {
                  label: 'Ranger vault',
                  value: dossier.rangerVaultAddress === null ? 'Not recorded' : dossier.rangerVaultAddress,
                },
                {
                  label: 'Ranger LP mint',
                  value: dossier.rangerLpMintAddress === null ? 'Not recorded' : dossier.rangerLpMintAddress,
                },
                {
                  label: 'Ranger adaptor',
                  value: dossier.rangerAdaptorProgramId === null ? 'Not recorded' : dossier.rangerAdaptorProgramId,
                },
                {
                  label: 'Ranger strategy',
                  value: dossier.rangerStrategyAddress === null ? 'Not recorded' : dossier.rangerStrategyAddress,
                },
                {
                  label: 'Strategy initialized',
                  value: dossier.rangerStrategyInitialized ? 'Yes' : 'No',
                },
                {
                  label: 'Funds allocated',
                  value: dossier.rangerFundsAllocated ? 'Yes' : 'No',
                },
                {
                  label: 'Strategy documentation',
                  value: dossier.strategyDocumentationUrl ?? 'Not recorded',
                },
                {
                  label: 'Code repository',
                  value: dossier.codeRepositoryUrl ?? 'Not recorded',
                },
                {
                  label: 'Repository visibility',
                  value: dossier.codeRepositoryVisibility,
                },
                {
                  label: 'Private reviewer added',
                  value: dossier.privateRepoReviewerAdded ? 'Yes' : 'No',
                },
                {
                  label: 'Latest execution reference',
                  value: dossier.latestExecutionReference ?? 'Not recorded',
                },
                {
                  label: 'Latest execution at',
                  value: formatDateTime(dossier.latestExecutionAt),
                },
                {
                  label: 'Real executions in window',
                  value: String(dossier.realExecutionCountInWindow),
                },
                {
                  label: 'Simulated executions in window',
                  value: String(dossier.simulatedExecutionCountInWindow),
                },
                {
                  label: 'Realized APY',
                  value: dossier.realizedApyPct === null ? 'Unavailable' : `${dossier.realizedApyPct}%`,
                },
                {
                  label: 'CEX execution',
                  value: dossier.cexExecutionUsed ? 'Yes' : 'No',
                },
              ]}
            />
            <p className="panel__hint">{dossier.readiness.summary}</p>
            <div className="stack stack--compact">
              {dossier.walletVerificationUrl === null ? null : (
                <a href={dossier.walletVerificationUrl} rel="noreferrer" target="_blank">Open wallet in Solscan</a>
              )}
              {dossier.vaultVerificationUrl === null ? null : (
                <a href={dossier.vaultVerificationUrl} rel="noreferrer" target="_blank">Open vault in Solscan</a>
              )}
              {dossier.rangerLpMetadataUri === null ? null : (
                <a href={dossier.rangerLpMetadataUri} rel="noreferrer" target="_blank">Open LP metadata</a>
              )}
              {dossier.strategyDocumentationUrl === null ? null : (
                <a href={dossier.strategyDocumentationUrl} rel="noreferrer" target="_blank">Open strategy documentation</a>
              )}
              {dossier.codeRepositoryUrl === null ? null : (
                <a href={dossier.codeRepositoryUrl} rel="noreferrer" target="_blank">Open code repository</a>
              )}
              {dossier.latestExecutionReferenceUrl === null ? null : (
                <a href={dossier.latestExecutionReferenceUrl} rel="noreferrer" target="_blank">Open latest transaction in Solscan</a>
              )}
            </div>
          </Panel>

          <Panel
            subtitle="Each requirement is checked against persisted strategy, vault, and execution evidence"
            title="Readiness Checks"
          >
            <div className="stack">
              {dossier.readiness.checks.map((check) => (
                <p
                  className={check.status === 'pass' ? 'feedback feedback--success' : 'feedback feedback--warning'}
                  key={check.key}
                >
                  <StatusBadge label={check.status} tone={submissionCheckTone(check.status)} /> {check.summary}
                </p>
              ))}
              {dossier.readiness.blockedReasons.length === 0 ? null : (
                <p className="feedback feedback--error">
                  Blocked reasons: {dossier.readiness.blockedReasons.join(', ')}
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel
            subtitle="These are the product claims the protocol can currently support and prove honestly"
            title="Supported Scope"
          >
            <div className="stack">
              {dossier.supportedScope.map((item) => (
                <p className="feedback feedback--success" key={item}>{item}</p>
              ))}
            </div>
          </Panel>

          <Panel
            subtitle="These boundaries still block a truthful Ranger-backed submission claim"
            title="Blocked Scope"
          >
            <div className="stack">
              {dossier.blockedScope.map((item) => (
                <p className="feedback feedback--warning" key={item}>{item}</p>
              ))}
              {dossier.notes === null ? null : <p className="panel__hint">{dossier.notes}</p>}
            </div>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel
            subtitle="Track the non-video hackathon requirements directly in the canonical submission dossier."
            title="Submission Requirements"
          >
            <SubmissionRequirementsActions dossier={dossier} />
          </Panel>

          <Panel
            subtitle="Operate the Ranger lifecycle directly from the dashboard using the authenticated submission endpoints."
            title="Ranger Actions"
          >
            <SubmissionRangerActions dossier={dossier} />
          </Panel>

          <Panel
            subtitle="Explicit artifacts recorded for investor, judge, and on-chain verification"
            title="Verification Evidence"
          >
            <div className="stack">
              {evidence.length === 0 ? (
                <p className="feedback feedback--warning">
                  No explicit verification artifacts have been recorded yet.
                </p>
              ) : (
                evidence.map((item) => (
                  <div className="stack stack--compact" key={item.evidenceId}>
                    <p className="feedback feedback--success">
                      <StatusBadge
                        label={item.status}
                        tone={item.status === 'rejected' ? 'bad' : 'good'}
                      /> {formatEvidenceType(item.evidenceType)}: {item.label}
                    </p>
                    {item.summary === null ? null : <p>{item.summary}</p>}
                    <p className="panel__hint">
                      Captured: {formatDateTime(item.capturedAt)} | In build window:{' '}
                      {item.withinBuildWindow ? 'yes' : 'no'}
                    </p>
                    {item.url === null ? null : (
                      <a href={item.url} rel="noreferrer" target="_blank">
                        Open evidence link
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel
            subtitle="Exportable checklist derived from dossier state and explicit evidence attachments"
            title="Export Bundle"
          >
            <p className="panel__hint">{exportBundle.judgeSummary}</p>
            <div className="stack">
              {exportBundle.artifactChecklist.map((item) => (
                <p
                  className={item.status === 'pass' ? 'feedback feedback--success' : 'feedback feedback--warning'}
                  key={item.key}
                >
                  <StatusBadge label={item.status} tone={submissionCheckTone(item.status)} />{' '}
                  {item.label}: {item.summary}
                </p>
              ))}
              {exportBundle.verificationLinks.map((link) => (
                <a href={link} key={link} rel="noreferrer" target="_blank">
                  {link}
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
