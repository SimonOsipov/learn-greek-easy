/**
 * Helper Utilities Tests
 * Tests for formatRelativeDate, formatStudyTime, and calculatePercentage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { formatRelativeDate, formatStudyTime, calculatePercentage } from '../helpers';

// Fix "now" so relative-date assertions are deterministic.
const FIXED_NOW = new Date('2025-06-15T12:00:00.000Z');

describe('helpers', () => {
  describe('formatRelativeDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "Never" for null', () => {
      expect(formatRelativeDate(null)).toBe('Never');
    });

    it('returns "Never" for undefined', () => {
      expect(formatRelativeDate(undefined)).toBe('Never');
    });

    // < 60 seconds → "Just now"
    it('returns "Just now" for 0 seconds ago', () => {
      expect(formatRelativeDate(new Date(FIXED_NOW))).toBe('Just now');
    });

    it('returns "Just now" for 30 seconds ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 30_000);
      expect(formatRelativeDate(date)).toBe('Just now');
    });

    it('returns "Just now" for 59 seconds ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 59_000);
      expect(formatRelativeDate(date)).toBe('Just now');
    });

    // exactly 1 minute → singular
    it('returns "1 minute ago" for exactly 60 seconds ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 60_000);
      expect(formatRelativeDate(date)).toBe('1 minute ago');
    });

    // 2 minutes → plural
    it('returns "2 minutes ago" for 2 minutes ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 2 * 60_000);
      expect(formatRelativeDate(date)).toBe('2 minutes ago');
    });

    // 59 minutes → still in "minutes" bucket
    it('returns "59 minutes ago" for 59 minutes ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 59 * 60_000);
      expect(formatRelativeDate(date)).toBe('59 minutes ago');
    });

    // exactly 1 hour → singular
    it('returns "1 hour ago" for exactly 60 minutes ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 60 * 60_000);
      expect(formatRelativeDate(date)).toBe('1 hour ago');
    });

    // 2 hours → plural
    it('returns "2 hours ago" for 2 hours ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 2 * 60 * 60_000);
      expect(formatRelativeDate(date)).toBe('2 hours ago');
    });

    // 23 hours → still in "hours" bucket
    it('returns "23 hours ago" for 23 hours ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 23 * 60 * 60_000);
      expect(formatRelativeDate(date)).toBe('23 hours ago');
    });

    // exactly 1 day → singular
    it('returns "1 day ago" for exactly 24 hours ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 24 * 60 * 60_000);
      expect(formatRelativeDate(date)).toBe('1 day ago');
    });

    // 2 days → plural
    it('returns "2 days ago" for 2 days ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 2 * 24 * 60 * 60_000);
      expect(formatRelativeDate(date)).toBe('2 days ago');
    });

    // 29 days → still in "days" bucket
    it('returns "29 days ago" for 29 days ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 29 * 24 * 60 * 60_000);
      expect(formatRelativeDate(date)).toBe('29 days ago');
    });

    // >= 30 days → formatted date (Intl.DateTimeFormat)
    it('returns a formatted date string for exactly 30 days ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 30 * 24 * 60 * 60_000);
      const result = formatRelativeDate(date);
      // Should NOT be a relative string
      expect(result).not.toMatch(/ago/);
      expect(result).not.toBe('Just now');
      // Should contain a year
      expect(result).toMatch(/\d{4}/);
    });

    it('returns a formatted date string for 60 days ago', () => {
      const date = new Date(FIXED_NOW.getTime() - 60 * 24 * 60 * 60_000);
      const result = formatRelativeDate(date);
      expect(result).not.toMatch(/ago/);
      expect(result).toMatch(/\d{4}/);
    });

    // Accepts a Date object created from a string (common real-world usage)
    it('handles a Date object that was created from a string', () => {
      const date = new Date('2025-06-15T11:59:30.000Z'); // 30 s before FIXED_NOW
      expect(formatRelativeDate(date)).toBe('Just now');
    });
  });

  describe('formatStudyTime', () => {
    // helpers.ts takes MINUTES (not seconds), unlike timeFormatUtils.ts

    it('returns "0m" for 0 minutes', () => {
      expect(formatStudyTime(0)).toBe('0m');
    });

    it('returns "1m" for 1 minute', () => {
      expect(formatStudyTime(1)).toBe('1m');
    });

    it('returns "59m" for 59 minutes', () => {
      expect(formatStudyTime(59)).toBe('59m');
    });

    it('returns "1h" for exactly 60 minutes', () => {
      expect(formatStudyTime(60)).toBe('1h');
    });

    it('returns "1h 30m" for 90 minutes', () => {
      expect(formatStudyTime(90)).toBe('1h 30m');
    });

    it('returns "2h" for 120 minutes (no remainder)', () => {
      expect(formatStudyTime(120)).toBe('2h');
    });

    it('returns "2h 15m" for 135 minutes', () => {
      expect(formatStudyTime(135)).toBe('2h 15m');
    });
  });

  describe('calculatePercentage', () => {
    it('returns 0 when total is 0 (no divide-by-zero)', () => {
      expect(calculatePercentage(0, 0)).toBe(0);
    });

    it('returns 0 when current is 0', () => {
      expect(calculatePercentage(0, 10)).toBe(0);
    });

    it('returns 100 when current equals total', () => {
      expect(calculatePercentage(10, 10)).toBe(100);
    });

    it('returns 50 for half', () => {
      expect(calculatePercentage(5, 10)).toBe(50);
    });

    // 1/3 rounds to 33
    it('returns 33 for 1/3 (rounds correctly)', () => {
      expect(calculatePercentage(1, 3)).toBe(33);
    });

    it('returns 67 for 2/3 (rounds correctly)', () => {
      expect(calculatePercentage(2, 3)).toBe(67);
    });

    it('returns 25 for 1/4', () => {
      expect(calculatePercentage(1, 4)).toBe(25);
    });
  });
});
