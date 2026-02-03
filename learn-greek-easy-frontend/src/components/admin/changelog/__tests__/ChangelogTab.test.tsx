/**
 * ChangelogTab Component Tests
 *
 * Tests for the admin changelog tab including:
 * - JSON creation card rendering
 * - Submit button states (disabled when empty, disabled when saving)
 * - Loading spinner during save
 * - Validation error toasts
 * - Success toast and input clearing
 * - Test IDs presence
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChangelogTab } from '../ChangelogTab';

/**
 * Helper to set textarea value and trigger change event.
 * Using fireEvent instead of userEvent.type because userEvent
 * interprets curly braces as keyboard modifiers.
 */
const setTextareaValue = (textarea: HTMLElement, value: string) => {
  fireEvent.change(textarea, { target: { value } });
};

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'admin:changelog.create.title': 'Create Changelog Entry',
        'admin:changelog.create.description': 'Paste JSON to create a new changelog entry',
        'admin:changelog.create.hint': 'Content supports **bold** and *italic* markdown',
        'admin:changelog.create.submit': 'Submit',
        'admin:changelog.create.submitting': 'Submitting...',
        'admin:changelog.create.validationError': 'Invalid JSON',
        'admin:changelog.validation.invalidJson': 'Invalid JSON format',
        'admin:changelog.validation.missingFields': `Missing required fields: ${params?.fields || ''}`,
        'admin:changelog.validation.invalidTag':
          'Invalid tag. Must be: new_feature, bug_fix, or announcement',
        'admin:changelog.toast.created': 'Changelog entry created successfully',
        'admin:changelog.toast.createError': 'Failed to create changelog entry',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// Mock admin changelog store
const mockFetchList = vi.fn();
const mockCreateEntry = vi.fn();
const mockUpdateEntry = vi.fn();
const mockSetPage = vi.fn();
const mockReset = vi.fn();

let mockIsSaving = false;

vi.mock('@/stores/adminChangelogStore', () => ({
  useAdminChangelogStore: (selector: (state: unknown) => unknown) => {
    const state = {
      items: [],
      isLoading: false,
      isSaving: mockIsSaving,
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      fetchList: mockFetchList,
      createEntry: mockCreateEntry,
      updateEntry: mockUpdateEntry,
      setPage: mockSetPage,
      reset: mockReset,
    };
    return selector ? selector(state) : state;
  },
  selectAdminChangelogItems: (state: { items: unknown[] }) => state.items,
  selectAdminChangelogIsLoading: (state: { isLoading: boolean }) => state.isLoading,
  selectAdminChangelogIsSaving: (state: { isSaving: boolean }) => state.isSaving,
  selectAdminChangelogPage: (state: { page: number }) => state.page,
  selectAdminChangelogPageSize: (state: { pageSize: number }) => state.pageSize,
  selectAdminChangelogTotal: (state: { total: number }) => state.total,
  selectAdminChangelogTotalPages: (state: { totalPages: number }) => state.totalPages,
}));

// Mock sub-components
vi.mock('../ChangelogTable', () => ({
  ChangelogTable: () => <div data-testid="changelog-table-mock">Changelog Table</div>,
}));

vi.mock('../ChangelogEditModal', () => ({
  ChangelogEditModal: () => <div data-testid="changelog-edit-modal-mock">Edit Modal</div>,
}));

vi.mock('../ChangelogDeleteDialog', () => ({
  ChangelogDeleteDialog: () => <div data-testid="changelog-delete-dialog-mock">Delete Dialog</div>,
}));

