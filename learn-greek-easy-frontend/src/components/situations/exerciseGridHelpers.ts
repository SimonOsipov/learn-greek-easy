// src/components/situations/exerciseGridHelpers.ts
//
// SIT-27-07: pure helpers for the situation-detail exercise grid — status →
// mastery-pip mapping, status-filter matching + counts, topic-filter matching,
// and multilingual prompt extraction. Kept pure (no React) so they are unit-
// testable and shared across the action panel / toolbar / grid / q-card.

import type { CardStatus, ExerciseQueueItem, ExerciseTopic } from '@/services/exerciseAPI';
import type { CultureLanguage } from '@/types/culture';

/** Status-filter buckets used by the exercise toolbar. */
export type ExerciseStatusFilter = 'all' | 'mastered' | 'review' | 'new';

/** Topic-filter values used by the action panel topic chips. */
export type ExerciseTopicFilter = 'all' | ExerciseTopic;

/** Pip-row visual tone — drives `.cx-pip[data-tone]`. */
export type PipTone = 'learning' | 'review' | 'mastered';

export interface MasteryPips {
  /** 0–4 filled pips. */
  filled: number;
  tone: PipTone;
}

/**
 * Derive 0–4 mastery pips from the per-exercise SM-2 `status`.
 *
 * The situation-exercises payload (ExerciseQueueItem) carries `status` but NOT
 * `repetitions`, so the pip count is driven purely by status — never invented
 * from interval thresholds the API does not define:
 *   new       → 0 (empty)
 *   learning  → 1
 *   review    → 2
 *   mastered  → 4 (full)
 */
export function statusToPips(status: CardStatus): MasteryPips {
  switch (status) {
    case 'mastered':
      return { filled: 4, tone: 'mastered' };
    case 'review':
      return { filled: 2, tone: 'review' };
    case 'learning':
      return { filled: 1, tone: 'learning' };
    case 'new':
    default:
      return { filled: 0, tone: 'learning' };
  }
}

/** Status-dot colour token class — matches the legend tones. */
export function statusDotClass(status: CardStatus): string {
  switch (status) {
    case 'mastered':
      return 'bg-success';
    case 'review':
    case 'learning':
      return 'bg-primary';
    case 'new':
    default:
      return 'bg-fg3/40';
  }
}

/** Whether an exercise matches a status filter (review = learning OR review). */
export function matchesStatusFilter(status: CardStatus, filter: ExerciseStatusFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'mastered':
      return status === 'mastered';
    case 'review':
      return status === 'learning' || status === 'review';
    case 'new':
      return status === 'new';
    default:
      return true;
  }
}

export interface StatusFilterCounts {
  all: number;
  mastered: number;
  review: number;
  new: number;
}

/** Tally status-filter counts over the full (unfiltered) exercise list. */
export function calcStatusCounts(exercises: ExerciseQueueItem[]): StatusFilterCounts {
  return {
    all: exercises.length,
    mastered: exercises.filter((e) => e.status === 'mastered').length,
    review: exercises.filter((e) => e.status === 'learning' || e.status === 'review').length,
    new: exercises.filter((e) => e.status === 'new').length,
  };
}

/** Whether an exercise matches a topic filter. */
export function matchesTopicFilter(
  topic: ExerciseTopic | null | undefined,
  filter: ExerciseTopicFilter
): boolean {
  if (filter === 'all') return true;
  return topic === filter;
}

/** Extract the prompt text for an exercise in the requested language. */
export function exercisePrompt(exercise: ExerciseQueueItem, language: CultureLanguage): string {
  const payload = exercise.items[0]?.payload as Record<string, unknown> | undefined;
  if (!payload) return '';

  // select_correct_answer: prompt is a multilingual { el, en, ru } field.
  const prompt = payload.prompt;
  if (prompt && typeof prompt === 'object') {
    const ml = prompt as Record<string, string>;
    return ml[language] || ml.en || ml.el || '';
  }

  // picture-match exercises: prompt_description is a single (Greek) string.
  if (typeof payload.prompt_description === 'string') {
    return payload.prompt_description;
  }

  return '';
}

/** Number of options in an exercise payload (for the "topic · N options" meta). */
export function exerciseOptionCount(exercise: ExerciseQueueItem): number {
  const payload = exercise.items[0]?.payload as Record<string, unknown> | undefined;
  const options = payload?.options;
  return Array.isArray(options) ? options.length : 0;
}
