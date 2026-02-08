// src/features/words/hooks/useWordEntryCards.ts

/**
 * React Query hook for fetching card records by word entry ID.
 *
 * Uses the GET /api/v1/word-entries/{word_entry_id}/cards endpoint.
 * Caches results with staleTime of 5 minutes.
 */

import { useQuery } from '@tanstack/react-query';

import { wordEntryAPI, type CardRecordResponse } from '@/services/wordEntryAPI';

// ============================================
// Types
// ============================================

export interface UseWordEntryCardsOptions {
  /** Word entry ID to fetch cards for */
  wordEntryId: string;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

export interface UseWordEntryCardsResult {
  /** Card records for the word entry */
  cards: CardRecordResponse[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Is the query in error state */
  isError: boolean;
  /** Refetch function */
  refetch: () => void;
}

// ============================================
// Hook
// ============================================

/**
 * React Query hook for fetching card records by word entry ID.
 *
 * Uses the GET /api/v1/word-entries/{word_entry_id}/cards endpoint.
 * Caches results with staleTime of 5 minutes.
 *
 * @example
 * ```tsx
 * const { cards, isLoading, error } = useWordEntryCards({ wordEntryId: '123' });
 * ```
 */
export function useWordEntryCards({
  wordEntryId,
  enabled = true,
}: UseWordEntryCardsOptions): UseWordEntryCardsResult {
  const query = useQuery({
    queryKey: ['wordEntryCards', wordEntryId],
    queryFn: () => wordEntryAPI.getCardsByWordEntry(wordEntryId),
    enabled: enabled && !!wordEntryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });

  return {
    cards: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
  };
}
