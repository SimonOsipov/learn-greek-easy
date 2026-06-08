import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { TrendsResponse } from '@/types/dashboard';

/**
 * Fetches the current user's weekly learning trends from
 * GET /api/v1/progress/trends?period=week.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useWeekTrends() {
  const session = useAuthStore((state) => state.session);

  return useQuery<TrendsResponse>({
    queryKey: ['week-trends'],
    enabled: !!session,
    queryFn: () => api.get<TrendsResponse>('/api/v1/progress/trends?period=week'),
  });
}
