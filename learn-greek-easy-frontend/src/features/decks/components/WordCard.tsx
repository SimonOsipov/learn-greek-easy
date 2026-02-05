// src/features/decks/components/WordCard.tsx

/**
 * WordCard Component
 *
 * Individual word card displaying:
 * - Greek lemma (large, prominent)
 * - Pronunciation (if available)
 * - English translation
 * - Mastery indicator (top-right, placeholder for V2)
 * - Mastery dots (bottom, placeholder for V2)
 *
 * Includes full accessibility support with keyboard navigation.
 */

import React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// Types
// ============================================

export interface WordCardProps {
  /** Word entry data from API */
  wordEntry: WordEntryResponse;
  /** Click handler - navigates to word reference page */
  onClick?: () => void;
  /** Optional: Show loading state */
  loading?: boolean;
}

interface MasteryIndicatorProps {
  /** 0-5, where 0 = not started, 5 = mastered */
  level: number;
}

interface MasteryDotsProps {
  /** Total number of dots */
  count: number;
  /** Number of filled dots */
  filled: number;
}

// ============================================
// Sub-Components
// ============================================

/**
 * Mastery indicator dot (top-right corner).
 * V2 placeholder: always gray for now.
 * Future: color based on level (green for mastered, yellow for learning, etc.)
 */
const MasteryIndicator: React.FC<MasteryIndicatorProps> = ({ level }) => {
  return (
    <div
      data-testid="word-card-mastery-indicator"
      className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30"
      aria-label={`Mastery level: ${level} of 5`}
    />
  );
};

/**
 * Mastery dots row (bottom of card).
 * Shows progress with filled/empty dots.
 * V2 placeholder: all dots gray for now.
 */
const MasteryDots: React.FC<MasteryDotsProps> = ({ count, filled }) => {
  return (
    <div
      data-testid="word-card-mastery-dots"
      className="flex gap-1"
      aria-label={`Progress: ${filled} of ${count}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i < filled
              ? 'bg-primary' // Filled dot
              : 'bg-muted-foreground/30' // Empty dot
          )}
        />
      ))}
    </div>
  );
};

// ============================================
// WordCardSkeleton Component
// ============================================

/**
 * Loading skeleton for WordCard.
 * Displays placeholder shapes while data loads.
 */
export const WordCardSkeleton: React.FC = () => {
  return (
    <Card data-testid="word-card-skeleton" className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="absolute right-3 top-3">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
        </div>
        <div className="flex flex-col items-center space-y-2 pt-2 text-center">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-2 w-2 rounded-full" />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

WordCardSkeleton.displayName = 'WordCardSkeleton';

// ============================================
// WordCard Component
// ============================================

/**
 * Individual word card component for V2 decks.
 *
 * Displays word entry with:
 * - Greek lemma prominently
 * - Pronunciation in italic (when available)
 * - English translation
 * - Mastery indicators (placeholders for V2)
 *
 * Supports click navigation and keyboard accessibility.
 */
export const WordCard: React.FC<WordCardProps> = ({ wordEntry, onClick, loading = false }) => {
  const { lemma, pronunciation, translation_en } = wordEntry;

  // Card is clickable if onClick is provided
  const isClickable = !!onClick;

  if (loading) {
    return <WordCardSkeleton />;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      data-testid="word-card"
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        isClickable && 'cursor-pointer hover:border-primary hover:shadow-md'
      )}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      aria-label={`${lemma} - ${translation_en}`}
    >
      <CardContent className="p-4">
        {/* Top-right mastery indicator (placeholder) */}
        <div className="absolute right-3 top-3">
          <MasteryIndicator level={0} />
        </div>

        {/* Main content - centered */}
        <div className="flex flex-col items-center space-y-2 pt-2 text-center">
          {/* Greek lemma */}
          <h3 data-testid="word-card-lemma" className="text-xl font-semibold text-foreground">
            {lemma}
          </h3>

          {/* Pronunciation (if available) */}
          {pronunciation && (
            <p
              data-testid="word-card-pronunciation"
              className="text-sm italic text-muted-foreground"
            >
              {pronunciation}
            </p>
          )}

          {/* English translation */}
          <p data-testid="word-card-translation" className="text-sm text-muted-foreground">
            {translation_en}
          </p>

          {/* Bottom mastery dots (5 dots, all gray for V2) */}
          <div className="pt-2">
            <MasteryDots count={5} filled={0} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

WordCard.displayName = 'WordCard';
