import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CarryActions } from './carry-actions';
import { OperatorProvider } from './operator-context';
import { createDashboardSession } from '../test/fixtures';

const {
  refresh,
  triggerCarryEvaluation,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  triggerCarryEvaluation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  triggerCarryEvaluation,
}));

describe('CarryActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues a carry evaluation and refreshes the page', async () => {
    triggerCarryEvaluation.mockResolvedValueOnce({});

    render(
      <OperatorProvider session={createDashboardSession()}>
        <CarryActions />
      </OperatorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run Carry Evaluation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Queue carry evaluation' }));

    await waitFor(() => {
      expect(triggerCarryEvaluation).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('disables carry action controls for viewer sessions', () => {
    render(
      <OperatorProvider
        session={createDashboardSession({
          operator: {
            ...createDashboardSession().operator,
            role: 'viewer',
          },
        })}
      >
        <CarryActions />
      </OperatorProvider>,
    );

    expect(screen.getByRole('button', { name: 'Run Carry Evaluation' })).toBeDisabled();
    expect(screen.getByText('Your role is read-only for carry actions.')).toBeInTheDocument();
  });
});
