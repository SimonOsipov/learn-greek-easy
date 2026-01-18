/**
 * Mock Exam Timer Hook
 *
 * Manages the countdown timer interval for mock exams.
 * Calls the store's tickTimer every second when the timer is running.
 * Provides formatted time display and warning callbacks.
 */

import { useEffect, useRef } from 'react';

import { useMockExamSessionStore } from '@/stores/mockExamSessionStore';
import type { MockExamTimerWarningLevel } from '@/types/mockExamSession';

export interface UseMockExamTimerOptions {
  /** Callback when warning level changes */
  onWarning?: (level: MockExamTimerWarningLevel) => void;
  /** Callback when timer expires (reaches 0) */
  onExpired?: () => void;
}

export interface UseMockExamTimerResult {
  /** Minutes remaining (0-45) */
  minutes: number;
  /** Seconds remaining (0-59) */
  seconds: number;
  /** Formatted time string "MM:SS" */
  formattedTime: string;
  /** Current warning level */
  warningLevel: MockExamTimerWarningLevel;
  /** Whether timer is currently running */
  isRunning: boolean;
  /** Total remaining seconds */
  remainingSeconds: number;
}

/**
 * Hook for managing mock exam countdown timer
 *
 * @param options - Optional callbacks for warnings and expiration
 * @returns Timer state and formatted time values
 *
 * @example
 * ```tsx
 * const { formattedTime, warningLevel, isRunning } = useMockExamTimer({
 *   onWarning: (level) => {
 *     if (level === 'warning_1min') {
 *       playWarningSound();
 *     }
 *   },
 *   onExpired: () => {
 *     showTimeUpModal();
 *   },
 * });
 * ```
 */
export function useMockExamTimer(options: UseMockExamTimerOptions = {}): UseMockExamTimerResult {
  const { onWarning, onExpired } = options;

  // Get timer state and tick action from store
  const session = useMockExamSessionStore((state) => state.session);
  const tickTimer = useMockExamSessionStore((state) => state.tickTimer);

  // Track previous warning level to detect changes
  const prevWarningLevelRef = useRef<MockExamTimerWarningLevel | null>(null);

  // Extract timer values
  const timer = session?.timer;
  const remainingSeconds = timer?.remainingSeconds ?? 0;
  const isRunning = timer?.isRunning ?? false;
  const warningLevel = timer?.warningLevel ?? 'none';

  // Calculate minutes and seconds
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  // Format time as MM:SS
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Stable callback refs to avoid re-creating interval
  const onWarningRef = useRef(onWarning);
  const onExpiredRef = useRef(onExpired);

  // Update refs when callbacks change
  useEffect(() => {
    onWarningRef.current = onWarning;
    onExpiredRef.current = onExpired;
  }, [onWarning, onExpired]);

  // Handle warning level changes
  useEffect(() => {
    if (warningLevel !== 'none' && warningLevel !== prevWarningLevelRef.current) {
      onWarningRef.current?.(warningLevel);
    }
    prevWarningLevelRef.current = warningLevel;
  }, [warningLevel]);

  // Handle timer expiration
  useEffect(() => {
    if (remainingSeconds === 0 && session?.status === 'expired') {
      onExpiredRef.current?.();
    }
  }, [remainingSeconds, session?.status]);

  // Set up timer interval
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isRunning, tickTimer]);

  return {
    minutes,
    seconds,
    formattedTime,
    warningLevel,
    isRunning,
    remainingSeconds,
  };
}

export default useMockExamTimer;
