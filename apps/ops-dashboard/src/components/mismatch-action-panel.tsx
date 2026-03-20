'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type {
  RuntimeMismatchDetailView,
  RuntimeRemediationActionType,
} from '@sentinel-apex/runtime';

import { useOperator } from './operator-context';
import {
  canAcknowledge,
  canRecover,
  canReopen,
  canResolve,
  canRunRemediation,
  canVerify,
} from '../lib/mismatch-actions';
import { postMismatchAction } from '../lib/runtime-api.client';

export function MismatchActionPanel(
  { detail }: { detail: RuntimeMismatchDetailView },
): JSX.Element {
  const router = useRouter();
  const { actorId } = useOperator();
  const [summary, setSummary] = useState('');
  const [verificationOutcome, setVerificationOutcome] = useState<'verified' | 'failed'>('verified');
  const [remediationType, setRemediationType] = useState<RuntimeRemediationActionType>(
    detail.recommendedRemediationTypes[0] ?? 'rebuild_projections',
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });

  async function runAction(
    action: 'acknowledge' | 'recover' | 'resolve' | 'verify' | 'reopen' | 'remediate',
    confirmationMessage: string,
  ): Promise<void> {
    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setPendingAction(action);
    setFeedback({ error: null, success: null });

    try {
      await postMismatchAction(detail.mismatch.id, action, {
        actorId,
        summary,
        verificationOutcome,
        remediationType,
      });
      setPendingAction(null);
      setFeedback({ error: null, success: `Action "${action}" completed.` });
      router.refresh();
    } catch (error) {
      setPendingAction(null);
      setFeedback({
        error: error instanceof Error ? error.message : 'Action failed.',
        success: null,
      });
    }
  }

  const status = detail.mismatch.status;
  const actorMissing = actorId.trim() === '';
  const controlsDisabled = pendingAction !== null || actorMissing;

  return (
    <div className="action-panel">
      <label className="field">
        <span>Operator Summary</span>
        <textarea
          className="textarea"
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Optional context for the action."
          rows={4}
          value={summary}
        />
      </label>

      <label className="field">
        <span>Verification Outcome</span>
        <select
          className="select"
          onChange={(event) => setVerificationOutcome(event.target.value as 'verified' | 'failed')}
          value={verificationOutcome}
        >
          <option value="verified">verified</option>
          <option value="failed">failed</option>
        </select>
      </label>

      <label className="field">
        <span>Remediation Type</span>
        <select
          className="select"
          onChange={(event) => setRemediationType(event.target.value as RuntimeRemediationActionType)}
          value={remediationType}
        >
          {detail.recommendedRemediationTypes.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <div className="button-grid">
        <button
          className="button"
          disabled={controlsDisabled || !canAcknowledge(status)}
          onClick={() => void runAction('acknowledge', 'Acknowledge this mismatch?')}
          type="button"
        >
          {pendingAction === 'acknowledge' ? 'Acknowledging...' : 'Acknowledge'}
        </button>
        <button
          className="button"
          disabled={controlsDisabled || !canRecover(status)}
          onClick={() => void runAction('recover', 'Move this mismatch into recovery?')}
          type="button"
        >
          {pendingAction === 'recover' ? 'Starting recovery...' : 'Recover'}
        </button>
        <button
          className="button"
          disabled={controlsDisabled || !canResolve(status)}
          onClick={() => void runAction('resolve', 'Resolve this mismatch?')}
          type="button"
        >
          {pendingAction === 'resolve' ? 'Resolving...' : 'Resolve'}
        </button>
        <button
          className="button"
          disabled={controlsDisabled || !canVerify(status)}
          onClick={() => void runAction('verify', 'Apply verification outcome to this mismatch?')}
          type="button"
        >
          {pendingAction === 'verify' ? 'Verifying...' : 'Verify'}
        </button>
        <button
          className="button button--secondary"
          disabled={controlsDisabled || !canReopen(status)}
          onClick={() => void runAction('reopen', 'Reopen this mismatch?')}
          type="button"
        >
          {pendingAction === 'reopen' ? 'Reopening...' : 'Reopen'}
        </button>
        <button
          className="button button--secondary"
          disabled={controlsDisabled || !canRunRemediation(detail, remediationType)}
          onClick={() => void runAction('remediate', 'Queue the selected remediation action?')}
          type="button"
        >
          {pendingAction === 'remediate' ? 'Queueing remediation...' : 'Run Remediation'}
        </button>
      </div>

      {feedback.error !== null ? <p className="feedback feedback--error">{feedback.error}</p> : null}
      {feedback.success !== null ? <p className="feedback feedback--success">{feedback.success}</p> : null}
      {actorMissing ? <p className="feedback feedback--warning">Set an operator ID before running actions.</p> : null}
    </div>
  );
}
