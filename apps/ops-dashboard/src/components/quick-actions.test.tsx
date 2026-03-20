import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatorProvider } from './operator-context';
import { QuickActions } from './quick-actions';

const {
  refresh,
  triggerCycle,
  rebuildProjections,
  triggerReconciliation,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  triggerCycle: vi.fn(),
  rebuildProjections: vi.fn(),
  triggerReconciliation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  triggerCycle,
  rebuildProjections,
  triggerReconciliation,
}));

describe('QuickActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('calls the correct API action and refreshes the page', async () => {
    triggerCycle.mockResolvedValueOnce({});

    render(
      <OperatorProvider defaultActorId="ops-user">
        <QuickActions />
      </OperatorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run Cycle' }));

    await waitFor(() => {
      expect(triggerCycle).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('disables controls while an action is in flight', async () => {
    let resolvePromise: (() => void) | undefined;
    triggerReconciliation.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolvePromise = () => resolve({});
      }),
    );

    render(
      <OperatorProvider defaultActorId="ops-user">
        <QuickActions />
      </OperatorProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run Reconciliation' }));

    expect(screen.getByRole('button', { name: 'Queueing reconciliation...' })).toBeDisabled();

    if (resolvePromise !== undefined) {
      resolvePromise();
    }

    await waitFor(() => {
      expect(screen.getByText('Reconciliation queued.')).toBeInTheDocument();
    });
  });
});
