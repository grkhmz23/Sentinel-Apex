import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatorProvider } from './operator-context';
import { SubmissionRangerActions } from './submission-ranger-actions';
import { createDashboardSession, createSubmissionDossier } from '../test/fixtures';

const {
  refresh,
  createRangerVault,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  createRangerVault: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  createRangerVault,
  createRangerLpMetadata: vi.fn(),
  addRangerAdaptor: vi.fn(),
  initializeRangerStrategy: vi.fn(),
  depositRangerStrategy: vi.fn(),
  withdrawRangerStrategy: vi.fn(),
}));

describe('SubmissionRangerActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a Ranger vault from the dashboard form', async () => {
    createRangerVault.mockResolvedValueOnce({
      vaultId: 'vault-1',
      vaultAddress: 'vault-address-1',
      shareTokenMint: 'lp-mint-1',
      signature: 'sig-1',
      adminPublicKey: 'admin-1',
      managerPublicKey: 'manager-1',
    });

    render(
      <OperatorProvider
        session={createDashboardSession({
          operator: {
            ...createDashboardSession().operator,
            role: 'admin',
          },
        })}
      >
        <SubmissionRangerActions dossier={createSubmissionDossier()} />
      </OperatorProvider>,
    );

    fireEvent.change(screen.getByLabelText('Asset Mint'), {
      target: { value: 'USDCMint111111111111111111111111111111111' },
    });
    fireEvent.change(screen.getByLabelText('Max Cap'), {
      target: { value: '18446744073709551615' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Ranger Vault' }));

    await waitFor(() => {
      expect(createRangerVault).toHaveBeenCalledWith(
        expect.objectContaining({
          assetMint: 'USDCMint111111111111111111111111111111111',
          maxCap: '18446744073709551615',
          strategyId: 'apex-usdc-delta-neutral-carry',
          updateSubmissionDossier: true,
        }),
      );
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps admin-only actions disabled for non-admin operators', () => {
    render(
      <OperatorProvider session={createDashboardSession()}>
        <SubmissionRangerActions dossier={createSubmissionDossier()} />
      </OperatorProvider>,
    );

    expect(screen.getByRole('button', { name: 'Create Ranger Vault' })).toBeDisabled();
    expect(screen.getByText(/Admin role is required for vault creation/i)).toBeInTheDocument();
  });
});
