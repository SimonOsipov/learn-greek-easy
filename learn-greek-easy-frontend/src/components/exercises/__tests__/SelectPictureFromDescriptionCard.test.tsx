// src/components/exercises/__tests__/SelectPictureFromDescriptionCard.test.tsx

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from 'i18next';
import ruCommon from '@/i18n/locales/ru/common.json';

import { renderWithProviders, screen } from '@/lib/test-utils';
import type { ExerciseItemPayload } from '@/services/exerciseAPI';

import { SelectPictureFromDescriptionCard } from '../SelectPictureFromDescriptionCard';

// ============================================
// Mocks
// ============================================

// PictureOption renders an <img> that starts loading externally; skip that in unit tests.
vi.mock('../PictureOption', () => ({
  PictureOption: ({
    alt,
    optionIndex,
    exerciseId,
  }: {
    imageUrl: string | null;
    optionIndex: number;
    exerciseId: string;
    alt: string;
    className?: string;
  }) => (
    <div
      data-testid={`picture-option-${optionIndex}`}
      data-exercise-id={exerciseId}
      aria-label={alt}
    />
  ),
}));

// ============================================
// Helpers
// ============================================

function makeItems(count = 4): ExerciseItemPayload[] {
  const options = Array.from({ length: count }, (_, i) => ({
    option_index: i,
    image_url: `https://cdn.example.com/img-${i}.jpg`,
    description_text: null,
  }));
  return [
    {
      item_index: 0,
      payload: {
        prompt_description: 'Στην καφετέρια',
        options,
        correct_index: 2,
      },
    },
  ];
}

interface RenderOpts {
  items?: ExerciseItemPayload[];
  onAnswer?: ReturnType<typeof vi.fn>;
  feedbackState?: { selectedIndex: number; correctIndex: number } | null;
  disabled?: boolean;
  exerciseId?: string;
}

function renderCard({
  items = makeItems(),
  onAnswer = vi.fn(),
  feedbackState = null,
  disabled = false,
  exerciseId = 'ex-1',
}: RenderOpts = {}) {
  return renderWithProviders(
    <SelectPictureFromDescriptionCard
      items={items}
      onAnswer={onAnswer}
      feedbackState={feedbackState}
      disabled={disabled}
      exerciseId={exerciseId}
    />
  );
}

// ============================================
// Tests
// ============================================

