import { useQuery } from '@tanstack/react-query';

import { progressAPI } from '@/services/progressAPI';

const EMPTY_HEAT = [0, 0, 0, 0, 0, 0, 0];

export interface UseWordHeatmapOptions {
  deckId: string;
  wordEntryId: string;
  enabled?: boolean;
}

export interface UseWordHeatmapResult {
  /** 7 intensity levels (0–5), oldest first; index `todayIdx` is today. */
  heat: number[];
  todayIdx: number;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
}

/**
 * Fetch the rolling 7-day practice heatmap for a single word in a deck.
 * Mirrors the useWordMastery query pattern (5-min staleTime, deck+word scoped).
 */
export function useWordHeatmap({
  deckId,
  wordEntryId,
  enabled = true,
}: UseWordHeatmapOptions): UseWordHeatmapResult {
  const query = useQuery({
    queryKey: ['wordHeatmap', deckId, wordEntryId],
    queryFn: () => progressAPI.getWordHeatmap(deckId, wordEntryId),
    enabled: enabled && !!deckId && !!wordEntryId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    heat: query.data?.heat ?? EMPTY_HEAT,
    todayIdx: query.data?.today_idx ?? 6,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
  };
}
