// src/features/words/hooks/useWordEntry.ts

/**
 * React Query hook for fetching a single word entry by ID.
 *
 * Uses the GET /api/v1/word-entries/{word_entry_id} endpoint.
 * Caches results with staleTime of 5 minutes.
 */

import { useRef } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSSE } from '@/hooks/useSSE';
import { wordEntryAPI, type WordEntryResponse } from '@/services/wordEntryAPI';
import type { SSEConnectionState } from '@/types/sse';

import type { QueryClient } from '@tanstack/react-query';

interface AudioStatusEvent {
  word_entry_id: string;
  part: 'lemma' | 'example';
  example_id: string | null;
  status: 'generating' | 'ready' | 'failed';
  audio_url: string | null;
}

function updateCacheFromSSEEvent(
  queryClient: QueryClient,
  wordId: string,
  event: AudioStatusEvent
): void {
  queryClient.setQueryData<WordEntryResponse>(['wordEntry', wordId], (old) => {
    if (!old) return old;
    if (event.part === 'lemma') {
      return { ...old, audio_status: event.status, audio_url: event.audio_url ?? old.audio_url };
    }
    if (event.part === 'example' && event.example_id && old.examples) {
      return {
        ...old,
        examples: old.examples.map((ex) =>
          ex.id === event.example_id
            ? { ...ex, audio_status: event.status, audio_url: event.audio_url ?? ex.audio_url }
            : ex
        ),
      };
    }
    return old;
  });
}

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
  /** Whether the current user is an admin (enables SSE audio status tracking) */
  isAdmin?: boolean;
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
 * When `isAdmin` is true and audio is generating, uses SSE to receive
 * real-time audio status updates instead of polling.
 *
 * @example
 * ```tsx
 * const { wordEntry, isLoading, error } = useWordEntry({ wordId: '123' });
 * ```
 */
export function useWordEntry({
  wordId,
  enabled = true,
  isAdmin,
}: UseWordEntryOptions): UseWordEntryResult {
  // Ref holds current SSE state so refetchInterval can read it without
  // creating a circular dependency (useQuery → shouldUseSSE → useSSE → sseState).
  const sseStateRef = useRef<SSEConnectionState>('disconnected');

  const query = useQuery({
    queryKey: ['wordEntry', wordId],
    queryFn: () => wordEntryAPI.getById(wordId),
    enabled: enabled && !!wordId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    refetchInterval: (query) => {
      if (!hasGeneratingAudio(query.state.data)) return false;
      const shouldUseSSE = (isAdmin ?? false) && hasGeneratingAudio(query.state.data);
      if (shouldUseSSE && sseStateRef.current !== 'error') return false;
      return 3000;
    },
  });

  const queryClient = useQueryClient();
  const isGenerating = hasGeneratingAudio(query.data);
  const shouldUseSSE = (isAdmin ?? false) && isGenerating;

  useSSE<AudioStatusEvent>(`/api/v1/admin/word-entries/${wordId}/audio/stream`, {
    enabled: shouldUseSSE,
    onEvent: (event) => {
      if (event.type === 'audio_status_changed') {
        updateCacheFromSSEEvent(queryClient, wordId, event.data as AudioStatusEvent);
      }
    },
    onStateChange: (state) => {
      sseStateRef.current = state;
    },
    maxRetries: 10,
  });

  return {
    wordEntry: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    isError: query.isError,
    refetch: query.refetch,
  };
}
