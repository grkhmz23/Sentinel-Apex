'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOperator } from './operator-context';
import {
  rebuildProjections,
  triggerAllocatorEvaluation,
  triggerCycle,
  triggerReconciliation,
} from '../lib/runtime-api.client';

interface MutationState {
  name: 'run_cycle' | 'rebuild_projections' | 'run_reconciliation' | 'run_allocator_evaluation' | null;
  error: string | null;
  success: string | null;
}

export function QuickActions(): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    name: null,
    error: null,
    success: null,
  });

  async function runAction(
    actionName: MutationState['name'],
    action: () => Promise<unknown>,
    confirmationMessage: string,
    successMessage: string,
  ): Promise<void> {
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setState({ name: actionName, error: null, success: null });
    try {
      await action();
      setState({ name: null, error: null, success: successMessage });
      router.refresh();
    } catch (error) {
      setState({
        name: null,
        error: error instanceof Error ? error.message : 'Action failed.',
        success: null,
      });
    }
  }

  const disabled = state.name !== null || !canOperate;

  return (
    <div className="button-row">
      <button
        className="button"
        disabled={disabled}
        onClick={() => void runAction(
          'run_cycle',
          async () => triggerCycle(),
          'Queue a runtime cycle?',
          'Runtime cycle queued.',
        )}
        type="button"
      >
        {state.name === 'run_cycle' ? 'Queueing cycle...' : 'Run Cycle'}
      </button>
      <button
        className="button"
        disabled={disabled}
        onClick={() => void runAction(
          'rebuild_projections',
          async () => rebuildProjections(),
          'Rebuild projections from durable state?',
          'Projection rebuild queued.',
        )}
        type="button"
      >
        {state.name === 'rebuild_projections' ? 'Queueing rebuild...' : 'Rebuild Projections'}
      </button>
      <button
        className="button button--secondary"
        disabled={disabled}
        onClick={() => void runAction(
          'run_allocator_evaluation',
          async () => triggerAllocatorEvaluation(),
          'Run a Sentinel allocator evaluation?',
          'Allocator evaluation queued.',
        )}
        type="button"
      >
        {state.name === 'run_allocator_evaluation' ? 'Queueing allocator...' : 'Evaluate Allocator'}
      </button>
      <button
        className="button button--secondary"
        disabled={disabled}
        onClick={() => void runAction(
          'run_reconciliation',
          async () => triggerReconciliation(),
          'Run reconciliation against current persisted and adapter state?',
          'Reconciliation queued.',
        )}
        type="button"
      >
        {state.name === 'run_reconciliation' ? 'Queueing reconciliation...' : 'Run Reconciliation'}
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for runtime actions.</p> : null}
    </div>
  );
}
