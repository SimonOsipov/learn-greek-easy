/**
 * useAudioTimeMs Hook Tests
 *
 * Tests for the rAF-based audio time tracking hook.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAudioTimeMs } from '../useAudioTimeMs';

// ---------------------------------------------------------------------------
// rAF / cAF stubs
// ---------------------------------------------------------------------------

type RafCallback = (time: number) => void;

let rafCallbacks: Map<number, RafCallback>;
let rafNextId: number;
let rafSpy: ReturnType<typeof vi.spyOn>;
let cafSpy: ReturnType<typeof vi.spyOn>;

function setupRafStubs() {
  rafCallbacks = new Map();
  rafNextId = 1;

  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: RafCallback) => {
    const id = rafNextId++;
    rafCallbacks.set(id, cb);
    return id;
  });

  cafSpy = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id: number) => {
    rafCallbacks.delete(id);
  });
}

/** Flush one frame — fires all currently-queued rAF callbacks. */
function flushRaf(time = 0) {
  // Copy the entries so that callbacks added during flush (re-queue) don't run
  // in the same flush cycle.
  const entries = Array.from(rafCallbacks.entries());
  for (const [id, cb] of entries) {
    rafCallbacks.delete(id);
    cb(time);
  }
}

// ---------------------------------------------------------------------------
// MutationObserver stub
// ---------------------------------------------------------------------------

type MoCallback = MutationCallback;

let capturedMoCallback: MoCallback | null = null;
let capturedMoTarget: Node | null = null;
let moDisconnect: ReturnType<typeof vi.fn>;
let moObserve: ReturnType<typeof vi.fn>;

function setupMutationObserverStub() {
  capturedMoCallback = null;
  capturedMoTarget = null;
  moDisconnect = vi.fn();
  moObserve = vi.fn().mockImplementation((target: Node) => {
    capturedMoTarget = target;
  });

  vi.stubGlobal(
    'MutationObserver',
    vi.fn().mockImplementation((cb: MoCallback) => {
      capturedMoCallback = cb;
      return { observe: moObserve, disconnect: moDisconnect };
    })
  );
}

// ---------------------------------------------------------------------------
// Audio element helper
// ---------------------------------------------------------------------------

type AudioEventHandler = (e?: Event) => void;

