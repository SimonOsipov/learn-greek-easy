import { useState, useEffect } from 'react';

import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  const { t } = useTranslation('review');
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
          'mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl',
          'flex min-h-[800px] flex-col transition-transform duration-300',
          'hover:-translate-y-1'
        )}
      >
        <ProgressHeader />

        {/* Early Practice Indicator */}
        {card.isEarlyPractice && (
          <div className="-mt-2 mb-2 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
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
