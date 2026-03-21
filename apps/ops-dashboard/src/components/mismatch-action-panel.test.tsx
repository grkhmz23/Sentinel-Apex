import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MismatchActionPanel } from './mismatch-action-panel';
import { OperatorProvider } from './operator-context';
import { createDashboardSession, createMismatchDetail } from '../test/fixtures';

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
      <OperatorProvider session={createDashboardSession()}>
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
      <OperatorProvider session={createDashboardSession()}>
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

  it('renders read-only gating for viewer sessions', () => {
    const session = createDashboardSession({
      operator: {
        ...createDashboardSession().operator,
        role: 'viewer',
      },
    });

    render(
      <OperatorProvider session={session}>
        <MismatchActionPanel detail={createMismatchDetail()} />
      </OperatorProvider>,
    );

    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeDisabled();
    expect(screen.getByText('Ops User does not have permission to run mismatch actions.')).toBeInTheDocument();
  });
});
