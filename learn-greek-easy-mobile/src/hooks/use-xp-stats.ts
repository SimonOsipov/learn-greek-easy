import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { XPStatsResponse } from '@/types/xp';

/**
 * Fetches the current user's XP statistics and level from GET /api/v1/xp/stats.
 * Returns level name, progress percentage, and XP breakdown.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useXpStats() {
  const session = useAuthStore((state) => state.session);

  return useQuery<XPStatsResponse>({
    queryKey: ['xp-stats'],
    enabled: !!session,
    queryFn: () => api.get<XPStatsResponse>('/api/v1/xp/stats'),
  });
}
