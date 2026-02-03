/**
 * ChangelogEditModal Component Tests
 *
 * Tests for the admin changelog edit modal including:
 * - Modal display (title, hint)
 * - JSON textarea (populated with entry data, editable)
 * - Save button (calls updateEntry, shows success toast, closes modal)
 * - Validation errors (invalid JSON, missing fields, invalid tag)
 * - Cancel button (closes modal)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChangelogEditModal } from '../ChangelogEditModal';

/**
 * Helper to set textarea value and trigger change event.
 * Using fireEvent instead of userEvent.type because userEvent
 * interprets curly braces as keyboard modifiers.
 */
const setTextareaValue = (textarea: HTMLElement, value: string) => {
  fireEvent.change(textarea, { target: { value } });
};
import type { ChangelogEntryAdmin } from '@/types/changelog';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'admin:changelog.edit.title': 'Edit Changelog Entry',
        'admin:changelog.edit.hint': 'Modify JSON and save.',
        'admin:changelog.edit.save': 'Save',
        'admin:changelog.edit.saving': 'Saving...',
        'admin:changelog.edit.cancel': 'Cancel',
        'admin:changelog.edit.success': 'Changelog entry updated',
        'admin:changelog.edit.error': 'Failed to update entry',
        'admin:changelog.validation.invalidJson': 'Invalid JSON format',
        'admin:changelog.validation.missingFields': `Missing required fields: ${options?.fields || ''}`,
        'admin:changelog.validation.invalidTag': 'Invalid tag',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (props: unknown) => mockToast(props),
}));

// Mock store
const mockUpdateEntry = vi.fn();
vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      isSaving: false,
      updateEntry: mockUpdateEntry,
    };
    return selector ? selector(state) : state;
  },
  selectAdminChangelogIsSaving: (state: { isSaving: boolean }) => state.isSaving,
}));

// Factory
const createMockEntry = (overrides: Partial<ChangelogEntryAdmin> = {}): ChangelogEntryAdmin => ({
  id: 'entry-123',
  title_en: 'English Title',
  title_ru: 'Russian Title',
  content_en: 'English content',
  content_ru: 'Russian content',
  tag: 'new_feature',
  created_at: '2026-01-15T10:30:00Z',
  updated_at: '2026-01-15T10:30:00Z',
  ...overrides,
});

describe('ChangelogEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEntry.mockResolvedValue({});
  });

  describe('Modal Display', () => {
    it('should show edit title', () => {
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);
      expect(screen.getByText('Edit Changelog Entry')).toBeInTheDocument();
    });

    it('should show hint text', () => {
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);
      expect(screen.getByText('Modify JSON and save.')).toBeInTheDocument();
    });
  });

  describe('JSON Textarea', () => {
    it('should populate with entry data as JSON', () => {
      const entry = createMockEntry({
        tag: 'bug_fix',
        title_en: 'Bug Fixed',
      });
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={entry} />);

      const textarea = screen.getByTestId('changelog-json-textarea') as HTMLTextAreaElement;
      expect(textarea.value).toContain('"tag": "bug_fix"');
      expect(textarea.value).toContain('"title_en": "Bug Fixed"');
    });

    it('should allow editing JSON content', () => {
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      const textarea = screen.getByTestId('changelog-json-textarea') as HTMLTextAreaElement;
      setTextareaValue(textarea, '{"tag": "announcement"}');

      expect(textarea.value).toBe('{"tag": "announcement"}');
    });
  });

  describe('Save Button', () => {
    it('should call updateEntry with parsed JSON', async () => {
      const user = userEvent.setup();
      const entry = createMockEntry();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={entry} />);

      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockUpdateEntry).toHaveBeenCalledWith(entry.id, {
          tag: 'new_feature',
          title_en: 'English Title',
          title_ru: 'Russian Title',
          content_en: 'English content',
          content_ru: 'Russian content',
        });
      });
    });

    it('should show success toast on save', async () => {
      const user = userEvent.setup();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Changelog entry updated',
        });
      });
    });

    it('should close modal on successful save', async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();
      render(
        <ChangelogEditModal open={true} onOpenChange={mockOnOpenChange} entry={createMockEntry()} />
      );

      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should show error toast when updateEntry fails', async () => {
      mockUpdateEntry.mockRejectedValueOnce(new Error('Network error'));
      const user = userEvent.setup();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to update entry',
          variant: 'destructive',
        });
      });
    });
  });

  describe('Validation Errors', () => {
    it('should show error toast for invalid JSON', async () => {
      const user = userEvent.setup();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      const textarea = screen.getByTestId('changelog-json-textarea');
      setTextareaValue(textarea, 'not valid json');
      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid JSON format',
          variant: 'destructive',
        });
      });
    });

    it('should show error toast for missing fields', async () => {
      const user = userEvent.setup();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      const textarea = screen.getByTestId('changelog-json-textarea');
      setTextareaValue(textarea, '{"tag": "new_feature"}');
      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: expect.stringContaining('Missing required fields'),
          variant: 'destructive',
        });
      });
    });

    it('should show error toast for invalid tag', async () => {
      const user = userEvent.setup();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      const textarea = screen.getByTestId('changelog-json-textarea');
      const invalidTagJson = JSON.stringify({
        tag: 'invalid_tag',
        title_en: 'EN',
        title_ru: 'RU',
        content_en: 'Content EN',
        content_ru: 'Content RU',
      });
      setTextareaValue(textarea, invalidTagJson);
      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid tag',
          variant: 'destructive',
        });
      });
    });

    it('should not call updateEntry when validation fails', async () => {
      const user = userEvent.setup();
      render(<ChangelogEditModal open={true} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      const textarea = screen.getByTestId('changelog-json-textarea');
      setTextareaValue(textarea, 'invalid json');
      await user.click(screen.getByTestId('changelog-edit-save'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Button', () => {
    it('should call onOpenChange(false) when clicked', async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();
      render(
        <ChangelogEditModal open={true} onOpenChange={mockOnOpenChange} entry={createMockEntry()} />
      );

      await user.click(screen.getByTestId('changelog-edit-cancel'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Modal not rendered when closed', () => {
    it('should not render content when open is false', () => {
      render(<ChangelogEditModal open={false} onOpenChange={vi.fn()} entry={createMockEntry()} />);

      expect(screen.queryByText('Edit Changelog Entry')).not.toBeInTheDocument();
    });
  });
});
