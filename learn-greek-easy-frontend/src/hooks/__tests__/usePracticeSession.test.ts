/**
 * usePracticeSession Hook Tests
 *
 * Tests for session lifecycle PostHog tracking hook.
 * Verifies start, complete, and abandon event tracking with deduplication.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import type { UsePracticeSessionOptions } from '../usePracticeSession';
import { usePracticeSession } from '../usePracticeSession';

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

import posthog from 'posthog-js';

const mockCapture = posthog.capture as ReturnType<typeof vi.fn>;

const defaultOptions: UsePracticeSessionOptions = {
  getStartProps: () => ({ deck_id: 'deck-1' }),
  getCompleteProps: (durationSec) => ({ deck_id: 'deck-1', duration_sec: durationSec }),
  getAbandonProps: (durationSec) => ({ deck_id: 'deck-1', duration_sec: durationSec }),
  startEvent: 'session_started',
  completeEvent: 'session_completed',
  abandonEvent: 'session_abandoned',
  isSessionActive: false,
  isSessionComplete: false,
};

describe('usePracticeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks start event when isSessionActive becomes true', () => {
    const { rerender } = renderHook(
      (props: UsePracticeSessionOptions) => usePracticeSession(props),
      {
        initialProps: { ...defaultOptions, isSessionActive: false },
      }
    );

    expect(mockCapture).not.toHaveBeenCalled();

    rerender({ ...defaultOptions, isSessionActive: true });

    expect(mockCapture).toHaveBeenCalledWith('session_started', { deck_id: 'deck-1' });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('does not double-track start on re-renders', () => {
    const { rerender } = renderHook(
      (props: UsePracticeSessionOptions) => usePracticeSession(props),
      {
        initialProps: { ...defaultOptions, isSessionActive: true },
      }
    );

    expect(mockCapture).toHaveBeenCalledTimes(1);

    // Re-render with same active state — should not fire again
    rerender({ ...defaultOptions, isSessionActive: true });
    rerender({ ...defaultOptions, isSessionActive: true });

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('tracks complete event when isSessionComplete becomes true with correct durationSec', () => {
    vi.setSystemTime(1000000);

    const { rerender } = renderHook(
      (props: UsePracticeSessionOptions) => usePracticeSession(props),
      {
        initialProps: { ...defaultOptions, isSessionActive: true },
      }
    );

    // Advance 30 seconds
    vi.setSystemTime(1030000);

    rerender({ ...defaultOptions, isSessionActive: true, isSessionComplete: true });

    expect(mockCapture).toHaveBeenCalledWith('session_completed', {
      deck_id: 'deck-1',
      duration_sec: 30,
    });
  });

  it('uses fallbackDurationSec when sessionStartTimeRef is null', () => {
    // Complete without ever activating (start ref stays null)
    renderHook((props: UsePracticeSessionOptions) => usePracticeSession(props), {
      initialProps: { ...defaultOptions, isSessionComplete: true, fallbackDurationSec: 42 },
    });

    expect(mockCapture).toHaveBeenCalledWith('session_completed', {
      deck_id: 'deck-1',
      duration_sec: 42,
    });
  });

  it('calls onCompleteTracked after complete event', () => {
    const onCompleteTracked = vi.fn();

    renderHook((props: UsePracticeSessionOptions) => usePracticeSession(props), {
      initialProps: {
        ...defaultOptions,
        isSessionComplete: true,
        onCompleteTracked,
      },
    });

    expect(onCompleteTracked).toHaveBeenCalledTimes(1);
  });

  it('does not double-track complete on re-renders', () => {
    const { rerender } = renderHook(
      (props: UsePracticeSessionOptions) => usePracticeSession(props),
      {
        initialProps: { ...defaultOptions, isSessionComplete: true },
      }
    );

    expect(mockCapture).toHaveBeenCalledTimes(1);

    rerender({ ...defaultOptions, isSessionComplete: true });
    rerender({ ...defaultOptions, isSessionComplete: true });

    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('skips start event when getStartProps returns null', () => {
    renderHook((props: UsePracticeSessionOptions) => usePracticeSession(props), {
      initialProps: {
        ...defaultOptions,
        getStartProps: () => null,
        isSessionActive: true,
      },
    });

    expect(mockCapture).not.toHaveBeenCalledWith('session_started', expect.anything());
  });

  it('skips abandon event when getAbandonProps returns null', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook((props: UsePracticeSessionOptions) => usePracticeSession(props), {
      initialProps: {
        ...defaultOptions,
        getAbandonProps: () => null,
        isSessionActive: true,
      },
    });

    // Fire beforeunload
    window.dispatchEvent(new Event('beforeunload'));

    expect(mockCapture).not.toHaveBeenCalledWith('session_abandoned', expect.anything());

    addEventListenerSpy.mockRestore();
  });

  it('resetTracking() allows re-tracking after reset', () => {
    const { rerender, result } = renderHook(
      (props: UsePracticeSessionOptions) => usePracticeSession(props),
      {
        initialProps: { ...defaultOptions, isSessionActive: true },
      }
    );

    expect(mockCapture).toHaveBeenCalledTimes(1);

    // Reset tracking state
    act(() => {
      result.current.resetTracking();
    });

    vi.clearAllMocks();

    // Toggle active to false then true — should re-trigger start
    rerender({ ...defaultOptions, isSessionActive: false });
    rerender({ ...defaultOptions, isSessionActive: true });

    expect(mockCapture).toHaveBeenCalledWith('session_started', { deck_id: 'deck-1' });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('cleans up beforeunload listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(
      (props: UsePracticeSessionOptions) => usePracticeSession(props),
      {
        initialProps: { ...defaultOptions },
      }
    );

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
