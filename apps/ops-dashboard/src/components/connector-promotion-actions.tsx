'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOperator } from './operator-context';
import {
  approveConnectorPromotion,
  rejectConnectorPromotion,
  requestConnectorPromotion,
  suspendConnectorPromotion,
} from '../lib/runtime-api.client';

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function ConnectorPromotionActions(
  {
    capabilityClass,
    promotionStatus,
    venueId,
    venueName,
  }: {
    capabilityClass: 'simulated_only' | 'real_readonly' | 'execution_capable';
    promotionStatus: 'not_requested' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
    venueId: string;
    venueName: string;
  },
): JSX.Element {
  const router = useRouter();
  const { canOperate, isAdmin } = useOperator();
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function runMutation(
    action: () => Promise<unknown>,
    success: string,
  ): Promise<void> {
    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await action();
      setState({
        loading: false,
        error: null,
        success,
      });
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Connector promotion mutation failed.',
        success: null,
      });
    }
  }

  async function handleRequest(): Promise<void> {
    if (!window.confirm(`Request live-promotion review for ${venueName}?`)) {
      return;
    }

    await runMutation(
      () => requestConnectorPromotion(venueId),
      'Connector promotion review requested.',
    );
  }

  async function handleApprove(): Promise<void> {
    if (!window.confirm(`Approve ${venueName} for live use?`)) {
      return;
    }

    const note = window.prompt('Optional approval note', '') ?? undefined;
    await runMutation(
      () => approveConnectorPromotion(venueId, note?.trim() === '' ? undefined : note),
      'Connector promotion approved.',
    );
  }

  async function handleReject(): Promise<void> {
    const note = window.prompt('Rejection note', '');
    if (note === null) {
      return;
    }

    const trimmed = note.trim();
    if (trimmed.length === 0) {
      setState({
        loading: false,
        error: 'A rejection note is required.',
        success: null,
      });
      return;
    }

    await runMutation(
      () => rejectConnectorPromotion(venueId, trimmed),
      'Connector promotion rejected.',
    );
  }

  async function handleSuspend(): Promise<void> {
    const note = window.prompt('Suspension note', '');
    if (note === null) {
      return;
    }

    const trimmed = note.trim();
    if (trimmed.length === 0) {
      setState({
        loading: false,
        error: 'A suspension note is required.',
        success: null,
      });
      return;
    }

    await runMutation(
      () => suspendConnectorPromotion(venueId, trimmed),
      'Connector promotion suspended.',
    );
  }

  const canRequest = canOperate
    && capabilityClass === 'execution_capable'
    && promotionStatus !== 'pending_review'
    && promotionStatus !== 'approved';
  const canApprove = isAdmin && promotionStatus === 'pending_review';
  const canReject = isAdmin && promotionStatus === 'pending_review';
  const canSuspend = isAdmin && promotionStatus === 'approved';

  return (
    <div className="stack stack--compact">
      <div className="button-row">
        {canRequest ? (
          <button
            className="button"
            disabled={state.loading}
            onClick={() => void handleRequest()}
            type="button"
          >
            {state.loading ? 'Submitting request...' : 'Request Promotion Review'}
          </button>
        ) : null}
        {canApprove ? (
          <button
            className="button"
            disabled={state.loading}
            onClick={() => void handleApprove()}
            type="button"
          >
            {state.loading ? 'Approving...' : 'Approve For Live'}
          </button>
        ) : null}
        {canReject ? (
          <button
            className="button"
            disabled={state.loading}
            onClick={() => void handleReject()}
            type="button"
          >
            {state.loading ? 'Rejecting...' : 'Reject'}
          </button>
        ) : null}
        {canSuspend ? (
          <button
            className="button"
            disabled={state.loading}
            onClick={() => void handleSuspend()}
            type="button"
          >
            {state.loading ? 'Suspending...' : 'Suspend'}
          </button>
        ) : null}
      </div>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for connector promotion actions.</p> : null}
      {canOperate && capabilityClass !== 'execution_capable' ? (
        <p className="feedback feedback--warning">Only execution-capable connectors can enter live-promotion review.</p>
      ) : null}
      {canOperate && !isAdmin && promotionStatus === 'pending_review' ? (
        <p className="feedback feedback--warning">Admin approval is required to approve or reject connector promotion.</p>
      ) : null}
    </div>
  );
}
