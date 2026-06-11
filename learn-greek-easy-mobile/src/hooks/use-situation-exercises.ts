import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type {
  ExerciseQueue,
  ExerciseReviewRequest,
  ExerciseReviewResult,
} from '@/types/situation';

/**
 * Fetches the exercise queue for a situation from
 * GET /api/v1/situations/{situationId}/exercises.
 * Session-guarded: disabled when signed out.
 */
export function useSituationExercises(situationId: string | undefined) {
  const session = useAuthStore((state) => state.session);

  return useQuery<ExerciseQueue>({
    queryKey: ['situation-exercises', situationId],
    enabled: !!session && !!situationId,
    queryFn: () =>
      api.get<ExerciseQueue>(`/api/v1/situations/${situationId}/exercises`),
  });
}

/**
 * Mutation to submit an exercise review result via
 * POST /api/v1/exercises/review (exercises.py:87 — no /{id} in path).
 * #3/#14: fixed path (was incorrectly /exercises/{id}/review — 404s).
 * #11: invalidates situations + detail + exercises caches on success.
 */
export function useReviewExercise(situationId?: string) {
  const queryClient = useQueryClient();

  return useMutation<ExerciseReviewResult, Error, ExerciseReviewRequest>({
    mutationFn: (req: ExerciseReviewRequest) =>
      api.post<ExerciseReviewResult>(
        '/api/v1/exercises/review',
        { exercise_id: req.exercise_id, score: req.score, max_score: req.max_score },
      ),
    onSuccess: () => {
      // #11: invalidate all three caches so Practice list and resume logic
      // reflect updated exercise_completed after each exercise submission.
      void queryClient.invalidateQueries({ queryKey: ['situations'] });
      if (situationId) {
        void queryClient.invalidateQueries({ queryKey: ['situation', situationId] });
        void queryClient.invalidateQueries({ queryKey: ['situation-exercises', situationId] });
      }
    },
  });
}
