// src/features/decks/hooks/useWordEntries.ts

/**
 * React Query hook for fetching word entries by deck ID.
 *
 * Uses the GET /api/v1/decks/{deck_id}/word-entries endpoint.
 * Caches results with staleTime of 5 minutes.
 */

import { useQuery } from '@tanstack/react-query';

import { wordEntryAPI, type WordEntryResponse } from '@/services/wordEntryAPI';

// ============================================
// Types
// ============================================

export interface UseWordEntriesOptions {
  /** Deck ID to fetch word entries for */
  deckId: string;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

export interface UseWordEntriesResult {
  /** Word entries for the deck */
  wordEntries: WordEntryResponse[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
}

// ============================================
// Hook
// ============================================

/**
 * React Query hook for fetching word entries by deck ID.
 *
 * Uses the GET /api/v1/decks/{deck_id}/word-entries endpoint.
 * Caches results with staleTime of 5 minutes.
 *
 * @example
 * ```tsx
 * const { wordEntries, isLoading, error } = useWordEntries({ deckId: '123' });
 * ```
 */
export function useWordEntries({
  deckId,
  enabled = true,
}: UseWordEntriesOptions): UseWordEntriesResult {
  const query = useQuery({
    queryKey: ['wordEntries', deckId],
    queryFn: () => wordEntryAPI.getByDeck(deckId),
    enabled: enabled && !!deckId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
  });

  return {
    wordEntries: query.data?.word_entries ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
