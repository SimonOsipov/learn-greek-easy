/**
 * Session Summary Utilities Tests
 *
 * Comprehensive test suite for session summary calculation utilities.
 * Tests time formatting, accuracy calculations, message generation, and rating breakdowns.
 *
 * Coverage targets:
 * - Time formatting (seconds → human-readable)
 * - Accuracy calculations
 * - Encouraging message selection
 * - Color class selection
 * - Rating breakdown formatting
 * - Percentage adjustments for rounding
 * - Progress transition detection
 */

import { describe, it, expect } from 'vitest';
import {
  formatTime,
  calculateAccuracy,
  getEncouragingMessage,
  getAccuracyColor,
  formatRatingBreakdown,
  hasProgressTransitions,
  adjustPercentages,
} from '../sessionSummaryUtils';
import type { SessionSummary } from '@/types/review';

describe('sessionSummaryUtils', () => {
  // Helper to create test session summary
  const createSessionSummary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
    sessionId: 'test-session',
    deckId: 'test-deck',
    userId: 'test-user',
    completedAt: new Date(),
    cardsReviewed: 10,
    accuracy: 80,
    totalTime: 300,
    averageTimePerCard: 30,
    ratingBreakdown: {
      again: 1,
      hard: 1,
      good: 6,
      easy: 2,
    },
    transitions: {
      newToLearning: 2,
      learningToReview: 3,
      reviewToMastered: 1,
      toRelearning: 1,
    },
    deckProgressBefore: {
      cardsNew: 10,
      cardsLearning: 5,
      cardsReview: 15,
      cardsMastered: 20,
    },
    deckProgressAfter: {
      cardsNew: 8,
      cardsLearning: 6,
      cardsReview: 17,
      cardsMastered: 21,
    },
    ...overrides,
  });

  describe('formatTime', () => {
    it('should format 0 seconds', () => {
      expect(formatTime(0)).toBe('0s');
    });

    it('should format seconds only (< 60)', () => {
      expect(formatTime(45)).toBe('45s');
      expect(formatTime(59)).toBe('59s');
      expect(formatTime(1)).toBe('1s');
    });

    it('should format minutes and seconds', () => {
      expect(formatTime(90)).toBe('1m 30s');
      expect(formatTime(125)).toBe('2m 5s');
      expect(formatTime(185)).toBe('3m 5s');
    });

    it('should format minutes only (no remaining seconds)', () => {
      expect(formatTime(60)).toBe('1m');
      expect(formatTime(120)).toBe('2m');
      expect(formatTime(300)).toBe('5m');
    });

    it('should handle large times', () => {
      expect(formatTime(3600)).toBe('60m'); // 1 hour
      expect(formatTime(3661)).toBe('61m 1s'); // 1 hour 1 minute 1 second
    });

    it('should handle edge cases', () => {
      expect(formatTime(61)).toBe('1m 1s');
      expect(formatTime(119)).toBe('1m 59s');
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy from good + easy ratings', () => {
      const summary = createSessionSummary({
        cardsReviewed: 10,
        ratingBreakdown: {
          again: 1,
          hard: 1,
          good: 6,
          easy: 2,
        },
      });

      const accuracy = calculateAccuracy(summary);
      expect(accuracy).toBe(80); // (6 + 2) / 10 = 80%
    });

    it('should return 0 for zero cards reviewed', () => {
      const summary = createSessionSummary({
        cardsReviewed: 0,
        ratingBreakdown: { again: 0, hard: 0, good: 0, easy: 0 },
      });

      expect(calculateAccuracy(summary)).toBe(0);
    });

    it('should return 100 for perfect session', () => {
      const summary = createSessionSummary({
        cardsReviewed: 5,
        ratingBreakdown: { again: 0, hard: 0, good: 3, easy: 2 },
      });

      expect(calculateAccuracy(summary)).toBe(100); // (3 + 2) / 5 = 100%
    });

    it('should return 0 for all "again" ratings', () => {
      const summary = createSessionSummary({
        cardsReviewed: 5,
        ratingBreakdown: { again: 5, hard: 0, good: 0, easy: 0 },
      });

      expect(calculateAccuracy(summary)).toBe(0);
    });

    it('should round to nearest integer', () => {
      const summary = createSessionSummary({
        cardsReviewed: 3,
        ratingBreakdown: { again: 0, hard: 1, good: 2, easy: 0 },
      });

      expect(calculateAccuracy(summary)).toBe(67); // 2/3 = 66.67 → 67
    });

    it('should handle edge case: 1 card reviewed', () => {
      const summary = createSessionSummary({
        cardsReviewed: 1,
        ratingBreakdown: { again: 0, hard: 0, good: 1, easy: 0 },
      });

      expect(calculateAccuracy(summary)).toBe(100);
    });

    it('should not count "hard" as correct', () => {
      const summary = createSessionSummary({
        cardsReviewed: 10,
        ratingBreakdown: { again: 0, hard: 10, good: 0, easy: 0 },
      });

      expect(calculateAccuracy(summary)).toBe(0);
    });
  });

  describe('getEncouragingMessage', () => {
    it('should return perfect message for 100% accuracy', () => {
      const message = getEncouragingMessage(100, 10);
      expect(message).toContain('Perfect');
      expect(message).toContain('crushing it');
    });

    it('should return excellent message for 90%+ accuracy', () => {
      expect(getEncouragingMessage(90, 10)).toContain('Excellent');
      expect(getEncouragingMessage(95, 10)).toContain('mastering');
      expect(getEncouragingMessage(99, 10)).toContain('Excellent');
    });

    it('should return great message for 70-89% accuracy', () => {
      expect(getEncouragingMessage(70, 10)).toContain('Great job');
      expect(getEncouragingMessage(80, 10)).toContain('consistent practice');
      expect(getEncouragingMessage(89, 10)).toContain('Great');
    });

    it('should return good message for 50-69% accuracy', () => {
      expect(getEncouragingMessage(50, 10)).toContain('Good effort');
      expect(getEncouragingMessage(60, 10)).toContain('practicing');
      expect(getEncouragingMessage(69, 10)).toContain('improve');
    });

    it('should return encouraging message for 1-49% accuracy', () => {
      const message = getEncouragingMessage(25, 10);
      expect(message).toContain('progress');
    });

    it('should return supportive message for 0% accuracy', () => {
      const message = getEncouragingMessage(0, 10);
      expect(message).toContain('Keep going');
      expect(message).toContain('foundation');
    });

    it('should handle edge case: no cards reviewed', () => {
      const message = getEncouragingMessage(0, 0);
      expect(message).toContain('Session ended');
      expect(message).toContain('without reviewing');
    });

    it('should handle boundary: exactly 70%', () => {
      const message = getEncouragingMessage(70, 10);
      expect(message).toContain('Great');
    });

    it('should handle boundary: exactly 90%', () => {
      const message = getEncouragingMessage(90, 10);
      expect(message).toContain('Excellent');
    });
  });

  describe('getAccuracyColor', () => {
    it('should return green for 70%+ accuracy', () => {
      expect(getAccuracyColor(70)).toBe('text-green-600');
      expect(getAccuracyColor(80)).toBe('text-green-600');
      expect(getAccuracyColor(100)).toBe('text-green-600');
    });

    it('should return orange for 50-69% accuracy', () => {
      expect(getAccuracyColor(50)).toBe('text-orange-600');
      expect(getAccuracyColor(60)).toBe('text-orange-600');
      expect(getAccuracyColor(69)).toBe('text-orange-600');
    });

    it('should return red for < 50% accuracy', () => {
      expect(getAccuracyColor(0)).toBe('text-red-600');
      expect(getAccuracyColor(25)).toBe('text-red-600');
      expect(getAccuracyColor(49)).toBe('text-red-600');
    });

    it('should handle boundary cases', () => {
      expect(getAccuracyColor(70)).toBe('text-green-600'); // Exactly 70
      expect(getAccuracyColor(50)).toBe('text-orange-600'); // Exactly 50
    });
  });

  describe('formatRatingBreakdown', () => {
    it('should format rating breakdown with correct labels', () => {
      const summary = createSessionSummary({
        cardsReviewed: 10,
        ratingBreakdown: { again: 1, hard: 2, good: 5, easy: 2 },
      });

      const breakdown = formatRatingBreakdown(summary);

      expect(breakdown).toHaveLength(4);
      expect(breakdown[0].label).toBe('Again');
      expect(breakdown[1].label).toBe('Hard');
      expect(breakdown[2].label).toBe('Good');
      expect(breakdown[3].label).toBe('Easy');
    });

    it('should include correct counts', () => {
      const summary = createSessionSummary({
        cardsReviewed: 10,
        ratingBreakdown: { again: 1, hard: 2, good: 5, easy: 2 },
      });

      const breakdown = formatRatingBreakdown(summary);

      expect(breakdown[0].count).toBe(1); // Again
      expect(breakdown[1].count).toBe(2); // Hard
      expect(breakdown[2].count).toBe(5); // Good
      expect(breakdown[3].count).toBe(2); // Easy
    });

    it('should calculate percentages correctly', () => {
      const summary = createSessionSummary({
        cardsReviewed: 10,
        ratingBreakdown: { again: 1, hard: 2, good: 5, easy: 2 },
      });

      const breakdown = formatRatingBreakdown(summary);

      expect(breakdown[0].percentage).toBe(10); // 1/10 = 10%
      expect(breakdown[1].percentage).toBe(20); // 2/10 = 20%
      expect(breakdown[2].percentage).toBe(50); // 5/10 = 50%
      expect(breakdown[3].percentage).toBe(20); // 2/10 = 20%
    });

    it('should assign correct colors', () => {
      const summary = createSessionSummary();
      const breakdown = formatRatingBreakdown(summary);

      expect(breakdown[0].color).toBe('text-red-600'); // Again
      expect(breakdown[1].color).toBe('text-orange-600'); // Hard
      expect(breakdown[2].color).toBe('text-green-600'); // Good
      expect(breakdown[3].color).toBe('text-blue-600'); // Easy
    });

    it('should assign correct background colors', () => {
      const summary = createSessionSummary();
      const breakdown = formatRatingBreakdown(summary);

      expect(breakdown[0].bgColor).toBe('bg-red-50'); // Again
      expect(breakdown[1].bgColor).toBe('bg-orange-50'); // Hard
      expect(breakdown[2].bgColor).toBe('bg-green-50'); // Good
      expect(breakdown[3].bgColor).toBe('bg-blue-50'); // Easy
    });

    it('should handle zero cards reviewed', () => {
      const summary = createSessionSummary({
        cardsReviewed: 0,
        ratingBreakdown: { again: 0, hard: 0, good: 0, easy: 0 },
      });

      const breakdown = formatRatingBreakdown(summary);

      breakdown.forEach((item) => {
        expect(item.percentage).toBe(0);
        expect(item.count).toBe(0);
      });
    });

    it('should ensure percentages sum to 100 (rounding adjustment)', () => {
      const summary = createSessionSummary({
        cardsReviewed: 3,
        ratingBreakdown: { again: 1, hard: 1, good: 1, easy: 0 },
      });

      const breakdown = formatRatingBreakdown(summary);
      const sum = breakdown.reduce((acc, item) => acc + item.percentage, 0);

      expect(sum).toBe(100); // Should adjust for rounding
    });
  });

  describe('hasProgressTransitions', () => {
    it('should return true when newToLearning transitions exist', () => {
      const summary = createSessionSummary({
        transitions: {
          newToLearning: 2,
          learningToReview: 0,
          reviewToMastered: 0,
          toRelearning: 0,
        },
      });

      expect(hasProgressTransitions(summary)).toBe(true);
    });

    it('should return true when learningToReview transitions exist', () => {
      const summary = createSessionSummary({
        transitions: {
          newToLearning: 0,
          learningToReview: 3,
          reviewToMastered: 0,
          toRelearning: 0,
        },
      });

      expect(hasProgressTransitions(summary)).toBe(true);
    });

    it('should return true when reviewToMastered transitions exist', () => {
      const summary = createSessionSummary({
        transitions: {
          newToLearning: 0,
          learningToReview: 0,
          reviewToMastered: 1,
          toRelearning: 0,
        },
      });

      expect(hasProgressTransitions(summary)).toBe(true);
    });

    it('should return true when toRelearning transitions exist', () => {
      const summary = createSessionSummary({
        transitions: {
          newToLearning: 0,
          learningToReview: 0,
          reviewToMastered: 0,
          toRelearning: 2,
        },
      });

      expect(hasProgressTransitions(summary)).toBe(true);
    });

    it('should return false when no transitions exist', () => {
      const summary = createSessionSummary({
        transitions: {
          newToLearning: 0,
          learningToReview: 0,
          reviewToMastered: 0,
          toRelearning: 0,
        },
      });

      expect(hasProgressTransitions(summary)).toBe(false);
    });

    it('should return true when multiple transitions exist', () => {
      const summary = createSessionSummary({
        transitions: {
          newToLearning: 2,
          learningToReview: 3,
          reviewToMastered: 1,
          toRelearning: 1,
        },
      });

      expect(hasProgressTransitions(summary)).toBe(true);
    });
  });

  describe('adjustPercentages', () => {
    it('should return zeros for zero total', () => {
      const counts = [0, 0, 0, 0];
      const result = adjustPercentages(counts, 0);

      expect(result).toEqual([0, 0, 0, 0]);
    });

    it('should calculate correct percentages for even distribution', () => {
      const counts = [25, 25, 25, 25];
      const result = adjustPercentages(counts, 100);

      expect(result).toEqual([25, 25, 25, 25]);
      expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('should adjust for rounding errors (sum to 100)', () => {
      const counts = [1, 1, 1]; // Each should be 33.33%
      const result = adjustPercentages(counts, 3);

      // Should be [33, 33, 34] or similar to sum to 100
      expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('should round individual percentages', () => {
      const counts = [10, 20, 30, 40];
      const result = adjustPercentages(counts, 100);

      expect(result).toEqual([10, 20, 30, 40]);
    });

    it('should handle uneven distribution', () => {
      const counts = [5, 2, 1, 2];
      const result = adjustPercentages(counts, 10);

      expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('should adjust largest value to fix rounding', () => {
      const counts = [1, 1, 1]; // 33.33% each
      const result = adjustPercentages(counts, 3);

      // One value should be 34 to make sum = 100
      expect(result).toContain(34);
      expect(result.filter((v) => v === 33)).toHaveLength(2);
    });

    it('should handle single item', () => {
      const counts = [10];
      const result = adjustPercentages(counts, 10);

      expect(result).toEqual([100]);
    });

    it('should handle large numbers', () => {
      const counts = [1000, 2000, 3000, 4000];
      const result = adjustPercentages(counts, 10000);

      expect(result).toEqual([10, 20, 30, 40]);
      expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    });
  });
});
