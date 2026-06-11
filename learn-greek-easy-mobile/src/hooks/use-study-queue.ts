/**
 * useStudyQueue — GET /api/v1/study/queue/v2?deck_id={deckId}&limit=20&include_new=true
 * (MOB-09, backend: src/api/v1/study_v2.py)
 *
 * Returns the SRS due-card queue for a deck. Empty `cards` array means "all caught up".
 * Session-guarded: disabled when signed out or deckId is absent.
 */
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { V2StudyQueue } from '@/types/review';

export function useStudyQueue(deckId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery({
    queryKey: ['study-queue', deckId],
    enabled: !!session && !!deckId,
    queryFn: () =>
      api.get<V2StudyQueue>(
        `/api/v1/study/queue/v2?deck_id=${deckId}&limit=20&include_new=true`,
      ),
  });
}
