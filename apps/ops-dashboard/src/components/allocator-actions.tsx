'use client';

import { useState } from 'react';

import { useOptionalOperator } from './operator-context';
import { useOptionalRefresh } from '../lib/navigation-hooks';
import { triggerAllocatorEvaluation } from '../lib/runtime-api.client';

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function AllocatorActions(): JSX.Element {
  const refresh = useOptionalRefresh();
  const operator = useOptionalOperator();
  const canOperate = operator?.canOperate ?? false;
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleEvaluate(): Promise<void> {
    if (!window.confirm('Run an allocator evaluation against the latest persisted runtime state?')) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await triggerAllocatorEvaluation();
      setState({
        loading: false,
        error: null,
        success: 'Allocator evaluation queued.',
      });
      refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Allocator evaluation failed.',
        success: null,
      });
    }
  }

  return (
    <div className="button-stack button-stack--align-end">
      <button
        className="button"
        disabled={state.loading || !canOperate}
        onClick={() => void handleEvaluate()}
        type="button"
      >
        {state.loading ? 'Queueing allocator...' : 'Evaluate Targets'}
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for allocator actions.</p> : null}
    </div>
  );
}
