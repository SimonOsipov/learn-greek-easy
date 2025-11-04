import React from 'react';

import { Lock } from 'lucide-react';

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
  const cardClassName = `
    ${isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-lg' : ''}
    ${isLocked ? 'opacity-70' : ''}
    ${isPremium && !isLocked ? 'border-amber-400 hover:border-amber-500' : ''}
    ${variant === 'list' ? 'flex flex-row items-center' : ''}
  `.trim();

  return (
    <Card
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
      <CardHeader className="pb-3">
        {/* Title and Level Badge Row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* Greek Title */}
            <h3 className="truncate text-lg font-semibold text-gray-900">{titleGreek}</h3>
            {/* English Subtitle */}
            <p className="truncate text-sm text-gray-500">{title}</p>
          </div>

          {/* Level Badge and Lock Icon */}
          <div className="flex flex-shrink-0 items-center gap-2">
            {isLocked && <Lock className="h-4 w-4 text-amber-500" aria-label="Premium locked" />}
            <DeckBadge type="level" level={level} />
          </div>
        </div>

        {/* Premium Badge */}
        {isPremium && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
              Premium
            </span>
          </div>
        )}

        {/* Category Tag */}
        <div className="mt-2">
          <span className="text-xs capitalize text-gray-600">{category}</span>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Progress Bar */}
        {showProgress && progress && (
          <div className="mb-4">
            <DeckProgressBar progress={progress} showLegend={false} />
            <p className="mt-1 text-xs text-gray-500">{completionPercent}% Complete</p>
          </div>
        )}

        {/* Stats Row */}
        {showStats && (
          <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
            {/* Card Count */}
            <div>
              <p className="text-xs text-gray-500">Cards</p>
              <p className="text-sm font-semibold text-gray-900">{cardCount}</p>
            </div>

            {/* Estimated Time */}
            <div>
              <p className="text-xs text-gray-500">Time</p>
              <p className="text-sm font-semibold text-gray-900">{estimatedTime}m</p>
            </div>

            {/* Completion or Mastery Rate */}
            <div>
              <p className="text-xs text-gray-500">Mastery</p>
              <p className="text-sm font-semibold text-gray-900">{completionPercent}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
