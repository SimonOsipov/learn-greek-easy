// src/components/shared/PracticeCard.tsx

/**
 * Flashcard-style practice card component.
 * Shows a question on the front and answer on the back with flip interaction.
 * Includes disabled SRS rating buttons (coming soon) on the back side.
 */

// ============================================
// Imports
// ============================================

import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PartOfSpeechBadge } from '@/components/review/grammar';
import { AudioSpeedToggle } from '@/components/ui/AudioSpeedToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SpeakerButton } from '@/components/ui/SpeakerButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AudioSpeed } from '@/hooks';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { CardRecordResponse } from '@/services/wordEntryAPI';
import type { PartOfSpeech } from '@/types/grammar';

// ============================================
// Types
// ============================================

export interface PracticeCardProps {
  /** The card record to display */
  card: CardRecordResponse;
  /** Whether the card is flipped to show the answer */
  isFlipped: boolean;
  /** Callback when the card is clicked to flip */
  onFlip: () => void;
  /** Russian translation from word entry, null if unavailable */
  translationRu?: string | null;
  /** Russian plural translation from word entry, null if unavailable */
  translationRuPlural?: string | null;
  /** Russian sentence text for target_to_el cards (looked up from example), null if unavailable */
  sentenceRu?: string | null;
  /** Callback when user rates the card (1=again, 2=hard, 3=good, 4=easy) */
  onRate?: (rating: number) => void;
  /** Lifted audio state from the page, includes URL + playback state + toggle */
  audioState?: {
    audioUrl: string | null;
    isPlaying: boolean;
    isLoading: boolean;
    error: string | null;
    onToggle: () => void;
    speed?: AudioSpeed;
    setSpeed?: (s: AudioSpeed) => void;
  } | null;
  /** Word entry ID for analytics tracking */
  wordEntryId?: string;
  /** Deck ID for analytics tracking */
  deckId?: string;
}

interface MeaningFrontContent {
  card_type: string;
  prompt: string;
  main: string;
  sub?: string | null;
  badge?: string | null;
  hint?: string | null;
}

interface MeaningBackContent {
  card_type: string;
  answer: string;
  answer_sub?: string | null;
  context?: {
    label: string;
    greek: string;
    english: string;
    tense?: string | null;
  } | null;
}

interface SentenceTranslationBackContent {
  card_type: string;
  answer: string;
  answer_sub?: string | null;
  context?: {
    label: string;
    greek: string;
    english: string;
    tense?: string | null;
  } | null;
  answer_ru?: string | null;
}

interface PluralFormFrontContent {
  card_type: string;
  prompt: string;
  main: string;
  sub?: string | null;
  badge?: string | null;
  hint?: string | null;
  hint_ru?: string | null;
}

interface PluralFormBackContent {
  card_type: string;
  answer: string;
  answer_sub?: string | null;
  answer_sub_ru?: string | null;
}

interface ArticleBackContent {
  card_type: string;
  answer: string;
  answer_sub?: string | null;
  gender: string;
  gender_ru?: string | null;
}

// ============================================
// Constants
// ============================================

const SRS_BUTTONS = [
  {
    key: 'again',
    rating: 1,
    i18nKey: 'practice.again',
    color: 'bg-practice-incorrect',
    testId: 'srs-button-again',
  },
  {
    key: 'hard',
    rating: 2,
    i18nKey: 'practice.hard',
    color: 'bg-practice-incorrect-soft',
    testId: 'srs-button-hard',
  },
  {
    key: 'good',
    rating: 3,
    i18nKey: 'practice.good',
    color: 'bg-practice-correct',
    testId: 'srs-button-good',
  },
  {
    key: 'easy',
    rating: 4,
    i18nKey: 'practice.easy',
    color: 'bg-practice-accent',
    testId: 'srs-button-easy',
  },
] as const;

// ============================================
// Sub-Components
// ============================================

