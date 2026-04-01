// src/components/exercises/__tests__/SelectCorrectAnswerRenderer.test.tsx

import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { renderWithProviders, screen } from '@/lib/test-utils';
import type { ExerciseItemPayload } from '@/services/exerciseAPI';

import { SelectCorrectAnswerRenderer } from '../SelectCorrectAnswerRenderer';

// ============================================
// Helpers
// ============================================

function makeItems(optionCount: number): ExerciseItemPayload[] {
  return [
    {
      item_index: 0,
      payload: {
        prompt: { el: 'Ερώτηση', en: 'Question prompt', ru: 'Вопрос' },
        options: Array.from({ length: optionCount }, (_, i) => ({
          el: `Επιλογή ${i + 1}`,
          en: `Option ${i + 1}`,
          ru: `Вариант ${i + 1}`,
        })),
        correct_answer_index: 0,
      },
    },
  ];
}

function renderRenderer({
  items = makeItems(2),
  onAnswer = vi.fn(),
  feedbackState = null,
  disabled = false,
}: {
  items?: ExerciseItemPayload[];
  onAnswer?: ReturnType<typeof vi.fn>;
  feedbackState?: { selectedIndex: number; correctIndex: number } | null;
  disabled?: boolean;
} = {}) {
  return renderWithProviders(
    <SelectCorrectAnswerRenderer
      items={items}
      onAnswer={onAnswer}
      feedbackState={feedbackState}
      disabled={disabled}
    />
  );
}

// ============================================
// Tests
// ============================================

describe('SelectCorrectAnswerRenderer', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders prompt and 2 options', () => {
      renderRenderer({ items: makeItems(2) });
      expect(screen.getByTestId('sca-prompt')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-0')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-1')).toBeInTheDocument();
    });

    it('renders 3 options', () => {
      renderRenderer({ items: makeItems(3) });
      expect(screen.getByTestId('sca-option-0')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-1')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-2')).toBeInTheDocument();
      expect(screen.queryByTestId('sca-option-3')).not.toBeInTheDocument();
    });

    it('renders 4 options', () => {
      renderRenderer({ items: makeItems(4) });
      expect(screen.getByTestId('sca-option-0')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-1')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-2')).toBeInTheDocument();
      expect(screen.getByTestId('sca-option-3')).toBeInTheDocument();
    });
  });

  // ============================================
  // Interaction
  // ============================================

  describe('Interaction', () => {
    it('calls onAnswer with (selectedIndex, correctIndex) when option clicked', async () => {
      const onAnswer = vi.fn();
      renderRenderer({ items: makeItems(2), onAnswer });

      await screen.getByTestId('sca-option-1').click();

      expect(onAnswer).toHaveBeenCalledWith(1, 0);
    });

    it('does not call onAnswer when disabled prop is true', async () => {
      const onAnswer = vi.fn();
      renderRenderer({ items: makeItems(2), onAnswer, disabled: true });

      await screen.getByTestId('sca-option-0').click();

      expect(onAnswer).not.toHaveBeenCalled();
    });

    it('does not call onAnswer when feedbackState is active', async () => {
      const onAnswer = vi.fn();
      renderRenderer({
        items: makeItems(2),
        onAnswer,
        feedbackState: { selectedIndex: 0, correctIndex: 0 },
      });

      // button is disabled during feedback, so click should not fire
      await screen.getByTestId('sca-option-1').click();

      expect(onAnswer).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Feedback styling
  // ============================================

  describe('Feedback styling', () => {
    it('applies green styling to correct option during feedback', () => {
      renderRenderer({
        items: makeItems(2),
        feedbackState: { selectedIndex: 0, correctIndex: 0 },
      });

      const correctOption = screen.getByTestId('sca-option-0');
      expect(correctOption.className).toContain('practice-correct');
    });

    it('applies red styling to incorrect selected option during feedback', () => {
      renderRenderer({
        items: makeItems(2),
        feedbackState: { selectedIndex: 1, correctIndex: 0 },
      });

      const incorrectOption = screen.getByTestId('sca-option-1');
      expect(incorrectOption.className).toContain('practice-incorrect');
    });

    it('disables all options during feedback', () => {
      renderRenderer({
        items: makeItems(2),
        feedbackState: { selectedIndex: 0, correctIndex: 0 },
      });

      expect(screen.getByTestId('sca-option-0')).toBeDisabled();
      expect(screen.getByTestId('sca-option-1')).toBeDisabled();
    });
  });

  // ============================================
  // Disabled state
  // ============================================

  describe('Disabled state', () => {
    it('disables all option buttons when disabled=true', () => {
      renderRenderer({ items: makeItems(2), disabled: true });

      expect(screen.getByTestId('sca-option-0')).toBeDisabled();
      expect(screen.getByTestId('sca-option-1')).toBeDisabled();
    });
  });

  // ============================================
  // Language selection
  // ============================================

  describe('Language selection', () => {
    it('renders English text by default (EN locale)', async () => {
      await i18n.changeLanguage('en');
      renderRenderer({ items: makeItems(2) });

      expect(screen.getByText('Question prompt')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('renders Russian text when locale is RU', async () => {
      await i18n.changeLanguage('ru');
      renderRenderer({ items: makeItems(2) });

      expect(screen.getByText('Вопрос')).toBeInTheDocument();
      expect(screen.getByText('Вариант 1')).toBeInTheDocument();
    });
  });
});
