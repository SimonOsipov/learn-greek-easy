// src/hooks/useDeckPerformance.ts

import { useAnalytics } from '@/hooks/useAnalytics';

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
  const { data, loading, error } = useAnalytics();
  const deckStats = data?.deckStats ?? [];

  return {
    deckStats,
    loading,
    error,
  };
};
