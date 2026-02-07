// src/features/decks/components/V2DeckPage/V2DeckHeader.tsx

import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DeckBadge } from '@/components/decks/DeckBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getLocalizedDeckName, getLocalizedDeckDescription } from '@/lib/deckLocale';
import type { Deck } from '@/types/deck';

/**
 * Props for V2DeckHeader component.
 */
interface V2DeckHeaderProps {
  deck: Deck;
}

/**
 * Helper: Format date (e.g., "Jan 15, 2025")
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
};

/**
 * V2ProgressBar Sub-component
 *
 * Simple progress bar showing all cards as "new" (gray) for V2 decks.
 * V2 decks with word entries don't have SRS progress yet.
 */
interface V2ProgressBarProps {
  total: number;
}

const V2ProgressBar: React.FC<V2ProgressBarProps> = ({ total }) => {
  const { t } = useTranslation('deck');

  return (
    <div>
      <div
        className="h-3 w-full rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-muted" />
          <span>
            {total} {t('v2.toPractice')}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * V2DeckHeader Component
 *
 * Displays the header section for V2 decks with:
 * - Deck title (Greek primary, English secondary)
 * - Category and level badges
 * - Description
 * - Progress bar (all cards shown as "new")
 * - Disabled "Study Now" button with "Coming soon" tooltip
 */
export const V2DeckHeader: React.FC<V2DeckHeaderProps> = ({ deck }) => {
  const { t, i18n } = useTranslation('deck');
  const localizedName = getLocalizedDeckName(deck, i18n.language);
  const localizedDescription = getLocalizedDeckDescription(deck, i18n.language);

  // Use cardCount as the word count (for V2 decks, this represents word entries)
  const wordCount = deck.cardCount;

  return (
    <Card>
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
            {deck.category !== 'culture' && <DeckBadge type="category" category={deck.category} />}
            <DeckBadge type="level" level={deck.level} />
          </div>
        </div>

        {/* Category and metadata */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{t(`card.categories.${deck.category}`)}</span>
          <span>-</span>
          <span>{t('detail.updated', { date: formatDate(deck.updatedAt) })}</span>
        </div>
      </CardHeader>

      <CardContent>
        {/* Description */}
        <p className="leading-relaxed text-foreground">
          {localizedDescription || deck.description}
        </p>

        {/* Progress Bar - All New for V2 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{t('detail.yourProgress')}</span>
            <span className="text-sm text-muted-foreground">0% {t('detail.complete')}</span>
          </div>
          <V2ProgressBar total={wordCount} />
        </div>

        {/* Disabled Study Button with Tooltip */}
        <div className="mt-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-block w-full">
                  <Button
                    data-testid="start-review-button"
                    variant="hero"
                    size="lg"
                    disabled
                    className="w-full cursor-not-allowed opacity-50"
                  >
                    <BookOpen className="mr-2 h-5 w-5" />
                    {t('detail.startReview')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('v2.comingSoon')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};
