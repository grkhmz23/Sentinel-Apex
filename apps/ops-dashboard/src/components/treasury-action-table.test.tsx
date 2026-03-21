import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatorProvider } from './operator-context';
import { TreasuryActionTable } from './treasury-action-table';
import { createDashboardSession, createTreasuryAction } from '../test/fixtures';

const {
  refresh,
  approveTreasuryAction,
  executeTreasuryAction,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  approveTreasuryAction: vi.fn(),
  executeTreasuryAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  approveTreasuryAction,
  executeTreasuryAction,
}));

describe('TreasuryActionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows operators to approve and execute actionable simulated treasury actions', async () => {
    approveTreasuryAction.mockResolvedValueOnce({});
    executeTreasuryAction.mockResolvedValueOnce({});

    render(
      <OperatorProvider session={createDashboardSession()}>
        <TreasuryActionTable
          actions={[
            createTreasuryAction(),
            createTreasuryAction({
              id: 'treasury-action-2',
              status: 'approved',
            }),
          ]}
        />
      </OperatorProvider>,
    );

    const approveButtons = screen.getAllByRole('button', { name: /Approve/i });
    const executeButtons = screen.getAllByRole('button', { name: /Execute/i });
    const firstApproveButton = approveButtons[0];
    const secondExecuteButton = executeButtons[1];

    expect(firstApproveButton).toBeDefined();
    expect(secondExecuteButton).toBeDefined();

    fireEvent.click(firstApproveButton as HTMLElement);
    fireEvent.click(secondExecuteButton as HTMLElement);

    await waitFor(() => {
      expect(approveTreasuryAction).toHaveBeenCalledWith('treasury-action-1');
      expect(executeTreasuryAction).toHaveBeenCalledWith('treasury-action-2');
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  it('blocks non-admin approval for admin-required actions', () => {
    render(
      <OperatorProvider session={createDashboardSession()}>
        <TreasuryActionTable
          actions={[
            createTreasuryAction({
              approvalRequirement: 'admin',
            }),
          ]}
        />
      </OperatorProvider>,
    );

    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Execute' })).toBeDisabled();
  });
});
