/**
 * PracticeCard — SRS loop & localization tests (test-coverage audit)
 *
 * Colocated companion to the broader suite in
 * src/features/words/components/__tests__/PracticeCard.test.tsx.
 *
 * Focuses on the audit-flagged paths for this component:
 * - displayAnswer for meaning_en_to_el in RU (+ fallback when translationRu absent)
 * - sentence_translation target_to_el RU front swap
 * - translatePrompt per card_type + the fallback that must NOT leak English to RU users
 * - rate button fires onRate(3) and is disabled when onRate is absent
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import i18n from 'i18next';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { CardRecordResponse } from '@/services/wordEntryAPI';

import { PracticeCard } from '@/components/shared/PracticeCard';
import type { PracticeCardProps } from '@/components/shared/PracticeCard';

vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({ audioUrl }: { audioUrl: string | null | undefined }) =>
    audioUrl ? <button data-testid="speaker-button">Play</button> : null,
}));

vi.mock('@/components/ui/AudioSpeedToggle', () => ({
  AudioSpeedToggle: ({ speed }: { speed?: number }) => (
    <div data-testid="audio-speed-toggle" data-speed={speed} />
  ),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

// ============================================
// Mock Data
// ============================================

const mockEnToElCard: CardRecordResponse = {
  id: 'card-en-to-el-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'meaning_en_to_el',
  tier: 1,
  front_content: {
    card_type: 'meaning_en_to_el',
    prompt: 'How do you say this in Greek?',
    main: 'house',
    sub: null,
    badge: 'Noun',
    hint: null,
  },
  back_content: {
    card_type: 'meaning_en_to_el',
    answer: 'σπίτι',
    answer_sub: '/spee-tee/',
    context: null,
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockTargetToElSentenceCard: CardRecordResponse = {
  id: 'card-target-to-el-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'sentence_translation',
  tier: 1,
  front_content: {
    card_type: 'sentence_translation',
    prompt: 'Translate to Greek',
    main: 'Good morning!',
    sub: null,
    badge: 'Sentence',
    hint: null,
    example_id: 'example-001',
  },
  back_content: {
    card_type: 'sentence_translation',
    answer: 'Καλημέρα σας!',
    answer_sub: null,
    answer_ru: 'Доброе утро!',
    context: null,
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
    card: mockEnToElCard,
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

describe('PracticeCard — audit cases', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  describe('displayAnswer for meaning_en_to_el', () => {
    it('shows the Greek answer (back.answer) by default in EN', () => {
      renderCard({ card: mockEnToElCard, isFlipped: true });

      expect(screen.getByText('σπίτι')).toBeInTheDocument();
    });

    it('shows translationRu when RU is active and translationRu is provided', () => {
      renderCard({
        card: mockEnToElCard,
        isFlipped: true,
        translationRu: 'дом',
      });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.getByText('дом')).toBeInTheDocument();
    });

    it('falls back to Greek back.answer when RU is active but translationRu is absent', () => {
      renderCard({
        card: mockEnToElCard,
        isFlipped: true,
        translationRu: null,
      });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.getByText('σπίτι')).toBeInTheDocument();
    });
  });

  describe('sentence_translation target_to_el RU front swap', () => {
    it('shows the English source sentence on the front by default (EN)', () => {
      renderCard({ card: mockTargetToElSentenceCard });

      expect(screen.getByText('Good morning!')).toBeInTheDocument();
    });

    it('swaps the front main to answer_ru when RU is active', () => {
      renderCard({ card: mockTargetToElSentenceCard });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.getByText('Доброе утро!')).toBeInTheDocument();
      expect(screen.queryByText('Good morning!')).not.toBeInTheDocument();
    });

    it('uses sentenceRu prop as front swap fallback when answer_ru is absent', () => {
      const cardWithoutAnswerRu: CardRecordResponse = {
        ...mockTargetToElSentenceCard,
        back_content: {
          ...mockTargetToElSentenceCard.back_content,
          answer_ru: null,
        },
      };
      renderCard({
        card: cardWithoutAnswerRu,
        sentenceRu: 'Доброе утро (из prop)',
      });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.getByText('Доброе утро (из prop)')).toBeInTheDocument();
    });

    it('keeps English front when RU is active and no RU source is available', () => {
      const cardWithoutAnyRu: CardRecordResponse = {
        ...mockTargetToElSentenceCard,
        back_content: {
          ...mockTargetToElSentenceCard.back_content,
          answer_ru: null,
        },
      };
      renderCard({ card: cardWithoutAnyRu });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.getByText('Good morning!')).toBeInTheDocument();
    });

    it('answer stays Greek on the back regardless of language', () => {
      renderCard({ card: mockTargetToElSentenceCard, isFlipped: true });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.getByText('Καλημέρα σας!')).toBeInTheDocument();
    });
  });

  describe('translatePrompt', () => {
    it('keeps the English prompt verbatim when language is EN', () => {
      renderCard({ card: mockEnToElCard });

      expect(screen.getByText('How do you say this in Greek?')).toBeInTheDocument();
    });

    it('translates meaning_en_to_el via the fixed card-type mapping in RU', () => {
      renderCard({ card: mockEnToElCard });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      // Fixed mapping: "How do you say this in Greek?" regardless of source prompt text
      expect(screen.getByText('Как это сказать по-гречески?')).toBeInTheDocument();
    });

    it('translates a known sentence_translation prompt via per-text lookup in RU', () => {
      renderCard({ card: mockTargetToElSentenceCard });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      // "Translate to Greek" -> RU
      expect(screen.getByText('Переведите на греческий')).toBeInTheDocument();
    });

    it('does NOT leak untranslated English for an unmapped sentence prompt in RU', () => {
      const unmappedSentence: CardRecordResponse = {
        ...mockTargetToElSentenceCard,
        front_content: {
          ...mockTargetToElSentenceCard.front_content,
          prompt: 'Translate the following passage',
        },
      };
      renderCard({ card: unmappedSentence });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      // The raw English prompt must never be shown to RU users.
      expect(screen.queryByText('Translate the following passage')).not.toBeInTheDocument();
      // Falls back to the generic RU sentence prompt.
      expect(screen.getByText('Переведите это предложение')).toBeInTheDocument();
    });

    it('does NOT leak untranslated English for an unmapped plural_form prompt in RU', () => {
      const unmappedPlural: CardRecordResponse = {
        ...mockEnToElCard,
        card_type: 'plural_form',
        front_content: {
          card_type: 'plural_form',
          prompt: 'Give the plural in the genitive case',
          main: 'σπίτι',
          sub: null,
          badge: 'Noun',
          hint: 'house',
          hint_ru: 'дом',
        },
        back_content: {
          card_type: 'plural_form',
          answer: 'σπίτια',
          answer_sub: 'houses',
          answer_sub_ru: 'дома',
        },
      };
      renderCard({ card: unmappedPlural });

      fireEvent.click(screen.getByTestId('lang-toggle-ru'));

      expect(screen.queryByText('Give the plural in the genitive case')).not.toBeInTheDocument();
      // Falls back to the generic RU "What form?" prompt.
      expect(screen.getByText('Какая форма?')).toBeInTheDocument();
    });
  });

  describe('SRS rate button', () => {
    it('calls onRate(3) when the "good" button is clicked', () => {
      const onRate = vi.fn();
      renderCard({ card: mockEnToElCard, isFlipped: true, onRate });

      fireEvent.click(screen.getByTestId('srs-button-good'));

      expect(onRate).toHaveBeenCalledWith(3);
    });

    it('disables all SRS buttons when onRate is not provided', () => {
      renderCard({ card: mockEnToElCard, isFlipped: true });

      expect(screen.getByTestId('srs-button-again')).toBeDisabled();
      expect(screen.getByTestId('srs-button-hard')).toBeDisabled();
      expect(screen.getByTestId('srs-button-good')).toBeDisabled();
      expect(screen.getByTestId('srs-button-easy')).toBeDisabled();
    });

    it('does not call onRate when buttons are disabled (onRate absent)', () => {
      renderCard({ card: mockEnToElCard, isFlipped: true });

      // Clicking a disabled button is a no-op; assert no handler fired by
      // confirming the button carries the disabled attribute and clicking
      // does not throw.
      const goodButton = screen.getByTestId('srs-button-good');
      fireEvent.click(goodButton);

      expect(goodButton).toBeDisabled();
    });
  });
});
