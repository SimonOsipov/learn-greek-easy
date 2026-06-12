// src/lib/progressGlossary.ts

/**
 * Progress Glossary Selectors
 *
 * Pure functions that derive glossary-level metrics from card status counts.
 * These are used in the Progress page to display the "Your Progress" section:
 * mastered count, learned count (review + mastered), and a 4-bucket stage
 * distribution with percentages.
 *
 * `due` cards are excluded from percentage calculations — the total used for
 * percentage arithmetic is new + learning + review + mastered only.
 */

/**
 * Flat counts of cards by SRS status.
 * `due` is optional (added by the executor when the backend exposes it).
 */
export type CardStatusCounts = {
  new: number;
  learning: number;
  review: number;
  mastered: number;
  due?: number;
};

/**
 * One bucket in the stage distribution.
 */
export type StatusBucket = {
  count: number;
  /** Rounded integer percent of the 4-stage total (new+learning+review+mastered). */
  percent: number;
};

/**
 * Return type of `stageDistribution`.
 *
 * Four disjoint buckets; `due` is intentionally excluded from the denominator.
 * Percents are rounded integers; they sum to 100 when the total > 0, or all
 * zero when the total is 0.
 *
 * Example (new=5, learning=3, review=2, mastered=7, due=4 → total=17):
 *   { new: {count:5, percent:29}, learning: {count:3, percent:18},
 *     review: {count:2, percent:12}, mastered: {count:7, percent:41} }
 */
export type StageDistribution = {
  new: StatusBucket;
  learning: StatusBucket;
  review: StatusBucket;
  mastered: StatusBucket;
};

/**
 * Returns the number of mastered cards.
 * Returns 0 when the `mastered` key is absent or undefined.
 *
 * @param counts - Card status counts
 * @returns Number of mastered cards
 *
 * TODO: implement
 */
export function masteredCount(_counts: CardStatusCounts): number {
  return -1; // TODO
}

/**
 * Returns the number of "learned" cards (review + mastered).
 * Cards in either the review or mastered bucket have been seen and graduated
 * beyond the initial learning phase.
 *
 * @param counts - Card status counts
 * @returns Sum of review + mastered
 *
 * TODO: implement
 */
export function learnedCount(_counts: CardStatusCounts): number {
  return -1; // TODO
}

/**
 * Returns a 4-bucket stage distribution with per-bucket rounded integer percents.
 *
 * The denominator is `new + learning + review + mastered` only — `due` is
 * excluded because it is an orthogonal scheduling dimension, not a stage.
 *
 * When the total is 0 (all-zero input), every bucket returns {count:0, percent:0}
 * and no NaN is produced.
 *
 * Rounding strategy: each percent is Math.round(count/total * 100); the
 * executor must ensure they sum to 100 for non-zero totals (e.g. largest-
 * remainder correction).
 *
 * @param counts - Card status counts (due is ignored in percentage math)
 * @returns StageDistribution with 4 buckets
 *
 * TODO: implement
 */
export function stageDistribution(_counts: CardStatusCounts): StageDistribution {
  // TODO: stub returns zeroed placeholders so assertions fail RED
  return {
    new: { count: 0, percent: 0 },
    learning: { count: 0, percent: 0 },
    review: { count: 0, percent: 0 },
    mastered: { count: 0, percent: 0 },
  };
}
