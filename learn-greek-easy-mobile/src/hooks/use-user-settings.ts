import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api, APIRequestError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { UserProfile, UserSettings, UserSettingsUpdate } from '@/types/user';

/**
 * Flattens a FastAPI 422 / APIRequestError detail into a single human-readable
 * string. Exported so consumers can use it independently (e.g. in tests).
 *
 * - Prefers `err.message` when it is a non-empty string.
 * - Falls back to joining `detail[].msg` when detail is an array (422 body).
 * - Final fallback: generic user-safe message.
 */
export function flattenAPIError(err: unknown): string {
  if (err instanceof APIRequestError) {
    if (err.message) return err.message;
    if (Array.isArray(err.detail)) {
      const joined = (err.detail as Record<string, unknown>[])
        .map((d) => String(d['msg'] ?? ''))
        .filter(Boolean)
        .join(', ');
      if (joined) return joined;
    }
  }
  return 'Could not save your choices — please try again.';
}

/**
 * Fetches the current user's settings from GET /api/v1/auth/me.
 * The `enabled` guard prevents firing on signed-out cold starts (avoids 401s).
 */
export function useUserSettings(): ReturnType<typeof useQuery<UserProfile, Error, UserSettings>> {
  const session = useAuthStore((state) => state.session);

  return useQuery<UserProfile, Error, UserSettings>({
    queryKey: ['me'],
    enabled: !!session,
    queryFn: () => api.get<UserProfile>('/api/v1/auth/me'),
    select: (profile) => profile.settings,
  });
}

/**
 * Mutation hook for PATCH /api/v1/auth/me (partial settings update).
 * On success the ['me'] cache is invalidated so any consumer reading
 * useUserSettings() sees fresh data immediately.
 *
 * Returns the TanStack mutation object plus a derived `errorMessage` string
 * so callers never have to handle a raw Error object or an array detail.
 */
export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  const mutation = useMutation<UserProfile, Error, UserSettingsUpdate>({
    mutationFn: (body: UserSettingsUpdate) =>
      api.patch<UserProfile>('/api/v1/auth/me', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const errorMessage: string | null = mutation.error
    ? flattenAPIError(mutation.error)
    : null;

  return { ...mutation, errorMessage };
}
