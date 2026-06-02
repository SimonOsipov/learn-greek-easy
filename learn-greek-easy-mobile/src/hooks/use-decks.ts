import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { DeckListResponse } from '@/types/deck';

/**
 * Authenticated proof query for MOB-05: fetches the decks list from the
 * deployed backend (GET /api/v1/decks, requires a Supabase bearer token).
 * Proves the full mobile client -> Supabase auth -> backend wiring.
 */
export function useDecks() {
  return useQuery({
    queryKey: ['decks'],
    queryFn: () => api.get<DeckListResponse>('/api/v1/decks'),
  });
}
