/**
 * useAudioPlayer Hook Tests
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAudioPlayer } from '../useAudioPlayer';

// --- Mock Audio Setup ---

type AudioEventHandler = () => void;

function createMockAudio() {
  const listeners: Record<string, AudioEventHandler[]> = {};
  return {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    addEventListener: vi.fn((event: string, handler: AudioEventHandler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn(),
    currentTime: 0,
    playbackRate: 1,
    __listeners: listeners,
    __emit: (event: string) => {
      listeners[event]?.forEach((h) => h());
    },
  };
}

let mockAudioInstance: ReturnType<typeof createMockAudio>;

beforeEach(() => {
  mockAudioInstance = createMockAudio();
  vi.stubGlobal(
    'Audio',
    vi.fn(() => mockAudioInstance)
  );
  vi.clearAllMocks();
  localStorage.clear();
});

// --- Tests ---

describe('useAudioPlayer Hook', () => {
  describe('Initial state', () => {
    it('returns initial state { isPlaying: false, isLoading: false, error: null }', () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('play()', () => {
    it('is a no-op when audioUrl is null', async () => {
      const { result } = renderHook(() => useAudioPlayer(null));

      await act(async () => {
        result.current.play();
      });

      expect(globalThis.Audio).not.toHaveBeenCalled();
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('is a no-op when audioUrl is undefined', async () => {
      const { result } = renderHook(() => useAudioPlayer(undefined));

      await act(async () => {
        result.current.play();
      });

      expect(globalThis.Audio).not.toHaveBeenCalled();
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('sets isLoading then isPlaying after promise resolves', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('resets error to null when called after a previous error', async () => {
      mockAudioInstance.play.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(result.current.error).toBe('Network error');

      mockAudioInstance.play.mockResolvedValueOnce(undefined);

      await act(async () => {
        result.current.play();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.isPlaying).toBe(true);
    });
  });

  describe('pause()', () => {
    it('sets isPlaying to false and calls audio.pause()', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });
  });

  describe('toggle()', () => {
    it('calls play when not playing', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.toggle();
      });

      expect(result.current.isPlaying).toBe(true);
      expect(mockAudioInstance.play).toHaveBeenCalled();
    });

    it('calls pause when playing', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.toggle();
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('sets error string and isLoading to false on play failure', async () => {
      mockAudioInstance.play.mockRejectedValueOnce(new Error('Audio playback failed'));

      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(result.current.error).toBe('Audio playback failed');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('ended event', () => {
    it('resets isPlaying to false when audio ends naturally', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        mockAudioInstance.__emit('ended');
      });

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('URL change', () => {
    it('pauses current playback and resets all state when audioUrl changes', async () => {
      const { result, rerender } = renderHook(({ url }) => useAudioPlayer(url), {
        initialProps: {
          url: 'https://example.com/audio1.mp3' as string | null,
        },
      });

      await act(async () => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);

      rerender({ url: 'https://example.com/audio2.mp3' });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });
  });

  describe('Unmount cleanup', () => {
    it('pauses audio on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      unmount();

      expect(mockAudioInstance.pause).toHaveBeenCalled();
    });
  });

  describe('Function reference stability', () => {
    it('play, pause, and toggle are stable across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        useAudioPlayer('https://example.com/audio.mp3')
      );

      const firstRender = {
        play: result.current.play,
        pause: result.current.pause,
        toggle: result.current.toggle,
      };

      rerender();

      expect(result.current.play).toBe(firstRender.play);
      expect(result.current.pause).toBe(firstRender.pause);
      expect(result.current.toggle).toBe(firstRender.toggle);
    });
  });

  describe('speed / setSpeed', () => {
    it('1. default speed is 1 when localStorage is empty', () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));
      expect(result.current.speed).toBe(1);
    });

    it('2. reads persisted 0.75 from localStorage', () => {
      localStorage.setItem('greekly_audio_speed', '0.75');
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));
      expect(result.current.speed).toBe(0.75);
    });

    it('3. treats "1.25" in localStorage as 1', () => {
      localStorage.setItem('greekly_audio_speed', '1.25');
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));
      expect(result.current.speed).toBe(1);
    });

    it('4. treats "abc" in localStorage as 1', () => {
      localStorage.setItem('greekly_audio_speed', 'abc');
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));
      expect(result.current.speed).toBe(1);
    });

    it('5. persists speed to localStorage on setSpeed', () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      act(() => {
        result.current.setSpeed(0.75);
      });

      expect(localStorage.getItem('greekly_audio_speed')).toBe('0.75');
      expect(result.current.speed).toBe(0.75);
    });

    it('6. applies playbackRate on play()', async () => {
      localStorage.setItem('greekly_audio_speed', '0.75');
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(mockAudioInstance.playbackRate).toBe(0.75);
    });

    it('7. applies playbackRate on toggle() play branch', async () => {
      localStorage.setItem('greekly_audio_speed', '0.75');
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.toggle();
      });

      expect(mockAudioInstance.playbackRate).toBe(0.75);
    });

    it('8. stop-and-replay when setSpeed called during playback', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      await act(async () => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);

      await act(async () => {
        result.current.setSpeed(0.75);
      });

      expect(mockAudioInstance.pause).toHaveBeenCalled();
      expect(mockAudioInstance.currentTime).toBe(0);
      expect(mockAudioInstance.playbackRate).toBe(0.75);
      expect(mockAudioInstance.play).toHaveBeenCalledTimes(2);
    });

    it('9. no playback when setSpeed called while NOT playing', async () => {
      const { result } = renderHook(() => useAudioPlayer('https://example.com/audio.mp3'));

      expect(result.current.isPlaying).toBe(false);

      act(() => {
        result.current.setSpeed(0.75);
      });

      expect(mockAudioInstance.play).not.toHaveBeenCalled();
      expect(result.current.speed).toBe(0.75);
    });

    it('10. speed is maintained after URL change re-creates Audio element', async () => {
      const { result, rerender } = renderHook(({ url }) => useAudioPlayer(url), {
        initialProps: { url: 'https://example.com/audio1.mp3' as string | null },
      });

      act(() => {
        result.current.setSpeed(0.75);
      });

      rerender({ url: 'https://example.com/audio2.mp3' });

      // speed state is maintained
      expect(result.current.speed).toBe(0.75);

      // new audio element gets the correct playbackRate on next play
      mockAudioInstance = createMockAudio();
      vi.stubGlobal(
        'Audio',
        vi.fn(() => mockAudioInstance)
      );

      await act(async () => {
        result.current.play();
      });

      expect(mockAudioInstance.playbackRate).toBe(0.75);
    });
  });
});
