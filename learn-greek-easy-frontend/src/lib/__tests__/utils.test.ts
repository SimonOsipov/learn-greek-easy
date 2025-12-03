/**
 * General Utilities Tests
 *
 * Comprehensive test suite for general utility functions.
 * Tests className merging and debounce functionality.
 *
 * Coverage targets:
 * - cn() - className merging with Tailwind
 * - debounce() - function debouncing with timing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { cn, debounce } from '../utils';

describe('utils', () => {
  describe('cn - className utility', () => {
    it('should merge single class name', () => {
      const result = cn('btn');
      expect(result).toBe('btn');
    });

    it('should merge multiple class names', () => {
      const result = cn('btn', 'btn-primary');
      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
    });

    it('should handle conditional classes (truthy)', () => {
      const isActive = true;
      const result = cn('btn', isActive && 'active');
      expect(result).toContain('active');
    });

    it('should handle conditional classes (falsy)', () => {
      const isActive = false;
      const result = cn('btn', isActive && 'active');
      expect(result).not.toContain('active');
      expect(result).toBe('btn');
    });

    it('should filter out false values', () => {
      const result = cn('btn', false, 'primary');
      expect(result).not.toContain('false');
      expect(result).toContain('btn');
      expect(result).toContain('primary');
    });

    it('should filter out null values', () => {
      const result = cn('btn', null, 'primary');
      expect(result).not.toContain('null');
      expect(result).toContain('btn');
      expect(result).toContain('primary');
    });

    it('should filter out undefined values', () => {
      const result = cn('btn', undefined, 'primary');
      expect(result).not.toContain('undefined');
      expect(result).toContain('btn');
      expect(result).toContain('primary');
    });

    it('should handle empty string', () => {
      const result = cn('btn', '', 'primary');
      expect(result).toContain('btn');
      expect(result).toContain('primary');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['btn', 'btn-primary']);
      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
    });

    it('should handle objects with conditional classes', () => {
      const result = cn({
        btn: true,
        active: true,
        disabled: false,
      });
      expect(result).toContain('btn');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
    });

    it('should merge Tailwind classes correctly (no duplicates)', () => {
      // twMerge should handle Tailwind-specific merging
      const result = cn('px-2', 'px-4');
      // Should only contain one padding class (the latter one)
      expect(result).toBe('px-4');
    });

    it('should handle complex Tailwind class merging', () => {
      const result = cn('text-red-500', 'text-blue-500');
      // Should keep only the last color
      expect(result).toBe('text-blue-500');
    });

    it('should merge multiple different Tailwind utilities', () => {
      const result = cn('p-4', 'm-2', 'bg-blue-500');
      expect(result).toContain('p-4');
      expect(result).toContain('m-2');
      expect(result).toContain('bg-blue-500');
    });

    it('should handle no arguments', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle mixed argument types', () => {
      const result = cn('btn', ['primary', 'large'], { active: true }, false && 'disabled');
      expect(result).toContain('btn');
      expect(result).toContain('primary');
      expect(result).toContain('large');
      expect(result).toContain('active');
      expect(result).not.toContain('disabled');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function execution', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();

      // Should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();

      // Fast-forward time
      vi.advanceTimersByTime(1000);

      // Should be called after delay
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should call function only once for multiple rapid calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(1000);

      // Should only be called once
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on each call', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      vi.advanceTimersByTime(500);

      debouncedFn(); // Reset timer
      vi.advanceTimersByTime(500);

      // Should not have been called yet (timer was reset)
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      // Now it should be called
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('arg1', 'arg2', 123);

      vi.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('should handle different wait times', () => {
      const mockFn1 = vi.fn();
      const mockFn2 = vi.fn();
      const debouncedFn1 = debounce(mockFn1, 500);
      const debouncedFn2 = debounce(mockFn2, 1500);

      debouncedFn1();
      debouncedFn2();

      vi.advanceTimersByTime(500);
      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    it('should handle zero wait time', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 0);

      debouncedFn();

      // Even with 0 wait, should use setTimeout
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple independent debounced functions', () => {
      const mockFn1 = vi.fn();
      const mockFn2 = vi.fn();
      const debouncedFn1 = debounce(mockFn1, 1000);
      const debouncedFn2 = debounce(mockFn2, 1000);

      debouncedFn1('test1');
      debouncedFn2('test2');

      vi.advanceTimersByTime(1000);

      expect(mockFn1).toHaveBeenCalledWith('test1');
      expect(mockFn2).toHaveBeenCalledWith('test2');
    });

    it('should call function with latest arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      vi.advanceTimersByTime(1000);

      // Should be called with latest arguments only
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should handle multiple call cycles', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      // First cycle
      debouncedFn('cycle1');
      vi.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);

      // Second cycle
      debouncedFn('cycle2');
      vi.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Third cycle
      debouncedFn('cycle3');
      vi.advanceTimersByTime(1000);
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not call function if never advanced', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();

      // Don't advance timers
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should handle function that throws error', () => {
      const mockFn = vi.fn(() => {
        throw new Error('Test error');
      });
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();

      expect(() => {
        vi.advanceTimersByTime(1000);
      }).toThrow('Test error');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should call debounced function after delay', () => {
      const mockFn = vi.fn((x: number) => x * 2);
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn(21);

      vi.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(21);
    });
  });

  describe('Edge cases and integration', () => {
    it('should handle cn with all falsy values', () => {
      const result = cn(false, null, undefined, '');
      expect(result).toBe('');
    });

    it('should handle debounce with immediate consecutive calls', () => {
      vi.useFakeTimers();
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      for (let i = 0; i < 100; i++) {
        debouncedFn(i);
      }

      vi.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(99); // Last argument

      vi.useRealTimers();
    });

    it('should handle cn with very long class strings', () => {
      const longClass = 'a '.repeat(1000).trim();
      const result = cn(longClass);
      expect(result).toContain('a');
    });

    it('should handle debounce with very short wait times', () => {
      vi.useFakeTimers();
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1);

      debouncedFn();
      vi.advanceTimersByTime(1);

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should handle debounce with very long wait times', () => {
      vi.useFakeTimers();
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100000);

      debouncedFn();
      vi.advanceTimersByTime(99999);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });
});
