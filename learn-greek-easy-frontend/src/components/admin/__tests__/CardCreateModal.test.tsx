/**
 * CardCreateModal Component Tests
 *
 * Comprehensive tests for the CardCreateModal component, covering:
 * - Modal open/close states
 * - Conditional UI (deck dropdown visible when no deckId, hidden when deckId provided)
 * - Card type dropdown (culture or vocabulary)
 * - Success flow (Create Another, Done buttons)
 * - Cancel flow (confirmation dialog when dirty)
 * - API call formatting
 *
 * Related feature: [CULTURECARD] Admin Culture Cards Management
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CardCreateModal, type CardCreateModalProps } from '../CardCreateModal';
import { adminAPI } from '@/services/adminAPI';
import i18n from '@/i18n';

// ============================================
// Mocks
// ============================================

vi.mock('@/services/adminAPI', () => ({
  adminAPI: {
    getCultureDecks: vi.fn(),
    listDecks: vi.fn(),
    createCultureQuestion: vi.fn(),
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
 * Factory for creating mock deck list
 */
const createMockDecks = () => [
  { id: 'deck-1', name: 'Greek History', category: 'history', question_count: 10, is_active: true },
  {
    id: 'deck-2',
    name: 'Greek Mythology',
    category: 'mythology',
    question_count: 15,
    is_active: true,
  },
];

/**
 * Factory for creating default props
 */
const createDefaultProps = (
  overrides: Partial<CardCreateModalProps> = {}
): CardCreateModalProps => ({
  open: true,
  onOpenChange: vi.fn(),
  onSuccess: vi.fn(),
  ...overrides,
});

/**
 * Render helper with I18nextProvider
 */
const renderModal = (props: Partial<CardCreateModalProps> = {}) => {
  const defaultProps = createDefaultProps(props);

  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <CardCreateModal {...defaultProps} />
      </I18nextProvider>
    ),
    props: defaultProps,
  };
};

/**
 * Helper to fill all form fields for a complete question
 */
const fillCompleteForm = async (user: ReturnType<typeof userEvent.setup>) => {
  // Fill RU tab
  await user.type(screen.getByTestId('question-input-ru'), 'Тестовый вопрос');
  await user.type(screen.getByTestId('answer-input-A-ru'), 'Ответ А');
  await user.type(screen.getByTestId('answer-input-B-ru'), 'Ответ Б');

  // Fill EL tab
  await user.click(screen.getByTestId('lang-tab-el'));
  await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση δοκιμής');
  await user.type(screen.getByTestId('answer-input-A-el'), 'Απάντηση Α');
  await user.type(screen.getByTestId('answer-input-B-el'), 'Απάντηση Β');

  // Fill EN tab
  await user.click(screen.getByTestId('lang-tab-en'));
  await user.type(screen.getByTestId('question-input-en'), 'Test question');
  await user.type(screen.getByTestId('answer-input-A-en'), 'Answer A');
  await user.type(screen.getByTestId('answer-input-B-en'), 'Answer B');
};

// ============================================
// Tests
// ============================================

