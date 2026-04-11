'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from './confirm-dialog';
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

interface PendingAction {
  name: NonNullable<MutationState['name']>;
  confirmationMessage: string;
  successMessage: string;
  run: () => Promise<unknown>;
}

export function QuickActions(): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    name: null,
    error: null,
    success: null,
  });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  async function runAction(): Promise<void> {
    if (pendingAction === null) {
      return;
    }

    const actionToRun = pendingAction;

    setState({ name: actionToRun.name, error: null, success: null });
    try {
      await actionToRun.run();
      setState({ name: null, error: null, success: actionToRun.successMessage });
      setPendingAction(null);
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
    <>
      <div className="quick-actions">
        <button
          className="quick-actions__card quick-actions__card--primary"
          disabled={disabled}
          onClick={() => setPendingAction({
            name: 'run_cycle',
            confirmationMessage: 'Queue a runtime cycle?',
            successMessage: 'Runtime cycle queued.',
            run: async () => triggerCycle(),
          })}
          type="button"
        >
          <span className="quick-actions__eyebrow">Immediate cycle</span>
          <strong>{state.name === 'run_cycle' ? 'Queueing cycle...' : 'Run Cycle'}</strong>
          <span className="quick-actions__detail">Advance runtime state against the latest persisted inputs.</span>
        </button>
        <button
          className="quick-actions__card quick-actions__card--primary"
          disabled={disabled}
          onClick={() => setPendingAction({
            name: 'rebuild_projections',
            confirmationMessage: 'Rebuild projections from durable state?',
            successMessage: 'Projection rebuild queued.',
            run: async () => rebuildProjections(),
          })}
          type="button"
        >
          <span className="quick-actions__eyebrow">Projection hygiene</span>
          <strong>{state.name === 'rebuild_projections' ? 'Queueing rebuild...' : 'Rebuild Projections'}</strong>
          <span className="quick-actions__detail">Refresh dashboard-facing state from durable control-plane records.</span>
        </button>
        <button
          className="quick-actions__card"
          disabled={disabled}
          onClick={() => setPendingAction({
            name: 'run_allocator_evaluation',
            confirmationMessage: 'Run a Sentinel allocator evaluation?',
            successMessage: 'Allocator evaluation queued.',
            run: async () => triggerAllocatorEvaluation(),
          })}
          type="button"
        >
          <span className="quick-actions__eyebrow">Capital posture</span>
          <strong>{state.name === 'run_allocator_evaluation' ? 'Queueing allocator...' : 'Evaluate Allocator'}</strong>
          <span className="quick-actions__detail">Recompute sleeve budget pressure and current target mix.</span>
        </button>
        <button
          className="quick-actions__card"
          disabled={disabled}
          onClick={() => setPendingAction({
            name: 'run_reconciliation',
            confirmationMessage: 'Run reconciliation against current persisted and adapter state?',
            successMessage: 'Reconciliation queued.',
            run: async () => triggerReconciliation(),
          })}
          type="button"
        >
          <span className="quick-actions__eyebrow">Integrity pass</span>
          <strong>{state.name === 'run_reconciliation' ? 'Queueing reconciliation...' : 'Run Reconciliation'}</strong>
          <span className="quick-actions__detail">Compare runtime projections against adapter and venue truth.</span>
        </button>
        {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
        {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
        {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for runtime actions.</p> : null}
      </div>
      <ConfirmDialog
        busy={pendingAction !== null && state.name === pendingAction.name}
        confirmLabel="Confirm"
        description={pendingAction?.confirmationMessage ?? ''}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void runAction()}
        open={pendingAction !== null}
        title="Queue runtime action"
      />
    </>
  );
}
