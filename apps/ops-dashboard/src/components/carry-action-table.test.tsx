import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CarryActionTable } from './carry-action-table';
import { OperatorProvider } from './operator-context';
import { createCarryAction, createDashboardSession } from '../test/fixtures';

const {
  refresh,
  approveCarryAction,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  approveCarryAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  approveCarryAction,
}));

describe('CarryActionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows operators to approve executable carry recommendations', async () => {
    approveCarryAction.mockResolvedValueOnce({});

    render(
      <OperatorProvider session={createDashboardSession()}>
        <CarryActionTable actions={[createCarryAction()]} />
      </OperatorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve + Queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve and queue' }));

    await waitFor(() => {
      expect(approveCarryAction).toHaveBeenCalledWith('carry-action-1');
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
