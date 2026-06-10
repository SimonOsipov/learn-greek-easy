import { useMutation, useQuery } from '@tanstack/react-query';

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
 * POST /api/v1/exercises/{exerciseId}/review.
 */
export function useReviewExercise() {
  return useMutation<ExerciseReviewResult, Error, ExerciseReviewRequest>({
    mutationFn: (req: ExerciseReviewRequest) =>
      api.post<ExerciseReviewResult>(
        `/api/v1/exercises/${req.exercise_id}/review`,
        { exercise_id: req.exercise_id, score: req.score, max_score: req.max_score },
      ),
  });
}
