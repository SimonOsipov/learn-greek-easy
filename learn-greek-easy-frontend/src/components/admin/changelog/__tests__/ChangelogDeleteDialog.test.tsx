/**
 * ChangelogDeleteDialog Component Tests
 *
 * Covers:
 * - null entry renders null (nothing in the DOM)
 * - confirm button calls deleteEntry + shows success toast + calls onOpenChange(false)
 * - error thrown by deleteEntry shows error toast + dialog stays open
 * - buttons are disabled while isDeleting=true
 * - entry title is displayed in the dialog body
 */

import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { ChangelogDeleteDialog } from '../ChangelogDeleteDialog';
import type { ChangelogEntryAdmin } from '@/types/changelog';
import i18n from '@/i18n';

// ── Wrapper ─────────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// ── Mocks ────────────────────────────────────────────────────────────────────────

const mockDeleteEntry = vi.fn();
let mockIsDeleting = false;

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: () => ({
    deleteEntry: mockDeleteEntry,
    isDeleting: mockIsDeleting,
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// ── Factory ───────────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ChangelogEntryAdmin> = {}): ChangelogEntryAdmin {
  return {
    id: 'entry-abc-123',
    title_en: 'New Greek Alphabet Feature',
    title_ru: 'Новая функция греческого алфавита',
    content_en: 'Some content here',
    content_ru: 'Некоторое содержимое',
    tag: 'new_feature',
    version: null,
    created_at: '2024-03-15T10:00:00Z',
    updated_at: '2024-03-15T10:00:00Z',
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────────

describe('ChangelogDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDeleting = false;
    mockDeleteEntry.mockResolvedValue(undefined);
  });

  // ── null entry renders null ────────────────────────────────────────────────────

  describe('null entry', () => {
    it('renders nothing when entry is null', () => {
      const { container } = render(
        <ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={null} />,
        { wrapper }
      );
      // The component returns null before the Dialog is mounted
      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('changelog-delete-dialog')).not.toBeInTheDocument();
    });
  });

  // ── Rendering with a valid entry ────────────────────────────────────────────────

  describe('with a valid entry', () => {
    it('renders the dialog content', () => {
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });
      expect(screen.getByTestId('changelog-delete-dialog')).toBeInTheDocument();
    });

    it('shows the entry title_en in the dialog body', () => {
      const entry = makeEntry({ title_en: 'Super Important Feature' });
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={entry} />, {
        wrapper,
      });
      expect(screen.getByText('Super Important Feature')).toBeInTheDocument();
    });
  });

  // ── Confirm path: success ───────────────────────────────────────────────────────

  describe('confirm — success path', () => {
    it('calls deleteEntry with entry.id when confirm is clicked', async () => {
      const user = userEvent.setup();
      const entry = makeEntry({ id: 'entry-abc-123' });
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={entry} />, {
        wrapper,
      });

      await user.click(screen.getByTestId('changelog-delete-confirm'));

      await waitFor(() => {
        expect(mockDeleteEntry).toHaveBeenCalledOnce();
        expect(mockDeleteEntry).toHaveBeenCalledWith('entry-abc-123');
      });
    });

    it('shows success toast after successful delete', async () => {
      const user = userEvent.setup();
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });

      await user.click(screen.getByTestId('changelog-delete-confirm'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledOnce();
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: expect.any(String) })
        );
        // Ensure it is NOT a destructive toast
        const call = mockToast.mock.calls[0][0] as { variant?: string };
        expect(call.variant).not.toBe('destructive');
      });
    });

    it('calls onOpenChange(false) to close the dialog after success', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <ChangelogDeleteDialog open={true} onOpenChange={onOpenChange} entry={makeEntry()} />,
        { wrapper }
      );

      await user.click(screen.getByTestId('changelog-delete-confirm'));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  // ── Confirm path: error ─────────────────────────────────────────────────────────

  describe('confirm — error path', () => {
    it('shows destructive error toast when deleteEntry throws', async () => {
      const user = userEvent.setup();
      mockDeleteEntry.mockRejectedValue(new Error('Network failure'));

      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });

      await user.click(screen.getByTestId('changelog-delete-confirm'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledOnce();
        const call = mockToast.mock.calls[0][0] as {
          title: string;
          description: string;
          variant: string;
        };
        expect(call.variant).toBe('destructive');
        expect(call.description).toBe('Network failure');
      });
    });

    it('does NOT call onOpenChange(false) when deleteEntry throws', async () => {
      const user = userEvent.setup();
      mockDeleteEntry.mockRejectedValue(new Error('Server error'));
      const onOpenChange = vi.fn();

      render(
        <ChangelogDeleteDialog open={true} onOpenChange={onOpenChange} entry={makeEntry()} />,
        { wrapper }
      );

      await user.click(screen.getByTestId('changelog-delete-confirm'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // Dialog should remain open — onOpenChange(false) must NOT have been called
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('includes "Unknown error" description when a non-Error is thrown', async () => {
      const user = userEvent.setup();
      // Throw a non-Error value (e.g. a plain string)
      mockDeleteEntry.mockRejectedValue('plain string rejection');

      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });

      await user.click(screen.getByTestId('changelog-delete-confirm'));

      await waitFor(() => {
        const call = mockToast.mock.calls[0][0] as { description: string };
        expect(call.description).toBe('Unknown error');
      });
    });
  });

  // ── Buttons disabled while deleting ────────────────────────────────────────────

  describe('buttons disabled state', () => {
    it('cancel button is disabled when isDeleting=true', () => {
      mockIsDeleting = true;
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });
      expect(screen.getByTestId('changelog-delete-cancel')).toBeDisabled();
    });

    it('confirm button is disabled when isDeleting=true', () => {
      mockIsDeleting = true;
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });
      expect(screen.getByTestId('changelog-delete-confirm')).toBeDisabled();
    });

    it('cancel button is enabled when isDeleting=false', () => {
      mockIsDeleting = false;
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });
      expect(screen.getByTestId('changelog-delete-cancel')).not.toBeDisabled();
    });

    it('confirm button is enabled when isDeleting=false', () => {
      mockIsDeleting = false;
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });
      expect(screen.getByTestId('changelog-delete-confirm')).not.toBeDisabled();
    });
  });

  // ── Cancel button ───────────────────────────────────────────────────────────────

  describe('cancel button', () => {
    it('calls onOpenChange(false) when cancel is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <ChangelogDeleteDialog open={true} onOpenChange={onOpenChange} entry={makeEntry()} />,
        { wrapper }
      );

      await user.click(screen.getByTestId('changelog-delete-cancel'));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('does NOT call deleteEntry when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<ChangelogDeleteDialog open={true} onOpenChange={vi.fn()} entry={makeEntry()} />, {
        wrapper,
      });

      await user.click(screen.getByTestId('changelog-delete-cancel'));

      expect(mockDeleteEntry).not.toHaveBeenCalled();
    });
  });
});
