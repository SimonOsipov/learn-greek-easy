/**
 * useSubmitReview — POST /api/v1/reviews/v2
 * (MOB-09, backend: src/api/v1/reviews_v2.py)
 *
 * Mutation hook for submitting a single card rating after the user presses
 * Again / Hard / Good / Easy on the card-review screen.
 */
import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { V2ReviewRequest, V2ReviewResult } from '@/types/review';

export function useSubmitReview() {
  return useMutation<V2ReviewResult, Error, V2ReviewRequest>({
    mutationFn: (req: V2ReviewRequest) =>
      api.post<V2ReviewResult>('/api/v1/reviews/v2', req),
  });
}
