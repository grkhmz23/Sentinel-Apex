import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatorProvider } from './operator-context';
import { TreasuryActions } from './treasury-actions';
import { createDashboardSession } from '../test/fixtures';

const {
  refresh,
  triggerTreasuryEvaluation,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  triggerTreasuryEvaluation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  triggerTreasuryEvaluation,
}));

describe('TreasuryActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('queues a treasury evaluation and refreshes the page', async () => {
    triggerTreasuryEvaluation.mockResolvedValueOnce({});

    render(
      <OperatorProvider session={createDashboardSession()}>
        <TreasuryActions />
      </OperatorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run Treasury Evaluation' }));

    await waitFor(() => {
      expect(triggerTreasuryEvaluation).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('disables treasury action controls for viewer sessions', () => {
    render(
      <OperatorProvider
        session={createDashboardSession({
          operator: {
            ...createDashboardSession().operator,
            role: 'viewer',
          },
        })}
      >
        <TreasuryActions />
      </OperatorProvider>,
    );

    expect(screen.getByRole('button', { name: 'Run Treasury Evaluation' })).toBeDisabled();
    expect(screen.getByText('Your role is read-only for treasury actions.')).toBeInTheDocument();
  });
});
