// src/utils/__tests__/practiceSettings.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  INPUT_MODE_KEY,
  SHOW_STREAK_KEY,
  getPersistedInputMode,
  setPersistedInputMode,
  getPersistedShowStreak,
  setPersistedShowStreak,
} from '../practiceSettings';

describe('practiceSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Key constants ──────────────────────────────────────────────────────────

  it('exports correct key constants', () => {
    expect(INPUT_MODE_KEY).toBe('greekly_practice_input_mode');
    expect(SHOW_STREAK_KEY).toBe('greekly_practice_show_streak');
  });

  // ── inputMode ─────────────────────────────────────────────────────────────
  // Type-mode toggle removed (PRACT2-2-05): getPersistedInputMode always
  // returns 'reveal' regardless of any stored value.

  describe('getPersistedInputMode', () => {
    it('always returns reveal (toggle removed, type mode unreachable)', () => {
      expect(getPersistedInputMode()).toBe('reveal');
    });

    it('returns reveal even when localStorage contains "type"', () => {
      localStorage.setItem(INPUT_MODE_KEY, 'type');
      expect(getPersistedInputMode()).toBe('reveal');
    });
  });

  describe('setPersistedInputMode', () => {
    it('persists "type" to localStorage', () => {
      setPersistedInputMode('type');
      expect(localStorage.getItem(INPUT_MODE_KEY)).toBe('type');
    });

    it('persists "reveal" to localStorage', () => {
      setPersistedInputMode('reveal');
      expect(localStorage.getItem(INPUT_MODE_KEY)).toBe('reveal');
    });

    it('does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('storage full');
      });
      expect(() => setPersistedInputMode('type')).not.toThrow();
    });
  });

  // ── showStreak ────────────────────────────────────────────────────────────

  describe('getPersistedShowStreak', () => {
    it('returns true when nothing is stored (default)', () => {
      expect(getPersistedShowStreak()).toBe(true);
    });

    it('returns false when stored value is "false"', () => {
      localStorage.setItem(SHOW_STREAK_KEY, 'false');
      expect(getPersistedShowStreak()).toBe(false);
    });

    it('returns true when stored value is "true"', () => {
      localStorage.setItem(SHOW_STREAK_KEY, 'true');
      expect(getPersistedShowStreak()).toBe(true);
    });

    it('returns true for unknown stored values (safe default)', () => {
      localStorage.setItem(SHOW_STREAK_KEY, 'unknown');
      expect(getPersistedShowStreak()).toBe(true);
    });

    it('returns true and does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('storage error');
      });
      expect(getPersistedShowStreak()).toBe(true);
    });
  });

  describe('setPersistedShowStreak', () => {
    it('persists false to localStorage as string "false"', () => {
      setPersistedShowStreak(false);
      expect(localStorage.getItem(SHOW_STREAK_KEY)).toBe('false');
    });

    it('persists true to localStorage as string "true"', () => {
      setPersistedShowStreak(true);
      expect(localStorage.getItem(SHOW_STREAK_KEY)).toBe('true');
    });

    it('does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('storage full');
      });
      expect(() => setPersistedShowStreak(true)).not.toThrow();
    });
  });
});