describe('ChangelogTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSaving = false;
    mockCreateEntry.mockResolvedValue(undefined);
  });

  describe('Test IDs', () => {
    it('should render changelog-tab test ID', () => {
      render(<ChangelogTab />);
      expect(screen.getByTestId('changelog-tab')).toBeInTheDocument();
    });

    it('should render changelog-create-card test ID', () => {
      render(<ChangelogTab />);
      expect(screen.getByTestId('changelog-create-card')).toBeInTheDocument();
    });

    it('should render changelog-json-input test ID', () => {
      render(<ChangelogTab />);
      expect(screen.getByTestId('changelog-json-input')).toBeInTheDocument();
    });

    it('should render changelog-submit-button test ID', () => {
      render(<ChangelogTab />);
      expect(screen.getByTestId('changelog-submit-button')).toBeInTheDocument();
    });
  });

  describe('JSON Creation Card', () => {
    it('should render card header with title', () => {
      render(<ChangelogTab />);
      expect(screen.getByText('Create Changelog Entry')).toBeInTheDocument();
    });

    it('should render card description', () => {
      render(<ChangelogTab />);
      expect(screen.getByText('Paste JSON to create a new changelog entry')).toBeInTheDocument();
    });

    it('should render hint text', () => {
      render(<ChangelogTab />);
      expect(
        screen.getByText('Content supports **bold** and *italic* markdown')
      ).toBeInTheDocument();
    });

    it('should render textarea with placeholder JSON', () => {
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder');
      expect(textarea.getAttribute('placeholder')).toContain('tag');
      expect(textarea.getAttribute('placeholder')).toContain('title_en');
      expect(textarea.getAttribute('placeholder')).toContain('title_ru');
      expect(textarea.getAttribute('placeholder')).toContain('content_en');
      expect(textarea.getAttribute('placeholder')).toContain('content_ru');
    });

    it('should NOT render "Add New" button (removed)', () => {
      render(<ChangelogTab />);
      expect(screen.queryByText('Add New')).not.toBeInTheDocument();
    });
  });

  describe('Submit Button States', () => {
    it('should disable submit button when textarea is empty', () => {
      render(<ChangelogTab />);
      const submitButton = screen.getByTestId('changelog-submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when textarea has only whitespace', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      await user.type(textarea, '   ');

      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when textarea has content', () => {
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      setTextareaValue(textarea, '{"test": true}');

      expect(submitButton).not.toBeDisabled();
    });

    it('should show "Submit" text when not saving', () => {
      render(<ChangelogTab />);
      const submitButton = screen.getByTestId('changelog-submit-button');
      expect(submitButton).toHaveTextContent('Submit');
    });
  });

  describe('Saving State', () => {
    beforeEach(() => {
      mockIsSaving = true;
    });

    it('should disable submit button when isSaving is true', () => {
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      setTextareaValue(textarea, '{"test": true}');

      const submitButton = screen.getByTestId('changelog-submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should show "Submitting..." text when saving', () => {
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      setTextareaValue(textarea, '{"test": true}');

      const submitButton = screen.getByTestId('changelog-submit-button');
      expect(submitButton).toHaveTextContent('Submitting...');
    });

    it('should show loading spinner when saving', () => {
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      setTextareaValue(textarea, '{"test": true}');

      const submitButton = screen.getByTestId('changelog-submit-button');
      const spinner = submitButton.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('JSON Validation', () => {
    it('should show error toast for invalid JSON syntax', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      await user.type(textarea, 'not valid json');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid JSON',
          description: 'Invalid JSON format',
          variant: 'destructive',
        });
      });
    });

    it('should show error toast with missing field names', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      // Missing all required fields
      setTextareaValue(textarea, '{"random": "value"}');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Invalid JSON',
            variant: 'destructive',
          })
        );
        const call = (mockToast as Mock).mock.calls[0][0];
        expect(call.description).toContain('Missing required fields:');
      });
    });

    it('should show error toast for invalid tag value', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      const invalidTagJson = JSON.stringify({
        tag: 'invalid_tag',
        title_en: 'Title',
        title_ru: 'Заголовок',
        content_en: 'Content',
        content_ru: 'Содержимое',
      });
      setTextareaValue(textarea, invalidTagJson);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Invalid JSON',
          description: 'Invalid tag. Must be: new_feature, bug_fix, or announcement',
          variant: 'destructive',
        });
      });
    });

    it('should NOT call createEntry when validation fails', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      setTextareaValue(textarea, 'invalid json');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
      expect(mockCreateEntry).not.toHaveBeenCalled();
    });
  });

  describe('Successful Submission', () => {
    it('should call createEntry with validated data', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      const validJson = JSON.stringify({
        tag: 'new_feature',
        title_en: 'New Feature Title',
        title_ru: 'Заголовок новой функции',
        content_en: 'Feature description',
        content_ru: 'Описание функции',
      });
      setTextareaValue(textarea, validJson);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateEntry).toHaveBeenCalledWith({
          tag: 'new_feature',
          title_en: 'New Feature Title',
          title_ru: 'Заголовок новой функции',
          content_en: 'Feature description',
          content_ru: 'Описание функции',
        });
      });
    });

    it('should show success toast on successful creation', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      const validJson = JSON.stringify({
        tag: 'bug_fix',
        title_en: 'Bug Fix',
        title_ru: 'Исправление',
        content_en: 'Fixed issue',
        content_ru: 'Исправлена проблема',
      });
      setTextareaValue(textarea, validJson);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Changelog entry created successfully',
        });
      });
    });

    it('should clear textarea on successful creation', async () => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      const validJson = JSON.stringify({
        tag: 'announcement',
        title_en: 'Announcement',
        title_ru: 'Объявление',
        content_en: 'Announcement content',
        content_ru: 'Содержимое объявления',
      });
      setTextareaValue(textarea, validJson);
      await user.click(submitButton);

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });

    it('should show error toast when createEntry fails', async () => {
      mockCreateEntry.mockRejectedValueOnce(new Error('Network error'));
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      const validJson = JSON.stringify({
        tag: 'new_feature',
        title_en: 'Title',
        title_ru: 'Заголовок',
        content_en: 'Content',
        content_ru: 'Содержимое',
      });
      setTextareaValue(textarea, validJson);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Failed to create changelog entry',
          variant: 'destructive',
        });
      });
    });
  });

  describe('All Valid Tags', () => {
    it.each(['new_feature', 'bug_fix', 'announcement'])('should accept tag: %s', async (tag) => {
      const user = userEvent.setup();
      render(<ChangelogTab />);
      const textarea = screen.getByTestId('changelog-json-input');
      const submitButton = screen.getByTestId('changelog-submit-button');

      const validJson = JSON.stringify({
        tag,
        title_en: 'Title',
        title_ru: 'Заголовок',
        content_en: 'Content',
        content_ru: 'Содержимое',
      });
      setTextareaValue(textarea, validJson);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateEntry).toHaveBeenCalledWith(expect.objectContaining({ tag }));
      });
    });
  });

  describe('Lifecycle', () => {
    it('should call fetchList on mount', () => {
      render(<ChangelogTab />);
      expect(mockFetchList).toHaveBeenCalled();
    });

    it('should call reset on unmount', () => {
      const { unmount } = render(<ChangelogTab />);
      unmount();
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('Sub-components', () => {
    it('should render ChangelogTable', () => {
      render(<ChangelogTab />);
      expect(screen.getByTestId('changelog-table-mock')).toBeInTheDocument();
    });

    it('should render ChangelogEditModal', () => {
      render(<ChangelogTab />);
      // Edit modal only renders when editingEntry is set
      // So it won't be in the DOM by default
      expect(screen.queryByTestId('changelog-edit-modal-mock')).not.toBeInTheDocument();
    });

    it('should render ChangelogDeleteDialog', () => {
      render(<ChangelogTab />);
      expect(screen.getByTestId('changelog-delete-dialog-mock')).toBeInTheDocument();
    });
  });
});
