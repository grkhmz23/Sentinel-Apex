import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OperatorProvider } from './operator-context';
import { SubmissionRequirementsActions } from './submission-requirements-actions';
import { createDashboardSession, createSubmissionDossier } from '../test/fixtures';

const {
  refresh,
  updateSubmissionDossier,
} = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateSubmissionDossier: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('../lib/runtime-api.client', () => ({
  updateSubmissionDossier,
}));

describe('SubmissionRequirementsActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates strategy documentation and repository review access', async () => {
    updateSubmissionDossier.mockResolvedValueOnce(createSubmissionDossier());

    render(
      <OperatorProvider session={createDashboardSession()}>
        <SubmissionRequirementsActions dossier={createSubmissionDossier()} />
      </OperatorProvider>,
    );

    fireEvent.change(screen.getByLabelText('Strategy Documentation Url'), {
      target: { value: 'https://example.com/updated-strategy-docs' },
    });
    fireEvent.change(screen.getByLabelText('Code Repository Url'), {
      target: { value: 'https://github.com/example/private-repo' },
    });
    fireEvent.change(screen.getByLabelText('Repository Visibility'), {
      target: { value: 'private' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Submission Requirements' }));

    await waitFor(() => {
      expect(updateSubmissionDossier).toHaveBeenCalledWith({
        strategyDocumentationUrl: 'https://example.com/updated-strategy-docs',
        codeRepositoryUrl: 'https://github.com/example/private-repo',
        codeRepositoryVisibility: 'private',
        privateRepoReviewerAdded: false,
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('shows read-only gating for viewer sessions', () => {
    render(
      <OperatorProvider
        session={createDashboardSession({
          operator: {
            ...createDashboardSession().operator,
            role: 'viewer',
          },
        })}
      >
        <SubmissionRequirementsActions dossier={createSubmissionDossier()} />
      </OperatorProvider>,
    );

    expect(screen.getByRole('button', { name: 'Save Submission Requirements' })).toBeDisabled();
    expect(screen.getByText('Your role is read-only for submission requirement updates.')).toBeInTheDocument();
  });
});
