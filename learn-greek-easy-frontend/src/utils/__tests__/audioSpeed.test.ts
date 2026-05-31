// src/utils/__tests__/audioSpeed.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { AUDIO_SPEED_KEY, getPersistedAudioSpeed, setPersistedAudioSpeed } from '../audioSpeed';

describe('audioSpeed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Key constant ───────────────────────────────────────────────────────────

  it('exports correct key constant', () => {
    expect(AUDIO_SPEED_KEY).toBe('greekly_audio_speed');
  });

  // ── getPersistedAudioSpeed ─────────────────────────────────────────────────

  describe('getPersistedAudioSpeed', () => {
    it('returns 1 when nothing is stored (default)', () => {
      expect(getPersistedAudioSpeed()).toBe(1);
    });

    it('returns 0.75 when stored value is "0.75"', () => {
      localStorage.setItem(AUDIO_SPEED_KEY, '0.75');
      expect(getPersistedAudioSpeed()).toBe(0.75);
    });

    it('returns 1 when stored value is "1"', () => {
      localStorage.setItem(AUDIO_SPEED_KEY, '1');
      expect(getPersistedAudioSpeed()).toBe(1);
    });

    it('returns 1 for any unrecognised stored value (binary guard)', () => {
      localStorage.setItem(AUDIO_SPEED_KEY, '0.5');
      expect(getPersistedAudioSpeed()).toBe(1);
    });

    it('returns 1 and does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError');
      });
      expect(getPersistedAudioSpeed()).toBe(1);
    });

    it('returns 1 when window is undefined (SSR guard)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR
      delete globalThis.window;
      expect(getPersistedAudioSpeed()).toBe(1);
      globalThis.window = originalWindow;
    });
  });

  // ── setPersistedAudioSpeed ─────────────────────────────────────────────────

  describe('setPersistedAudioSpeed', () => {
    it('persists 0.75 to localStorage as string "0.75"', () => {
      setPersistedAudioSpeed(0.75);
      expect(localStorage.getItem(AUDIO_SPEED_KEY)).toBe('0.75');
    });

    it('persists 1 to localStorage as string "1"', () => {
      setPersistedAudioSpeed(1);
      expect(localStorage.getItem(AUDIO_SPEED_KEY)).toBe('1');
    });

    it('does not throw when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('storage full');
      });
      expect(() => setPersistedAudioSpeed(0.75)).not.toThrow();
    });

    it('does not throw when window is undefined (SSR guard)', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating SSR
      delete globalThis.window;
      expect(() => setPersistedAudioSpeed(1)).not.toThrow();
      globalThis.window = originalWindow;
    });
  });
});
