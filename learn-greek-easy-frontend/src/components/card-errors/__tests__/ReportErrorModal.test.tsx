/**
 * ReportErrorModal Component Tests
 *
 * Tests for the ReportErrorModal component, covering:
 * - Submit button disabled at <10 chars / enabled at 10+
 * - Trim-to-9 chars shows a validation toast
 * - 409 duplicate -> pending toast (not generic error toast)
 * - Success resets form state and calls onClose
 * - canSubmit matches runtime validation (consistent)
 */

import React from 'react';

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import { cardErrorAPI } from '@/services/cardErrorAPI';

import { ReportErrorModal } from '../ReportErrorModal';

// ── Toast mock ─────────────────────────────────────────────────────────────────
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({ toasts: [], toast: mockToast, dismiss: vi.fn() }),
}));

// ── Analytics mock ─────────────────────────────────────────────────────────────
vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    track: vi.fn(),
  };
});

// ── Error reporting mock ───────────────────────────────────────────────────────
vi.mock('@/lib/errorReporting', () => ({
  reportAPIError: vi.fn(),
}));

// ── cardErrorAPI mock ──────────────────────────────────────────────────────────
vi.mock('@/services/cardErrorAPI', () => ({
  cardErrorAPI: {
    create: vi.fn(),
  },
}));

// ── Test helpers ───────────────────────────────────────────────────────────────

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  cardId: 'card-uuid-1',
  cardType: 'WORD' as const,
};

function renderModal(props: Partial<React.ComponentProps<typeof ReportErrorModal>> = {}) {
  return renderWithProviders(<ReportErrorModal {...defaultProps} {...props} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ReportErrorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Submit button disabled state — length threshold', () => {
    it('submit button is disabled when description is empty', () => {
      renderModal();
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).toBeDisabled();
    });

    it('submit button is disabled when description has 9 chars', async () => {
      const user = userEvent.setup();
      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '123456789');
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).toBeDisabled();
    });

    it('submit button is enabled when description has exactly 10 chars', async () => {
      const user = userEvent.setup();
      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '1234567890');
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();
    });

    it('submit button is enabled when description has more than 10 chars', async () => {
      const user = userEvent.setup();
      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'This is a long enough description');
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  describe('Trim-to-9 shows validation toast', () => {
    it('shows a destructive validation toast when input trims to <10 chars and form is submitted', async () => {
      // Build a string that is raw-length >= 10 but trims to < 10.
      // " 123456789" is 10 chars raw, trims to "123456789" which is 9 chars.
      const user = userEvent.setup();
      renderModal();
      const textarea = screen.getByRole('textbox');
      // Type 10 chars where trimmed result is 9: leading space + 9 digits
      await user.type(textarea, ' 123456789');

      // The submit button should be enabled (raw length = 10)
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();

      // Submit the form
      await user.click(submitBtn);

      // Should show validation toast (trimmed is only 9 chars)
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });

      // API should NOT have been called
      expect(cardErrorAPI.create).not.toHaveBeenCalled();
    });
  });

  describe('409 duplicate -> pending toast', () => {
    it('shows pending review toast on 409 conflict, not a generic error', async () => {
      const user = userEvent.setup();
      vi.mocked(cardErrorAPI.create).mockRejectedValueOnce({ status: 409 });

      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'This card has a typo in the translation');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });

      // The toast title should reference "pending" / "previous feedback" — not a generic error
      const call = mockToast.mock.calls[0][0] as { title?: string; variant?: string };
      expect(call.title).toMatch(/pending|previous/i);
    });
  });

  describe('Success — resets form and calls onClose', () => {
    it('resets description and calls onClose on successful submit', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      vi.mocked(cardErrorAPI.create).mockResolvedValueOnce({
        id: 'report-1',
        card_id: 'card-uuid-1',
        card_type: 'WORD',
        description: 'This card has a typo in the translation',
        status: 'PENDING',
        admin_notes: null,
        resolved_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      renderModal({ onClose });
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'This card has a typo in the translation');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });

      // Success toast should have been shown (no destructive variant)
      expect(mockToast).toHaveBeenCalledWith(
        expect.not.objectContaining({ variant: 'destructive' })
      );
    });

    it('calls cardErrorAPI.create with trimmed description and correct card data', async () => {
      const user = userEvent.setup();

      vi.mocked(cardErrorAPI.create).mockResolvedValueOnce({
        id: 'report-2',
        card_id: 'card-uuid-1',
        card_type: 'WORD',
        description: 'this is a typo',
        status: 'PENDING',
        admin_notes: null,
        resolved_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      renderModal({ cardId: 'card-uuid-1', cardType: 'WORD' });
      const textarea = screen.getByRole('textbox');
      // Type with surrounding whitespace to verify trimming
      await user.type(textarea, '  this is a typo  ');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(cardErrorAPI.create).toHaveBeenCalledWith({
          card_id: 'card-uuid-1',
          card_type: 'WORD',
          description: 'this is a typo',
        });
      });
    });

    it('textarea is empty after successful submission when modal is reopened', async () => {
      const user = userEvent.setup();

      vi.mocked(cardErrorAPI.create).mockResolvedValueOnce({
        id: 'report-3',
        card_id: 'card-uuid-1',
        card_type: 'WORD',
        description: 'Translation is wrong for this word',
        status: 'PENDING',
        admin_notes: null,
        resolved_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const onClose = vi.fn();
      const { rerender } = renderModal({ onClose });
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Translation is wrong for this word');

      expect(textarea).toHaveValue('Translation is wrong for this word');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      // Re-render with modal still open to inspect reset state
      rerender(
        <ReportErrorModal isOpen={true} onClose={onClose} cardId="card-uuid-1" cardType="WORD" />
      );

      // After reopen the textarea should start empty (state was reset by handleClose)
      const textareaAfter = screen.getByRole('textbox');
      expect(textareaAfter).toHaveValue('');
    });
  });

  describe('canSubmit consistency', () => {
    it('canSubmit is false (button disabled) when description length equals 9', async () => {
      const user = userEvent.setup();
      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'aaaaaaaaa'); // 9 chars
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      // Must be disabled — canSubmit requires >= 10
      expect(submitBtn).toBeDisabled();
    });

    it('canSubmit is true (button enabled) when description length equals 10', async () => {
      const user = userEvent.setup();
      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'aaaaaaaaaa'); // 10 chars
      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();
    });

    it('canSubmit becomes false again while submitting (button disabled during async call)', async () => {
      const user = userEvent.setup();
      // Never resolve to keep the submit pending
      vi.mocked(cardErrorAPI.create).mockReturnValueOnce(new Promise(() => {}));

      renderModal();
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'This is long enough to submit');

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      expect(submitBtn).not.toBeDisabled();

      await user.click(submitBtn);

      // While the API call is in-flight, the button should be disabled (isSubmitting=true)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled();
      });
    });
  });

  describe('Cancel button', () => {
    it('calls onClose when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      renderModal({ onClose });

      const cancelBtn = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
