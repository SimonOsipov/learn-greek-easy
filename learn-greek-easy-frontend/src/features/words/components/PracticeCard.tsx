// src/features/words/components/PracticeCard.tsx

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  /** Callback when user rates the card (1=again, 2=hard, 3=good, 4=easy) */
  onRate?: (rating: number) => void;
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
    color: 'bg-red-500',
    testId: 'srs-button-again',
  },
  {
    key: 'hard',
    rating: 2,
    i18nKey: 'practice.hard',
    color: 'bg-orange-500',
    testId: 'srs-button-hard',
  },
  {
    key: 'good',
    rating: 3,
    i18nKey: 'practice.good',
    color: 'bg-green-500',
    testId: 'srs-button-good',
  },
  {
    key: 'easy',
    rating: 4,
    i18nKey: 'practice.easy',
    color: 'bg-blue-500',
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
}: {
  front: MeaningFrontContent;
  typeBadgeLabel: string;
  tapToRevealLabel: string;
  partOfSpeech: PartOfSpeech | null;
  cardType: string;
}) {
  const mainFontSize = cardType === 'sentence_translation' ? 'text-xl' : 'text-3xl';

  return (
    <div data-testid="practice-card-front" className="flex flex-col items-center gap-6 py-6">
      {/* Badges row */}
      <div className="flex w-full items-center gap-2">
        <Badge className="bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/10">
          {typeBadgeLabel}
        </Badge>
        {partOfSpeech && <PartOfSpeechBadge partOfSpeech={partOfSpeech} />}
      </div>

      {/* Prompt */}
      <p className="text-center text-sm text-muted-foreground">{front.prompt}</p>

      {/* Main text */}
      <p className={cn('break-words text-center font-bold', mainFontSize)}>{front.main}</p>

      {/* Sub text (pronunciation) */}
      {front.sub && <p className="text-center text-sm italic text-muted-foreground">{front.sub}</p>}

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
}) {
  const answerFontSize = cardType === 'sentence_translation' ? 'text-xl' : 'text-3xl';

  return (
    <div data-testid="practice-card-back" className="flex animate-fade-in flex-col gap-6 py-6">
      {/* Badges row */}
      <div className="flex w-full items-center gap-2">
        <Badge className="bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/10">
          {typeBadgeLabel}
        </Badge>
        {partOfSpeech && <PartOfSpeechBadge partOfSpeech={partOfSpeech} />}
      </div>

      {/* Answer section */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-600">{answerLabel}</span>
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
          <p className="mt-2 text-sm text-muted-foreground">{back.context.english}</p>
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
  onRate,
}: PracticeCardProps) {
  const { t, i18n } = useTranslation('deck');

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
      if (isSentenceTargetToEl && currentLang === 'ru' && sentenceBack.answer_ru) {
        mainText = sentenceBack.answer_ru;
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

  // Translate stored English prompts to Russian when language is switched
  const translatePrompt = (englishPrompt: string, lang: string): string => {
    if (lang !== 'ru') return englishPrompt;

    const promptTranslations: Record<string, string> = {
      'What does that mean?': 'Что это значит?',
      'How do you say this in Greek?': 'Как это сказать по-гречески?',
      'What is this?': 'Что это?',
      'What does this mean?': 'Что это значит?',
      'What is the plural?': 'Какое множественное число?',
      'What is the singular?': 'Какое единственное число?',
      'Translate this sentence': 'Переведите это предложение',
      'Translate to Greek': 'Переведите на греческий',
      'What is the article?': 'Какой артикль?',
    };

    return promptTranslations[englishPrompt] || englishPrompt;
  };

  const translatedPrompt = translatePrompt(front.prompt, currentLang);

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

      <CardContent className="min-h-[280px] p-6">
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
          />
        )}
      </CardContent>
    </Card>
  );
}
