'use client';

import { useState } from 'react';

import { useOptionalOperator } from './operator-context';
import { useOptionalRefresh } from '../lib/navigation-hooks';
import { createEncryptSdkDemoInput } from '../lib/runtime-api.client';

interface MutationState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export function EncryptSdkDemoActions(): JSX.Element {
  const refresh = useOptionalRefresh();
  const operator = useOptionalOperator();
  const canOperate = operator?.canOperate ?? false;
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
    success: null,
  });

  async function handleCreateInput(): Promise<void> {
    if (!window.confirm('Create an Encrypt pre-alpha SDK input using fixed non-sensitive demo values only?')) {
      return;
    }

    setState({
      loading: true,
      error: null,
      success: null,
    });

    try {
      const evidence = await createEncryptSdkDemoInput();
      setState({
        loading: false,
        error: null,
        success: evidence.success
          ? 'SDK demo input created.'
          : `SDK demo recorded failure evidence: ${evidence.errorMessage ?? evidence.errorCode ?? 'request failed'}`,
      });
      refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : 'Encrypt SDK demo request failed.',
        success: null,
      });
    }
  }

  return (
    <div className="button-stack button-stack--align-end">
      <button
        className="button"
        disabled={state.loading || !canOperate}
        onClick={() => void handleCreateInput()}
        type="button"
      >
        {state.loading ? 'Creating demo input...' : 'Create demo ciphertext input'}
      </button>
      {state.error !== null ? <p className="feedback feedback--error">{state.error}</p> : null}
      {state.success !== null ? <p className="feedback feedback--success">{state.success}</p> : null}
      {!canOperate ? <p className="feedback feedback--warning">Your role is read-only for Encrypt SDK demo actions.</p> : null}
    </div>
  );
}
