import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isTourCompleted,
  setTourCompleted,
  resetTourCompleted,
  TOUR_COMPLETED_KEY,
} from '../tourStatus';

describe('tourStatus', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isTourCompleted', () => {
    it('returns false when key is absent', () => {
      expect(isTourCompleted()).toBe(false);
    });

    it('returns true when key is "true"', () => {
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      expect(isTourCompleted()).toBe(true);
    });

    it('returns false on localStorage error', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(isTourCompleted()).toBe(false);
      spy.mockRestore();
    });
  });

  describe('setTourCompleted', () => {
    it('sets key to "true"', () => {
      setTourCompleted();
      expect(localStorage.getItem(TOUR_COMPLETED_KEY)).toBe('true');
    });
  });

  describe('resetTourCompleted', () => {
    it('removes key', () => {
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      resetTourCompleted();
      expect(localStorage.getItem(TOUR_COMPLETED_KEY)).toBeNull();
    });
  });

  describe('SSR guard', () => {
    it('returns false when window is undefined', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR
      delete globalThis.window;
      expect(isTourCompleted()).toBe(false);
      globalThis.window = originalWindow;
    });
  });
});
