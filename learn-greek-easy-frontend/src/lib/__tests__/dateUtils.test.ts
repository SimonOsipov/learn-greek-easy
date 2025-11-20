/**
 * Date Utilities Tests
 * Tests for date normalization and comparison utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeToMidnight,
  getTodayAtMidnight,
  isCardDueToday,
  parseAndNormalizeDate,
  formatDisplayDate,
  toISOString,
} from '../dateUtils';

describe('dateUtils', () => {
  describe('normalizeToMidnight', () => {
    it('should normalize date to midnight', () => {
      const date = new Date('2025-11-04T14:30:45.123Z');
      const result = normalizeToMidnight(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should normalize ISO string to midnight', () => {
      const result = normalizeToMidnight('2025-11-04T14:30:45.123Z');

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date part when normalizing', () => {
      const date = new Date('2025-11-04T23:59:59.999Z');
      const result = normalizeToMidnight(date);

      // Get date components
      const day = result.getDate();
      const month = result.getMonth();
      const year = result.getFullYear();

      expect(year).toBe(2025);
      expect(month).toBe(10); // November (0-indexed)
      // Day might be 4 or 5 depending on timezone
      expect([4, 5]).toContain(day);
    });
  });

  describe('getTodayAtMidnight', () => {
    it('should return today at midnight', () => {
      const result = getTodayAtMidnight();
      const now = new Date();

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);

      // Should be same date as today
      expect(result.getDate()).toBe(now.getDate());
      expect(result.getMonth()).toBe(now.getMonth());
      expect(result.getFullYear()).toBe(now.getFullYear());
    });
  });

  describe('isCardDueToday', () => {
    beforeEach(() => {
      // Mock current date to 2025-11-04 for consistent tests
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-11-04T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for yesterday date', () => {
      const yesterday = '2025-11-03T14:30:00.000Z';
      expect(isCardDueToday(yesterday)).toBe(true);
    });

    it('should return true for today date', () => {
      const today = '2025-11-04T14:30:00.000Z';
      expect(isCardDueToday(today)).toBe(true);
    });

    it('should return false for tomorrow date', () => {
      const tomorrow = '2025-11-05T10:00:00.000Z';
      expect(isCardDueToday(tomorrow)).toBe(false);
    });

    it('should return true for old dates', () => {
      const oldDate = '2025-10-01T10:00:00.000Z';
      expect(isCardDueToday(oldDate)).toBe(true);
    });
  });

  describe('parseAndNormalizeDate', () => {
    it('should parse ISO string and normalize to midnight', () => {
      const result = parseAndNormalizeDate('2025-11-04T14:30:45.123Z');

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('formatDisplayDate', () => {
    it('should format Date object correctly', () => {
      const date = new Date('2025-11-04T14:30:00.000Z');
      const result = formatDisplayDate(date);

      // Format should be "MMM DD, YYYY" (e.g., "Nov 4, 2025")
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
      expect(result).toContain('2025');
    });

    it('should format ISO string correctly', () => {
      const result = formatDisplayDate('2025-11-04T14:30:00.000Z');

      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
      expect(result).toContain('2025');
    });

    it('should produce consistent format', () => {
      const date = new Date('2025-01-15T12:00:00.000Z');
      const result = formatDisplayDate(date);

      expect(result).toContain('Jan');
      expect(result).toContain('2025');
    });
  });

  describe('toISOString', () => {
    it('should convert Date to ISO string', () => {
      const date = new Date('2025-11-04T14:30:45.123Z');
      const result = toISOString(date);

      expect(result).toBe('2025-11-04T14:30:45.123Z');
      expect(typeof result).toBe('string');
    });

    it('should match native toISOString output', () => {
      const date = new Date('2025-11-04T14:30:45.123Z');
      const result = toISOString(date);
      const expected = date.toISOString();

      expect(result).toBe(expected);
    });
  });
});
