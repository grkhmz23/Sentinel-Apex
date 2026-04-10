'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { CarryActionView } from '@sentinel-apex/runtime';

import { ConfirmDialog } from './confirm-dialog';
import { useOperator } from './operator-context';
import { StatusBadge } from './status-badge';
import { TableSurface } from './table-surface';
import { carryModeTone, carryReadinessTone, carryStatusTone } from '../lib/carry-display';
import { formatUsd } from '../lib/format';
import { approveCarryAction } from '../lib/runtime-api.client';

export function CarryActionTable(
  { actions }: { actions: CarryActionView[] },
): JSX.Element {
  const router = useRouter();
  const { canOperate, isAdmin } = useOperator();
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<CarryActionView | null>(null);

  async function handleApprove(action: CarryActionView): Promise<void> {
    setLoadingActionId(action.id);
    setError(null);
    setMessage(null);

    try {
      await approveCarryAction(action.id);
      setMessage(`Approved carry action ${action.id} and queued execution.`);
      setPendingAction(null);
      router.refresh();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Carry approval failed.');
    } finally {
      setLoadingActionId(null);
    }
  }

  return (
    <div className="stack">
      {error !== null ? <p className="feedback feedback--error">{error}</p> : null}
      {message !== null ? <p className="feedback feedback--success">{message}</p> : null}
      <TableSurface caption="Execution-ready carry recommendations after policy, optimizer, and runtime gating">
        <div className="workflow-table">
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Status</th>
                <th>Readiness</th>
                <th>Mode</th>
                <th>Notional</th>
                <th>Source</th>
                <th>Controls</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => {
                const approvalBlocked = action.approvalRequirement === 'admin' && !isAdmin;
                const canApprove = canOperate && action.status === 'recommended' && action.executable && !approvalBlocked;

                return (
                  <tr key={action.id}>
                    <td>
                      <div className="workflow-cell">
                        <Link className="workflow-cell__title" href={`/carry/actions/${action.id}`}>{action.actionType}</Link>
                        <span>{action.summary}</span>
                        <div className="pill-row">
                          <span className="pill">{action.id}</span>
                          <span className="pill">{action.approvalRequirement}</span>
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge label={action.status} tone={carryStatusTone(action.status)} /></td>
                    <td>
                      <div className="workflow-cell">
                        <StatusBadge label={action.readiness} tone={carryReadinessTone(action.readiness)} />
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
                      <div className="workflow-cell">
                        <StatusBadge label={action.executionMode} tone={carryModeTone(action.executionMode)} />
                        <span className="workflow-cell__subtle">
                          {action.simulated ? 'simulated connector path' : 'live-capable path'}
                        </span>
                      </div>
                    </td>
                    <td>{formatUsd(action.notionalUsd)}</td>
                    <td>{action.sourceKind}</td>
                    <td>
                      <div className="button-row button-row--stacked">
                        <button
                          className="button"
                          disabled={!canApprove || loadingActionId === action.id}
                          onClick={() => setPendingAction(action)}
                          type="button"
                        >
                          {loadingActionId === action.id ? 'Working...' : 'Approve + Queue'}
                        </button>
                        {!canApprove ? (
                          <span className="workflow-cell__subtle">
                            {approvalBlocked ? 'Admin approval required.' : 'Action is not currently executable.'}
                          </span>
                        ) : null}
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
        busy={pendingAction !== null && loadingActionId === pendingAction.id}
        confirmLabel="Approve and queue"
        description={pendingAction === null
          ? ''
          : `Approve ${pendingAction.actionType} for ${formatUsd(pendingAction.notionalUsd)} and queue execution?`}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction !== null) {
            void handleApprove(pendingAction);
          }
        }}
        open={pendingAction !== null}
        title="Confirm carry action"
      />
    </div>
  );
}
