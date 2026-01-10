/**
 * Time Format Utilities Tests
 * Tests for time formatting used in study sessions and dashboard
 */

import { describe, it, expect } from 'vitest';

import { formatStudyTime, capAnswerTime, MAX_ANSWER_TIME_SECONDS } from '../timeFormatUtils';

describe('timeFormatUtils', () => {
  describe('formatStudyTime', () => {
    it('should return "0m" for 0 seconds', () => {
      expect(formatStudyTime(0)).toBe('0m');
    });

    it('should format seconds under 60 as seconds', () => {
      expect(formatStudyTime(45)).toBe('45s');
    });

    it('should format exactly 60 seconds as "1m"', () => {
      expect(formatStudyTime(60)).toBe('1m');
    });

    it('should format 45 minutes (2700 seconds) as "45m"', () => {
      expect(formatStudyTime(2700)).toBe('45m');
    });

    it('should format 1 hour (3600 seconds) as "1h"', () => {
      expect(formatStudyTime(3600)).toBe('1h');
    });

    it('should format 5 hours 30 minutes (19800 seconds) as "5h 30m"', () => {
      expect(formatStudyTime(19800)).toBe('5h 30m');
    });

    it('should format 1 day (86400 seconds) as "1d"', () => {
      expect(formatStudyTime(86400)).toBe('1d');
    });

    it('should format 1 day 5 hours (104400 seconds) as "1d 5h"', () => {
      expect(formatStudyTime(104400)).toBe('1d 5h');
    });

    it('should format 3 days 17 hours (320400 seconds) as "3d 17h"', () => {
      // This was the original bug value - large accumulated study time
      expect(formatStudyTime(320400)).toBe('3d 17h');
    });

    it('should handle edge case of 59 seconds', () => {
      expect(formatStudyTime(59)).toBe('59s');
    });

    it('should handle 1 hour exact without minutes', () => {
      expect(formatStudyTime(3600)).toBe('1h');
    });

    it('should handle 1 hour 1 minute', () => {
      expect(formatStudyTime(3660)).toBe('1h 1m');
    });

    it('should handle multiple days without remaining hours', () => {
      expect(formatStudyTime(172800)).toBe('2d'); // 2 days exactly
    });
  });

  describe('capAnswerTime', () => {
    it('should return input if under max', () => {
      expect(capAnswerTime(100)).toBe(100);
    });

    it('should return max if input equals max', () => {
      expect(capAnswerTime(180)).toBe(180);
    });

    it('should cap at max if input exceeds max', () => {
      expect(capAnswerTime(300)).toBe(180);
      expect(capAnswerTime(600)).toBe(180);
    });

    it('should handle 0', () => {
      expect(capAnswerTime(0)).toBe(0);
    });
  });

  describe('MAX_ANSWER_TIME_SECONDS', () => {
    it('should be 180 seconds (3 minutes)', () => {
      expect(MAX_ANSWER_TIME_SECONDS).toBe(180);
    });
  });
});
