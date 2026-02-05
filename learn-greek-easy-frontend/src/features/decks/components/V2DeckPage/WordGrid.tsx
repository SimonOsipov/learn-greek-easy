// src/features/decks/components/V2DeckPage/WordGrid.tsx

/**
 * Responsive grid of word cards for V2 decks.
 * Uses CSS Grid with auto-fill and minmax for responsive layout.
 */

import { Volume2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// WordCard Component
// ============================================

interface WordCardProps {
  entry: WordEntryResponse;
}

/**
 * Individual word card showing:
 * - Greek lemma (large, prominent)
 * - Pronunciation (if available)
 * - English translation
 * - Part of speech badge
 */
function WordCard({ entry }: WordCardProps) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-2 p-4 transition-shadow hover:shadow-md',
        'cursor-pointer' // Future: click to expand/see examples
      )}
      data-testid={`word-card-${entry.id}`}
    >
      {/* Greek word (lemma) */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold leading-tight text-foreground">{entry.lemma}</h3>
        {entry.audio_key && (
          <button
            className="shrink-0 text-muted-foreground hover:text-primary"
            aria-label="Play pronunciation"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Pronunciation */}
      {entry.pronunciation && (
        <p className="text-sm italic text-muted-foreground">[{entry.pronunciation}]</p>
      )}

      {/* English translation */}
      <p className="line-clamp-2 text-sm text-foreground/80">{entry.translation_en}</p>

      {/* Part of speech badge */}
      <div className="mt-auto pt-2">
        <Badge variant="secondary" className="text-xs capitalize">
          {entry.part_of_speech}
        </Badge>
      </div>
    </Card>
  );
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
 *
 * Grid columns:
 * - Mobile: 2 columns (150px min)
 * - Tablet: 3-4 columns
 * - Desktop: 4-6 columns
 */
export function WordGrid({ entries }: WordGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      }}
      data-testid="word-grid"
    >
      {entries.map((entry) => (
        <WordCard key={entry.id} entry={entry} />
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
