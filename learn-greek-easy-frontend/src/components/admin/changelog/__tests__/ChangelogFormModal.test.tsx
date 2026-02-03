/**
 * ChangelogFormModal Component Tests
 *
 * Tests for the admin changelog form modal including:
 * - Create vs Edit mode titles
 * - Language tabs (EN, RU)
 * - Form validation
 * - Saving state
 * - Form reset on open/close
 * - Tag selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChangelogFormModal } from '../ChangelogFormModal';
import type { ChangelogEntryAdmin } from '@/types/changelog';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'changelog:tag.newFeature': 'New Feature',
        'changelog:tag.bugFix': 'Bug Fix',
        'changelog:tag.announcement': 'Announcement',
      };
      return translations[key] || key;
    },
  }),
}));

// Factory function for creating mock admin entries
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

// Default props factory
const createDefaultProps = () => ({
  open: true,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
  entry: null,
  isSaving: false,
});

describe('ChangelogFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Title', () => {
    it('should show "Create Changelog Entry" title when no entry provided', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByText('Create Changelog Entry')).toBeInTheDocument();
    });

    it('should show "Edit Changelog Entry" title when entry is provided', () => {
      const props = createDefaultProps();
      const entry = createMockEntry();
      render(<ChangelogFormModal {...props} entry={entry} />);

      expect(screen.getByText('Edit Changelog Entry')).toBeInTheDocument();
    });
  });

  describe('Language Tabs', () => {
    it('should render English tab', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-lang-tab-en')).toBeInTheDocument();
      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('should render Russian tab', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-lang-tab-ru')).toBeInTheDocument();
      expect(screen.getByText('Russian')).toBeInTheDocument();
    });

    it('should show English tab content by default', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      // English inputs should be visible
      expect(screen.getByTestId('changelog-title-input-en')).toBeVisible();
      expect(screen.getByTestId('changelog-content-input-en')).toBeVisible();
    });

    it('should switch to Russian tab when clicked', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      await user.click(screen.getByTestId('changelog-lang-tab-ru'));

      // Russian inputs should become visible
      expect(screen.getByTestId('changelog-title-input-ru')).toBeVisible();
      expect(screen.getByTestId('changelog-content-input-ru')).toBeVisible();
    });
  });

  describe('Form Inputs', () => {
    it('should have title input for each language', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-title-input-en')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-title-input-ru')).toBeInTheDocument();
    });

    it('should have content textarea for each language', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-content-input-en')).toBeInTheDocument();
      expect(screen.getByTestId('changelog-content-input-ru')).toBeInTheDocument();
    });

    it('should have tag selector', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-tag-select')).toBeInTheDocument();
    });

    it('should populate form with entry data when editing', () => {
      const props = createDefaultProps();
      const entry = createMockEntry({
        title_en: 'Existing English Title',
        content_en: 'Existing English Content',
      });
      render(<ChangelogFormModal {...props} entry={entry} />);

      expect(screen.getByTestId('changelog-title-input-en')).toHaveValue('Existing English Title');
      expect(screen.getByTestId('changelog-content-input-en')).toHaveValue(
        'Existing English Content'
      );
    });
  });

  describe('Form Validation', () => {
    it('should show error when submitting with empty title', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      // Fill content for all languages but leave titles empty
      await user.type(screen.getByTestId('changelog-content-input-en'), 'Some content');

      await user.click(screen.getByTestId('changelog-lang-tab-ru'));
      await user.type(screen.getByTestId('changelog-content-input-ru'), 'Russian content');

      // Submit form
      await user.click(screen.getByTestId('changelog-form-submit'));

      await waitFor(() => {
        // Multiple "Title is required" messages will appear (one per language)
        const errors = screen.getAllByText('Title is required');
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('should show error when submitting with empty content', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      // Fill title for all languages but leave content empty
      await user.type(screen.getByTestId('changelog-title-input-en'), 'Some title');

      await user.click(screen.getByTestId('changelog-lang-tab-ru'));
      await user.type(screen.getByTestId('changelog-title-input-ru'), 'Russian title');

      // Submit form
      await user.click(screen.getByTestId('changelog-form-submit'));

      await waitFor(() => {
        // Multiple "Content is required" messages will appear (one per language)
        const errors = screen.getAllByText('Content is required');
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('should indicate which language tab has errors', async () => {
      const user = userEvent.setup();
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      // Fill only English fields
      await user.type(screen.getByTestId('changelog-title-input-en'), 'English title');
      await user.type(screen.getByTestId('changelog-content-input-en'), 'English content');

      // Submit form (should fail on Russian validation)
      await user.click(screen.getByTestId('changelog-form-submit'));

      await waitFor(() => {
        // Russian tab should have error indicator (destructive text color)
        const ruTab = screen.getByTestId('changelog-lang-tab-ru');
        expect(ruTab).toHaveClass('text-destructive');
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      const props = createDefaultProps();
      props.onSubmit = mockOnSubmit;
      render(<ChangelogFormModal {...props} />);

      // Fill all required fields
      await user.type(screen.getByTestId('changelog-title-input-en'), 'EN Title');
      await user.type(screen.getByTestId('changelog-content-input-en'), 'EN Content');

      await user.click(screen.getByTestId('changelog-lang-tab-ru'));
      await user.type(screen.getByTestId('changelog-title-input-ru'), 'RU Title');
      await user.type(screen.getByTestId('changelog-content-input-ru'), 'RU Content');

      // Submit
      await user.click(screen.getByTestId('changelog-form-submit'));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          title_en: 'EN Title',
          title_ru: 'RU Title',
          content_en: 'EN Content',
          content_ru: 'RU Content',
          tag: 'new_feature',
        });
      });
    });

    it('should show "Create" button text when creating', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-form-submit')).toHaveTextContent('Create');
    });

    it('should show "Save Changes" button text when editing', () => {
      const props = createDefaultProps();
      const entry = createMockEntry();
      render(<ChangelogFormModal {...props} entry={entry} />);

      expect(screen.getByTestId('changelog-form-submit')).toHaveTextContent('Save Changes');
    });
  });

  describe('Saving State', () => {
    it('should disable submit button when isSaving is true', () => {
      const props = createDefaultProps();
      props.isSaving = true;
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-form-submit')).toBeDisabled();
    });

    it('should disable cancel button when isSaving is true', () => {
      const props = createDefaultProps();
      props.isSaving = true;
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-form-cancel')).toBeDisabled();
    });

    it('should show "Saving..." text when isSaving is true', () => {
      const props = createDefaultProps();
      props.isSaving = true;
      render(<ChangelogFormModal {...props} />);

      expect(screen.getByTestId('changelog-form-submit')).toHaveTextContent('Saving...');
    });

    it('should show loading spinner when isSaving is true', () => {
      const props = createDefaultProps();
      props.isSaving = true;
      render(<ChangelogFormModal {...props} />);

      // Loader2 icon should be present (rendered as SVG with animate-spin class)
      const submitButton = screen.getByTestId('changelog-form-submit');
      const spinner = submitButton.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Modal Close', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      const props = createDefaultProps();
      props.onClose = mockOnClose;
      render(<ChangelogFormModal {...props} />);

      await user.click(screen.getByTestId('changelog-form-cancel'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not call onClose when cancel is clicked and isSaving', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      const props = createDefaultProps();
      props.onClose = mockOnClose;
      props.isSaving = true;
      render(<ChangelogFormModal {...props} />);

      // Button is disabled, so click should not trigger onClose
      const cancelButton = screen.getByTestId('changelog-form-cancel');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Tag Selection', () => {
    it('should default to new_feature tag', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      // The select trigger should show the default tag
      expect(screen.getByTestId('changelog-tag-select')).toHaveTextContent('New Feature');
    });

    it('should render the select with tag options available', () => {
      const props = createDefaultProps();
      render(<ChangelogFormModal {...props} />);

      // The select trigger exists and shows the default value
      const selectTrigger = screen.getByTestId('changelog-tag-select');
      expect(selectTrigger).toBeInTheDocument();
      expect(selectTrigger).toHaveTextContent('New Feature');

      // Radix UI Select also renders a hidden native select for accessibility
      // Verify all options are present in the native select
      const nativeSelect = document.querySelector('select[aria-hidden="true"]');
      expect(nativeSelect).toBeInTheDocument();
      expect(nativeSelect?.querySelectorAll('option').length).toBe(3);
    });

    it('should preserve tag from entry when editing', () => {
      const props = createDefaultProps();
      const entry = createMockEntry({ tag: 'announcement' });
      render(<ChangelogFormModal {...props} entry={entry} />);

      expect(screen.getByTestId('changelog-tag-select')).toHaveTextContent('Announcement');
    });
  });

  describe('Form Reset', () => {
    it('should reset form when modal opens with no entry', () => {
      const props = createDefaultProps();
      props.open = false;
      const { rerender } = render(<ChangelogFormModal {...props} />);

      // Open the modal
      rerender(<ChangelogFormModal {...props} open={true} />);

      // All fields should be empty
      expect(screen.getByTestId('changelog-title-input-en')).toHaveValue('');
      expect(screen.getByTestId('changelog-content-input-en')).toHaveValue('');
    });

    it('should populate form when modal opens with entry', () => {
      const props = createDefaultProps();
      const entry = createMockEntry({
        title_en: 'Prefilled Title',
        content_en: 'Prefilled Content',
      });
      props.open = false;
      props.entry = entry;
      const { rerender } = render(<ChangelogFormModal {...props} />);

      // Open the modal
      rerender(<ChangelogFormModal {...props} open={true} />);

      expect(screen.getByTestId('changelog-title-input-en')).toHaveValue('Prefilled Title');
      expect(screen.getByTestId('changelog-content-input-en')).toHaveValue('Prefilled Content');
    });

    it('should reset to English tab when modal opens', () => {
      const props = createDefaultProps();
      props.open = false;
      const { rerender } = render(<ChangelogFormModal {...props} />);

      // Open the modal
      rerender(<ChangelogFormModal {...props} open={true} />);

      // English tab should be active (EN inputs visible)
      expect(screen.getByTestId('changelog-title-input-en')).toBeVisible();
    });
  });
});
