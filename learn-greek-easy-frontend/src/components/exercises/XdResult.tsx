// src/components/exercises/XdResult.tsx
// TODO(PRACT2-12-05): implement — this is a minimal stub so the RED tests
// fail on assertion failures (missing DOM content), not import/collection errors.

import type { ExerciseQueueItem } from '@/services/exerciseAPI';
import type { CultureLanguage } from '@/types/culture';

export interface XdResultProps {
  /** The exercise item being shown in result phase */
  item: ExerciseQueueItem;
  /** Whether the user's answer was correct */
  verdict: 'correct' | 'incorrect';
  /** The index the user selected */
  selectedIndex: number;
  /** The display language for option text */
  language: CultureLanguage;
  /** Called when the user clicks Continue */
  onContinue: () => void;
}

/**
 * XdResult — the result-phase view.
 *
 * DOM CONTRACT (executor must match — tests assert these testids/roles):
 *
 *   data-testid="xd-result"          — root wrapper
 *   data-testid="xd-result-verdict"  — verdict mark (contains a success/danger indicator)
 *   data-testid="xd-result-answer"   — "The answer" callout containing the correct option text
 *   data-testid="xd-result-why"      — "Why" slot wrapper (contains the UnwiredDot)
 *   data-testid="unwired-dot"        — UnwiredDot inside the Why slot (rendered by UnwiredDot.tsx)
 *   role="button" or <button>        — Continue button (text or aria-label contains "Continue")
 *
 * "The answer" text resolves per exercise_type:
 *   select_correct_answer           → options[correct_answer_index][language]
 *   select_description_from_picture → options[correct_index].description_text
 *   select_picture_from_description → shows the correct picture (options[correct_index].image_url)
 *
 * "Why" slot is always an UnwiredDot (explanation is unbacked for all 3 rendered types).
 */
export function XdResult(_props: XdResultProps) {
  // TODO(PRACT2-12-05): implement
  return <div data-testid="xd-result" />;
}