function CardFront({
  front,
  typeBadgeLabel,
  tapToRevealLabel,
  partOfSpeech,
  cardType,
  audioCluster,
}: {
  front: MeaningFrontContent;
  typeBadgeLabel: string;
  tapToRevealLabel: string;
  partOfSpeech: PartOfSpeech | null;
  cardType: string;
  audioCluster?: React.ReactNode;
}) {
  const mainFontSize = cardType === 'sentence_translation' ? 'text-xl' : 'text-3xl';

  return (
    <div data-testid="practice-card-front" className="flex flex-col items-center gap-6 pb-6 pt-3">
      {/* Badges row */}
      <div className="flex w-full items-start justify-start gap-2">
        <span className="badge b-violet">{typeBadgeLabel}</span>
        {partOfSpeech && <PartOfSpeechBadge partOfSpeech={partOfSpeech} />}
      </div>

      {/* Prompt */}
      <p className="text-center text-sm text-muted-foreground">{front.prompt}</p>

      {/* Main text */}
      <p className={cn('break-words text-center font-bold', mainFontSize)}>{front.main}</p>

      {/* Sub text (pronunciation) */}
      {front.sub && <p className="text-center text-sm italic text-muted-foreground">{front.sub}</p>}

      {/* Audio controls */}
      {audioCluster}

      {/* Pronunciation hint */}
      {front.hint && <p className="text-center text-sm text-muted-foreground">{front.hint}</p>}

      {/* Tap to reveal hint */}
      <p className="mt-4 text-center text-sm text-muted-foreground">{tapToRevealLabel}</p>
    </div>
  );
}

function CardBack({
  back,
  typeBadgeLabel,
  answerLabel,
  srsComingSoon,
  t,
  partOfSpeech,
  displayAnswer,
  onRate,
  cardType,
  contextSentenceRu,
  currentLang,
  frontMain,
  frontSub,
  audioCluster,
}: {
  back: MeaningBackContent;
  typeBadgeLabel: string;
  answerLabel: string;
  srsComingSoon: string;
  t: (key: string) => string;
  partOfSpeech: PartOfSpeech | null;
  displayAnswer: string;
  onRate?: (rating: number) => void;
  cardType: string;
  contextSentenceRu?: string | null;
  currentLang: 'en' | 'ru';
  frontMain: string;
  frontSub?: string | null;
  audioCluster?: React.ReactNode;
}) {
  const answerFontSize = cardType === 'sentence_translation' ? 'text-xl' : 'text-3xl';

  return (
    <div
      data-testid="practice-card-back"
      className="flex animate-practice-fade-in flex-col gap-6 pb-6 pt-3"
    >
      {/* Badges row */}
      <div className="flex w-full items-start justify-start gap-2">
        <span className="badge b-violet">{typeBadgeLabel}</span>
        {partOfSpeech && <PartOfSpeechBadge partOfSpeech={partOfSpeech} />}
      </div>

      {/* Question word echo */}
      <div className="flex flex-col items-center gap-1">
        <p className="break-words text-center text-lg font-bold text-muted-foreground">
          {frontMain}
        </p>
        {frontSub && <p className="text-center text-sm italic text-muted-foreground">{frontSub}</p>}
        {audioCluster}
      </div>

      {/* Answer section */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-practice-correct" />
          <span className="text-sm font-medium text-practice-correct">{answerLabel}</span>
        </div>

        <p className={cn('break-words text-center font-bold', answerFontSize)}>{displayAnswer}</p>

        {back.answer_sub && (
          <p className="break-words text-center text-lg text-muted-foreground">{back.answer_sub}</p>
        )}
      </div>

      {/* Example context */}
      {back.context && (
        <Card className="bg-muted/30 p-4 transition-colors hover:bg-muted/50">
          {back.context.tense && (
            <Badge variant="outline" className="mb-2 text-xs">
              {back.context.tense}
            </Badge>
          )}
          <p className="text-lg font-medium text-foreground">{back.context.greek}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentLang === 'ru' && contextSentenceRu ? contextSentenceRu : back.context.english}
          </p>
        </Card>
      )}

      {/* SRS buttons */}
      <SrsButtonRow srsComingSoon={srsComingSoon} t={t} onRate={onRate} />
    </div>
  );
}

