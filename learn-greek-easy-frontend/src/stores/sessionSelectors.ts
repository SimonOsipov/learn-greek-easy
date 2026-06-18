// src/stores/sessionSelectors.ts
// TODO(PRACT2-12-05): implement — these are stub placeholders so the RED tests
// fail on assertion failures, not import/collection errors.

import type { ExerciseQueueItem } from '@/services/exerciseAPI';

// ---------------------------------------------------------------------------
// Shape of the store slice that selectors consume.
// Mirrors ExercisePracticeState from exercisePracticeStore.ts plus the new
// `phase` field that will be added in PRACT2-12-04.
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
// CONTRACT (executor must match):
//   - Input:  SessionSelectorState
//   - Output: { correct: number; missed: number; accuracyPct: number }
//   - correct  = count of answers where .correct === true
//   - missed   = count of answers where .correct === false
//   - accuracyPct = round(correct / (correct + missed) * 100), 0 when no answers
//
// ---------------------------------------------------------------------------
export function selectLiveStats(_state: SessionSelectorState): {
  correct: number;
  missed: number;
  accuracyPct: number;
} {
  // TODO(PRACT2-12-05): stub — returns wrong placeholder to make tests RED
  return { correct: 0, missed: 0, accuracyPct: 0 };
}

// ---------------------------------------------------------------------------
// Stepper status selector
//
// CONTRACT (executor must match):
//   - Input:  SessionSelectorState (queue + currentIndex + answers)
//   - Output: Array of status strings, one per queue item, in queue order
//   - Status vocabulary:
//       'correct'  — item has been answered and answers[exercise_id].correct === true
//       'incorrect'— item has been answered and answers[exercise_id].correct === false
//       'current'  — item is at currentIndex and not yet answered
//       'pending'  — item is after currentIndex and not yet answered
//   - An answered item before currentIndex may also sit at currentIndex if the
//     session just finished (edge case; executor decides, but 'correct'/'incorrect'
//     take priority over 'current' for answered items).
//
// ---------------------------------------------------------------------------
export function selectStepperStatus(
  _state: SessionSelectorState
): ('correct' | 'incorrect' | 'current' | 'pending')[] {
  // TODO(PRACT2-12-05): stub — returns wrong placeholder to make tests RED
  return [];
}
