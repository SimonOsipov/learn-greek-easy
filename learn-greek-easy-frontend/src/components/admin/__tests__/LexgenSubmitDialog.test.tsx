// LEXGEN-14-04 — QA Mode B: two-outcome render/interaction test for LexgenSubmitDialog.
//
// Coverage: renders form; needs_review → success toast; rejected → hard-reject toast
// with reason. Mocks adminAPI.submitLexgenProposal at the module boundary.
// Uses renderWithProviders (QueryClient + i18n + Toaster).

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';

import { LexgenSubmitDialog } from '../LexgenSubmitDialog';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockSubmitLexgenProposal } = vi.hoisted(() => ({
  mockSubmitLexgenProposal: vi.fn(),
}));

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    submitLexgenProposal: mockSubmitLexgenProposal,
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderDialog(onOpenChange = vi.fn(), onSubmitted = vi.fn()) {
  return renderWithProviders(
    <LexgenSubmitDialog open={true} onOpenChange={onOpenChange} onSubmitted={onSubmitted} />
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LexgenSubmitDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the form with lemma input and submit button', () => {
    renderDialog();
    expect(screen.getByTestId('lexgen-submit-input')).toBeInTheDocument();
    expect(screen.getByTestId('lexgen-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('lexgen-submit-cancel')).toBeInTheDocument();
  });

  it('submit button is disabled when lemma is empty', () => {
    renderDialog();
    expect(screen.getByTestId('lexgen-submit-button')).toBeDisabled();
  });

  it('submit button enables when lemma is non-empty', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByTestId('lexgen-submit-input'), 'βιβλίο');
    expect(screen.getByTestId('lexgen-submit-button')).toBeEnabled();
  });

  describe('outcome: needs_review (attested lemma → queued for inbox)', () => {
    it('shows success toast and calls onSubmitted / closes dialog', async () => {
      const onOpenChange = vi.fn();
      const onSubmitted = vi.fn();
      mockSubmitLexgenProposal.mockResolvedValue({ id: 'abc', status: 'needs_review' });

      const user = userEvent.setup();
      renderDialog(onOpenChange, onSubmitted);

      await user.type(screen.getByTestId('lexgen-submit-input'), 'βιβλίο');
      await user.click(screen.getByTestId('lexgen-submit-button'));

      // Success toast must appear (rendered in visible div + aria-live region)
      await waitFor(() => {
        const matches = screen.getAllByText(/submitted for review/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });

      expect(onSubmitted).toHaveBeenCalledOnce();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('passes the trimmed lemma to submitLexgenProposal', async () => {
      mockSubmitLexgenProposal.mockResolvedValue({ id: 'abc', status: 'needs_review' });

      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByTestId('lexgen-submit-input'), '  κόσμος  ');
      await user.click(screen.getByTestId('lexgen-submit-button'));

      await waitFor(() => {
        expect(mockSubmitLexgenProposal).toHaveBeenCalledWith('κόσμος');
      });
    });
  });

  describe('outcome: rejected (never-invent hard rejection)', () => {
    it('shows destructive rejection toast with rejection_reason and stays open', async () => {
      const onOpenChange = vi.fn();
      mockSubmitLexgenProposal.mockResolvedValue({
        id: 'xyz',
        status: 'rejected',
        rejection_reason: 'Word not found in reference sources.',
      });

      const user = userEvent.setup();
      renderDialog(onOpenChange);

      await user.type(screen.getByTestId('lexgen-submit-input'), 'σπανιόλα');
      await user.click(screen.getByTestId('lexgen-submit-button'));

      // Hard-reject toast must appear with the reason
      await waitFor(() => {
        expect(screen.getByText('Word not found in reference sources.')).toBeInTheDocument();
      });

      // Dialog must NOT close on rejection
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('shows fallback text when rejection_reason is missing', async () => {
      mockSubmitLexgenProposal.mockResolvedValue({
        id: 'xyz',
        status: 'rejected',
        rejection_reason: null,
      });

      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByTestId('lexgen-submit-input'), 'σπανιόλα');
      await user.click(screen.getByTestId('lexgen-submit-button'));

      await waitFor(() => {
        // Fallback string from i18n (toast renders in both visible div + aria-live region)
        const matches = screen.getAllByText(/no evidence found/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('outcome: error (network / 5xx)', () => {
    it('shows error toast on mutation error', async () => {
      mockSubmitLexgenProposal.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      renderDialog();

      await user.type(screen.getByTestId('lexgen-submit-input'), 'βιβλίο');
      await user.click(screen.getByTestId('lexgen-submit-button'));

      await waitFor(() => {
        const matches = screen.getAllByText(/submission failed/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
