/**
 * PracticeCard Component Tests
 *
 * Tests for the PracticeCard flashcard component.
 * Covers:
 * - Front side rendering (badge, main text, sub text, tap-to-reveal hint)
 * - Back side rendering (answer, answer_sub, example context)
 * - Flip interaction (onFlip callback on front click, no callback on back click)
 * - SRS buttons (all four rendered, all disabled)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { CardRecordResponse } from '@/services/wordEntryAPI';

import { PracticeCard } from '../PracticeCard';
import type { PracticeCardProps } from '../PracticeCard';

// ============================================
// Mock Data
// ============================================

const mockCard: CardRecordResponse = {
  id: 'card-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'meaning_el_to_en',
  tier: 1,
  front_content: {
    card_type: 'meaning_el_to_en',
    prompt: 'What does this mean?',
    main: '\u03C3\u03C0\u03AF\u03C4\u03B9',
    sub: '[spee-tee]',
    badge: 'Noun',
    hint: null,
  },
  back_content: {
    card_type: 'meaning_el_to_en',
    answer: 'house',
    answer_sub: 'dwelling, residence',
    context: {
      label: 'Example',
      greek:
        '\u03A4\u03BF \u03C3\u03C0\u03AF\u03C4\u03B9 \u03BC\u03BF\u03C5 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03B9\u03BA\u03C1\u03CC.',
      english: 'My house is small.',
      tense: null,
    },
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// ============================================
// Render Helper
// ============================================

function renderCard(props: Partial<PracticeCardProps> = {}) {
  const defaultProps: PracticeCardProps = {
    card: mockCard,
    isFlipped: false,
    onFlip: vi.fn(),
  };
  return render(
    <TooltipProvider>
      <PracticeCard {...defaultProps} {...props} />
    </TooltipProvider>
  );
}

// ============================================
// Tests
// ============================================

describe('PracticeCard', () => {
  describe('Front Side Rendering', () => {
    it('renders main text from front_content.main', () => {
      renderCard();

      expect(screen.getByText('\u03C3\u03C0\u03AF\u03C4\u03B9')).toBeInTheDocument();
    });

    it('renders sub text from front_content.sub', () => {
      renderCard();

      expect(screen.getByText('[spee-tee]')).toBeInTheDocument();
    });

    it('renders Meaning badge', () => {
      renderCard();

      expect(screen.getByText('Meaning')).toBeInTheDocument();
    });

    it('renders POS badge from front_content.badge', () => {
      renderCard();

      expect(screen.getByText('Noun')).toBeInTheDocument();
    });

    it('renders "Tap to reveal" hint', () => {
      renderCard();

      expect(screen.getByText('Tap to reveal')).toBeInTheDocument();
    });
  });

  describe('Back Side Rendering', () => {
    it('renders answer from back_content.answer', () => {
      renderCard({ isFlipped: true });

      expect(screen.getByText('house')).toBeInTheDocument();
    });

    it('renders answer_sub from back_content.answer_sub', () => {
      renderCard({ isFlipped: true });

      expect(screen.getByText('dwelling, residence')).toBeInTheDocument();
    });

    it('renders example context when present', () => {
      renderCard({ isFlipped: true });

      expect(
        screen.getByText(
          '\u03A4\u03BF \u03C3\u03C0\u03AF\u03C4\u03B9 \u03BC\u03BF\u03C5 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03BC\u03B9\u03BA\u03C1\u03CC.'
        )
      ).toBeInTheDocument();
      expect(screen.getByText('My house is small.')).toBeInTheDocument();
    });
  });

  describe('Flip Interaction', () => {
    it('calls onFlip when card is clicked on front side', () => {
      const onFlip = vi.fn();
      renderCard({ isFlipped: false, onFlip });

      const card = screen.getByTestId('practice-card');
      fireEvent.click(card);

      expect(onFlip).toHaveBeenCalledOnce();
    });

    it('does NOT call onFlip when card is clicked on back side', () => {
      const onFlip = vi.fn();
      renderCard({ isFlipped: true, onFlip });

      const card = screen.getByTestId('practice-card');
      fireEvent.click(card);

      expect(onFlip).not.toHaveBeenCalled();
    });
  });

  describe('SRS Buttons', () => {
    it('renders all four SRS buttons when flipped', () => {
      renderCard({ isFlipped: true });

      expect(screen.getByTestId('srs-button-again')).toBeInTheDocument();
      expect(screen.getByTestId('srs-button-hard')).toBeInTheDocument();
      expect(screen.getByTestId('srs-button-good')).toBeInTheDocument();
      expect(screen.getByTestId('srs-button-easy')).toBeInTheDocument();
    });

    it('all SRS buttons are disabled', () => {
      renderCard({ isFlipped: true });

      expect(screen.getByTestId('srs-button-again')).toBeDisabled();
      expect(screen.getByTestId('srs-button-hard')).toBeDisabled();
      expect(screen.getByTestId('srs-button-good')).toBeDisabled();
      expect(screen.getByTestId('srs-button-easy')).toBeDisabled();
    });
  });
});
