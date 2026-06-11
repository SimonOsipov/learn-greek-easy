import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { SituationListResponse } from '@/types/situation';

/**
 * Fetches the list of learner situations from GET /api/v1/situations.
 * page_size=100 matches the endpoint max and the conventions convention (use-culture-decks.ts).
 * #23: default page_size=20 would silently cap the list once content exceeds 20 situations.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useSituations() {
  const session = useAuthStore((state) => state.session);

  return useQuery<SituationListResponse>({
    queryKey: ['situations'],
    enabled: !!session,
    queryFn: () => api.get<SituationListResponse>('/api/v1/situations?page_size=100'),
  });
}
