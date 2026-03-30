'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOperator } from './operator-context';
import { triggerCarryEvaluation } from '../lib/runtime-api.client';

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function CarryActions(): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleEvaluate(): Promise<void> {
    if (!window.confirm('Run a carry execution evaluation against the latest persisted strategy state?')) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await triggerCarryEvaluation();
      setState({
        loading: false,
        error: null,
        success: 'Carry evaluation queued.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Carry evaluation failed.',
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
        {state.loading ? 'Queueing carry evaluation...' : 'Run Carry Evaluation'}
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for carry actions.</p> : null}
    </div>
  );
}
