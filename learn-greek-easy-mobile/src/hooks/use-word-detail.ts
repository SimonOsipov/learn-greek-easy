/**
 * Word-detail data hooks (MOB-12):
 *   useWordEntry(wordId)      → GET /api/v1/word-entries/{id}
 *   useWordCards(wordId)      → GET /api/v1/word-entries/{id}/cards
 *   useWordCardMastery(deckId, wordId)
 *                             → word mastery item from deck word-mastery list,
 *                               used to derive per-card status on the Cards panel.
 *
 * All three use the same `enabled: !!session` guard as use-deck-detail.ts
 * to avoid firing 401s on signed-out cold starts.
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { WordDetailResponse, CardRecordResponse } from '@/types/word';
import type { WordMasteryItem, WordMasteryResponse } from '@/types/deck';

export function useWordEntry(wordId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['word-entry', wordId],
    enabled: !!session && !!wordId,
    queryFn: () => api.get<WordDetailResponse>(`/api/v1/word-entries/${wordId}`),
  });
}

export function useWordCards(wordId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['word-cards', wordId],
    enabled: !!session && !!wordId,
    queryFn: () => api.get<CardRecordResponse[]>(`/api/v1/word-entries/${wordId}/cards`),
  });
}

/**
 * Returns the WordMasteryItem for a specific word from the deck's word-mastery
 * endpoint. Reuses the same TanStack Query cache key as useDeckWordMastery so
 * both the deck-detail and word-detail screens share one network request.
 */
export function useWordMasteryItem(
  deckId: string | undefined,
  wordId: string | undefined,
): WordMasteryItem | undefined {
  const session = useAuthStore((state) => state.session);

  const query = useQuery({
    queryKey: ['deck-word-mastery', deckId],
    enabled: !!session && !!deckId,
    queryFn: () => api.get<WordMasteryResponse>(`/api/v1/decks/${deckId}/word-mastery`),
  });

  return query.data?.items.find((m) => m.word_entry_id === wordId);
}
