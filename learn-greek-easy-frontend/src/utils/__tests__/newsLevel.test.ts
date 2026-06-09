// src/utils/__tests__/newsLevel.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  NEWS_LEVEL_KEY,
  DEFAULT_NEWS_LEVEL,
  getPersistedNewsLevel,
  setPersistedNewsLevel,
} from '../newsLevel';

describe('newsLevel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Constants ──────────────────────────────────────────────────────────────

  it('exports correct key constant', () => {
    expect(NEWS_LEVEL_KEY).toBe('greekly_news_level');
  });

  it('exports "a2" as the default level', () => {
    expect(DEFAULT_NEWS_LEVEL).toBe('a2');
  });

  // ── getPersistedNewsLevel ──────────────────────────────────────────────────

  describe('getPersistedNewsLevel', () => {
    it('returns "a2" (default) when nothing is stored', () => {
      expect(getPersistedNewsLevel()).toBe('a2');
    });

    it('returns "b1" when "b1" is stored', () => {
      localStorage.setItem(NEWS_LEVEL_KEY, 'b1');
      expect(getPersistedNewsLevel()).toBe('b1');
    });

    it('migrates legacy "b2" to "b1"', () => {
      localStorage.setItem(NEWS_LEVEL_KEY, 'b2');
      expect(getPersistedNewsLevel()).toBe('b1');
    });

    it('returns "a2" when "a2" is stored', () => {
      localStorage.setItem(NEWS_LEVEL_KEY, 'a2');
      expect(getPersistedNewsLevel()).toBe('a2');
    });

    it('returns "a2" for unknown stored values (safe default)', () => {
      localStorage.setItem(NEWS_LEVEL_KEY, 'c1');
      expect(getPersistedNewsLevel()).toBe('a2');
    });

    it('returns "a2" and does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      expect(getPersistedNewsLevel()).toBe('a2');
    });

    it('returns "a2" when window is undefined (SSR guard)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error — simulating SSR
      delete globalThis.window;
      expect(getPersistedNewsLevel()).toBe('a2');
      globalThis.window = originalWindow;
    });
  });

  // ── setPersistedNewsLevel ──────────────────────────────────────────────────

  describe('setPersistedNewsLevel', () => {
    it('persists "b1" to localStorage', () => {
      setPersistedNewsLevel('b1');
      expect(localStorage.getItem(NEWS_LEVEL_KEY)).toBe('b1');
    });

    it('persists "a2" to localStorage', () => {
      setPersistedNewsLevel('a2');
      expect(localStorage.getItem(NEWS_LEVEL_KEY)).toBe('a2');
    });

    it('does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('storage full');
      });
      expect(() => setPersistedNewsLevel('b1')).not.toThrow();
    });

    it('does nothing when window is undefined (SSR guard)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error — simulating SSR
      delete globalThis.window;
      expect(() => setPersistedNewsLevel('b1')).not.toThrow();
      globalThis.window = originalWindow;
    });
  });
});
