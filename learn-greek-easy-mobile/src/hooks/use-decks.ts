import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { DeckListResponse } from '@/types/deck';

/**
 * Fetches the decks list from GET /api/v1/decks (requires a Supabase bearer
 * token). Shared by the dashboard deck shelf and the Decks library tab.
 * page_size=100 (endpoint max) — the library renders the full catalogue, and
 * the backend default of 20 would silently truncate it.
 */
export function useDecks() {
  return useQuery({
    queryKey: ['decks'],
    queryFn: () => api.get<DeckListResponse>('/api/v1/decks?page_size=100'),
  });
}
