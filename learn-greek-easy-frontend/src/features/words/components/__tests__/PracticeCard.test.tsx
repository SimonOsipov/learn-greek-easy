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

    it('renders Translation badge', () => {
      renderCard();

      expect(screen.getByText('Translation')).toBeInTheDocument();
    });

    it('renders POS badge from front_content.badge', () => {
      renderCard();

      expect(screen.getByTestId('part-of-speech-badge')).toBeInTheDocument();
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

    it('renders PartOfSpeechBadge on back side', () => {
      renderCard({ isFlipped: true });

      expect(screen.getByTestId('part-of-speech-badge')).toBeInTheDocument();
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

    it('all SRS buttons are disabled when onRate is not provided', () => {
      renderCard({ isFlipped: true });

      expect(screen.getByTestId('srs-button-again')).toBeDisabled();
      expect(screen.getByTestId('srs-button-hard')).toBeDisabled();
      expect(screen.getByTestId('srs-button-good')).toBeDisabled();
      expect(screen.getByTestId('srs-button-easy')).toBeDisabled();
    });

    it('enables SRS buttons when onRate is provided', () => {
      renderCard({ isFlipped: true, onRate: vi.fn() });

      expect(screen.getByTestId('srs-button-again')).not.toBeDisabled();
      expect(screen.getByTestId('srs-button-hard')).not.toBeDisabled();
      expect(screen.getByTestId('srs-button-good')).not.toBeDisabled();
      expect(screen.getByTestId('srs-button-easy')).not.toBeDisabled();
    });

    it('calls onRate with correct rating when SRS button clicked', () => {
      const onRate = vi.fn();
      renderCard({ isFlipped: true, onRate });

      fireEvent.click(screen.getByTestId('srs-button-again'));
      expect(onRate).toHaveBeenCalledWith(1);

      fireEvent.click(screen.getByTestId('srs-button-hard'));
      expect(onRate).toHaveBeenCalledWith(2);

      fireEvent.click(screen.getByTestId('srs-button-good'));
      expect(onRate).toHaveBeenCalledWith(3);

      fireEvent.click(screen.getByTestId('srs-button-easy'));
      expect(onRate).toHaveBeenCalledWith(4);
    });
  });

  describe('Hotkey Hints', () => {
    it('shows space hint on front side', () => {
      renderCard();
      expect(screen.getByText('Press Space to reveal')).toBeInTheDocument();
    });

    it('shows number hints below SRS buttons when onRate is provided', () => {
      renderCard({ isFlipped: true, onRate: vi.fn() });
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('does not show number hints when onRate is not provided', () => {
      renderCard({ isFlipped: true });
      // Number hints should NOT appear when onRate is not provided
      const allTexts = screen.queryAllByText(/^[1-4]$/);
      expect(allTexts.length).toBe(0);
    });
  });

  describe('Language Toggle', () => {
    it('does not render language toggle when translationRu is null', () => {
      renderCard({ isFlipped: true, translationRu: null });
      expect(screen.queryByTestId('lang-toggle')).not.toBeInTheDocument();
    });

    it('does not render language toggle when translationRu is undefined', () => {
      renderCard({ isFlipped: true });
      expect(screen.queryByTestId('lang-toggle')).not.toBeInTheDocument();
    });

    it('renders language toggle when translationRu is provided and card is flipped', () => {
      renderCard({ isFlipped: true, translationRu: '\u0434\u043E\u043C' });
      expect(screen.getByTestId('lang-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('lang-toggle-en')).toBeInTheDocument();
      expect(screen.getByTestId('lang-toggle-ru')).toBeInTheDocument();
    });

    it('does not render language toggle on front side', () => {
      renderCard({ isFlipped: false, translationRu: '\u0434\u043E\u043C' });
      expect(screen.queryByTestId('lang-toggle')).not.toBeInTheDocument();
    });

    it('shows English answer by default', () => {
      renderCard({ isFlipped: true, translationRu: '\u0434\u043E\u043C' });
      expect(screen.getByText('house')).toBeInTheDocument();
    });

    it('switches to Russian translation when RU button clicked', () => {
      renderCard({ isFlipped: true, translationRu: '\u0434\u043E\u043C' });
      fireEvent.click(screen.getByTestId('lang-toggle-ru'));
      expect(screen.getByText('\u0434\u043E\u043C')).toBeInTheDocument();
    });

    it('switches back to English when EN button clicked after switching to RU', () => {
      renderCard({ isFlipped: true, translationRu: '\u0434\u043E\u043C' });
      fireEvent.click(screen.getByTestId('lang-toggle-ru'));
      fireEvent.click(screen.getByTestId('lang-toggle-en'));
      expect(screen.getByText('house')).toBeInTheDocument();
    });
  });
});
