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

import { useTranslation } from 'react-i18next';

import { STATUS_DOT_CLASS } from '@/components/shared/cardStatusColors';
import type { CardStatus } from '@/components/shared/cardStatusColors';
import { MasteryDots } from '@/components/shared/MasteryDots';
import type { DotStatus, TypedDot } from '@/components/shared/MasteryDots';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getLocalizedTranslation } from '@/lib/localeUtils';
import { cn } from '@/lib/utils';
import type { CardTypeMastery } from '@/services/progressAPI';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// POS Abbreviations
// ============================================

const POS_ABBREVIATIONS: Record<string, string> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj.',
  adverb: 'adv.',
  phrase: 'phrase',
};

const getPosLabel = (pos: string): string =>
  POS_ABBREVIATIONS[pos.toLowerCase()] ?? pos.toLowerCase();

// ============================================
// Card Type Groups
// ============================================

const CARD_TYPE_GROUPS = [
  {
    labelKey: 'v2Practice.filterTranslation',
    types: ['meaning_el_to_en', 'meaning_en_to_el', 'sentence_translation'],
  },
  { labelKey: 'v2Practice.filterPluralForm', types: ['plural_form'] },
  { labelKey: 'v2Practice.filterArticle', types: ['article'] },
  { labelKey: 'v2Practice.filterDeclension', types: ['declension'] },
];

function computeDotStatuses(typeProgress: CardTypeMastery[]): TypedDot[] {
  return CARD_TYPE_GROUPS.map((group) => {
    const matches = typeProgress.filter((tp) => group.types.includes(tp.card_type));
    const totalStudied = matches.reduce((sum, m) => sum + m.studied_count, 0);
    const totalMastered = matches.reduce((sum, m) => sum + m.mastered_count, 0);
    const totalCount = matches.reduce((sum, m) => sum + m.total_count, 0);

    let status: DotStatus = 'none';
    if (totalCount > 0 && totalMastered === totalCount) {
      status = 'mastered';
    } else if (totalStudied > 0) {
      status = 'studied';
    }

    return { labelKey: group.labelKey, status };
  });
}

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
  /** Mastery status for the indicator dot */
  masteryStatus?: CardStatus;
  /** Number of mastery dots filled (0-4) */
  masteryFilled?: number;
  /** Per-card-type mastery breakdown for typed dots */
  typeProgress?: CardTypeMastery[];
}

interface MasteryIndicatorProps {
  status?: CardStatus;
}

// ============================================
// Sub-Components
// ============================================

/**
 * Mastery indicator dot (top-right corner).
 * Color reflects mastery status: gray (new), blue (learning), green (mastered).
 */
const MasteryIndicator: React.FC<MasteryIndicatorProps> = ({ status = 'new' }) => {
  return (
    <div
      data-testid="word-card-mastery-indicator"
      className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOT_CLASS[status])}
      aria-label={`Mastery: ${status}`}
    />
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
        <div className="absolute left-3 top-3">
          <Skeleton className="h-3 w-8" />
        </div>
        <div className="absolute right-3 top-3">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
        </div>
        <div className="flex flex-col items-center space-y-2 pt-2 text-center">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
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
export const WordCard: React.FC<WordCardProps> = ({
  wordEntry,
  onClick,
  loading = false,
  masteryStatus = 'new',
  masteryFilled = 0,
  typeProgress,
}) => {
  const { i18n } = useTranslation();
  const { lemma, pronunciation, translation_en, translation_ru } = wordEntry;
  const displayTranslation = getLocalizedTranslation(translation_en, translation_ru, i18n.language);

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
      aria-label={`${lemma} - ${displayTranslation}`}
    >
      <CardContent className="p-4">
        {/* Top-left POS label */}
        <span
          data-testid="word-card-pos"
          className="absolute left-3 top-3 text-xs text-muted-foreground"
        >
          {getPosLabel(wordEntry.part_of_speech)}
        </span>

        {/* Top-right mastery indicator */}
        <div className="absolute right-3 top-3">
          <MasteryIndicator status={masteryStatus} />
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

          {/* Locale-aware translation */}
          <p data-testid="word-card-translation" className="text-sm text-muted-foreground">
            {displayTranslation}
          </p>

          {/* Bottom mastery dots */}
          <div className="pt-2">
            <MasteryDots
              dots={
                typeProgress && typeProgress.length > 0
                  ? computeDotStatuses(typeProgress)
                  : undefined
              }
              filled={Math.min(masteryFilled, 4)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

WordCard.displayName = 'WordCard';
