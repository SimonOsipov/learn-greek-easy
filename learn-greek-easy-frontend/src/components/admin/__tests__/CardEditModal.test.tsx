/**
 * CardEditModal Component Tests
 *
 * Comprehensive tests for the CardEditModal component, covering:
 * - Modal open/close states
 * - Pre-population from question prop
 * - updateCultureQuestion API call
 * - No "Create Another" button in edit mode
 * - Cancel confirmation when dirty
 * - Toast notification on success
 *
 * Related feature: [CULTURECARD] Admin Culture Cards Management
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CardEditModal, type CardEditModalProps } from '../CardEditModal';
import { adminAPI } from '@/services/adminAPI';
import type { AdminCultureQuestion } from '@/services/adminAPI';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    updateCultureQuestion: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// ============================================
// Test Utilities
// ============================================

/**
 * Factory for creating mock AdminCultureQuestion
 */
const createMockQuestion = (
  overrides: Partial<AdminCultureQuestion> = {}
): AdminCultureQuestion => ({
  id: 'question-123',
  question_text: {
    ru: 'Оригинальный вопрос',
    el: 'Αρχική ερώτηση',
    en: 'Original question',
  },
  option_a: {
    ru: 'Ответ А',
    el: 'Απάντηση Α',
    en: 'Answer A',
  },
  option_b: {
    ru: 'Ответ Б',
    el: 'Απάντηση Β',
    en: 'Answer B',
  },
  option_c: null,
  option_d: null,
  correct_option: 1,
  source_article_url: null,
  is_pending_review: false,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Factory for creating mock question with 4 answers
 */
const createMockQuestionWith4Answers = (
  overrides: Partial<AdminCultureQuestion> = {}
): AdminCultureQuestion =>
  createMockQuestion({
    option_c: {
      ru: 'Ответ В',
      el: 'Απάντηση Γ',
      en: 'Answer C',
    },
    option_d: {
      ru: 'Ответ Г',
      el: 'Απάντηση Δ',
      en: 'Answer D',
    },
    ...overrides,
  });

/**
 * Factory for creating default props
 */
const createDefaultProps = (overrides: Partial<CardEditModalProps> = {}): CardEditModalProps => ({
  open: true,
  onOpenChange: vi.fn(),
  question: createMockQuestion(),
  onSuccess: vi.fn(),
  ...overrides,
});

/**
 * Render helper with I18nextProvider
 */
const renderModal = (props: Partial<CardEditModalProps> = {}) => {
  const defaultProps = createDefaultProps(props);

  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <CardEditModal {...defaultProps} />
      </I18nextProvider>
    ),
    props: defaultProps,
  };
};

// ============================================
// Tests
// ============================================

