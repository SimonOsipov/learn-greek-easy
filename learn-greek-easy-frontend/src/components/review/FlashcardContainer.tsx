import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { useReviewStore } from '@/stores/reviewStore';
import type { CardReview } from '@/types/review';

import { CardMain } from './CardMain';
import { NounGrammarSection } from './grammar/NounGrammarSection';
import { VerbGrammarSection } from './grammar/VerbGrammarSection';
import { ProgressHeader } from './ProgressHeader';
import { RatingButtons } from './RatingButtons';
import { ExampleSection } from './shared/ExampleSection';

interface FlashcardContainerProps {
  card: CardReview;
}

export function FlashcardContainer({ card }: FlashcardContainerProps) {
  const { isCardFlipped, flipCard, activeSession, currentCardIndex } = useReviewStore();
  const [selectedTense, setSelectedTense] = useState<'present' | 'past' | 'future'>('present');
  const [srAnnouncement, setSrAnnouncement] = useState('');

  // Reset tense when card changes
  useEffect(() => {
    setSelectedTense('present');
  }, [card.id]);

  // Announce card flip to screen readers
  useEffect(() => {
    if (isCardFlipped) {
      setSrAnnouncement('Answer revealed');
    }
  }, [isCardFlipped]);

  // Announce card transition to screen readers
  useEffect(() => {
    if (activeSession) {
      const totalCards = activeSession.cards.length;
      setSrAnnouncement(`Card ${currentCardIndex + 1} of ${totalCards}`);
    }
  }, [card.id, activeSession, currentCardIndex]);

  return (
    <>
      {/* Screen reader announcements - visually hidden */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>

      <div
        data-testid="flashcard"
        className={cn(
          'mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl',
          'flex min-h-[800px] flex-col transition-transform duration-300',
          'hover:-translate-y-1'
        )}
      >
        <ProgressHeader />
        <CardMain card={card} isFlipped={isCardFlipped} onFlip={flipCard} />
        <RatingButtons />

        {/* Grammar Section - conditional based on card type */}
        {card.nounData && <NounGrammarSection nounData={card.nounData} />}
        {card.verbData && (
          <VerbGrammarSection
            verbData={card.verbData}
            selectedTense={selectedTense}
            onTenseChange={setSelectedTense}
          />
        )}

        <ExampleSection card={card} selectedTense={selectedTense} isFlipped={isCardFlipped} />
      </div>
    </>
  );
}
