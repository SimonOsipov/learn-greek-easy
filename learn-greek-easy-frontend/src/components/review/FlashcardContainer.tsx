import { useEffect, useState } from 'react';

import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useReviewStore } from '@/stores/reviewStore';
import type { CardReview } from '@/types/review';

import { CardContent } from './CardContent';
import { CardHeader } from './CardHeader';
import { ProgressHeader } from './ProgressHeader';
import { RatingButtons } from './RatingButtons';

interface FlashcardContainerProps {
  card: CardReview;
}

export function FlashcardContainer({ card }: FlashcardContainerProps) {
  const { t } = useTranslation('review');
  const { isCardFlipped, flipCard, activeSession, currentCardIndex } = useReviewStore();
  const [srAnnouncement, setSrAnnouncement] = useState('');

  // Announce card flip to screen readers
  useEffect(() => {
    if (isCardFlipped) {
      setSrAnnouncement(t('session.answerRevealed'));
    }
  }, [isCardFlipped, t]);

  // Announce card transition to screen readers
  useEffect(() => {
    if (activeSession) {
      const totalCards = activeSession.cards.length;
      setSrAnnouncement(t('session.cardOf', { current: currentCardIndex + 1, total: totalCards }));
    }
  }, [card.id, activeSession, currentCardIndex, t]);

  return (
    <>
      {/* Screen reader announcements - visually hidden */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      <div
        data-testid="flashcard"
        className={cn(
          'mx-auto max-w-4xl overflow-hidden rounded-2xl bg-card shadow-2xl',
          'flex flex-col transition-transform duration-300',
          'hover:-translate-y-1'
        )}
      >
        <ProgressHeader />

        {/* Early Practice Indicator */}
        {card.isEarlyPractice && (
          <div className="-mt-2 mb-2 flex justify-center">
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
          </div>
        )}

        {/* Card Header - Greek word with part of speech badge */}
        <div className="px-8 py-6">
          <CardHeader card={card} onFlip={flipCard} />
        </div>

        {/* Card Content - Translations and Grammar tables (visible when flipped) */}
        {isCardFlipped && (
          <div className="px-8 pb-6">
            <CardContent card={card} isFlipped={isCardFlipped} />
          </div>
        )}

        <RatingButtons />
      </div>
    </>
  );
}
