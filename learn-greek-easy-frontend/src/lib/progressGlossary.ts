// src/lib/progressGlossary.ts

/**
 * Progress Glossary Selectors
 *
 * Pure functions that derive glossary-level metrics from card status counts.
 * No React imports — this module is unit-testable without jsdom.
 *
 * ## Tier definitions (mapped to SRS stage boundaries in sm2.py)
 *
 * All tiers derive from `CardStatus` as persisted by `sm2.determine_status()`.
 * Source of truth: `learn-greek-easy-backend/src/core/sm2.py` lines 62-81, 237-299.
 *
 * | Tier (RU / EN)         | CardStatus mapping        | Exact criterion (from code)              |
 * |------------------------|---------------------------|------------------------------------------|
 * | новое / new            | status == new             | Never reviewed (repetitions=0)           |
 * | начато / started       | status ∈ {learning,review}| Reviewed ≥1× but not mastered            |
 * | выучено / learned      | status ∈ {review,mastered}| repetitions ≥ 3 (graduated from learning)|
 * | освоено / mastered     | status == mastered        | EF ≥ 2.3 AND interval ≥ 21 days         |
 *
 * **Nesting**: mastered ⊂ learned ⊂ started. The stage *distribution* pie uses
 * the 4 disjoint `CardStatus` buckets (new/learning/review/mastered), which
 * partition the population and sum to the card total.
 *
 * ## Single-selector-per-metric rule
 *
 * Every metric is computed by exactly one export here. No surface recomputes
 * a metric independently — it imports the selector.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Flat counts of cards by SRS status.
 * `due` is optional — the backend merges it from `progress_service.py:217-221`
 * but it is an orthogonal scheduling dimension, never a stage. No selector
 * reads `due`; it is excluded from all percentage denominators.
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
 * Percents are rounded integers and sum to exactly 100 for any non-zero total
 * (largest-remainder correction applied), or all zero when total is 0.
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

// ============================================================================
// Tier definition constants
// ============================================================================

/**
 * SRS threshold constants — sourced from sm2.py lines 62-81.
 * Exported for reuse in docs, tests, and display strings.
 */
export const SRS_THRESHOLDS = {
  /**
   * Minimum easiness factor (EF) for mastered status.
   * Source: `sm2.py:62` `MASTERY_EF_THRESHOLD`
   */
  MASTERY_EF_THRESHOLD: 2.3,
  /**
   * Minimum interval in days for mastered status.
   * Source: `sm2.py:69` `MASTERY_INTERVAL_THRESHOLD`
   */
  MASTERY_INTERVAL_THRESHOLD: 21,
  /**
   * Minimum successful reviews to graduate from the learning phase.
   * Source: `sm2.py:76` `LEARNING_REPETITIONS_THRESHOLD`
   */
  LEARNING_REPETITIONS_THRESHOLD: 3,
} as const;

/**
 * Tier definitions for the progress glossary.
 * Each tier maps a RU/EN label to the exact `CardStatus` criterion.
 */
export const PROGRESS_TIERS = {
  /**
   * освоено / mastered — status == "mastered"
   * Criterion: EF ≥ 2.3 AND interval ≥ 21 days.
   */
  MASTERED: {
    ruLabel: 'освоено',
    enLabel: 'mastered',
    statuses: ['mastered'] as const,
    description:
      `EF ≥ ${SRS_THRESHOLDS.MASTERY_EF_THRESHOLD} AND ` +
      `interval ≥ ${SRS_THRESHOLDS.MASTERY_INTERVAL_THRESHOLD} days`,
  },
  /**
   * выучено / learned — status ∈ {review, mastered}
   * Criterion: repetitions ≥ 3 (graduated from the learning phase).
   * Note: mastered ⊂ learned.
   */
  LEARNED: {
    ruLabel: 'выучено',
    enLabel: 'learned',
    statuses: ['review', 'mastered'] as const,
    description: `repetitions ≥ ${SRS_THRESHOLDS.LEARNING_REPETITIONS_THRESHOLD} (graduated)`,
  },
  /**
   * начато / started — status ∈ {learning, review}
   * Criterion: reviewed ≥ once but not mastered (repetitions < 3 OR not EF/interval-mastered).
   * Note: learned ⊂ started.
   */
  STARTED: {
    ruLabel: 'начато',
    enLabel: 'started',
    statuses: ['learning', 'review'] as const,
    description: 'reviewed ≥ once but not yet mastered',
  },
  /**
   * новое / new — status == "new"
   * Criterion: never reviewed (repetitions = 0, no CardRecordStatistics row).
   */
  NEW: {
    ruLabel: 'новое',
    enLabel: 'new',
    statuses: ['new'] as const,
    description: 'never reviewed (repetitions = 0)',
  },
} as const;

