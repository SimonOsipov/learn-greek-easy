// src/hooks/useDeckPerformance.ts

import {
  useAnalyticsStore,
  selectDeckPerformance,
  selectIsLoading,
  selectError,
} from '@/stores/analyticsStore';

/**
 * Hook for deck performance statistics
 * Returns performance stats for all decks
 *
 * @returns Deck performance stats array, loading state, and error
 *
 * @example
 * ```tsx
 * const { deckStats, loading, error } = useDeckPerformance();
 *
 * return (
 *   <BarChart data={deckStats} />
 * );
 * ```
 */
export const useDeckPerformance = () => {
  const deckStats = useAnalyticsStore(selectDeckPerformance);
  const loading = useAnalyticsStore(selectIsLoading);
  const error = useAnalyticsStore(selectError);

  return {
    deckStats,
    loading,
    error,
  };
};
