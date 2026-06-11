import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { CultureDeckListResponse } from '@/types/culture';

/**
 * Fetches the culture-exam deck list from GET /api/v1/culture/decks.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useCultureDecks() {
  const session = useAuthStore((state) => state.session);

  return useQuery<CultureDeckListResponse>({
    queryKey: ['culture', 'decks'],
    enabled: !!session,
    queryFn: () => api.get<CultureDeckListResponse>('/api/v1/culture/decks?page_size=100'),
  });
}
