import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type {
  DeckDetailResponse,
  DeckWordEntriesResponse,
  WordEntryResponse,
  WordMasteryResponse,
} from '@/types/deck';

/**
 * Deck-detail data hooks (MOB-07):
 *   useDeck(deckId)            → GET /api/v1/decks/{id}
 *   useDeckWords(deckId)       → GET /api/v1/decks/{id}/word-entries (all pages)
 *   useDeckWordMastery(deckId) → GET /api/v1/decks/{id}/word-mastery
 *
 * All three use the same `enabled: !!session` guard as use-deck-progress.ts
 * to avoid firing 401s on signed-out cold starts.
 */

const WORDS_PAGE_SIZE = 100; // endpoint max (src/api/v1/decks.py word-entries page_size le=100)
const WORDS_MAX_PAGES = 5; // safety cap — 500 words; no current deck approaches this

export function useDeck(deckId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['deck', deckId],
    enabled: !!session && !!deckId,
    queryFn: () => api.get<DeckDetailResponse>(`/api/v1/decks/${deckId}`),
  });
}

/**
 * Fetches ALL word entries for a deck, looping pages until `total` is reached
 * (capped at WORDS_MAX_PAGES). The detail screen renders the full word list,
 * so a single default page would silently truncate decks over 100 words.
 */
async function fetchAllDeckWords(deckId: string): Promise<WordEntryResponse[]> {
  const first = await api.get<DeckWordEntriesResponse>(
    `/api/v1/decks/${deckId}/word-entries?page=1&page_size=${WORDS_PAGE_SIZE}`,
  );
  const entries = [...first.word_entries];
  const totalPages = Math.min(Math.ceil(first.total / WORDS_PAGE_SIZE), WORDS_MAX_PAGES);
  for (let page = 2; page <= totalPages; page++) {
    const next = await api.get<DeckWordEntriesResponse>(
      `/api/v1/decks/${deckId}/word-entries?page=${page}&page_size=${WORDS_PAGE_SIZE}`,
    );
    entries.push(...next.word_entries);
  }
  return entries;
}

export function useDeckWords(deckId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['deck-words', deckId],
    enabled: !!session && !!deckId,
    queryFn: () => fetchAllDeckWords(deckId as string),
  });
}

export function useDeckWordMastery(deckId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['deck-word-mastery', deckId],
    enabled: !!session && !!deckId,
    queryFn: () => api.get<WordMasteryResponse>(`/api/v1/decks/${deckId}/word-mastery`),
  });
}
