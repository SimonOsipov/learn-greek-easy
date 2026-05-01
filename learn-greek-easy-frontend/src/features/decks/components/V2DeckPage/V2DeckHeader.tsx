// src/features/decks/components/V2DeckPage/V2DeckHeader.tsx

import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { DeckBadge } from '@/components/decks/DeckBadge';
import { DeckProgressBar } from '@/components/decks/DeckProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getDeckBackgroundStyle } from '@/lib/deckBackground';
import { getLocalizedDeckName, getLocalizedDeckDescription } from '@/lib/deckLocale';
import { progressAPI } from '@/services/progressAPI';
import type { Deck } from '@/types/deck';

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
 * - Deck title (Greek primary, English secondary)
 * - Category and level badges
 * - Description
 * - Progress bar (all cards shown as "new")
 * - Card type filter pills
 * - Enabled "Study Now" button navigating to /decks/:id/practice
 */
export const V2DeckHeader: React.FC<V2DeckHeaderProps> = ({ deck }) => {
  const { t, i18n } = useTranslation('deck');
  const navigate = useNavigate();
  const [selectedCardType, setSelectedCardType] = useState<string>('all');

  const localizedName = getLocalizedDeckName(deck, i18n.language);
  const localizedDescription = getLocalizedDeckDescription(deck, i18n.language);

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
      <Card style={getDeckBackgroundStyle(deck.coverImageUrl)}>
        <CardHeader>
          {/* Title Row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Localized Title */}
              <h1 className="mb-1 text-2xl font-semibold text-foreground md:text-3xl">
                {localizedName}
              </h1>
            </div>

            {/* Badges */}
            <div className="flex flex-shrink-0 items-center gap-2">
              {deck.category !== 'culture' && (
                <DeckBadge
                  type="category"
                  category={deck.category}
                  className={deck.coverImageUrl ? 'on-photo' : ''}
                />
              )}
              <DeckBadge
                type="level"
                level={deck.level}
                className={deck.coverImageUrl ? 'on-photo' : ''}
              />
            </div>
          </div>

          {/* Category and metadata */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{t(`card.categories.${deck.category}`)}</span>
          </div>
        </CardHeader>

        <CardContent>
          {/* Description */}
          <p className="leading-relaxed text-foreground">
            {localizedDescription || deck.description}
          </p>
        </CardContent>
      </Card>

      {/* Progress & Action — below the cover image */}
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
                totalTimeSpent: 0,
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
