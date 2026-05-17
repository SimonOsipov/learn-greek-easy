// src/components/admin/decks/DeckStats.tsx
//
// Pure presentational 4-up StatCard grid for the Decks tab page chrome.
// No data fetching — caller computes all numbers and passes them as props.

import { BookOpen, Compass, Layers, TrendingUp } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';

export interface DeckStatsProps {
  totalDecks: number;
  vocabularyCount: number;
  cultureCount: number;
  /** Pre-rounded integer from the caller; rendered as-is. */
  avgCardsPerDeck: number;
}

export function DeckStats({
  totalDecks,
  vocabularyCount,
  cultureCount,
  avgCardsPerDeck,
}: DeckStatsProps) {
  return (
    <div className="stat-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total decks"
        n={totalDecks}
        icon={<Layers className="h-4 w-4" />}
        tone="blue"
      />
      <StatCard
        title="Vocabulary"
        n={vocabularyCount}
        icon={<BookOpen className="h-4 w-4" />}
        tone="violet"
      />
      <StatCard
        title="Culture"
        n={cultureCount}
        icon={<Compass className="h-4 w-4" />}
        tone="cyan"
      />
      <StatCard
        title="Avg cards / deck"
        n={avgCardsPerDeck}
        icon={<TrendingUp className="h-4 w-4" />}
        tone="green"
      />
    </div>
  );
}
