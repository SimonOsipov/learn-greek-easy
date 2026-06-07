import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { NewsListResponse } from '@/types/news';

/**
 * Fetches news items filtered to Cyprus from GET /api/v1/news?country=cyprus.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useNews() {
  const session = useAuthStore((state) => state.session);

  return useQuery<NewsListResponse>({
    queryKey: ['news', 'cyprus'],
    enabled: !!session,
    queryFn: () => api.get<NewsListResponse>('/api/v1/news?country=cyprus'),
  });
}
