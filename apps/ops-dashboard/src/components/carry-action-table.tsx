'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { CarryActionView } from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import { StatusBadge } from './status-badge';
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

  async function handleApprove(action: CarryActionView): Promise<void> {
    setLoadingActionId(action.id);
    setError(null);
    setMessage(null);

    try {
      await approveCarryAction(action.id);
      setMessage(`Approved carry action ${action.id} and queued execution.`);
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
                  <div className="stack stack--compact">
                    <Link href={`/carry/actions/${action.id}`}>{action.actionType}</Link>
                    <span className="panel__hint">{action.summary}</span>
                  </div>
                </td>
                <td><StatusBadge label={action.status} tone={carryStatusTone(action.status)} /></td>
                <td>
                  <StatusBadge label={action.readiness} tone={carryReadinessTone(action.readiness)} />
                  {action.blockedReasons.length > 0 ? `: ${action.blockedReasons.map((reason) => reason.message).join('; ')}` : ''}
                </td>
                <td>
                  <div className="stack stack--compact">
                    <StatusBadge label={action.executionMode} tone={carryModeTone(action.executionMode)} />
                    <span className="panel__hint">{action.simulated ? 'simulated connector path' : 'live-capable path'}</span>
                  </div>
                </td>
                <td>{formatUsd(action.notionalUsd)}</td>
                <td>{action.sourceKind}</td>
                <td>
                  <button
                    className="button"
                    disabled={!canApprove || loadingActionId === action.id}
                    onClick={() => void handleApprove(action)}
                    type="button"
                  >
                    {loadingActionId === action.id ? 'Working...' : 'Approve + Queue'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
