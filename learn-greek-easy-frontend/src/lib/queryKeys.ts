import { queryClient } from '@/lib/queryClient';
import { progressAPI } from '@/services/progressAPI';
import type { DeckProgressListResponse } from '@/services/progressAPI';

/**
 * Shared, user-scoped TanStack Query keys.
 *
 * Keys are scoped by `userId` because caching these endpoints for the first
 * time introduces a same-browser cross-account read hazard (a stale cache
 * entry from a previous session bleeding into a new one) — scoping fixes it
 * without touching authStore/RouteGuard. This registry covers ONLY the
 * endpoints below; it is not a repo-wide key migration.
 */
export const queryKeys = {
  // GET /api/v1/progress/decks — paginated deck-progress list (page 1, size 50)
  progressDecks: (userId: string | undefined) => ['progress-decks', userId] as const,
  // GET /api/v1/exercises/queue?summary=true — hub queue-summary
  exerciseQueue: (userId: string | undefined) => ['exercise-queue', userId] as const,
} as const;

/**
 * Cache-backed fetch of the deck-progress list, keyed per-user, backed by the
 * app-wide singleton `queryClient`. `retry: false` preserves single-attempt
 * semantics — the singleton's global default is `retry: 1`
 * (`src/lib/queryClient.ts:18`), and without this override a rejected fetch
 * would silently retry once, changing call-count-on-failure behavior for
 * existing callers.
 */
export function fetchDeckProgressList(
  userId: string | undefined
): Promise<DeckProgressListResponse> {
  return queryClient.fetchQuery({
    queryKey: queryKeys.progressDecks(userId),
    queryFn: () => progressAPI.getDeckProgressList({ page: 1, page_size: 50 }),
    staleTime: 30_000,
    retry: false,
  });
}
