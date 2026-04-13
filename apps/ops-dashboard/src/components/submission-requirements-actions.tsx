'use client';

import { useState } from 'react';

import { updateSubmissionDossier } from '../lib/runtime-api.client';
import { useOptionalRefresh } from '../lib/navigation-hooks';
import { useOperator } from './operator-context';

import type { SubmissionDossierView } from '@sentinel-apex/runtime';

interface SubmissionRequirementsActionsProps {
  dossier: SubmissionDossierView;
}

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function SubmissionRequirementsActions(
  { dossier }: SubmissionRequirementsActionsProps,
): JSX.Element {
  const refresh = useOptionalRefresh();
  const { canOperate } = useOperator();
  const [strategyDocumentationUrl, setStrategyDocumentationUrl] = useState(
    dossier.strategyDocumentationUrl ?? '',
  );
  const [codeRepositoryUrl, setCodeRepositoryUrl] = useState(dossier.codeRepositoryUrl ?? '');
  const [codeRepositoryVisibility, setCodeRepositoryVisibility] = useState<
    SubmissionDossierView['codeRepositoryVisibility']
  >(dossier.codeRepositoryVisibility);
  const [privateRepoReviewerAdded, setPrivateRepoReviewerAdded] = useState(
    dossier.privateRepoReviewerAdded,
  );
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleSave(): Promise<void> {
    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await updateSubmissionDossier({
        strategyDocumentationUrl:
          strategyDocumentationUrl.trim().length === 0 ? null : strategyDocumentationUrl.trim(),
        codeRepositoryUrl: codeRepositoryUrl.trim().length === 0 ? null : codeRepositoryUrl.trim(),
        codeRepositoryVisibility,
        privateRepoReviewerAdded,
      });

      setState({
        loading: false,
        error: null,
        success: 'Submission requirements updated.',
      });
      refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Submission requirements update failed.',
        success: null,
      });
    }
  }

  return (
    <div className="signal-list">
      <div className="signal-list__item">
        <div className="signal-list__header">
          <div>
            <p className="signal-list__label">Hackathon Requirements</p>
            <div className="signal-list__value">Strategy docs and code review access</div>
          </div>
        </div>
        <p className="signal-list__detail">
          This covers the non-video submission requirements: strategy documentation and a reviewable code repository.
        </p>
        <label className="field">
          <span>Strategy Documentation Url</span>
          <input
            className="input"
            onChange={(event) => setStrategyDocumentationUrl(event.target.value)}
            placeholder="https://..."
            type="text"
            value={strategyDocumentationUrl}
          />
        </label>
        <label className="field">
          <span>Code Repository Url</span>
          <input
            className="input"
            onChange={(event) => setCodeRepositoryUrl(event.target.value)}
            placeholder="https://github.com/owner/repo"
            type="text"
            value={codeRepositoryUrl}
          />
        </label>
        <label className="field">
          <span>Repository Visibility</span>
          <select
            className="select"
            onChange={(event) =>
              setCodeRepositoryVisibility(
                event.target.value as SubmissionDossierView['codeRepositoryVisibility'],
              )}
            value={codeRepositoryVisibility}
          >
            <option value="unknown">unknown</option>
            <option value="public">public</option>
            <option value="private">private</option>
          </select>
        </label>
        <label className="field">
          <span>Private Repo Reviewer Access</span>
          <div className="panel__hint">
            <input
              checked={privateRepoReviewerAdded}
              onChange={(event) => setPrivateRepoReviewerAdded(event.target.checked)}
              type="checkbox"
            />{' '}
            @jakeyvee has been added for private-repo review
          </div>
        </label>
        <div className="button-row">
          <button
            className="button"
            disabled={state.loading || !canOperate}
            onClick={() => void handleSave()}
            type="button"
          >
            {state.loading ? 'Saving...' : 'Save Submission Requirements'}
          </button>
        </div>
        {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
        {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
        {!canOperate ? (
          <p className="feedback feedback--warning">
            Your role is read-only for submission requirement updates.
          </p>
        ) : null}
      </div>
    </div>
  );
}
