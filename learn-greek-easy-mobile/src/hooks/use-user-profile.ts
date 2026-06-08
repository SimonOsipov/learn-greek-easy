import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { UserProfile } from '@/types/user';

/**
 * Fetches the current user's full profile from GET /api/v1/auth/me.
 * Returns the full UserProfile (including full_name, settings, etc.) without
 * a select transform. Shares the ['me'] cache key with useUserSettings.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useUserProfile() {
  const session = useAuthStore((state) => state.session);

  return useQuery<UserProfile>({
    queryKey: ['me'],
    enabled: !!session,
    queryFn: () => api.get<UserProfile>('/api/v1/auth/me'),
  });
}
