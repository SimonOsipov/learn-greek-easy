import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { DeckProgressListResponse } from '@/types/dashboard';

/**
 * Fetches the current user's per-deck progress from GET /api/v1/progress/decks.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useDeckProgress() {
  const session = useAuthStore((state) => state.session);

  return useQuery<DeckProgressListResponse>({
    queryKey: ['deck-progress'],
    enabled: !!session,
    queryFn: () => api.get<DeckProgressListResponse>('/api/v1/progress/decks'),
  });
}
