'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type {
  RebalanceBundleEscalationTransitionView,
  RebalanceBundleEscalationView,
} from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import {
  acknowledgeRebalanceBundleEscalation,
  assignRebalanceBundleEscalation,
  closeRebalanceBundleEscalation,
  startRebalanceBundleEscalationReview,
} from '../lib/runtime-api.client';

interface MutationState {
  loadingTransitionId: string | null;
  error: string | null;
  success: string | null;
}

export function RebalanceBundleEscalationActions(
  {
    bundleId,
    escalation,
    transitions,
  }: {
    bundleId: string;
    escalation: RebalanceBundleEscalationView | null;
    transitions: RebalanceBundleEscalationTransitionView[];
  },
): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loadingTransitionId: null,
    error: null,
    success: null,
  });

  async function handleTransition(transition: RebalanceBundleEscalationTransitionView): Promise<void> {
    setState({
      loadingTransitionId: transition.id,
      error: null,
      success: null,
    });

    try {
      if (transition.transitionType === 'assign') {
        const ownerId = window.prompt(
          'Escalation owner',
          escalation?.ownerId ?? '',
        );
        if (ownerId === null) {
          setState({ loadingTransitionId: null, error: null, success: null });
          return;
        }
        const note = window.prompt(
          'Handoff note',
          escalation?.handoffNote ?? `Assign bundle ${bundleId} follow-up ownership.`,
        );
        if (note === null) {
          setState({ loadingTransitionId: null, error: null, success: null });
          return;
        }
        const dueAt = window.prompt(
          'Due date (optional, ISO 8601)',
          escalation?.dueAt ?? '',
        );
        await assignRebalanceBundleEscalation({
          bundleId,
          ownerId,
          note,
          ...(dueAt !== null && dueAt.length > 0 ? { dueAt } : {}),
        });
      } else if (transition.transitionType === 'acknowledge') {
        const note = window.prompt('Acknowledgement note (optional)', '');
        await acknowledgeRebalanceBundleEscalation({
          bundleId,
          ...(note !== null && note.length > 0 ? { note } : {}),
        });
      } else if (transition.transitionType === 'start_review') {
        const note = window.prompt('Review note (optional)', escalation?.reviewNote ?? '');
        await startRebalanceBundleEscalationReview({
          bundleId,
          ...(note !== null && note.length > 0 ? { note } : {}),
        });
      } else {
        const note = window.prompt(
          'Resolution note',
          escalation?.resolutionNote ?? `Resolve escalation for bundle ${bundleId}.`,
        );
        if (note === null) {
          setState({ loadingTransitionId: null, error: null, success: null });
          return;
        }
        await closeRebalanceBundleEscalation({
          bundleId,
          note,
        });
      }

      setState({
        loadingTransitionId: null,
        error: null,
        success: 'Escalation workflow updated.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loadingTransitionId: null,
        error: error instanceof Error ? error.message : 'Escalation workflow update failed.',
        success: null,
      });
    }
  }

  return (
    <div className="stack">
      {transitions.map((transition) => {
        const blocked = transition.eligibilityState !== 'eligible';
        return (
          <div className="panel panel--nested" key={transition.id}>
            <div className="stack stack--compact">
              <strong>{transition.transitionType}</strong>
              <span className="panel__hint">{transition.summary}</span>
              <span className="panel__hint">{transition.operatorAction}</span>
              {transition.blockedReasons.map((reason) => (
                <p className="feedback feedback--warning" key={`${transition.id}:${reason.code}`}>{reason.message}</p>
              ))}
            </div>
            <div className="button-row">
              <button
                className="button"
                disabled={state.loadingTransitionId !== null || !canOperate || blocked}
                onClick={() => void handleTransition(transition)}
                type="button"
              >
                {state.loadingTransitionId === transition.id ? 'Submitting...' : 'Apply Transition'}
              </button>
            </div>
          </div>
        );
      })}
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for escalation workflow changes.</p> : null}
    </div>
  );
}
