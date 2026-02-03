import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NounGender } from '@/types/grammar';
import type { CardReview } from '@/types/review';

import { GenderBadge, PartOfSpeechBadge } from './grammar';

interface CardHeaderProps {
  card: CardReview;
  onFlip: () => void;
  isCardFlipped: boolean;
}

export function CardHeader({ card, onFlip, isCardFlipped }: CardHeaderProps) {
  const { t } = useTranslation('review');
  const partOfSpeech = card.part_of_speech;

  // Extract gender for nouns (to display as GenderBadge)
  const nounGender: NounGender | null =
    partOfSpeech === 'noun' ? (card.noun_data?.gender ?? null) : null;

  // Get voice label for verbs (displayed as text)
  const voiceLabel: string | null =
    partOfSpeech === 'verb' && card.verb_data?.voice
      ? t(`grammar.verbConjugation.voice.${card.verb_data.voice}`)
      : null;

  return (
    <div
      className="cursor-pointer rounded-lg bg-card p-6 text-center"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
      aria-label={t('session.flipCardAriaLabel')}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {partOfSpeech && <PartOfSpeechBadge partOfSpeech={partOfSpeech} />}
          {nounGender && <GenderBadge gender={nounGender} />}
          {card.isEarlyPractice && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  <Clock className="mr-1 h-3 w-3" />
                  {t('session.earlyPractice.badge')}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('session.earlyPractice.tooltip')}</p>
                {card.srData?.dueDate && (
                  <p className="text-xs text-muted-foreground">
                    {t('session.earlyPractice.dueLabel', {
                      date: new Date(card.srData.dueDate).toLocaleDateString(),
                    })}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {voiceLabel && <span className="text-sm text-muted-foreground">{voiceLabel}</span>}
      </div>
      <h2 className="mt-4 text-5xl font-bold">{card.word || card.front}</h2>
      {card.pronunciation && (
        <p className="mt-2 text-xl italic text-muted-foreground">{card.pronunciation}</p>
      )}
      {!isCardFlipped && (
        <p className="mt-4 text-sm text-muted-foreground">{t('session.clickToReveal')}</p>
      )}
    </div>
  );
}
