import React from 'react';

import { Crown, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CultureBadge, type CultureCategory } from '@/components/culture';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { calculateCompletionPercentage } from '@/lib/progressUtils';
import type { Deck } from '@/types/deck';

import { DeckBadge } from './DeckBadge';
import { DeckProgressBar } from './DeckProgressBar';

export interface DeckCardProps {
  deck: Deck;
  onClick?: () => void;
  showProgress?: boolean;
  variant?: 'grid' | 'list';
  showStats?: boolean;
  isCultureDeck?: boolean;
  cultureCategory?: CultureCategory;
  /** Show edit/delete action buttons (for user-owned decks) */
  showActions?: boolean;
  /** Callback when edit button is clicked */
  onEditClick?: () => void;
  /** Callback when delete button is clicked */
  onDeleteClick?: () => void;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  onClick,
  showProgress = true,
  variant = 'grid',
  showStats = true,
  isCultureDeck = false,
  cultureCategory,
  showActions = false,
  onEditClick,
  onDeleteClick,
}) => {
  const { t } = useTranslation('deck');
  const { titleGreek, title, level, category, cardCount, isPremium, progress } = deck;

  // Calculate completion percentage
  const completionPercent = progress ? calculateCompletionPercentage(progress) : 0;

  // Determine if card should be locked (premium and user is free tier)
  // This will be checked against auth store in future integration
  const isLocked = isPremium; // Simplified for now

  // Determine if card should be clickable
  const isClickable = onClick && !isLocked;

  // Handle edit button click (prevent card click)
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.();
  };

  // Handle delete button click (prevent card click)
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClick?.();
  };

  // Build className for card
  // Note: Removed opacity-70 from locked cards to maintain WCAG AA contrast
  // Locked state is indicated by Lock icon and non-clickable behavior
  const cardClassName = `
    relative overflow-hidden group
    min-h-[300px] flex flex-col
    ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-lg' : ''}
    ${isPremium && !isLocked ? 'border-amber-400 hover:border-amber-500' : ''}
    ${variant === 'list' ? 'flex flex-row items-center' : ''}
  `.trim();

  return (
    <Card
      data-testid="deck-card"
      className={cardClassName}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : 'article'}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={`${titleGreek} - ${title} deck, ${level} level, ${completionPercent}% completed${isLocked ? ', locked' : ''}`}
    >
      {/* Action buttons (edit/delete) - visible on hover */}
      {showActions && (
        <div
          className="absolute right-2 top-2 z-30 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          data-testid="deck-card-actions"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditClick}
            data-testid={`edit-deck-${deck.id}`}
            className="h-8 w-8 rounded-full bg-background/80 p-0 hover:bg-background"
            aria-label={t('myDecks.editDeck')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            data-testid={`delete-deck-${deck.id}`}
            className="h-8 w-8 rounded-full bg-background/80 p-0 text-destructive hover:bg-background hover:text-destructive"
            aria-label={t('myDecks.deleteDeck')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <CardHeader data-testid="deck-card-header" className="relative z-20 flex-shrink-0 pb-3">
        {/* Title and Level Badge Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Greek Title */}
            <h3
              data-testid="deck-card-title"
              className="truncate text-lg font-semibold text-foreground"
            >
              {titleGreek}
            </h3>
            {/* English Subtitle */}
            <p className="truncate text-sm text-muted-foreground">{title}</p>
          </div>

          {/* Premium Icon (level badge moved to badge row) */}
          {isLocked && (
            <div className="flex-shrink-0">
              <Crown className="h-4 w-4 text-amber-500" aria-label="Premium content" />
            </div>
          )}
        </div>

        {/* Badge Row - Category + Level + Premium displayed together */}
        <div className="mt-2 flex min-h-6 flex-wrap items-center gap-2">
          {isCultureDeck && <CultureBadge category={cultureCategory} showLabel={true} />}

          {!isCultureDeck && category !== 'culture' && (
            <DeckBadge type="category" category={category} />
          )}

          {/* Level badge - moved from title row to be next to category */}
          {!isCultureDeck && <DeckBadge type="level" level={level} />}

          {isPremium && (
            <Badge className="inline-flex items-center gap-1 border-0 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
              <Crown className="h-3 w-3" />
              {t('card.premium')}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent
        data-testid="deck-card-content"
        className={`flex flex-1 flex-col justify-between pt-0 ${isLocked ? 'blur-sm' : ''}`}
      >
        <div>
          {/* Progress Bar - Always shown if showProgress is true */}
          {showProgress && (
            <div className="mb-4">
              <DeckProgressBar
                progress={
                  progress || {
                    cardsTotal: cardCount,
                    cardsMastered: 0,
                    cardsLearning: 0,
                    cardsNew: cardCount,
                  }
                }
                showLegend={false}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {completionPercent}% {t('detail.complete')}
              </p>
            </div>
          )}
        </div>

        {/* Stats Row */}
        {showStats && (
          <div
            data-testid="deck-card-stats"
            className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-center"
          >
            {/* Card Count */}
            <div>
              <p className="text-xs text-muted-foreground">
                {isCultureDeck
                  ? t('detail.questions')
                  : deck.cardSystem === 'V2'
                    ? t('detail.words')
                    : t('detail.cards')}
              </p>
              <p className="text-sm font-semibold text-foreground">{cardCount}</p>
            </div>

            {/* Completion or Progress */}
            <div>
              <p className="text-xs text-muted-foreground">{t('detail.progress')}</p>
              <p className="text-sm font-semibold text-foreground">{completionPercent}%</p>
            </div>
          </div>
        )}
      </CardContent>

      {/* Locked state overlay - indicates premium content */}
      {isLocked && (
        <div
          data-testid="deck-card-locked-overlay"
          className="pointer-events-none absolute inset-0 z-10 bg-background/30"
          aria-hidden="true"
        />
      )}
    </Card>
  );
};
