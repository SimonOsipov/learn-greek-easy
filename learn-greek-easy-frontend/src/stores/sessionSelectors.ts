// src/stores/sessionSelectors.ts
// Pure selector helpers for PRACT2-12-05 live-stats + stepper status.
// These selectors operate over a slice of ExercisePracticeState and are
// tested independently in src/stores/__tests__/sessionSelectors.test.ts.

import type { ExerciseQueueItem } from '@/services/exerciseAPI';

// ---------------------------------------------------------------------------
// Shape of the store slice that selectors consume.
// Mirrors ExercisePracticeState from exercisePracticeStore.ts plus the `phase`
// field added in PRACT2-12-04.
// ---------------------------------------------------------------------------
export interface SessionSelectorState {
  queue: ExerciseQueueItem[];
  currentIndex: number;
  answers: Record<string, { selectedIndex: number; correct: boolean }>;
  phase?: 'question' | 'result';
}

// ---------------------------------------------------------------------------
// Live-stats selector
//
// CONTRACT:
//   - correct  = count of answers where .correct === true
//   - missed   = count of answers where .correct === false
//   - accuracyPct = round(correct / (correct + missed) * 100), 0 when no answers
//
// Binary split only — no partial state exists.
// ---------------------------------------------------------------------------
export function selectLiveStats(state: SessionSelectorState): {
  correct: number;
  missed: number;
  accuracyPct: number;
} {
  const values = Object.values(state.answers);
  const correct = values.filter((a) => a.correct).length;
  const missed = values.length - correct;
  const accuracyPct = values.length > 0 ? Math.round((correct / values.length) * 100) : 0;
  return { correct, missed, accuracyPct };
}

// ---------------------------------------------------------------------------
// Stepper status selector
//
// CONTRACT:
//   - Returns one status per queue item, in queue order.
//   - Status vocabulary:
//       'correct'   — item answered and .correct === true
//       'incorrect' — item answered and .correct === false
//       'current'   — item is at currentIndex and not yet answered
//       'pending'   — item is after currentIndex and not yet answered
//   - Answered items take priority over 'current' (an answered item at
//     currentIndex after the session ends shows correct/incorrect).
//
// ---------------------------------------------------------------------------
export function selectStepperStatus(
  state: SessionSelectorState
): ('correct' | 'incorrect' | 'current' | 'pending')[] {
  return state.queue.map((item, i) => {
    const answer = state.answers[item.exercise_id];
    if (answer !== undefined) {
      // Answered items take priority — correct or incorrect
      return answer.correct ? 'correct' : 'incorrect';
    }
    if (i === state.currentIndex) {
      return 'current';
    }
    return 'pending';
  });
}
