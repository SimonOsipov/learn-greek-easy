// src/components/admin/decks/DeckStats.tsx
//
// Pure presentational 4-up StatCard grid for the Decks tab page chrome.
// No data fetching — caller computes all numbers and passes them as props.

import { BookOpen, Compass, Layers, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StatCard } from '@/components/ui/stat-card';

export interface DeckStatsProps {
  totalDecks: number;
  totalCards: number;
  vocabularyCount: number;
  totalVocabularyCards: number;
  cultureCount: number;
  totalCultureQuestions: number;
  /** Pre-rounded integer from the caller; rendered as-is. */
  avgCardsPerDeck: number;
  onCardClick?: (filter: 'all' | 'vocabulary' | 'culture') => void;
}

export function DeckStats({
  totalDecks,
  totalCards,
  vocabularyCount,
  totalVocabularyCards,
  cultureCount,
  totalCultureQuestions,
  avgCardsPerDeck,
  onCardClick,
}: DeckStatsProps) {
  const { t } = useTranslation('admin');
  return (
    <div className="stat-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('decks.stats.totalDecks')}
        sub={t('decks.stats.totalCardsSub', { totalCards })}
        n={totalDecks}
        icon={<Layers className="h-4 w-4" />}
        tone="blue"
        bars={[4, 6, 8, 5, 7, 9, 6, 8, 10]}
        barsTestId="sparkline-total-decks"
        onClick={() => onCardClick?.('all')}
      />
      <StatCard
        title={t('decks.stats.vocabulary')}
        sub={t('decks.stats.vocabularySub', { totalVocabularyCards })}
        n={vocabularyCount}
        icon={<BookOpen className="h-4 w-4" />}
        tone="violet"
        bars={[3, 5, 7, 4, 6, 8, 5, 7, 9]}
        barsTestId="sparkline-vocabulary"
        onClick={() => onCardClick?.('vocabulary')}
      />
      <StatCard
        title={t('decks.stats.culture')}
        sub={t('decks.stats.cultureSub', { totalCultureQuestions, cultureCount })}
        n={cultureCount}
        icon={<Compass className="h-4 w-4" />}
        tone="cyan"
        bars={[2, 4, 3, 5, 4, 6, 5, 7, 6]}
        barsTestId="sparkline-culture"
        onClick={() => onCardClick?.('culture')}
      />
      <StatCard
        title={t('decks.stats.avgCardsPerDeck')}
        sub={t('decks.stats.avgCardsPerDeckSub')}
        n={avgCardsPerDeck}
        icon={<TrendingUp className="h-4 w-4" />}
        tone="green"
        bars={[5, 6, 5, 7, 6, 8, 7, 8, 9]}
        barsTestId="sparkline-avg-cards"
        onClick={() => onCardClick?.('all')}
      />
    </div>
  );
}
