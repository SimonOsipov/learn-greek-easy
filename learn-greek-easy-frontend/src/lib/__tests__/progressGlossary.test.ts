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

  describe('stageDistribution — adversarial edge coverage', () => {
    // Edge: single non-zero bucket → that bucket 100%, others 0%, sum 100
    it('single non-zero bucket (new=1) → new=100%, rest=0%, sum=100', () => {
      const dist = stageDistribution({ new: 1, learning: 0, review: 0, mastered: 0 });
      expect(dist.new.percent).toBe(100);
      expect(dist.learning.percent).toBe(0);
      expect(dist.review.percent).toBe(0);
      expect(dist.mastered.percent).toBe(0);
      expect(
        dist.new.percent + dist.learning.percent + dist.review.percent + dist.mastered.percent
      ).toBe(100);
    });

    // Edge: three equal non-zero buckets — naïve Math.round sums to 99 (33+33+33+0=99),
    // largest-remainder must distribute the extra 1 point so sum = 100.
    it('three equal buckets (new=1, learning=1, review=1, mastered=0) → sum exactly 100, not 99', () => {
      const dist = stageDistribution({ new: 1, learning: 1, review: 1, mastered: 0 });
      const sum =
        dist.new.percent + dist.learning.percent + dist.review.percent + dist.mastered.percent;
      expect(sum).toBe(100);
      // mastered contributes nothing
      expect(dist.mastered.percent).toBe(0);
      // the three non-zero buckets must account for all 100 points (two at 33, one at 34)
      expect(dist.new.percent + dist.learning.percent + dist.review.percent).toBe(100);
    });

    // Edge: all four buckets equal → 25% each, sum 100 (no rounding artefact)
    it('all-equal four buckets (1,1,1,1) → 25% each, sum 100', () => {
      const dist = stageDistribution({ new: 1, learning: 1, review: 1, mastered: 1 });
      expect(dist.new.percent).toBe(25);
      expect(dist.learning.percent).toBe(25);
      expect(dist.review.percent).toBe(25);
      expect(dist.mastered.percent).toBe(25);
      expect(
        dist.new.percent + dist.learning.percent + dist.review.percent + dist.mastered.percent
      ).toBe(100);
    });

    // Edge: learnedCount / masteredCount with partial (missing-key) dict — must not NaN
    it('learnedCount with missing review key treats absent key as 0', () => {
      const partial = { new: 5, learning: 2, mastered: 3 } as CardStatusCounts;
      expect(learnedCount(partial)).toBe(3); // review absent → 0 + mastered 3 = 3
    });

    it('masteredCount with missing mastered key treats absent key as 0', () => {
      const partial = { new: 5, learning: 2, review: 4 } as CardStatusCounts;
      expect(masteredCount(partial)).toBe(0);
    });

    // Edge: due present and very large — must NOT affect percents (excluded from denominator)
    it('due=999 does not inflate denominator (new=1, rest=0 → new=100%)', () => {
      const dist = stageDistribution({ new: 1, learning: 0, review: 0, mastered: 0, due: 999 });
      expect(dist.new.percent).toBe(100);
      const sum =
        dist.new.percent + dist.learning.percent + dist.review.percent + dist.mastered.percent;
      expect(sum).toBe(100);
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