describe('CardEditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminAPI.updateCultureQuestion as Mock).mockResolvedValue({ id: 'question-123' });
  });

  // ============================================
  // Modal Open/Close Tests
  // ============================================

  describe('Modal Open/Close', () => {
    it('should render modal when open is true', () => {
      renderModal({ open: true });
      expect(screen.getByTestId('card-edit-modal')).toBeInTheDocument();
    });

    it('should not render modal content when open is false', () => {
      renderModal({ open: false });
      expect(screen.queryByTestId('card-edit-modal')).not.toBeInTheDocument();
    });

    it('should not render form when question is null', () => {
      renderModal({ open: true, question: null });
      // Form should not be present since there's no question
      expect(screen.queryByTestId('culture-card-form')).not.toBeInTheDocument();
    });

    it('should render form when question is provided', () => {
      renderModal({ open: true, question: createMockQuestion() });
      expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
    });
  });

  // ============================================
  // Pre-population Tests
  // ============================================

  describe('Pre-population from Question', () => {
    it('should pre-populate question text from question prop', () => {
      renderModal();
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Оригинальный вопрос');
    });

    it('should pre-populate question text for all languages', async () => {
      const user = userEvent.setup();
      renderModal();

      // Check RU
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Оригинальный вопрос');

      // Switch to EL and check
      await user.click(screen.getByTestId('lang-tab-el'));
      expect(screen.getByTestId('question-input-el')).toHaveValue('Αρχική ερώτηση');

      // Switch to EN and check
      await user.click(screen.getByTestId('lang-tab-en'));
      expect(screen.getByTestId('question-input-en')).toHaveValue('Original question');
    });

    it('should pre-populate answer fields from question prop', () => {
      renderModal();

      expect(screen.getByTestId('answer-input-A-ru')).toHaveValue('Ответ А');
      expect(screen.getByTestId('answer-input-B-ru')).toHaveValue('Ответ Б');
    });

    it('should pre-populate correct answer from question prop', () => {
      renderModal({ question: createMockQuestion({ correct_option: 2 }) });

      const radioB = screen.getByTestId('correct-radio-B-ru') as HTMLInputElement;
      expect(radioB.checked).toBe(true);
    });

    it('should show 4 answers when question has 4 options', () => {
      renderModal({ question: createMockQuestionWith4Answers() });

      expect(screen.getByTestId('answer-input-A-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-B-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-C-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-D-ru')).toBeInTheDocument();
    });

    it('should not show incomplete indicators when question is complete', () => {
      renderModal();

      expect(screen.queryByTestId('lang-tab-ru-incomplete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lang-tab-el-incomplete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lang-tab-en-incomplete')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Edit Mode UI Tests
  // ============================================

  describe('Edit Mode UI', () => {
    it('should NOT show Create Another button', async () => {
      const user = userEvent.setup();
      renderModal();

      // Make a change to enable save
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      // Submit
      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(adminAPI.updateCultureQuestion).toHaveBeenCalled();
      });

      // There should be no "Create Another" button anywhere
      expect(screen.queryByTestId('create-another-btn')).not.toBeInTheDocument();
    });

    it('should show Save button instead of Create button', () => {
      renderModal();

      expect(screen.getByTestId('save-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('create-btn')).not.toBeInTheDocument();
    });

    it('should NOT show deck selection (editing existing card)', () => {
      renderModal();

      expect(screen.queryByTestId('deck-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-type-select')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // API Call Tests
  // ============================================

  describe('updateCultureQuestion API Call', () => {
    it('should call updateCultureQuestion on form submission', async () => {
      const user = userEvent.setup();
      renderModal();

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(adminAPI.updateCultureQuestion).toHaveBeenCalled();
      });
    });

    it('should pass question id to updateCultureQuestion', async () => {
      const user = userEvent.setup();
      renderModal({ question: createMockQuestion({ id: 'my-question-id' }) });

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(adminAPI.updateCultureQuestion).toHaveBeenCalledWith(
          'my-question-id',
          expect.any(Object)
        );
      });
    });

    it('should NOT include deck_id in update payload', async () => {
      const user = userEvent.setup();
      renderModal();

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const [, payload] = (adminAPI.updateCultureQuestion as Mock).mock.calls[0];
        expect(payload).not.toHaveProperty('deck_id');
      });
    });

    it('should include question_text in update payload', async () => {
      const user = userEvent.setup();
      renderModal();

      // Update question in all languages
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Новый вопрос');

      await user.click(screen.getByTestId('lang-tab-el'));
      await user.clear(screen.getByTestId('question-input-el'));
      await user.type(screen.getByTestId('question-input-el'), 'Νέα ερώτηση');

      await user.click(screen.getByTestId('lang-tab-en'));
      await user.clear(screen.getByTestId('question-input-en'));
      await user.type(screen.getByTestId('question-input-en'), 'New question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const [, payload] = (adminAPI.updateCultureQuestion as Mock).mock.calls[0];
        expect(payload.question_text).toEqual({
          ru: 'Новый вопрос',
          el: 'Νέα ερώτηση',
          en: 'New question',
        });
      });
    });

    it('should include option fields in update payload', async () => {
      const user = userEvent.setup();
      renderModal();

      // Update answer A
      await user.clear(screen.getByTestId('answer-input-A-ru'));
      await user.type(screen.getByTestId('answer-input-A-ru'), 'Новый ответ А');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const [, payload] = (adminAPI.updateCultureQuestion as Mock).mock.calls[0];
        expect(payload.option_a).toBeDefined();
        expect(payload.option_b).toBeDefined();
      });
    });

    it('should include correct_option in update payload', async () => {
      const user = userEvent.setup();
      renderModal();

      // Change correct answer
      await user.click(screen.getByTestId('correct-radio-B-ru'));

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const [, payload] = (adminAPI.updateCultureQuestion as Mock).mock.calls[0];
        expect(payload.correct_option).toBe(2);
      });
    });
  });

  // ============================================
  // Success Flow Tests
  // ============================================

  describe('Success Flow', () => {
    it('should show success toast after successful update', async () => {
      const user = userEvent.setup();
      renderModal();

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.any(String),
          })
        );
      });
    });

    it('should close modal after successful update', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should call onSuccess after successful update', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      renderModal({ onSuccess });

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Cancel Flow Tests
  // ============================================

  describe('Cancel Flow', () => {
    it('should close modal immediately when Cancel is clicked and form is clean', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      await user.click(screen.getByTestId('cancel-btn'));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show confirmation dialog when Cancel is clicked and form is dirty', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      // Make form dirty by changing something
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Changed text');

      await user.click(screen.getByTestId('cancel-btn'));

      // Confirmation dialog should appear - use exact text to avoid matching button
      await waitFor(() => {
        expect(screen.getByText('Discard Changes?')).toBeInTheDocument();
      });

      // Modal should NOT have closed yet
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should close modal when Discard is clicked in confirmation dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      // Make form dirty
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Changed text');

      await user.click(screen.getByTestId('cancel-btn'));

      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText('Discard Changes?')).toBeInTheDocument();
      });

      // Click Discard button (exact name without question mark)
      const discardButton = screen.getByRole('button', { name: /^discard$/i });
      await user.click(discardButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should return to form when Keep Editing is clicked in confirmation dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ onOpenChange });

      // Make form dirty
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Changed text');

      await user.click(screen.getByTestId('cancel-btn'));

      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/keep editing/i)).toBeInTheDocument();
      });

      // Click Keep Editing
      const keepEditingButton = screen.getByRole('button', { name: /keep editing/i });
      await user.click(keepEditingButton);

      // Modal should not have closed
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      // Form should still be visible with the changed text
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Changed text');
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('Error Handling', () => {
    it('should show error toast when API call fails', async () => {
      const user = userEvent.setup();
      (adminAPI.updateCultureQuestion as Mock).mockRejectedValue(new Error('API Error'));
      renderModal();

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });
    });

    it('should NOT close modal when API call fails', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      (adminAPI.updateCultureQuestion as Mock).mockRejectedValue(new Error('API Error'));
      renderModal({ onOpenChange });

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });

      // Modal should NOT have closed
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should NOT call onSuccess when API call fails', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      (adminAPI.updateCultureQuestion as Mock).mockRejectedValue(new Error('API Error'));
      renderModal({ onSuccess });

      // Make a change
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'destructive',
          })
        );
      });

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Button State Tests
  // ============================================

  describe('Button States', () => {
    it('should disable Save button when question is null', () => {
      renderModal({ question: null });

      expect(screen.getByTestId('save-btn')).toBeDisabled();
    });

    it('should enable Save button when question is provided', () => {
      renderModal({ question: createMockQuestion() });

      expect(screen.getByTestId('save-btn')).not.toBeDisabled();
    });
  });
});
