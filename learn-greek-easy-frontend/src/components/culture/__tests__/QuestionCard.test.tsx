/**
 * QuestionCard Component Tests
 *
 * Tests for the QuestionCard and QuestionCardSkeleton components, covering:
 * - Question number display
 * - Localized question text
 * - Option count display
 * - Status dot colors for all 4 statuses
 * - MasteryDots filled count
 * - NOT clickable (no role=button, no tabIndex)
 * - QuestionCardSkeleton rendering
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { renderWithProviders } from '@/lib/test-utils';
import type { CultureQuestionBrowseItem } from '@/types/culture';

import { QuestionCard, QuestionCardSkeleton } from '../QuestionCard';

// ============================================
// Mock data
// ============================================

const makeQuestion = (
  overrides: Partial<CultureQuestionBrowseItem> = {}
): CultureQuestionBrowseItem => ({
  id: 'q-1',
  question_text: {
    el: 'Ελληνικό κείμενο;',
    en: 'What is the capital of Greece?',
    ru: 'Какова столица Греции?',
  },
  option_count: 4,
  order_index: 0,
  status: 'new',
  ...overrides,
});

// ============================================
// QuestionCard tests
// ============================================

describe('QuestionCard', () => {
  describe('Content Display', () => {
    it('renders question number as #1 for order_index=0', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ order_index: 0 })} />);
      expect(screen.getByTestId('question-card-number')).toHaveTextContent('#1');
    });

    it('renders question number as #5 for order_index=4', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ order_index: 4 })} />);
      expect(screen.getByTestId('question-card-number')).toHaveTextContent('#5');
    });

    it('renders localized question text in English', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} />);
      expect(screen.getByTestId('question-card-text')).toHaveTextContent(
        'What is the capital of Greece?'
      );
    });

    it('renders option count text', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ option_count: 3 })} />);
      // The i18n key is deck.options with count=3; expect "3 options" or similar
      const optionsEl = screen.getByTestId('question-card-options');
      expect(optionsEl).toBeInTheDocument();
      // Text contains the count
      expect(optionsEl.textContent).toContain('3');
    });
  });

  describe('Status Dot Colors', () => {
    it('status "new" shows muted dot', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'new' })} />);
      const dot = screen.getByTestId('question-card-status-dot');
      expect(dot.className).toContain('bg-muted-foreground/30');
    });

    it('status "learning" shows primary dot', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'learning' })} />);
      const dot = screen.getByTestId('question-card-status-dot');
      expect(dot.className).toContain('bg-primary');
    });

    it('status "review" shows primary dot', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'review' })} />);
      const dot = screen.getByTestId('question-card-status-dot');
      expect(dot.className).toContain('bg-primary');
    });

    it('status "mastered" shows success dot', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'mastered' })} />);
      const dot = screen.getByTestId('question-card-status-dot');
      expect(dot.className).toContain('bg-success');
    });
  });

  describe('MasteryDots filled count', () => {
    it('status "new" → 0 filled dots (aria-label "Progress: 0 of 4")', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'new' })} />);
      const dots = screen.getByTestId('mastery-dots');
      expect(dots).toHaveAttribute('aria-label', 'Progress: 0 of 4');
    });

    it('status "learning" → 1 filled dot (aria-label "Progress: 1 of 4")', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'learning' })} />);
      const dots = screen.getByTestId('mastery-dots');
      expect(dots).toHaveAttribute('aria-label', 'Progress: 1 of 4');
    });

    it('status "review" → 2 filled dots (aria-label "Progress: 2 of 4")', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'review' })} />);
      const dots = screen.getByTestId('mastery-dots');
      expect(dots).toHaveAttribute('aria-label', 'Progress: 2 of 4');
    });

    it('status "mastered" → 4 filled dots (aria-label "Progress: 4 of 4")', () => {
      renderWithProviders(<QuestionCard question={makeQuestion({ status: 'mastered' })} />);
      const dots = screen.getByTestId('mastery-dots');
      expect(dots).toHaveAttribute('aria-label', 'Progress: 4 of 4');
    });
  });

  describe('Non-clickable', () => {
    it('does not have role="button"', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} />);
      const card = screen.getByTestId('question-card');
      expect(card).not.toHaveAttribute('role', 'button');
    });

    it('does not have tabIndex attribute', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} />);
      const card = screen.getByTestId('question-card');
      expect(card).not.toHaveAttribute('tabIndex');
    });

    it('does not render any button elements inside', () => {
      const { container } = renderWithProviders(<QuestionCard question={makeQuestion()} />);
      const buttons = container.querySelectorAll('button');
      expect(buttons).toHaveLength(0);
    });
  });

  describe('Language Prop Override', () => {
    it('renders Greek text when language="el" is provided', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} language="el" />);
      expect(screen.getByTestId('question-card-text')).toHaveTextContent('Ελληνικό κείμενο;');
    });

    it('renders Russian text when language="ru" is provided', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} language="ru" />);
      expect(screen.getByTestId('question-card-text')).toHaveTextContent('Какова столица Греции?');
    });

    it('falls back to i18n.language when language prop is omitted', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} />);
      expect(screen.getByTestId('question-card-text')).toHaveTextContent(
        'What is the capital of Greece?'
      );
    });

    it('falls back to English text when language="" (empty string)', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} language="" />);
      expect(screen.getByTestId('question-card-text')).toHaveTextContent(
        'What is the capital of Greece?'
      );
    });
  });

  describe('Click Behavior', () => {
    it('calls onClick with question id when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<QuestionCard question={makeQuestion()} onClick={handleClick} />);
      const card = screen.getByTestId('question-card');
      await user.click(card);
      expect(handleClick).toHaveBeenCalledWith('q-1');
    });

    it('triggers onClick on Enter keypress', () => {
      const handleClick = vi.fn();
      renderWithProviders(<QuestionCard question={makeQuestion()} onClick={handleClick} />);
      const card = screen.getByTestId('question-card');
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledWith('q-1');
    });

    it('triggers onClick on Space keypress', () => {
      const handleClick = vi.fn();
      renderWithProviders(<QuestionCard question={makeQuestion()} onClick={handleClick} />);
      const card = screen.getByTestId('question-card');
      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledWith('q-1');
    });

    it('has cursor-pointer class when onClick provided', () => {
      const handleClick = vi.fn();
      renderWithProviders(<QuestionCard question={makeQuestion()} onClick={handleClick} />);
      const card = screen.getByTestId('question-card');
      expect(card.className).toContain('cursor-pointer');
    });

    it('does not have cursor-pointer when onClick omitted', () => {
      renderWithProviders(<QuestionCard question={makeQuestion()} />);
      const card = screen.getByTestId('question-card');
      expect(card.className).not.toContain('cursor-pointer');
    });
  });
});

describe('QuestionCardSkeleton', () => {
  it('renders with data-testid="question-card-skeleton"', () => {
    render(<QuestionCardSkeleton />);
    expect(screen.getByTestId('question-card-skeleton')).toBeInTheDocument();
  });
});