function createMockAudio(initialCurrentTime = 0, paused = true) {
  const listeners: Record<string, AudioEventHandler[]> = {};
  const audio = {
    currentTime: initialCurrentTime,
    paused,
    addEventListener: vi.fn((event: string, handler: AudioEventHandler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: AudioEventHandler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    __emit: (event: string) => {
      listeners[event]?.forEach((h) => h());
    },
    __listeners: listeners,
  };
  return audio;
}

function appendAudioToContainer(container: HTMLElement, audio: ReturnType<typeof createMockAudio>) {
  const el = document.createElement('audio');
  el.setAttribute('data-testid', 'waveform-audio-element');
  // Override properties on the element itself
  Object.defineProperty(el, 'currentTime', {
    get: () => audio.currentTime,
    set: (v) => {
      audio.currentTime = v;
    },
    configurable: true,
  });
  Object.defineProperty(el, 'paused', {
    get: () => audio.paused,
    configurable: true,
  });
  // Patch addEventListener/removeEventListener on the element to delegate to audio stub
  el.addEventListener = audio.addEventListener as unknown as typeof el.addEventListener;
  el.removeEventListener = audio.removeEventListener as unknown as typeof el.removeEventListener;
  container.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('useAudioTimeMs', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setupRafStubs();
    setupMutationObserverStub();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('returns 0 when disabled (no container)', () => {
      const { result } = renderHook(() => useAudioTimeMs(null, false));
      expect(result.current).toBe(0);
    });

    it('returns 0 when enabled but no container provided', () => {
      const { result } = renderHook(() => useAudioTimeMs(null, true));
      expect(result.current).toBe(0);
      // No rAF should have been scheduled
      expect(rafCallbacks.size).toBe(0);
    });

    it('returns 0 when enabled and container present but no audio element found', () => {
      const { result } = renderHook(() => useAudioTimeMs(container, true));
      expect(result.current).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // enabled -> false resets to 0
  // -------------------------------------------------------------------------

  describe('enabled -> false resets time to 0', () => {
    it('resets to 0 immediately when enabled switches to false', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useAudioTimeMs(container, enabled),
        { initialProps: { enabled: true } }
      );

      // Simulate audio play event so the rAF loop starts
      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      // Tick with 100 ms advance
      audio.currentTime = 0.1;
      act(() => {
        flushRaf();
      });

      expect(result.current).toBe(100);

      // Disable
      rerender({ enabled: false });

      expect(result.current).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // rAF loop fires and respects the 10 ms dead-band threshold
  // -------------------------------------------------------------------------

  describe('10 ms dead-band threshold', () => {
    it('does NOT update state when delta <= 10 ms', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { result } = renderHook(() => useAudioTimeMs(container, true));

      // Start playing
      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      // Tick with currentTime = 0.005 s = 5 ms (delta 5 ms, below threshold)
      audio.currentTime = 0.005;
      act(() => {
        flushRaf();
      });

      expect(result.current).toBe(0); // state not updated — delta too small
    });

    it('DOES update state when delta > 10 ms', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { result } = renderHook(() => useAudioTimeMs(container, true));

      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      // Tick with currentTime = 0.1 s = 100 ms (delta 100 ms, above threshold)
      audio.currentTime = 0.1;
      act(() => {
        flushRaf();
      });

      expect(result.current).toBe(100);
    });

    it('does not update when successive ticks are within 10 ms of each other', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { result } = renderHook(() => useAudioTimeMs(container, true));

      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      // First significant update
      audio.currentTime = 0.1; // 100 ms
      act(() => {
        flushRaf();
      });
      expect(result.current).toBe(100);

      // Next tick advances only 5 ms — should NOT trigger update
      audio.currentTime = 0.105; // 105 ms — delta 5 ms from lastUpdateMs=100
      act(() => {
        flushRaf();
      });
      expect(result.current).toBe(100); // unchanged
    });

    it('updates again once delta exceeds 10 ms after the last update', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { result } = renderHook(() => useAudioTimeMs(container, true));

      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      audio.currentTime = 0.1; // 100 ms
      act(() => {
        flushRaf();
      });
      expect(result.current).toBe(100);

      audio.currentTime = 0.115; // 115 ms — delta 15 ms
      act(() => {
        flushRaf();
      });
      expect(result.current).toBe(115);
    });
  });

  // -------------------------------------------------------------------------
  // rAF cancelled on unmount (no leak)
  // -------------------------------------------------------------------------

  describe('cleanup on unmount', () => {
    it('cancels the rAF loop when the hook unmounts', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { unmount } = renderHook(() => useAudioTimeMs(container, true));

      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      // There should be a pending rAF
      expect(rafCallbacks.size).toBeGreaterThan(0);

      unmount();

      // cancelAnimationFrame should have been called
      expect(cafSpy).toHaveBeenCalled();
      // No more pending rAF callbacks after cancel
      expect(rafCallbacks.size).toBe(0);
    });

    it('disconnects MutationObserver on unmount when audio not found initially', () => {
      // Container has NO audio element — so observer will be created
      const { unmount } = renderHook(() => useAudioTimeMs(container, true));

      expect(moObserve).toHaveBeenCalledWith(container, { childList: true, subtree: true });

      unmount();

      expect(moDisconnect).toHaveBeenCalled();
    });

    it('removes audio event listeners on unmount', () => {
      const audio = createMockAudio(0, true);
      appendAudioToContainer(container, audio);

      const { unmount } = renderHook(() => useAudioTimeMs(container, true));

      unmount();

      // All 4 event types should have been removed
      expect(audio.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
      expect(audio.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
      expect(audio.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
      expect(audio.removeEventListener).toHaveBeenCalledWith('seeked', expect.any(Function));
    });
  });

  // -------------------------------------------------------------------------
  // MutationObserver fallback — observer attaches on late mount
  // -------------------------------------------------------------------------

  describe('MutationObserver fallback (late mount)', () => {
    it('sets up MutationObserver when audio element is not present initially', () => {
      // No audio in container yet
      renderHook(() => useAudioTimeMs(container, true));

      expect(moObserve).toHaveBeenCalledWith(container, { childList: true, subtree: true });
    });

    it('attaches to audio and disconnects observer when audio appears later', () => {
      renderHook(() => useAudioTimeMs(container, true));

      expect(capturedMoCallback).not.toBeNull();

      // Now add the audio element to the container
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      // Simulate MutationObserver firing
      act(() => {
        capturedMoCallback!([] as unknown as MutationRecord[], new MutationObserver(() => {}));
      });

      // Observer should be disconnected once audio is found
      expect(moDisconnect).toHaveBeenCalled();

      // The hook should have attached event listeners to the audio element
      expect(audio.addEventListener).toHaveBeenCalledWith('play', expect.any(Function));
    });

    it('does not start rAF loop when audio is paused at late-mount time', () => {
      renderHook(() => useAudioTimeMs(container, true));

      const audio = createMockAudio(0, true); // paused = true
      appendAudioToContainer(container, audio);

      act(() => {
        capturedMoCallback!([] as unknown as MutationRecord[], new MutationObserver(() => {}));
      });

      // Audio is paused — no rAF should be queued
      expect(rafCallbacks.size).toBe(0);
    });

    it('starts rAF loop immediately when audio is already playing at late-mount time', () => {
      renderHook(() => useAudioTimeMs(container, true));

      const audio = createMockAudio(0, false); // playing
      appendAudioToContainer(container, audio);

      act(() => {
        capturedMoCallback!([] as unknown as MutationRecord[], new MutationObserver(() => {}));
      });

      // Audio is playing — rAF should be queued
      expect(rafCallbacks.size).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Audio event reactions
  // -------------------------------------------------------------------------

  describe('audio event reactions', () => {
    it('stops the rAF loop on pause event', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      renderHook(() => useAudioTimeMs(container, true));

      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      expect(rafCallbacks.size).toBeGreaterThan(0);

      act(() => {
        audio.__emit('pause');
      });

      expect(cafSpy).toHaveBeenCalled();
      expect(rafCallbacks.size).toBe(0);
    });

    it('syncs currentTime on seeked event', () => {
      const audio = createMockAudio(0, true);
      appendAudioToContainer(container, audio);

      const { result } = renderHook(() => useAudioTimeMs(container, true));

      audio.currentTime = 2.5; // 2500 ms
      act(() => {
        audio.__emit('seeked');
      });

      expect(result.current).toBe(2500);
    });

    it('stops the rAF loop and syncs time on ended event', () => {
      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      const { result } = renderHook(() => useAudioTimeMs(container, true));

      audio.paused = false;
      act(() => {
        audio.__emit('play');
      });

      audio.currentTime = 5.0; // 5000 ms
      act(() => {
        audio.__emit('ended');
      });

      expect(cafSpy).toHaveBeenCalled();
      expect(rafCallbacks.size).toBe(0);
      expect(result.current).toBe(5000);
    });
  });

  // -------------------------------------------------------------------------
  // Container change (null -> element)
  // -------------------------------------------------------------------------

  describe('container change', () => {
    it('starts tracking when container changes from null to an element with audio', () => {
      const { result, rerender } = renderHook(
        ({ cont }: { cont: HTMLElement | null }) => useAudioTimeMs(cont, true),
        { initialProps: { cont: null } }
      );

      expect(result.current).toBe(0);

      const audio = createMockAudio(0, false);
      appendAudioToContainer(container, audio);

      rerender({ cont: container });

      audio.paused = false;
      audio.currentTime = 0.2; // 200 ms
      act(() => {
        audio.__emit('play');
        flushRaf();
      });

      expect(result.current).toBe(200);
    });
  });
});
