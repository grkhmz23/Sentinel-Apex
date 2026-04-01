'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { RebalanceBundleRecoveryCandidateView } from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import { requestRebalanceBundleRecoveryAction } from '../lib/runtime-api.client';

interface MutationState {
  loadingCandidateId: string | null;
  error: string | null;
  success: string | null;
}

export function RebalanceBundleRecoveryActions(
  {
    bundleId,
    candidates,
  }: {
    bundleId: string;
    candidates: RebalanceBundleRecoveryCandidateView[];
  },
): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loadingCandidateId: null,
    error: null,
    success: null,
  });

  async function handleRequest(candidate: RebalanceBundleRecoveryCandidateView): Promise<void> {
    const note = window.prompt(
      'Recovery note',
      `Requested from bundle ${bundleId} for ${candidate.targetChildType} ${candidate.targetChildId}.`,
    );
    if (note === null) {
      return;
    }

    setState({
      loadingCandidateId: candidate.id,
      error: null,
      success: null,
    });

    try {
      const result = await requestRebalanceBundleRecoveryAction({
        bundleId,
        recoveryActionType: candidate.recoveryActionType,
        targetChildType: candidate.targetChildType,
        targetChildId: candidate.targetChildId,
        note,
      }) as { status?: string };
      setState({
        loadingCandidateId: null,
        error: null,
        success: result.status === 'queued'
          ? 'Bundle recovery action queued.'
          : 'Bundle recovery action recorded.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loadingCandidateId: null,
        error: error instanceof Error ? error.message : 'Bundle recovery request failed.',
        success: null,
      });
    }
  }

  return (
    <div className="stack">
      {candidates.map((candidate) => {
        const blocked = candidate.eligibilityState !== 'eligible';
        return (
          <div className="panel panel--nested" key={candidate.id}>
            <div className="stack stack--compact">
              <strong>{candidate.targetChildType} {candidate.targetChildId}</strong>
              <span className="panel__hint">{candidate.targetChildSummary}</span>
              <span className="panel__hint">
                {candidate.recoveryActionType} via {candidate.targetCommandType ?? 'no command'}.
              </span>
              {candidate.note !== null ? <span className="panel__hint">{candidate.note}</span> : null}
              {candidate.blockedReasons.map((reason) => (
                <p className="feedback feedback--warning" key={`${candidate.id}:${reason.code}`}>{reason.message}</p>
              ))}
            </div>
            <div className="button-row">
              <button
                className="button"
                disabled={state.loadingCandidateId !== null || !canOperate || blocked}
                onClick={() => void handleRequest(candidate)}
                type="button"
              >
                {state.loadingCandidateId === candidate.id ? 'Submitting...' : 'Request Recovery'}
              </button>
            </div>
          </div>
        );
      })}
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for bundle recovery actions.</p> : null}
    </div>
  );
}
