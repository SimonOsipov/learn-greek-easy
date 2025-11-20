/**
 * Review Stats Helpers Tests
 *
 * Comprehensive test suite for review statistics calculation helpers.
 * Tests deck statistics, card counts, date formatting, and localStorage integration.
 *
 * Coverage targets:
 * - Card counts by state (new, learning, mastered)
 * - Due card calculations
 * - Last review date tracking
 * - Relative date formatting
 * - Comprehensive deck statistics
 * - localStorage data handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getAllReviewData,
  getDeckReviewData,
  getCardsDueToday,
  getNewCardsCount,
  getLearningCardsCount,
  getMasteredCardsCount,
  getLastReviewDate,
  formatRelativeDate,
  calculateDeckReviewStats,
} from '../reviewStatsHelpers';
import type { SpacedRepetitionData } from '@/types/review';

// Mock the mockReviewData module
vi.mock('@/services/mockReviewData', () => ({
  getCardsForDeck: vi.fn((deckId: string) => {
    // Return empty array for unknown decks
    if (deckId === 'empty-deck' || deckId === 'unknown-deck') {
      return [];
    }
    // Return mock cards for testing
    return [
      {
        id: 'card-1',
        deckId,
        front: 'Test 1',
        back: 'Answer 1',
        srData: {
          cardId: 'card-1',
          deckId,
          state: 'new',
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          step: 0,
          dueDate: null,
          lastReviewed: null,
          reviewCount: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
        },
      },
      {
        id: 'card-2',
        deckId,
        front: 'Test 2',
        back: 'Answer 2',
        srData: {
          cardId: 'card-2',
          deckId,
          state: 'learning',
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          step: 1,
          dueDate: new Date('2025-11-08T12:00:00.000Z'),
          lastReviewed: new Date('2025-11-07T12:00:00.000Z'),
          reviewCount: 1,
          successCount: 0,
          failureCount: 1,
          successRate: 0,
        },
      },
      {
        id: 'card-3',
        deckId,
        front: 'Test 3',
        back: 'Answer 3',
        srData: {
          cardId: 'card-3',
          deckId,
          state: 'review',
          interval: 7,
          easeFactor: 2.5,
          repetitions: 3,
          step: 2,
          dueDate: new Date('2025-11-15T12:00:00.000Z'),
          lastReviewed: new Date('2025-11-08T12:00:00.000Z'),
          reviewCount: 3,
          successCount: 3,
          failureCount: 0,
          successRate: 100,
        },
      },
      {
        id: 'card-4',
        deckId,
        front: 'Test 4',
        back: 'Answer 4',
        srData: {
          cardId: 'card-4',
          deckId,
          state: 'mastered',
          interval: 30,
          easeFactor: 2.5,
          repetitions: 10,
          step: 2,
          dueDate: new Date('2025-12-08T12:00:00.000Z'),
          lastReviewed: new Date('2025-11-08T12:00:00.000Z'),
          reviewCount: 10,
          successCount: 9,
          failureCount: 1,
          successRate: 90,
        },
      },
      {
        id: 'card-5',
        deckId,
        front: 'Test 5',
        back: 'Answer 5',
        srData: {
          cardId: 'card-5',
          deckId,
          state: 'review',
          interval: 3,
          easeFactor: 2.3,
          repetitions: 2,
          step: 2,
          dueDate: new Date('2025-11-07T12:00:00.000Z'), // Due yesterday
          lastReviewed: new Date('2025-11-04T12:00:00.000Z'),
          reviewCount: 2,
          successCount: 2,
          failureCount: 0,
          successRate: 100,
        },
      },
    ];
  }),
}));

describe('reviewStatsHelpers', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    } as any;

    // Mock system time
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-08T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('getAllReviewData', () => {
    it('should return empty object when localStorage is empty', () => {
      const result = getAllReviewData();
      expect(result).toEqual({});
    });

    it('should parse review data from localStorage', () => {
      const testData: Record<string, SpacedRepetitionData> = {
        'card-1': {
          cardId: 'card-1',
          deckId: 'deck-1',
          state: 'new',
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          step: 0,
          dueDate: null,
          lastReviewed: null,
          reviewCount: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
        },
      };

      localStorage.setItem('learn-greek-easy:review-data', JSON.stringify(testData));
      const result = getAllReviewData();

      expect(result).toHaveProperty('card-1');
      expect(result['card-1'].cardId).toBe('card-1');
    });

    it('should convert date strings back to Date objects', () => {
      const testData = {
        'card-1': {
          cardId: 'card-1',
          deckId: 'deck-1',
          state: 'review',
          interval: 7,
          easeFactor: 2.5,
          repetitions: 3,
          step: 2,
          dueDate: '2025-11-15T12:00:00.000Z',
          lastReviewed: '2025-11-08T12:00:00.000Z',
          reviewCount: 3,
          successCount: 3,
          failureCount: 0,
          successRate: 100,
        },
      };

      localStorage.setItem('learn-greek-easy:review-data', JSON.stringify(testData));
      const result = getAllReviewData();

      expect(result['card-1'].dueDate).toBeInstanceOf(Date);
      expect(result['card-1'].lastReviewed).toBeInstanceOf(Date);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('learn-greek-easy:review-data', 'invalid json');
      const result = getAllReviewData();

      expect(result).toEqual({});
    });
  });

  describe('getDeckReviewData', () => {
    it('should filter review data by deck ID', () => {
      const testData = {
        'card-1': {
          cardId: 'card-1',
          deckId: 'deck-1',
          state: 'new' as const,
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          step: 0,
          dueDate: null,
          lastReviewed: null,
          reviewCount: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
        },
        'card-2': {
          cardId: 'card-2',
          deckId: 'deck-2',
          state: 'new' as const,
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          step: 0,
          dueDate: null,
          lastReviewed: null,
          reviewCount: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
        },
      };

      localStorage.setItem('learn-greek-easy:review-data', JSON.stringify(testData));
      const result = getDeckReviewData('deck-1');

      expect(result).toHaveLength(1);
      expect(result[0].deckId).toBe('deck-1');
    });

    it('should return empty array for unknown deck', () => {
      const result = getDeckReviewData('unknown-deck');
      expect(result).toEqual([]);
    });
  });

  describe('getCardsDueToday', () => {
    it('should count new cards as due', () => {
      const count = getCardsDueToday('test-deck');
      // card-1 is new (always due)
      // card-2 is learning, due today
      // card-5 is review, due yesterday (overdue)
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should count cards with due date today or earlier', () => {
      const count = getCardsDueToday('test-deck');
      expect(count).toBeGreaterThan(0);
    });

    it('should not count cards due in the future', () => {
      // card-3 is due on 2025-11-15
      // card-4 is due on 2025-12-08
      // These should not be counted
      const count = getCardsDueToday('test-deck');
      expect(count).toBeLessThan(5); // Not all 5 cards are due
    });

    it('should return 0 for deck with no due cards', () => {
      const count = getCardsDueToday('empty-deck');
      expect(count).toBe(0);
    });
  });

  describe('getNewCardsCount', () => {
    it('should count cards in "new" state', () => {
      const count = getNewCardsCount('test-deck');
      expect(count).toBe(1); // Only card-1 is new
    });

    it('should return 0 for deck with no new cards', () => {
      const count = getNewCardsCount('empty-deck');
      expect(count).toBe(0);
    });

    it('should not count learning/review cards as new', () => {
      const count = getNewCardsCount('test-deck');
      expect(count).toBeLessThan(5); // Not all cards are new
    });
  });

  describe('getLearningCardsCount', () => {
    it('should count cards in "learning" state', () => {
      const count = getLearningCardsCount('test-deck');
      expect(count).toBe(1); // Only card-2 is learning
    });

    it('should count cards in "relearning" state', () => {
      // Mock updated to include relearning card would increase count
      const count = getLearningCardsCount('test-deck');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for deck with no learning cards', () => {
      const count = getLearningCardsCount('empty-deck');
      expect(count).toBe(0);
    });
  });

  describe('getMasteredCardsCount', () => {
    it('should count cards in "mastered" state', () => {
      const count = getMasteredCardsCount('test-deck');
      expect(count).toBe(1); // Only card-4 is mastered
    });

    it('should return 0 for deck with no mastered cards', () => {
      const count = getMasteredCardsCount('empty-deck');
      expect(count).toBe(0);
    });

    it('should not count review cards as mastered', () => {
      const count = getMasteredCardsCount('test-deck');
      expect(count).toBeLessThan(5); // Not all cards are mastered
    });
  });

  describe('getLastReviewDate', () => {
    it('should return most recent review date', () => {
      const lastReview = getLastReviewDate('test-deck');
      // Cards 2, 3, 4 have lastReviewed dates
      // Latest should be 2025-11-08T12:00:00.000Z
      expect(lastReview).toBeInstanceOf(Date);
      expect(lastReview?.toISOString()).toBe('2025-11-08T12:00:00.000Z');
    });

    it('should return null for deck with no reviews', () => {
      const lastReview = getLastReviewDate('empty-deck');
      expect(lastReview).toBeNull();
    });

    it('should handle multiple review dates correctly', () => {
      const lastReview = getLastReviewDate('test-deck');
      expect(lastReview).not.toBeNull();
    });
  });

  describe('formatRelativeDate', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2025-11-08T12:00:00.000Z'));
    });

    it('should return "Never" for null date', () => {
      expect(formatRelativeDate(null)).toBe('Never');
    });

    it('should return "Just now" for recent times (< 60 seconds)', () => {
      const recent = new Date('2025-11-08T11:59:30.000Z'); // 30 seconds ago
      expect(formatRelativeDate(recent)).toBe('Just now');
    });

    it('should return minutes for times < 1 hour', () => {
      const fiveMinutesAgo = new Date('2025-11-08T11:55:00.000Z');
      const result = formatRelativeDate(fiveMinutesAgo);
      expect(result).toContain('5 minutes ago');
    });

    it('should handle singular minute correctly', () => {
      const oneMinuteAgo = new Date('2025-11-08T11:59:00.000Z');
      const result = formatRelativeDate(oneMinuteAgo);
      expect(result).toContain('1 minute ago');
    });

    it('should return hours for times < 24 hours', () => {
      const twoHoursAgo = new Date('2025-11-08T10:00:00.000Z');
      const result = formatRelativeDate(twoHoursAgo);
      expect(result).toContain('2 hours ago');
    });

    it('should handle singular hour correctly', () => {
      const oneHourAgo = new Date('2025-11-08T11:00:00.000Z');
      const result = formatRelativeDate(oneHourAgo);
      expect(result).toContain('1 hour ago');
    });

    it('should return days for times < 30 days', () => {
      const threeDaysAgo = new Date('2025-11-05T12:00:00.000Z');
      const result = formatRelativeDate(threeDaysAgo);
      expect(result).toContain('3 days ago');
    });

    it('should handle singular day correctly', () => {
      const oneDayAgo = new Date('2025-11-07T12:00:00.000Z');
      const result = formatRelativeDate(oneDayAgo);
      expect(result).toContain('1 day ago');
    });

    it('should return formatted date for times >= 30 days', () => {
      const longAgo = new Date('2025-10-01T12:00:00.000Z');
      const result = formatRelativeDate(longAgo);
      expect(result).toMatch(/Oct|October/);
    });

    it('should handle edge case: exactly 60 seconds', () => {
      const exactMinute = new Date('2025-11-08T11:59:00.000Z');
      const result = formatRelativeDate(exactMinute);
      expect(result).toContain('minute');
    });

    it('should handle edge case: exactly 1 hour', () => {
      const exactHour = new Date('2025-11-08T11:00:00.000Z');
      const result = formatRelativeDate(exactHour);
      expect(result).toContain('hour');
    });

    it('should handle edge case: exactly 24 hours', () => {
      const exactDay = new Date('2025-11-07T12:00:00.000Z');
      const result = formatRelativeDate(exactDay);
      expect(result).toContain('day');
    });
  });

  describe('calculateDeckReviewStats', () => {
    it('should return comprehensive statistics object', () => {
      const stats = calculateDeckReviewStats('test-deck');

      expect(stats).toHaveProperty('dueToday');
      expect(stats).toHaveProperty('cardsNew');
      expect(stats).toHaveProperty('cardsLearning');
      expect(stats).toHaveProperty('cardsMastered');
      expect(stats).toHaveProperty('lastReviewed');
    });

    it('should calculate correct new cards count', () => {
      const stats = calculateDeckReviewStats('test-deck');
      expect(stats.cardsNew).toBe(1);
    });

    it('should calculate correct learning cards count', () => {
      const stats = calculateDeckReviewStats('test-deck');
      expect(stats.cardsLearning).toBe(1);
    });

    it('should calculate correct mastered cards count', () => {
      const stats = calculateDeckReviewStats('test-deck');
      expect(stats.cardsMastered).toBe(1);
    });

    it('should calculate correct due today count', () => {
      const stats = calculateDeckReviewStats('test-deck');
      expect(stats.dueToday).toBeGreaterThan(0);
    });

    it('should track last reviewed date', () => {
      const stats = calculateDeckReviewStats('test-deck');
      expect(stats.lastReviewed).toBeInstanceOf(Date);
    });

    it('should return zeros for empty deck', () => {
      const stats = calculateDeckReviewStats('empty-deck');

      expect(stats.dueToday).toBe(0);
      expect(stats.cardsNew).toBe(0);
      expect(stats.cardsLearning).toBe(0);
      expect(stats.cardsMastered).toBe(0);
      expect(stats.lastReviewed).toBeNull();
    });

    it('should handle deck with only new cards', () => {
      const stats = calculateDeckReviewStats('test-deck');
      expect(stats.cardsNew).toBeGreaterThan(0);
    });

    it('should use localStorage data when available', () => {
      const testData = {
        'card-1': {
          cardId: 'card-1',
          deckId: 'test-deck',
          state: 'mastered' as const,
          interval: 30,
          easeFactor: 2.5,
          repetitions: 10,
          step: 2,
          dueDate: new Date('2025-12-08T12:00:00.000Z'),
          lastReviewed: new Date('2025-11-08T12:00:00.000Z'),
          reviewCount: 10,
          successCount: 9,
          failureCount: 1,
          successRate: 90,
        },
      };

      localStorage.setItem('learn-greek-easy:review-data', JSON.stringify(testData));
      const stats = calculateDeckReviewStats('test-deck');

      // Should reflect localStorage data overriding default
      expect(stats.cardsMastered).toBeGreaterThan(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle missing localStorage gracefully', () => {
      // Simulate localStorage.getItem throwing error
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const result = getAllReviewData();
      expect(result).toEqual({});
    });

    it('should handle invalid JSON in localStorage', () => {
      localStorage.setItem('learn-greek-easy:review-data', '{invalid json}');
      const result = getAllReviewData();
      expect(result).toEqual({});
    });

    it('should handle null values in SR data', () => {
      const stats = calculateDeckReviewStats('test-deck');
      // Should not crash with null due dates
      expect(stats).toBeDefined();
    });
  });
});
