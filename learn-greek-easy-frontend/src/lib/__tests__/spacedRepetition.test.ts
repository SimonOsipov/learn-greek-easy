/**
 * SM-2 Spaced Repetition Algorithm Tests
 *
 * Comprehensive test suite for the SuperMemo 2 algorithm implementation.
 * Tests all quality ratings, state transitions, interval calculations, and edge cases.
 *
 * Coverage targets:
 * - All review ratings: again, hard, good, easy
 * - All card states: new, learning, review, relearning, mastered
 * - Ease factor calculations and bounds
 * - Interval calculations for all scenarios
 * - Due date calculations
 * - State machine transitions
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { SpacedRepetitionData, ReviewRating, CardReviewState } from '@/types/review';

import {
  calculateNextInterval,
  calculateEaseFactor,
  getLearningSteps,
  getGraduatingInterval,
  calculateNextReviewDate,
  isCardDue,
  processCardReview,
} from '../spacedRepetition';

describe('spacedRepetition - SM-2 Algorithm', () => {
  // Helper to create test SR data
  const createSRData = (overrides: Partial<SpacedRepetitionData> = {}): SpacedRepetitionData => ({
    cardId: 'test-card',
    deckId: 'test-deck',
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    state: 'new',
    step: 0,
    dueDate: null,
    lastReviewed: null,
    reviewCount: 0,
    successCount: 0,
    failureCount: 0,
    successRate: 0,
    ...overrides,
  });

  describe('calculateEaseFactor', () => {
    it('should decrease ease factor for "again" rating', () => {
      const result = calculateEaseFactor(2.5, 'again');
      expect(result).toBe(2.3); // 2.5 - 0.2 = 2.3
    });

    it('should decrease ease factor for "hard" rating', () => {
      const result = calculateEaseFactor(2.5, 'hard');
      expect(result).toBe(2.35); // 2.5 - 0.15 = 2.35
    });

    it('should keep ease factor unchanged for "good" rating', () => {
      const result = calculateEaseFactor(2.5, 'good');
      expect(result).toBe(2.5); // No change
    });

    it('should increase ease factor for "easy" rating', () => {
      const result = calculateEaseFactor(2.5, 'easy');
      expect(result).toBe(2.5); // Already at max, can't increase
    });

    it('should increase ease factor for "easy" when below max', () => {
      const result = calculateEaseFactor(2.3, 'easy');
      expect(result).toBeCloseTo(2.45, 2); // 2.3 + 0.15 = 2.45 (allow floating point precision)
    });

    it('should enforce minimum ease factor of 1.3', () => {
      let ease = 1.4;
      ease = calculateEaseFactor(ease, 'again'); // 1.4 - 0.2 = 1.2
      expect(ease).toBe(1.3); // Clamped to minimum
    });

    it('should enforce maximum ease factor of 2.5', () => {
      const result = calculateEaseFactor(2.5, 'easy');
      expect(result).toBeLessThanOrEqual(2.5);
    });

    it('should handle multiple "again" ratings without going below 1.3', () => {
      let ease = 2.5;
      for (let i = 0; i < 10; i++) {
        ease = calculateEaseFactor(ease, 'again');
      }
      expect(ease).toBe(1.3); // Should bottom out at 1.3
    });

    it('should handle edge case: ease factor at exact minimum', () => {
      const result = calculateEaseFactor(1.3, 'again');
      expect(result).toBe(1.3); // Can't go lower
    });

    it('should handle edge case: ease factor at exact maximum', () => {
      const result = calculateEaseFactor(2.5, 'easy');
      expect(result).toBe(2.5); // Can't go higher
    });
  });

  describe('calculateNextInterval', () => {
    describe('Learning phase - New cards', () => {
      it('should return 0 for "again" rating (stay in learning)', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'again', 'new');
        expect(interval).toBe(0);
      });

      it('should return 1 day for "hard" from new', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'hard', 'new');
        expect(interval).toBe(1);
      });

      it('should return 1 day for "good" from new', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'good', 'new');
        expect(interval).toBe(1);
      });

      it('should return 4 days for "easy" from new', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'easy', 'new');
        expect(interval).toBe(4);
      });
    });

    describe('Learning phase - Learning state', () => {
      it('should return 1 day for "hard" from learning', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'hard', 'learning');
        expect(interval).toBe(1);
      });

      it('should return 1 day for "good" from learning', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'good', 'learning');
        expect(interval).toBe(1);
      });

      it('should return 4 days for "easy" from learning', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'easy', 'learning');
        expect(interval).toBe(4);
      });
    });

    describe('Review phase - Standard SM-2', () => {
      it('should multiply by 1.2 for "hard" rating', () => {
        const interval = calculateNextInterval(10, 2.5, 3, 'hard', 'review');
        expect(interval).toBe(12); // 10 * 1.2 = 12
      });

      it('should multiply by ease factor for "good" rating', () => {
        const interval = calculateNextInterval(10, 2.5, 3, 'good', 'review');
        expect(interval).toBe(25); // 10 * 2.5 = 25
      });

      it('should multiply by ease * 1.3 for "easy" rating', () => {
        const interval = calculateNextInterval(10, 2.5, 3, 'easy', 'review');
        expect(interval).toBe(33); // 10 * 2.5 * 1.3 = 32.5 → 33
      });

      it('should return 0 for "again" (reset to learning)', () => {
        const interval = calculateNextInterval(10, 2.5, 3, 'again', 'review');
        expect(interval).toBe(0);
      });

      it('should handle minimum interval of 1 day for "hard"', () => {
        const interval = calculateNextInterval(1, 2.5, 1, 'hard', 'review');
        expect(interval).toBeGreaterThanOrEqual(1);
      });

      it('should round intervals to integers', () => {
        const interval = calculateNextInterval(7, 2.5, 3, 'good', 'review');
        expect(Number.isInteger(interval)).toBe(true);
        expect(interval).toBe(18); // 7 * 2.5 = 17.5 → 18
      });
    });

    describe('Mastered phase', () => {
      it('should use same calculation as review state', () => {
        const interval = calculateNextInterval(21, 2.5, 10, 'good', 'mastered');
        expect(interval).toBe(53); // 21 * 2.5 = 52.5 → 53
      });

      it('should reset to 0 for "again" even when mastered', () => {
        const interval = calculateNextInterval(30, 2.5, 15, 'again', 'mastered');
        expect(interval).toBe(0);
      });
    });

    describe('Edge cases', () => {
      it('should handle very large intervals without overflow', () => {
        const interval = calculateNextInterval(1000, 2.5, 50, 'good', 'review');
        expect(Number.isFinite(interval)).toBe(true);
        expect(interval).toBe(2500);
      });

      it('should handle low ease factor', () => {
        const interval = calculateNextInterval(10, 1.3, 5, 'good', 'review');
        expect(interval).toBe(13); // 10 * 1.3 = 13
      });

      it('should handle interval of 0', () => {
        const interval = calculateNextInterval(0, 2.5, 0, 'good', 'learning');
        expect(interval).toBe(1);
      });
    });
  });

  describe('getLearningSteps', () => {
    it('should return two learning steps', () => {
      const steps = getLearningSteps();
      expect(steps).toHaveLength(2);
    });

    it('should have 10 minutes as first step', () => {
      const steps = getLearningSteps();
      expect(steps[0]).toEqual({
        step: 0,
        interval: 10,
        unit: 'minutes',
      });
    });

    it('should have 1 day as second step', () => {
      const steps = getLearningSteps();
      expect(steps[1]).toEqual({
        step: 1,
        interval: 1,
        unit: 'days',
      });
    });
  });

  describe('getGraduatingInterval', () => {
    it('should return 4 days for "easy"', () => {
      expect(getGraduatingInterval('easy')).toBe(4);
    });

    it('should return 1 day for "good"', () => {
      expect(getGraduatingInterval('good')).toBe(1);
    });

    it('should return 1 day for "hard"', () => {
      expect(getGraduatingInterval('hard')).toBe(1);
    });

    it('should return 1 day for "again"', () => {
      expect(getGraduatingInterval('again')).toBe(1);
    });
  });

  describe('calculateNextReviewDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-08T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should add 10 minutes for interval 0', () => {
      const current = new Date('2025-11-08T12:00:00.000Z');
      const result = calculateNextReviewDate(current, 0);
      const expected = new Date('2025-11-08T12:10:00.000Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should add 1 day for interval 1', () => {
      const current = new Date('2025-11-08T12:00:00.000Z');
      const result = calculateNextReviewDate(current, 1);
      const expected = new Date('2025-11-09T12:00:00.000Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should add 7 days for interval 7', () => {
      const current = new Date('2025-11-08T12:00:00.000Z');
      const result = calculateNextReviewDate(current, 7);
      const expected = new Date('2025-11-15T12:00:00.000Z');
      expect(result.getTime()).toBe(expected.getTime());
    });

    it('should handle large intervals', () => {
      const current = new Date('2025-11-08T12:00:00.000Z');
      const result = calculateNextReviewDate(current, 365);
      const expected = new Date('2026-11-08T12:00:00.000Z');
      expect(result.getTime()).toBe(expected.getTime());
    });
  });

  describe('isCardDue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-08T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for null due date (never reviewed)', () => {
      expect(isCardDue(null)).toBe(true);
    });

    it('should return true for yesterday', () => {
      const yesterday = new Date('2025-11-07T10:00:00.000Z');
      expect(isCardDue(yesterday)).toBe(true);
    });

    it('should return true for today (different time)', () => {
      const today = new Date('2025-11-08T08:00:00.000Z');
      expect(isCardDue(today)).toBe(true);
    });

    it('should return false for tomorrow', () => {
      const tomorrow = new Date('2025-11-09T10:00:00.000Z');
      expect(isCardDue(tomorrow)).toBe(false);
    });

    it('should return false for future dates', () => {
      const future = new Date('2025-12-01T10:00:00.000Z');
      expect(isCardDue(future)).toBe(false);
    });

    it('should handle custom current date parameter', () => {
      const dueDate = new Date('2025-11-10T12:00:00.000Z');
      const checkDate = new Date('2025-11-11T12:00:00.000Z');
      expect(isCardDue(dueDate, checkDate)).toBe(true);
    });

    it('should normalize to midnight for consistent comparison', () => {
      const dueMorning = new Date('2025-11-08T06:00:00.000Z');
      const dueEvening = new Date('2025-11-08T20:00:00.000Z');
      expect(isCardDue(dueMorning)).toBe(true);
      expect(isCardDue(dueEvening)).toBe(true);
    });
  });

  describe('processCardReview - State Transitions', () => {
    describe('New card transitions', () => {
      it('should transition new → learning on "again"', () => {
        const srData = createSRData({ state: 'new' });
        const result = processCardReview(srData, 'again');

        expect(result.state).toBe('learning');
        expect(result.interval).toBe(0); // 10 minutes
        expect(result.step).toBe(0);
        expect(result.repetitions).toBe(0);
      });

      it('should transition new → learning on "hard"', () => {
        const srData = createSRData({ state: 'new' });
        const result = processCardReview(srData, 'hard');

        expect(result.state).toBe('learning');
        expect(result.interval).toBe(0);
      });

      it('should transition new → review on "good" (graduate)', () => {
        const srData = createSRData({ state: 'new' });
        const result = processCardReview(srData, 'good');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(1); // 1 day
        expect(result.step).toBe(2); // Graduated
        expect(result.repetitions).toBe(1);
      });

      it('should transition new → review on "easy" (graduate fast)', () => {
        const srData = createSRData({ state: 'new' });
        const result = processCardReview(srData, 'easy');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(4); // 4 days
        expect(result.step).toBe(2);
        expect(result.repetitions).toBe(1);
      });
    });

    describe('Learning state transitions', () => {
      it('should reset to step 0 on "again"', () => {
        const srData = createSRData({ state: 'learning', step: 1 });
        const result = processCardReview(srData, 'again');

        expect(result.state).toBe('learning');
        expect(result.interval).toBe(0);
        expect(result.step).toBe(0);
        expect(result.repetitions).toBe(0);
      });

      it('should stay in learning on "hard"', () => {
        const srData = createSRData({ state: 'learning', step: 0 });
        const result = processCardReview(srData, 'hard');

        expect(result.state).toBe('learning');
        expect(result.interval).toBe(1); // 1 day
        expect(result.step).toBe(1);
      });

      it('should graduate to review on "good"', () => {
        const srData = createSRData({ state: 'learning', step: 1 });
        const result = processCardReview(srData, 'good');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(1);
        expect(result.step).toBe(2);
        expect(result.repetitions).toBe(1);
      });

      it('should graduate to review on "easy"', () => {
        const srData = createSRData({ state: 'learning', step: 0 });
        const result = processCardReview(srData, 'easy');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(4);
      });
    });

    describe('Review state transitions', () => {
      it('should transition review → relearning on "again"', () => {
        const srData = createSRData({ state: 'review', interval: 10, repetitions: 5 });
        const result = processCardReview(srData, 'again');

        expect(result.state).toBe('relearning');
        expect(result.interval).toBe(0);
        expect(result.step).toBe(0);
        expect(result.repetitions).toBe(0);
      });

      it('should stay in review and increase interval on "hard"', () => {
        const srData = createSRData({ state: 'review', interval: 10, repetitions: 3 });
        const result = processCardReview(srData, 'hard');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(12); // 10 * 1.2
        expect(result.repetitions).toBe(4);
      });

      it('should stay in review and increase interval on "good"', () => {
        const srData = createSRData({
          state: 'review',
          interval: 10,
          easeFactor: 2.5,
          repetitions: 3,
        });
        const result = processCardReview(srData, 'good');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(25); // 10 * 2.5
        expect(result.repetitions).toBe(4);
      });

      it('should stay in review and increase interval on "easy"', () => {
        const srData = createSRData({
          state: 'review',
          interval: 10,
          easeFactor: 2.5,
          repetitions: 3,
        });
        const result = processCardReview(srData, 'easy');

        expect(result.interval).toBe(33); // 10 * 2.5 * 1.3
      });

      it('should transition to mastered when criteria met', () => {
        const srData = createSRData({
          state: 'review',
          interval: 21,
          reviewCount: 4,
          successCount: 4,
          successRate: 100,
          repetitions: 5,
        });
        const result = processCardReview(srData, 'good');

        expect(result.state).toBe('mastered');
      });
    });

    describe('Relearning state transitions', () => {
      it('should stay in relearning on "again"', () => {
        const srData = createSRData({ state: 'relearning', step: 1 });
        const result = processCardReview(srData, 'again');

        expect(result.state).toBe('relearning');
        expect(result.interval).toBe(0);
        expect(result.step).toBe(0);
      });

      it('should graduate to review on "good"', () => {
        const srData = createSRData({ state: 'relearning', step: 1 });
        const result = processCardReview(srData, 'good');

        expect(result.state).toBe('review');
        expect(result.interval).toBe(1);
      });
    });

    describe('Mastered state transitions', () => {
      it('should transition mastered → relearning on "again"', () => {
        const srData = createSRData({ state: 'mastered', interval: 30, repetitions: 10 });
        const result = processCardReview(srData, 'again');

        expect(result.state).toBe('relearning');
        expect(result.interval).toBe(0);
        expect(result.repetitions).toBe(0);
      });

      it('should stay mastered and increase interval on "good"', () => {
        const srData = createSRData({
          state: 'mastered',
          interval: 30,
          easeFactor: 2.5,
          reviewCount: 10,
          successCount: 9,
          successRate: 90,
        });
        const result = processCardReview(srData, 'good');

        expect(result.state).toBe('mastered');
        expect(result.interval).toBe(75); // 30 * 2.5
      });
    });
  });

  describe('processCardReview - Statistics', () => {
    it('should increment review count', () => {
      const srData = createSRData({ reviewCount: 5 });
      const result = processCardReview(srData, 'good');

      expect(result.reviewCount).toBe(6);
    });

    it('should increment success count for "good"', () => {
      const srData = createSRData({ successCount: 3 });
      const result = processCardReview(srData, 'good');

      expect(result.successCount).toBe(4);
    });

    it('should increment success count for "easy"', () => {
      const srData = createSRData({ successCount: 3 });
      const result = processCardReview(srData, 'easy');

      expect(result.successCount).toBe(4);
    });

    it('should NOT increment success count for "hard"', () => {
      const srData = createSRData({ successCount: 3 });
      const result = processCardReview(srData, 'hard');

      expect(result.successCount).toBe(3);
    });

    it('should increment failure count for "again"', () => {
      const srData = createSRData({ failureCount: 2 });
      const result = processCardReview(srData, 'again');

      expect(result.failureCount).toBe(3);
    });

    it('should calculate success rate correctly', () => {
      const srData = createSRData({ reviewCount: 9, successCount: 7 });
      const result = processCardReview(srData, 'good');

      expect(result.successRate).toBe(80); // 8/10 = 80%
    });

    it('should update last reviewed timestamp', () => {
      const srData = createSRData({ lastReviewed: null });
      const result = processCardReview(srData, 'good');

      expect(result.lastReviewed).toBeInstanceOf(Date);
    });

    it('should update due date', () => {
      const srData = createSRData({ dueDate: null });
      const result = processCardReview(srData, 'good');

      expect(result.dueDate).toBeInstanceOf(Date);
    });
  });

  describe('processCardReview - Edge Cases', () => {
    it('should handle first review of new card', () => {
      const srData = createSRData();
      const result = processCardReview(srData, 'good');

      expect(result.reviewCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.successRate).toBe(100);
    });

    it('should handle alternating success/failure pattern', () => {
      let srData = createSRData();

      srData = processCardReview(srData, 'good'); // Success
      expect(srData.repetitions).toBe(1);

      srData = processCardReview(srData, 'again'); // Fail
      expect(srData.repetitions).toBe(0);

      srData = processCardReview(srData, 'good'); // Success
      expect(srData.repetitions).toBe(1);
    });

    it('should handle many consecutive reviews', () => {
      let srData = createSRData({ state: 'review', interval: 1 });

      for (let i = 0; i < 50; i++) {
        srData = processCardReview(srData, 'good');
      }

      expect(srData.reviewCount).toBeGreaterThan(0);
      expect(srData.interval).toBeGreaterThan(0);
      expect(Number.isFinite(srData.interval)).toBe(true);
    });

    it('should preserve ease factor bounds across many reviews', () => {
      let srData = createSRData({ state: 'review', interval: 1 });

      for (let i = 0; i < 20; i++) {
        srData = processCardReview(srData, 'again');
      }

      expect(srData.easeFactor).toBeGreaterThanOrEqual(1.3);
      expect(srData.easeFactor).toBeLessThanOrEqual(2.5);
    });
  });
});
