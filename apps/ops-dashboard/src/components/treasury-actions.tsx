'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOperator } from './operator-context';
import { triggerTreasuryEvaluation } from '../lib/runtime-api.client';

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function TreasuryActions(): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleEvaluate(): Promise<void> {
    if (!window.confirm('Run a treasury evaluation against current persisted and venue state?')) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await triggerTreasuryEvaluation();
      setState({
        loading: false,
        error: null,
        success: 'Treasury evaluation queued.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Treasury evaluation failed.',
        success: null,
      });
    }
  }

  return (
    <div className="button-row">
      <button
        className="button"
        disabled={state.loading || !canOperate}
        onClick={() => void handleEvaluate()}
        type="button"
      >
        {state.loading ? 'Queueing treasury evaluation...' : 'Run Treasury Evaluation'}
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for treasury actions.</p> : null}
    </div>
  );
}
