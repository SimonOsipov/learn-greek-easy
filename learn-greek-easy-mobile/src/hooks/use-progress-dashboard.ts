import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { ProgressDashboardResponse } from '@/types/dashboard';

/**
 * Fetches the current user's progress dashboard from GET /api/v1/progress/dashboard.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useProgressDashboard() {
  const session = useAuthStore((state) => state.session);

  return useQuery<ProgressDashboardResponse>({
    queryKey: ['progress-dashboard'],
    enabled: !!session,
    queryFn: () => api.get<ProgressDashboardResponse>('/api/v1/progress/dashboard'),
  });
}
