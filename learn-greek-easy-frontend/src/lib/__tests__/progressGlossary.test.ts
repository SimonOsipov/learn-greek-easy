/**
 * Progress Glossary Selectors Tests
 *
 * Tests for masteredCount, learnedCount, and stageDistribution.
 * These selectors derive glossary-level metrics from raw card status counts.
 *
 * AC-1: masteredCount reads the mastered bucket directly.
 * AC-2: learnedCount sums review + mastered.
 * AC-4: stageDistribution produces 4 buckets whose percents sum to 100
 *       (due excluded from denominator).
 */

import { describe, it, expect } from 'vitest';

import { masteredCount, learnedCount, stageDistribution } from '../progressGlossary';

import type { CardStatusCounts } from '../progressGlossary';

/** Full counts fixture used across most tests. */
const fullCounts: CardStatusCounts = {
  new: 5,
  learning: 3,
  review: 2,
  mastered: 7,
  due: 4,
};

describe('progressGlossary', () => {
  describe('masteredCount', () => {
    // AC-1
    it('reads the mastered bucket directly', () => {
      expect(masteredCount(fullCounts)).toBe(7);
    });

    // AC-1 edge: missing mastered key
    it('returns 0 when the mastered key is absent', () => {
      const counts = { new: 3, learning: 2, review: 1 } as CardStatusCounts;
      expect(masteredCount(counts)).toBe(0);
    });
  });

  describe('learnedCount', () => {
    // AC-2
    it('sums review and mastered buckets (review=2, mastered=7 → 9)', () => {
      expect(learnedCount(fullCounts)).toBe(9);
    });
  });

  describe('stageDistribution', () => {
    // AC-4 — sum-to-100 with due excluded
    it('produces 4 buckets whose percents sum to 100 (due excluded from denominator)', () => {
      // total of stages = 5+3+2+7 = 17; due=4 must not inflate denominator
      const dist = stageDistribution(fullCounts);

      // Each bucket must carry the correct raw count
      expect(dist.new.count).toBe(5);
      expect(dist.learning.count).toBe(3);
      expect(dist.review.count).toBe(2);
      expect(dist.mastered.count).toBe(7);

      // Percents (rounded): 5/17≈29, 3/17≈18, 2/17≈12, 7/17≈41 → sum = 100
      const percentSum =
        dist.new.percent + dist.learning.percent + dist.review.percent + dist.mastered.percent;
      expect(percentSum).toBe(100);

      // Individual rounded percents
      expect(dist.new.percent).toBe(29); // Math.round(5/17*100) = 29
      expect(dist.learning.percent).toBe(18); // Math.round(3/17*100) = 18
      expect(dist.review.percent).toBe(12); // Math.round(2/17*100) = 12
      expect(dist.mastered.percent).toBe(41); // Math.round(7/17*100) = 41
    });

    // AC-4 edge: all-zero input → no NaN, percent sum = 0
    it('returns zeroed buckets with no NaN when all counts are zero', () => {
      const zeroCounts: CardStatusCounts = {
        new: 0,
        learning: 0,
        review: 0,
        mastered: 0,
      };

      const dist = stageDistribution(zeroCounts);

      expect(dist.new.count).toBe(0);
      expect(dist.learning.count).toBe(0);
      expect(dist.review.count).toBe(0);
      expect(dist.mastered.count).toBe(0);

      // No NaN in any percent field
      expect(Number.isNaN(dist.new.percent)).toBe(false);
      expect(Number.isNaN(dist.learning.percent)).toBe(false);
      expect(Number.isNaN(dist.review.percent)).toBe(false);
      expect(Number.isNaN(dist.mastered.percent)).toBe(false);

      // All percents are 0
      const percentSum =
        dist.new.percent + dist.learning.percent + dist.review.percent + dist.mastered.percent;
      expect(percentSum).toBe(0);
    });
  });
});