// ============================================================================
// Deck completion selector
// ============================================================================

/**
 * Returns the deck completion percentage as a rounded integer.
 *
 * Coverage-based: how many cards has the learner studied (started or mastered)
 * out of the total cards in the deck?
 *
 * Formula: Math.round(cardsStudied / cardsTotal * 100), 0 when cardsTotal === 0.
 *
 * Single canonical selector — both the DeckCard and the detail hero use this so
 * they always show the same number for the same deck.
 *
 * @param input.cardsStudied - number of cards started (learning + mastered)
 * @param input.cardsTotal   - total cards in the deck
 * @returns rounded integer 0–100
 */
export function deckCompletionPct(input: { cardsStudied: number; cardsTotal: number }): number {
  return input.cardsTotal > 0 ? Math.round((input.cardsStudied / input.cardsTotal) * 100) : 0;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Returns the number of mastered cards.
 * Returns 0 when the `mastered` key is absent or undefined.
 *
 * @param counts - Card status counts
 * @returns Number of mastered cards
 */
export function masteredCount(counts: CardStatusCounts): number {
  return counts.mastered ?? 0;
}

/**
 * Returns the number of "learned" cards (review + mastered).
 *
 * Cards in either the `review` or `mastered` bucket have completed the initial
 * learning phase (repetitions ≥ 3). This is the canonical selector for the
 * "выученные слова" metric on the Statistics page.
 *
 * @param counts - Card status counts
 * @returns Sum of review + mastered
 */
export function learnedCount(counts: CardStatusCounts): number {
  return (counts.review ?? 0) + (counts.mastered ?? 0);
}

/**
 * Returns a 4-bucket stage distribution with per-bucket rounded integer percents.
 *
 * The denominator is `new + learning + review + mastered` only — `due` is
 * intentionally excluded because it is an orthogonal scheduling dimension
 * (cards due today already counted in learning/review/mastered), not a stage.
 *
 * When the total is 0 (all-zero input), every bucket returns {count:0, percent:0}
 * and no NaN is produced.
 *
 * **Largest-remainder correction** ensures the 4 integer percents sum to exactly
 * 100 for any non-zero total, eliminating off-by-one rounding artefacts.
 *
 * @param counts - Card status counts (`due` ignored in percentage math)
 * @returns StageDistribution with 4 disjoint buckets
 */
export function stageDistribution(counts: CardStatusCounts): StageDistribution {
  const newCount = counts.new ?? 0;
  const learningCount = counts.learning ?? 0;
  const reviewCount = counts.review ?? 0;
  const masteredCount_ = counts.mastered ?? 0;

  const total = newCount + learningCount + reviewCount + masteredCount_;

  if (total === 0) {
    return {
      new: { count: 0, percent: 0 },
      learning: { count: 0, percent: 0 },
      review: { count: 0, percent: 0 },
      mastered: { count: 0, percent: 0 },
    };
  }

  // Compute exact (unrounded) percentages and their floor values
  const buckets: Array<{ key: keyof StageDistribution; count: number; exact: number }> = [
    { key: 'new', count: newCount, exact: (newCount / total) * 100 },
    { key: 'learning', count: learningCount, exact: (learningCount / total) * 100 },
    { key: 'review', count: reviewCount, exact: (reviewCount / total) * 100 },
    { key: 'mastered', count: masteredCount_, exact: (masteredCount_ / total) * 100 },
  ];

  // Assign floored percents
  const floored = buckets.map((b) => ({ ...b, floor: Math.floor(b.exact) }));
  const floorSum = floored.reduce((acc, b) => acc + b.floor, 0);
  const remainder = 100 - floorSum; // Number of +1 adjustments needed

  // Largest-remainder correction: give +1 to the buckets with the largest
  // fractional parts until the sum reaches 100.
  const sorted = [...floored].sort((a, b) => b.exact - b.floor - (a.exact - a.floor));
  const adjustments = new Set(sorted.slice(0, remainder).map((b) => b.key));

  const result = {} as StageDistribution;
  for (const bucket of floored) {
    result[bucket.key] = {
      count: bucket.count,
      percent: bucket.floor + (adjustments.has(bucket.key) ? 1 : 0),
    };
  }

  return result;
}
