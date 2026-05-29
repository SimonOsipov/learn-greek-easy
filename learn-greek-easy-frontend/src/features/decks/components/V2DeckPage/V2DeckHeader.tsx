// src/features/decks/components/V2DeckPage/V2DeckHeader.tsx

import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DeckProgressBar } from '@/components/decks/DeckProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { progressAPI } from '@/services/progressAPI';
import type { Deck } from '@/types/deck';

import { DxResumeHeroConnected } from './DxResumeHero';

/**
 * Card type filter options for practice session.
 */
const CARD_TYPE_FILTERS = [
  { value: 'all', labelKey: 'v2Practice.filterAll' },
  { value: 'meaning', labelKey: 'v2Practice.filterTranslation' },
  { value: 'plural_form', labelKey: 'v2Practice.filterPluralForm' },
  { value: 'article', labelKey: 'v2Practice.filterArticle' },
  { value: 'declension', labelKey: 'v2Practice.filterDeclension' },
] as const;

/**
 * Props for V2DeckHeader component.
 */
interface V2DeckHeaderProps {
  deck: Deck;
}

/**
 * V2DeckHeader Component
 *
 * Displays the header section for V2 decks with:
 * - DX-05 resume hero (DxResumeHeroConnected) replacing the old cover-image card
 * - Progress bar
 * - Card type filter pills
 * - Enabled "Study Now" button navigating to /decks/:id/practice
 */
export const V2DeckHeader: React.FC<V2DeckHeaderProps> = ({ deck }) => {
  const { t } = useTranslation('deck');
  const navigate = useNavigate();
  const [selectedCardType, setSelectedCardType] = useState<string>('all');

  // Use cardCount as the word count (for V2 decks, this represents word entries)
  const wordCount = deck.cardCount;

  const { data: progressData } = useQuery({
    queryKey: ['deckProgress', deck.id],
    queryFn: () => progressAPI.getDeckProgressDetail(deck.id),
  });

  const completionPct = progressData
    ? progressData.progress.total_cards > 0
      ? Math.round((progressData.progress.cards_mastered / progressData.progress.total_cards) * 100)
      : 0
    : 0;

  const handleStartReview = () => {
    const basePath = `/decks/${deck.id}/practice`;
    if (selectedCardType === 'all') {
      navigate(basePath);
    } else {
      navigate(`${basePath}?cardType=${selectedCardType}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* DX-05: Resume hero replaces the old cover-image card */}
      <DxResumeHeroConnected deck={deck} progress={progressData?.progress} />

      {/* Progress & Action — below the resume hero */}
      <Card>
        <CardContent className="pt-6">
          {/* Progress Bar - All New for V2 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {t('detail.yourProgress')}
              </span>
              <span className="text-sm text-muted-foreground">
                {completionPct}% {t('detail.complete')}
              </span>
            </div>
            <DeckProgressBar
              progress={{
                deckId: deck.id,
                status:
                  completionPct === 100
                    ? 'completed'
                    : completionPct > 0
                      ? 'in-progress'
                      : 'not-started',
                cardsTotal: progressData?.progress.total_cards ?? wordCount,
                cardsNew: progressData?.progress.cards_new ?? wordCount,
                cardsLearning: progressData?.progress.cards_learning ?? 0,
                cardsReview: progressData?.progress.cards_review ?? 0,
                cardsMastered: progressData?.progress.cards_mastered ?? 0,
                dueToday: progressData?.progress.cards_due ?? 0,
                streak: 0,
                totalTimeSpent: progressData?.statistics?.total_study_time_seconds ?? 0, // raw seconds — DX-06 formats to minutes
                accuracy: 0,
              }}
              showLegend={true}
              size="large"
            />
          </div>

          {/* Card Type Filter Pills */}
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              {t('v2Practice.filterLabel')}
            </p>
            <div className="flex flex-wrap gap-2">
              {CARD_TYPE_FILTERS.map(({ value, labelKey }) => (
                <Button
                  key={value}
                  variant={selectedCardType === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCardType(value)}
                  aria-pressed={selectedCardType === value}
                >
                  {t(labelKey)}
                </Button>
              ))}
            </div>
          </div>

          {/* Study Button */}
          <div className="mt-6">
            <Button
              data-testid="start-review-button"
              variant="hero"
              size="lg"
              className="w-full"
              onClick={handleStartReview}
            >
              <BookOpen className="mr-2 h-5 w-5" />
              {t('detail.startReview')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