describe('CardCreateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminAPI.getCultureDecks as Mock).mockResolvedValue(createMockDecks());
    (adminAPI.listDecks as Mock).mockResolvedValue({
      decks: [
        {
          id: 'vocab-deck-1',
          name: 'Basic Vocabulary',
          type: 'vocabulary',
          level: 'A1',
          category: null,
          item_count: 10,
          is_active: true,
          is_premium: false,
          created_at: '2024-01-01',
          owner_id: null,
          owner_name: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    (adminAPI.createCultureQuestion as Mock).mockResolvedValue({ id: 'new-question-id' });
  });

  // ============================================
  // Modal Open/Close Tests
  // ============================================

  describe('Modal Open/Close', () => {
    it('should render modal when open is true', () => {
      renderModal({ open: true });
      expect(screen.getByTestId('card-create-modal')).toBeInTheDocument();
    });

    it('should not render modal content when open is false', () => {
      renderModal({ open: false });
      expect(screen.queryByTestId('card-create-modal')).not.toBeInTheDocument();
    });

    it('should call onOpenChange with false when Done is clicked after success', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ open: true, onOpenChange, deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('done-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('done-btn'));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // ============================================
  // Conditional UI Tests
  // ============================================

  describe('Conditional UI', () => {
    describe('When deckId is NOT provided', () => {
      it('should show deck dropdown', async () => {
        renderModal({ deckId: undefined });

        await waitFor(() => {
          expect(screen.getByTestId('deck-select')).toBeInTheDocument();
        });
      });

      it('should show card type dropdown', async () => {
        renderModal({ deckId: undefined });

        await waitFor(() => {
          expect(screen.getByTestId('card-type-select')).toBeInTheDocument();
        });
      });

      it('should fetch decks when modal opens', async () => {
        renderModal({ deckId: undefined });

        await waitFor(() => {
          expect(adminAPI.getCultureDecks).toHaveBeenCalled();
        });
      });

      it('should disable Create button when no deck is selected', async () => {
        renderModal({ deckId: undefined });

        await waitFor(() => {
          expect(adminAPI.getCultureDecks).toHaveBeenCalled();
        });

        expect(screen.getByTestId('create-btn')).toBeDisabled();
      });
    });

    describe('When deckId IS provided', () => {
      it('should NOT show deck dropdown', () => {
        renderModal({ deckId: 'deck-1' });

        expect(screen.queryByTestId('deck-select')).not.toBeInTheDocument();
      });

      it('should NOT show card type dropdown', () => {
        renderModal({ deckId: 'deck-1' });

        expect(screen.queryByTestId('card-type-select')).not.toBeInTheDocument();
      });

      it('should NOT fetch decks', async () => {
        renderModal({ deckId: 'deck-1' });

        // Wait a bit to ensure the API is not called
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(adminAPI.getCultureDecks).not.toHaveBeenCalled();
      });

      it('should enable Create button (no deck selection needed)', () => {
        renderModal({ deckId: 'deck-1' });

        expect(screen.getByTestId('create-btn')).not.toBeDisabled();
      });
    });
  });

  // ============================================
  // Card Type Dropdown Tests
  // ============================================

  describe('Card Type Dropdown', () => {
    it('should have culture selected by default', async () => {
      renderModal({ deckId: undefined });

      await waitFor(() => {
        expect(screen.getByTestId('card-type-select')).toHaveTextContent('Culture');
      });
    });

    // Note: Vocabulary option is now enabled. Radix Select interactions
    // don't work reliably in happy-dom. Selection behavior is covered by E2E tests.
  });

  // ============================================
  // Success Flow Tests
  // ============================================

  describe('Success Flow', () => {
    it('should call createCultureQuestion API on form submission', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(adminAPI.createCultureQuestion).toHaveBeenCalled();
      });
    });

    it('should include deck_id in API payload', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(adminAPI.createCultureQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
            deck_id: 'deck-1',
          })
        );
      });
    });

    // Note: Testing deck selection with no deckId prop requires Radix Select interaction
    // which doesn't work reliably in happy-dom. The functionality is covered by E2E tests.

    it('should show success view after successful submission', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('create-another-btn')).toBeInTheDocument();
        expect(screen.getByTestId('done-btn')).toBeInTheDocument();
      });
    });

    it('should reset form and show form view when Create Another is clicked', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('create-another-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('create-another-btn'));

      await waitFor(() => {
        // Form should be reset and visible
        expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
        expect(screen.queryByTestId('create-another-btn')).not.toBeInTheDocument();
      });
    });

    it('should call onSuccess when Done is clicked', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      renderModal({ deckId: 'deck-1', onSuccess });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('done-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('done-btn'));
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // ============================================
  // Cancel Flow Tests
  // ============================================

  describe('Cancel Flow', () => {
    it('should close modal immediately when Cancel is clicked and form is clean', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ deckId: 'deck-1', onOpenChange });

      await user.click(screen.getByTestId('cancel-btn'));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show confirmation dialog when Cancel is clicked and form is dirty', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ deckId: 'deck-1', onOpenChange });

      // Make form dirty by typing something
      await user.type(screen.getByTestId('question-input-ru'), 'Some text');

      await user.click(screen.getByTestId('cancel-btn'));

      // Confirmation dialog should appear - use exact text to avoid matching button
      await waitFor(() => {
        expect(screen.getByText('Discard Changes?')).toBeInTheDocument();
      });

      // onOpenChange should NOT have been called yet
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('should close modal when Discard is clicked in confirmation dialog', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ deckId: 'deck-1', onOpenChange });

      // Make form dirty
      await user.type(screen.getByTestId('question-input-ru'), 'Some text');
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
      renderModal({ deckId: 'deck-1', onOpenChange });

      // Make form dirty
      await user.type(screen.getByTestId('question-input-ru'), 'Some text');
      await user.click(screen.getByTestId('cancel-btn'));

      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/keep editing/i)).toBeInTheDocument();
      });

      // Click Keep Editing
      const keepEditingButton = screen.getByRole('button', { name: /keep editing/i });
      await user.click(keepEditingButton);

      // Form should still be visible, modal should not have closed
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
    });
  });

  // ============================================
  // API Call Formatting Tests
  // ============================================

  describe('API Call Formatting', () => {
    it('should format question_text as multilingual object', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(adminAPI.createCultureQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
            question_text: {
              ru: 'Тестовый вопрос',
              el: 'Ερώτηση δοκιμής',
              en: 'Test question',
            },
          })
        );
      });
    });

    it('should format options as multilingual objects', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(adminAPI.createCultureQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
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
          })
        );
      });
    });

    it('should include correct_option as number', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      // Select answer B as correct
      await user.click(screen.getByTestId('correct-radio-B-en'));
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(adminAPI.createCultureQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
            correct_option: 2,
          })
        );
      });
    });

    it('should set option_c and option_d to null when only 2 answers', async () => {
      const user = userEvent.setup();
      renderModal({ deckId: 'deck-1' });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      await waitFor(() => {
        expect(adminAPI.createCultureQuestion).toHaveBeenCalledWith(
          expect.objectContaining({
            option_c: null,
            option_d: null,
          })
        );
      });
    });
  });

  // ============================================
  // State Reset Tests
  // ============================================

  describe('State Reset', () => {
    it('should reset form when modal is closed and reopened', async () => {
      const user = userEvent.setup();
      const { rerender, props } = renderModal({ deckId: 'deck-1', open: true });

      // Type something
      await user.type(screen.getByTestId('question-input-ru'), 'Some text');

      // Close modal
      rerender(
        <I18nextProvider i18n={i18n}>
          <CardCreateModal {...props} open={false} />
        </I18nextProvider>
      );

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Reopen modal
      rerender(
        <I18nextProvider i18n={i18n}>
          <CardCreateModal {...props} open={true} />
        </I18nextProvider>
      );

      // Form should be reset
      await waitFor(() => {
        expect(screen.getByTestId('question-input-ru')).toHaveValue('');
      });
    });

    it('should reset to form view when modal is closed from success view', async () => {
      const user = userEvent.setup();
      const { rerender, props } = renderModal({ deckId: 'deck-1', open: true });

      await fillCompleteForm(user);
      await user.click(screen.getByTestId('create-btn'));

      // Wait for success view
      await waitFor(() => {
        expect(screen.getByTestId('done-btn')).toBeInTheDocument();
      });

      // Close modal
      rerender(
        <I18nextProvider i18n={i18n}>
          <CardCreateModal {...props} open={false} />
        </I18nextProvider>
      );

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Reopen modal
      rerender(
        <I18nextProvider i18n={i18n}>
          <CardCreateModal {...props} open={true} />
        </I18nextProvider>
      );

      // Should show form view again
      await waitFor(() => {
        expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
        expect(screen.queryByTestId('done-btn')).not.toBeInTheDocument();
      });
    });
  });
});
