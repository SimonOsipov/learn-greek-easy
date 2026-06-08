import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { SituationListResponse } from '@/types/situation';

/**
 * Fetches the list of learner situations from GET /api/v1/situations.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useSituations() {
  const session = useAuthStore((state) => state.session);

  return useQuery<SituationListResponse>({
    queryKey: ['situations'],
    enabled: !!session,
    queryFn: () => api.get<SituationListResponse>('/api/v1/situations'),
  });
}
