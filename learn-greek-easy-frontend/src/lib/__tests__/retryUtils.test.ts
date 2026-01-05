/**
 * Retry Utilities Tests
 *
 * Tests for the retry utility functions used in API error handling.
 * Verifies exponential backoff calculation, status code checking, and delay behavior.
 *
 * Coverage targets:
 * - TRANSIENT_ERROR_CODES constant values
 * - DEFAULT_RETRY_CONFIG default values
 * - isRetryableStatusCode() status code checking
 * - calculateBackoffDelay() exponential backoff with jitter
 * - sleep() delay behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  TRANSIENT_ERROR_CODES,
  DEFAULT_RETRY_CONFIG,
  isRetryableStatusCode,
  calculateBackoffDelay,
  sleep,
} from '../retryUtils';

describe('retryUtils', () => {
  describe('TRANSIENT_ERROR_CODES', () => {
    it('should contain 502 Bad Gateway', () => {
      expect(TRANSIENT_ERROR_CODES).toContain(502);
    });

    it('should contain 503 Service Unavailable', () => {
      expect(TRANSIENT_ERROR_CODES).toContain(503);
    });

    it('should contain 504 Gateway Timeout', () => {
      expect(TRANSIENT_ERROR_CODES).toContain(504);
    });

    it('should only contain exactly three status codes', () => {
      expect(TRANSIENT_ERROR_CODES).toHaveLength(3);
    });

    it('should not contain other common error codes', () => {
      expect(TRANSIENT_ERROR_CODES).not.toContain(400);
      expect(TRANSIENT_ERROR_CODES).not.toContain(401);
      expect(TRANSIENT_ERROR_CODES).not.toContain(404);
      expect(TRANSIENT_ERROR_CODES).not.toContain(500);
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have maxRetries of 3', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    });

    it('should have baseDelayMs of 1000', () => {
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
    });

    it('should have maxDelayMs of 10000', () => {
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
    });

    it('should have retryOnStatusCodes matching TRANSIENT_ERROR_CODES', () => {
      expect(DEFAULT_RETRY_CONFIG.retryOnStatusCodes).toEqual(TRANSIENT_ERROR_CODES);
    });
  });

  describe('isRetryableStatusCode', () => {
    it('should return true for 502', () => {
      expect(isRetryableStatusCode(502, TRANSIENT_ERROR_CODES)).toBe(true);
    });

    it('should return true for 503', () => {
      expect(isRetryableStatusCode(503, TRANSIENT_ERROR_CODES)).toBe(true);
    });

    it('should return true for 504', () => {
      expect(isRetryableStatusCode(504, TRANSIENT_ERROR_CODES)).toBe(true);
    });

    it('should return false for 200 OK', () => {
      expect(isRetryableStatusCode(200, TRANSIENT_ERROR_CODES)).toBe(false);
    });

    it('should return false for 400 Bad Request', () => {
      expect(isRetryableStatusCode(400, TRANSIENT_ERROR_CODES)).toBe(false);
    });

    it('should return false for 401 Unauthorized', () => {
      expect(isRetryableStatusCode(401, TRANSIENT_ERROR_CODES)).toBe(false);
    });

    it('should return false for 404 Not Found', () => {
      expect(isRetryableStatusCode(404, TRANSIENT_ERROR_CODES)).toBe(false);
    });

    it('should return false for 500 Internal Server Error', () => {
      expect(isRetryableStatusCode(500, TRANSIENT_ERROR_CODES)).toBe(false);
    });

    it('should work with custom status code arrays', () => {
      const customCodes = [429, 500];
      expect(isRetryableStatusCode(429, customCodes)).toBe(true);
      expect(isRetryableStatusCode(500, customCodes)).toBe(true);
      expect(isRetryableStatusCode(502, customCodes)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isRetryableStatusCode(502, [])).toBe(false);
    });
  });

  describe('calculateBackoffDelay', () => {
    beforeEach(() => {
      // Mock Math.random to return consistent values for testing
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return baseDelay for first attempt (attempt 0) with no jitter', () => {
      // With random = 0, jitter multiplier is 1.0
      const delay = calculateBackoffDelay(0, 1000, 10000);
      expect(delay).toBe(1000);
    });

    it('should return baseDelay * 2 for second attempt (attempt 1)', () => {
      const delay = calculateBackoffDelay(1, 1000, 10000);
      expect(delay).toBe(2000);
    });

    it('should return baseDelay * 4 for third attempt (attempt 2)', () => {
      const delay = calculateBackoffDelay(2, 1000, 10000);
      expect(delay).toBe(4000);
    });

    it('should return baseDelay * 8 for fourth attempt (attempt 3)', () => {
      const delay = calculateBackoffDelay(3, 1000, 10000);
      expect(delay).toBe(8000);
    });

    it('should cap delay at maxDelay', () => {
      // attempt 4 would give baseDelay * 16 = 16000, but capped at 10000
      const delay = calculateBackoffDelay(4, 1000, 10000);
      expect(delay).toBe(10000);
    });

    it('should add jitter when random > 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // With random = 0.5, jitter multiplier is 1.125 (1 + 0.5 * 0.25)
      const delay = calculateBackoffDelay(0, 1000, 10000);
      expect(delay).toBe(1125);
    });

    it('should add maximum jitter when random = 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1);
      // With random = 1, jitter multiplier is 1.25 (1 + 1 * 0.25)
      const delay = calculateBackoffDelay(0, 1000, 10000);
      expect(delay).toBe(1250);
    });

    it('should apply jitter after capping at maxDelay', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.2);
      // attempt 10 would be huge but capped at 10000, then 10000 * 1.05 = 10500
      const delay = calculateBackoffDelay(10, 1000, 10000);
      expect(delay).toBe(10500);
    });

    it('should handle zero baseDelay', () => {
      const delay = calculateBackoffDelay(0, 0, 10000);
      expect(delay).toBe(0);
    });

    it('should handle very small maxDelay', () => {
      const delay = calculateBackoffDelay(5, 1000, 100);
      expect(delay).toBe(100);
    });

    it('should floor the result to avoid fractional milliseconds', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.333);
      const delay = calculateBackoffDelay(0, 1000, 10000);
      expect(Number.isInteger(delay)).toBe(true);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after specified time', async () => {
      const callback = vi.fn();

      const promise = sleep(1000).then(callback);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(999);
      await Promise.resolve(); // Allow microtasks to run
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await promise;
      expect(callback).toHaveBeenCalled();
    });

    it('should resolve immediately for 0ms', async () => {
      const callback = vi.fn();

      const promise = sleep(0).then(callback);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      await promise;
      expect(callback).toHaveBeenCalled();
    });

    it('should handle long delays', async () => {
      const callback = vi.fn();

      const promise = sleep(10000).then(callback);

      vi.advanceTimersByTime(9999);
      await Promise.resolve();
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      await promise;
      expect(callback).toHaveBeenCalled();
    });

    it('should return a promise that resolves to undefined', async () => {
      const promise = sleep(100);

      vi.advanceTimersByTime(100);
      const result = await promise;
      expect(result).toBeUndefined();
    });
  });

  describe('integration - backoff sequence', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should produce correct exponential backoff sequence', () => {
      const config = DEFAULT_RETRY_CONFIG;
      const delays: number[] = [];

      for (let i = 0; i <= config.maxRetries; i++) {
        delays.push(calculateBackoffDelay(i, config.baseDelayMs, config.maxDelayMs));
      }

      // With default config and no jitter:
      // attempt 0: 1000 * 1 = 1000
      // attempt 1: 1000 * 2 = 2000
      // attempt 2: 1000 * 4 = 4000
      // attempt 3: 1000 * 8 = 8000
      expect(delays).toEqual([1000, 2000, 4000, 8000]);
    });

    it('should cap delays in long retry sequences', () => {
      const baseDelay = 1000;
      const maxDelay = 5000;
      const delays: number[] = [];

      for (let i = 0; i < 10; i++) {
        delays.push(calculateBackoffDelay(i, baseDelay, maxDelay));
      }

      // All delays after capping should not exceed maxDelay
      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(maxDelay);
      });

      // First few should follow exponential pattern
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
      expect(delays[2]).toBe(4000);
      expect(delays[3]).toBe(5000); // Capped at maxDelay
      expect(delays[4]).toBe(5000); // Still capped
    });
  });
});
