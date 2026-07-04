// src/stores/exerciseQueueSelectors.ts
// Pure selector for PERF-22-03: the canonical exercise-queue total.
// Colocated test: src/stores/__tests__/exerciseQueueSelectors.test.ts.
// Follows the sessionSelectors.ts precedent (pure fn, no side effects).

import type { ExerciseQueue } from '@/services/exerciseAPI';

// ---------------------------------------------------------------------------
// selectExerciseQueueTotal
//
// CONTRACT (Decision 2 / D10 / F4):
//   Returns queue.total_in_queue — the server's canonical queue count.
//   NOT total_due + total_new: that sum drops early-practice items and can
//   over-count when a picture-match item is dropped for an insufficient
//   distractor pool. total_in_queue is the single source of truth for both
//   the displayed total and the Start-daily-mix gate.
// ---------------------------------------------------------------------------
export const selectExerciseQueueTotal = (queue: ExerciseQueue): number => queue.total_in_queue;
