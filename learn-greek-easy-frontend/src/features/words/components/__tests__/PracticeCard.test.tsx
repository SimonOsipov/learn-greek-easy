/**
 * PracticeCard Component Tests
 *
 * Tests for the PracticeCard flashcard component.
 * Covers:
 * - Front side rendering (badge, main text, sub text, tap-to-reveal hint)
 * - Back side rendering (answer, answer_sub, example context)
 * - Flip interaction (onFlip callback on front click, no callback on back click)
 * - SRS buttons (all four rendered, all disabled)
 * - Language toggle (always visible, controls i18n language)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, describe, it, expect, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import {
  trackWordAudioPlayed,
  trackExampleAudioPlayed,
  trackWordAudioFailed,
} from '@/lib/analytics';
import type { CardRecordResponse } from '@/services/wordEntryAPI';

import { PracticeCard } from '../PracticeCard';
import type { PracticeCardProps } from '../PracticeCard';

vi.mock('@/components/ui/SpeakerButton', () => ({
  SpeakerButton: ({
    audioUrl,
    onPlay,
    onError,
  }: {
    audioUrl: string | null | undefined;
    onPlay?: () => void;
    onError?: (error: string) => void;
  }) => {
    if (!audioUrl) return null;
    return (
      <>
        <button
          data-testid="speaker-button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay?.();
          }}
        >
          Play
        </button>
        <button
          data-testid="speaker-error-trigger"
          onClick={(e) => {
            e.stopPropagation();
            onError?.('play error');
          }}
        >
          Error
        </button>
      </>
    );
  },
}));

vi.mock('@/lib/analytics', () => ({
  trackWordAudioPlayed: vi.fn(),
  trackExampleAudioPlayed: vi.fn(),
  trackWordAudioFailed: vi.fn(),
}));

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

const mockSentenceCard: CardRecordResponse = {
  id: 'card-sentence-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'sentence_translation',
  tier: 1,
  front_content: {
    card_type: 'sentence_translation',
    prompt: 'Translate this sentence',
    main: 'Καλημέρα σας!',
    sub: null,
    badge: 'Sentence',
    hint: null,
    example_index: 0,
    example_id: 'example-001',
  },
  back_content: {
    card_type: 'sentence_translation',
    answer: 'Good morning!',
    answer_sub: null,
    answer_ru: 'Доброе утро!',
    context: null,
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockPluralSgToPlCard: CardRecordResponse = {
  id: 'card-plural-sg-to-pl-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'plural_form',
  tier: 1,
  front_content: {
    card_type: 'plural_form',
    prompt: 'What is the plural?',
    main: 'σπίτι',
    sub: null,
    badge: 'Noun',
    hint: 'house',
    hint_ru: 'дом',
  },
  back_content: {
    card_type: 'plural_form',
    answer: 'σπίτια',
    answer_sub: 'houses, homes',
    answer_sub_ru: 'дома',
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockPluralPlToSgCard: CardRecordResponse = {
  id: 'card-plural-pl-to-sg-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'plural_form',
  tier: 1,
  front_content: {
    card_type: 'plural_form',
    prompt: 'What is the singular?',
    main: 'σπίτια',
    sub: null,
    badge: 'Noun',
    hint: 'houses, homes',
  },
  back_content: {
    card_type: 'plural_form',
    answer: 'σπίτι',
    answer_sub: 'house',
    answer_sub_ru: 'дом',
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockArticleCard: CardRecordResponse = {
  id: 'card-article-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'article',
  tier: 1,
  front_content: {
    card_type: 'article',
    prompt: 'What is the article?',
    main: '\u03C3\u03C0\u03AF\u03C4\u03B9',
    sub: 'house',
    badge: 'noun',
    hint: '[spee-tee]',
  },
  back_content: {
    card_type: 'article',
    answer: '\u03C4\u03BF',
    answer_sub: 'neuter',
    gender: 'neuter',
    gender_ru: '\u0441\u0440\u0435\u0434\u043D\u0438\u0439',
  },
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockEnToElCard: CardRecordResponse = {
  id: 'card-en-to-el-001',
  word_entry_id: 'word-001',
  deck_id: 'deck-001',
  card_type: 'meaning_en_to_el',
  tier: 1,
  variant_key: 'default',
  front_content: {
    card_type: 'meaning_en_to_el',
    prompt: 'What is the Greek for',
    main: 'hello',
    sub: null,
    badge: 'Noun',
    hint: null,
  },
  back_content: {
    card_type: 'meaning_en_to_el',
    answer: 'γεια σας',
    answer_sub: '/ja sas/',
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
  variant_key: 'default',
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

    it('renders "Tap or press Space to reveal the answer" hint', () => {
      renderCard();

      expect(screen.getByText('Tap or press Space to reveal the answer')).toBeInTheDocument();
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
    it('shows space hint in tap-to-reveal text on front side', () => {
      renderCard();
      expect(screen.getByText('Tap or press Space to reveal the answer')).toBeInTheDocument();
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
    afterEach(async () => {
      // Reset i18n language to English after each language toggle test
      await i18n.changeLanguage('en');
    });

    it('always renders language toggle on front side', () => {
      renderCard({ isFlipped: false });
      expect(screen.getByTestId('lang-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('lang-toggle-en')).toBeInTheDocument();
      expect(screen.getByTestId('lang-toggle-ru')).toBeInTheDocument();
    });

    it('always renders language toggle on back side', () => {
      renderCard({ isFlipped: true });
      expect(screen.getByTestId('lang-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('lang-toggle-en')).toBeInTheDocument();
      expect(screen.getByTestId('lang-toggle-ru')).toBeInTheDocument();
    });

    it('renders language toggle even without translationRu', () => {
      renderCard({ isFlipped: true, translationRu: null });
      expect(screen.getByTestId('lang-toggle')).toBeInTheDocument();
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

    it('does not flip the card when clicking language toggle on front side', () => {
      const onFlip = vi.fn();
      renderCard({ isFlipped: false, onFlip });
      fireEvent.click(screen.getByTestId('lang-toggle-en'));
      expect(onFlip).not.toHaveBeenCalled();
    });
  });

  describe('Sentence Translation Card', () => {
    describe('Front Side', () => {
      it('renders sentence text from front_content.main', () => {
        renderCard({ card: mockSentenceCard });

        expect(screen.getByText('Καλημέρα σας!')).toBeInTheDocument();
      });

      it('renders "Sentence" type badge', () => {
        renderCard({ card: mockSentenceCard });

        // The type badge label comes from t('practice.sentenceBadge')
        // which SENT-05 adds as "Sentence" in deck.json
        expect(screen.getByText('Sentence')).toBeInTheDocument();
      });

      it('renders prompt text', () => {
        renderCard({ card: mockSentenceCard });

        expect(screen.getByText('Translate this sentence')).toBeInTheDocument();
      });

      it('does not render sub text when null', () => {
        renderCard({ card: mockSentenceCard });

        // No pronunciation element should be present
        // (The sub text element is conditionally rendered)
        const frontEl = screen.getByTestId('practice-card-front');
        const italicElements = frontEl.querySelectorAll('.italic');
        expect(italicElements).toHaveLength(0);
      });
    });

    describe('Back Side', () => {
      it('renders correct answer from back_content.answer', () => {
        renderCard({ card: mockSentenceCard, isFlipped: true });

        expect(screen.getByText('Good morning!')).toBeInTheDocument();
      });

      it('does not render answer_sub when null', () => {
        renderCard({ card: mockSentenceCard, isFlipped: true });

        // answer_sub is null in mockSentenceCard, so no sub-answer text
        // The answer_sub element is conditionally rendered with text-lg class
        const backEl = screen.getByTestId('practice-card-back');
        const subAnswerElements = backEl.querySelectorAll('.text-lg.text-muted-foreground');
        expect(subAnswerElements).toHaveLength(0);
      });
    });

    describe('Language Toggle', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('shows English answer by default', () => {
        renderCard({ card: mockSentenceCard, isFlipped: true });

        expect(screen.getByText('Good morning!')).toBeInTheDocument();
      });

      it('switches to Russian using answer_ru from back_content', () => {
        // Do NOT pass translationRu prop -- the component should
        // use back_content.answer_ru for sentence_translation cards
        renderCard({ card: mockSentenceCard, isFlipped: true });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        expect(screen.getByText('Доброе утро!')).toBeInTheDocument();
      });

      it('uses answer_ru from back_content, not translationRu prop', () => {
        // Pass a different translationRu to prove the component
        // ignores it for sentence_translation cards
        renderCard({
          card: mockSentenceCard,
          isFlipped: true,
          translationRu: 'different-value',
        });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        // Should show answer_ru from back_content, not the prop
        expect(screen.getByText('Доброе утро!')).toBeInTheDocument();
        expect(screen.queryByText('different-value')).not.toBeInTheDocument();
      });

      it('switches back to English when EN clicked', () => {
        renderCard({ card: mockSentenceCard, isFlipped: true });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));
        fireEvent.click(screen.getByTestId('lang-toggle-en'));

        expect(screen.getByText('Good morning!')).toBeInTheDocument();
      });
    });

    describe('Prompt Translation', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('translates "Translate this sentence" prompt to Russian', () => {
        renderCard({ card: mockSentenceCard });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        // SENT-05 adds this mapping to the promptTranslations record
        // 'Translate this sentence': 'Переведите это предложение'
        expect(screen.getByText('Переведите это предложение')).toBeInTheDocument();
      });
    });
  });

  describe('Article Card', () => {
    describe('Front Side', () => {
      it('renders Greek noun from front_content.main', () => {
        renderCard({ card: mockArticleCard });

        expect(screen.getByText('\u03C3\u03C0\u03AF\u03C4\u03B9')).toBeInTheDocument();
      });

      it('renders English translation in sub by default', () => {
        renderCard({ card: mockArticleCard });

        expect(screen.getByText('house')).toBeInTheDocument();
      });

      it('renders pronunciation from front_content.hint', () => {
        renderCard({ card: mockArticleCard });

        expect(screen.getByText('[spee-tee]')).toBeInTheDocument();
      });

      it('renders "Article" type badge', () => {
        renderCard({ card: mockArticleCard });

        expect(screen.getByText('Article')).toBeInTheDocument();
      });

      it('renders PartOfSpeechBadge', () => {
        renderCard({ card: mockArticleCard });

        expect(screen.getByTestId('part-of-speech-badge')).toBeInTheDocument();
      });

      it('renders "What is the article?" prompt', () => {
        renderCard({ card: mockArticleCard });

        expect(screen.getByText('What is the article?')).toBeInTheDocument();
      });

      it('uses text-3xl font size for main text (not reduced)', () => {
        renderCard({ card: mockArticleCard });

        const frontEl = screen.getByTestId('practice-card-front');
        const mainText = frontEl.querySelector('.text-3xl');
        expect(mainText).toBeInTheDocument();
      });
    });

    describe('Front Side - Language Toggle', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('switches sub to Russian translation when RU toggled', () => {
        renderCard({ card: mockArticleCard, translationRu: '\u0434\u043E\u043C' });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        expect(screen.getByText('\u0434\u043E\u043C')).toBeInTheDocument();
      });

      it('keeps English sub when translationRu is null and RU toggled', () => {
        renderCard({ card: mockArticleCard, translationRu: null });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        // Falls back to English sub since translationRu is null
        expect(screen.getByText('house')).toBeInTheDocument();
      });
    });

    describe('Back Side', () => {
      it('renders Greek article from back_content.answer', () => {
        renderCard({ card: mockArticleCard, isFlipped: true });

        expect(screen.getByText('\u03C4\u03BF')).toBeInTheDocument();
      });

      it('renders gender label from back_content', () => {
        renderCard({ card: mockArticleCard, isFlipped: true });

        expect(screen.getByText('neuter')).toBeInTheDocument();
      });

      it('renders PartOfSpeechBadge on back side', () => {
        renderCard({ card: mockArticleCard, isFlipped: true });

        expect(screen.getByTestId('part-of-speech-badge')).toBeInTheDocument();
      });
    });

    describe('Back Side - Language Toggle', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('answer stays Greek when language toggled to RU', () => {
        renderCard({ card: mockArticleCard, isFlipped: true, translationRu: '\u0434\u043E\u043C' });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        // Answer should still be the Greek article, not a translation
        expect(screen.getByText('\u03C4\u03BF')).toBeInTheDocument();
      });

      it('gender label switches to gender_ru when RU toggled', () => {
        renderCard({ card: mockArticleCard, isFlipped: true });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        expect(screen.getByText('\u0441\u0440\u0435\u0434\u043D\u0438\u0439')).toBeInTheDocument();
      });

      it('gender label falls back to English when gender_ru is null', () => {
        const cardWithoutGenderRu: CardRecordResponse = {
          ...mockArticleCard,
          back_content: {
            ...mockArticleCard.back_content,
            gender_ru: null,
          },
        };
        renderCard({ card: cardWithoutGenderRu, isFlipped: true });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        // Should fall back to English gender label
        expect(screen.getByText('neuter')).toBeInTheDocument();
      });
    });

    describe('Prompt Translation', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('translates "What is the article?" to Russian', () => {
        renderCard({ card: mockArticleCard });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        expect(
          screen.getByText(
            '\u041A\u0430\u043A\u043E\u0439 \u0430\u0440\u0442\u0438\u043A\u043B\u044C?'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Plural Form Card', () => {
    describe('Front Side', () => {
      it('renders Greek singular form from front_content.main', () => {
        renderCard({ card: mockPluralSgToPlCard });

        expect(screen.getByText('σπίτι')).toBeInTheDocument();
      });

      it('renders English singular translation as hint (sg-to-pl)', () => {
        renderCard({ card: mockPluralSgToPlCard });

        expect(screen.getByText('house')).toBeInTheDocument();
      });

      it('renders English plural translation as hint (pl-to-sg)', () => {
        renderCard({ card: mockPluralPlToSgCard });

        expect(screen.getByText('houses, homes')).toBeInTheDocument();
      });

      it('does not render sub text (pronunciation suppressed)', () => {
        renderCard({ card: mockPluralSgToPlCard });

        const frontEl = screen.getByTestId('practice-card-front');
        const italicElements = frontEl.querySelectorAll('.italic');
        expect(italicElements).toHaveLength(0);
      });

      it('renders "Plural Form" type badge', () => {
        renderCard({ card: mockPluralSgToPlCard });

        expect(screen.getByText('Plural Form')).toBeInTheDocument();
      });
    });

    describe('Back Side', () => {
      it('renders Greek plural form as answer (sg-to-pl)', () => {
        renderCard({ card: mockPluralSgToPlCard, isFlipped: true });

        expect(screen.getByText('σπίτια')).toBeInTheDocument();
      });

      it('renders English plural translation as answer_sub (sg-to-pl)', () => {
        renderCard({ card: mockPluralSgToPlCard, isFlipped: true });

        expect(screen.getByText('houses, homes')).toBeInTheDocument();
      });

      it('renders English singular translation as answer_sub (pl-to-sg)', () => {
        renderCard({ card: mockPluralPlToSgCard, isFlipped: true });

        expect(screen.getByText('house')).toBeInTheDocument();
      });
    });

    describe('Language Toggle', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('switches hint to Russian when RU toggled on front', () => {
        renderCard({ card: mockPluralSgToPlCard });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        expect(screen.getByText('дом')).toBeInTheDocument();
      });

      it('switches answer_sub to Russian when RU toggled on back', () => {
        renderCard({ card: mockPluralSgToPlCard, isFlipped: true });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        expect(screen.getByText('дома')).toBeInTheDocument();
      });
    });

    describe('Fallback Behavior', () => {
      afterEach(async () => {
        await i18n.changeLanguage('en');
      });

      it('falls back gracefully when hint is null', () => {
        const cardWithoutHint: CardRecordResponse = {
          ...mockPluralSgToPlCard,
          front_content: {
            ...mockPluralSgToPlCard.front_content,
            hint: null,
          },
        };
        renderCard({ card: cardWithoutHint });

        // Card should render without errors, main text still visible
        expect(screen.getByText('σπίτι')).toBeInTheDocument();
        // Verify the front content renders without crashing
        const frontEl = screen.getByTestId('practice-card-front');
        expect(frontEl).toBeInTheDocument();
      });

      it('answer_sub stays in English when answer_sub_ru is missing and RU toggled', () => {
        const cardWithoutRu: CardRecordResponse = {
          ...mockPluralSgToPlCard,
          back_content: {
            ...mockPluralSgToPlCard.back_content,
            answer_sub_ru: null,
          },
        };
        renderCard({ card: cardWithoutRu, isFlipped: true });

        fireEvent.click(screen.getByTestId('lang-toggle-ru'));

        // answer_sub should fall back to English since Russian is not available
        expect(screen.getByText('houses, homes')).toBeInTheDocument();
      });
    });
  });

  describe('Speaker Button', () => {
    const audioUrl = 'https://example.com/audio.mp3';

    it('shows speaker button on front for meaning_el_to_en when audioUrl provided', () => {
      renderCard({ card: mockCard, audioUrl });
      expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
    });

    it('does NOT show speaker button on back for meaning_el_to_en', () => {
      renderCard({ card: mockCard, isFlipped: true, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('does NOT show speaker button on front for meaning_en_to_el', () => {
      renderCard({ card: mockEnToElCard, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('shows speaker button on back for meaning_en_to_el when flipped', () => {
      renderCard({ card: mockEnToElCard, isFlipped: true, audioUrl });
      expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
    });

    it('shows speaker button on front for sentence_translation (el_to_target)', () => {
      renderCard({ card: mockSentenceCard, audioUrl });
      expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
    });

    it('does NOT show speaker button on back for sentence_translation (el_to_target)', () => {
      renderCard({ card: mockSentenceCard, isFlipped: true, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('does NOT show speaker button on front for sentence_translation (target_to_el)', () => {
      renderCard({ card: mockTargetToElSentenceCard, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('shows speaker button on back for sentence_translation (target_to_el) when flipped', () => {
      renderCard({ card: mockTargetToElSentenceCard, isFlipped: true, audioUrl });
      expect(screen.getByTestId('speaker-button')).toBeInTheDocument();
    });

    it('does NOT show speaker button for plural_form card', () => {
      renderCard({ card: mockPluralSgToPlCard, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
      renderCard({ card: mockPluralSgToPlCard, isFlipped: true, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('does NOT show speaker button for article card', () => {
      renderCard({ card: mockArticleCard, audioUrl });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('does NOT show speaker button when audioUrl is null', () => {
      renderCard({ card: mockCard, audioUrl: null });
      expect(screen.queryByTestId('speaker-button')).not.toBeInTheDocument();
    });

    it('does NOT trigger card flip when speaker button clicked', () => {
      const onFlip = vi.fn();
      renderCard({ card: mockCard, audioUrl, onFlip });
      fireEvent.click(screen.getByTestId('speaker-button'));
      expect(onFlip).not.toHaveBeenCalled();
    });

    it('fires word_audio_played analytics for meaning_el_to_en on play', () => {
      renderCard({ card: mockCard, audioUrl, wordEntryId: 'word-001', deckId: 'deck-001' });
      fireEvent.click(screen.getByTestId('speaker-button'));
      expect(trackWordAudioPlayed).toHaveBeenCalledWith(
        expect.objectContaining({
          word_entry_id: 'word-001',
          context: 'review',
          deck_id: 'deck-001',
        })
      );
    });

    it('fires example_audio_played analytics for sentence_translation on play', () => {
      renderCard({ card: mockSentenceCard, audioUrl, wordEntryId: 'word-001', deckId: 'deck-001' });
      fireEvent.click(screen.getByTestId('speaker-button'));
      expect(trackExampleAudioPlayed).toHaveBeenCalledWith(
        expect.objectContaining({
          word_entry_id: 'word-001',
          example_id: 'example-001',
          context: 'review',
          deck_id: 'deck-001',
        })
      );
    });

    it('fires word_audio_failed analytics on error', () => {
      renderCard({ card: mockCard, audioUrl, wordEntryId: 'word-001', deckId: 'deck-001' });
      fireEvent.click(screen.getByTestId('speaker-error-trigger'));
      expect(trackWordAudioFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          word_entry_id: 'word-001',
          audio_type: 'word',
          context: 'review',
        })
      );
    });
  });
});