function SrsButtonRow({
  srsComingSoon,
  t,
  onRate,
}: {
  srsComingSoon: string;
  t: (key: string) => string;
  onRate?: (rating: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <div className="flex justify-center gap-3 px-2">
        {SRS_BUTTONS.map(({ key, rating, i18nKey, color, testId }) => {
          const label = t(i18nKey);
          const isEnabled = !!onRate;

          const button = (
            <Button
              disabled={!isEnabled}
              data-testid={testId}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                isEnabled ? color : cn(color, 'cursor-not-allowed opacity-50')
              )}
              aria-label={isEnabled ? label : `${label} - ${srsComingSoon}`}
              type="button"
              onClick={isEnabled ? () => onRate(rating) : undefined}
            >
              {label}
            </Button>
          );

          if (isEnabled) {
            return (
              <div key={key} className="flex flex-col items-center gap-1">
                {button}
                <span className="text-[10px] text-muted-foreground">{rating}</span>
              </div>
            );
          }

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-block">
                  {button}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{srsComingSoon}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Component
// ============================================

export function PracticeCard({
  card,
  isFlipped,
  onFlip,
  translationRu,
  translationRuPlural,
  sentenceRu,
  onRate,
  audioState,
  wordEntryId,
  deckId,
}: PracticeCardProps) {
  const { t, i18n } = useTranslation('deck');

  const audioUrl = audioState?.audioUrl ?? null;
  const audioControlledState = audioState
    ? {
        isPlaying: audioState.isPlaying,
        isLoading: audioState.isLoading,
        error: audioState.error,
        toggle: audioState.onToggle,
        speed: audioState.speed,
        setSpeed: audioState.setSpeed,
      }
    : undefined;

  const front = card.front_content as unknown as MeaningFrontContent;
  const back = card.back_content as unknown as MeaningBackContent;
  const sentenceBack = back as unknown as SentenceTranslationBackContent;
  const pluralFront = front as unknown as PluralFormFrontContent;
  const pluralBack = back as unknown as PluralFormBackContent;

  const currentLang = (i18n.language?.split('-')[0] ?? 'en') as 'en' | 'ru';

  // Detect sentence translation cards and direction
  const isSentenceCard = card.card_type === 'sentence_translation';
  const isSentenceElToTarget = isSentenceCard && front.prompt === 'Translate this sentence';
  const isSentenceTargetToEl = isSentenceCard && front.prompt === 'Translate to Greek';

  const cardSupportsAudio =
    card.card_type === 'meaning_el_to_en' ||
    card.card_type === 'meaning_en_to_el' ||
    isSentenceCard;

  const handleAudioPlay = () => {
    if (isSentenceCard) {
      const exampleId =
        typeof (card.front_content as Record<string, unknown>).example_id === 'string'
          ? ((card.front_content as Record<string, unknown>).example_id as string)
          : '';
      track('example_audio_played', {
        word_entry_id: wordEntryId ?? '',
        example_id: exampleId,
        context: 'review',
        deck_id: deckId ?? '',
        playback_speed: audioState?.speed ?? 1,
      });
    } else {
      track('word_audio_played', {
        word_entry_id: wordEntryId ?? '',
        lemma: card.card_type === 'meaning_en_to_el' ? back.answer : front.main,
        part_of_speech: front.badge?.toLowerCase() ?? null,
        context: 'review',
        deck_id: deckId ?? '',
        playback_speed: audioState?.speed ?? 1,
      });
    }
  };

  // Detect article cards
  const isArticleCard = card.card_type === 'article';
  const articleBack = back as unknown as ArticleBackContent;

  // Suppress pronunciation for plural_form and sentence cards
  // For target_to_el sentences, swap front text when RU is selected
  // For article cards, sub shows English translation by default, Russian when toggled
  // For plural_form cards, hint switches to hint_ru when RU is selected
  const displayFront = (() => {
    if (card.card_type === 'plural_form') {
      const hintText =
        currentLang === 'ru' && pluralFront.hint_ru ? pluralFront.hint_ru : front.hint;
      return { ...front, sub: null, hint: hintText };
    }
    if (isSentenceCard) {
      let mainText = front.main;
      // For target_to_el sentences, swap front text when RU is selected
      if (isSentenceTargetToEl && currentLang === 'ru') {
        const ruText = sentenceBack.answer_ru || sentenceRu;
        if (ruText) mainText = ruText;
      }
      return { ...front, sub: null, main: mainText };
    }
    if (isArticleCard) {
      const subText = currentLang === 'ru' && translationRu ? translationRu : front.sub;
      return { ...front, sub: subText };
    }
    return front;
  })();

  // Determine displayed answer based on UI language
  // For plural_form cards, always show the Greek form (not a translation)
  // For sentence cards, use answer_ru from back_content (not word-level translationRu)
  const displayAnswer =
    card.card_type === 'plural_form' || isArticleCard
      ? back.answer
      : isSentenceTargetToEl
        ? back.answer // Always Greek for target_to_el
        : isSentenceElToTarget
          ? currentLang === 'ru' && sentenceBack.answer_ru
            ? sentenceBack.answer_ru
            : back.answer
          : currentLang === 'ru' && translationRu
            ? translationRu
            : back.answer;

  // Translate stored English prompts to Russian when language is switched.
  // Keyed off card_type to handle all prompt variants for each card type.
  const translatePrompt = (englishPrompt: string, lang: string, cardType: string): string => {
    if (lang !== 'ru') return englishPrompt;

    const cardTypePrompts: Record<string, string> = {
      meaning_el_to_en:
        '\u0427\u0442\u043e \u044d\u0442\u043e \u0437\u043d\u0430\u0447\u0438\u0442?',
      meaning_en_to_el:
        '\u041a\u0430\u043a \u044d\u0442\u043e \u0441\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u043e-\u0433\u0440\u0435\u0447\u0435\u0441\u043a\u0438?',
      article: '\u041a\u0430\u043a\u043e\u0439 \u0430\u0440\u0442\u0438\u043a\u043b\u044c?',
    };

    // For card types with a fixed mapping, use it
    if (cardType in cardTypePrompts) {
      return cardTypePrompts[cardType];
    }

    // For card types with variable prompts (plural_form, sentence_translation),
    // fall back to per-text lookup
    const promptTranslations: Record<string, string> = {
      'What is the plural?':
        '\u041a\u0430\u043a\u043e\u0435 \u043c\u043d\u043e\u0436\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0435 \u0447\u0438\u0441\u043b\u043e?',
      'What is the plural form?':
        '\u041a\u0430\u043a\u0430\u044f \u0444\u043e\u0440\u043c\u0430 \u043c\u043d\u043e\u0436\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u0447\u0438\u0441\u043b\u0430?',
      'What is the singular?':
        '\u041a\u0430\u043a\u043e\u0435 \u0435\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0435 \u0447\u0438\u0441\u043b\u043e?',
      'What is the singular form?':
        '\u041a\u0430\u043a\u0430\u044f \u0444\u043e\u0440\u043c\u0430 \u0435\u0434\u0438\u043d\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u0447\u0438\u0441\u043b\u0430?',
      'Translate this sentence':
        '\u041f\u0435\u0440\u0435\u0432\u0435\u0434\u0438\u0442\u0435 \u044d\u0442\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435',
      'Translate to Greek':
        '\u041f\u0435\u0440\u0435\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430 \u0433\u0440\u0435\u0447\u0435\u0441\u043a\u0438\u0439',
    };

    return promptTranslations[englishPrompt] ?? englishPrompt;
  };

  const translatedPrompt = translatePrompt(front.prompt, currentLang, card.card_type);

  const typeBadgeLabel =
    card.card_type === 'plural_form'
      ? t('practice.pluralFormBadge')
      : isArticleCard
        ? t('practice.articleBadge')
        : isSentenceCard
          ? t('practice.sentenceTranslationBadge')
          : t('practice.meaningBadge');
  const tapToRevealLabel = t('practice.tapToReveal');
  const answerLabel = t('practice.answer');
  const srsComingSoon = t('practice.srsComingSoon');
  // Suppress part-of-speech badge for sentence cards (badge contains CEFR level, not POS)
  const partOfSpeech =
    !isSentenceCard && front.badge ? (front.badge.toLowerCase() as PartOfSpeech) : null;

  // For plural_form cards, override answer_sub with Russian plural translation
  // For article cards, override answer_sub with gender label in the correct language
  const displayBack = (() => {
    if (card.card_type === 'plural_form') {
      const ruSub = pluralBack.answer_sub_ru ?? translationRuPlural;
      const answerSubText = currentLang === 'ru' && ruSub ? ruSub : back.answer_sub;
      return { ...back, answer_sub: answerSubText };
    }
    if (isArticleCard) {
      return {
        ...back,
        answer_sub:
          currentLang === 'ru' && articleBack.gender_ru
            ? articleBack.gender_ru
            : articleBack.gender,
      };
    }
    return back;
  })();

  const handleLangChange = (lang: 'en' | 'ru') => {
    i18n.changeLanguage(lang);
  };

  const audioClusterElement =
    cardSupportsAudio && audioUrl ? (
      <div
        className="flex items-center gap-2"
        data-testid="audio-cluster"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <AudioSpeedToggle
          speed={audioState?.speed ?? 1}
          onSpeedChange={audioState?.setSpeed ?? (() => {})}
        />
        <SpeakerButton
          audioUrl={audioUrl}
          size="sm"
          onPlay={handleAudioPlay}
          controlledState={audioControlledState}
        />
      </div>
    ) : null;

  return (
    <Card
      data-testid="practice-card"
      className={cn('relative mx-auto max-w-lg overflow-hidden', !isFlipped && 'cursor-pointer')}
      role={!isFlipped ? 'button' : undefined}
      tabIndex={!isFlipped ? 0 : undefined}
      onClick={!isFlipped ? onFlip : undefined}
      onKeyDown={
        !isFlipped
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFlip();
              }
            }
          : undefined
      }
      aria-label={!isFlipped ? `Practice card: ${front.main}. ${tapToRevealLabel}` : undefined}
    >
      {/* Language selector - always visible, top right corner */}
      <div
        className="absolute right-3 top-3 z-10 flex gap-1"
        data-testid="lang-toggle"
        role="group"
        aria-label="Language toggle"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          variant={currentLang === 'en' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => handleLangChange('en')}
          data-testid="lang-toggle-en"
          aria-pressed={currentLang === 'en'}
        >
          {t('practice.langEn')}
        </Button>
        <Button
          variant={currentLang === 'ru' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => handleLangChange('ru')}
          data-testid="lang-toggle-ru"
          aria-pressed={currentLang === 'ru'}
        >
          {t('practice.langRu')}
        </Button>
      </div>

      <CardContent className="min-h-[280px] px-6 pb-6">
        {/* Screen reader announcement */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isFlipped ? `${answerLabel}: ${displayAnswer}` : ''}
        </div>

        {!isFlipped ? (
          <CardFront
            front={{ ...displayFront, prompt: translatedPrompt }}
            typeBadgeLabel={typeBadgeLabel}
            tapToRevealLabel={tapToRevealLabel}
            partOfSpeech={partOfSpeech}
            cardType={card.card_type}
            audioCluster={audioClusterElement}
          />
        ) : (
          <CardBack
            back={displayBack}
            typeBadgeLabel={typeBadgeLabel}
            answerLabel={answerLabel}
            srsComingSoon={srsComingSoon}
            t={t}
            partOfSpeech={partOfSpeech}
            displayAnswer={displayAnswer}
            onRate={onRate}
            cardType={card.card_type}
            contextSentenceRu={sentenceRu}
            currentLang={currentLang}
            frontMain={displayFront.main}
            frontSub={displayFront.sub}
            audioCluster={audioClusterElement}
          />
        )}
      </CardContent>
    </Card>
  );
}
