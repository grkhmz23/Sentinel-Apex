'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { TreasuryActionView } from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import { approveTreasuryAction, executeTreasuryAction } from '../lib/runtime-api.client';

export function TreasuryActionTable(
  { actions }: { actions: TreasuryActionView[] },
): JSX.Element {
  const router = useRouter();
  const { canOperate, isAdmin } = useOperator();
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(action: TreasuryActionView): Promise<void> {
    setLoadingActionId(action.id);
    setError(null);
    setMessage(null);

    try {
      await approveTreasuryAction(action.id);
      setMessage(`Approved treasury action ${action.id}.`);
      router.refresh();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Treasury approval failed.');
    } finally {
      setLoadingActionId(null);
    }
  }

  async function handleExecute(action: TreasuryActionView): Promise<void> {
    setLoadingActionId(action.id);
    setError(null);
    setMessage(null);

    try {
      await executeTreasuryAction(action.id);
      setMessage(`Queued treasury execution for action ${action.id}.`);
      router.refresh();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Treasury execution failed.');
    } finally {
      setLoadingActionId(null);
    }
  }

  return (
    <div className="stack">
      {error !== null ? <p className="feedback feedback--error">{error}</p> : null}
      {message !== null ? <p className="feedback feedback--success">{message}</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Status</th>
            <th>Readiness</th>
            <th>Venue</th>
            <th>Mode</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => {
            const approvalBlocked = action.approvalRequirement === 'admin' && !isAdmin;
            const canApprove = canOperate && action.status === 'recommended' && action.executable && !approvalBlocked;
            const canExecute = canOperate && action.status === 'approved' && action.executable && !approvalBlocked;

            return (
              <tr key={action.id}>
                <td>{action.actionType}</td>
                <td>{action.status}</td>
                <td>
                  {action.readiness}
                  {action.blockedReasons.length > 0 ? `: ${action.blockedReasons.map((reason) => reason.message).join('; ')}` : ''}
                </td>
                <td>{action.venueName ?? action.venueId ?? 'Reserve'}</td>
                <td>{action.venueMode}</td>
                <td>{action.amountUsd}</td>
                <td>{action.reasonCode}</td>
                <td>
                  <div className="button-row">
                    <button
                      className="button button--secondary"
                      disabled={!canApprove || loadingActionId === action.id}
                      onClick={() => void handleApprove(action)}
                      type="button"
                    >
                      {loadingActionId === action.id ? 'Working...' : 'Approve'}
                    </button>
                    <button
                      className="button"
                      disabled={!canExecute || loadingActionId === action.id}
                      onClick={() => void handleExecute(action)}
                      type="button"
                    >
                      {loadingActionId === action.id ? 'Working...' : 'Execute'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
