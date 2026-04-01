'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { RebalanceBundleResolutionActionView, RebalanceBundleResolutionOptionView } from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import { requestRebalanceBundleResolutionAction } from '../lib/runtime-api.client';

interface MutationState {
  loadingOptionId: string | null;
  error: string | null;
  success: string | null;
}

export function RebalanceBundleResolutionActions(
  {
    bundleId,
    options,
    history,
  }: {
    bundleId: string;
    options: RebalanceBundleResolutionOptionView[];
    history: RebalanceBundleResolutionActionView[];
  },
): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loadingOptionId: null,
    error: null,
    success: null,
  });

  async function handleRequest(option: RebalanceBundleResolutionOptionView): Promise<void> {
    const note = window.prompt(
      'Manual resolution note',
      `Document the operator rationale for ${option.resolutionActionType} on bundle ${bundleId}.`,
    );
    if (note === null) {
      return;
    }

    setState({
      loadingOptionId: option.id,
      error: null,
      success: null,
    });

    try {
      const result = await requestRebalanceBundleResolutionAction({
        bundleId,
        resolutionActionType: option.resolutionActionType,
        note,
      }) as { status?: string };
      setState({
        loadingOptionId: null,
        error: null,
        success: result.status === 'completed'
          ? 'Bundle manual resolution recorded.'
          : 'Bundle manual resolution request was blocked.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loadingOptionId: null,
        error: error instanceof Error ? error.message : 'Bundle manual resolution failed.',
        success: null,
      });
    }
  }

  return (
    <div className="stack">
      {options.map((option) => {
        const blocked = option.eligibilityState !== 'eligible';
        return (
          <div className="panel panel--nested" key={option.id}>
            <div className="stack stack--compact">
              <strong>{option.resolutionActionType}</strong>
              <span className="panel__hint">{option.summary}</span>
              <span className="panel__hint">{option.operatorAction}</span>
              {option.blockedReasons.map((reason) => (
                <p className="feedback feedback--warning" key={`${option.id}:${reason.code}`}>{reason.message}</p>
              ))}
            </div>
            <div className="button-row">
              <button
                className="button"
                disabled={state.loadingOptionId !== null || !canOperate || blocked}
                onClick={() => void handleRequest(option)}
                type="button"
              >
                {state.loadingOptionId === option.id ? 'Submitting...' : 'Record Decision'}
              </button>
            </div>
          </div>
        );
      })}
      {history.length === 0 ? null : <p className="panel__hint">Latest resolution state: {history[0]?.resolutionState}</p>}
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for bundle manual resolution.</p> : null}
    </div>
  );
}