describe('SelectPictureFromDescriptionCard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders the localized prompt heading (EN)', () => {
      renderCard();
      expect(screen.getByText('Pick the matching picture')).toBeInTheDocument();
    });

    it('renders the Greek prompt_description text', () => {
      renderCard();
      expect(screen.getByText('Στην καφετέρια')).toBeInTheDocument();
    });

    it('renders 4 option buttons with aria-labels', () => {
      renderCard();
      for (let i = 0; i < 4; i++) {
        const btn = screen.getByTestId(`spfd-option-${i}`);
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveAttribute('aria-label', `Picture option ${i + 1}`);
      }
    });

    it('does not render a 5th option button when only 4 options given', () => {
      renderCard();
      expect(screen.queryByTestId('spfd-option-4')).not.toBeInTheDocument();
    });

    it('renders nothing when items array is empty', () => {
      renderCard({ items: [] });
      expect(screen.queryByTestId('spfd-renderer')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Interaction
  // ============================================

  describe('Interaction', () => {
    it('calls onAnswer(selectedIdx, correctIdx) exactly once on click', async () => {
      const onAnswer = vi.fn();
      renderCard({ onAnswer });

      await screen.getByTestId('spfd-option-0').click();

      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith(0, 2);
    });

    it('does not call onAnswer when disabled=true', async () => {
      const onAnswer = vi.fn();
      renderCard({ onAnswer, disabled: true });

      await screen.getByTestId('spfd-option-0').click();

      expect(onAnswer).not.toHaveBeenCalled();
    });

    it('does not call onAnswer when feedbackState is active', async () => {
      const onAnswer = vi.fn();
      renderCard({
        onAnswer,
        feedbackState: { selectedIndex: 0, correctIndex: 2 },
      });

      await screen.getByTestId('spfd-option-1').click();

      expect(onAnswer).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Feedback state
  // ============================================

  describe('Feedback styling', () => {
    it('sets aria-pressed=true on the selected option after feedback', () => {
      renderCard({ feedbackState: { selectedIndex: 1, correctIndex: 2 } });

      expect(screen.getByTestId('spfd-option-1')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('spfd-option-0')).toHaveAttribute('aria-pressed', 'false');
    });

    it('disables all options during feedback', () => {
      renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 2 } });

      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId(`spfd-option-${i}`)).toBeDisabled();
      }
    });

    it('applies correct border class to the correct option on correct answer', () => {
      renderCard({ feedbackState: { selectedIndex: 2, correctIndex: 2 } });

      const correctBtn = screen.getByTestId('spfd-option-2');
      expect(correctBtn.className).toContain('practice-correct');
    });

    it('applies incorrect border class to selected wrong option', () => {
      renderCard({ feedbackState: { selectedIndex: 1, correctIndex: 2 } });

      const incorrectBtn = screen.getByTestId('spfd-option-1');
      expect(incorrectBtn.className).toContain('practice-incorrect');
    });
  });

  // ============================================
  // Aria-live announcement
  // ============================================

  describe('Aria-live announcement', () => {
    it('announces correct text when answer is correct (EN)', () => {
      renderCard({ feedbackState: { selectedIndex: 2, correctIndex: 2 } });

      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion!.textContent).toBe('Correct!');
    });

    it('announces incorrect text with correct option number when answer is wrong (EN)', () => {
      // correct_index=2 → option number = 3
      renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 2 } });

      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion!.textContent).toBe('Incorrect. The correct answer was option 3.');
    });

    it('shows empty announcement when feedbackState is null', () => {
      renderCard({ feedbackState: null });

      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion!.textContent).toBe('');
    });

    describe('RU locale', () => {
      beforeAll(() => {
        // Add Russian translations to the test i18n instance
        i18n.addResourceBundle('ru', 'common', ruCommon, true, true);
      });

      beforeEach(async () => {
        await i18n.changeLanguage('ru');
      });

      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('renders prompt heading in Russian', () => {
        renderCard();
        expect(screen.getByText('Выберите подходящую картинку')).toBeInTheDocument();
      });

      it('announces correct in Russian', () => {
        renderCard({ feedbackState: { selectedIndex: 2, correctIndex: 2 } });
        const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion!.textContent).toBe('Правильно!');
      });

      it('announces incorrect in Russian with option number', () => {
        renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 2 } });
        const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion!.textContent).toBe('Неправильно. Правильный ответ — вариант 3.');
      });

      it('renders option aria-labels in Russian', () => {
        renderCard();
        const btn = screen.getByTestId('spfd-option-0');
        expect(btn).toHaveAttribute('aria-label', 'Вариант с картинкой 1');
      });
    });
  });

  // ============================================
  // Keyboard navigation (2×2 grid)
  // ============================================

  describe('Keyboard navigation', () => {
    it('ArrowRight from option 0 focuses option 1', () => {
      renderCard();
      const btn0 = screen.getByTestId('spfd-option-0');
      const btn1 = screen.getByTestId('spfd-option-1');

      btn0.focus();
      btn0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      expect(document.activeElement).toBe(btn1);
    });

    it('ArrowDown from option 0 focuses option 2', () => {
      renderCard();
      const btn0 = screen.getByTestId('spfd-option-0');
      const btn2 = screen.getByTestId('spfd-option-2');

      btn0.focus();
      btn0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(btn2);
    });

    it('ArrowLeft from option 1 focuses option 0', () => {
      renderCard();
      const btn0 = screen.getByTestId('spfd-option-0');
      const btn1 = screen.getByTestId('spfd-option-1');

      btn1.focus();
      btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

      expect(document.activeElement).toBe(btn0);
    });

    it('ArrowUp from option 2 focuses option 0', () => {
      renderCard();
      const btn0 = screen.getByTestId('spfd-option-0');
      const btn2 = screen.getByTestId('spfd-option-2');

      btn2.focus();
      btn2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(btn0);
    });

    it('ArrowRight from option 1 (right edge) does not move focus', () => {
      renderCard();
      const btn1 = screen.getByTestId('spfd-option-1');

      btn1.focus();
      btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      // Focus stays on btn1 (no option at col 2)
      expect(document.activeElement).toBe(btn1);
    });

    it('ArrowDown from option 2 (bottom row) does not move focus', () => {
      renderCard();
      const btn2 = screen.getByTestId('spfd-option-2');

      btn2.focus();
      btn2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(btn2);
    });
  });

  // ============================================
  // Disabled state
  // ============================================

  describe('Disabled state', () => {
    it('disables all option buttons when disabled=true', () => {
      renderCard({ disabled: true });

      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId(`spfd-option-${i}`)).toBeDisabled();
      }
    });
  });
});
