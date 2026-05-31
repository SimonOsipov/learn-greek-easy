// src/features/decks/dx/wordProgress.ts
//
// Pure helper: derives word-level progress percentages from WordMasteryItem[].
// Two-tier weighting: mastered = 1.0, in-progress = 0.5, new = 0.0.
// No React dependencies — safe to unit test without jsdom.

import type { WordMasteryItem } from '@/services/progressAPI';

export const MASTERED_WEIGHT = 1.0;
export const IN_PROGRESS_WEIGHT = 0.5;

/**
 * Derives word-level progress from an array of WordMasteryItem entries.
 *
 * Classification rules:
 * - mastered    : total_count > 0 AND mastered_count === total_count
 * - in-progress : studied_count > 0 AND mastered_count < total_count
 * - new         : studied_count === 0
 *
 * progressPct = round((1.0 * mastered + 0.5 * inProgress) / total * 100)
 */
export function deriveWordProgress(items: WordMasteryItem[]) {
  const totalWords = items.length;
  const masteredWords = items.filter(
    (m) => m.total_count > 0 && m.mastered_count === m.total_count
  ).length;
  const inProgressWords = items.filter(
    (m) => m.studied_count > 0 && m.mastered_count < m.total_count
  ).length;
  const newWords = items.filter((m) => m.studied_count === 0).length;
  const progressPct =
    totalWords > 0
      ? Math.round(
          ((MASTERED_WEIGHT * masteredWords + IN_PROGRESS_WEIGHT * inProgressWords) / totalWords) *
            100
        )
      : 0;
  return { totalWords, masteredWords, inProgressWords, newWords, progressPct };
}
