import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { SituationDetail } from '@/types/situation';

/**
 * Fetches a single situation's full detail from GET /api/v1/situations/{id}.
 * Session-guarded: disabled when signed out (avoids 401s on cold start).
 */
export function useSituationDetail(id: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery<SituationDetail>({
    queryKey: ['situation', id],
    enabled: !!session && !!id,
    queryFn: () => api.get<SituationDetail>(`/api/v1/situations/${id}`),
  });
}
