// src/features/decks/hooks/useWordEntries.ts

/**
 * React Query hook for fetching word entries by deck ID with infinite pagination.
 *
 * Uses the GET /api/v1/decks/{deck_id}/word-entries endpoint with page/page_size params.
 * Supports "Load More" pattern via useInfiniteQuery.
 */

import { useInfiniteQuery } from '@tanstack/react-query';

import {
  wordEntryAPI,
  type WordEntryResponse,
  type WordEntryListResponse,
} from '@/services/wordEntryAPI';

// ============================================
// Constants
// ============================================

const PAGE_SIZE = 40;

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
  /** Flattened word entries across all loaded pages */
  wordEntries: WordEntryResponse[];
  /** Total count from the server */
  total: number;
  /** Loading state (true only on initial fetch) */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
  /** Whether there are more pages to load */
  hasNextPage: boolean;
  /** Fetch the next page */
  fetchNextPage: () => void;
  /** Whether a next-page fetch is in progress */
  isFetchingNextPage: boolean;
}

// ============================================
// Hook
// ============================================

/**
 * React Query hook for fetching word entries by deck ID with infinite pagination.
 *
 * Uses useInfiniteQuery to support "Load More" pagination.
 * Pages are flattened into a single wordEntries array.
 *
 * @example
 * ```tsx
 * const { wordEntries, total, hasNextPage, fetchNextPage } = useWordEntries({ deckId: '123' });
 * ```
 */
export function useWordEntries({
  deckId,
  enabled = true,
}: UseWordEntriesOptions): UseWordEntriesResult {
  const query = useInfiniteQuery<WordEntryListResponse, Error>({
    queryKey: ['wordEntries', deckId],
    queryFn: ({ pageParam }) => wordEntryAPI.getByDeck(deckId, pageParam as number, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.page_size < lastPage.total ? lastPage.page + 1 : undefined,
    enabled: enabled && !!deckId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const wordEntries = query.data?.pages.flatMap((p) => p.word_entries) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    wordEntries,
    total,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
