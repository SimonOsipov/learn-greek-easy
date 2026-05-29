import React from 'react';

import { Check, Crown, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CultureBadge, type CultureCategory } from '@/components/culture';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DxCover, Kicker } from '@/features/decks/dx';
import { getLocalizedDeckName } from '@/lib/deckLocale';
import { calculateCompletionPercentage } from '@/lib/progressUtils';
import { cn } from '@/lib/utils';
import type { Deck } from '@/types/deck';

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
  /** Whether this is the first (active) card in the grid */
  active?: boolean;
  /** Zero-based index in the grid (used for is-active on first card) */
  index?: number;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  onClick,
  variant = 'grid',
  isCultureDeck = false,
  cultureCategory,
  showActions = false,
  onEditClick,
  onDeleteClick,
  active = false,
}) => {
  const { t, i18n } = useTranslation('deck');
  const { level, category, isPremium } = deck;
  const localizedName = getLocalizedDeckName(deck, i18n.language);

  // Derived progress values — R9 resolved: progress is wired via store
  const pct = deck.progress ? calculateCompletionPercentage(deck.progress) : 0;
  const complete = pct >= 100;
  const mastered = deck.progress?.cardsMastered ?? 0;
  const cards = deck.cardCount;

  // Status badge label
  const badge = complete
    ? t('list.badgeComplete')
    : pct > 0
      ? t('list.badgeInProgress')
      : t('list.badgeNew');

  // Determine if card should be locked (premium and user is free tier)
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

  // ── List variant: render the legacy card layout (unchanged) ──────────────
  if (variant === 'list') {
    return (
      <Card
        data-testid="deck-card"
        className={`group relative flex min-h-[170px] flex-row flex-col items-center overflow-hidden ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-lg' : ''} `.trim()}
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
        aria-label={t(isLocked ? 'list.deckCardAriaLabelLocked' : 'list.deckCardAriaLabel', {
          name: localizedName,
          level,
          pct: Math.round(pct),
        })}
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

        <CardHeader data-testid="deck-card-header" className="relative z-20 flex-1 pb-3">
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
                <Crown className="h-4 w-4 text-warning" aria-label={t('dx.premiumContent')} />
              </div>
            )}
          </div>
        </CardHeader>

        <div
          className={`relative z-20 flex flex-wrap items-center gap-2 px-6 pb-4 ${isLocked ? 'blur-sm' : ''}`}
          data-testid="deck-card-badges"
        >
          {isCultureDeck && (
            <CultureBadge category={cultureCategory} showLabel={true} className="on-photo" />
          )}
          {!isCultureDeck && category !== 'culture' && (
            <DeckBadge type="category" category={category} className="on-photo" />
          )}
          {!isCultureDeck && <DeckBadge type="level" level={level} className="on-photo" />}
          {isPremium && <span className="badge b-violet on-photo">{t('card.premium')}</span>}
        </div>

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
  }

  // ── Grid variant: DX gradient cover card ─────────────────────────────────
  return (
    <article
      data-testid="deck-card"
      className={cn('dx-deck-card group', active && 'is-active')}
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
      aria-label={t(isLocked ? 'list.deckCardAriaLabelLocked' : 'list.deckCardAriaLabel', {
        name: localizedName,
        level,
        pct: Math.round(pct),
      })}
    >
      <DxCover deck={deck} variant="card">
        <div className="dx-deck-card-inner">
          {/* Action buttons (edit/delete) - visible on hover — above cover */}
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

          {/* Top row: kicker + status badge */}
          <div className="dx-deck-card-head" data-testid="deck-card-header">
            <Kicker tone="white">
              {isCultureDeck ? (
                <CultureBadge category={cultureCategory} showLabel={true} className="on-photo" />
              ) : (
                `${category} · ${level}`
              )}
            </Kicker>
            <span
              className={cn('dx-deck-card-badge', complete && 'is-primary')}
              data-testid="deck-card-status-badge"
            >
              {badge}
            </span>
          </div>

          {/* Middle: title + Greek subtitle */}
          <div>
            <h3 className="dx-deck-card-h" data-testid="deck-card-title">
              {localizedName}
            </h3>
            {deck.titleGreek && deck.titleGreek !== deck.title && (
              <p className="dx-deck-card-el" lang="el" data-testid="deck-card-greek-subtitle">
                {deck.titleGreek}
              </p>
            )}
          </div>

          {/* Bottom: meta + progress */}
          <div className="dx-deck-card-bottom">
            <div className="dx-deck-card-meta" data-testid="deck-card-meta">
              <span>{cards}</span>
              <span className="dx-dot" aria-hidden="true" />
              <span>
                {mastered} {t('detail.masteredLabel').toLowerCase()}
              </span>
            </div>

            {complete ? (
              <span className="dx-deck-card-complete" data-testid="deck-card-complete">
                <Check aria-hidden="true" />
                {t('list.badgeComplete')}
              </span>
            ) : pct > 0 ? (
              <div className="dx-deck-card-progress" data-testid="deck-card-progress">
                <span className="dx-deck-card-progress-bar" data-testid="deck-card-progress-bar">
                  <span
                    style={{ width: `${Math.round(pct)}%` }}
                    data-testid="deck-card-progress-fill"
                  />
                </span>
                <span className="dx-deck-card-progress-pct" data-testid="deck-card-progress-pct">
                  {Math.round(pct)}%
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </DxCover>

      {/* Premium locked overlay — sits on top of the cover */}
      {isLocked && (
        <div
          data-testid="deck-card-locked-overlay"
          className="pointer-events-none absolute inset-0 z-10 backdrop-blur-sm"
          style={{ backgroundColor: 'hsl(var(--card) / 0.6)' }}
          aria-hidden="true"
        />
      )}

      {/* Premium crown icon (top-right) */}
      {isLocked && (
        <div className="absolute right-3 top-3 z-20">
          <Crown className="h-4 w-4 text-warning" aria-label={t('dx.premiumContent')} />
        </div>
      )}

      {/* Premium overlay badge — visible on cover when deck is premium */}
      {isPremium && (
        <div className="absolute left-3 top-3 z-20" data-testid="deck-card-badges">
          <span className="badge b-violet on-photo">{t('card.premium')}</span>
        </div>
      )}
    </article>
  );
};
