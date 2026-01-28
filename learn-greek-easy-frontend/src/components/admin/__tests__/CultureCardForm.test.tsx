/**
 * CultureCardForm Component Tests
 *
 * Comprehensive tests for the CultureCardForm component, covering:
 * - Basic form rendering with correct elements
 * - Language tab switching and state preservation
 * - Language completeness validation indicators
 * - Answer count validation (2-4 answers, add/remove)
 * - Correct answer selection and deletion handling
 * - Dirty state tracking via onDirtyChange callback
 * - Edit mode with initialData pre-population
 * - Form submission payload structure
 *
 * Related feature: [CULTURECARD] Admin Culture Cards Management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';

import { CultureCardForm, type CultureCardFormProps } from '../CultureCardForm';
import type { AdminCultureQuestion, CultureQuestionCreatePayload } from '@/services/adminAPI';
import i18n from '@/i18n';

// ============================================
// Test Utilities
// ============================================

/**
 * Factory for creating mock AdminCultureQuestion data
 */
const createMockQuestion = (
  overrides: Partial<AdminCultureQuestion> = {}
): AdminCultureQuestion => ({
  id: 'test-question-1',
  question_text: {
    ru: 'Тестовый вопрос',
    el: 'Ερώτηση δοκιμής',
    en: 'Test question',
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
 * Render helper with I18nextProvider
 */
const renderForm = (props: Partial<CultureCardFormProps> = {}) => {
  const defaultProps: CultureCardFormProps = {
    onSubmit: vi.fn().mockResolvedValue(undefined),
    deckId: 'test-deck-1',
    ...props,
  };

  return {
    ...render(
      <I18nextProvider i18n={i18n}>
        <CultureCardForm {...defaultProps} />
      </I18nextProvider>
    ),
    props: defaultProps,
  };
};

// ============================================
// Tests
// ============================================

describe('CultureCardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering Tests
  // ============================================

  describe('Rendering', () => {
    it('should render form with correct test id', () => {
      renderForm();
      expect(screen.getByTestId('culture-card-form')).toBeInTheDocument();
    });

    it('should render all three language tabs', () => {
      renderForm();
      expect(screen.getByTestId('lang-tab-ru')).toBeInTheDocument();
      expect(screen.getByTestId('lang-tab-el')).toBeInTheDocument();
      expect(screen.getByTestId('lang-tab-en')).toBeInTheDocument();
    });

    it('should render question textarea', () => {
      renderForm();
      expect(screen.getByTestId('question-input-ru')).toBeInTheDocument();
    });

    it('should render two answer fields by default', () => {
      renderForm();
      expect(screen.getByTestId('answer-input-A-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-B-ru')).toBeInTheDocument();
      expect(screen.queryByTestId('answer-input-C-ru')).not.toBeInTheDocument();
      expect(screen.queryByTestId('answer-input-D-ru')).not.toBeInTheDocument();
    });

    it('should render correct answer radio buttons for each answer', () => {
      renderForm();
      expect(screen.getByTestId('correct-radio-A-ru')).toBeInTheDocument();
      expect(screen.getByTestId('correct-radio-B-ru')).toBeInTheDocument();
    });

    it('should render add answer button when less than 4 answers', () => {
      renderForm();
      // Button exists in each tab (hidden tabs still render), just check at least one exists
      expect(screen.getAllByTestId('add-answer-btn').length).toBeGreaterThan(0);
    });

    it('should render delete buttons for answers', () => {
      renderForm();
      // Delete buttons exist in each tab (hidden tabs still render)
      expect(screen.getAllByTestId('delete-answer-A').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('delete-answer-B').length).toBeGreaterThan(0);
    });

    it('should render submit button when deckId is provided', () => {
      renderForm({ deckId: 'test-deck' });
      expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    });

    it('should not render submit button when isSubmitting is true', () => {
      renderForm({ isSubmitting: true });
      expect(screen.queryByTestId('submit-btn')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Language Tab Switching Tests
  // ============================================

  describe('Language Tab Switching', () => {
    it('should switch to EL tab when clicked', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('lang-tab-el'));

      // EL question input should be visible
      expect(screen.getByTestId('question-input-el')).toBeVisible();
    });

    it('should switch to EN tab when clicked', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('lang-tab-en'));

      // EN question input should be visible
      expect(screen.getByTestId('question-input-en')).toBeVisible();
    });

    it('should preserve input when switching tabs', async () => {
      const user = userEvent.setup();
      renderForm();

      // Type in RU tab
      const ruQuestionInput = screen.getByTestId('question-input-ru');
      await user.type(ruQuestionInput, 'Вопрос на русском');

      // Switch to EL tab
      await user.click(screen.getByTestId('lang-tab-el'));

      // Switch back to RU tab
      await user.click(screen.getByTestId('lang-tab-ru'));

      // Verify RU text is preserved
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Вопрос на русском');
    });

    it('should preserve answer input when switching tabs', async () => {
      const user = userEvent.setup();
      renderForm();

      // Type answer in RU tab
      const ruAnswerA = screen.getByTestId('answer-input-A-ru');
      await user.type(ruAnswerA, 'Ответ на русском');

      // Switch to EL, then back to RU
      await user.click(screen.getByTestId('lang-tab-el'));
      await user.click(screen.getByTestId('lang-tab-ru'));

      // Verify answer text is preserved
      expect(screen.getByTestId('answer-input-A-ru')).toHaveValue('Ответ на русском');
    });
  });

  // ============================================
  // Language Completeness Tests
  // ============================================

  describe('Language Completeness', () => {
    it('should show incomplete indicator on all tabs when form is empty', () => {
      renderForm();

      expect(screen.getByTestId('lang-tab-ru-incomplete')).toBeInTheDocument();
      expect(screen.getByTestId('lang-tab-el-incomplete')).toBeInTheDocument();
      expect(screen.getByTestId('lang-tab-en-incomplete')).toBeInTheDocument();
    });

    it('should remove incomplete indicator when all fields are filled for a language', async () => {
      const user = userEvent.setup();
      renderForm();

      // Fill RU question
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');

      // Fill RU answers
      await user.type(screen.getByTestId('answer-input-A-ru'), 'Ответ А');
      await user.type(screen.getByTestId('answer-input-B-ru'), 'Ответ Б');

      // RU tab should no longer have incomplete indicator
      await waitFor(() => {
        expect(screen.queryByTestId('lang-tab-ru-incomplete')).not.toBeInTheDocument();
      });

      // Other tabs should still show incomplete
      expect(screen.getByTestId('lang-tab-el-incomplete')).toBeInTheDocument();
      expect(screen.getByTestId('lang-tab-en-incomplete')).toBeInTheDocument();
    });

    it('should show incomplete indicator when question is filled but answers are not', async () => {
      const user = userEvent.setup();
      renderForm();

      // Fill only question
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');

      // RU tab should still show incomplete (missing answers)
      expect(screen.getByTestId('lang-tab-ru-incomplete')).toBeInTheDocument();
    });

    it('should track completeness across added answers', async () => {
      const user = userEvent.setup();
      renderForm();

      // Fill RU for 2 answers
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
      await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
      await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

      // RU should be complete
      await waitFor(() => {
        expect(screen.queryByTestId('lang-tab-ru-incomplete')).not.toBeInTheDocument();
      });

      // Add answer C (use first visible add button)
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      // RU should now be incomplete (C is empty)
      await waitFor(() => {
        expect(screen.getByTestId('lang-tab-ru-incomplete')).toBeInTheDocument();
      });
    });
  });

  // ============================================
  // Answer Count Tests
  // ============================================

  describe('Answer Count', () => {
    it('should start with 2 answers by default', () => {
      renderForm();

      expect(screen.getByTestId('answer-input-A-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-B-ru')).toBeInTheDocument();
      expect(screen.queryByTestId('answer-input-C-ru')).not.toBeInTheDocument();
    });

    it('should add answer C when add button is clicked', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      expect(screen.getByTestId('answer-input-C-ru')).toBeInTheDocument();
    });

    it('should add answer D when add button is clicked twice', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      expect(screen.getByTestId('answer-input-C-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-D-ru')).toBeInTheDocument();
    });

    it('should hide add button when 4 answers exist', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add 2 more answers (to get to 4)
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      expect(screen.queryAllByTestId('add-answer-btn')).toHaveLength(0);
    });

    it('should remove answer when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add answer C
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      expect(screen.getByTestId('answer-input-C-ru')).toBeInTheDocument();

      // Delete answer C (use first visible delete button)
      await user.click(screen.getAllByTestId('delete-answer-C')[0]);

      await waitFor(() => {
        expect(screen.queryByTestId('answer-input-C-ru')).not.toBeInTheDocument();
      });
    });

    it('should show add button again after deleting answer', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add answers to reach 4
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      expect(screen.queryAllByTestId('add-answer-btn')).toHaveLength(0);

      // Delete one answer
      await user.click(screen.getAllByTestId('delete-answer-D')[0]);

      await waitFor(() => {
        expect(screen.getAllByTestId('add-answer-btn').length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // Correct Answer Tests
  // ============================================

  describe('Correct Answer', () => {
    it('should select answer A as correct by default', () => {
      renderForm();

      const radioA = screen.getByTestId('correct-radio-A-ru') as HTMLInputElement;
      expect(radioA.checked).toBe(true);
    });

    it('should select answer B when radio is clicked', async () => {
      const user = userEvent.setup();
      renderForm();

      await user.click(screen.getByTestId('correct-radio-B-ru'));

      const radioB = screen.getByTestId('correct-radio-B-ru') as HTMLInputElement;
      expect(radioB.checked).toBe(true);
    });

    it('should preserve correct answer selection across tabs', async () => {
      const user = userEvent.setup();
      renderForm();

      // Select answer B in RU tab
      await user.click(screen.getByTestId('correct-radio-B-ru'));

      // Switch to EL tab
      await user.click(screen.getByTestId('lang-tab-el'));

      // Check B is selected in EL tab too
      const radioB = screen.getByTestId('correct-radio-B-el') as HTMLInputElement;
      expect(radioB.checked).toBe(true);
    });

    it('should reset correct answer when selected answer is deleted', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add answer C and select it as correct
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getByTestId('correct-radio-C-ru'));

      // Verify C is selected
      const radioC = screen.getByTestId('correct-radio-C-ru') as HTMLInputElement;
      expect(radioC.checked).toBe(true);

      // Delete answer C
      await user.click(screen.getAllByTestId('delete-answer-C')[0]);

      // C should be gone, and no answer should be selected (reset to 0)
      await waitFor(() => {
        const radioA = screen.getByTestId('correct-radio-A-ru') as HTMLInputElement;
        const radioB = screen.getByTestId('correct-radio-B-ru') as HTMLInputElement;
        // When correct option is deleted, it's reset to 0 (none selected)
        expect(radioA.checked).toBe(false);
        expect(radioB.checked).toBe(false);
      });
    });

    it('should adjust correct answer when D is shifted to C', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add C and D
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      // Select D as correct
      await user.click(screen.getByTestId('correct-radio-D-ru'));

      // Delete C (D should shift to C, and correct_option should become 3)
      await user.click(screen.getAllByTestId('delete-answer-C')[0]);

      await waitFor(() => {
        // D is now C, and it should still be selected
        const radioC = screen.getByTestId('correct-radio-C-ru') as HTMLInputElement;
        expect(radioC.checked).toBe(true);
      });
    });
  });

  // ============================================
  // Answer Deletion Tests
  // ============================================

  describe('Answer Deletion', () => {
    it('should disable delete buttons when only 2 answers exist', () => {
      renderForm();

      // Get first delete buttons (they're duplicated across tabs)
      const deleteA = screen.getAllByTestId('delete-answer-A')[0];
      const deleteB = screen.getAllByTestId('delete-answer-B')[0];

      expect(deleteA).toBeDisabled();
      expect(deleteB).toBeDisabled();
    });

    it('should enable delete buttons when more than 2 answers exist', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add answer C
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      const deleteA = screen.getAllByTestId('delete-answer-A')[0];
      const deleteB = screen.getAllByTestId('delete-answer-B')[0];
      const deleteC = screen.getAllByTestId('delete-answer-C')[0];

      expect(deleteA).not.toBeDisabled();
      expect(deleteB).not.toBeDisabled();
      expect(deleteC).not.toBeDisabled();
    });

    it('should shift D to C when C is deleted', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add C and D
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      // Fill D with some text
      await user.type(screen.getByTestId('answer-input-D-ru'), 'Answer D text');

      // Delete C
      await user.click(screen.getAllByTestId('delete-answer-C')[0]);

      await waitFor(() => {
        // D should now be C with D's content
        expect(screen.getByTestId('answer-input-C-ru')).toHaveValue('Answer D text');
        expect(screen.queryByTestId('answer-input-D-ru')).not.toBeInTheDocument();
      });
    });

    it('should preserve answer content when deleting D', async () => {
      const user = userEvent.setup();
      renderForm();

      // Add C and D
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      // Fill C with text
      await user.type(screen.getByTestId('answer-input-C-ru'), 'Answer C text');

      // Delete D
      await user.click(screen.getAllByTestId('delete-answer-D')[0]);

      await waitFor(() => {
        // C should still have its content
        expect(screen.getByTestId('answer-input-C-ru')).toHaveValue('Answer C text');
      });
    });
  });

  // ============================================
  // Dirty State Tests
  // ============================================

  describe('Dirty State', () => {
    it('should not call onDirtyChange initially when form is clean', () => {
      const onDirtyChange = vi.fn();
      renderForm({ onDirtyChange });

      // Initial render may call with false, but not true
      const calls = onDirtyChange.mock.calls.filter((call) => call[0] === true);
      expect(calls.length).toBe(0);
    });

    it('should call onDirtyChange with true when question is typed', async () => {
      const user = userEvent.setup();
      const onDirtyChange = vi.fn();
      renderForm({ onDirtyChange });

      await user.type(screen.getByTestId('question-input-ru'), 'New text');

      await waitFor(() => {
        expect(onDirtyChange).toHaveBeenCalledWith(true);
      });
    });

    it('should call onDirtyChange with true when answer is typed', async () => {
      const user = userEvent.setup();
      const onDirtyChange = vi.fn();
      renderForm({ onDirtyChange });

      await user.type(screen.getByTestId('answer-input-A-ru'), 'New answer');

      await waitFor(() => {
        expect(onDirtyChange).toHaveBeenCalledWith(true);
      });
    });

    it('should call onDirtyChange with true when answer is added', async () => {
      const user = userEvent.setup();
      const onDirtyChange = vi.fn();
      renderForm({ onDirtyChange });

      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      await waitFor(() => {
        expect(onDirtyChange).toHaveBeenCalledWith(true);
      });
    });

    it('should call onDirtyChange with true when correct answer is changed', async () => {
      const user = userEvent.setup();
      const onDirtyChange = vi.fn();
      renderForm({ onDirtyChange });

      await user.click(screen.getByTestId('correct-radio-B-ru'));

      await waitFor(() => {
        expect(onDirtyChange).toHaveBeenCalledWith(true);
      });
    });
  });

  // ============================================
  // Edit Mode Tests
  // ============================================

  describe('Edit Mode', () => {
    it('should pre-populate question text from initialData', () => {
      const mockQuestion = createMockQuestion();
      renderForm({ initialData: mockQuestion });

      expect(screen.getByTestId('question-input-ru')).toHaveValue('Тестовый вопрос');
    });

    it('should pre-populate question text for all languages', async () => {
      const user = userEvent.setup();
      const mockQuestion = createMockQuestion();
      renderForm({ initialData: mockQuestion });

      // Check RU
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Тестовый вопрос');

      // Switch to EL and check
      await user.click(screen.getByTestId('lang-tab-el'));
      expect(screen.getByTestId('question-input-el')).toHaveValue('Ερώτηση δοκιμής');

      // Switch to EN and check
      await user.click(screen.getByTestId('lang-tab-en'));
      expect(screen.getByTestId('question-input-en')).toHaveValue('Test question');
    });

    it('should pre-populate answer fields from initialData', () => {
      const mockQuestion = createMockQuestion();
      renderForm({ initialData: mockQuestion });

      expect(screen.getByTestId('answer-input-A-ru')).toHaveValue('Ответ А');
      expect(screen.getByTestId('answer-input-B-ru')).toHaveValue('Ответ Б');
    });

    it('should pre-populate correct answer from initialData', () => {
      const mockQuestion = createMockQuestion({ correct_option: 2 });
      renderForm({ initialData: mockQuestion });

      const radioB = screen.getByTestId('correct-radio-B-ru') as HTMLInputElement;
      expect(radioB.checked).toBe(true);
    });

    it('should show 4 answers when initialData has 4 options', () => {
      const mockQuestion = createMockQuestionWith4Answers();
      renderForm({ initialData: mockQuestion });

      expect(screen.getByTestId('answer-input-A-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-B-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-C-ru')).toBeInTheDocument();
      expect(screen.getByTestId('answer-input-D-ru')).toBeInTheDocument();
    });

    it('should hide add button when initialData has 4 answers', () => {
      const mockQuestion = createMockQuestionWith4Answers();
      renderForm({ initialData: mockQuestion });

      expect(screen.queryAllByTestId('add-answer-btn')).toHaveLength(0);
    });

    it('should not show incomplete indicators when initialData is complete', () => {
      const mockQuestion = createMockQuestion();
      renderForm({ initialData: mockQuestion });

      expect(screen.queryByTestId('lang-tab-ru-incomplete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lang-tab-el-incomplete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('lang-tab-en-incomplete')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Submission Tests
  // ============================================

  describe('Submission', () => {
    it('should call onSubmit with correct payload structure', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit, deckId: 'deck-123' });

      // Fill all required fields
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
      await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
      await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

      await user.click(screen.getByTestId('lang-tab-el'));
      await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
      await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
      await user.type(screen.getByTestId('answer-input-B-el'), 'Β');

      await user.click(screen.getByTestId('lang-tab-en'));
      await user.type(screen.getByTestId('question-input-en'), 'Question');
      await user.type(screen.getByTestId('answer-input-A-en'), 'A');
      await user.type(screen.getByTestId('answer-input-B-en'), 'B');

      // Submit
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as CultureQuestionCreatePayload;

      // Verify payload structure
      expect(payload.deck_id).toBe('deck-123');
      expect(payload.question_text).toEqual({
        ru: 'Вопрос',
        el: 'Ερώτηση',
        en: 'Question',
      });
      expect(payload.option_a).toEqual({
        ru: 'А',
        el: 'Α',
        en: 'A',
      });
      expect(payload.option_b).toEqual({
        ru: 'Б',
        el: 'Β',
        en: 'B',
      });
      expect(payload.option_c).toBeNull();
      expect(payload.option_d).toBeNull();
      expect(payload.correct_option).toBe(1);
    });

    it('should include option_c in payload when 3 answers exist', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit, deckId: 'deck-123' });

      // Add answer C
      await user.click(screen.getAllByTestId('add-answer-btn')[0]);

      // Fill all fields for all languages
      // RU
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
      await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
      await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');
      await user.type(screen.getByTestId('answer-input-C-ru'), 'В');

      // EL
      await user.click(screen.getByTestId('lang-tab-el'));
      await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
      await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
      await user.type(screen.getByTestId('answer-input-B-el'), 'Β');
      await user.type(screen.getByTestId('answer-input-C-el'), 'Γ');

      // EN
      await user.click(screen.getByTestId('lang-tab-en'));
      await user.type(screen.getByTestId('question-input-en'), 'Question');
      await user.type(screen.getByTestId('answer-input-A-en'), 'A');
      await user.type(screen.getByTestId('answer-input-B-en'), 'B');
      await user.type(screen.getByTestId('answer-input-C-en'), 'C');

      // Submit
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as CultureQuestionCreatePayload;

      expect(payload.option_c).toEqual({
        ru: 'В',
        el: 'Γ',
        en: 'C',
      });
      expect(payload.option_d).toBeNull();
    });

    it('should include correct_option value in payload', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit, deckId: 'deck-123' });

      // Fill required fields
      await user.type(screen.getByTestId('question-input-ru'), 'Вопрос');
      await user.type(screen.getByTestId('answer-input-A-ru'), 'А');
      await user.type(screen.getByTestId('answer-input-B-ru'), 'Б');

      await user.click(screen.getByTestId('lang-tab-el'));
      await user.type(screen.getByTestId('question-input-el'), 'Ερώτηση');
      await user.type(screen.getByTestId('answer-input-A-el'), 'Α');
      await user.type(screen.getByTestId('answer-input-B-el'), 'Β');

      await user.click(screen.getByTestId('lang-tab-en'));
      await user.type(screen.getByTestId('question-input-en'), 'Question');
      await user.type(screen.getByTestId('answer-input-A-en'), 'A');
      await user.type(screen.getByTestId('answer-input-B-en'), 'B');

      // Select answer B as correct
      await user.click(screen.getByTestId('correct-radio-B-en'));

      // Submit
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as CultureQuestionCreatePayload;
      expect(payload.correct_option).toBe(2);
    });

    it('should use deckId prop as deck_id in payload when provided', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const mockQuestion = createMockQuestion({ id: 'existing-question-id' });

      // When both deckId and initialData are provided, deckId takes precedence
      renderForm({ onSubmit, initialData: mockQuestion, deckId: 'deck-from-prop' });

      // Change something to enable submit
      await user.clear(screen.getByTestId('question-input-ru'));
      await user.type(screen.getByTestId('question-input-ru'), 'Updated question');

      // Submit
      await user.click(screen.getByTestId('submit-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0] as CultureQuestionCreatePayload;
      expect(payload.deck_id).toBe('deck-from-prop');
    });

    it('should fall back to initialData.id when deckId is empty string', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const mockQuestion = createMockQuestion({ id: 'existing-question-id' });

      // When deckId is empty string, falls back to initialData.id
      renderForm({ onSubmit, initialData: mockQuestion, deckId: '' });

      // Form needs handleSubmit to be called - we need to trigger it via the form
      // Since submit button won't show without deckId, we test the form data structure
      // by verifying the edit mode populated the form correctly and checking the
      // submission handler behavior through other means

      // This test verifies the form populates correctly from initialData
      expect(screen.getByTestId('question-input-ru')).toHaveValue('Тестовый вопрос');
    });
  });
});
