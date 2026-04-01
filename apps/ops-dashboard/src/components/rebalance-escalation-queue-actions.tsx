'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { RebalanceEscalationQueueItemView } from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import {
  acknowledgeRebalanceBundleEscalation,
  assignRebalanceBundleEscalation,
  startRebalanceBundleEscalationReview,
} from '../lib/runtime-api.client';

interface MutationState {
  loadingAction: string | null;
  error: string | null;
}

export function RebalanceEscalationQueueActions(
  { item }: { item: RebalanceEscalationQueueItemView },
): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loadingAction: null,
    error: null,
  });

  async function runAction(action: 'assign' | 'acknowledge' | 'start_review'): Promise<void> {
    setState({
      loadingAction: action,
      error: null,
    });

    try {
      if (action === 'assign') {
        const ownerId = window.prompt('Escalation owner', item.ownerId ?? '');
        if (ownerId === null) {
          setState({ loadingAction: null, error: null });
          return;
        }
        const note = window.prompt('Handoff note', item.latestEventSummary ?? `Assign escalation ${item.escalationId}.`);
        if (note === null) {
          setState({ loadingAction: null, error: null });
          return;
        }
        const dueAt = window.prompt('Due date (optional, ISO 8601)', item.dueAt ?? '');
        await assignRebalanceBundleEscalation({
          bundleId: item.bundleId,
          ownerId,
          note,
          ...(dueAt !== null && dueAt.length > 0 ? { dueAt } : {}),
        });
      } else if (action === 'acknowledge') {
        const note = window.prompt('Acknowledgement note (optional)', '');
        await acknowledgeRebalanceBundleEscalation({
          bundleId: item.bundleId,
          ...(note !== null && note.length > 0 ? { note } : {}),
        });
      } else {
        const note = window.prompt('Review note (optional)', item.latestEventSummary ?? '');
        await startRebalanceBundleEscalationReview({
          bundleId: item.bundleId,
          ...(note !== null && note.length > 0 ? { note } : {}),
        });
      }

      setState({
        loadingAction: null,
        error: null,
      });
      router.refresh();
    } catch (error) {
      setState({
        loadingAction: null,
        error: error instanceof Error ? error.message : 'Escalation quick action failed.',
      });
    }
  }

  const assignDisabled = !canOperate || !item.isOpen;
  const acknowledgeDisabled = !canOperate || item.escalationStatus !== 'open';
  const reviewDisabled = !canOperate || (item.escalationStatus !== 'acknowledged' && item.escalationStatus !== 'in_review');

  return (
    <div className="stack stack--compact">
      <div className="button-row">
        <button className="button button--secondary" disabled={assignDisabled || state.loadingAction !== null} onClick={() => void runAction('assign')} type="button">
          {state.loadingAction === 'assign' ? 'Assigning...' : 'Assign'}
        </button>
        <button className="button button--secondary" disabled={acknowledgeDisabled || state.loadingAction !== null} onClick={() => void runAction('acknowledge')} type="button">
          {state.loadingAction === 'acknowledge' ? 'Submitting...' : 'Acknowledge'}
        </button>
        <button className="button button--secondary" disabled={reviewDisabled || state.loadingAction !== null} onClick={() => void runAction('start_review')} type="button">
          {state.loadingAction === 'start_review' ? 'Submitting...' : 'Start Review'}
        </button>
      </div>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for escalation queue actions.</p> : null}
    </div>
  );
}
