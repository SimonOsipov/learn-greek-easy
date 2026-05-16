// src/hooks/useDeck.ts
//
// Fetches a single deck by ID using the unified admin list endpoint.
// No single-deck endpoint exists in adminAPI, so we resolve via listDecks
// with page_size=1 and pick the first result whose id matches.

import { useQuery } from '@tanstack/react-query';

import { adminAPI, type UnifiedDeckItem } from '@/services/adminAPI';

async function fetchDeckById(deckId: string): Promise<UnifiedDeckItem | null> {
  // listDecks supports full-text search but not exact-ID filter.
  // Fetch a small page; the deck list is typically <500 rows so
  // a fallback full-list fetch is acceptable for admin use.
  const response = await adminAPI.listDecks({ page_size: 200 });
  return response.decks.find((d) => d.id === deckId) ?? null;
}

export interface UseDeckResult {
  deck: UnifiedDeckItem | null | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Resolves a single deck from the admin unified list by ID.
 *
 * Returns:
 * - `deck: undefined`      while loading
 * - `deck: UnifiedDeckItem` when found
 * - `deck: null`            when the query succeeded but no deck matched (not-found)
 * - `isError: true`        when the network request failed
 *
 * Enabled only when `deckId` is a non-empty string.
 */
export function useDeck(deckId: string | null): UseDeckResult {
  const query = useQuery({
    queryKey: ['admin', 'deck', deckId],
    queryFn: () => fetchDeckById(deckId!),
    enabled: typeof deckId === 'string' && deckId.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    deck: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
