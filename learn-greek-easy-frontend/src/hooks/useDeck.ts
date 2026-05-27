// src/hooks/useDeck.ts
//
// Fetches a single deck by ID using the dedicated admin single-deck endpoint.

import { useQuery } from '@tanstack/react-query';

import { adminAPI, type UnifiedDeckItem } from '@/services/adminAPI';

async function fetchDeckById(deckId: string): Promise<UnifiedDeckItem> {
  return adminAPI.getDeck(deckId);
}

export interface UseDeckResult {
  deck: UnifiedDeckItem | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Fetches a single deck from the admin dedicated endpoint by ID.
 *
 * Returns:
 * - `deck: undefined`       while loading or on error
 * - `deck: UnifiedDeckItem` when successfully fetched
 * - `isError: true`         when the request fails (e.g. 404 not found)
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
