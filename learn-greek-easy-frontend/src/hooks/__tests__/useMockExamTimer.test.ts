/**
 * useMockExamTimer Hook Tests
 *
 * Drives the exam countdown. Verifies:
 * - onWarning fires once per level transition (none -> 5min -> 1min), not on re-render
 * - onExpired fires only when status becomes 'expired' (no spurious early auto-submit)
 * - formattedTime padding/boundary behaviour
 * - the tick interval is created while running and cleared when isRunning -> false
 *
 * Seeds store state directly via setState (the hook only reads session.timer and
 * session.status), matching the store-test convention in
 * stores/__tests__/mockExamSessionStore.test.ts.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMockExamTimer } from '@/hooks/useMockExamTimer';
import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamSession } from '@/types/mockExam';
import type {
  MockExamFrontendSessionStatus,
  MockExamSessionData,
  MockExamTimerState,
  MockExamTimerWarningLevel,
} from '@/types/mockExamSession';
import { DEFAULT_SESSION_STATS, MOCK_EXAM_TIME_LIMIT_SECONDS } from '@/types/mockExamSession';

// Quiet logger noise from store internals.
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const backendSession: MockExamSession = {
  id: 'session-1',
  user_id: 'user-1',
  started_at: '2025-01-01T00:00:00.000Z',
  completed_at: null,
  score: 0,
  total_questions: 0,
  passed: false,
  time_taken_seconds: 0,
  status: 'active',
};

function makeTimer(overrides: Partial<MockExamTimerState> = {}): MockExamTimerState {
  return {
    totalSeconds: MOCK_EXAM_TIME_LIMIT_SECONDS,
    remainingSeconds: MOCK_EXAM_TIME_LIMIT_SECONDS,
    isRunning: false,
    warningLevel: 'none',
    lastTickAt: null,
    ...overrides,
  };
}

function makeSession(
  timer: Partial<MockExamTimerState> = {},
  status: MockExamFrontendSessionStatus = 'active'
): MockExamSessionData {
  return {
    backendSession,
    questions: [],
    currentIndex: 0,
    status,
    timer: makeTimer(timer),
    stats: { ...DEFAULT_SESSION_STATS },
    isResumed: false,
    startedAt: '2025-01-01T00:00:00.000Z',
  };
}

/** Push a fresh session object into the store inside act(). */
function setSession(session: MockExamSessionData | null) {
  act(() => {
    useMockExamSessionStore.setState({ session });
  });
}

function resetStore() {
  useMockExamSessionStore.setState({
    session: null,
    summary: null,
    isLoading: false,
    error: null,
    hasRecoverableSession: false,
  });
}

