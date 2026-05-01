// src/features/decks/components/V2DeckPage/WordGrid.tsx

/**
 * Responsive grid of word cards for V2 decks.
 * Uses CSS Grid with auto-fill and minmax for responsive layout.
 */

import { useNavigate, useParams } from 'react-router-dom';

import type { CardStatus } from '@/components/shared/cardStatusColors';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WordMasteryItem } from '@/services/progressAPI';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

import { WordCard } from '../WordCard';

// ============================================
// Utilities
// ============================================

const WIDE_LEMMA_THRESHOLD = 12;
const WIDE_TRANSLATION_THRESHOLD = 17;

/** Returns true when a word entry needs a wide (2-column) card. */
export function isWideCard(entry: WordEntryResponse): boolean {
  if (entry.lemma.length > WIDE_LEMMA_THRESHOLD) return true;
  if (entry.translation_en.length > WIDE_TRANSLATION_THRESHOLD) return true;
  if (entry.translation_ru && entry.translation_ru.length > WIDE_TRANSLATION_THRESHOLD) return true;
  return false;
}

// ============================================
// WordGrid Component
// ============================================

export interface WordGridProps {
  entries: WordEntryResponse[];
  masteryMap?: Map<string, WordMasteryItem>;
}

/**
 * Responsive grid of word cards.
 * Uses CSS Grid with auto-fill and minmax for responsive layout.
 * Cards with long lemmas (>12 chars) or translations (>20 chars) span 2 columns.
 *
 * Grid columns:
 * - Mobile: 2 columns (150px min)
 * - Tablet: 3-4 columns
 * - Desktop: 4-6 columns
 */
export function WordGrid({ entries, masteryMap }: WordGridProps) {
  const navigate = useNavigate();
  const { id: deckId } = useParams<{ id: string }>();

  const handleWordCardClick = (entryId: string) => {
    navigate(`/decks/${deckId}/words/${entryId}`);
  };

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gridAutoFlow: 'dense',
      }}
      data-testid="word-grid"
    >
      {entries.map((entry) => {
        const m = masteryMap?.get(entry.id);
        const masteryStatus: CardStatus = m
          ? m.mastered_count === m.total_count && m.total_count > 0
            ? 'mastered'
            : m.studied_count > 0
              ? 'learning'
              : 'new'
          : 'new';
        const masteryFilled = m ? Math.min(m.studied_count, 4) : 0;
        return (
          <div key={entry.id} style={isWideCard(entry) ? { gridColumn: 'span 2' } : undefined}>
            <WordCard
              wordEntry={entry}
              onClick={() => handleWordCardClick(entry.id)}
              masteryStatus={masteryStatus}
              masteryFilled={masteryFilled}
              typeProgress={m?.type_progress}
            />
          </div>
        );
      })}
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
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
