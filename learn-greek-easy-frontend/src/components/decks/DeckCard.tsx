import React from 'react';

import { Crown, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CultureBadge, getCategoryColor, type CultureCategory } from '@/components/culture';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { getDeckBackgroundStyle } from '@/lib/deckBackground';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { calculateCompletionPercentage } from '@/lib/progressUtils';
import type { Deck, DeckLevel } from '@/types/deck';

import { DeckBadge } from './DeckBadge';

export interface DeckCardProps {
  deck: Deck;
  onClick?: () => void;
  variant?: 'grid' | 'list';
  isCultureDeck?: boolean;
  cultureCategory?: CultureCategory;
  /** Show edit/delete action buttons (for user-owned decks) */
  showActions?: boolean;
  /** Callback when edit button is clicked */
  onEditClick?: () => void;
  /** Callback when delete button is clicked */
  onDeleteClick?: () => void;
}

// Accent stripe: one documented token-based Tailwind class per CEFR level
// Matches the badge color intent without raw palette classes.
const CEFR_ACCENT_STRIPE: Record<DeckLevel, string> = {
  A1: 'bg-primary',
  A2: 'bg-accent',
  B1: 'bg-warning',
  B2: 'bg-success',
};

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  onClick,
  variant = 'grid',
  isCultureDeck = false,
  cultureCategory,
  showActions = false,
  onEditClick,
  onDeleteClick,
}) => {
  const { t, i18n } = useTranslation('deck');
  const { level, category, isPremium } = deck;
  const localizedName = getLocalizedDeckName(deck, i18n.language);

  // Calculate completion percentage
  const completionPercent = deck.progress ? calculateCompletionPercentage(deck.progress) : 0;

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
    flex flex-col min-h-[170px]
    ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-lg' : ''}
    ${variant === 'list' ? 'flex flex-row items-center' : ''}
  `.trim();

  const getAccentStripeColor = (): string => {
    if (isCultureDeck && cultureCategory) {
      return getCategoryColor(cultureCategory).dot;
    }
    return CEFR_ACCENT_STRIPE[level] ?? 'bg-primary';
  };

  return (
    <Card
      data-testid="deck-card"
      className={cardClassName}
      style={getDeckBackgroundStyle(deck.coverImageUrl)}
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
      aria-label={`${localizedName} deck, ${level} level, ${completionPercent}% completed${isLocked ? ', locked' : ''}`}
    >
      {/* Accent stripe */}
      <div
        className={`h-1 w-full ${getAccentStripeColor()}`}
        aria-hidden="true"
        data-testid="deck-card-accent-stripe"
      />

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

      <CardHeader data-testid="deck-card-header" className="relative z-20 flex-1 pb-3">
        {/* Title and Premium Icon */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              data-testid="deck-card-title"
              className="truncate text-lg font-semibold text-foreground"
            >
              {localizedName}
            </h3>
          </div>

          {isLocked && (
            <div className="flex-shrink-0">
              <Crown className="h-4 w-4 text-warning" aria-label="Premium content" />
            </div>
          )}
        </div>
      </CardHeader>

      {/* Badge Row - bottom-left corner */}
      <div
        className={`relative z-20 flex flex-wrap items-center gap-2 px-6 pb-4 ${isLocked ? 'blur-sm' : ''}`}
        data-testid="deck-card-badges"
      >
        {isCultureDeck && <CultureBadge category={cultureCategory} showLabel={true} />}

        {!isCultureDeck && category !== 'culture' && (
          <DeckBadge type="category" category={category} />
        )}

        {!isCultureDeck && <DeckBadge type="level" level={level} />}

        {isPremium && <span className="badge b-violet">{t('card.premium')}</span>}
      </div>

      {/* Locked state overlay - indicates premium content */}
      {isLocked && (
        <div
          data-testid="deck-card-locked-overlay"
          className="pointer-events-none absolute inset-0 z-10 backdrop-blur-sm"
          style={{ backgroundColor: 'hsl(var(--card) / 0.6)' }}
          aria-hidden="true"
        />
      )}
    </Card>
  );
};
