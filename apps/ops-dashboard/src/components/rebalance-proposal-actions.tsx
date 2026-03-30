'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useOperator } from './operator-context';
import {
  approveRebalanceProposal,
  rejectRebalanceProposal,
} from '../lib/runtime-api.client';

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function RebalanceProposalActions(
  { proposalId, status }: { proposalId: string; status: string },
): JSX.Element {
  const router = useRouter();
  const { canOperate } = useOperator();
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleApprove(): Promise<void> {
    if (!window.confirm('Approve this rebalance proposal and queue explicit execution on the runtime command rail?')) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await approveRebalanceProposal(proposalId);
      setState({
        loading: false,
        error: null,
        success: 'Rebalance proposal approved and queued.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Rebalance proposal approval failed.',
        success: null,
      });
    }
  }

  async function handleReject(): Promise<void> {
    const reason = window.prompt('Reject reason', 'Rejected by operator.');
    if (reason === null) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      await rejectRebalanceProposal(proposalId, reason);
      setState({
        loading: false,
        error: null,
        success: 'Rebalance proposal rejected.',
      });
      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Rebalance proposal rejection failed.',
        success: null,
      });
    }
  }

  const actionable = status === 'proposed';

  return (
    <div className="button-row">
      <button
        className="button"
        disabled={state.loading || !canOperate || !actionable}
        onClick={() => void handleApprove()}
        type="button"
      >
        {state.loading ? 'Submitting...' : 'Approve Proposal'}
      </button>
      <button
        className="button button--secondary"
        disabled={state.loading || !canOperate || !actionable}
        onClick={() => void handleReject()}
        type="button"
      >
        Reject Proposal
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for rebalance actions.</p> : null}
    </div>
  );
}
