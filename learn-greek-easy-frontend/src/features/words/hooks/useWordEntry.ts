// src/features/words/hooks/useWordEntry.ts

/**
 * React Query hook for fetching a single word entry by ID.
 *
 * Uses the GET /api/v1/word-entries/{word_entry_id} endpoint.
 * Caches results with staleTime of 5 minutes.
 */

import { useQuery } from '@tanstack/react-query';

import { wordEntryAPI, type WordEntryResponse } from '@/services/wordEntryAPI';

function hasGeneratingAudio(data: WordEntryResponse | undefined): boolean {
  if (!data) return false;
  if (data.audio_status === 'generating') return true;
  return data.examples?.some((ex) => ex.audio_status === 'generating') ?? false;
}

// ============================================
// Types
// ============================================

export interface UseWordEntryOptions {
  /** Word entry ID to fetch */
  wordId: string;
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
}

export interface UseWordEntryResult {
  /** Word entry data */
  wordEntry: WordEntryResponse | null;
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
 * React Query hook for fetching a single word entry by ID.
 *
 * Uses the GET /api/v1/word-entries/{word_entry_id} endpoint.
 * Caches results with staleTime of 5 minutes.
 *
 * @example
 * ```tsx
 * const { wordEntry, isLoading, error } = useWordEntry({ wordId: '123' });
 * ```
 */
export function useWordEntry({ wordId, enabled = true }: UseWordEntryOptions): UseWordEntryResult {
  const query = useQuery({
    queryKey: ['wordEntry', wordId],
    queryFn: () => wordEntryAPI.getById(wordId),
    enabled: enabled && !!wordId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    refetchInterval: (query) => {
      return hasGeneratingAudio(query.state.data) ? 3000 : false;
    },
  });

  return {
    wordEntry: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
  };
}
