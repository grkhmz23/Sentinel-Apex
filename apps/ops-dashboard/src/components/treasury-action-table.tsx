'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { TreasuryActionView } from '@sentinel-apex/runtime';

import { ConfirmDialog } from './confirm-dialog';
import { useOperator } from './operator-context';
import { StatusBadge } from './status-badge';
import { TableSurface } from './table-surface';
import { approveTreasuryAction, executeTreasuryAction } from '../lib/runtime-api.client';
import { treasuryModeTone, treasuryReadinessTone, treasuryStatusTone } from '../lib/treasury-display';

export function TreasuryActionTable(
  { actions }: { actions: TreasuryActionView[] },
): JSX.Element {
  const router = useRouter();
  const { canOperate, isAdmin } = useOperator();
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<TreasuryActionView | null>(null);
  const [pendingExecution, setPendingExecution] = useState<TreasuryActionView | null>(null);

  async function handleApprove(action: TreasuryActionView): Promise<void> {
    setLoadingActionId(action.id);
    setError(null);
    setMessage(null);

    try {
      await approveTreasuryAction(action.id);
      setMessage(`Approved treasury action ${action.id}.`);
      setPendingApproval(null);
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
      setPendingExecution(null);
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
      <TableSurface caption="Latest recommendations and reserve alerts">
        <div className="workflow-table">
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
                    <td>
                      <div className="workflow-cell">
                        <Link className="workflow-cell__title" href={`/treasury/actions/${action.id}`}>{action.actionType}</Link>
                        <div className="pill-row">
                          <span className="pill">{action.id}</span>
                          <span className="pill">{action.approvalRequirement}</span>
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge label={action.status} tone={treasuryStatusTone(action.status)} /></td>
                    <td>
                      <div className="workflow-cell">
                        <StatusBadge label={action.readiness} tone={treasuryReadinessTone(action.readiness)} />
                        {action.blockedReasons.length > 0 ? (
                          <div className="pill-row">
                            {action.blockedReasons.map((reason) => (
                              <span className="pill pill--warn" key={reason.code}>{reason.message}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="workflow-cell__subtle">No blocked reasons recorded.</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {action.venueId === null ? (
                        action.venueName ?? 'Reserve'
                      ) : (
                        <Link href={`/treasury/venues/${action.venueId}`}>{action.venueName ?? action.venueId}</Link>
                      )}
                    </td>
                    <td><StatusBadge label={action.venueMode} tone={treasuryModeTone(action.venueMode)} /></td>
                    <td>{action.amountUsd}</td>
                    <td>{action.reasonCode}</td>
                    <td>
                      <div className="button-row button-row--stacked">
                        <button
                          className="button button--secondary"
                          disabled={!canApprove || loadingActionId === action.id}
                          onClick={() => setPendingApproval(action)}
                          type="button"
                        >
                          {loadingActionId === action.id ? 'Working...' : 'Approve'}
                        </button>
                        <button
                          className="button"
                          disabled={!canExecute || loadingActionId === action.id}
                          onClick={() => setPendingExecution(action)}
                          type="button"
                        >
                          {loadingActionId === action.id ? 'Working...' : 'Execute'}
                        </button>
                        {approvalBlocked ? <span className="workflow-cell__subtle">Admin approval required.</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </TableSurface>
      <ConfirmDialog
        busy={pendingApproval !== null && loadingActionId === pendingApproval.id}
        confirmLabel="Approve treasury action"
        description={pendingApproval === null
          ? ''
          : `Approve ${pendingApproval.actionType} for ${pendingApproval.amountUsd} on ${pendingApproval.venueName ?? pendingApproval.venueId ?? 'reserve'}?`}
        onCancel={() => setPendingApproval(null)}
        onConfirm={() => {
          if (pendingApproval !== null) {
            void handleApprove(pendingApproval);
          }
        }}
        open={pendingApproval !== null}
        title="Confirm treasury approval"
      />
      <ConfirmDialog
        busy={pendingExecution !== null && loadingActionId === pendingExecution.id}
        confirmLabel="Execute treasury action"
        description={pendingExecution === null
          ? ''
          : `Queue execution for ${pendingExecution.actionType} on ${pendingExecution.venueName ?? pendingExecution.venueId ?? 'reserve'}?`}
        onCancel={() => setPendingExecution(null)}
        onConfirm={() => {
          if (pendingExecution !== null) {
            void handleExecute(pendingExecution);
          }
        }}
        open={pendingExecution !== null}
        title="Confirm treasury execution"
      />
    </div>
  );
}
