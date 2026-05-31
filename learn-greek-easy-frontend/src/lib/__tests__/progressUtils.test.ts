/**
 * Progress Utilities Tests
 * Tests for pure progress math: completion %, mastery rate, time estimates,
 * session stat diffs, review scheduling, and progress validation.
 */

import { describe, it, expect } from 'vitest';

import type { DeckProgress } from '@/types/deck';

import {
  calculateCompletionPercentage,
  calculateMasteryRate,
  estimateTimeRemaining,
  formatTime,
  formatAccuracy,
  calculateSessionStats,
  isStreakMilestone,
  getProgressMessage,
  calculateNextReviewDays,
  validateProgress,
} from '../progressUtils';

/**
 * Build a DeckProgress with sensible defaults; override per test.
 */
function makeProgress(overrides: Partial<DeckProgress> = {}): DeckProgress {
  return {
    deckId: 'deck-1',
    status: 'in-progress',
    cardsTotal: 0,
    cardsNew: 0,
    cardsLearning: 0,
    cardsReview: 0,
    cardsMastered: 0,
    dueToday: 0,
    streak: 0,
    totalTimeSpent: 0,
    accuracy: 0,
    ...overrides,
  };
}

describe('progressUtils', () => {
  describe('calculateCompletionPercentage', () => {
    it('returns 0 when there are no cards (avoids divide-by-zero)', () => {
      expect(calculateCompletionPercentage(makeProgress({ cardsTotal: 0 }))).toBe(0);
    });

    it('counts learning + mastered as in-progress (50% of total)', () => {
      const progress = makeProgress({
        cardsTotal: 10,
        cardsLearning: 3,
        cardsMastered: 2,
        cardsNew: 5,
      });
      expect(calculateCompletionPercentage(progress)).toBe(50);
    });

    it('returns 100 when all cards are mastered', () => {
      const progress = makeProgress({ cardsTotal: 4, cardsMastered: 4 });
      expect(calculateCompletionPercentage(progress)).toBe(100);
    });

    it('rounds to the nearest whole percent', () => {
      // 1 of 3 in progress -> 33.33 -> 33
      const progress = makeProgress({ cardsTotal: 3, cardsLearning: 1 });
      expect(calculateCompletionPercentage(progress)).toBe(33);
    });
  });

  describe('calculateMasteryRate', () => {
    it('returns 0 when there are no cards', () => {
      expect(calculateMasteryRate(makeProgress({ cardsTotal: 0 }))).toBe(0);
    });

    it('computes mastered / total as a rounded percentage', () => {
      const progress = makeProgress({ cardsTotal: 8, cardsMastered: 2 });
      expect(calculateMasteryRate(progress)).toBe(25);
    });

    it('ignores learning cards (only mastered count)', () => {
      const progress = makeProgress({ cardsTotal: 10, cardsLearning: 5, cardsMastered: 1 });
      expect(calculateMasteryRate(progress)).toBe(10);
    });
  });

  describe('estimateTimeRemaining', () => {
    it('returns 2 minutes per un-mastered card', () => {
      const progress = makeProgress({ cardsTotal: 10, cardsMastered: 4 });
      expect(estimateTimeRemaining(progress)).toBe(12);
    });

    it('returns 0 when all cards are mastered', () => {
      const progress = makeProgress({ cardsTotal: 5, cardsMastered: 5 });
      expect(estimateTimeRemaining(progress)).toBe(0);
    });

    it('never goes negative when mastered exceeds total', () => {
      const progress = makeProgress({ cardsTotal: 3, cardsMastered: 5 });
      expect(estimateTimeRemaining(progress)).toBe(0);
    });
  });

  describe('formatTime', () => {
    it('returns "0m" for zero minutes', () => {
      expect(formatTime(0)).toBe('0m');
    });

    it('formats minutes only when under an hour', () => {
      expect(formatTime(45)).toBe('45m');
    });

    it('formats whole hours without minutes', () => {
      expect(formatTime(120)).toBe('2h');
    });

    it('formats hours and minutes together', () => {
      expect(formatTime(90)).toBe('1h 30m');
    });
  });

  describe('formatAccuracy', () => {
    it('rounds and appends a percent sign', () => {
      expect(formatAccuracy(85.4)).toBe('85%');
      expect(formatAccuracy(85.6)).toBe('86%');
    });

    it('formats 100 correctly', () => {
      expect(formatAccuracy(100)).toBe('100%');
    });
  });

  describe('calculateSessionStats', () => {
    it('computes positive diffs for a normal session', () => {
      const before = makeProgress({
        cardsNew: 10,
        cardsLearning: 2,
        cardsMastered: 1,
        totalTimeSpent: 30,
        accuracy: 70,
      });
      const after = makeProgress({
        cardsNew: 7,
        cardsLearning: 4,
        cardsMastered: 2,
        totalTimeSpent: 45,
        accuracy: 75,
      });

      const stats = calculateSessionStats(before, after);

      // newReviewed = (10-7) + (2-4) = 3 + (-2) = 1
      expect(stats.cardsReviewed).toBe(1);
      expect(stats.cardsLearned).toBe(2);
      expect(stats.cardsMastered).toBe(1);
      expect(stats.timeSpent).toBe(15);
      expect(stats.accuracyChange).toBe(5);
    });

    it('clamps card and time counts to never go negative', () => {
      // "after" regressed in every counted dimension; deltas would be negative.
      const before = makeProgress({
        cardsNew: 5,
        cardsLearning: 5,
        cardsMastered: 5,
        totalTimeSpent: 50,
        accuracy: 90,
      });
      const after = makeProgress({
        cardsNew: 8,
        cardsLearning: 2,
        cardsMastered: 1,
        totalTimeSpent: 40,
        accuracy: 60,
      });

      const stats = calculateSessionStats(before, after);

      // cardsReviewed raw = (5-8) + (5-2) = -3 + 3 = 0 -> 0
      expect(stats.cardsReviewed).toBe(0);
      // cardsLearned raw = 2-5 = -3 -> clamped to 0
      expect(stats.cardsLearned).toBe(0);
      // cardsMastered raw = 1-5 = -4 -> clamped to 0
      expect(stats.cardsMastered).toBe(0);
      // timeSpent raw = 40-50 = -10 -> clamped to 0
      expect(stats.timeSpent).toBe(0);
    });

    it('clamps cardsReviewed to 0 when the raw diff is negative', () => {
      const before = makeProgress({ cardsNew: 1, cardsLearning: 1 });
      const after = makeProgress({ cardsNew: 5, cardsLearning: 5 });
      // raw = (1-5) + (1-5) = -8 -> 0
      expect(calculateSessionStats(before, after).cardsReviewed).toBe(0);
    });

    it('allows accuracyChange to be negative (a real regression)', () => {
      const before = makeProgress({ accuracy: 90 });
      const after = makeProgress({ accuracy: 70 });
      expect(calculateSessionStats(before, after).accuracyChange).toBe(-20);
    });
  });

  describe('isStreakMilestone', () => {
    it.each([5, 10, 25, 50, 100])('returns true for milestone day %i', (streak) => {
      expect(isStreakMilestone(makeProgress({ streak }))).toBe(true);
    });

    it.each([0, 1, 4, 6, 99, 101])('returns false for non-milestone day %i', (streak) => {
      expect(isStreakMilestone(makeProgress({ streak }))).toBe(false);
    });
  });

  describe('getProgressMessage', () => {
    it('prompts to start at 0% completion', () => {
      expect(getProgressMessage(makeProgress({ cardsTotal: 0 }))).toBe("Let's get started!");
    });

    it('encourages an early start under 25%', () => {
      // 1 of 10 in progress -> 10%
      const progress = makeProgress({ cardsTotal: 10, cardsLearning: 1 });
      expect(getProgressMessage(progress)).toBe('Great start! Keep going!');
    });

    it('acknowledges progress between 25% and 50%', () => {
      // 3 of 10 -> 30%
      const progress = makeProgress({ cardsTotal: 10, cardsLearning: 3 });
      expect(getProgressMessage(progress)).toBe("You're making great progress!");
    });

    it('flags more than halfway between 50% and 75%', () => {
      // 6 of 10 -> 60%
      const progress = makeProgress({ cardsTotal: 10, cardsLearning: 6 });
      expect(getProgressMessage(progress)).toBe('More than halfway there!');
    });

    it('urges a strong finish between 75% and 100%', () => {
      // 9 of 10 -> 90%
      const progress = makeProgress({ cardsTotal: 10, cardsLearning: 9 });
      expect(getProgressMessage(progress)).toBe('Almost there! Finish strong!');
    });

    it('celebrates a fully completed deck', () => {
      const progress = makeProgress({ cardsTotal: 5, cardsMastered: 5 });
      expect(getProgressMessage(progress)).toBe('Deck completed! Amazing work!');
    });
  });

  describe('calculateNextReviewDays', () => {
    it('returns 0 (review today) when the last answer was incorrect', () => {
      expect(calculateNextReviewDays('new', false)).toBe(0);
      expect(calculateNextReviewDays('learning', false)).toBe(0);
      expect(calculateNextReviewDays('review', false)).toBe(0);
      expect(calculateNextReviewDays('mastered', false)).toBe(0);
    });

    it('schedules new cards for the next day when correct', () => {
      expect(calculateNextReviewDays('new', true)).toBe(1);
    });

    it('schedules learning cards 3 days out when correct', () => {
      expect(calculateNextReviewDays('learning', true)).toBe(3);
    });

    it('schedules review cards 1 week out when correct', () => {
      expect(calculateNextReviewDays('review', true)).toBe(7);
    });

    it('schedules mastered cards 1 month out when correct', () => {
      expect(calculateNextReviewDays('mastered', true)).toBe(30);
    });
  });

  describe('validateProgress', () => {
    it('returns no errors for a consistent progress object', () => {
      const progress = makeProgress({
        cardsTotal: 10,
        cardsNew: 4,
        cardsLearning: 3,
        cardsReview: 2,
        cardsMastered: 1,
        accuracy: 80,
        streak: 5,
        totalTimeSpent: 120,
      });
      expect(validateProgress(progress)).toEqual([]);
    });

    it('flags a card count mismatch', () => {
      const progress = makeProgress({
        cardsTotal: 10,
        cardsNew: 1,
        cardsLearning: 1,
        cardsReview: 1,
        cardsMastered: 1,
      });
      const errors = validateProgress(progress);
      expect(errors).toContain('Card count mismatch: 4 !== 10');
    });

    it('flags accuracy above 100', () => {
      const progress = makeProgress({ accuracy: 150 });
      expect(validateProgress(progress)).toContain('Invalid accuracy: 150');
    });

    it('flags negative accuracy', () => {
      const progress = makeProgress({ accuracy: -5 });
      expect(validateProgress(progress)).toContain('Invalid accuracy: -5');
    });

    it('flags a negative streak', () => {
      const progress = makeProgress({ streak: -1 });
      expect(validateProgress(progress)).toContain('Invalid streak: -1');
    });

    it('flags negative time spent', () => {
      const progress = makeProgress({ totalTimeSpent: -10 });
      expect(validateProgress(progress)).toContain('Invalid time: -10');
    });

    it('accumulates multiple errors at once', () => {
      const progress = makeProgress({
        cardsTotal: 5,
        cardsNew: 1,
        accuracy: 200,
        streak: -3,
        totalTimeSpent: -1,
      });
      // mismatch (1 !== 5), accuracy, streak, time
      expect(validateProgress(progress)).toHaveLength(4);
    });
  });
});
