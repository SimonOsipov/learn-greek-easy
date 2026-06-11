import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { CultureReadinessResponse } from '@/types/culture';

/**
 * Fetches the learner's culture-exam readiness from GET /api/v1/culture/readiness.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useCultureReadiness() {
  const session = useAuthStore((state) => state.session);

  return useQuery<CultureReadinessResponse>({
    queryKey: ['culture', 'readiness'],
    enabled: !!session,
    queryFn: () => api.get<CultureReadinessResponse>('/api/v1/culture/readiness'),
  });
}
