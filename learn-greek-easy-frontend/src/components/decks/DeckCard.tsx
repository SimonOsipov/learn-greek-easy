import React from 'react';

import { Lock, Crown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Deck } from '@/types/deck';

import { DeckBadge } from './DeckBadge';
import { DeckProgressBar } from './DeckProgressBar';

export interface DeckCardProps {
  deck: Deck;
  onClick?: () => void;
  showProgress?: boolean;
  variant?: 'grid' | 'list';
  showStats?: boolean;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  onClick,
  showProgress = true,
  variant = 'grid',
  showStats = true,
}) => {
  const { titleGreek, title, level, category, cardCount, isPremium, progress, estimatedTime } =
    deck;

  // Calculate completion percentage
  const completionPercent = progress
    ? Math.round((progress.cardsMastered / progress.cardsTotal) * 100)
    : 0;

  // Determine if card should be locked (premium and user is free tier)
  // This will be checked against auth store in future integration
  const isLocked = isPremium; // Simplified for now

  // Determine if card should be clickable
  const isClickable = onClick && !isLocked;

  // Build className for card
  // Note: Removed opacity-70 from locked cards to maintain WCAG AA contrast
  // Locked state is indicated by Lock icon and non-clickable behavior
  const cardClassName = `
    min-h-[300px] flex flex-col
    ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-lg' : ''}
    ${isLocked ? 'grayscale-[30%]' : ''}
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
      <CardHeader data-testid="deck-card-header" className="flex-shrink-0 pb-3">
        {/* Title and Level Badge Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Greek Title */}
            <h3
              data-testid="deck-card-title"
              className="truncate text-lg font-semibold text-gray-900"
            >
              {titleGreek}
            </h3>
            {/* English Subtitle */}
            <p className="truncate text-sm text-gray-600">{title}</p>
          </div>

          {/* Level Badge and Lock Icon */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {isLocked && <Lock className="h-4 w-4 text-amber-500" aria-label="Premium locked" />}
            <DeckBadge type="level" level={level} />
          </div>
        </div>

        {/* Premium Badge - Reserve space for consistency */}
        <div className="mt-2 h-6">
          {isPremium && (
            <Badge className="inline-flex items-center gap-1 border-0 bg-gradient-to-r from-purple-500 to-purple-700 text-white">
              <Crown className="h-3 w-3" />
              Premium
            </Badge>
          )}
        </div>

        {/* Category Tag */}
        <div className="mt-2">
          <span className="text-xs capitalize text-gray-600">{category}</span>
        </div>
      </CardHeader>

      <CardContent
        data-testid="deck-card-content"
        className="flex flex-1 flex-col justify-between pt-0"
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
              <p className="mt-1 text-xs text-gray-600">{completionPercent}% Complete</p>
            </div>
          )}
        </div>

        {/* Stats Row */}
        {showStats && (
          <div
            data-testid="deck-card-stats"
            className="grid grid-cols-3 gap-2 border-t pt-3 text-center"
          >
            {/* Card Count */}
            <div>
              <p className="text-xs text-gray-600">Cards</p>
              <p className="text-sm font-semibold text-gray-900">{cardCount}</p>
            </div>

            {/* Estimated Time */}
            <div>
              <p className="text-xs text-gray-600">Time</p>
              <p className="text-sm font-semibold text-gray-900">{estimatedTime}m</p>
            </div>

            {/* Completion or Mastery Rate */}
            <div>
              <p className="text-xs text-gray-600">Mastery</p>
              <p className="text-sm font-semibold text-gray-900">{completionPercent}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
