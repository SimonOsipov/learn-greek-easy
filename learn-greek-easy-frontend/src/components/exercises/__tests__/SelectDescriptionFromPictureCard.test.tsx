// src/components/exercises/__tests__/SelectDescriptionFromPictureCard.test.tsx

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from 'i18next';
import ruCommon from '@/i18n/locales/ru/common.json';

import { renderWithProviders, screen } from '@/lib/test-utils';
import type { ExerciseItemPayload } from '@/services/exerciseAPI';

import { SelectDescriptionFromPictureCard } from '../SelectDescriptionFromPictureCard';

// ============================================
// Mocks
// ============================================

// PictureOption renders an <img> that starts loading externally; skip that in unit tests.
vi.mock('../PictureOption', () => ({
  PictureOption: ({
    alt,
    optionIndex,
    exerciseId,
    className,
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
      className={className}
    />
  ),
}));

// ============================================
// Helpers
// ============================================

function makeItems(count = 4): ExerciseItemPayload[] {
  const options = Array.from({ length: count }, (_, i) => ({
    option_index: i,
    image_url: null,
    description_text: `Description option ${i + 1}`,
  }));
  return [
    {
      item_index: 0,
      payload: {
        anchor_image_url: 'https://cdn.example.com/anchor.jpg',
        options,
        correct_index: 1,
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
  exerciseId = 'ex-2',
}: RenderOpts = {}) {
  return renderWithProviders(
    <SelectDescriptionFromPictureCard
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

describe('SelectDescriptionFromPictureCard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Rendering
  // ============================================

  describe('Rendering', () => {
    it('renders the localized prompt heading (EN)', () => {
      renderCard();
      expect(screen.getByText('Pick the matching description')).toBeInTheDocument();
    });

    it('renders the anchor picture via PictureOption with anchorAlt text', () => {
      renderCard();
      // The anchor PictureOption is rendered with optionIndex=0 and the anchorAlt i18n key
      const anchorImg = screen.getByTestId('picture-option-0');
      expect(anchorImg).toBeInTheDocument();
      expect(anchorImg).toHaveAttribute('aria-label', 'Anchor picture for description matching');
    });

    it('renders 4 description option buttons with description text', () => {
      renderCard();
      for (let i = 0; i < 4; i++) {
        const btn = screen.getByTestId(`sdfp-option-${i}`);
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveTextContent(`Description option ${i + 1}`);
      }
    });

    it('renders option buttons with correct aria-labels', () => {
      renderCard();
      for (let i = 0; i < 4; i++) {
        const btn = screen.getByTestId(`sdfp-option-${i}`);
        expect(btn).toHaveAttribute('aria-label', `Description option ${i + 1}`);
      }
    });

    it('renders nothing when items array is empty', () => {
      renderCard({ items: [] });
      expect(screen.queryByTestId('sdfp-renderer')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Interaction
  // ============================================

  describe('Interaction', () => {
    it('calls onAnswer(selectedIdx, correctIdx) exactly once on click', async () => {
      const onAnswer = vi.fn();
      renderCard({ onAnswer });

      await screen.getByTestId('sdfp-option-0').click();

      expect(onAnswer).toHaveBeenCalledTimes(1);
      expect(onAnswer).toHaveBeenCalledWith(0, 1);
    });

    it('does not call onAnswer when disabled=true', async () => {
      const onAnswer = vi.fn();
      renderCard({ onAnswer, disabled: true });

      await screen.getByTestId('sdfp-option-0').click();

      expect(onAnswer).not.toHaveBeenCalled();
    });

    it('does not call onAnswer when feedbackState is active', async () => {
      const onAnswer = vi.fn();
      renderCard({
        onAnswer,
        feedbackState: { selectedIndex: 0, correctIndex: 1 },
      });

      await screen.getByTestId('sdfp-option-2').click();

      expect(onAnswer).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Feedback state
  // ============================================

  describe('Feedback styling', () => {
    it('sets aria-pressed=true on the selected option after feedback', () => {
      renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 1 } });

      expect(screen.getByTestId('sdfp-option-0')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('sdfp-option-1')).toHaveAttribute('aria-pressed', 'false');
    });

    it('disables all options during feedback', () => {
      renderCard({ feedbackState: { selectedIndex: 1, correctIndex: 1 } });

      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId(`sdfp-option-${i}`)).toBeDisabled();
      }
    });

    it('applies correct border class to the correct option', () => {
      renderCard({ feedbackState: { selectedIndex: 1, correctIndex: 1 } });

      const correctBtn = screen.getByTestId('sdfp-option-1');
      expect(correctBtn.className).toContain('practice-correct');
    });

    it('applies incorrect border class to the selected wrong option', () => {
      renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 1 } });

      const incorrectBtn = screen.getByTestId('sdfp-option-0');
      expect(incorrectBtn.className).toContain('practice-incorrect');
    });
  });

  // ============================================
  // Aria-live announcement
  // ============================================

  describe('Aria-live announcement', () => {
    it('announces correct text when answer is correct (EN)', () => {
      renderCard({ feedbackState: { selectedIndex: 1, correctIndex: 1 } });

      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion!.textContent).toBe('Correct!');
    });

    it('announces incorrect text with correct option number when answer is wrong (EN)', () => {
      // correct_index=1 → option number = 2
      renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 1 } });

      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion!.textContent).toBe('Incorrect. The correct answer was option 2.');
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
        expect(screen.getByText('Выберите подходящее описание')).toBeInTheDocument();
      });

      it('announces correct in Russian', () => {
        renderCard({ feedbackState: { selectedIndex: 1, correctIndex: 1 } });
        const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion!.textContent).toBe('Правильно!');
      });

      it('announces incorrect in Russian with option number', () => {
        renderCard({ feedbackState: { selectedIndex: 0, correctIndex: 1 } });
        const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion!.textContent).toBe('Неправильно. Правильный ответ — вариант 2.');
      });

      it('renders option aria-labels in Russian', () => {
        renderCard();
        const btn = screen.getByTestId('sdfp-option-0');
        expect(btn).toHaveAttribute('aria-label', 'Описание 1');
      });

      it('renders anchor alt text in Russian', () => {
        renderCard();
        const anchor = screen.getByTestId('picture-option-0');
        expect(anchor).toHaveAttribute('aria-label', 'Опорное изображение для выбора описания');
      });
    });
  });

  // ============================================
  // Keyboard navigation (vertical list)
  // ============================================

  describe('Keyboard navigation', () => {
    it('ArrowDown from option 0 focuses option 1', () => {
      renderCard();
      const btn0 = screen.getByTestId('sdfp-option-0');
      const btn1 = screen.getByTestId('sdfp-option-1');

      btn0.focus();
      btn0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(btn1);
    });

    it('ArrowUp from option 1 focuses option 0', () => {
      renderCard();
      const btn0 = screen.getByTestId('sdfp-option-0');
      const btn1 = screen.getByTestId('sdfp-option-1');

      btn1.focus();
      btn1.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(btn0);
    });

    it('ArrowDown from last option does not move focus', () => {
      renderCard();
      const lastBtn = screen.getByTestId('sdfp-option-3');

      lastBtn.focus();
      lastBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

      expect(document.activeElement).toBe(lastBtn);
    });

    it('ArrowUp from option 0 does not move focus', () => {
      renderCard();
      const btn0 = screen.getByTestId('sdfp-option-0');

      btn0.focus();
      btn0.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(document.activeElement).toBe(btn0);
    });

    it('ArrowDown moves through options sequentially', () => {
      renderCard();
      const btns = [0, 1, 2, 3].map((i) => screen.getByTestId(`sdfp-option-${i}`));

      btns[0].focus();
      btns[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(document.activeElement).toBe(btns[1]);

      btns[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      expect(document.activeElement).toBe(btns[2]);
    });
  });

  // ============================================
  // Disabled state
  // ============================================

  describe('Disabled state', () => {
    it('disables all option buttons when disabled=true', () => {
      renderCard({ disabled: true });

      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId(`sdfp-option-${i}`)).toBeDisabled();
      }
    });
  });
});
