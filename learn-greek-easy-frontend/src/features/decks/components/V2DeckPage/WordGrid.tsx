// src/features/decks/components/V2DeckPage/WordGrid.tsx

/**
 * Responsive grid of word cards for V2 decks.
 * Uses CSS Grid with auto-fill and minmax for responsive layout.
 */

import { useNavigate, useParams } from 'react-router-dom';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { WordCard } from '../WordCard';

// ============================================
// Utilities
// ============================================

const WIDE_LEMMA_THRESHOLD = 12;

/** Returns true when a lemma is too long for a single grid column. */
export function isWideLemma(lemma: string): boolean {
  return lemma.length > WIDE_LEMMA_THRESHOLD;
}

// ============================================
// WordGrid Component
// ============================================

export interface WordGridProps {
  entries: WordEntryResponse[];
}

/**
 * Responsive grid of word cards.
 * Uses CSS Grid with auto-fill and minmax for responsive layout.
 * Cards with long lemmas (>12 chars) span 2 columns.
 *
 * Grid columns:
 * - Mobile: 2 columns (150px min)
 * - Tablet: 3-4 columns
 * - Desktop: 4-6 columns
 */
export function WordGrid({ entries }: WordGridProps) {
  const navigate = useNavigate();
  const { id: deckId } = useParams<{ id: string }>();

  const handleWordCardClick = (entryId: string) => {
    navigate(`/decks/${deckId}/words/${entryId}`);
  };

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      }}
      data-testid="word-grid"
    >
      {entries.map((entry) => (
        <div key={entry.id} style={isWideLemma(entry.lemma) ? { gridColumn: 'span 2' } : undefined}>
          <WordCard wordEntry={entry} onClick={() => handleWordCardClick(entry.id)} />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

export interface WordGridSkeletonProps {
  count?: number;
}

/**
 * Loading skeleton for WordGrid.
 * Renders placeholder cards while data is loading.
 */
export function WordGridSkeleton({ count = 12 }: WordGridSkeletonProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      }}
      data-testid="word-grid-skeleton"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="flex flex-col gap-2 p-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-auto h-4 w-2/3" />
        </Card>
      ))}
    </div>
  );
}
