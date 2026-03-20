import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MismatchActionPanel } from './mismatch-action-panel';
import { OperatorProvider } from './operator-context';
import { createMismatchDetail } from '../test/fixtures';

const {
  refresh,
  postMismatchAction,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  postMismatchAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  postMismatchAction,
}));

describe('MismatchActionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('posts remediation actions with operator context and summary', async () => {
    postMismatchAction.mockResolvedValueOnce({});

    render(
      <OperatorProvider defaultActorId="ops-user">
        <MismatchActionPanel detail={createMismatchDetail()} />
      </OperatorProvider>,
    );

    fireEvent.change(screen.getByLabelText('Operator Summary'), {
      target: { value: 'Projection drift confirmed by operator.' },
    });
    fireEvent.change(screen.getByLabelText('Remediation Type'), {
      target: { value: 'run_cycle' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run Remediation' }));

    await waitFor(() => {
      expect(postMismatchAction).toHaveBeenCalledWith(
        'mismatch-1',
        'remediate',
        expect.objectContaining({
          actorId: 'ops-user',
          summary: 'Projection drift confirmed by operator.',
          remediationType: 'run_cycle',
        }),
      );
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('disables action controls while a request is pending', async () => {
    let resolvePromise: (() => void) | undefined;
    postMismatchAction.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePromise = () => resolve({});
      }),
    );

    render(
      <OperatorProvider defaultActorId="ops-user">
        <MismatchActionPanel detail={createMismatchDetail()} />
      </OperatorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));

    expect(screen.getByRole('button', { name: 'Acknowledging...' })).toBeDisabled();

    if (resolvePromise !== undefined) {
      resolvePromise();
    }

    await waitFor(() => {
      expect(screen.getByText('Action "acknowledge" completed.')).toBeInTheDocument();
    });
  });
});
