/**
 * Session Summary Utilities Tests
 *
 * Comprehensive test suite for session summary calculation utilities.
 * Tests time formatting, message generation, and rating breakdowns.
 *
 * Coverage targets:
 * - Time formatting (seconds → human-readable)
 * - Encouraging message selection (again-percentage-based)
 * - Rating breakdown formatting
 * - Percentage adjustments for rounding
 * - Progress transition detection
 */

import { describe, it, expect } from 'vitest';

import type { SessionSummary } from '@/types/review';

import {
  formatTime,
  getEncouragingMessage,
  formatRatingBreakdown,
  hasProgressTransitions,
  adjustPercentages,
} from '../sessionSummaryUtils';

describe('sessionSummaryUtils', () => {
  // Helper to create test session summary
  const createSessionSummary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
    sessionId: 'test-session',
    deckId: 'test-deck',
    userId: 'test-user',
    completedAt: new Date(),
    cardsReviewed: 10,
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

  describe('getEncouragingMessage', () => {
    it('returns perfect message for 0% again rate', () => {
      expect(getEncouragingMessage(0, 10)).toBe("Perfect session! You're crushing it!");
    });

    it('returns excellent message for <=10% again rate', () => {
      expect(getEncouragingMessage(10, 10)).toBe("Excellent work! You're mastering this deck!");
      expect(getEncouragingMessage(5, 20)).toBe("Excellent work! You're mastering this deck!");
    });

    it('returns great message for 11-30% again rate', () => {
      expect(getEncouragingMessage(11, 10)).toBe('Great job! Keep up the consistent practice!');
      expect(getEncouragingMessage(30, 20)).toBe('Great job! Keep up the consistent practice!');
    });

    it('returns good message for 31-50% again rate', () => {
      expect(getEncouragingMessage(31, 10)).toBe(
        "Good effort! Keep practicing and you'll improve!"
      );
      expect(getEncouragingMessage(50, 20)).toBe(
        "Good effort! Keep practicing and you'll improve!"
      );
    });

    it('returns supportive message for 100% again rate', () => {
      expect(getEncouragingMessage(100, 10)).toBe(
        'Keep going! Every review builds your foundation.'
      );
    });

    it('returns progress message for 51-99% again rate', () => {
      expect(getEncouragingMessage(51, 10)).toBe("Every review counts! You're making progress!");
      expect(getEncouragingMessage(75, 20)).toBe("Every review counts! You're making progress!");
    });

    it('returns specific message when no cards reviewed', () => {
      expect(getEncouragingMessage(0, 0)).toBe('Session ended without reviewing cards.');
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

      expect(breakdown[0].color).toBe('text-red-600 dark:text-red-400'); // Again
      expect(breakdown[1].color).toBe('text-orange-600 dark:text-orange-400'); // Hard
      expect(breakdown[2].color).toBe('text-green-600 dark:text-green-400'); // Good
      expect(breakdown[3].color).toBe('text-blue-600 dark:text-blue-400'); // Easy
    });

    it('should assign correct background colors', () => {
      const summary = createSessionSummary();
      const breakdown = formatRatingBreakdown(summary);

      expect(breakdown[0].bgColor).toBe('bg-red-50 dark:bg-red-900/30'); // Again
      expect(breakdown[1].bgColor).toBe('bg-orange-50 dark:bg-orange-900/30'); // Hard
      expect(breakdown[2].bgColor).toBe('bg-green-50 dark:bg-green-900/30'); // Good
      expect(breakdown[3].bgColor).toBe('bg-blue-50 dark:bg-blue-900/30'); // Easy
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
