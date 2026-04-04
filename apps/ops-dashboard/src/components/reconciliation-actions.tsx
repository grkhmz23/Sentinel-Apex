'use client';

import { useState } from 'react';

import { useOptionalOperator } from './operator-context';
import { useOptionalRefresh } from '../lib/navigation-hooks';
import { triggerReconciliation } from '../lib/runtime-api.client';

interface ReconciliationActionsProps {
  idleLabel?: string;
  pendingLabel?: string;
}

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function ReconciliationActions(
  { idleLabel = 'Run Reconciliation', pendingLabel = 'Queueing reconciliation...' }: ReconciliationActionsProps,
): JSX.Element {
  const refresh = useOptionalRefresh();
  const operator = useOptionalOperator();
  const canOperate = operator?.canOperate ?? false;
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleRun(): Promise<void> {
    if (!window.confirm('Run reconciliation against current persisted state and venue truth?')) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await triggerReconciliation();
      setState({
        loading: false,
        error: null,
        success: 'Reconciliation queued.',
      });
      refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed.',
        success: null,
      });
    }
  }

  return (
    <div className="button-stack button-stack--align-end">
      <button
        className="button button--secondary"
        disabled={state.loading || !canOperate}
        onClick={() => void handleRun()}
        type="button"
      >
        {state.loading ? pendingLabel : idleLabel}
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for reconciliation actions.</p> : null}
    </div>
  );
}
