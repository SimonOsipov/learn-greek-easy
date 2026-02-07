import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useReviewStore } from '@/stores/reviewStore';
import type { CardReview } from '@/types/review';

import { CardContent } from './CardContent';
import { CardHeader } from './CardHeader';
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
          'flex flex-col'
        )}
      >
        {/* Card Header - Greek word with part of speech badge */}
        <div className="px-8 py-6">
          <CardHeader card={card} onFlip={flipCard} isCardFlipped={isCardFlipped} />
        </div>

        {/* Rating Buttons - visible after reveal, positioned above content */}
        <RatingButtons isFlipped={isCardFlipped} />

        {/* Card Content - Translations and Grammar tables (blurred until revealed) */}
        <div className="px-8 pb-6">
          <CardContent card={card} isFlipped={isCardFlipped} />
        </div>
      </div>
    </>
  );
}