describe('useMockExamTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetStore();
  });

  // -------------------------------------------------------------------------
  // formattedTime padding / boundary
  // -------------------------------------------------------------------------

  describe('formattedTime', () => {
    it('pads minutes and seconds to two digits', () => {
      setSession(makeSession({ remainingSeconds: 65 }));
      const { result } = renderHook(() => useMockExamTimer());

      expect(result.current.minutes).toBe(1);
      expect(result.current.seconds).toBe(5);
      expect(result.current.formattedTime).toBe('01:05');
    });

    it('formats the full 45:00 boundary', () => {
      setSession(makeSession({ remainingSeconds: MOCK_EXAM_TIME_LIMIT_SECONDS }));
      const { result } = renderHook(() => useMockExamTimer());

      expect(result.current.minutes).toBe(45);
      expect(result.current.seconds).toBe(0);
      expect(result.current.formattedTime).toBe('45:00');
    });

    it('formats 00:00 at the zero boundary', () => {
      setSession(makeSession({ remainingSeconds: 0 }, 'expired'));
      const { result } = renderHook(() => useMockExamTimer());

      expect(result.current.formattedTime).toBe('00:00');
    });

    it('defaults to 00:00 when there is no session', () => {
      const { result } = renderHook(() => useMockExamTimer());

      expect(result.current.remainingSeconds).toBe(0);
      expect(result.current.isRunning).toBe(false);
      expect(result.current.warningLevel).toBe('none');
      expect(result.current.formattedTime).toBe('00:00');
    });
  });

  // -------------------------------------------------------------------------
  // onWarning transitions
  // -------------------------------------------------------------------------

  describe('onWarning', () => {
    it('does not fire while warning level is none', () => {
      const onWarning = vi.fn();
      setSession(makeSession({ remainingSeconds: 1000, warningLevel: 'none' }));

      renderHook(() => useMockExamTimer({ onWarning }));

      expect(onWarning).not.toHaveBeenCalled();
    });

    it('fires once when crossing none -> warning_5min', () => {
      const onWarning = vi.fn();
      setSession(makeSession({ remainingSeconds: 301, warningLevel: 'none' }));
      renderHook(() => useMockExamTimer({ onWarning }));

      expect(onWarning).not.toHaveBeenCalled();

      setSession(makeSession({ remainingSeconds: 300, warningLevel: 'warning_5min' }));

      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(onWarning).toHaveBeenCalledWith('warning_5min');
    });

    it('fires once per level transition across the full descent', () => {
      const onWarning = vi.fn();
      setSession(makeSession({ remainingSeconds: 301, warningLevel: 'none' }));
      renderHook(() => useMockExamTimer({ onWarning }));

      setSession(makeSession({ remainingSeconds: 300, warningLevel: 'warning_5min' }));
      setSession(makeSession({ remainingSeconds: 60, warningLevel: 'warning_1min' }));

      expect(onWarning).toHaveBeenCalledTimes(2);
      expect(onWarning).toHaveBeenNthCalledWith(1, 'warning_5min');
      expect(onWarning).toHaveBeenNthCalledWith(2, 'warning_1min');
    });

    it('does not re-fire while the warning level stays the same', () => {
      const onWarning = vi.fn();
      setSession(makeSession({ remainingSeconds: 300, warningLevel: 'warning_5min' }));
      renderHook(() => useMockExamTimer({ onWarning }));

      expect(onWarning).toHaveBeenCalledTimes(1);

      // Time keeps ticking within the same warning band.
      setSession(makeSession({ remainingSeconds: 250, warningLevel: 'warning_5min' }));
      setSession(makeSession({ remainingSeconds: 120, warningLevel: 'warning_5min' }));

      expect(onWarning).toHaveBeenCalledTimes(1);
    });

    it('uses the latest onWarning callback without re-firing', () => {
      const first = vi.fn();
      const second = vi.fn();
      setSession(makeSession({ remainingSeconds: 301, warningLevel: 'none' }));

      const { rerender } = renderHook(
        ({ cb }: { cb: (l: MockExamTimerWarningLevel) => void }) =>
          useMockExamTimer({ onWarning: cb }),
        { initialProps: { cb: first } }
      );

      // Swap callback identity before the transition; ref should update.
      rerender({ cb: second });
      setSession(makeSession({ remainingSeconds: 300, warningLevel: 'warning_5min' }));

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledWith('warning_5min');
    });
  });

  // -------------------------------------------------------------------------
  // onExpired
  // -------------------------------------------------------------------------

  describe('onExpired', () => {
    it('does not fire on mount of an active session', () => {
      const onExpired = vi.fn();
      setSession(makeSession({ remainingSeconds: 300, warningLevel: 'warning_5min' }));

      renderHook(() => useMockExamTimer({ onExpired }));

      expect(onExpired).not.toHaveBeenCalled();
    });

    it('does not fire when remaining hits 0 but status is still active (no early auto-submit)', () => {
      const onExpired = vi.fn();
      setSession(makeSession({ remainingSeconds: 1, warningLevel: 'warning_1min' }));
      renderHook(() => useMockExamTimer({ onExpired }));

      // Reach zero but status has not transitioned to 'expired' yet.
      setSession(makeSession({ remainingSeconds: 0, warningLevel: 'warning_1min' }, 'active'));

      expect(onExpired).not.toHaveBeenCalled();
    });

    it('fires only once status becomes expired at 0 seconds', () => {
      const onExpired = vi.fn();
      setSession(makeSession({ remainingSeconds: 1, warningLevel: 'warning_1min' }));
      renderHook(() => useMockExamTimer({ onExpired }));

      expect(onExpired).not.toHaveBeenCalled();

      setSession(makeSession({ remainingSeconds: 0, warningLevel: 'warning_1min' }, 'expired'));

      expect(onExpired).toHaveBeenCalledTimes(1);
    });

    it('does not fire when status is completed (manual submit, not expiry)', () => {
      const onExpired = vi.fn();
      setSession(makeSession({ remainingSeconds: 0, warningLevel: 'warning_1min' }));
      renderHook(() => useMockExamTimer({ onExpired }));

      setSession(makeSession({ remainingSeconds: 0, warningLevel: 'warning_1min' }, 'completed'));

      expect(onExpired).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // tick interval lifecycle
  // -------------------------------------------------------------------------

  describe('tick interval', () => {
    it('does not call tickTimer when not running', () => {
      const tickTimer = vi.fn();
      useMockExamSessionStore.setState({ tickTimer });
      setSession(makeSession({ remainingSeconds: 1000, isRunning: false }));

      renderHook(() => useMockExamTimer());

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(tickTimer).not.toHaveBeenCalled();
    });

    it('calls tickTimer once per second while running', () => {
      const tickTimer = vi.fn();
      useMockExamSessionStore.setState({ tickTimer });
      setSession(makeSession({ remainingSeconds: 1000, isRunning: true }));

      renderHook(() => useMockExamTimer());

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(tickTimer).toHaveBeenCalledTimes(3);
    });

    it('clears the interval when isRunning transitions to false', () => {
      const tickTimer = vi.fn();
      useMockExamSessionStore.setState({ tickTimer });
      setSession(makeSession({ remainingSeconds: 1000, isRunning: true }));

      renderHook(() => useMockExamTimer());

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(tickTimer).toHaveBeenCalledTimes(2);

      // Stop running.
      setSession(makeSession({ remainingSeconds: 998, isRunning: false }));

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // No further ticks after the interval is cleared.
      expect(tickTimer).toHaveBeenCalledTimes(2);
    });

    it('clears the interval on unmount', () => {
      const tickTimer = vi.fn();
      useMockExamSessionStore.setState({ tickTimer });
      setSession(makeSession({ remainingSeconds: 1000, isRunning: true }));

      const { unmount } = renderHook(() => useMockExamTimer());

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(tickTimer).toHaveBeenCalledTimes(1);

      unmount();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(tickTimer).toHaveBeenCalledTimes(1);
    });
  });
});
