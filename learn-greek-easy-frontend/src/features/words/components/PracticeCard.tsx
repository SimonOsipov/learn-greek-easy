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

// ============================================
// Constants
// ============================================

const SRS_BUTTONS = [
  { key: 'again', i18nKey: 'practice.again', color: 'bg-red-500', testId: 'srs-button-again' },
  { key: 'hard', i18nKey: 'practice.hard', color: 'bg-orange-500', testId: 'srs-button-hard' },
  { key: 'good', i18nKey: 'practice.good', color: 'bg-green-500', testId: 'srs-button-good' },
  { key: 'easy', i18nKey: 'practice.easy', color: 'bg-blue-500', testId: 'srs-button-easy' },
] as const;

// ============================================
// Sub-Components
// ============================================

function CardFront({
  front,
  typeBadgeLabel,
  tapToRevealLabel,
  partOfSpeech,
}: {
  front: MeaningFrontContent;
  typeBadgeLabel: string;
  tapToRevealLabel: string;
  partOfSpeech: PartOfSpeech | null;
}) {
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
      <p className="break-words text-center text-3xl font-bold">{front.main}</p>

      {/* Sub text (pronunciation) */}
      {front.sub && <p className="text-center text-sm italic text-muted-foreground">{front.sub}</p>}

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
}: {
  back: MeaningBackContent;
  typeBadgeLabel: string;
  answerLabel: string;
  srsComingSoon: string;
  t: (key: string) => string;
  partOfSpeech: PartOfSpeech | null;
}) {
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

        <p className="break-words text-center text-3xl font-bold">{back.answer}</p>

        {back.answer_sub && (
          <p className="break-words text-center text-lg text-muted-foreground">{back.answer_sub}</p>
        )}
      </div>

      {/* Example context */}
      {back.context && (
        <div className="rounded-lg bg-muted/30 p-4">
          {back.context.tense && (
            <Badge variant="outline" className="mb-2 text-xs">
              {back.context.tense}
            </Badge>
          )}
          <p className="text-base font-medium text-foreground">{back.context.greek}</p>
          <p className="mt-1 text-sm text-muted-foreground">{back.context.english}</p>
        </div>
      )}

      {/* SRS buttons (disabled) */}
      <SrsButtonRow srsComingSoon={srsComingSoon} t={t} />
    </div>
  );
}

function SrsButtonRow({ srsComingSoon, t }: { srsComingSoon: string; t: (key: string) => string }) {
  return (
    <div className="flex justify-center gap-3 px-2 pt-2">
      {SRS_BUTTONS.map(({ key, i18nKey, color, testId }) => {
        const label = t(i18nKey);
        return (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-block">
                <Button
                  disabled
                  data-testid={testId}
                  className={cn(
                    'cursor-not-allowed rounded-lg px-4 py-2 text-sm font-semibold text-white opacity-50',
                    color
                  )}
                  aria-label={`${label} - ${srsComingSoon}`}
                  type="button"
                >
                  {label}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{srsComingSoon}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ============================================
// Component
// ============================================

export function PracticeCard({ card, isFlipped, onFlip }: PracticeCardProps) {
  const { t } = useTranslation('deck');

  const front = card.front_content as unknown as MeaningFrontContent;
  const back = card.back_content as unknown as MeaningBackContent;

  const typeBadgeLabel = t('practice.meaningBadge');
  const tapToRevealLabel = t('practice.tapToReveal');
  const answerLabel = t('practice.answer');
  const srsComingSoon = t('practice.srsComingSoon');
  const partOfSpeech = front.badge ? (front.badge.toLowerCase() as PartOfSpeech) : null;

  return (
    <Card
      data-testid="practice-card"
      className={cn('mx-auto max-w-lg overflow-hidden', !isFlipped && 'cursor-pointer')}
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
      <CardContent className="p-6">
        {/* Screen reader announcement */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isFlipped ? `${answerLabel}: ${back.answer}` : ''}
        </div>

        {!isFlipped ? (
          <CardFront
            front={front}
            typeBadgeLabel={typeBadgeLabel}
            tapToRevealLabel={tapToRevealLabel}
            partOfSpeech={partOfSpeech}
          />
        ) : (
          <CardBack
            back={back}
            typeBadgeLabel={typeBadgeLabel}
            answerLabel={answerLabel}
            srsComingSoon={srsComingSoon}
            t={t}
            partOfSpeech={partOfSpeech}
          />
        )}
      </CardContent>
    </Card>
  );
}
